//! ISS-071 m4: 统一错误 schema（Rust 侧）
//!
//! TypeScript 等价：`src/shared/error.ts AppError`。
//!
//! 后续 Tauri command 应返回 `Result<T, AppError>` 而非 `Result<T, String>`。
//! 前端通过 invoke 的 catch block 拿到 serde 序列化的 AppError，按 `code` 触发
//! i18n 或 UI 分支。
//!
//! 当前在 `lib.rs` 仍有 `Result<T, String>` 的 command（如 `remove_pdfpassword`），
//! ISS-071 阶段 2（v0.2 follow-up）按需迁移。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// 错误分类，与 TypeScript `ErrCode` 联合对齐。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ErrCode {
    InvalidInput,
    FileNotFound,
    PermissionDenied,
    PdfParseError,
    EncryptionError,
    DecryptionError,
    IoError,
    NotSupported,
    Unknown,
}

impl ErrCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrCode::InvalidInput => "InvalidInput",
            ErrCode::FileNotFound => "FileNotFound",
            ErrCode::PermissionDenied => "PermissionDenied",
            ErrCode::PdfParseError => "PdfParseError",
            ErrCode::EncryptionError => "EncryptionError",
            ErrCode::DecryptionError => "DecryptionError",
            ErrCode::IoError => "IoError",
            ErrCode::NotSupported => "NotSupported",
            ErrCode::Unknown => "Unknown",
        }
    }
}

/// 统一应用错误结构。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: ErrCode,
    pub message: String,
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub context: HashMap<String, String>,
}

impl AppError {
    /// 新建 AppError，无 context。
    pub fn new(code: ErrCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            context: HashMap::new(),
        }
    }

    /// 在 builder 风格上加 context 项。
    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.context.is_empty() {
            write!(f, "[{}] {}", self.code.as_str(), self.message)
        } else {
            let ctx: Vec<String> = self
                .context
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect();
            write!(
                f,
                "[{}] {} ({})",
                self.code.as_str(),
                self.message,
                ctx.join(", ")
            )
        }
    }
}

impl std::error::Error for AppError {}

// 常用 From 转换，方便老代码迁移
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        let code = match e.kind() {
            std::io::ErrorKind::NotFound => ErrCode::FileNotFound,
            std::io::ErrorKind::PermissionDenied => ErrCode::PermissionDenied,
            _ => ErrCode::IoError,
        };
        AppError::new(code, format!("IO 错误: {}", e.kind()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_empty_context() {
        let err = AppError::new(ErrCode::FileNotFound, "PDF 文件不存在");
        assert_eq!(err.code, ErrCode::FileNotFound);
        assert_eq!(err.message, "PDF 文件不存在");
        assert!(err.context.is_empty());
    }

    #[test]
    fn with_context_chains() {
        let err = AppError::new(ErrCode::EncryptionError, "AES-256 加密失败")
            .with_context("stage", "doc.save")
            .with_context("file", "[path:contract.pdf]");
        assert_eq!(err.context.get("stage"), Some(&"doc.save".to_string()));
        assert_eq!(err.context.get("file"), Some(&"[path:contract.pdf]".to_string()));
    }

    #[test]
    fn display_with_no_context() {
        let err = AppError::new(ErrCode::FileNotFound, "PDF not found");
        assert_eq!(format!("{}", err), "[FileNotFound] PDF not found");
    }

    #[test]
    fn display_with_context() {
        let err = AppError::new(ErrCode::DecryptionError, "密码错误")
            .with_context("file", "[path:contract.pdf]");
        let s = format!("{}", err);
        assert!(s.starts_with("[DecryptionError] 密码错误 ("));
        assert!(s.contains("file=[path:contract.pdf]"));
    }

    #[test]
    fn serde_round_trip_with_context() {
        let err = AppError::new(ErrCode::EncryptionError, "AES-256 加密失败")
            .with_context("stage", "doc.save");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\":\"EncryptionError\""));
        assert!(json.contains("\"message\":\"AES-256 加密失败\""));
        assert!(json.contains("\"context\""));

        let parsed: AppError = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.code, ErrCode::EncryptionError);
        assert_eq!(parsed.message, "AES-256 加密失败");
        assert_eq!(parsed.context.get("stage"), Some(&"doc.save".to_string()));
    }

    #[test]
    fn serde_skips_empty_context() {
        let err = AppError::new(ErrCode::FileNotFound, "x");
        let json = serde_json::to_string(&err).unwrap();
        assert!(!json.contains("context"));
    }

    #[test]
    fn from_io_error_maps_kind() {
        let not_found: std::io::Error = std::io::Error::new(std::io::ErrorKind::NotFound, "x");
        let app: AppError = not_found.into();
        assert_eq!(app.code, ErrCode::FileNotFound);

        let perm: std::io::Error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "x");
        let app2: AppError = perm.into();
        assert_eq!(app2.code, ErrCode::PermissionDenied);

        let other: std::io::Error = std::io::Error::new(std::io::ErrorKind::Other, "x");
        let app3: AppError = other.into();
        assert_eq!(app3.code, ErrCode::IoError);
    }

    #[test]
    fn all_err_codes_have_str() {
        let codes = [
            ErrCode::InvalidInput,
            ErrCode::FileNotFound,
            ErrCode::PermissionDenied,
            ErrCode::PdfParseError,
            ErrCode::EncryptionError,
            ErrCode::DecryptionError,
            ErrCode::IoError,
            ErrCode::NotSupported,
            ErrCode::Unknown,
        ];
        for c in codes {
            assert!(!c.as_str().is_empty());
        }
    }
}
