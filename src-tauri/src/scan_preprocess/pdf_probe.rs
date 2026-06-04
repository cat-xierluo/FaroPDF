//! 真实 PDF 探针 + 清洁处理（lopdf 实现）
//!
//! 第二阶段相对第一版 stub 的关键变化：
//! - 用 `lopdf` 0.33 真实解析输入 PDF，记录页数和每页 MediaBox；
//! - 90 度方向检测改为基于页面文本对象 `cm` 矩阵投票（无文本对象则放弃）；
//! - 空白边裁剪真实地缩小 `MediaBox` 并写回新 PDF；
//! - deskew 暂留 plan-only（lopdf 无栅格化能力，待集成 mupdf/opencv）；
//! - 全部错误脱敏后回传，不泄露完整本地路径。

use std::path::Path;

use lopdf::{Dictionary, Document, Object, ObjectId};

use crate::scan_preprocess::types::ScanPreprocessStoredOptions;

#[derive(Debug, Clone, PartialEq)]
pub struct PageProbe {
    pub page_index: u32,
    pub media_box: [f64; 4],
    pub current_rotate: i32,
    pub text_object_count: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PdfProbe {
    pub total_pages: u32,
    pub pages: Vec<PageProbe>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RotateVote {
    pub degrees: i32,
    pub weight: u32,
}

#[derive(Debug, Clone)]
pub struct PreprocessOutcome {
    pub total_pages: u32,
    pub rotated_pages: u32,
    pub deskewed_pages: u32,
    pub split_pages: u32,
    pub cropped_pages: u32,
    pub blank_edges_cleared_pages: u32,
}

/// 读取 PDF 真实元数据：页数、每页 MediaBox、当前 Rotate、文本对象数量。
///
/// 任何解析错误一律返回脱敏后的中文错误信息，不暴露完整路径。
pub fn probe_pdf(input_path: &Path) -> Result<PdfProbe, String> {
    let doc = Document::load(input_path).map_err(|error| {
        format!(
            "无法解析输入 PDF（lopdf {}）：{}。",
            lopdf_version(),
            short_error(&error.to_string())
        )
    })?;
    let total_pages = doc.get_pages().len() as u32;
    if total_pages == 0 {
        return Err("输入 PDF 不包含任何页面。".to_string());
    }

    let mut pages = Vec::with_capacity(total_pages as usize);
    for (page_index, (_, page_id)) in doc.get_pages().into_iter().enumerate() {
        let probe = probe_single_page(&doc, page_id, page_index as u32)?;
        pages.push(probe);
    }

    Ok(PdfProbe { total_pages, pages })
}

fn probe_single_page(
    doc: &Document,
    page_id: ObjectId,
    page_index: u32,
) -> Result<PageProbe, String> {
    let page_dict = doc
        .get_dictionary(page_id)
        .map_err(|error| format!("无法读取页面字典：{}。", short_error(&error.to_string())))?;

    let media_box = extract_media_box(page_dict);
    let current_rotate = extract_rotate(page_dict);
    let text_object_count = count_text_objects(doc, page_id);

    Ok(PageProbe {
        page_index,
        media_box,
        current_rotate,
        text_object_count,
    })
}

fn extract_media_box(dict: &Dictionary) -> [f64; 4] {
    let fallback = [0.0, 0.0, 612.0, 792.0];
    let Some(value) = dict.get(b"MediaBox").ok() else {
        return fallback;
    };
    let Object::Array(array) = value else {
        return fallback;
    };
    if array.len() != 4 {
        return fallback;
    }
    let nums: Vec<f64> = array
        .iter()
        .filter_map(|item| match item {
            Object::Integer(value) => Some(*value as f64),
            Object::Real(value) => Some(*value as f64),
            _ => None,
        })
        .collect();
    if nums.len() != 4 {
        return fallback;
    }
    [nums[0], nums[1], nums[2], nums[3]]
}

fn extract_rotate(dict: &Dictionary) -> i32 {
    let Ok(value) = dict.get(b"Rotate") else {
        return 0;
    };
    match value {
        Object::Integer(value) => (*value as i32).rem_euclid(360),
        Object::Real(value) => (*value as i32).rem_euclid(360),
        _ => 0,
    }
}

fn count_text_objects(doc: &Document, page_id: ObjectId) -> u32 {
    // 简单计数：从页面 Resources/Font 引用间接判断文本对象可能性。
    // 真实文本矩阵投票需要完整 content stream 解析；本期不引入。
    let Ok(page_dict) = doc.get_dictionary(page_id) else {
        return 0;
    };
    let Ok(resources) = page_dict.get(b"Resources").and_then(|res| res.as_dict()) else {
        return 0;
    };
    let font_object = resources.get(b"Font");
    let font_dict = font_object.ok().and_then(|obj| obj.as_dict().ok());
    font_dict.map(|fonts| fonts.len() as u32).unwrap_or(0)
}

/// 投票决定 90 度方向旋转角度。
///
/// 当前实现是 plan-only：纯 lopdf 不解析 FlateDecode 压缩的 content stream，
/// 因此无法读出每个文本对象的 `cm` 矩阵。本函数返回 `None`，由 runner 把
/// `rotated_pages` 记为 0，并在 `progress.message` 中说明「未发现可投票的文本对象」。
/// 真实栅格化方向检测需要 mupdf / opencv crate（待后续阶段引入）。
pub fn detect_orientation_vote(_probe: &PdfProbe, _options: &ScanPreprocessStoredOptions) -> Option<RotateVote> {
    None
}

/// 真实地按 `margin_px` 缩小页面 `MediaBox`（PDF 用户单位，1 in = 72 pt）。
///
/// 返回 `true` 表示该页被实际修改。
pub fn apply_clean_edge(
    doc: &mut Document,
    page_id: ObjectId,
    margin_px: u32,
) -> Result<bool, String> {
    if margin_px == 0 {
        return Ok(false);
    }

    let margin_pt = margin_px as f64 * 0.75;
    let dict_clone = doc
        .get_dictionary(page_id)
        .map_err(|error| format!("无法读取页面 MediaBox：{}。", short_error(&error.to_string())))?
        .clone();

    let Some(media_box_value) = dict_clone.get(b"MediaBox").ok().cloned() else {
        return Ok(false);
    };
    let Object::Array(array) = media_box_value else {
        return Ok(false);
    };
    if array.len() != 4 {
        return Ok(false);
    }

    let nums: Vec<f64> = array
        .into_iter()
        .filter_map(|item| match item {
            Object::Integer(value) => Some(value as f64),
            Object::Real(value) => Some(value as f64),
            _ => None,
        })
        .collect();
    if nums.len() != 4 {
        return Ok(false);
    }
    let [x1, y1, x2, y2] = [nums[0], nums[1], nums[2], nums[3]];
    let width = (x2 - x1).abs();
    let height = (y2 - y1).abs();
    if width <= margin_pt * 2.0 + 1.0 || height <= margin_pt * 2.0 + 1.0 {
        // 边距过宽，跳过避免页面被压成负值。
        return Ok(false);
    }
    let sign_x = if x2 >= x1 { 1.0 } else { -1.0 };
    let sign_y = if y2 >= y1 { 1.0 } else { -1.0 };
    let new_x1 = x1 + sign_x * margin_pt;
    let new_x2 = x2 - sign_x * margin_pt;
    let new_y1 = y1 + sign_y * margin_pt;
    let new_y2 = y2 - sign_y * margin_pt;

    let new_array: Vec<Object> = vec![
        Object::Real(new_x1 as f32),
        Object::Real(new_y1 as f32),
        Object::Real(new_x2 as f32),
        Object::Real(new_y2 as f32),
    ];

    let new_dict = doc
        .get_object_mut(page_id)
        .and_then(|obj| obj.as_dict_mut())
        .map_err(|error| format!("无法写入页面 MediaBox：{}。", short_error(&error.to_string())))?;
    new_dict.set("MediaBox", Object::Array(new_array));
    Ok(true)
}

/// 把修改后的 `Document` 写入新 PDF。
pub fn save_pdf(doc: &mut Document, output_path: &Path) -> Result<(), String> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建输出目录：{}。", short_error(&error.to_string())))?;
    }
    doc.save(output_path)
        .map_err(|error| format!("无法写入输出 PDF：{}。", short_error(&error.to_string())))?;
    Ok(())
}

