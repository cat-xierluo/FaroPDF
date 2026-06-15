/**
 * ISS-071 m4: 统一错误 schema（TypeScript 侧）
 *
 * 与 Rust 侧 `src-tauri/src/error.rs AppError` 字段对齐，前端可按 `code` 触发 i18n
 * 或 UI 分支，不再依赖字符串模糊匹配（如 SecurityPanel 当前 catch (error) 拿到的是
 * Rust `String` 错误）。
 *
 * 后续 Rust 命令应返回 `Result<T, AppError>` 而非 `Result<T, String>`，前端 invoke 拿到
 * 的 catch block 可直接 cast 为本 type。
 *
 * 参考 PDF-Guru `thirdparty/*.py` 统一 `try/except` + `cmd_output.json {status, message}`
 * 思路，FaroPDF 用结构化 schema + 直接 Tauri IPC 序列化（无需走文件）。
 */

export type ErrCode =
  | "InvalidInput"
  | "FileNotFound"
  | "PermissionDenied"
  | "PdfParseError"
  | "EncryptionError"
  | "DecryptionError"
  | "IoError"
  | "NotSupported"
  | "Unknown";

export interface AppError {
  /** 错误分类，前端按此触发 i18n / UI 分支 */
  code: ErrCode;
  /** 人类可读错误信息（已脱敏，不含完整路径 / 密码 / 密钥） */
  message: string;
  /** 附加上下文：filename / operation / hint 等键值对；前端按需展示 */
  context?: Record<string, string>;
}

/**
 * 把任意 catch 拿到的错误规范化成 AppError。
 *
 * - 已是 AppError 形态（含 `code` + `message`）→ 原样返回
 * - 字符串错误（Rust 旧 `Result<T, String>` 模式）→ 包成 `{ code: "Unknown", message: ... }`
 * - `Error` 实例 → 同上
 * - 其他 → fallback
 */
export function normalizeError(raw: unknown): AppError {
  if (raw && typeof raw === "object" && "code" in raw && "message" in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      code: (obj.code as ErrCode) ?? "Unknown",
      message: typeof obj.message === "string" ? obj.message : String(obj.message ?? ""),
      ...(obj.context && typeof obj.context === "object"
        ? { context: obj.context as Record<string, string> }
        : {}),
    };
  }
  if (typeof raw === "string") {
    return { code: "Unknown", message: raw };
  }
  if (raw instanceof Error) {
    return { code: "Unknown", message: raw.message };
  }
  return { code: "Unknown", message: String(raw ?? "Unknown error") };
}

/** 格式化 AppError 为单行展示文案。 */
export function formatError(error: AppError): string {
  const ctx = error.context && Object.keys(error.context).length > 0
    ? ` (${Object.entries(error.context)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")})`
    : "";
  return `[${error.code}] ${error.message}${ctx}`;
}
