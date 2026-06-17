use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    env,
    fs,
    net::IpAddr,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use url::Url;
use lopdf::Document;

mod ocr_credentials;
mod ocr_dispatch;
mod ocr_queue;
mod ocr_text_extract;
mod scan_preprocess;
mod update_fallback;
mod util;
mod error;

use ocr_credentials::{read_keychain_secret, resolve_credential_reference, CredentialResolution};
use ocr_dispatch::{dispatch_ocr, OcrDispatchBackend, OcrDispatchError, OcrDispatchRequest};
use ocr_queue::{
    current_iso_timestamp, empty_path_summary, redact_path, OcrJobQueue, OcrJobQueueState,
    OcrStoredJob, OcrStoredProgress, OcrStoredQualityCheck, OcrStoredQualitySummary,
};
use ocr_text_extract::{extract_pdf_text, file_size_or_zero, summarize_extracted_pages};
use scan_preprocess::{
    run_scan_preprocess_job, redact_path as scan_preprocess_redact_path, ScanPreprocessJobQueue,
    ScanPreprocessJobQueueState, ScanPreprocessRunRequest, ScanPreprocessStoredJob,
    ScanPreprocessStoredOptions, ScanPreprocessStoredProgress, ScanPreprocessStoredSummary,
};

const SETTINGS_FILE_NAME: &str = "settings.json";
const OCR_JOB_QUEUE_FILE: &str = "ocr-jobs.json";
const SCAN_PREPROCESS_QUEUE_FILE: &str = "scan-preprocess-jobs.json";

#[derive(Clone, Serialize)]
struct NativeMenuCommandPayload<'a> {
    id: &'a str,
}

#[derive(Serialize)]
struct NativePdfFileResponse {
    bytes: Vec<u8>,
    name: String,
    path: String,
}

fn create_faropdf_window(app_handle: &AppHandle) -> tauri::Result<()> {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    WebviewWindowBuilder::new(
        app_handle,
        format!("faropdf-window-{suffix}"),
        WebviewUrl::default(),
    )
    .title("FaroPDF")
    .inner_size(1280.0, 820.0)
    .min_inner_size(960.0, 640.0)
    .build()
    .map(|_| ())
}

#[tauri::command]
fn read_app_settings(app_handle: AppHandle) -> Result<Option<Value>, String> {
    let settings_path = settings_file_path(&app_handle)?;
    if !settings_path.exists() {
        return Ok(None);
    }

    let contents =
        fs::read_to_string(&settings_path).map_err(|_| "无法读取应用设置文件。".to_string())?;
    let settings = serde_json::from_str::<Value>(&contents)
        .map_err(|_| "应用设置文件格式无效。".to_string())?;

    Ok(Some(sanitize_settings_value(settings)))
}

#[tauri::command]
fn read_pdf_file_from_path(path: String) -> Result<NativePdfFileResponse, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("未选择 PDF 文件。".to_string());
    }

    let input_path = PathBuf::from(trimmed_path);
    let is_pdf = input_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !is_pdf {
        return Err("请选择 PDF 文件。".to_string());
    }

    let bytes = fs::read(&input_path).map_err(|_| "无法读取所选 PDF 文件。".to_string())?;
    let name = input_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("document.pdf")
        .to_string();
    let resolved_path = input_path
        .canonicalize()
        .unwrap_or(input_path)
        .to_string_lossy()
        .to_string();

    Ok(NativePdfFileResponse {
        bytes,
        name,
        path: resolved_path,
    })
}

#[tauri::command]
fn write_app_settings(app_handle: AppHandle, settings: Value) -> Result<Value, String> {
    let sanitized_settings = sanitize_settings_value(settings);
    let settings_path = settings_file_path(&app_handle)?;
    let settings_dir = settings_path
        .parent()
        .ok_or_else(|| "无法定位应用设置目录。".to_string())?;

    fs::create_dir_all(settings_dir).map_err(|_| "无法创建应用设置目录。".to_string())?;
    let contents = serde_json::to_string_pretty(&sanitized_settings)
        .map_err(|_| "无法序列化应用设置。".to_string())?;
    fs::write(&settings_path, contents).map_err(|_| "无法写入应用设置文件。".to_string())?;

    Ok(sanitized_settings)
}

#[tauri::command]
fn start_scan_preprocess_job(
    request: ScanPreprocessCommandRequest,
    state: State<'_, ScanPreprocessJobQueueState>,
) -> Result<ScanPreprocessCommandJob, String> {
    validate_scan_preprocess_request(&request)?;

    let input_path = PathBuf::from(request.input_path.trim());
    let output_path = resolve_scan_preprocess_output_path(
        input_path,
        request
            .output_path
            .as_ref()
            .map(|path| PathBuf::from(path.trim())),
    )?;
    let output_path_string = output_path.to_string_lossy().to_string();
    let now = current_iso_timestamp();
    let job_id = format!("scan-preprocess-{now}");

    let stored_options = stored_options_from_command(&request.options);
    let stored = ScanPreprocessStoredJob {
        id: job_id.clone(),
        input_path: request.input_path.trim().to_string(),
        input_path_summary: scan_preprocess_redact_path(&request.input_path),
        output_path: output_path_string.clone(),
        output_path_summary: scan_preprocess_redact_path(&output_path_string),
        page_range: request.page_range.clone(),
        options: stored_options,
        status: "running".to_string(),
        progress: ScanPreprocessStoredProgress {
            stage: "validating".to_string(),
            completed_pages: 0,
            total_pages: 0,
            message: Some("正在准备扫描预处理任务…".to_string()),
        },
        summary: None,
        error_message: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        started_at: Some(now.clone()),
        completed_at: None,
    };
    state
        .inner()
        .0
        .lock()
        .expect("scan preprocess job queue mutex poisoned")
        .upsert(stored.clone())
        .map_err(|error| format!("无法持久化扫描预处理任务：{error}"))?;

    let queue_state = state.inner().clone();
    let run_request = ScanPreprocessRunRequest {
        job_id: job_id.clone(),
        input_path: stored.input_path.clone(),
        output_path: stored.output_path.clone(),
        page_range: stored.page_range.clone(),
        options: stored.options.clone(),
    };
    tauri::async_runtime::spawn(async move {
        let queue = queue_state.0.clone();
        if let Err(error) = run_scan_preprocess_job(queue, run_request) {
            // runner 自身已经把 status=failed 持久化；此处仅记录日志。
            eprintln!("[scan-preprocess] job {job_id} failed: {error}");
        }
    });

    Ok(scan_stored_to_command_job(&stored))
}

#[tauri::command]
fn list_scan_preprocess_jobs(
    state: State<'_, ScanPreprocessJobQueueState>,
) -> Result<Vec<ScanPreprocessCommandJob>, String> {
    let jobs = state
        .inner()
        .0
        .lock()
        .expect("scan preprocess job queue mutex poisoned")
        .list();
    Ok(jobs
        .into_iter()
        .map(|stored| scan_stored_to_command_job(&stored))
        .collect())
}

#[tauri::command]
fn poll_scan_preprocess_job(
    job_id: String,
    state: State<'_, ScanPreprocessJobQueueState>,
) -> Result<Option<ScanPreprocessCommandJob>, String> {
    let job = state
        .inner()
        .0
        .lock()
        .expect("scan preprocess job queue mutex poisoned")
        .get(&job_id);
    Ok(job.map(|stored| scan_stored_to_command_job(&stored)))
}

#[tauri::command]
fn cancel_scan_preprocess_job(
    job_id: String,
    state: State<'_, ScanPreprocessJobQueueState>,
) -> Result<Option<ScanPreprocessCommandJob>, String> {
    let cancelled = state
        .inner()
        .0
        .lock()
        .expect("scan preprocess job queue mutex poisoned")
        .cancel(&job_id)
        .map_err(|error| format!("无法取消扫描预处理任务：{error}"))?;
    Ok(cancelled.map(|stored| scan_stored_to_command_job(&stored)))
}

fn scan_stored_to_command_job(stored: &ScanPreprocessStoredJob) -> ScanPreprocessCommandJob {
    ScanPreprocessCommandJob {
        id: stored.id.clone(),
        input_path: stored.input_path.clone(),
        output_path: stored.output_path.clone(),
        page_range: stored.page_range.clone(),
        status: stored.status.clone(),
        options: command_options_from_stored(&stored.options),
        progress: ScanPreprocessCommandProgress {
            stage: stored.progress.stage.clone(),
            completed_pages: stored.progress.completed_pages,
            total_pages: stored.progress.total_pages,
            message: stored.progress.message.clone(),
        },
        summary: stored
            .summary
            .clone()
            .map(stored_summary_to_command_summary)
            .unwrap_or_else(default_command_summary),
        error_message: stored.error_message.clone(),
        created_at: stored.created_at.clone(),
        updated_at: stored.updated_at.clone(),
        started_at: stored.started_at.clone(),
        completed_at: stored.completed_at.clone(),
    }
}

fn stored_options_from_command(options: &ScanPreprocessCommandOptions) -> ScanPreprocessStoredOptions {
    ScanPreprocessStoredOptions {
        enhance_scans: options.enhance_scans,
        detect_orientation: options.detect_orientation,
        deskew: options.deskew,
        split_pages: options.split_pages,
        crop_pages: options.crop_pages,
        trim_blank_edges: options.trim_blank_edges,
        output_mode: options.output_mode.clone(),
        dpi: options.dpi as u32,
        jpeg_quality: options.jpeg_quality as u32,
        skew_threshold_degrees: options.skew_threshold_degrees,
        rotation_confidence: options.rotation_confidence,
        max_deskew_degrees: options.max_deskew_degrees,
        blank_edge_margin_px: options.blank_edge_margin_px as u32,
        blank_edge_threshold: options.blank_edge_threshold as u32,
        parallel_jobs: options.parallel_jobs as u32,
        chunk_pages: options.chunk_pages as u32,
        preserve_original_page_size: options.preserve_original_page_size,
    }
}

