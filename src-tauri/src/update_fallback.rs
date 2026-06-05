//! ISS-021 增量更新失败回退：错误分类与脱敏。
//!
//! 当 `tauri-plugin-updater` 增量更新失败时（chunk 重试用尽、网络中断、签名校验失败、
//! 用户取消等），本模块提供错误分类和用户友好的脱敏消息，用于前端 UI 展示回退状态。
//!
//! 前端通过 `AppUpdateApplyResult.kind = "fallback"` 接收回退信号，UI 展示
//! "自动回退中..." / "回退失败，请去 GitHub Releases 下载"。
//!
//! 不暴露 token / key / 路径等敏感信息。

use serde::Serialize;

/// 增量更新失败原因分类。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateFallbackReason {
    /// chunk 重试次数用尽。
    ChunkRetryExhausted,
    /// 网络中断或超时。
    NetworkInterrupted,
    /// 签名校验失败。
    SignatureVerificationFailed,
    /// 用户主动取消。
    UserCancelled,
    /// 未知 / 未分类错误。
    Unknown,
}

/// 回退结果，传递给前端。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFallbackInfo {
    /// 分类后的失败原因。
    pub reason: UpdateFallbackReason,
    /// 用户可见的脱敏错误消息。
    pub message: String,
    /// GitHub Releases 页面链接。
    pub releases_url: String,
}

const RELEASES_URL: &str = "https://github.com/cat-xierluo/FaroPDF/releases";

/// 将原始错误消息分类为 `UpdateFallbackReason`。
///
/// 匹配策略：优先匹配最具体的关键词（signature → hash mismatch → cancelled →
/// network / timeout / chunk），其余归为 Unknown。
pub fn classify_update_error(raw_message: &str) -> UpdateFallbackReason {
    let lower = raw_message.to_lowercase();

    if lower.contains("signature") || lower.contains("signing") {
        return UpdateFallbackReason::SignatureVerificationFailed;
    }
    if lower.contains("hash mismatch") || lower.contains("checksum") || lower.contains("digest") {
        return UpdateFallbackReason::SignatureVerificationFailed;
    }
    if lower.contains("cancel") || lower.contains("abort") {
        return UpdateFallbackReason::UserCancelled;
    }
    if lower.contains("chunk") || lower.contains("retry") {
        return UpdateFallbackReason::ChunkRetryExhausted;
    }
    if lower.contains("network")
        || lower.contains("timeout")
        || lower.contains("connection")
        || lower.contains("timed out")
        || lower.contains("dns")
        || lower.contains("erefused")
    {
        return UpdateFallbackReason::NetworkInterrupted;
    }

    UpdateFallbackReason::Unknown
}

/// 生成用户可见的脱敏错误消息。
///
/// 规则：
/// - 不暴露本地路径（替换为 `[path]`）。
/// - 不暴露 URL 中的 token / query 参数。
/// - 不暴露公钥或签名原始值。
pub fn sanitize_fallback_message(reason: &UpdateFallbackReason, raw_message: &str) -> String {
    match reason {
        UpdateFallbackReason::ChunkRetryExhausted => {
            "增量更新下载重试用尽，正在回退到完整安装包。".to_string()
        }
        UpdateFallbackReason::NetworkInterrupted => {
            "网络连接中断，正在回退到完整安装包。".to_string()
        }
        UpdateFallbackReason::SignatureVerificationFailed => {
            "更新包签名校验失败，正在回退到完整安装包。".to_string()
        }
        UpdateFallbackReason::UserCancelled => "用户已取消更新。".to_string(),
        UpdateFallbackReason::Unknown => {
            let sanitized = redact_sensitive_parts(raw_message);
            if sanitized.is_empty() {
                "更新失败，正在回退到完整安装包。".to_string()
            } else {
                format!("更新失败（{sanitized}），正在回退到完整安装包。")
            }
        }
    }
}

