//! 持久化扫描预处理任务队列
//!
//! 与 `ocr_queue.rs` 同结构：把扫描预处理 job 状态写入应用配置目录下的
//! `scan-preprocess-jobs.json`。启动时把残留 `running` 标记为 `cancelled`，
//! 避免幽灵任务阻塞 UI。写入用 mutex 保护，路径脱敏后只保留 fingerprint。
//!
//! 第二阶段相对第一版的关键变化：
//! - 增加 `progress.total_pages`（在 validating 阶段填入），
//!   让 UI poll 时能算出真实百分比；
//! - `summary` 由 runner 写入，包含 rotated_pages / cropped_pages /
//!   blank_edges_cleared_pages / elapsed_ms；
//! - 提供 `update_progress` 增量更新，避免 upsert 整体替换。

use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::Mutex,
};

use serde::{Deserialize, Serialize};

use crate::scan_preprocess::types::{
    RedactedPathSummary, ScanPreprocessStoredJob, ScanPreprocessStoredOptions,
    ScanPreprocessStoredProgress, ScanPreprocessStoredSummary,
};

const SCAN_PREPROCESS_QUEUE_FILE: &str = "scan-preprocess-jobs.json";
const SCAN_PREPROCESS_QUEUE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanPreprocessQueueFile {
    pub schema_version: u32,
    pub jobs: Vec<ScanPreprocessStoredJob>,
}

impl ScanPreprocessQueueFile {
    pub fn empty() -> Self {
        Self {
            schema_version: SCAN_PREPROCESS_QUEUE_VERSION,
            jobs: Vec::new(),
        }
    }
}

#[derive(Debug)]
pub struct ScanPreprocessJobQueue {
    file_path: PathBuf,
    state: Mutex<ScanPreprocessQueueFile>,
}

#[derive(Debug, Clone)]
pub struct ScanPreprocessJobQueueState(pub std::sync::Arc<Mutex<ScanPreprocessJobQueue>>);

impl ScanPreprocessJobQueue {
    pub fn new(file_path: PathBuf) -> Self {
        let initial = load_or_default(&file_path);
        let queue = Self {
            file_path,
            state: Mutex::new(initial),
        };
        queue.reconcile_running_after_restart();
        queue
    }

    pub fn file_path(&self) -> &PathBuf {
        &self.file_path
    }

    pub fn list(&self) -> Vec<ScanPreprocessStoredJob> {
        let state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        state.jobs.clone()
    }

    pub fn get(&self, job_id: &str) -> Option<ScanPreprocessStoredJob> {
        let state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        state.jobs.iter().find(|job| job.id == job_id).cloned()
    }

    pub fn upsert(&self, job: ScanPreprocessStoredJob) -> Result<(), String> {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        if let Some(existing) = state.jobs.iter_mut().find(|existing| existing.id == job.id) {
            *existing = job;
        } else {
            state.jobs.push(job);
        }
        persist(&self.file_path, &state)
    }

    pub fn update_progress(
        &self,
        job_id: &str,
        progress: ScanPreprocessStoredProgress,
        status: Option<String>,
    ) -> Result<Option<ScanPreprocessStoredJob>, String> {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        let updated = state.jobs.iter_mut().find(|job| job.id == job_id).map(|job| {
            job.progress = progress;
            if let Some(next_status) = status {
                job.status = next_status;
            }
            job.updated_at = current_iso_timestamp();
            job.clone()
        });
        if updated.is_some() {
            persist(&self.file_path, &state)?;
        }
        Ok(updated)
    }

    pub fn complete(
        &self,
        job_id: &str,
        status: String,
        summary: ScanPreprocessStoredSummary,
    ) -> Result<Option<ScanPreprocessStoredJob>, String> {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        let updated = state.jobs.iter_mut().find(|job| job.id == job_id).map(|job| {
            job.status = status.clone();
            job.summary = Some(summary);
            job.error_message = None;
            job.completed_at = Some(current_iso_timestamp());
            job.updated_at = job.completed_at.clone().unwrap_or_default();
            job.clone()
        });
        if updated.is_some() {
            persist(&self.file_path, &state)?;
        }
        Ok(updated)
    }

