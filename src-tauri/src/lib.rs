use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const SETTINGS_FILE_NAME: &str = "settings.json";

#[tauri::command]
fn read_app_settings(app_handle: AppHandle) -> Result<Option<Value>, String> {
    let settings_path = settings_file_path(&app_handle)?;
    if !settings_path.exists() {
        return Ok(None);
    }

    let contents =
        fs::read_to_string(&settings_path).map_err(|_| "无法读取应用设置文件。".to_string())?;
    let settings = serde_json::from_str::<Value>(&contents)
        .map_err(|_| "应用设置文件格式无效。".to_string())?;

    Ok(Some(sanitize_settings_value(settings)))
}

#[tauri::command]
fn write_app_settings(app_handle: AppHandle, settings: Value) -> Result<Value, String> {
    let sanitized_settings = sanitize_settings_value(settings);
    let settings_path = settings_file_path(&app_handle)?;
    let settings_dir = settings_path
        .parent()
        .ok_or_else(|| "无法定位应用设置目录。".to_string())?;

    fs::create_dir_all(settings_dir).map_err(|_| "无法创建应用设置目录。".to_string())?;
    let contents = serde_json::to_string_pretty(&sanitized_settings)
        .map_err(|_| "无法序列化应用设置。".to_string())?;
    fs::write(&settings_path, contents).map_err(|_| "无法写入应用设置文件。".to_string())?;

    Ok(sanitized_settings)
}

#[tauri::command]
fn start_scan_preprocess_job(
    request: ScanPreprocessCommandRequest,
) -> Result<ScanPreprocessCommandJob, String> {
    validate_scan_preprocess_request(&request)?;

    let input_path = PathBuf::from(request.input_path.trim());
    let output_path = resolve_scan_preprocess_output_path(
        input_path,
        request.output_path.as_ref().map(|path| PathBuf::from(path.trim())),
    )?;
    let output_path_string = output_path.to_string_lossy().to_string();
    let now = current_timestamp_string();

    Ok(ScanPreprocessCommandJob {
        id: format!("scan-preprocess-stub-{now}"),
        input_path: request.input_path,
        output_path: output_path_string.clone(),
        page_range: request.page_range,
        status: "queued".to_string(),
        options: request.options,
        progress: ScanPreprocessCommandProgress {
            stage: "queued".to_string(),
            completed_pages: 0,
            total_pages: 0,
            message: Some("等待后台扫描预处理 bridge 接入。".to_string()),
        },
        summary: ScanPreprocessCommandSummary {
            total_pages: 0,
            processed_pages: 0,
            rotated_pages: 0,
            deskewed_pages: 0,
            split_pages: 0,
            cropped_pages: 0,
            blank_edges_cleared_pages: 0,
            elapsed_ms: 0,
            output_path: output_path_string,
            preprocess_only: true,
        },
        created_at: now.clone(),
        updated_at: now,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_app_settings,
            write_app_settings,
            start_scan_preprocess_job
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn settings_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut app_config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|_| "无法定位应用设置目录。".to_string())?;
    app_config_dir.push(SETTINGS_FILE_NAME);
    Ok(app_config_dir)
}

fn sanitize_settings_value(value: Value) -> Value {
    match value {
        Value::Array(items) => {
            Value::Array(items.into_iter().map(sanitize_settings_value).collect())
        }
        Value::Object(map) => Value::Object(sanitize_settings_object(map)),
        other => other,
    }
}

fn sanitize_settings_object(map: Map<String, Value>) -> Map<String, Value> {
    map.into_iter()
        .map(|(key, value)| {
            let sanitized_value = if key == "apiKeyRef" {
                sanitize_api_key_ref_value(value)
            } else if is_sensitive_key(&key) {
                Value::String("[redacted]".to_string())
            } else {
                sanitize_settings_value(value)
            };
            (key, sanitized_value)
        })
        .collect()
}

fn sanitize_api_key_ref_value(value: Value) -> Value {
    match value {
        Value::String(secret) => Value::String(sanitize_api_key_ref(&secret)),
        other => sanitize_settings_value(other),
    }
}

fn sanitize_api_key_ref(api_key_ref: &str) -> String {
    let trimmed = api_key_ref.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if is_credential_reference(trimmed) || is_masked_secret(trimmed) {
        return trimmed.to_string();
    }

    mask_secret(trimmed)
}

fn mask_secret(secret: &str) -> String {
    let chars = secret.chars().collect::<Vec<_>>();
    if chars.len() <= 4 {
        return "***".to_string();
    }

    let prefix = chars.iter().take(4).collect::<String>();
    let suffix = chars
        .iter()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

fn is_credential_reference(value: &str) -> bool {
    const PREFIXES: [&str; 5] = [
        "keychain:",
        "env:",
        "credential:",
        "credential-ref:",
        "api-key-ref:",
    ];

    let Some(prefix) = PREFIXES.iter().find(|prefix| value.starts_with(**prefix)) else {
        return false;
    };
    let rest = &value[prefix.len()..];
    !rest.is_empty()
        && rest.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | ':' | '/' | '-')
        })
}

