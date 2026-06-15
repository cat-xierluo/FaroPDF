import { describe, expect, test } from "vitest";
import { formatError, normalizeError, type AppError } from "./error";

describe("ISS-071 m4: error schema", () => {
  test("normalizeError: 已是 AppError 形态", () => {
    const raw: AppError = {
      code: "FileNotFound",
      message: "PDF 文件不存在",
      context: { path: "[path:contract.pdf]" },
    };
    const result = normalizeError(raw);
    expect(result.code).toBe("FileNotFound");
    expect(result.message).toBe("PDF 文件不存在");
    expect(result.context).toEqual({ path: "[path:contract.pdf]" });
  });

  test("normalizeError: 字符串错误（Rust 旧 Result<T, String>）", () => {
    const result = normalizeError("密码错误或解密失败。");
    expect(result.code).toBe("Unknown");
    expect(result.message).toBe("密码错误或解密失败。");
    expect(result.context).toBeUndefined();
  });

  test("normalizeError: Error 实例", () => {
    const result = normalizeError(new Error("invoke failed"));
    expect(result.code).toBe("Unknown");
    expect(result.message).toBe("invoke failed");
  });

  test("normalizeError: 缺 code 字段的 object → fallback Unknown", () => {
    const result = normalizeError({ code: undefined, message: "x" } as unknown);
    expect(result.code).toBe("Unknown");
    expect(result.message).toBe("x");
  });

  test("normalizeError: null / undefined / 数字 → fallback", () => {
    expect(normalizeError(null)).toEqual({ code: "Unknown", message: "Unknown error" });
    expect(normalizeError(undefined)).toEqual({ code: "Unknown", message: "Unknown error" });
    expect(normalizeError(42)).toEqual({ code: "Unknown", message: "42" });
  });

  test("formatError: 含 context", () => {
    const err: AppError = {
      code: "EncryptionError",
      message: "AES-256 加密失败",
      context: { stage: "doc.save", file: "[path:contract.pdf]" },
    };
    const formatted = formatError(err);
    expect(formatted).toContain("[EncryptionError]");
    expect(formatted).toContain("AES-256 加密失败");
    expect(formatted).toContain("stage=doc.save");
    expect(formatted).toContain("file=[path:contract.pdf]");
  });

  test("formatError: 无 context", () => {
    const err: AppError = { code: "FileNotFound", message: "PDF not found" };
    expect(formatError(err)).toBe("[FileNotFound] PDF not found");
  });

  test("formatError: 空 context", () => {
    const err: AppError = { code: "Unknown", message: "x", context: {} };
    expect(formatError(err)).toBe("[Unknown] x");
  });

  test("ErrCode 联合覆盖 9 个分类", () => {
    const codes: AppError["code"][] = [
      "InvalidInput",
      "FileNotFound",
      "PermissionDenied",
      "PdfParseError",
      "EncryptionError",
      "DecryptionError",
      "IoError",
      "NotSupported",
      "Unknown",
    ];
    for (const code of codes) {
      const err = normalizeError({ code, message: "test" });
      expect(err.code).toBe(code);
    }
  });
});