    pub fn fail(
        &self,
        job_id: &str,
        error_message: String,
    ) -> Result<Option<ScanPreprocessStoredJob>, String> {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        let updated = state.jobs.iter_mut().find(|job| job.id == job_id).map(|job| {
            job.status = "failed".to_string();
            job.error_message = Some(error_message.clone());
            job.completed_at = Some(current_iso_timestamp());
            job.updated_at = job.completed_at.clone().unwrap_or_default();
            job.clone()
        });
        if updated.is_some() {
            persist(&self.file_path, &state)?;
        }
        Ok(updated)
    }

    pub fn cancel(&self, job_id: &str) -> Result<Option<ScanPreprocessStoredJob>, String> {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        let next = state.jobs.iter_mut().find(|job| job.id == job_id).map(|job| {
            if matches!(job.status.as_str(), "queued" | "running") {
                job.status = "cancelled".to_string();
                job.completed_at = Some(current_iso_timestamp());
                job.updated_at = job.completed_at.clone().unwrap_or_default();
                if let Some(message) = job.progress.message.as_mut() {
                    message.push_str("（已取消）");
                } else {
                    job.progress.message = Some("已取消".to_string());
                }
            }
            job.clone()
        });
        if next.is_some() {
            persist(&self.file_path, &state)?;
        }
        Ok(next)
    }

    pub fn reconcile_running_after_restart(&self) {
        let mut state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        let mut changed = false;
        let now = current_iso_timestamp();
        for job in state.jobs.iter_mut() {
            if job.status == "running" {
                job.status = "cancelled".to_string();
                job.completed_at = Some(now.clone());
                job.updated_at = now.clone();
                if let Some(message) = job.progress.message.as_mut() {
                    message.push_str("（应用重启，已取消）");
                } else {
                    job.progress.message = Some("应用重启，已取消".to_string());
                }
                changed = true;
            }
        }
        if changed {
            let _ = persist(&self.file_path, &state);
        }
    }

    pub fn snapshot_by_status(&self, status: &str) -> HashMap<String, ScanPreprocessStoredJob> {
        let state = self
            .state
            .lock()
            .expect("scan preprocess job queue mutex poisoned");
        state
            .jobs
            .iter()
            .filter(|job| job.status == status)
            .map(|job| (job.id.clone(), job.clone()))
            .collect()
    }
}

fn load_or_default(file_path: &PathBuf) -> ScanPreprocessQueueFile {
    let Ok(contents) = fs::read_to_string(file_path) else {
        return ScanPreprocessQueueFile::empty();
    };
    match serde_json::from_str::<ScanPreprocessQueueFile>(&contents) {
        Ok(parsed) if parsed.schema_version == SCAN_PREPROCESS_QUEUE_VERSION => parsed,
        Ok(_) | Err(_) => ScanPreprocessQueueFile::empty(),
    }
}

fn persist(file_path: &PathBuf, state: &ScanPreprocessQueueFile) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("无法创建扫描预处理任务队列目录：{error}")
        })?;
    }
    let payload = serde_json::to_string_pretty(state)
        .map_err(|error| format!("无法序列化扫描预处理任务队列：{error}"))?;
    fs::write(file_path, payload)
        .map_err(|error| format!("无法写入扫描预处理任务队列：{error}"))
}

pub fn current_iso_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("{millis}")
}

pub fn redact_path(path: &str) -> RedactedPathSummary {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return RedactedPathSummary {
            kind: "empty".to_string(),
            fingerprint: String::new(),
            redacted: String::new(),
        };
    }
    let extension = std::path::Path::new(trimmed)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let fingerprint = fingerprint_of(trimmed);
    let redacted = if extension == "pdf" {
        "[path].pdf".to_string()
    } else {
        "[path]".to_string()
    };
    RedactedPathSummary {
        kind: "local-pdf".to_string(),
        fingerprint,
        redacted,
    }
}