fn command_options_from_stored(options: &ScanPreprocessStoredOptions) -> ScanPreprocessCommandOptions {
    ScanPreprocessCommandOptions {
        enhance_scans: options.enhance_scans,
        detect_orientation: options.detect_orientation,
        deskew: options.deskew,
        split_pages: options.split_pages,
        crop_pages: options.crop_pages,
        trim_blank_edges: options.trim_blank_edges,
        output_mode: options.output_mode.clone(),
        dpi: options.dpi.min(u16::MAX as u32) as u16,
        jpeg_quality: options.jpeg_quality.min(u8::MAX as u32) as u8,
        skew_threshold_degrees: options.skew_threshold_degrees,
        rotation_confidence: options.rotation_confidence,
        max_deskew_degrees: options.max_deskew_degrees,
        blank_edge_margin_px: options.blank_edge_margin_px.min(u16::MAX as u32) as u16,
        blank_edge_threshold: options.blank_edge_threshold.min(u8::MAX as u32) as u8,
        parallel_jobs: options.parallel_jobs.min(u8::MAX as u32) as u8,
        chunk_pages: options.chunk_pages.min(u16::MAX as u32) as u16,
        preserve_original_page_size: options.preserve_original_page_size,
    }
}

fn stored_summary_to_command_summary(summary: ScanPreprocessStoredSummary) -> ScanPreprocessCommandSummary {
    ScanPreprocessCommandSummary {
        total_pages: summary.total_pages,
        processed_pages: summary.processed_pages,
        rotated_pages: summary.rotated_pages,
        deskewed_pages: summary.deskewed_pages,
        split_pages: summary.split_pages,
        cropped_pages: summary.cropped_pages,
        blank_edges_cleared_pages: summary.blank_edges_cleared_pages,
        elapsed_ms: summary.elapsed_ms,
        output_path: summary.output_path,
        preprocess_only: summary.preprocess_only,
    }
}

fn default_command_summary() -> ScanPreprocessCommandSummary {
    ScanPreprocessCommandSummary {
        total_pages: 0,
        processed_pages: 0,
        rotated_pages: 0,
        deskewed_pages: 0,
        split_pages: 0,
        cropped_pages: 0,
        blank_edges_cleared_pages: 0,
        elapsed_ms: 0,
        output_path: String::new(),
        preprocess_only: true,
    }
}

#[tauri::command]
fn start_ocr_job(
    request: OcrCommandRequest,
    state: State<'_, OcrJobQueueState>,
) -> Result<OcrCommandJob, String> {
    validate_ocr_request(&request)?;

    let backend = OcrDispatchBackend::from_str(&request.provider.provider_type)
        .ok_or_else(|| "OCR Provider 类型无效。".to_string())?;

    let input_path = PathBuf::from(request.input_path.trim());
    let output_path = resolve_ocr_output_path(
        input_path.clone(),
        request
            .output_path
            .as_ref()
            .map(|path| PathBuf::from(path.trim())),
    )?;
    let output_path_string = output_path.to_string_lossy().to_string();
    let quality_check = request
        .quality_check
        .clone()
        .unwrap_or_else(default_ocr_quality_check);
    let now = current_iso_timestamp();
    let id = format!("ocr-{now}");

    let api_key = if matches!(backend, OcrDispatchBackend::PaddleOcr | OcrDispatchBackend::MinerU) {
        match resolve_credential_reference(
            request.provider.api_key_ref.as_deref().unwrap_or(""),
        ) {
            CredentialResolution::Resolved => {
                resolve_api_key_for_dispatch(request.provider.api_key_ref.as_deref())?
            }
            CredentialResolution::MissingEnvVar(slot) => {
                return Err(format!(
                    "{} 凭证不可用：环境变量 {slot} 未设置。",
                    ocr_provider_display_name(&request.provider)
                ));
            }
            CredentialResolution::MissingKeychainEntry { provider_id, key_name } => {
                return Err(format!(
                    "{} 凭证不可用：OS Keychain 中未找到 keychain:{provider_id}:{key_name} 对应的条目。",
                    ocr_provider_display_name(&request.provider)
                ));
            }
            CredentialResolution::UnsupportedScheme(scheme) => {
                return Err(format!(
                    "{} 凭证不可用：{scheme} 暂未集成，请改用 env:&lt;NAME&gt;。",
                    ocr_provider_display_name(&request.provider)
                ));
            }
            CredentialResolution::NotResolvable(_) => {
                return Err(format!(
                    "{} 凭证不可用：apiKeyRef 不是可解析的引用。",
                    ocr_provider_display_name(&request.provider)
                ));
            }
        }
    } else {
        None
    };

    let stored = OcrStoredJob {
        id: id.clone(),
        input_path: request.input_path.clone(),
        input_path_summary: redact_path(&request.input_path),
        output_path: output_path_string.clone(),
        output_path_summary: redact_path(&output_path_string),
        page_range: request.page_range.clone(),
        backend: backend.as_str().to_string(),
        provider_id: request.provider.id.clone(),
        status: "running".to_string(),
        output_strategy: request.output_strategy.clone(),
        progress: OcrStoredProgress {
            stage: "dispatching-provider".to_string(),
            completed_pages: 0,
            total_pages: 0,
            message: Some(format!(
                "{} 正在准备派发到 {}。",
                ocr_provider_display_name(&request.provider),
                backend_label(backend)
            )),
        },
        quality_check: OcrStoredQualityCheck {
            enabled: quality_check.enabled,
            sample_pages: quality_check.sample_pages.clone(),
            keywords: quality_check.keywords.clone(),
        },
        quality: None,
        error_message: None,
        created_at: now.clone(),
        updated_at: now.clone(),
        started_at: Some(now.clone()),
        completed_at: None,
    };
    let queue_state = state.inner().clone();
    state
        .inner()
        .0
        .lock()
        .expect("ocr job queue mutex poisoned")
        .upsert(stored.clone())?;

    let dispatch_request = OcrDispatchRequest {
        backend,
        input_path: request.input_path.clone(),
        output_path: output_path_string.clone(),
        page_range: request.page_range.clone(),
        endpoint: request.provider.endpoint.clone(),
        api_key,
    };

    let queue = queue_state;
    let job_id = id.clone();
    let provider_label = ocr_provider_display_name(&request.provider);
    let quality_check_for_task = stored.quality_check.clone();
    tauri::async_runtime::spawn(async move {
        run_ocr_job(queue, job_id, dispatch_request, quality_check_for_task, provider_label).await;
    });

    Ok(stored_to_command_job(&stored, &request))
}

#[tauri::command]
fn list_ocr_jobs(state: State<'_, OcrJobQueueState>) -> Result<Vec<OcrCommandJob>, String> {
    let jobs = state
        .inner()
        .0
        .lock()
        .expect("ocr job queue mutex poisoned")
        .list();
    Ok(jobs
        .into_iter()
        .map(|job| stored_to_command_job(&job, &OcrCommandRequest::from_stored(&job)))
        .collect())
}

#[tauri::command]
fn poll_ocr_job(
    job_id: String,
    state: State<'_, OcrJobQueueState>,
) -> Result<Option<OcrCommandJob>, String> {
    let job = state
        .inner()
        .0
        .lock()
        .expect("ocr job queue mutex poisoned")
        .get(&job_id);
    Ok(job.map(|stored| {
        let request = OcrCommandRequest::from_stored(&stored);
        stored_to_command_job(&stored, &request)
    }))
}

#[tauri::command]
fn cancel_ocr_job(
    job_id: String,
    state: State<'_, OcrJobQueueState>,
) -> Result<Option<OcrCommandJob>, String> {
    let cancelled = state
        .inner()
        .0
        .lock()
        .expect("ocr job queue mutex poisoned")
        .cancel(&job_id)?;
    Ok(cancelled.map(|stored| {
        let request = OcrCommandRequest::from_stored(&stored);
        stored_to_command_job(&stored, &request)
    }))
}

#[tauri::command]
fn extract_ocr_text(pdf_path: String) -> Result<OcrTextExtractionResponse, String> {
    let path = PathBuf::from(pdf_path.trim());
    let pages = extract_pdf_text(&path).map_err(|error| error.short_message())?;
    let summary = summarize_extracted_pages(&pages);
    Ok(OcrTextExtractionResponse {
        pages: pages
            .into_iter()
            .map(|page| OcrTextExtractionPage {
                page_index: page.page_index,
                text: page.text,
            })
            .collect(),
        total_pages: summary.total_pages,
        searchable_pages: summary.searchable_pages,
    })
}

#[tauri::command]
fn set_pdfpassword(request: serde_json::Value) -> Result<serde_json::Value, String> {
    // v0.1：依赖的 encrypt API 暂不在默认 lopdf features 中（需 pdf_writer feature）。
    // 等 v0.2 升级到 0.34 或引入 qpdf；本阶段先返回 not-supported 让 UI 走备用通道。
    // 注意：UI 端 (SecurityPanel) 应当 disable「设置密码」按钮、避免用户在本阶段意外
    // 把 owner_password 作为 IPC payload 发出。
    let _ = request;
    Err("设置密码（PDF 加密）暂未启用：v0.2 升级 lopdf 到 0.34 或引入 qpdf。".to_string())
}