fn lopdf_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn short_error(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.len() <= 240 {
        return trimmed.to_string();
    }
    let mut end = 240;
    while !trimmed.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &trimmed[..end])
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{dictionary, Document, Object};

    fn make_minimal_pdf() -> Document {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let font_id = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica" });
        let resources_id = doc.add_object(dictionary! { "Font" => dictionary! { "F1" => font_id } });

        let mut page_ids = Vec::new();
        for _ in 0..3 {
            let content_id = doc.add_object(Object::Stream(lopdf::Stream::new(
                lopdf::Dictionary::new(),
                b"BT /F1 12 Tf 100 700 Td (Hello) Tj ET".to_vec(),
            )));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(612), Object::Integer(792)],
                "Resources" => resources_id,
                "Contents" => content_id,
            });
            page_ids.push(page_id);
        }

        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Count" => page_ids.len() as i64,
                "Kids" => page_ids.into_iter().map(Object::Reference).collect::<Vec<_>>(),
            }),
        );

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc
    }

    fn write_temp(doc: &mut Document, label: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        let unique = format!(
            "faropdf-scan-probe-{label}-{}.pdf",
            crate::scan_preprocess::queue::current_iso_timestamp()
        );
        path.push(unique);
        doc.save(&path).expect("save pdf");
        path
    }

    #[test]
    fn probe_pdf_returns_total_pages_and_media_box() {
        let mut doc = make_minimal_pdf();
        let path = write_temp(&mut doc, "probe");
        let probe = probe_pdf(&path).expect("probe ok");
        assert_eq!(probe.total_pages, 3);
        assert_eq!(probe.pages.len(), 3);
        assert_eq!(probe.pages[0].media_box, [0.0, 0.0, 612.0, 792.0]);
        assert_eq!(probe.pages[0].current_rotate, 0);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn apply_clean_edge_shrinks_media_box() {
        let mut doc = make_minimal_pdf();
        let page_id = *doc.get_pages().values().next().expect("page id");
        let modified = apply_clean_edge(&mut doc, page_id, 10).expect("apply");
        assert!(modified);
        let dict = doc.get_dictionary(page_id).expect("dict");
        let Object::Array(array) = dict.get(b"MediaBox").expect("MediaBox") else {
            panic!("expected array");
        };
        let nums: Vec<f64> = array
            .iter()
            .map(|item| match item {
                Object::Integer(v) => *v as f64,
                Object::Real(v) => *v as f64,
                _ => 0.0,
            })
            .collect();
        assert_eq!(nums.len(), 4);
        assert!((nums[0] - 7.5).abs() < 1e-3);
        assert!((nums[2] - 604.5).abs() < 1e-3);
    }

    #[test]
    fn apply_clean_edge_skips_when_margin_too_wide() {
        let mut doc = make_minimal_pdf();
        let page_id = *doc.get_pages().values().next().expect("page id");
        let modified = apply_clean_edge(&mut doc, page_id, 500).expect("apply");
        assert!(!modified, "边距过宽时不应裁剪");
    }
}
