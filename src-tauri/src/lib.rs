use serde_json::{Map, Value};
use std::{fs, path::PathBuf};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_app_settings,
            write_app_settings
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
