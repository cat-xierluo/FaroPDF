//! 持久化的扫描预处理 job 类型
//!
//! 与 `lib.rs` 中 `ScanPreprocessCommand*` 序列化类型互不依赖：
//! 持久化层记录真实处理阶段、旋转投票、裁边统计、elapsed_ms 等运行时字段；
//! command 层只负责把 stored job 转换为面向前端的契约。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanPreprocessStoredOptions {
    pub enhance_scans: bool,
    pub detect_orientation: bool,
    pub deskew: bool,
    pub split_pages: bool,
    pub crop_pages: bool,
    pub trim_blank_edges: bool,
    pub output_mode: String,
    pub dpi: u32,
    pub jpeg_quality: u32,
    pub skew_threshold_degrees: f32,
    pub rotation_confidence: f32,
    pub max_deskew_degrees: f32,
    pub blank_edge_margin_px: u32,
    pub blank_edge_threshold: u32,
    pub parallel_jobs: u32,
    pub chunk_pages: u32,
    pub preserve_original_page_size: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanPreprocessStoredProgress {
    pub stage: String,
    pub completed_pages: u32,
    pub total_pages: u32,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanPreprocessStoredSummary {
    pub total_pages: u32,
    pub processed_pages: u32,
    pub rotated_pages: u32,
    pub deskewed_pages: u32,
    pub split_pages: u32,
    pub cropped_pages: u32,
    pub blank_edges_cleared_pages: u32,
    pub elapsed_ms: u64,
    pub output_path: String,
    pub preprocess_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanPreprocessStoredJob {
    pub id: String,
    pub input_path: String,
    pub input_path_summary: RedactedPathSummary,
    pub output_path: String,
    pub output_path_summary: RedactedPathSummary,
    pub page_range: Option<String>,
    pub options: ScanPreprocessStoredOptions,
    pub status: String,
    pub progress: ScanPreprocessStoredProgress,
    pub summary: Option<ScanPreprocessStoredSummary>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RedactedPathSummary {
    pub kind: String,
    pub fingerprint: String,
    pub redacted: String,
}