fn is_masked_secret(value: &str) -> bool {
    value.contains("...") || value.chars().all(|character| character == '*')
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase().replace(['_', '-'], "");
    matches!(
        normalized.as_str(),
        "apikey" | "secret" | "token" | "password" | "accesskey" | "secretkey"
    )
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandRequest {
    input_path: String,
    output_path: Option<String>,
    page_range: Option<String>,
    options: ScanPreprocessCommandOptions,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandOptions {
    enhance_scans: bool,
    detect_orientation: bool,
    deskew: bool,
    split_pages: bool,
    crop_pages: bool,
    trim_blank_edges: bool,
    output_mode: String,
    dpi: u16,
    jpeg_quality: u8,
    skew_threshold_degrees: f32,
    rotation_confidence: f32,
    max_deskew_degrees: f32,
    blank_edge_margin_px: u16,
    blank_edge_threshold: u8,
    parallel_jobs: u8,
    chunk_pages: u16,
    preserve_original_page_size: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandJob {
    id: String,
    input_path: String,
    output_path: String,
    page_range: Option<String>,
    status: String,
    options: ScanPreprocessCommandOptions,
    progress: ScanPreprocessCommandProgress,
    summary: ScanPreprocessCommandSummary,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandProgress {
    stage: String,
    completed_pages: u32,
    total_pages: u32,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanPreprocessCommandSummary {
    total_pages: u32,
    processed_pages: u32,
    rotated_pages: u32,
    deskewed_pages: u32,
    split_pages: u32,
    cropped_pages: u32,
    blank_edges_cleared_pages: u32,
    elapsed_ms: u64,
    output_path: String,
    preprocess_only: bool,
}

fn validate_scan_preprocess_request(request: &ScanPreprocessCommandRequest) -> Result<(), String> {
    let input_path = request.input_path.trim();
    if input_path.is_empty() {
        return Err("输入 PDF 路径不能为空。".to_string());
    }
    if !is_pdf_path(Path::new(input_path)) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    if let Some(page_range) = request.page_range.as_ref() {
        if !is_valid_page_range(page_range) {
            return Err("页码范围必须使用正整数或正整数区间，例如 1,3-5。".to_string());
        }
    }

    let options = &request.options;
    if options.output_mode != "preprocess-only" {
        return Err("扫描预处理第一版只支持 preprocess-only 输出。".to_string());
    }
    if !has_enabled_scan_operation(options) {
        return Err("至少需要启用一个扫描预处理动作。".to_string());
    }
    if options.dpi < 72 || options.dpi > 600 {
        return Err("DPI 必须在 72 到 600 之间。".to_string());
    }
    if options.jpeg_quality == 0 || options.jpeg_quality > 100 {
        return Err("JPEG 质量必须在 1 到 100 之间。".to_string());
    }
    if !(0.0..=1.0).contains(&options.rotation_confidence) {
        return Err("旋转置信度必须在 0 到 1 之间。".to_string());
    }
    if options.skew_threshold_degrees < 0.1 || options.skew_threshold_degrees > 5.0 {
        return Err("倾斜阈值必须在 0.1 到 5 度之间。".to_string());
    }
    if options.max_deskew_degrees < 0.3 || options.max_deskew_degrees > 15.0 {
        return Err("最大微倾斜角必须在 0.3 到 15 度之间。".to_string());
    }
    if options.parallel_jobs > 64 {
        return Err("并行处理数必须为 0 到 64；0 表示自动。".to_string());
    }
    if options.chunk_pages > 500 {
        return Err("分块页数必须为 0 到 500；0 表示不分块。".to_string());
    }
    if options.blank_edge_margin_px > 200 {
        return Err("清边保留边距必须在 0 到 200 像素之间。".to_string());
    }
    if options.blank_edge_threshold == 0 {
        return Err("空白边阈值必须在 1 到 255 之间。".to_string());
    }

    Ok(())
}

fn resolve_scan_preprocess_output_path(
    input_path: PathBuf,
    output_path: Option<PathBuf>,
) -> Result<PathBuf, String> {
    if !is_pdf_path(&input_path) {
        return Err("输入文件必须是 PDF。".to_string());
    }

    let resolved_output = output_path.unwrap_or_else(|| suggest_scan_preprocess_output_path(&input_path));
    if !is_pdf_path(&resolved_output) {
        return Err("输出文件必须是 PDF。".to_string());
    }
    if paths_are_same(&input_path, &resolved_output) {
        return Err("输出 PDF 必须是不同于原始 PDF 的新文件。".to_string());
    }

    Ok(resolved_output)
}

fn suggest_scan_preprocess_output_path(input_path: &Path) -> PathBuf {
    let stem = input_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("document");
    let output_name = format!("{stem}-preprocessed.pdf");

    input_path
        .parent()
        .map(|parent| parent.join(&output_name))
        .unwrap_or_else(|| PathBuf::from(output_name))
}

fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

fn paths_are_same(left: &Path, right: &Path) -> bool {
    normalize_path_for_compare(left) == normalize_path_for_compare(right)
}

fn normalize_path_for_compare(path: &Path) -> String {
    let normalized_separators = path.to_string_lossy().trim().replace('\\', "/");
    let (drive_prefix, path_body) = normalized_separators
        .as_bytes()
        .get(1)
        .filter(|byte| **byte == b':')
        .map(|_| (&normalized_separators[..2], &normalized_separators[2..]))
        .unwrap_or(("", normalized_separators.as_str()));
    let is_absolute = path_body.starts_with('/');
    let mut parts: Vec<&str> = Vec::new();

    for part in path_body.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            if parts.last().is_some_and(|last_part| *last_part != "..") {
                parts.pop();
            } else if !is_absolute {
                parts.push(part);
            }
            continue;
        }

        parts.push(part);
    }

    let absolute_separator = if is_absolute { "/" } else { "" };
    format!(
        "{}{}{}",
        drive_prefix.to_ascii_lowercase(),
        absolute_separator,
        parts.join("/")
    )
    .trim_end_matches('/')
    .to_ascii_lowercase()
}

fn has_enabled_scan_operation(options: &ScanPreprocessCommandOptions) -> bool {
    options.enhance_scans
        || options.detect_orientation
        || options.deskew
        || options.split_pages
        || options.crop_pages
        || options.trim_blank_edges
}

fn is_valid_page_range(raw: &str) -> bool {
    let parts = raw
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return false;
    }

    parts.into_iter().all(|part| {
        let range = part.split('-').collect::<Vec<_>>();
        if range.is_empty() || range.len() > 2 {
            return false;
        }

        let Ok(start) = range[0].parse::<u32>() else {
            return false;
        };
        let end = if range.len() == 2 {
            let Ok(end) = range[1].parse::<u32>() else {
                return false;
            };
            end
        } else {
            start
        };

        start > 0 && end >= start
    })
}

fn current_timestamp_string() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    millis.to_string()
}

#[cfg(test)]
mod scan_preprocess_tests {
    use super::*;
    use std::path::PathBuf;

    fn default_scan_options() -> ScanPreprocessCommandOptions {
        ScanPreprocessCommandOptions {
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

    #[test]
    fn resolves_default_output_path_without_overwriting_input_pdf() {
        let output = resolve_scan_preprocess_output_path(
            PathBuf::from("/tmp/faropdf-fixtures/source.pdf"),
            None,
        )
        .expect("output path");

        assert_eq!(
            output,
            PathBuf::from("/tmp/faropdf-fixtures/source-preprocessed.pdf")
        );
    }

    #[test]
    fn rejects_same_output_path_without_leaking_the_full_path() {
        let error = resolve_scan_preprocess_output_path(
            PathBuf::from("/tmp/faropdf-fixtures/./source.pdf"),
            Some(PathBuf::from("/tmp/faropdf-fixtures/nested/../source.pdf")),
        )
        .expect_err("same output path should fail");

        assert!(error.contains("输出 PDF 必须是不同于原始 PDF 的新文件。"));
        assert!(!error.contains("/tmp/faropdf-fixtures/source.pdf"));
    }

    #[test]
    fn rejects_invalid_blank_edge_threshold() {
        let mut request = ScanPreprocessCommandRequest {
            input_path: "/tmp/faropdf-fixtures/source.pdf".to_string(),
            output_path: None,
            page_range: None,
            options: default_scan_options(),
        };
        request.options.blank_edge_threshold = 0;

        let error = validate_scan_preprocess_request(&request)
            .expect_err("zero blank edge threshold should fail");

        assert_eq!(error, "空白边阈值必须在 1 到 255 之间。");
    }

    #[test]
    fn command_stub_returns_queued_job_and_safe_summary() {
        let request = ScanPreprocessCommandRequest {
            input_path: "/tmp/faropdf-fixtures/source.pdf".to_string(),
            output_path: None,
            page_range: Some("1,3-5".to_string()),
            options: default_scan_options(),
        };

        let job = start_scan_preprocess_job(request).expect("queued job");

        assert_eq!(job.status, "queued");
        assert_eq!(job.output_path, "/tmp/faropdf-fixtures/source-preprocessed.pdf");
        assert_eq!(job.progress.completed_pages, 0);
        assert_eq!(job.progress.stage, "queued");
        assert_eq!(job.summary.rotated_pages, 0);
        assert_eq!(
            job.summary.output_path,
            "/tmp/faropdf-fixtures/source-preprocessed.pdf"
        );
    }
}