#[tauri::command]
fn remove_pdfpassword(request: serde_json::Value) -> Result<serde_json::Value, String> {
    let input_path = request
        .get("input_path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let user_pwd = request
        .get("user_password")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let raw_source_path = PathBuf::from(input_path.trim());
    if !raw_source_path.exists() {
        // 不回显完整路径（DEC-102 P0-1）：仅给 basename + 提示。
        return Err(format!(
            "文件不存在: {}",
            redact_path_for_error(&raw_source_path)
        ));
    }
    // canonicalize 防 path traversal（DEC-102 P0-3）。如果 canonicalize 失败（例如
    // symlink loop、权限不足），按原 trimmed 路径继续，但仍走 basename 脱敏。
    let source_path = raw_source_path
        .canonicalize()
        .unwrap_or_else(|_| raw_source_path.clone());
    if user_pwd.is_empty() {
        return Err("请提供用户密码。".to_string());
    }
    // lopdf 错误不直接 format 进 Err（DEC-102 P0-2）：只 eprintln 内部细节，
    // 用户看到的错误是固定文案 + 脱敏路径 basename。
    let mut doc = Document::load(&source_path).map_err(|e| {
        eprintln!("remove_pdfpassword load error: {e}");
        format!("解析 PDF 失败：{}", redact_path_for_error(&source_path))
    })?;
    if !doc.is_encrypted() {
        return Err("PDF 没有设置密码，无需移除。".to_string());
    }
    doc.decrypt(&user_pwd).map_err(|e| {
        eprintln!("remove_pdfpassword decrypt error: {e}");
        // 密码错误不区分具体 lopdf 失败原因（避免反向诱导用户试密码字典）。
        "密码错误或解密失败。".to_string()
    })?;
    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let parent = source_path.parent().unwrap_or(Path::new("."));
    let output_path = parent.join(format!("{stem}-unsecured.pdf"));
    // 不静默覆盖已有副本（DEC-102 P0-3）：若存在则报错，用户先手动处理。
    if output_path.exists() {
        return Err(format!(
            "输出副本 {} 已存在，请先删除或重命名后重试。",
            redact_path_for_error(&output_path)
        ));
    }
    doc.save(&output_path).map_err(|e| {
        eprintln!("remove_pdfpassword save error: {e}");
        format!("保存副本失败：{}", redact_path_for_error(&output_path))
    })?;
    Ok(serde_json::json!({
        "path": output_path.to_string_lossy(),
        "size_bytes": std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0),
    }))
}

/// 把绝对路径脱敏为「[path:<basename>]」形式，避免 IPC 错误回显时把完整目录暴露给前端。
/// DEC-102 P0-1：与 ocr_queue::redact_path 行为对齐（保留 basename 用于用户辨识）。
fn redact_path_for_error(path: &Path) -> String {
    let basename = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("[unknown]");
    format!("[path:{basename}]")
}

/// ISS-072 阶段 2：用 lopdf 直接编辑 InfoDict 的 Producer 字段，绕过 pdf-lib
/// `save()` 的 force override（DEC-109 / DEC-136）。
///
/// 律师场景：用户整理客户文件时希望 Producer 显示为 "FaroPDF"，而非
/// `pdf-lib (https://github.com/Hopding/pdf-lib)`（暴露底层实现）。
///
/// 流程：
///   1) 加载源 PDF（canonicalize 防 path traversal）
///   2) 读取 trailer 的 Info 引用（若无则创建）
///   3) 设置 Info.Producer = producer 字符串
///   4) 同步更新 Info.ModDate（D:YYYYMMDDHHmmSSOHH'mm'）
///   5) 保存为 `<stem>-metadata.pdf` 副本（不静默覆盖）
#[tauri::command]
fn set_pdf_producer(request: serde_json::Value) -> Result<serde_json::Value, String> {
    use lopdf::Object;
    let input_path = request
        .get("input_path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let producer = request
        .get("producer")
        .and_then(|v| v.as_str())
        .unwrap_or("FaroPDF")
        .to_string();
    if producer.trim().is_empty() {
        return Err("Producer 不能为空。".to_string());
    }
    let raw_source_path = PathBuf::from(input_path.trim());
    if !raw_source_path.exists() {
        return Err(format!(
            "文件不存在: {}",
            redact_path_for_error(&raw_source_path)
        ));
    }
    let source_path = raw_source_path
        .canonicalize()
        .unwrap_or_else(|_| raw_source_path.clone());
    let mut doc = Document::load(&source_path).map_err(|e| {
        eprintln!("set_pdf_producer load error: {e}");
        format!("解析 PDF 失败：{}", redact_path_for_error(&source_path))
    })?;
    // trailer.Info 是 PDFRef；若无 Info dict 则创建空 dict 并挂回 trailer。
    let info_ref = match doc.trailer.get(b"Info") {
        Ok(Object::Reference(r)) => *r,
        Ok(_) => {
            return Err("Info 字段非引用类型，无法安全修改。".to_string());
        }
        Err(_) => {
            let new_info = lopdf::Dictionary::new();
            let r = doc.add_object(new_info);
            doc.trailer.set("Info", Object::Reference(r));
            r
        }
    };
    if let Some(info_dict) = doc.objects.get_mut(&info_ref) {
        if let Object::Dictionary(dict) = info_dict {
            // 只改 Producer 字段；ModDate 由前端 pdf-lib writePdfMetadata 已设
            // （DEC-109 properties.ts 阶段 1 流程），lopdf 二次处理不重复设置避免时区格式分歧。
            dict.set("Producer", Object::string_literal(producer.clone()));
        } else {
            return Err("Info 对象非字典类型。".to_string());
        }
    } else {
        return Err("无法定位 Info 字典。".to_string());
    }
    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let parent = source_path.parent().unwrap_or(Path::new("."));
    let output_path = parent.join(format!("{stem}-metadata.pdf"));
    if output_path.exists() {
        return Err(format!(
            "输出副本 {} 已存在，请先删除或重命名后重试。",
            redact_path_for_error(&output_path)
        ));
    }
    doc.save(&output_path).map_err(|e| {
        eprintln!("set_pdf_producer save error: {e}");
        format!("保存副本失败：{}", redact_path_for_error(&output_path))
    })?;
    Ok(serde_json::json!({
        "path": output_path.to_string_lossy(),
        "producer": producer,
        "size_bytes": std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0),
    }))
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let ocr_queue = OcrJobQueue::new(ocr_job_queue_path(&app.handle())?);
            app.manage(OcrJobQueueState(std::sync::Arc::new(Mutex::new(ocr_queue))));
            let scan_queue = ScanPreprocessJobQueue::new(scan_preprocess_job_queue_path(&app.handle())?);
            app.manage(ScanPreprocessJobQueueState(std::sync::Arc::new(Mutex::new(
                scan_queue,
            ))));

            // ISS-032 / ISS-039: macOS 菜单栏中文化，并把深层命令桥接到前端 command model。
            let menu = MenuBuilder::new(app)
                .item(&SubmenuBuilder::new(app, "文件")
                    .text("file-new-window", "新建窗口")
                    .text("file-open", "打开…")
                    .separator()
                    .text("file-save-as", "另存为…")
                    .separator()
                    .text("close-window", "关闭窗口")
                    .build()?)
                .item(&SubmenuBuilder::new(app, "编辑")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?)
                .item(&SubmenuBuilder::new(app, "视图")
                    .text("view-summary", "文档摘要")
                    .text("view-pages", "页面管理")
                    .text("view-settings", "视图设置")
                    .separator()
                    .text("view-fullscreen", "全屏")
                    .build()?)
                .item(&SubmenuBuilder::new(app, "工具")
                    .text("export-page-number", "添加页码…")
                    .text("export-bates", "Bates 编号…")
                    .text("export-header-footer", "页眉页脚…")
                    .separator()
                    .text("export-watermark-text", "文字水印")
                    .text("export-watermark-image", "图片水印")
                    .text("export-compress", "压缩…")
                    .separator()
                    .text("annotations-flatten", "批注扁平化")
                    .text("forms-flatten", "表单扁平化")
                    .build()?)
                .item(&SubmenuBuilder::new(app, "窗口")
                    .minimize()
                    .separator()
                    .close_window()
                    .build()?)
                .item(&SubmenuBuilder::new(app, "帮助")
                    .text("help-about", "关于 FaroPDF")
                    .build()?)
                .build()?;
            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                let command_id = event.id().0.as_str();
                match command_id {
                    "close-window" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.close();
                        }
                    }
                    "view-fullscreen" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if let Ok(is_fullscreen) = window.is_fullscreen() {
                                let _ = window.set_fullscreen(!is_fullscreen);
                            }
                        }
                    }
                    "file-new-window" => {
                        let _ = create_faropdf_window(app_handle);
                    }
                    "file-open"
                    | "file-save-as"
                    | "view-summary"
                    | "view-pages"
                    | "view-settings"
                    | "export-page-number"
                    | "export-bates"
                    | "export-header-footer"
                    | "export-watermark-text"
                    | "export-watermark-image"
                    | "export-compress"
                    | "annotations-flatten"
                    | "forms-flatten"
                    | "help-about" => {
                        let _ = app_handle.emit("faropdf://command", NativeMenuCommandPayload {
                            id: command_id,
                        });
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_app_settings,
            write_app_settings,
            read_pdf_file_from_path,
            start_scan_preprocess_job,
            list_scan_preprocess_jobs,
            poll_scan_preprocess_job,
            cancel_scan_preprocess_job,
            start_ocr_job,
            list_ocr_jobs,
            poll_ocr_job,
            cancel_ocr_job,
            extract_ocr_text,
            set_pdfpassword,
            remove_pdfpassword,
            set_pdf_producer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn ocr_job_queue_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|_| "无法定位应用设置目录。".to_string())?;
    app_config_dir.push(OCR_JOB_QUEUE_FILE);
    Ok(app_config_dir)
}

fn scan_preprocess_job_queue_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|_| "无法定位应用设置目录。".to_string())?;
    app_config_dir.push(SCAN_PREPROCESS_QUEUE_FILE);
    Ok(app_config_dir)
}

fn settings_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|_| "无法定位应用设置目录。".to_string())?;
    app_config_dir.push(SETTINGS_FILE_NAME);
    Ok(app_config_dir)
}

fn sanitize_settings_value(value: Value) -> Value {
    match value {
        Value::Array(items) => {
            Value::Array(items.into_iter().map(sanitize_settings_value).collect())
        }
        Value::Object(map) => Value::Object(sanitize_settings_object(map)),
        other => other,
    }
}

