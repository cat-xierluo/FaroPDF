//! 扫描预处理第二阶段模块入口
//!
//! 第一版（DEC-016）只提供 job model、参数校验、Tauri command bridge stub。
//! 本模块把 stub 推进到真实 lopdf 处理：
//! - `queue`：持久化任务队列（`scan-preprocess-jobs.json`），重启时把残留
//!   `running` 任务标记为 `cancelled`，避免幽灵任务阻塞 UI；
//! - `types`：stored job 类型（与 command 层互不依赖）；
//! - `pdf_probe`：用 lopdf 0.33 解析页数 / MediaBox / Rotate，按
//!   `blankEdgeMarginPx` 真实缩小 `MediaBox`；
//! - `runner`：主流程 `validating → preprocessing → writing-output → completed`，
//!   真实测量 `elapsed_ms` 并填入 summary。
//!
//! 仍保留 plan-only 的部分（不破坏前端契约，不假装已实现）：
//! - 90 度方向检测：纯 lopdf 不解析压缩 content stream 中的文本对象 `cm`
//!   矩阵投票；待集成 mupdf / opencv 栅格化能力后再做；
//! - 微倾斜校正：无栅格化能力，不修改任何内容；
//! - 双页拆分：无栅格化能力，不做中间空白判断。
//!
//! 公开 API 列表见各子模块 `pub use`。

pub mod pdf_probe;
pub mod queue;
pub mod runner;
pub mod types;

pub use queue::{
    ScanPreprocessJobQueue, ScanPreprocessJobQueueState, current_iso_timestamp, fingerprint_of,
    redact_path, stored_options_default, ScanPreprocessQueueFile,
};
pub use runner::{ScanPreprocessRunRequest, run_scan_preprocess_job};
pub use types::{
    RedactedPathSummary, ScanPreprocessStoredJob, ScanPreprocessStoredOptions,
    ScanPreprocessStoredProgress, ScanPreprocessStoredSummary,
};
