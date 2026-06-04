//! OCR 后 PDF 文本提取
//!
//! 优先调用本机 `pdftotext -layout`（poppler-utils 工具），缺失时
//! 返回明确错误让前端决定是否降级。返回结构按页索引存储文本，
//! 供 `ocrQualityCheckService` 计算可检索页比例、关键词命中、CER
//! 和文件体积比等指标。

use std::{
    path::Path,
    process::Command,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OcrExtractedPage {
    pub page_index: u32,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OcrTextExtractionError {
    /// 调用方需要明确提示用户安装缺失的二进制。
    ToolMissing { tool: String },
    /// pdftotext 进程返回非零退出码；可能因为 PDF 损坏或加密。
    CommandFailed {
        command: String,
        exit_code: Option<i32>,
        message: String,
    },
    /// 输出无法按 `form feed` (\f) 拆分成页。
    OutputDecodeFailed(String),
}

impl OcrTextExtractionError {
    pub fn short_message(&self) -> String {
        match self {
            Self::ToolMissing { tool } => format!("未检测到 {tool}，请先安装 poppler-utils。"),
            Self::CommandFailed { message, .. } => format!("文本提取失败：{message}"),
            Self::OutputDecodeFailed(message) => format!("文本提取输出解析失败：{message}"),
        }
    }
}

pub fn extract_pdf_text(pdf_path: &Path) -> Result<Vec<OcrExtractedPage>, OcrTextExtractionError> {
    if !pdf_path.exists() {
        return Err(OcrTextExtractionError::CommandFailed {
            command: "pdftotext".to_string(),
            exit_code: None,
            message: "PDF 文件不存在。".to_string(),
        });
    }

    let command = "pdftotext";
    let output = match Command::new(command)
        .arg("-layout")
        .arg("-enc")
        .arg("UTF-8")
        .arg(pdf_path)
        .arg("-")
        .output()
    {
        Ok(output) => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(OcrTextExtractionError::ToolMissing {
                tool: command.to_string(),
            });
        }
        Err(error) => {
            return Err(OcrTextExtractionError::CommandFailed {
                command: command.to_string(),
                exit_code: None,
                message: error.to_string(),
            });
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(OcrTextExtractionError::CommandFailed {
            command: command.to_string(),
            exit_code: output.status.code(),
            message: if stderr.is_empty() {
                "未知错误。".to_string()
            } else {
                stderr
            },
        });
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| OcrTextExtractionError::OutputDecodeFailed(error.to_string()))?;

    Ok(split_into_pages(&stdout))
}

fn split_into_pages(text: &str) -> Vec<OcrExtractedPage> {
    // pdftotext 默认按 form feed (\x0C) 切页。
    text.split('\u{0C}')
        .enumerate()
        .filter_map(|(index, segment)| {
            let text = segment.trim_end_matches('\r').to_string();
            if text.trim().is_empty() && index != 0 {
                return None;
            }
            Some(OcrExtractedPage {
                page_index: index as u32,
                text,
            })
        })
        .collect()
}

pub fn summarize_extracted_pages(pages: &[OcrExtractedPage]) -> OcrTextSummary {
    let total = pages.len() as u32;
    let searchable = pages
        .iter()
        .filter(|page| page.text.chars().filter(|c| !c.is_whitespace()).count() >= 10)
        .count() as u32;
    OcrTextSummary {
        total_pages: total,
        searchable_pages: searchable,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OcrTextSummary {
    pub total_pages: u32,
    pub searchable_pages: u32,
}

pub fn file_size_or_zero(path: &Path) -> u64 {
    std::fs::metadata(path).map(|metadata| metadata.len()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_text_by_form_feed() {
        let text = "第一页内容\n第二页开始".replace("页", "\u{0C}页");
        let pages = split_into_pages(&text);
        assert!(pages.len() >= 2);
    }

    #[test]
    fn summary_counts_searchable_pages_by_visible_chars() {
        let pages = vec![
            OcrExtractedPage {
                page_index: 0,
                text: "这是一段比较长的中文文本，应当计为可检索页。".to_string(),
            },
            OcrExtractedPage {
                page_index: 1,
                text: "   \n   ".to_string(),
            },
        ];
        let summary = summarize_extracted_pages(&pages);
        assert_eq!(summary.total_pages, 2);
        assert_eq!(summary.searchable_pages, 1);
    }
}