/// 从错误消息中移除敏感信息（路径、URL、token 等）。
fn redact_sensitive_parts(message: &str) -> String {
    let mut result = message.to_string();

    // 替换本地路径（/Users/xxx, /home/xxx, C:\Users\xxx, /tmp/xxx 等）
    let path_patterns = [
        "/Users/",
        "/home/",
        "/tmp/",
        "C:\\Users\\",
        "C:\\Program Files\\",
        "/var/folders/",
        "/private/tmp/",
    ];
    for pattern in path_patterns {
        if let Some(start) = result.find(pattern) {
            // 找到路径起始位置，截断到下一个空格或字符串末尾
            let end = result[start..]
                .find(|c: char| c.is_whitespace())
                .map(|i| start + i)
                .unwrap_or(result.len());
            result = format!("{}[path]{}", &result[..start], &result[end..]);
        }
    }

    // 替换 URL query 参数中的 token
    if let Some(query_start) = result.find('?') {
        if let Some(space_after) = result[query_start..].find(' ') {
            result = format!("{}{}", &result[..query_start], &result[query_start + space_after..]);
        } else {
            result.truncate(query_start);
        }
    }

    // 截断过长的消息
    if result.len() > 200 {
        result.truncate(200);
        result.push('…');
    }

    result
}

/// 构建完整的回退信息。
pub fn build_fallback_info(raw_error: &str) -> UpdateFallbackInfo {
    let reason = classify_update_error(raw_error);
    let message = sanitize_fallback_message(&reason, raw_error);
    UpdateFallbackInfo {
        reason,
        message,
        releases_url: RELEASES_URL.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_chunk_retry_exhausted() {
        let cases = [
            "chunk retry failed after 3 attempts",
            "max retries exceeded for chunk download",
        ];
        for raw in cases {
            assert_eq!(
                classify_update_error(raw),
                UpdateFallbackReason::ChunkRetryExhausted,
                "failed for: {raw}"
            );
        }
    }

    #[test]
    fn classifies_network_interrupted() {
        let cases = [
            "network error: connection refused",
            "request timed out after 30s",
            "connection reset by peer",
            "dns resolution failed",
        ];
        for raw in cases {
            assert_eq!(
                classify_update_error(raw),
                UpdateFallbackReason::NetworkInterrupted,
                "failed for: {raw}"
            );
        }
    }

    #[test]
    fn classifies_signature_verification_failed() {
        let cases = [
            "signature verification failed",
            "hash mismatch: expected abc, got def",
            "checksum does not match digest",
        ];
        for raw in cases {
            assert_eq!(
                classify_update_error(raw),
                UpdateFallbackReason::SignatureVerificationFailed,
                "failed for: {raw}"
            );
        }
    }

    #[test]
    fn classifies_user_cancelled() {
        let cases = [
            "operation cancelled by user",
            "download aborted",
        ];
        for raw in cases {
            assert_eq!(
                classify_update_error(raw),
                UpdateFallbackReason::UserCancelled,
                "failed for: {raw}"
            );
        }
    }

    #[test]
    fn classifies_unknown_error() {
        assert_eq!(
            classify_update_error("some random error"),
            UpdateFallbackReason::Unknown,
        );
    }

    #[test]
    fn sanitize_hides_local_paths() {
        let raw = "failed to write /Users/maoking/Library/file.tar.gz: disk full";
        let reason = UpdateFallbackReason::Unknown;
        let message = sanitize_fallback_message(&reason, raw);
        assert!(!message.contains("/Users/maoking"));
        assert!(message.contains("[path]"));
    }

    #[test]
    fn sanitize_known_reasons_ignores_raw_message() {
        let msg = sanitize_fallback_message(
            &UpdateFallbackReason::NetworkInterrupted,
            "ignored raw detail",
        );
        assert_eq!(msg, "网络连接中断，正在回退到完整安装包。");
    }

    #[test]
    fn build_fallback_info_returns_releases_url() {
        let info = build_fallback_info("network timeout");
        assert_eq!(info.reason, UpdateFallbackReason::NetworkInterrupted);
        assert_eq!(
            info.releases_url,
            "https://github.com/cat-xierluo/FaroPDF/releases",
        );
        assert!(info.message.contains("回退"));
    }

    #[test]
    fn redact_sensitive_parts_removes_query_params() {
        let result = redact_sensitive_parts("download failed https://example.com/file?token=secret123");
        assert!(!result.contains("token=secret123"));
    }

    #[test]
    fn redact_sensitive_parts_truncates_long_messages() {
        let long = "error: ".repeat(50);
        let result = redact_sensitive_parts(&long);
        assert!(result.len() <= 210); // 200 + "…"
    }
}
