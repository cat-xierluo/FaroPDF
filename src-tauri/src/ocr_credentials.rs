//! Safe credential reference resolution for OCR providers.
//!
//! `apiKeyRef` accepts only references (`keychain:`, `env:`, `credential:`,
//! `credential-ref:`, `api-key-ref:`) or masked placeholders. Real secrets
//! never live in this module. Resolution failures must abort the OCR job
//! rather than dispatch requests with placeholder authorization headers.

use std::env;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialResolution {
    /// Resolution succeeded; the resolved value is not surfaced back to
    /// the front-end, only used to authorize the actual request.
    Resolved,
    /// The reference points to an `env:` slot that is currently empty.
    MissingEnvVar(String),
    /// The reference scheme is recognised but the resolver has not been
    /// wired up (e.g. system keychain). Surface this as a real error to
    /// the user, not as a silent fallback.
    UnsupportedScheme(String),
    /// The reference is not a recognised prefix and the value is empty
    /// or already a placeholder, so no real credential is available.
    NotResolvable(String),
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
        return CredentialResolution::UnsupportedScheme(format!("keychain:{rest}"));
    }

    if let Some(rest) = trimmed
        .strip_prefix("credential:")
        .or_else(|| trimmed.strip_prefix("credential-ref:"))
        .or_else(|| trimmed.strip_prefix("api-key-ref:"))
    {
        // Treat other supported schemes as opaque references that the
        // user must supply. We never read from arbitrary sources here.
        return CredentialResolution::NotResolvable(format!("…{rest}"));
    }

    CredentialResolution::NotResolvable(trimmed.to_string())
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
        // SAFETY: only used in this test process for the duration of the
        // assertion; removed immediately afterwards to keep the global
        // environment clean for sibling tests.
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
    fn reports_unsupported_scheme_for_keychain() {
        let result = resolve_credential_reference("keychain:ocr");
        assert!(matches!(result, CredentialResolution::UnsupportedScheme(scheme) if scheme == "keychain:ocr"));
    }
}