pub fn fingerprint_of(value: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn stored_options_default() -> ScanPreprocessStoredOptions {
    ScanPreprocessStoredOptions {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_path(label: &str) -> PathBuf {
        let mut path = env::temp_dir();
        let unique = format!("faropdf-scan-queue-{label}-{}", current_iso_timestamp());
        path.push(unique);
        path
    }

    fn sample_job(id: &str) -> ScanPreprocessStoredJob {
        ScanPreprocessStoredJob {
            id: id.to_string(),
            input_path: "/tmp/source.pdf".to_string(),
            input_path_summary: redact_path("/tmp/source.pdf"),
            output_path: "/tmp/source-preprocessed.pdf".to_string(),
            output_path_summary: redact_path("/tmp/source-preprocessed.pdf"),
            page_range: None,
            options: stored_options_default(),
            status: "queued".to_string(),
            progress: ScanPreprocessStoredProgress {
                stage: "queued".to_string(),
                completed_pages: 0,
                total_pages: 0,
                message: None,
            },
            summary: None,
            error_message: None,
            created_at: current_iso_timestamp(),
            updated_at: current_iso_timestamp(),
            started_at: None,
            completed_at: None,
        }
    }

    #[test]
    fn empty_queue_returns_empty_list() {
        let queue = ScanPreprocessJobQueue::new(temp_path("empty"));
        assert!(queue.list().is_empty());
    }

    #[test]
    fn upsert_persists_job_state_to_disk() {
        let path = temp_path("upsert");
        let queue = ScanPreprocessJobQueue::new(path.clone());
        let job = sample_job("scan-1");
        queue.upsert(job.clone()).expect("upsert job");
        let restored = ScanPreprocessJobQueue::new(path);
        assert_eq!(restored.get("scan-1"), Some(job));
    }

    #[test]
    fn update_progress_persists_progress_and_status() {
        let path = temp_path("progress");
        let queue = ScanPreprocessJobQueue::new(path);
        queue.upsert(sample_job("scan-1")).expect("upsert");

        let updated = queue
            .update_progress(
                "scan-1",
                ScanPreprocessStoredProgress {
                    stage: "preprocessing".to_string(),
                    completed_pages: 2,
                    total_pages: 4,
                    message: Some("已处理 2/4 页".to_string()),
                },
                Some("running".to_string()),
            )
            .expect("update progress")
            .expect("job present");

        assert_eq!(updated.status, "running");
        assert_eq!(updated.progress.completed_pages, 2);
        assert_eq!(updated.progress.total_pages, 4);
    }

    #[test]
    fn complete_writes_summary_and_terminal_status() {
        let path = temp_path("complete");
        let queue = ScanPreprocessJobQueue::new(path);
        queue.upsert(sample_job("scan-1")).expect("upsert");

        let summary = ScanPreprocessStoredSummary {
            total_pages: 4,
            processed_pages: 4,
            rotated_pages: 1,
            deskewed_pages: 0,
            split_pages: 0,
            cropped_pages: 0,
            blank_edges_cleared_pages: 2,
            elapsed_ms: 1234,
            output_path: "/tmp/source-preprocessed.pdf".to_string(),
            preprocess_only: true,
        };

        let completed = queue
            .complete("scan-1", "completed".to_string(), summary.clone())
            .expect("complete")
            .expect("job present");

        assert_eq!(completed.status, "completed");
        assert_eq!(completed.summary, Some(summary));
        assert!(completed.completed_at.is_some());
    }

    #[test]
    fn cancel_marks_queued_or_running_jobs() {
        let path = temp_path("cancel");
        let queue = ScanPreprocessJobQueue::new(path);
        queue.upsert(sample_job("scan-1")).expect("upsert");
        queue
            .update_progress(
                "scan-1",
                ScanPreprocessStoredProgress {
                    stage: "preprocessing".to_string(),
                    completed_pages: 1,
                    total_pages: 4,
                    message: Some("执行中".to_string()),
                },
                Some("running".to_string()),
            )
            .expect("running progress");

        let cancelled = queue.cancel("scan-1").expect("cancel").expect("job");
        assert_eq!(cancelled.status, "cancelled");
        assert!(cancelled.completed_at.is_some());
        assert!(cancelled
            .progress
            .message
            .unwrap_or_default()
            .contains("已取消"));
    }

    #[test]
    fn reconcile_marks_residual_running_as_cancelled() {
        let path = temp_path("reconcile");
        let queue = ScanPreprocessJobQueue::new(path.clone());
        let mut job = sample_job("scan-running");
        job.status = "running".to_string();
        queue.upsert(job).expect("upsert");

        let queue = ScanPreprocessJobQueue::new(path);
        let job = queue.get("scan-running").expect("recovered job");
        assert_eq!(job.status, "cancelled");
    }

    #[test]
    fn redacts_paths_in_summary() {
        let summary = redact_path("/Users/case/file, conf.pdf");
        assert_eq!(summary.kind, "local-pdf");
        assert!(!summary.fingerprint.is_empty());
        assert_eq!(summary.redacted, "[path].pdf");
    }
}
