//! 扫描预处理主流程
//!
//! 相对第一版 stub 的关键变化：
//! - 真实 lopdf 解析输入 PDF，按页推进进度；
//! - 真实按 `blankEdgeMarginPx` 缩小 `MediaBox`；
//! - 真实写入新 PDF 字节；
//! - 真实测量 `elapsed_ms` 并填入 summary；
//! - 状态机真实流转：`validating` → `preprocessing` → `writing-output` → `completed`。
//!
//! 仍保留 plan-only 的部分：
//! - 90 度方向检测（`detectOrientation`）：lopdf 不解析压缩 content stream，
//!   文本对象 `cm` 矩阵投票留作后续阶段，参见 `pdf_probe::detect_orientation_vote`。
//! - 微倾斜校正（`deskew`）：无栅格化能力，不修改任何内容。

use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Instant,
};

use lopdf::ObjectId;

use crate::scan_preprocess::{
    pdf_probe::{apply_clean_edge, detect_orientation_vote, probe_pdf, save_pdf, PreprocessOutcome},
    queue::{ScanPreprocessJobQueue, current_iso_timestamp, redact_path},
    types::{ScanPreprocessStoredOptions, ScanPreprocessStoredProgress, ScanPreprocessStoredSummary},
};

#[derive(Debug, Clone)]
pub struct ScanPreprocessRunRequest {
    pub job_id: String,
    pub input_path: String,
    pub output_path: String,
    pub page_range: Option<String>,
    pub options: ScanPreprocessStoredOptions,
}

/// 同步执行扫描预处理，按阶段更新队列；最后返回 outcome 与耗时。
///
/// 调用方负责在调用前把 job upsert（status=running），本函数只更新进度与终态。
pub fn run_scan_preprocess_job(
    queue: Arc<Mutex<ScanPreprocessJobQueue>>,
    request: ScanPreprocessRunRequest,
) -> Result<PreprocessOutcome, String> {
    let started_at = Instant::now();
    let started_iso = current_iso_timestamp();
    update_progress(
        &queue,
        &request.job_id,
        ScanPreprocessStoredProgress {
            stage: "validating".to_string(),
            completed_pages: 0,
            total_pages: 0,
            message: Some("正在解析输入 PDF…".to_string()),
        },
        Some("running".to_string()),
    )?;

    let input_path = PathBuf::from(request.input_path.trim());
    if !input_path.exists() {
        return finalize_failure(
            &queue,
            &request.job_id,
            "输入 PDF 不存在或不可访问。",
        );
    }

    let probe = match probe_pdf(&input_path) {
        Ok(probe) => probe,
        Err(error) => return finalize_failure(&queue, &request.job_id, &error),
    };
    let total_pages = probe.total_pages;

    update_progress(
        &queue,
        &request.job_id,
        ScanPreprocessStoredProgress {
            stage: "preprocessing".to_string(),
            completed_pages: 0,
            total_pages,
            message: Some(format!("共 {total_pages} 页，开始清洁处理。")),
        },
        None,
    )?;

    let outcome = match lopdf_apply(&input_path, &PathBuf::from(request.output_path.trim()), &probe, &request.options) {
        Ok(outcome) => outcome,
        Err(error) => return finalize_failure(&queue, &request.job_id, &error),
    };

    update_progress(
        &queue,
        &request.job_id,
        ScanPreprocessStoredProgress {
            stage: "writing-output".to_string(),
            completed_pages: outcome.total_pages,
            total_pages: outcome.total_pages,
            message: Some("正在写入新 PDF…".to_string()),
        },
        None,
    )?;

    let elapsed_ms = started_at.elapsed().as_millis() as u64;
    let summary = ScanPreprocessStoredSummary {
        total_pages: outcome.total_pages,
        processed_pages: outcome.total_pages,
        rotated_pages: outcome.rotated_pages,
        deskewed_pages: outcome.deskewed_pages,
        split_pages: outcome.split_pages,
        cropped_pages: outcome.cropped_pages,
        blank_edges_cleared_pages: outcome.blank_edges_cleared_pages,
        elapsed_ms,
        output_path: request.output_path.trim().to_string(),
        preprocess_only: true,
    };
    let _ = started_iso;

    let queue_clone = queue.clone();
    let job_id_clone = request.job_id.clone();
    let summary_clone = summary.clone();
    let persist_result = {
        let guard = queue_clone
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        guard.complete(&job_id_clone, "completed".to_string(), summary_clone)
    };
    persist_result.map_err(|error| format!("无法持久化扫描预处理结果：{error}"))?;

    Ok(outcome)
}

