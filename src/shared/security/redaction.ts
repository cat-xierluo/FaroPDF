import { isCredentialReference, isMaskedSecret } from "../ocr/providerSecurity";
import type { RedactedPathSummary } from "./types";

const emptyPathFingerprint = "00000000";

export function createPrivacyFingerprint(value: string): string {
  let hash = 0x811c9dc5;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function summarizeLocalPathForAudit(path: string | undefined): RedactedPathSummary {
  const trimmed = path?.trim() ?? "";
  if (!trimmed) {
    return {
      kind: "empty",
      fingerprint: emptyPathFingerprint,
      redacted: "[path:empty]",
    };
  }

  const extension = getPathExtension(trimmed);
  const kind = extension === "pdf" ? "local-pdf" : "local-path";
  const fingerprint = createPrivacyFingerprint(normalizePathForFingerprint(trimmed));
  const extensionSuffix = extension ? `.${extension}` : "";

  return {
    kind,
    fingerprint,
    extension,
    redacted: `[${kind}:${fingerprint}${extensionSuffix}]`,
  };
}

export function redactApiKeyRefForPrivacy(apiKeyRef: string | undefined): string {
  const trimmed = apiKeyRef?.trim() ?? "";
  if (!trimmed) {
    return "[not-configured]";
  }

  if (isCredentialReference(trimmed) || isMaskedSecret(trimmed)) {
    return trimmed;
  }

  return "[redacted-api-key-ref]";
}

function getPathExtension(path: string): string | undefined {
  const match = /\.([A-Za-z0-9]{1,12})(?:[?#].*)?$/.exec(path.trim());
  return match?.[1]?.toLowerCase();
}

function normalizePathForFingerprint(path: string): string {
  return path.trim().replace(/\\/g, "/");
}
