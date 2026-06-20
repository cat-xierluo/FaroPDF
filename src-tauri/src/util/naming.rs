//! ISS-071 m3: PDF 导出文件命名约定（Rust 侧）。
//!
//! TypeScript 等价：`src/shared/naming.ts suggestOutputName()`。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OutputSuffix {
    Copy,
    Secured,
    Unsecured,
    Watermarked,
    TextWatermarked,
    ImageWatermarked,
    Compressed,
    Organized,
    AnnotationsFlattened,
    Flattened,
    HeaderFooter,
    PageNumbered,
    Bates,
    Redacted,
    NoWatermark,
    Metadata,
    Cut,
    Trimmed,
    Signed,
}

impl OutputSuffix {
    pub fn as_str(self) -> &'static str {
        match self {
            OutputSuffix::Copy => "copy",
            OutputSuffix::Secured => "secured",
            OutputSuffix::Unsecured => "unsecured",
            OutputSuffix::Watermarked => "watermarked",
            OutputSuffix::TextWatermarked => "text-watermarked",
            OutputSuffix::ImageWatermarked => "image-watermarked",
            OutputSuffix::Compressed => "compressed",
            OutputSuffix::Organized => "organized",
            OutputSuffix::AnnotationsFlattened => "annotations-flattened",
            OutputSuffix::Flattened => "flattened",
            OutputSuffix::HeaderFooter => "header-footer",
            OutputSuffix::PageNumbered => "page-numbered",
            OutputSuffix::Bates => "bates",
            OutputSuffix::Redacted => "redacted",
            OutputSuffix::NoWatermark => "no-watermark",
            OutputSuffix::Metadata => "metadata",
            OutputSuffix::Cut => "cut",
            OutputSuffix::Trimmed => "trimmed",
            OutputSuffix::Signed => "signed",
        }
    }
}

const FALLBACK_STEM: &str = "document";

/// 把原文件名拼接为 `<stem>-<suffix>.pdf`。
///
/// 行为与 TypeScript 端 `suggestOutputName()` 一致：
/// - 自动 strip `.pdf` / `.PDF` 后缀
/// - 替换路径分隔符 `/` `\` 为 `-`
/// - 空 / 仅空白名 fallback 为 `document-<suffix>.pdf`
pub fn suggest_output_name(original_name: Option<&str>, suffix: OutputSuffix) -> String {
    let sanitized: String = original_name
        .unwrap_or("")
        .trim()
        .chars()
        .map(|c| if c == '/' || c == '\\' { '-' } else { c })
        .collect();
    if sanitized.is_empty() {
        return format!("{FALLBACK_STEM}-{}.pdf", suffix.as_str());
    }
    let lower = sanitized.to_lowercase();
    let stem = if lower.ends_with(".pdf") {
        &sanitized[..sanitized.len() - 4]
    } else {
        &sanitized[..]
    };
    let effective_stem = if stem.trim().is_empty() {
        FALLBACK_STEM
    } else {
        stem
    };
    format!("{effective_stem}-{}.pdf", suffix.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_file_with_suffixes() {
        assert_eq!(
            suggest_output_name(Some("contract.pdf"), OutputSuffix::Secured),
            "contract-secured.pdf"
        );
        assert_eq!(
            suggest_output_name(Some("contract.pdf"), OutputSuffix::Redacted),
            "contract-redacted.pdf"
        );
    }

    #[test]
    fn no_pdf_extension_works() {
        assert_eq!(
            suggest_output_name(Some("contract"), OutputSuffix::Secured),
            "contract-secured.pdf"
        );
    }

    #[test]
    fn pdf_extension_case_insensitive() {
        assert_eq!(
            suggest_output_name(Some("Contract.PDF"), OutputSuffix::Secured),
            "Contract-secured.pdf"
        );
        assert_eq!(
            suggest_output_name(Some("FILE.Pdf"), OutputSuffix::Compressed),
            "FILE-compressed.pdf"
        );
    }

    #[test]
    fn empty_or_whitespace_fallback() {
        assert_eq!(
            suggest_output_name(Some(""), OutputSuffix::Secured),
            "document-secured.pdf"
        );
        assert_eq!(
            suggest_output_name(Some("   "), OutputSuffix::Secured),
            "document-secured.pdf"
        );
        assert_eq!(
            suggest_output_name(None, OutputSuffix::Secured),
            "document-secured.pdf"
        );
    }

    #[test]
    fn path_chars_replaced() {
        assert_eq!(
            suggest_output_name(Some("foo/bar.pdf"), OutputSuffix::Secured),
            "foo-bar-secured.pdf"
        );
        assert_eq!(
            suggest_output_name(Some("foo\\bar.pdf"), OutputSuffix::Secured),
            "foo-bar-secured.pdf"
        );
    }

    #[test]
    fn only_pdf_extension_fallback() {
        assert_eq!(
            suggest_output_name(Some(".pdf"), OutputSuffix::Secured),
            "document-secured.pdf"
        );
    }

    #[test]
    fn chinese_stem_preserved() {
        assert_eq!(
            suggest_output_name(Some("合同.pdf"), OutputSuffix::Redacted),
            "合同-redacted.pdf"
        );
        assert_eq!(
            suggest_output_name(Some("证据材料2.pdf"), OutputSuffix::Bates),
            "证据材料2-bates.pdf"
        );
    }

    #[test]
    fn all_suffixes_round_trip() {
        let cases = [
            (OutputSuffix::Copy, "a-copy.pdf"),
            (OutputSuffix::Unsecured, "a-unsecured.pdf"),
            (OutputSuffix::TextWatermarked, "a-text-watermarked.pdf"),
            (OutputSuffix::ImageWatermarked, "a-image-watermarked.pdf"),
            (OutputSuffix::Organized, "a-organized.pdf"),
            (OutputSuffix::AnnotationsFlattened, "a-annotations-flattened.pdf"),
            (OutputSuffix::Flattened, "a-flattened.pdf"),
            (OutputSuffix::HeaderFooter, "a-header-footer.pdf"),
            (OutputSuffix::PageNumbered, "a-page-numbered.pdf"),
            (OutputSuffix::Metadata, "a-metadata.pdf"),
            (OutputSuffix::Cut, "a-cut.pdf"),
            (OutputSuffix::Trimmed, "a-trimmed.pdf"),
            (OutputSuffix::NoWatermark, "a-no-watermark.pdf"),
        ];
        for (suffix, expected) in cases {
            assert_eq!(suggest_output_name(Some("a.pdf"), suffix), expected);
        }
    }

    #[test]
    fn serde_serializes_to_kebab_case() {
        let s = serde_json::to_string(&OutputSuffix::HeaderFooter).unwrap();
        assert_eq!(s, "\"header-footer\"");
        let s2 = serde_json::to_string(&OutputSuffix::AnnotationsFlattened).unwrap();
        assert_eq!(s2, "\"annotations-flattened\"");
    }
}