fn lopdf_apply(
    input_path: &Path,
    output_path: &Path,
    probe: &crate::scan_preprocess::pdf_probe::PdfProbe,
    options: &ScanPreprocessStoredOptions,
) -> Result<PreprocessOutcome, String> {
    let mut doc = lopdf::Document::load(input_path)
        .map_err(|error| format!("无法重新打开输入 PDF：{error}"))?;

    let page_ids: Vec<ObjectId> = doc.get_pages().values().copied().collect();
    if page_ids.len() as u32 != probe.total_pages {
        return Err("输入 PDF 页数在两次读取之间发生变化，已中止处理。".to_string());
    }

    let vote = if options.detect_orientation {
        detect_orientation_vote(probe, options)
    } else {
        None
    };
    let _ = vote;

    let mut rotated_pages: u32 = 0;
    let mut cropped_pages: u32 = 0;
    let mut blank_edges_cleared_pages: u32 = 0;
    let margin_px = options.blank_edge_margin_px;
    let trim_blank_edges = options.trim_blank_edges;

    for (page_index, page_id) in page_ids.iter().enumerate() {
        if trim_blank_edges && margin_px > 0 {
            if apply_clean_edge(&mut doc, *page_id, margin_px)? {
                blank_edges_cleared_pages += 1;
                cropped_pages += 1;
            }
        }
        // 90 度方向检测在 plan-only 阶段不写 Rotate 字段；保留 vote 占位。
        let _ = rotated_pages;
        let _ = page_index;
    }

    let deskewed_pages: u32 = if options.deskew {
        // 真实 deskew 留待 mupdf/opencv 接入；当前 lopdf 不修改内容。
        0
    } else {
        0
    };

    let split_pages: u32 = if options.split_pages {
        // 拆分双页扫描需要栅格化后判断中间空白；当前 plan-only。
        0
    } else {
        0
    };

    save_pdf(&mut doc, output_path)?;

    Ok(PreprocessOutcome {
        total_pages: probe.total_pages,
        rotated_pages,
        deskewed_pages,
        split_pages,
        cropped_pages,
        blank_edges_cleared_pages,
    })
}

fn update_progress(
    queue: &Arc<Mutex<ScanPreprocessJobQueue>>,
    job_id: &str,
    progress: ScanPreprocessStoredProgress,
    status: Option<String>,
) -> Result<(), String> {
    let guard = queue
        .lock()
        .expect("scan preprocess job queue mutex poisoned");
    guard
        .update_progress(job_id, progress, status)
        .map(|_| ())
}

fn finalize_failure(
    queue: &Arc<Mutex<ScanPreprocessJobQueue>>,
    job_id: &str,
    error_message: &str,
) -> Result<PreprocessOutcome, String> {
    let guard = queue
        .lock()
        .expect("scan preprocess job queue mutex poisoned");
    let _ = guard.fail(job_id, error_message.to_string());
    Err(error_message.to_string())
}

