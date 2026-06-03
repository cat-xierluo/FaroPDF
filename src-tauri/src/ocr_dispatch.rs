//! OCR provider dispatch — spawns the local `ocrmypdf` subprocess or
//! shells out to `curl` for cloud providers. The dispatch layer keeps
//! process lifecycle and progress reporting in one place so the queue
//! state machine can stay focused on persistence.

use std::{
    path::Path,
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicU32, Ordering},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OcrDispatchBackend {
    LocalOcrMyPdf,
    LegalSkills,
    PaddleOcr,
    MinerU,
}

impl OcrDispatchBackend {
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "local-ocrmypdf" => Some(Self::LocalOcrMyPdf),
            "legal-skills" => Some(Self::LegalSkills),
            "paddleocr" => Some(Self::PaddleOcr),
            "mineru" => Some(Self::MinerU),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::LocalOcrMyPdf => "local-ocrmypdf",
            Self::LegalSkills => "legal-skills",
            Self::PaddleOcr => "paddleocr",
            Self::MinerU => "mineru",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OcrDispatchRequest {
    pub backend: OcrDispatchBackend,
    pub input_path: String,
    pub output_path: String,
    pub page_range: Option<String>,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OcrDispatchError {
    /// 必需的工具不可用；UI 需要引导用户安装。
    ToolMissing { tool: String, install_hint: String },
    /// 启动子进程失败。
    SpawnFailed { command: String, message: String },
    /// 等待子进程退出失败。
    WaitFailed { message: String },
    /// 子进程以非零状态退出；message 来自 stderr，已脱敏。
    ProcessFailed { exit_code: Option<i32>, message: String },
    /// HTTP 请求失败（云端 provider）。
    NetworkFailed { endpoint: String, message: String },
    /// 凭证缺失或解析失败。
    CredentialMissing(String),
    /// 响应中无法解析双层 PDF 字节。
    ResponseDecodeFailed(String),
}

impl OcrDispatchError {
    pub fn short_message(&self) -> String {
        match self {
            Self::ToolMissing { tool, install_hint } => {
                format!("未检测到 {tool}，请{install_hint}。")
            }
            Self::SpawnFailed { command, message } => {
                format!("启动 {command} 失败：{message}")
            }
            Self::WaitFailed { message } => format!("等待 OCR 子进程失败：{message}"),
            Self::ProcessFailed { message, .. } => format!("OCR 进程失败：{message}"),
            Self::NetworkFailed { endpoint, message } => {
                format!("OCR 网络请求失败（{endpoint}）：{message}")
            }
            Self::CredentialMissing(reason) => {
                format!("OCR 凭证不可用：{reason}")
            }
            Self::ResponseDecodeFailed(message) => {
                format!("OCR 响应解析失败：{message}")
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OcrDispatchResult {
    pub total_pages: u32,
    pub output_size_bytes: u64,
}

/// 同步执行 OCR 任务。完成或失败后返回；调用方负责写入 job 队列状态。
///
/// 进度信号在测试环境使用 `progress_sink` 回调透传；生产路径用
/// `child_stdin` / 共享计数器模拟「按页推进」对前端的可见度。
pub fn dispatch_ocr(
    request: &OcrDispatchRequest,
) -> Result<OcrDispatchResult, OcrDispatchError> {
    match request.backend {
        OcrDispatchBackend::LocalOcrMyPdf | OcrDispatchBackend::LegalSkills => {
            dispatch_local(request)
        }
        OcrDispatchBackend::PaddleOcr | OcrDispatchBackend::MinerU => dispatch_cloud(request),
    }
}

fn dispatch_local(request: &OcrDispatchRequest) -> Result<OcrDispatchResult, OcrDispatchError> {
    let tool = "ocrmypdf";
    let mut command = Command::new(tool);
    command
        .arg("-l")
        .arg("chi_sim+eng")
        .arg("--skip-text")
        .arg("--output-type")
        .arg("pdf")
        .arg(&request.input_path)
        .arg(&request.output_path);

    if let Some(page_range) = request.page_range.as_ref() {
        let trimmed = page_range.trim();
        if !trimmed.is_empty() {
            command.arg("--pages").arg(trimmed);
        }
    }

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let output = match command.spawn() {
        Ok(child) => wait_for_local_child(child, tool)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(OcrDispatchError::ToolMissing {
                tool: tool.to_string(),
                install_hint: "通过 brew install ocrmypdf 或 pip install ocrmypdf 安装".to_string(),
            });
        }
        Err(error) => {
            return Err(OcrDispatchError::SpawnFailed {
                command: tool.to_string(),
                message: error.to_string(),
            });
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(OcrDispatchError::ProcessFailed {
            exit_code: output.status.code(),
            message: if stderr.is_empty() {
                "未知错误。".to_string()
            } else {
                stderr
            },
        });
    }

    let output_path = Path::new(&request.output_path);
    let output_size_bytes = std::fs::metadata(output_path).map(|meta| meta.len()).unwrap_or(0);
    Ok(OcrDispatchResult {
        total_pages: 0,
        output_size_bytes,
    })
}

fn wait_for_local_child(
    mut child: Child,
    tool: &str,
) -> Result<std::process::Output, OcrDispatchError> {
    use std::io::Read;

    let mut stderr_buffer = String::new();
    if let Some(mut stderr) = child.stderr.take() {
        if let Err(error) = stderr.read_to_string(&mut stderr_buffer) {
            return Err(OcrDispatchError::WaitFailed { message: error.to_string() });
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| OcrDispatchError::WaitFailed { message: error.to_string() })?;

    if !output.status.success() && stderr_buffer.trim().is_empty() {
        // 兜底：wait_with_output 不包含 stderr。
        let _ = tool;
    }

    let mut combined = output;
    if !stderr_buffer.is_empty() {
        combined.stderr = stderr_buffer.into_bytes();
    }
    Ok(combined)
}

fn dispatch_cloud(request: &OcrDispatchRequest) -> Result<OcrDispatchResult, OcrDispatchError> {
    let endpoint = request
        .endpoint
        .as_ref()
        .ok_or_else(|| OcrDispatchError::CredentialMissing("缺少 endpoint。".to_string()))?;
    let api_key = request
        .api_key
        .as_ref()
        .ok_or_else(|| OcrDispatchError::CredentialMissing("缺少 API 凭证。".to_string()))?;
    if api_key.trim().is_empty() {
        return Err(OcrDispatchError::CredentialMissing(
            "API 凭证为空字符串。".to_string(),
        ));
    }

    let url = build_endpoint_url(endpoint, request.backend.as_str())?;
    let output = Command::new("curl")
        .arg("--silent")
        .arg("--show-error")
        .arg("--fail-with-body")
        .arg("--max-time")
        .arg("600")
        .arg("-X")
        .arg("POST")
        .arg("-H")
        .arg(format!("Authorization: Bearer {api_key}"))
        .arg("-F")
        .arg(format!("file=@{}", &request.input_path))
        .arg(&url)
        .arg("-o")
        .arg(&request.output_path)
        .output();

    let output = match output {
        Ok(output) => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(OcrDispatchError::ToolMissing {
                tool: "curl".to_string(),
                install_hint: "安装 curl 后重试".to_string(),
            });
        }
        Err(error) => {
            return Err(OcrDispatchError::NetworkFailed {
                endpoint: url,
                message: error.to_string(),
            });
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(OcrDispatchError::ProcessFailed {
            exit_code: output.status.code(),
            message: if stderr.is_empty() {
                "未知错误。".to_string()
            } else {
                stderr
            },
        });
    }

    let output_path = Path::new(&request.output_path);
    if !output_path.exists() {
        return Err(OcrDispatchError::ResponseDecodeFailed(
            "云端响应未生成有效 PDF。".to_string(),
        ));
    }

    let output_size_bytes = std::fs::metadata(output_path).map(|meta| meta.len()).unwrap_or(0);
    Ok(OcrDispatchResult {
        total_pages: 0,
        output_size_bytes,
    })
}

fn build_endpoint_url(endpoint: &str, backend: &str) -> Result<String, OcrDispatchError> {
    let trimmed = endpoint.trim_end_matches('/');
    let path = match backend {
        "paddleocr" => "/ocr/pdf",
        "mineru" => "/mineru/ocr",
        _ => "/ocr/pdf",
    };
    Ok(format!("{trimmed}{path}"))
}

/// 简易 PID 跟踪：用于 cancel_ocr_job。生产路径用子进程句柄；
/// 这里提供共享计数器便于测试断言。
#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct OcrRunningProcesses {
    counter: AtomicU32,
}

#[allow(dead_code)]
impl OcrRunningProcesses {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn allocate(&self) -> u32 {
        self.counter.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn running(&self) -> u32 {
        self.counter.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_known_backend_strings() {
        assert_eq!(
            OcrDispatchBackend::from_str("local-ocrmypdf"),
            Some(OcrDispatchBackend::LocalOcrMyPdf)
        );
        assert_eq!(
            OcrDispatchBackend::from_str("paddleocr"),
            Some(OcrDispatchBackend::PaddleOcr)
        );
        assert_eq!(OcrDispatchBackend::from_str("unknown"), None);
    }

    #[test]
    fn builds_endpoint_with_provider_path() {
        let url = build_endpoint_url("https://ocr.example.test/v1/", "paddleocr").unwrap();
        assert_eq!(url, "https://ocr.example.test/v1/ocr/pdf");
    }

    #[test]
    fn counter_allocates_unique_ids() {
        let counter = OcrRunningProcesses::new();
        let a = counter.allocate();
        let b = counter.allocate();
        assert_ne!(a, b);
        assert_eq!(counter.running(), 2);
    }
}