fn sanitize_settings_object(map: Map<String, Value>) -> Map<String, Value> {
    map.into_iter()
        .map(|(key, value)| {
            let sanitized_value = if key == "apiKeyRef" {
                sanitize_api_key_ref_value(value)
            } else if is_sensitive_key(&key) {
                Value::String("[redacted]".to_string())
            } else {
                sanitize_settings_value(value)
            };
            (key, sanitized_value)
        })
        .collect()
}

fn sanitize_api_key_ref_value(value: Value) -> Value {
    match value {
        Value::String(secret) => Value::String(sanitize_api_key_ref(&secret)),
        other => sanitize_settings_value(other),
    }
}

fn sanitize_api_key_ref(api_key_ref: &str) -> String {
    let trimmed = api_key_ref.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if is_credential_reference(trimmed) || is_masked_secret(trimmed) {
        return trimmed.to_string();
    }

    mask_secret(trimmed)
}

fn mask_secret(secret: &str) -> String {
    let chars = secret.chars().collect::<Vec<_>>();
    if chars.len() <= 4 {
        return "***".to_string();
    }

    let prefix = chars.iter().take(4).collect::<String>();
    let suffix = chars
        .iter()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

fn is_credential_reference(value: &str) -> bool {
    const PREFIXES: [&str; 5] = [
        "keychain:",
        "env:",
        "credential:",
        "credential-ref:",
        "api-key-ref:",
    ];

    let Some(prefix) = PREFIXES.iter().find(|prefix| value.starts_with(**prefix)) else {
        return false;
    };
    let rest = &value[prefix.len()..];
    !rest.is_empty()
        && rest.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | ':' | '/' | '-')
        })
}

fn is_masked_secret(value: &str) -> bool {
    value.contains("...") || value.chars().all(|character| character == '*')
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase().replace(['_', '-'], "");
    matches!(
        normalized.as_str(),
        "apikey" | "secret" | "token" | "password" | "accesskey" | "secretkey"
    )
}

async fn run_ocr_job(
    queue: OcrJobQueueState,
    job_id: String,
    dispatch_request: OcrDispatchRequest,
    quality_check: OcrStoredQualityCheck,
    provider_label: String,
) {
    let started_at_ms = current_unix_millis();
    let dispatch_result = tauri::async_runtime::spawn_blocking(move || {
        dispatch_ocr(&dispatch_request)
    })
    .await;

    let mut guard = queue.0.lock().expect("ocr job queue mutex poisoned");
    let _ = &mut guard;
    let Some(mut job) = guard.get(&job_id) else {
        return;
    };

    match dispatch_result {
        Ok(Ok(result)) => {
            job.status = "completed".to_string();
            job.progress.stage = "completed".to_string();
            job.progress.message = Some(format!(
                "{} 完成双层 PDF 生成，输出大小 {} 字节。",
                provider_label, result.output_size_bytes
            ));
            job.progress.completed_pages = result.total_pages;
            let now = current_iso_timestamp();
            job.updated_at = now.clone();
            job.completed_at = Some(now);
            job.error_message = None;

            if quality_check.enabled {
                let output_size = file_size_or_zero(Path::new(&job.output_path));
                let input_size = file_size_or_zero(Path::new(&job.input_path));
                let elapsed_ms = current_unix_millis().saturating_sub(started_at_ms);
                match extract_pdf_text(Path::new(&job.output_path)) {
                    Ok(pages) => {
                        let summary = summarize_extracted_pages(&pages);
                        let keywords = quality_check.keywords.clone();
                        let matched = compute_matched_keywords(&pages, &keywords);
                        let ratio = if input_size > 0 {
                            Some(output_size as f64 / input_size as f64)
                        } else {
                            None
                        };
                        job.quality = Some(OcrStoredQualitySummary {
                            searched_keywords: keywords,
                            matched_keywords: matched,
                            text_pages: summary.searchable_pages,
                            empty_text_pages: summary.total_pages.saturating_sub(summary.searchable_pages),
                            file_size_ratio: ratio,
                            elapsed_ms: Some(elapsed_ms),
                        });
                        job.progress.message = Some(format!(
                            "{} 完成 OCR 质量抽查：可检索页 {} / {}。",
                            provider_label, summary.searchable_pages, summary.total_pages
                        ));
                    }
                    Err(error) => {
                        job.progress.message = Some(format!(
                            "{} OCR 完成，但质量抽查不可用：{}",
                            provider_label,
                            error.short_message()
                        ));
                    }
                }
            }

            let _ = guard.upsert(job.clone());
        }
        Ok(Err(error)) => {
            job.status = "failed".to_string();
            job.progress.stage = "failed".to_string();
            job.error_message = Some(sanitize_dispatch_error(&error));
            job.progress.message = Some(sanitize_dispatch_error(&error));
            let now = current_iso_timestamp();
            job.updated_at = now.clone();
            if job.completed_at.is_none() {
                job.completed_at = Some(now);
            }
            let _ = guard.upsert(job.clone());
        }
        Err(join_error) => {
            job.status = "failed".to_string();
            job.progress.stage = "failed".to_string();
            job.error_message = Some(format!("OCR 任务派发失败：{join_error}"));
            job.progress.message = Some(format!("OCR 任务派发失败：{join_error}"));
            let now = current_iso_timestamp();
            job.updated_at = now.clone();
            if job.completed_at.is_none() {
                job.completed_at = Some(now);
            }
            let _ = guard.upsert(job.clone());
        }
    }
}

fn compute_matched_keywords(pages: &[ocr_text_extract::OcrExtractedPage], keywords: &[String]) -> Vec<String> {
    let full_text = pages
        .iter()
        .map(|page| page.text.clone())
        .collect::<Vec<_>>()
        .join("\n")
        .to_lowercase();
    keywords
        .iter()
        .filter(|keyword| full_text.contains(&keyword.to_lowercase()))
        .cloned()
        .collect()
}

fn sanitize_dispatch_error(error: &OcrDispatchError) -> String {
    let message = error.short_message();
    redact_path_in_message(&message)
}

fn redact_path_in_message(message: &str) -> String {
    message
        .replace(
            &request_target_redaction(),
            "[path]",
        )
}

fn request_target_redaction() -> String {
    // 占位：实际不依赖调用方路径，但保留 hook 给后续接入更精确的脱敏。
    String::new()
}

fn backend_label(backend: OcrDispatchBackend) -> &'static str {
    match backend {
        OcrDispatchBackend::LocalOcrMyPdf => "本地 ocrmypdf",
        OcrDispatchBackend::LegalSkills => "Legal Skills",
        OcrDispatchBackend::PaddleOcr => "PaddleOCR API",
        OcrDispatchBackend::MinerU => "MinerU API",
    }
}

fn resolve_api_key_for_dispatch(api_key_ref: Option<&str>) -> Result<Option<String>, String> {
    let Some(reference) = api_key_ref else {
        return Ok(None);
    };
    let trimmed = reference.trim();
    if let Some(rest) = trimmed.strip_prefix("env:") {
        match env::var(rest) {
            Ok(value) if !value.trim().is_empty() => return Ok(Some(value)),
            _ => {
                return Err(format!(
                    "环境变量 {rest} 未设置或为空，请配置 apiKeyRef 后重试。"
                ));
            }
        }
    }
    if let Some(rest) = trimmed.strip_prefix("keychain:") {
        let parts: Vec<&str> = rest.splitn(2, ':').collect();
        if parts.len() == 2 {
            return read_keychain_secret(parts[0], parts[1]).map(Some);
        }
    }
    Err("当前仅支持 env:&lt;NAME&gt; 和 keychain:&lt;providerId&gt;:&lt;keyName&gt; 形式的 API Key 引用。".to_string())
}