#[allow(dead_code)]
fn ensure_redact_helper_in_use() {
    // 保持 redact_path 在编译期被引用，方便后续在错误信息中真实脱敏。
    let _ = redact_path;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan_preprocess::queue::ScanPreprocessJobQueue;
    use crate::scan_preprocess::types::{
        RedactedPathSummary, ScanPreprocessStoredJob, ScanPreprocessStoredProgress,
    };
    use lopdf::{dictionary, Document, Object};
    use std::env;

    fn make_minimal_pdf() -> Document {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica" });
        let resources_id = doc.add_object(dictionary! { "Font" => dictionary! { "F1" => font_id } });
        let mut page_ids = Vec::new();
        for _ in 0..2 {
            let content_id = doc.add_object(Object::Stream(lopdf::Stream::new(
                lopdf::Dictionary::new(),
                b"BT /F1 12 Tf 100 700 Td (Hello) Tj ET".to_vec(),
            )));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(612), Object::Integer(792)],
                "Resources" => resources_id,
                "Contents" => content_id,
            });
            page_ids.push(page_id);
        }
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Count" => page_ids.len() as i64,
                "Kids" => page_ids.into_iter().map(Object::Reference).collect::<Vec<_>>(),
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc
    }

    fn temp_pdf(label: &str) -> PathBuf {
        let mut doc = make_minimal_pdf();
        let mut path = env::temp_dir();
        let unique = format!(
            "faropdf-scan-runner-{label}-{}.pdf",
            crate::scan_preprocess::queue::current_iso_timestamp()
        );
        path.push(unique);
        doc.save(&path).expect("save");
        path
    }

    fn temp_output(label: &str) -> PathBuf {
        let mut path = env::temp_dir();
        let unique = format!(
            "faropdf-scan-runner-{label}-{}-out.pdf",
            crate::scan_preprocess::queue::current_iso_timestamp()
        );
        path.push(unique);
        path
    }

    fn queue_with_queued_job(label: &str, job_id: &str, input_path: &str, output_path: &str) -> (PathBuf, Arc<Mutex<ScanPreprocessJobQueue>>) {
        let mut queue_path = env::temp_dir();
        let unique = format!(
            "faropdf-scan-runner-queue-{label}-{}.json",
            crate::scan_preprocess::queue::current_iso_timestamp()
        );
        queue_path.push(unique);
        let queue = ScanPreprocessJobQueue::new(queue_path.clone());
        let options = crate::scan_preprocess::queue::stored_options_default();
        let job = ScanPreprocessStoredJob {
            id: job_id.to_string(),
            input_path: input_path.to_string(),
            input_path_summary: RedactedPathSummary {
                kind: "local-pdf".to_string(),
                fingerprint: "deadbeef".to_string(),
                redacted: "[path].pdf".to_string(),
            },
            output_path: output_path.to_string(),
            output_path_summary: RedactedPathSummary {
                kind: "local-pdf".to_string(),
                fingerprint: "cafef00d".to_string(),
                redacted: "[path].pdf".to_string(),
            },
            page_range: None,
            options,
            status: "running".to_string(),
            progress: ScanPreprocessStoredProgress {
                stage: "validating".to_string(),
                completed_pages: 0,
                total_pages: 0,
                message: None,
            },
            summary: None,
            error_message: None,
            created_at: crate::scan_preprocess::queue::current_iso_timestamp(),
            updated_at: crate::scan_preprocess::queue::current_iso_timestamp(),
            started_at: Some(crate::scan_preprocess::queue::current_iso_timestamp()),
            completed_at: None,
        };
        queue.upsert(job).expect("upsert queued job");
        (queue_path, Arc::new(Mutex::new(queue)))
    }

    #[test]
    fn run_scan_preprocess_job_writes_new_pdf_and_summary() {
        let input = temp_pdf("happy");
        let output = temp_output("happy");
        let (queue_path, queue) = queue_with_queued_job(
            "happy",
            "scan-happy",
            input.to_string_lossy().as_ref(),
            output.to_string_lossy().as_ref(),
        );

        let mut options = crate::scan_preprocess::queue::stored_options_default();
        options.trim_blank_edges = true;
        options.blank_edge_margin_px = 20;

        let request = ScanPreprocessRunRequest {
            job_id: "scan-happy".to_string(),
            input_path: input.to_string_lossy().to_string(),
            output_path: output.to_string_lossy().to_string(),
            page_range: None,
            options,
        };

        let outcome = run_scan_preprocess_job(queue.clone(), request).expect("run ok");
        assert_eq!(outcome.total_pages, 2);
        assert!(outcome.blank_edges_cleared_pages >= 1);

        assert!(output.exists(), "output pdf should be written");
        let new_bytes = std::fs::read(&output).expect("read output");
        assert!(new_bytes.starts_with(b"%PDF"));

        let final_job = queue
            .lock()
            .expect("mutex")
            .get("scan-happy")
            .expect("job present");
        assert_eq!(final_job.status, "completed");
        let summary = final_job.summary.expect("summary present");
        assert_eq!(summary.processed_pages, 2);
        assert!(summary.blank_edges_cleared_pages >= 1);
        assert!(summary.elapsed_ms < 30_000);

        let _ = std::fs::remove_file(&input);
        let _ = std::fs::remove_file(&output);
        let _ = std::fs::remove_file(&queue_path);
    }

    #[test]
    fn run_scan_preprocess_job_marks_failure_on_missing_input() {
        let output = temp_output("missing");
        let (queue_path, queue) = queue_with_queued_job(
            "missing",
            "scan-missing",
            "/nonexistent/faropdf-missing.pdf",
            output.to_string_lossy().as_ref(),
        );

        let options = crate::scan_preprocess::queue::stored_options_default();
        let request = ScanPreprocessRunRequest {
            job_id: "scan-missing".to_string(),
            input_path: "/nonexistent/faropdf-missing.pdf".to_string(),
            output_path: output.to_string_lossy().to_string(),
            page_range: None,
            options,
        };

        let result = run_scan_preprocess_job(queue.clone(), request);
        assert!(result.is_err());

        let final_job = queue
            .lock()
            .expect("mutex")
            .get("scan-missing")
            .expect("job present");
        assert_eq!(final_job.status, "failed");
        assert!(final_job.error_message.is_some());

        let _ = std::fs::remove_file(&queue_path);
    }
}
