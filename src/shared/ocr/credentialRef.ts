/**
 * Frontend-side helpers for OCR API key references.
 *
 * 解析规则必须和 `src-tauri/src/ocr_credentials.rs` 中的
 * `resolve_credential_reference` 一一对应。前端只用来：
 * 1. 在 UI 中显示引用是否合规；
 * 2. 给出对应的用户操作提示（"请设置环境变量 X" 等）。
 *
 * 前端永远不读取真实 API Key；只有后端才在 `start_ocr_job` 内部
 * 通过 `std::env::var` 解析。
 */

export type CredentialReferenceKind =
  | "env"
  | "keychain"
  | "credential"
  | "credential-ref"
  | "api-key-ref"
  | "placeholder"
  | "unknown";

export interface CredentialReferenceInfo {
  raw: string;
  kind: CredentialReferenceKind;
  slot?: string;
  /** 后端是否能解析；false 时 UI 应提示用户改用 env: 形式。 */
  backendResolvable: boolean;
  /** 提示信息。 */
  hint: string;
}

const MASKED_PLACEHOLDER_PATTERN = /^(?:\*+|\*+[^*]*\*+)$/;

export function parseCredentialReference(value: string | undefined | null): CredentialReferenceInfo {
  const raw = (value ?? "").trim();
  if (raw.length === 0) {
    return {
      raw: "",
      kind: "unknown",
      backendResolvable: false,
      hint: "未配置 API Key 引用。",
    };
  }

  if (raw.includes("...") || MASKED_PLACEHOLDER_PATTERN.test(raw)) {
    return {
      raw,
      kind: "placeholder",
      backendResolvable: false,
      hint: "占位符无法用于真实请求；请改用 env:&lt;NAME&gt;。",
    };
  }

  const envMatch = /^env:([A-Za-z0-9_./:-]+)$/.exec(raw);
  if (envMatch) {
    return {
      raw,
      kind: "env",
      slot: envMatch[1],
      backendResolvable: true,
      hint: `后端会从环境变量 ${envMatch[1]} 读取 API Key。`,
    };
  }

  const keychainMatch = /^keychain:([A-Za-z0-9_./:-]+)$/.exec(raw);
  if (keychainMatch) {
    return {
      raw,
      kind: "keychain",
      slot: keychainMatch[1],
      backendResolvable: false,
      hint: `系统 Keychain 暂未集成，请改用 env:&lt;NAME&gt; 形式。`,
    };
  }

  const credentialMatch = /^credential(?:[-_]ref)?:([A-Za-z0-9_./:-]+)$/.exec(raw);
  if (credentialMatch) {
    return {
      raw,
      kind: raw.startsWith("credential-ref:") ? "credential-ref" : "credential",
      slot: credentialMatch[1],
      backendResolvable: false,
      hint: "凭证引用格式已通过校验，但当前 Tauri 进程未配置对应解析器。",
    };
  }

  const apiKeyRefMatch = /^api-key-ref:([A-Za-z0-9_./:-]+)$/.exec(raw);
  if (apiKeyRefMatch) {
    return {
      raw,
      kind: "api-key-ref",
      slot: apiKeyRefMatch[1],
      backendResolvable: false,
      hint: "凭证引用格式已通过校验，但当前 Tauri 进程未配置对应解析器。",
    };
  }

  return {
    raw,
    kind: "unknown",
    backendResolvable: false,
    hint: "apiKeyRef 必须使用凭证引用或脱敏占位。",
  };
}

export function summarizeCredentialReference(value: string | undefined | null): string {
  const info = parseCredentialReference(value);
  if (info.kind === "env" && info.slot) {
    return `env:${info.slot}`;
  }
  if (info.kind === "keychain" && info.slot) {
    return `keychain:${info.slot}（未集成）`;
  }
  if (info.kind === "credential" && info.slot) {
    return `credential:${info.slot}（未集成）`;
  }
  if (info.kind === "credential-ref" && info.slot) {
    return `credential-ref:${info.slot}（未集成）`;
  }
  if (info.kind === "api-key-ref" && info.slot) {
    return `api-key-ref:${info.slot}（未集成）`;
  }
  if (info.kind === "placeholder") {
    return "脱敏占位";
  }
  return "未配置";
}
