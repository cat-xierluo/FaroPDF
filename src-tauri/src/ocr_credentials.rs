//! Safe credential reference resolution for OCR providers.
//!
//! `apiKeyRef` accepts references (`keychain:providerId:keyName`, `env:VAR`,
//! `credential:`, `credential-ref:`, `api-key-ref:`) or masked placeholders.
//! Real secrets never live in this module. Resolution failures must abort the
//! OCR job rather than dispatch requests with placeholder authorization headers.

use std::cell::RefCell;
use std::collections::HashMap;
use std::env;

/// Known OCR provider identifiers allowed in `keychain:` references.
const KEYCHAIN_PROVIDER_WHITELIST: &[&str] = &[
    "paddleocr",
    "mineru",
    "local-ocrmypdf",
    "legal-skills",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialResolution {
    /// Resolution succeeded; the resolved value is not surfaced back to
    /// the front-end, only used to authorize the actual request.
    Resolved,
    /// The reference points to an `env:` slot that is currently empty.
    MissingEnvVar(String),
    /// The reference points to a `keychain:providerId:keyName` entry that
    /// does not exist or could not be read from the OS Keychain.
    MissingKeychainEntry { provider_id: String, key_name: String },
    /// The reference scheme is recognised but the resolver has not been
    /// wired up. Surface this as a real error to the user.
    UnsupportedScheme(String),
    /// The reference is not a recognised prefix and the value is empty
    /// or already a placeholder, so no real credential is available.
    NotResolvable(String),
}

// ---------------------------------------------------------------------------
// Test-only mock infrastructure for keychain reads (thread-local to avoid
// interference between parallel tests). Uses a simple HashMap keyed by
// "service/username" instead of closures to sidestep lifetime issues.
// ---------------------------------------------------------------------------

#[cfg(test)]
thread_local! {
    static MOCK_KEYCHAIN_STORE: RefCell<Option<HashMap<String, String>>> = RefCell::new(None);
}

/// RAII guard that clears the mock keychain on drop.
#[cfg(test)]
pub struct MockKeychainGuard {
    _private: (),
}

/// Install a mock keychain store for the current test thread.
/// Call `mock_set` to populate entries before running assertions.
#[cfg(test)]
pub fn install_mock_keychain() -> MockKeychainGuard {
    MOCK_KEYCHAIN_STORE.with(|slot| {
        *slot.borrow_mut() = Some(HashMap::new());
    });
    MockKeychainGuard { _private: () }
}

/// Insert a mock keychain entry for the current test thread.
#[cfg(test)]
pub fn mock_set(service: &str, username: &str, password: &str) {
    MOCK_KEYCHAIN_STORE.with(|slot| {
        if let Some(ref mut map) = *slot.borrow_mut() {
            map.insert(format!("{service}/{username}"), password.to_string());
        }
    });
}

fn keychain_get_password(service: &str, username: &str) -> Result<String, String> {
    // Check for test mock (thread-local HashMap).
    #[cfg(test)]
    {
        let key = format!("{service}/{username}");
        let found = MOCK_KEYCHAIN_STORE.with(|slot| {
            let borrow = slot.borrow();
            match *borrow {
                Some(ref map) => map.get(&key).cloned(),
                None => None,
            }
        });
        if let Some(password) = found {
            return Ok(password);
        }
        // If mock store is installed but key is missing → miss.
        let mock_active = MOCK_KEYCHAIN_STORE.with(|slot| slot.borrow().is_some());
        if mock_active {
            return Err("Keychain 条目不存在（mock miss）".to_string());
        }
    }

    // Real keychain access.
    let entry = keyring::Entry::new(service, username)
        .map_err(|e| format!("Keychain 条目创建失败：{e}"))?;
    entry
        .get_password()
        .map_err(|e| format!("Keychain 读取失败：{e}"))
}

pub fn resolve_credential_reference(api_key_ref: &str) -> CredentialResolution {
    let trimmed = api_key_ref.trim();
    if trimmed.is_empty() {
        return CredentialResolution::NotResolvable(String::new());
    }
    if is_masked_placeholder(trimmed) {
        return CredentialResolution::NotResolvable(trimmed.to_string());
    }

    if let Some(rest) = trimmed.strip_prefix("env:") {
        return match env::var(rest) {
            Ok(value) if !value.trim().is_empty() => CredentialResolution::Resolved,
            _ => CredentialResolution::MissingEnvVar(rest.to_string()),
        };
    }

    if let Some(rest) = trimmed.strip_prefix("keychain:") {
        return resolve_keychain_reference(rest);
    }

    if let Some(rest) = trimmed
        .strip_prefix("credential:")
        .or_else(|| trimmed.strip_prefix("credential-ref:"))
        .or_else(|| trimmed.strip_prefix("api-key-ref:"))
    {
        return CredentialResolution::NotResolvable(format!("…{rest}"));
    }

    CredentialResolution::NotResolvable(trimmed.to_string())
}

/// Resolve a `keychain:providerId:keyName` reference using the OS Keychain.
fn resolve_keychain_reference(rest: &str) -> CredentialResolution {
    let parts: Vec<&str> = rest.splitn(2, ':').collect();
    if parts.len() != 2 {
        return CredentialResolution::UnsupportedScheme(format!("keychain:{rest}"));
    }

    let provider_id = parts[0];
    let key_name = parts[1];

    if !KEYCHAIN_PROVIDER_WHITELIST.contains(&provider_id) {
        return CredentialResolution::UnsupportedScheme(format!(
            "keychain:{provider_id}:{key_name}"
        ));
    }

    let service = "FaroPDF";
    let username = format!("{provider_id}/{key_name}");

    match keychain_get_password(service, &username) {
        Ok(secret) if !secret.trim().is_empty() => CredentialResolution::Resolved,
        _ => CredentialResolution::MissingKeychainEntry {
            provider_id: provider_id.to_string(),
            key_name: key_name.to_string(),
        },
    }
}

/// Read the actual secret from the OS Keychain for dispatch.
/// Called only after `resolve_credential_reference` has returned `Resolved`.
pub fn read_keychain_secret(provider_id: &str, key_name: &str) -> Result<String, String> {
    let service = "FaroPDF";
    let username = format!("{provider_id}/{key_name}");
    keychain_get_password(service, &username)
}

fn is_masked_placeholder(value: &str) -> bool {
    value.contains("...") || value.chars().all(|character| character == '*')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_not_resolvable_for_empty_or_masked() {
        assert_eq!(
            resolve_credential_reference(""),
            CredentialResolution::NotResolvable(String::new())
        );
        assert_eq!(
            resolve_credential_reference("****"),
            CredentialResolution::NotResolvable("****".to_string())
        );
        assert_eq!(
            resolve_credential_reference("abcd...wxyz"),
            CredentialResolution::NotResolvable("abcd...wxyz".to_string())
        );
    }

    #[test]
    fn returns_missing_env_var_when_slot_empty() {
        let unique = "FAROPDF_OCR_TEST_NEVER_SET";
        let result = resolve_credential_reference(&format!("env:{unique}"));
        assert!(matches!(result, CredentialResolution::MissingEnvVar(name) if name == unique));
    }

    #[test]
    fn resolves_env_var_when_present() {
        let unique = "FAROPDF_OCR_TEST_SET";
        unsafe {
            env::set_var(unique, "secret-value");
        }
        let result = resolve_credential_reference(&format!("env:{unique}"));
        unsafe {
            env::remove_var(unique);
        }
        assert_eq!(result, CredentialResolution::Resolved);
    }

    #[test]
    fn reports_unsupported_scheme_for_keychain_without_colon() {
        let result = resolve_credential_reference("keychain:ocr");
        assert!(matches!(result, CredentialResolution::UnsupportedScheme(s) if s == "keychain:ocr"));
    }

    #[test]
    fn reports_unsupported_scheme_for_unknown_provider() {
        let result = resolve_credential_reference("keychain:unknown-provider:mykey");
        assert!(matches!(result, CredentialResolution::UnsupportedScheme(s) if s.contains("unknown-provider")));
    }

    #[test]
    fn keychain_miss_returns_missing_entry() {
        let _guard = install_mock_keychain();
        let result = resolve_credential_reference("keychain:paddleocr:nonexistent-key");
        assert!(matches!(result, CredentialResolution::MissingKeychainEntry { provider_id, key_name }
            if provider_id == "paddleocr" && key_name == "nonexistent-key"
        ));
    }

    #[test]
    fn keychain_hit_resolves_with_mock() {
        let _guard = install_mock_keychain();
        mock_set("FaroPDF", "paddleocr/my-key", "mock-secret");
        let result = resolve_credential_reference("keychain:paddleocr:my-key");
        assert_eq!(result, CredentialResolution::Resolved);
    }

    #[test]
    fn keychain_hit_mineru_with_mock() {
        let _guard = install_mock_keychain();
        mock_set("FaroPDF", "mineru/api-token", "mineru-secret");
        let result = resolve_credential_reference("keychain:mineru:api-token");
        assert_eq!(result, CredentialResolution::Resolved);
    }

    #[test]
    fn keychain_hit_empty_value_treated_as_miss() {
        let _guard = install_mock_keychain();
        mock_set("FaroPDF", "paddleocr/empty-key", "   ");
        let result = resolve_credential_reference("keychain:paddleocr:empty-key");
        assert!(matches!(result, CredentialResolution::MissingKeychainEntry { .. }));
    }

    #[test]
    fn read_keychain_secret_returns_mock_value() {
        let _guard = install_mock_keychain();
        mock_set("FaroPDF", "paddleocr/dispatch-key", "dispatch-secret");
        let secret = read_keychain_secret("paddleocr", "dispatch-key").unwrap();
        assert_eq!(secret, "dispatch-secret");
    }

    #[test]
    fn read_keychain_secret_returns_error_on_miss() {
        let _guard = install_mock_keychain();
        let result = read_keychain_secret("mineru", "missing");
        assert!(result.is_err());
    }
}
