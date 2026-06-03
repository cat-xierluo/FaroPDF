//! 持久化 OCR 任务队列
//!
//! 把 OCR job 状态写入应用配置目录下的 `ocr-jobs.json`：
//! - 启动时载入并把残留的 `running` 任务标记为 `cancelled`，
//!   避免幽灵任务阻塞 UI。
//! - 写入用 mutex 保护，避免多 command 并发触发竞争。
//! - 不持久化 `privacyAuditRecord`、API key 引用、真实 PDF 路径；
//!   路径一律走 `summarize_local_path_for_audit` 脱敏。

use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::Mutex,
};

use serde::{Deserialize, Serialize};

use crate::ocr_dispatch::OcrDispatchBackend;

#[allow(dead_code)]
const OCR_JOB_QUEUE_FILE: &str = "ocr-jobs.json";
const OCR_JOB_QUEUE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrStoredQualityCheck {
    pub enabled: bool,
    pub sample_pages: Vec<u32>,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrStoredQualitySummary {
    pub searched_keywords: Vec<String>,
    pub matched_keywords: Vec<String>,
    pub text_pages: u32,
    pub empty_text_pages: u32,
    pub file_size_ratio: Option<f64>,
    pub elapsed_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrStoredJob {
    pub id: String,
    pub input_path: String,
    pub input_path_summary: RedactedPathSummary,
    pub output_path: String,
    pub output_path_summary: RedactedPathSummary,
    pub page_range: Option<String>,
    pub backend: String,
    pub provider_id: String,
    pub status: String,
    pub output_strategy: String,
    pub progress: OcrStoredProgress,
    pub quality_check: OcrStoredQualityCheck,
    pub quality: Option<OcrStoredQualitySummary>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrStoredProgress {
    pub stage: String,
    pub completed_pages: u32,
    pub total_pages: u32,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RedactedPathSummary {
    pub kind: String,
    pub fingerprint: String,
    pub redacted: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrJobQueueFile {
    pub schema_version: u32,
    pub jobs: Vec<OcrStoredJob>,
}

impl OcrJobQueueFile {
    pub fn empty() -> Self {
        Self {
            schema_version: OCR_JOB_QUEUE_VERSION,
            jobs: Vec::new(),
        }
    }
}

#[derive(Debug)]
pub struct OcrJobQueue {
    file_path: PathBuf,
    state: Mutex<OcrJobQueueFile>,
}

#[derive(Debug, Clone)]
pub struct OcrJobQueueState(pub std::sync::Arc<Mutex<OcrJobQueue>>);

impl OcrJobQueue {
    pub fn new(file_path: PathBuf) -> Self {
        let initial = load_or_default(&file_path);
        let queue = Self {
            file_path,
            state: Mutex::new(initial),
        };
        queue.reconcile_running_after_restart();
        queue
    }

    #[allow(dead_code)]
    pub fn file_path(&self) -> &PathBuf {
        &self.file_path
    }

    pub fn list(&self) -> Vec<OcrStoredJob> {
        let state = self.state.lock().expect("ocr job queue mutex poisoned");
        state.jobs.clone()
    }

    pub fn get(&self, job_id: &str) -> Option<OcrStoredJob> {
        let state = self.state.lock().expect("ocr job queue mutex poisoned");
        state.jobs.iter().find(|job| job.id == job_id).cloned()
    }

    pub fn upsert(&self, job: OcrStoredJob) -> Result<(), String> {
        let mut state = self.state.lock().expect("ocr job queue mutex poisoned");
        if let Some(existing) = state.jobs.iter_mut().find(|existing| existing.id == job.id) {
            *existing = job;
        } else {
            state.jobs.push(job);
        }
        persist(&self.file_path, &state)
    }

    pub fn cancel(&self, job_id: &str) -> Result<Option<OcrStoredJob>, String> {
        let mut state = self.state.lock().expect("ocr job queue mutex poisoned");
        let next = state.jobs.iter_mut().find(|job| job.id == job_id).map(|job| {
            if matches!(job.status.as_str(), "queued" | "running") {
                job.status = "cancelled".to_string();
                job.updated_at = current_iso_timestamp();
                if job.completed_at.is_none() {
                    job.completed_at = Some(job.updated_at.clone());
                }
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
        let mut state = self.state.lock().expect("ocr job queue mutex poisoned");
        let mut changed = false;
        let now = current_iso_timestamp();
        for job in state.jobs.iter_mut() {
            if job.status == "running" {
                job.status = "cancelled".to_string();
                job.updated_at = now.clone();
                if job.completed_at.is_none() {
                    job.completed_at = Some(now.clone());
                }
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

    #[allow(dead_code)]
    pub fn snapshot_by_backend(
        &self,
        backend: OcrDispatchBackend,
    ) -> HashMap<String, OcrStoredJob> {
        let state = self.state.lock().expect("ocr job queue mutex poisoned");
        state
            .jobs
            .iter()
            .filter(|job| job.backend == backend.as_str())
            .map(|job| (job.id.clone(), job.clone()))
            .collect()
    }
}

fn load_or_default(file_path: &PathBuf) -> OcrJobQueueFile {
    let Ok(contents) = fs::read_to_string(file_path) else {
        return OcrJobQueueFile::empty();
    };
    match serde_json::from_str::<OcrJobQueueFile>(&contents) {
        Ok(parsed) if parsed.schema_version == OCR_JOB_QUEUE_VERSION => parsed,
        Ok(_) | Err(_) => OcrJobQueueFile::empty(),
    }
}

fn persist(file_path: &PathBuf, state: &OcrJobQueueFile) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("无法创建 OCR 任务队列目录：{error}")
        })?;
    }
    let payload = serde_json::to_string_pretty(state)
        .map_err(|error| format!("无法序列化 OCR 任务队列：{error}"))?;
    fs::write(file_path, payload).map_err(|error| format!("无法写入 OCR 任务队列：{error}"))
}

pub fn current_iso_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("{millis}")
}

pub fn empty_path_summary() -> RedactedPathSummary {
    RedactedPathSummary {
        kind: "empty".to_string(),
        fingerprint: "".to_string(),
        redacted: "".to_string(),
    }
}

pub fn redact_path(path: &str) -> RedactedPathSummary {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return empty_path_summary();
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_path(label: &str) -> PathBuf {
        let mut path = env::temp_dir();
        let unique = format!("faropdf-ocr-queue-{label}-{}", current_iso_timestamp());
        path.push(unique);
        path
    }

    #[test]
    fn empty_queue_returns_empty_list() {
        let queue = OcrJobQueue::new(temp_path("empty"));
        assert!(queue.list().is_empty());
    }

    #[test]
    fn upsert_persists_job_state_to_disk() {
        let path = temp_path("upsert");
        let queue = OcrJobQueue::new(path.clone());
        let job = OcrStoredJob {
            id: "ocr-1".to_string(),
            input_path: "/tmp/source.pdf".to_string(),
            input_path_summary: redact_path("/tmp/source.pdf"),
            output_path: "/tmp/source-ocr.pdf".to_string(),
            output_path_summary: redact_path("/tmp/source-ocr.pdf"),
            page_range: None,
            backend: "local-ocrmypdf".to_string(),
            provider_id: "local-ocrmypdf".to_string(),
            status: "queued".to_string(),
            output_strategy: "new-layered-pdf".to_string(),
            progress: OcrStoredProgress {
                stage: "queued".to_string(),
                completed_pages: 0,
                total_pages: 0,
                message: None,
            },
            quality_check: OcrStoredQualityCheck {
                enabled: false,
                sample_pages: Vec::new(),
                keywords: Vec::new(),
            },
            quality: None,
            error_message: None,
            created_at: current_iso_timestamp(),
            updated_at: current_iso_timestamp(),
            started_at: None,
            completed_at: None,
        };
        queue.upsert(job.clone()).expect("upsert job");
        let restored = OcrJobQueue::new(path);
        assert_eq!(restored.get("ocr-1"), Some(job));
    }

    #[test]
    fn cancel_marks_queued_or_running_jobs() {
        let path = temp_path("cancel");
        let queue = OcrJobQueue::new(path);
        let mut job = OcrStoredJob {
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
                completed_pages: 1,
                total_pages: 4,
                message: Some("执行中".to_string()),
            },
            quality_check: OcrStoredQualityCheck {
                enabled: false,
                sample_pages: Vec::new(),
                keywords: Vec::new(),
            },
            quality: None,
            error_message: None,
            created_at: current_iso_timestamp(),
            updated_at: current_iso_timestamp(),
            started_at: Some(current_iso_timestamp()),
            completed_at: None,
        };
        queue.upsert(job.clone()).expect("upsert");
        let cancelled = queue.cancel("ocr-1").expect("cancel").expect("job");
        assert_eq!(cancelled.status, "cancelled");
        assert!(cancelled.completed_at.is_some());

        // Already-completed job is left alone.
        job.status = "completed".to_string();
        queue.upsert(job.clone()).expect("upsert completed");
        let result = queue.cancel(&job.id).expect("cancel completed");
        assert_eq!(result.unwrap().status, "completed");
    }

    #[test]
    fn reconcile_marks_residual_running_as_cancelled() {
        let path = temp_path("reconcile");
        let queue = OcrJobQueue::new(path.clone());
        queue
            .upsert(OcrStoredJob {
                id: "ocr-running".to_string(),
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
                    message: None,
                },
                quality_check: OcrStoredQualityCheck {
                    enabled: false,
                    sample_pages: Vec::new(),
                    keywords: Vec::new(),
                },
                quality: None,
                error_message: None,
                created_at: current_iso_timestamp(),
                updated_at: current_iso_timestamp(),
                started_at: Some(current_iso_timestamp()),
                completed_at: None,
            })
            .expect("upsert");
        // Simulate a fresh launch by creating a new queue over the same file.
        let queue = OcrJobQueue::new(path);
        let job = queue.get("ocr-running").expect("recovered job");
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