fn stored_to_command_job(stored: &OcrStoredJob, request: &OcrCommandRequest) -> OcrCommandJob {
    OcrCommandJob {
        id: stored.id.clone(),
        input_path: stored.input_path.clone(),
        output_path: stored.output_path.clone(),
        page_range: stored.page_range.clone(),
        backend: stored.backend.clone(),
        provider_id: stored.provider_id.clone(),
        status: stored.status.clone(),
        output_strategy: stored.output_strategy.clone(),
        progress: OcrCommandProgress {
            stage: stored.progress.stage.clone(),
            completed_pages: stored.progress.completed_pages,
            total_pages: stored.progress.total_pages,
            message: stored.progress.message.clone(),
        },
        quality_check: OcrCommandQualityCheckRequest {
            enabled: stored.quality_check.enabled,
            sample_pages: stored.quality_check.sample_pages.clone(),
            keywords: stored.quality_check.keywords.clone(),
        },
        quality: stored.quality.clone(),
        error_message: stored.error_message.clone(),
        created_at: stored.created_at.clone(),
        updated_at: stored.updated_at.clone(),
        started_at: stored.started_at.clone(),
        completed_at: stored.completed_at.clone(),
        input_path_summary: stored.input_path_summary.clone(),
        output_path_summary: stored.output_path_summary.clone(),
        network_consent_granted: request.network_consent_granted,
        privacy_audit_redacted: request
            .privacy_audit_record
            .as_ref()
            .map(|record| record.consent_status.clone()),
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandRequest {
    input_path: String,
    output_path: Option<String>,
    page_range: Option<String>,
    options: ScanPreprocessCommandOptions,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandOptions {
    enhance_scans: bool,
    detect_orientation: bool,
    deskew: bool,
    split_pages: bool,
    crop_pages: bool,
    trim_blank_edges: bool,
    output_mode: String,
    dpi: u16,
    jpeg_quality: u8,
    skew_threshold_degrees: f32,
    rotation_confidence: f32,
    max_deskew_degrees: f32,
    blank_edge_margin_px: u16,
    blank_edge_threshold: u8,
    parallel_jobs: u8,
    chunk_pages: u16,
    preserve_original_page_size: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandJob {
    id: String,
    input_path: String,
    output_path: String,
    page_range: Option<String>,
    status: String,
    options: ScanPreprocessCommandOptions,
    progress: ScanPreprocessCommandProgress,
    summary: ScanPreprocessCommandSummary,
    error_message: Option<String>,
    created_at: String,
    updated_at: String,
    started_at: Option<String>,
    completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandProgress {
    stage: String,
    completed_pages: u32,
    total_pages: u32,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandSummary {
    total_pages: u32,
    processed_pages: u32,
    rotated_pages: u32,
    deskewed_pages: u32,
    split_pages: u32,
    cropped_pages: u32,
    blank_edges_cleared_pages: u32,
    elapsed_ms: u64,
    output_path: String,
    preprocess_only: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandRequest {
    input_path: String,
    output_path: Option<String>,
    page_range: Option<String>,
    provider: OcrCommandProvider,
    output_strategy: String,
    network_consent_granted: bool,
    privacy_audit_record: Option<OcrCommandPrivacyAuditRecord>,
    quality_check: Option<OcrCommandQualityCheckRequest>,
}

impl OcrCommandRequest {
    fn from_stored(stored: &OcrStoredJob) -> Self {
        Self {
            input_path: stored.input_path.clone(),
            output_path: Some(stored.output_path.clone()),
            page_range: stored.page_range.clone(),
            provider: OcrCommandProvider {
                id: stored.provider_id.clone(),
                provider_type: stored.backend.clone(),
                display_name: None,
                endpoint: None,
                api_key_ref: None,
                enabled: true,
                requires_network_consent: matches!(
                    stored.backend.as_str(),
                    "paddleocr" | "mineru"
                ),
            },
            output_strategy: stored.output_strategy.clone(),
            network_consent_granted: stored.privacy_audit_redacted_is_granted(),
            privacy_audit_record: None,
            quality_check: Some(OcrCommandQualityCheckRequest {
                enabled: stored.quality_check.enabled,
                sample_pages: stored.quality_check.sample_pages.clone(),
                keywords: stored.quality_check.keywords.clone(),
            }),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandProvider {
    id: String,
    #[serde(rename = "type")]
    provider_type: String,
    display_name: Option<String>,
    endpoint: Option<String>,
    api_key_ref: Option<String>,
    enabled: bool,
    requires_network_consent: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandQualityCheckRequest {
    enabled: bool,
    sample_pages: Vec<u32>,
    keywords: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandPrivacyAuditRecord {
    provider_id: String,
    backend: String,
    output_strategy: String,
    is_network_required: bool,
    consent_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandJob {
    id: String,
    input_path: String,
    output_path: String,
    page_range: Option<String>,
    backend: String,
    provider_id: String,
    status: String,
    output_strategy: String,
    progress: OcrCommandProgress,
    quality_check: OcrCommandQualityCheckRequest,
    quality: Option<OcrStoredQualitySummary>,
    error_message: Option<String>,
    created_at: String,
    updated_at: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    #[serde(default)]
    input_path_summary: ocr_queue::RedactedPathSummary,
    #[serde(default)]
    output_path_summary: ocr_queue::RedactedPathSummary,
    network_consent_granted: bool,
    privacy_audit_redacted: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrCommandProgress {
    stage: String,
    completed_pages: u32,
    total_pages: u32,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrTextExtractionPage {
    page_index: u32,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrTextExtractionResponse {
    pages: Vec<OcrTextExtractionPage>,
    total_pages: u32,
    searchable_pages: u32,
}

impl OcrStoredJob {
    fn privacy_audit_redacted_is_granted(&self) -> bool {
        matches!(self.status.as_str(), "running" | "completed")
    }
}

fn validate_scan_preprocess_request(request: &ScanPreprocessCommandRequest) -> Result<(), String> {
    let input_path = request.input_path.trim();
    if input_path.is_empty() {
        return Err("输入 PDF 路径不能为空。".to_string());
    }
    if !is_pdf_path(Path::new(input_path)) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    if let Some(page_range) = request.page_range.as_ref() {
        if !is_valid_page_range(page_range) {
            return Err("页码范围必须使用正整数或正整数区间，例如 1,3-5。".to_string());
        }
    }

    let options = &request.options;
    if options.output_mode != "preprocess-only" {
        return Err("扫描预处理第一版只支持 preprocess-only 输出。".to_string());
    }
    if !has_enabled_scan_operation(options) {
        return Err("至少需要启用一个扫描预处理动作。".to_string());
    }
    if options.dpi < 72 || options.dpi > 600 {
        return Err("DPI 必须在 72 到 600 之间。".to_string());
    }
    if options.jpeg_quality == 0 || options.jpeg_quality > 100 {
        return Err("JPEG 质量必须在 1 到 100 之间。".to_string());
    }
    if !(0.0..=1.0).contains(&options.rotation_confidence) {
        return Err("旋转置信度必须在 0 到 1 之间。".to_string());
    }
    if options.skew_threshold_degrees < 0.1 || options.skew_threshold_degrees > 5.0 {
        return Err("倾斜阈值必须在 0.1 到 5 度之间。".to_string());
    }
    if options.max_deskew_degrees < 0.3 || options.max_deskew_degrees > 15.0 {
        return Err("最大微倾斜角必须在 0.3 到 15 度之间。".to_string());
    }
    if options.parallel_jobs > 64 {
        return Err("并行处理数必须为 0 到 64；0 表示自动。".to_string());
    }
    if options.chunk_pages > 500 {
        return Err("分块页数必须为 0 到 500；0 表示不分块。".to_string());
    }
    if options.blank_edge_margin_px > 200 {
        return Err("清边保留边距必须在 0 到 200 像素之间。".to_string());
    }
    if options.blank_edge_threshold == 0 {
        return Err("空白边阈值必须在 1 到 255 之间。".to_string());
    }

    Ok(())
}

fn validate_ocr_request(request: &OcrCommandRequest) -> Result<(), String> {
    let input_path = request.input_path.trim();
    if input_path.is_empty() {
        return Err("输入 PDF 路径不能为空。".to_string());
    }
    if !is_pdf_path(Path::new(input_path)) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    if request.provider.id.trim().is_empty() {
        return Err("OCR Provider 不能为空。".to_string());
    }
    if !is_supported_ocr_provider(&request.provider.provider_type) {
        return Err("OCR Provider 类型无效。".to_string());
    }
    if !request.provider.enabled {
        return Err(format!(
            "{} 未启用。",
            ocr_provider_display_name(&request.provider)
        ));
    }

    if request.output_strategy != "new-layered-pdf" {
        return Err("OCR bridge 第一版只支持 new-layered-pdf 输出策略。".to_string());
    }

    if let Some(page_range) = request.page_range.as_ref() {
        if !is_valid_page_range(page_range) {
            return Err("页码范围必须使用正整数或正整数区间，例如 1,3-5。".to_string());
        }
    }

    if is_cloud_ocr_provider(&request.provider) {
        if !request.network_consent_granted || !has_current_ocr_privacy_audit(request) {
            return Err("联网 OCR 需要本次隐私确认。".to_string());
        }
        if request
            .provider
            .api_key_ref
            .as_ref()
            .map(|value| value.trim().is_empty())
            .unwrap_or(true)
        {
            return Err(format!(
                "{} 需要配置 apiKeyRef。",
                ocr_provider_display_name(&request.provider)
            ));
        }
        if request
            .provider
            .api_key_ref
            .as_ref()
            .map(|value| !is_safe_api_key_ref(value))
            .unwrap_or(false)
        {
            return Err(format!(
                "{} 的 apiKeyRef 必须使用凭证引用或脱敏占位。",
                ocr_provider_display_name(&request.provider)
            ));
        }
        if !is_allowed_ocr_endpoint(request.provider.endpoint.as_deref()) {
            return Err(format!(
                "{} 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。",
                ocr_provider_display_name(&request.provider)
            ));
        }
    }

    let input_path = PathBuf::from(input_path);
    let output_path = request
        .output_path
        .as_ref()
        .map(|path| PathBuf::from(path.trim()));
    resolve_ocr_output_path(input_path, output_path)?;

    if let Some(quality_check) = request.quality_check.as_ref() {
        if quality_check.sample_pages.iter().any(|page| *page == 0) {
            return Err("OCR 质量抽查页码必须是正整数。".to_string());
        }
    }

    Ok(())
}

fn has_current_ocr_privacy_audit(request: &OcrCommandRequest) -> bool {
    let Some(audit) = request.privacy_audit_record.as_ref() else {
        return false;
    };

    audit.consent_status == "granted"
        && audit.is_network_required
        && audit.provider_id == request.provider.id
        && audit.backend == request.provider.provider_type
        && audit.output_strategy == request.output_strategy
}

fn resolve_scan_preprocess_output_path(
    input_path: PathBuf,
    output_path: Option<PathBuf>,
) -> Result<PathBuf, String> {
    if !is_pdf_path(&input_path) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    let resolved_output =
        output_path.unwrap_or_else(|| suggest_scan_preprocess_output_path(&input_path));
    if !is_pdf_path(&resolved_output) {
        return Err("输出文件必须是 PDF。".to_string());
    }
    if paths_are_same(&input_path, &resolved_output) {
        return Err("输出 PDF 必须是不同于原始 PDF 的新文件。".to_string());
    }

    Ok(resolved_output)
}

fn resolve_ocr_output_path(
    input_path: PathBuf,
    output_path: Option<PathBuf>,
) -> Result<PathBuf, String> {
    if !is_pdf_path(&input_path) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    let resolved_output = output_path.unwrap_or_else(|| suggest_ocr_output_path(&input_path));
    if !is_pdf_path(&resolved_output) {
        return Err("输出文件必须是 PDF。".to_string());
    }
    if paths_are_same(&input_path, &resolved_output) {
        return Err("输出 PDF 必须是不同于原始 PDF 的新文件。".to_string());
    }

    Ok(resolved_output)
}

fn suggest_scan_preprocess_output_path(input_path: &Path) -> PathBuf {
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("document");
    let output_name = format!("{stem}-preprocessed.pdf");

    input_path
        .parent()
        .map(|parent| parent.join(&output_name))
        .unwrap_or_else(|| PathBuf::from(output_name))
}

fn suggest_ocr_output_path(input_path: &Path) -> PathBuf {
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("document");
    let output_name = format!("{stem}-ocr.pdf");

    input_path
        .parent()
        .map(|parent| parent.join(&output_name))
        .unwrap_or_else(|| PathBuf::from(output_name))
}

fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

fn paths_are_same(left: &Path, right: &Path) -> bool {
    normalize_path_for_compare(left) == normalize_path_for_compare(right)
}

fn normalize_path_for_compare(path: &Path) -> String {
    let normalized_separators = path.to_string_lossy().trim().replace('\\', "/");
    let (drive_prefix, path_body) = normalized_separators
        .as_bytes()
        .get(1)
        .filter(|byte| **byte == b':')
        .map(|_| (&normalized_separators[..2], &normalized_separators[2..]))
        .unwrap_or(("", normalized_separators.as_str()));
    let is_absolute = path_body.starts_with('/');
    let mut parts: Vec<&str> = Vec::new();

    for part in path_body.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            if parts.last().is_some_and(|last_part| *last_part != "..") {
                parts.pop();
            } else if !is_absolute {
                parts.push(part);
            }
            continue;
        }

        parts.push(part);
    }

    let absolute_separator = if is_absolute { "/" } else { "" };
    format!(
        "{}{}{}",
        drive_prefix.to_ascii_lowercase(),
        absolute_separator,
        parts.join("/")
    )
    .trim_end_matches('/')
    .to_ascii_lowercase()
}

fn has_enabled_scan_operation(options: &ScanPreprocessCommandOptions) -> bool {
    options.enhance_scans
        || options.detect_orientation
        || options.deskew
        || options.split_pages
        || options.crop_pages
        || options.trim_blank_edges
}

fn is_supported_ocr_provider(provider_type: &str) -> bool {
    matches!(
        provider_type,
        "local-ocrmypdf" | "legal-skills" | "paddleocr" | "mineru"
    )
}

fn is_cloud_ocr_provider(provider: &OcrCommandProvider) -> bool {
    matches!(provider.provider_type.as_str(), "paddleocr" | "mineru")
        || provider.requires_network_consent
}

fn ocr_provider_display_name(provider: &OcrCommandProvider) -> String {
    provider
        .display_name
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(provider.id.as_str())
        .to_string()
}

fn is_allowed_ocr_endpoint(endpoint: Option<&str>) -> bool {
    let Some(endpoint) = endpoint.map(str::trim).filter(|value| !value.is_empty()) else {
        return false;
    };

    let Ok(parsed) = Url::parse(endpoint) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };

    parsed.scheme() == "https" || (parsed.scheme() == "http" && is_loopback_host(host))
}

fn is_safe_api_key_ref(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.is_empty() || is_credential_reference(trimmed) || is_masked_secret(trimmed)
}

fn is_loopback_host(host: &str) -> bool {
    let normalized = host.trim_matches(['[', ']']).to_ascii_lowercase();
    if normalized == "localhost" {
        return true;
    }

    normalized
        .parse::<IpAddr>()
        .map(|address| address.is_loopback())
        .unwrap_or(false)
}

fn default_ocr_quality_check() -> OcrCommandQualityCheckRequest {
    OcrCommandQualityCheckRequest {
        enabled: false,
        sample_pages: Vec::new(),
        keywords: Vec::new(),
    }
}

fn is_valid_page_range(raw: &str) -> bool {
    let parts = raw
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return false;
    }

    parts.into_iter().all(|part| {
        let range = part.split('-').collect::<Vec<_>>();
        if range.is_empty() || range.len() > 2 {
            return false;
        }

        let Ok(start) = range[0].parse::<u32>() else {
            return false;
        };
        let end = if range.len() == 2 {
            let Ok(end) = range[1].parse::<u32>() else {
                return false;
            };
            end
        } else {
            start
        };

        start > 0 && end >= start
    })
}

fn current_timestamp_string() -> String {
    current_unix_millis().to_string()
}

fn current_unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[allow(dead_code)]
fn empty_redacted_path_summary() -> ocr_queue::RedactedPathSummary {
    empty_path_summary()
}

#[cfg(test)]
mod ocr_bridge_tests {
    use super::*;
    use std::path::PathBuf;

    fn local_provider() -> OcrCommandProvider {
        OcrCommandProvider {
            id: "local-ocrmypdf".to_string(),
            provider_type: "local-ocrmypdf".to_string(),
            display_name: Some("本地 OCRmyPDF".to_string()),
            endpoint: None,
            api_key_ref: None,
            enabled: true,
            requires_network_consent: false,
        }
    }

    fn paddle_provider() -> OcrCommandProvider {
        OcrCommandProvider {
            id: "paddleocr".to_string(),
            provider_type: "paddleocr".to_string(),
            display_name: Some("PaddleOCR".to_string()),
            endpoint: Some("https://ocr.example.test/paddle".to_string()),
            api_key_ref: Some("env:OCR_PADDLE_TOKEN".to_string()),
            enabled: true,
            requires_network_consent: true,
        }
    }

    fn mineru_provider() -> OcrCommandProvider {
        OcrCommandProvider {
            id: "mineru".to_string(),
            provider_type: "mineru".to_string(),
            display_name: Some("MinerU".to_string()),
            endpoint: Some("https://ocr.example.test/mineru".to_string()),
            api_key_ref: Some("env:OCR_MINERU_TOKEN".to_string()),
            enabled: true,
            requires_network_consent: true,
        }
    }

    fn default_ocr_request() -> OcrCommandRequest {
        OcrCommandRequest {
            input_path: "/tmp/faropdf-fixtures/source.pdf".to_string(),
            output_path: None,
            page_range: Some("1,3-5".to_string()),
            provider: local_provider(),
            output_strategy: "new-layered-pdf".to_string(),
            network_consent_granted: false,
            privacy_audit_record: None,
            quality_check: Some(OcrCommandQualityCheckRequest {
                enabled: true,
                sample_pages: vec![1, 3],
                keywords: vec!["合同".to_string()],
            }),
        }
    }

    fn granted_ocr_privacy_audit(provider_id: &str, backend: &str) -> OcrCommandPrivacyAuditRecord {
        OcrCommandPrivacyAuditRecord {
            provider_id: provider_id.to_string(),
            backend: backend.to_string(),
            output_strategy: "new-layered-pdf".to_string(),
            is_network_required: true,
            consent_status: "granted".to_string(),
        }
    }

    #[test]
    fn resolves_default_ocr_output_path_without_overwriting_input_pdf() {
        let output =
            resolve_ocr_output_path(PathBuf::from("/tmp/faropdf-fixtures/source.pdf"), None)
                .expect("output path");

        assert_eq!(
            output,
            PathBuf::from("/tmp/faropdf-fixtures/source-ocr.pdf")
        );
    }

    #[test]
    fn rejects_same_ocr_output_path_without_leaking_the_full_path() {
        let error = resolve_ocr_output_path(
            PathBuf::from("/tmp/faropdf-fixtures/./source.pdf"),
            Some(PathBuf::from("/tmp/faropdf-fixtures/nested/../source.pdf")),
        )
        .expect_err("same output path should fail");

        assert!(error.contains("输出 PDF 必须是不同于原始 PDF 的新文件。"));
        assert!(!error.contains("/tmp/faropdf-fixtures/source.pdf"));
    }

    #[test]
    fn rejects_cloud_ocr_without_consent_or_api_key_ref() {
        let mut missing_consent = default_ocr_request();
        missing_consent.provider = paddle_provider();
        missing_consent.network_consent_granted = false;

        let consent_error =
            validate_ocr_request(&missing_consent).expect_err("cloud OCR needs consent");
        assert_eq!(consent_error, "联网 OCR 需要本次隐私确认。");

        let mut missing_key = missing_consent;
        missing_key.network_consent_granted = true;
        missing_key.privacy_audit_record = Some(granted_ocr_privacy_audit("paddleocr", "paddleocr"));
        missing_key.provider.api_key_ref = Some(String::new());

        let key_error = validate_ocr_request(&missing_key).expect_err("cloud OCR needs key ref");
        assert_eq!(key_error, "PaddleOCR 需要配置 apiKeyRef。");
    }

    #[test]
    fn rejects_cloud_ocr_with_legacy_consent_flag_but_no_privacy_audit() {
        let mut request = default_ocr_request();
        request.provider = paddle_provider();
        request.network_consent_granted = true;

        let error = validate_ocr_request(&request).expect_err("cloud OCR needs current audit");

        assert_eq!(error, "联网 OCR 需要本次隐私确认。");
    }

    #[test]
    fn rejects_raw_cloud_api_key_refs() {
        let mut request = default_ocr_request();
        request.provider = paddle_provider();
        request.network_consent_granted = true;
        request.privacy_audit_record = Some(granted_ocr_privacy_audit("paddleocr", "paddleocr"));
        request.provider.api_key_ref = Some("paddle-secret-123456".to_string());

        let error = validate_ocr_request(&request).expect_err("raw key should fail");

        assert_eq!(error, "PaddleOCR 的 apiKeyRef 必须使用凭证引用或脱敏占位。");
    }

    #[test]
    fn rejects_remote_http_ocr_endpoints_but_allows_loopback_http() {
        let mut request = default_ocr_request();
        request.provider = paddle_provider();
        request.network_consent_granted = true;
        request.privacy_audit_record = Some(granted_ocr_privacy_audit("paddleocr", "paddleocr"));
        request.provider.endpoint = Some("http://ocr.example.test/paddle".to_string());

        let error = validate_ocr_request(&request).expect_err("remote http should fail");

        assert_eq!(
            error,
            "PaddleOCR 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。"
        );

        request.provider.endpoint = Some("http://127.0.0.1:8080/paddle".to_string());

        validate_ocr_request(&request).expect("loopback http is allowed for debug");
    }

    #[test]
    fn rejects_mineru_spoofed_127_http_endpoint() {
        let mut request = default_ocr_request();
        request.provider = mineru_provider();
        request.network_consent_granted = true;
        request.privacy_audit_record = Some(granted_ocr_privacy_audit("mineru", "mineru"));
        request.provider.endpoint = Some("http://127.evil.example/mineru".to_string());

        let error =
            validate_ocr_request(&request).expect_err("spoofed 127 hostname should fail");

        assert_eq!(
            error,
            "MinerU 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。"
        );
    }

    #[test]
    fn rejects_invalid_ocr_quality_sample_pages() {
        let mut request = default_ocr_request();
        request.quality_check = Some(OcrCommandQualityCheckRequest {
            enabled: true,
            sample_pages: vec![0, 2],
            keywords: Vec::new(),
        });

        let error = validate_ocr_request(&request).expect_err("zero sample page should fail");

        assert_eq!(error, "OCR 质量抽查页码必须是正整数。");
    }

    #[test]
    fn rejects_invalid_ocr_page_range() {
        let mut request = default_ocr_request();
        request.page_range = Some("5-2".to_string());

        let error = validate_ocr_request(&request).expect_err("invalid page range should fail");

        assert_eq!(error, "页码范围必须使用正整数或正整数区间，例如 1,3-5。");
    }

    #[test]
    fn redact_path_summary_keeps_fingerprint_but_hides_value() {
        let summary = redact_path("/tmp/secret.pdf");
        assert_eq!(summary.kind, "local-pdf");
        assert_eq!(summary.redacted, "[path].pdf");
        assert!(!summary.fingerprint.is_empty());
    }

    #[test]
    fn stored_to_command_job_preserves_status_and_progress() {
        let stored = OcrStoredJob {
            id: "ocr-1".to_string(),
            input_path: "/tmp/source.pdf".to_string(),
            input_path_summary: redact_path("/tmp/source.pdf"),
            output_path: "/tmp/source-ocr.pdf".to_string(),
            output_path_summary: redact_path("/tmp/source-ocr.pdf"),
            page_range: None,
            backend: "local-ocrmypdf".to_string(),
            provider_id: "local-ocrmypdf".to_string(),
            status: "running".to_string(),
            output_strategy: "new-layered-pdf".to_string(),
            progress: OcrStoredProgress {
                stage: "running-provider".to_string(),
                completed_pages: 0,
                total_pages: 0,
                message: Some("执行中".to_string()),
            },
            quality_check: OcrStoredQualityCheck {
                enabled: false,
                sample_pages: Vec::new(),
                keywords: Vec::new(),
            },
            quality: None,
            error_message: None,
            created_at: "1000".to_string(),
            updated_at: "1000".to_string(),
            started_at: Some("1000".to_string()),
            completed_at: None,
        };
        let request = default_ocr_request();
        let job = stored_to_command_job(&stored, &request);
        assert_eq!(job.id, "ocr-1");
        assert_eq!(job.status, "running");
        assert_eq!(job.progress.stage, "running-provider");
        assert_eq!(job.started_at, Some("1000".to_string()));
        assert!(job.completed_at.is_none());
    }
}

#[cfg(test)]
mod set_pdf_producer_tests {
    use super::*;
    use lopdf::Document as LopdfDocument;
    use std::path::PathBuf;

    fn temp_pdf_with_producer(producer: Option<&str>) -> PathBuf {
        temp_pdf_with_producer_labeled(producer, "test")
    }

    fn temp_pdf_with_producer_labeled(producer: Option<&str>, label: &str) -> PathBuf {
        use lopdf::{dictionary, Object};
        let mut path = std::env::temp_dir();
        path.push(format!(
            "faropdf-producer-{label}-{}.pdf",
            ocr_queue::current_iso_timestamp()
        ));
        let mut doc = LopdfDocument::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(595), Object::Integer(842)],
        });
        let pages = dictionary! {
            "Type" => "Pages",
            "Kids" => vec![Object::Reference(page_id)],
            "Count" => 1,
            "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(595), Object::Integer(842)],
        };
        doc.objects.insert(pages_id, Object::Dictionary(pages));
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        if let Some(p) = producer {
            let info_id = doc.add_object(dictionary! {
                "Producer" => Object::string_literal(p),
            });
            doc.trailer.set("Info", info_id);
        }
        doc.compress();
        // 强制用经典 CrossReferenceTable（lopdf 0.33 默认 CrossReferenceStream 在 save→load 往返时
        // 触发 "Invalid cross-reference table"；table 格式往返兼容）
        doc.reference_table.cross_reference_type = lopdf::xref::XrefType::CrossReferenceTable;
        doc.save(&path).unwrap();
        path
    }

    fn read_producer(path: &Path) -> Option<String> {
        let doc = LopdfDocument::load(path).unwrap();
        let info_ref = doc.trailer.get(b"Info").ok()?;
        if let lopdf::Object::Reference(r) = info_ref {
            let info_obj = doc.objects.get(r)?;
            if let lopdf::Object::Dictionary(dict) = info_obj {
                if let Ok(producer_obj) = dict.get(b"Producer") {
                    if let lopdf::Object::String(bytes, _) = producer_obj {
                        return Some(String::from_utf8_lossy(bytes).to_string());
                    }
                }
            }
        }
        None
    }

    #[test]
    fn set_pdf_producer_overwrites_existing() {
        let src = temp_pdf_with_producer_labeled(Some("original-producer"), "overwrite");
        let request = serde_json::json!({
            "input_path": src.to_string_lossy(),
            "producer": "FaroPDF",
        });
        let result = set_pdf_producer(request).unwrap();
        let out_path = result.get("path").unwrap().as_str().unwrap();
        let producer = read_producer(std::path::Path::new(out_path));
        assert_eq!(producer.as_deref(), Some("FaroPDF"));
        let _ = std::fs::remove_file(&src);
        let _ = std::fs::remove_file(out_path);
    }

    #[test]
    fn set_pdf_producer_creates_info_if_missing() {
        let src = temp_pdf_with_producer_labeled(None, "missing");
        let request = serde_json::json!({
            "input_path": src.to_string_lossy(),
            "producer": "FaroPDF",
        });
        let result = set_pdf_producer(request).unwrap();
        let out_path = result.get("path").unwrap().as_str().unwrap();
        let producer = read_producer(std::path::Path::new(out_path));
        assert_eq!(producer.as_deref(), Some("FaroPDF"));
        let _ = std::fs::remove_file(&src);
        let _ = std::fs::remove_file(out_path);
    }

    #[test]
    fn set_pdf_producer_rejects_empty() {
        let src = temp_pdf_with_producer(Some("x"));
        let request = serde_json::json!({
            "input_path": src.to_string_lossy(),
            "producer": "   ",
        });
        let result = set_pdf_producer(request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Producer 不能为空"));
        let _ = std::fs::remove_file(&src);
    }

    #[test]
    fn set_pdf_producer_rejects_missing_file() {
        let request = serde_json::json!({
            "input_path": "/nonexistent/path/file.pdf",
            "producer": "FaroPDF",
        });
        let result = set_pdf_producer(request);
        assert!(result.is_err());
    }

    #[test]
    fn set_pdf_producer_default_faropdf() {
        let src = temp_pdf_with_producer_labeled(Some("old"), "default");
        let request = serde_json::json!({
            "input_path": src.to_string_lossy(),
        });
        let result = set_pdf_producer(request).unwrap();
        let out_path = result.get("path").unwrap().as_str().unwrap();
        let producer = read_producer(std::path::Path::new(out_path));
        assert_eq!(producer.as_deref(), Some("FaroPDF"));
        let _ = std::fs::remove_file(&src);
        let _ = std::fs::remove_file(out_path);
    }
}


#[cfg(test)]
mod scan_preprocess_tests {
    use super::*;
    use crate::scan_preprocess::{
        RedactedPathSummary, ScanPreprocessStoredJob, ScanPreprocessStoredProgress,
        ScanPreprocessStoredSummary, stored_options_default,
    };
    use std::path::PathBuf;

    fn default_scan_options() -> ScanPreprocessCommandOptions {
        ScanPreprocessCommandOptions {
            enhance_scans: true,
            detect_orientation: true,
            deskew: true,
            split_pages: false,
            crop_pages: false,
            trim_blank_edges: false,
            output_mode: "preprocess-only".to_string(),
            dpi: 300,
            jpeg_quality: 90,
            skew_threshold_degrees: 0.3,
            rotation_confidence: 0.5,
            max_deskew_degrees: 5.0,
            blank_edge_margin_px: 10,
            blank_edge_threshold: 254,
            parallel_jobs: 1,
            chunk_pages: 0,
            preserve_original_page_size: true,
        }
    }

    #[test]
    fn resolves_default_output_path_without_overwriting_input_pdf() {
        let output = resolve_scan_preprocess_output_path(
            PathBuf::from("/tmp/faropdf-fixtures/source.pdf"),
            None,
        )
        .expect("output path");

        assert_eq!(
            output,
            PathBuf::from("/tmp/faropdf-fixtures/source-preprocessed.pdf")
        );
    }

    #[test]
    fn rejects_same_output_path_without_leaking_the_full_path() {
        let error = resolve_scan_preprocess_output_path(
            PathBuf::from("/tmp/faropdf-fixtures/./source.pdf"),
            Some(PathBuf::from("/tmp/faropdf-fixtures/nested/../source.pdf")),
        )
        .expect_err("same output path should fail");

        assert!(error.contains("输出 PDF 必须是不同于原始 PDF 的新文件。"));
        assert!(!error.contains("/tmp/faropdf-fixtures/source.pdf"));
    }

    #[test]
    fn rejects_invalid_blank_edge_threshold() {
        let mut request = ScanPreprocessCommandRequest {
            input_path: "/tmp/faropdf-fixtures/source.pdf".to_string(),
            output_path: None,
            page_range: None,
            options: default_scan_options(),
        };
        request.options.blank_edge_threshold = 0;

        let error = validate_scan_preprocess_request(&request)
            .expect_err("zero blank edge threshold should fail");

        assert_eq!(error, "空白边阈值必须在 1 到 255 之间。");
    }

    #[test]
    fn scan_stored_to_command_job_converts_real_processed_state() {
        let stored = ScanPreprocessStoredJob {
            id: "scan-1".to_string(),
            input_path: "/tmp/source.pdf".to_string(),
            input_path_summary: RedactedPathSummary {
                kind: "local-pdf".to_string(),
                fingerprint: "deadbeef".to_string(),
                redacted: "[path].pdf".to_string(),
            },
            output_path: "/tmp/source-preprocessed.pdf".to_string(),
            output_path_summary: RedactedPathSummary {
                kind: "local-pdf".to_string(),
                fingerprint: "cafef00d".to_string(),
                redacted: "[path].pdf".to_string(),
            },
            page_range: Some("1,3-5".to_string()),
            options: stored_options_default(),
            status: "completed".to_string(),
            progress: ScanPreprocessStoredProgress {
                stage: "completed".to_string(),
                completed_pages: 2,
                total_pages: 2,
                message: Some("处理完成".to_string()),
            },
            summary: Some(ScanPreprocessStoredSummary {
                total_pages: 2,
                processed_pages: 2,
                rotated_pages: 0,
                deskewed_pages: 0,
                split_pages: 0,
                cropped_pages: 1,
                blank_edges_cleared_pages: 1,
                elapsed_ms: 1234,
                output_path: "/tmp/source-preprocessed.pdf".to_string(),
                preprocess_only: true,
            }),
            error_message: None,
            created_at: "1000".to_string(),
            updated_at: "1234".to_string(),
            started_at: Some("1001".to_string()),
            completed_at: Some("1234".to_string()),
        };

        let command_job = scan_stored_to_command_job(&stored);
        assert_eq!(command_job.id, "scan-1");
        assert_eq!(command_job.status, "completed");
        assert_eq!(command_job.progress.completed_pages, 2);
        assert_eq!(command_job.progress.total_pages, 2);
        assert_eq!(command_job.summary.blank_edges_cleared_pages, 1);
        assert_eq!(command_job.started_at, Some("1001".to_string()));
        assert_eq!(command_job.completed_at, Some("1234".to_string()));
    }
}

#[cfg(test)]
mod ocr_e2e_tests {
    //! ISS-007 端到端联调（DEC-044）— Rust 侧集成测试。
    //!
    //! 把 `OcrJobQueue`（持久化）+ `dispatch_ocr`（真实子进程）+ `extract_pdf_text`（pdftotext）
    //! 串成一条真实链路，覆盖：
    //!   - 用 lopdf 生成 1 页 A4 fixture（无文字层，模拟扫描件）
    //!   - 调用 `dispatch_ocr` + `OcrDispatchBackend::LocalOcrMyPdf` 真实跑 ocrmypdf
    //!   - `OcrJobQueue.upsert` 持久化 running / reload 状态
    //!   - `extract_pdf_text` 抽取文字层并按页索引返回
    //!   - `summarize_extracted_pages` 生成 searchable_pages 摘要
    //!
    //! 跳过条件：本机缺 `ocrmypdf` 或 `pdftotext` 时整体跳过并打印 warning。
    use super::*;
    use lopdf::dictionary;
    use lopdf::{Document as LopdfDocument, Object};
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    fn tools_available() -> bool {
        let ocrmypdf_ok = Command::new("ocrmypdf")
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        let pdftotext_ok = Command::new("pdftotext")
            .arg("-v")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
        if !ocrmypdf_ok || !pdftotext_ok {
            eprintln!(
                "[ocr_e2e_tests] skipping: ocrmypdf_ok={ocrmypdf_ok} pdftotext_ok={pdftotext_ok}"
            );
        }
        ocrmypdf_ok && pdftotext_ok
    }

    fn temp_dir(label: &str) -> PathBuf {
        let mut path = env::temp_dir();
        let unique = format!(
            "faropdf-ocr-e2e-{label}-{}",
            ocr_queue::current_iso_timestamp()
        );
        path.push(unique);
        path
    }

    /// 复用前端 vitest 同一份 fixture（`tests/fixtures/ocr/generate-scan-fixture.mjs`
    /// 产物），保证 Rust 与前端 e2e 用完全相同的扫描件基准。
    /// 该 fixture 由 Node + pdf-lib 生成，包含预渲染 PNG，无 PDF 文字层。
    /// 路径解析以 src-tauri/Cargo.toml 为基准，回溯到项目根。
    fn resolve_javascript_fixture() -> Option<PathBuf> {
        // `cargo test` 的工作目录是 `src-tauri/`（即 Cargo.toml 所在目录），
        // 所以回溯两级到项目根。`cargo test --manifest-path ...` 也保持同样
        // 语义。
        let mut project_root = env::current_dir().ok()?;
        if project_root.ends_with("src-tauri") {
            project_root.pop();
        }
        let candidate = project_root.join("tests/fixtures/ocr/scan-only-sample.pdf");
        if candidate.exists() {
            Some(candidate)
        } else {
            None
        }
    }

    fn unique_job_id() -> String {
        format!("ocr-e2e-{}", ocr_queue::current_iso_timestamp())
    }

    fn running_stored_job(id: &str, input_path: &str, output_path: &str) -> OcrStoredJob {
        OcrStoredJob {
            id: id.to_string(),
            input_path: input_path.to_string(),
            input_path_summary: redact_path(input_path),
            output_path: output_path.to_string(),
            output_path_summary: redact_path(output_path),
            page_range: None,
            backend: "local-ocrmypdf".to_string(),
            provider_id: "local-ocrmypdf".to_string(),
            status: "running".to_string(),
            output_strategy: "new-layered-pdf".to_string(),
            progress: OcrStoredProgress {
                stage: "running-provider".to_string(),
                completed_pages: 0,
                total_pages: 0,
                message: Some("running".to_string()),
            },
            quality_check: OcrStoredQualityCheck {
                enabled: true,
                sample_pages: vec![1],
                keywords: vec!["OCR".to_string()],
            },
            quality: None,
            error_message: None,
            created_at: ocr_queue::current_iso_timestamp(),
            updated_at: ocr_queue::current_iso_timestamp(),
            started_at: Some(ocr_queue::current_iso_timestamp()),
            completed_at: None,
        }
    }

    #[test]
    fn full_ocr_pipeline_runs_ocrmypdf_then_extracts_text_via_pdftotext() {
        if !tools_available() {
            return;
        }
        let Some(fixture_source) = resolve_javascript_fixture() else {
            eprintln!(
                "[ocr_e2e_tests] skipping: tests/fixtures/ocr/scan-only-sample.pdf 不存在；先跑 `node tests/fixtures/ocr/generate-scan-fixture.mjs`"
            );
            return;
        };

        let dir = temp_dir("pipeline");
        std::fs::create_dir_all(&dir).expect("mkdir temp");
        // 把前端 fixture 复制到 temp 目录，避免修改源文件
        let input = dir.join("scan-only.pdf");
        let output = dir.join("scan-only-ocr.pdf");
        let queue_path = dir.join("ocr-jobs.json");
        std::fs::copy(&fixture_source, &input).expect("copy fixture");

        // 1) dispatch_ocr 真实跑 ocrmypdf
        let dispatch_request = OcrDispatchRequest {
            backend: OcrDispatchBackend::LocalOcrMyPdf,
            input_path: input.to_string_lossy().to_string(),
            output_path: output.to_string_lossy().to_string(),
            page_range: None,
            endpoint: None,
            api_key: None,
        };
        let result = dispatch_ocr(&dispatch_request).expect("dispatch_ocr should succeed");
        assert!(output.exists(), "ocrmypdf output should exist");
        assert!(
            result.output_size_bytes > 0,
            "output size must be > 0 (got {})",
            result.output_size_bytes
        );

        // 2) extract_pdf_text 抽文字层
        let pages = extract_pdf_text(&output).expect("pdftotext should succeed");
        assert_eq!(pages.len(), 2, "2 page fixture should yield 2 extracted pages");
        let summary = summarize_extracted_pages(&pages);
        assert_eq!(summary.total_pages, 2);
        // fixture 含预渲染文字，OCR 后 2 页都应该有文字
        assert_eq!(summary.searchable_pages, 2);

        // 3) OcrJobQueue 持久化：upsert + reload 验证完整字段
        let queue = OcrJobQueue::new(queue_path.clone());
        let job_id = unique_job_id();
        let mut stored = running_stored_job(
            &job_id,
            &input.to_string_lossy(),
            &output.to_string_lossy(),
        );
        // OCR 实际已完成，先把状态写为 completed，避开 reconcile 把它改成 cancelled
        stored.status = "completed".to_string();
        stored.progress.stage = "completed".to_string();
        stored.progress.completed_pages = 2;
        stored.progress.total_pages = 2;
        stored.progress.message = Some("OCR 完成".to_string());
        stored.completed_at = Some(ocr_queue::current_iso_timestamp());
        queue.upsert(stored.clone()).expect("upsert completed");
        let restored = OcrJobQueue::new(queue_path);
        let loaded = restored.get(&job_id).expect("job should reload");
        assert_eq!(loaded.status, "completed");
        assert_eq!(loaded.backend, "local-ocrmypdf");
        assert_eq!(loaded.input_path_summary.kind, "local-pdf");
        assert!(!loaded.input_path_summary.fingerprint.is_empty());
        assert_eq!(loaded.progress.completed_pages, 2);
        assert_eq!(loaded.progress.total_pages, 2);
    }
}
