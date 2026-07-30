import { describe, expect, test } from "vitest";
import { classifyPdfjsException, normalizeError } from "./error";
import { friendlyMessageForCode } from "./errorMessages";

describe("friendlyMessageForCode", () => {
  test("9 个 ErrCode 各自落到预设中文文案", () => {
    expect(friendlyMessageForCode({ code: "FileNotFound", message: "x" })).toBe(
      "文件不存在或路径已变更，请重新打开 PDF 后重试。",
    );
    expect(friendlyMessageForCode({ code: "DecryptionError", message: "x" })).toBe(
      "密码错误或解密失败，请检查原密码后重试。",
    );
    expect(friendlyMessageForCode({ code: "PdfParseError", message: "x" })).toBe(
      "PDF 解析失败，文件可能已损坏或不是有效 PDF。",
    );
    expect(friendlyMessageForCode({ code: "EncryptionError", message: "x" })).toBe(
      "PDF 加密失败，请重试或换一份文件。",
    );
    expect(friendlyMessageForCode({ code: "PermissionDenied", message: "x" })).toBe(
      "权限不足，请检查文件 / 目录权限。",
    );
  });

  test("InvalidInput / IoError / NotSupported 在 message 非空时回退到原 message", () => {
    expect(friendlyMessageForCode({ code: "InvalidInput", message: "字段名不能为空" })).toBe(
      "字段名不能为空",
    );
    expect(friendlyMessageForCode({ code: "IoError", message: "磁盘已满" })).toBe("磁盘已满");
    expect(friendlyMessageForCode({ code: "NotSupported", message: "该操作未实现" })).toBe(
      "该操作未实现",
    );
  });

  test("InvalidInput / IoError / NotSupported 在 message 为空时回退到预设兜底", () => {
    expect(friendlyMessageForCode({ code: "InvalidInput", message: "" })).toBe(
      "输入有误，请检查后再试。",
    );
    expect(friendlyMessageForCode({ code: "IoError", message: "" })).toBe(
      "文件读写失败，请检查磁盘权限。",
    );
  });

  test("Unknown 在 message 为空时回退到「未知错误」", () => {
    expect(friendlyMessageForCode({ code: "Unknown", message: "" })).toBe("未知错误。");
  });
});

describe("classifyPdfjsException + normalizeError（PDF.js 异常归一化链路）", () => {
  test("InvalidPDFException 归类为 PdfParseError", () => {
    const err = new Error("Invalid PDF structure.");
    err.name = "InvalidPDFException";
    expect(classifyPdfjsException(err)).toBe("PdfParseError");
    const normalized = normalizeError(err);
    expect(normalized.code).toBe("PdfParseError");
    // 损坏 PDF 经归一化后走中文友好文案
    expect(friendlyMessageForCode(normalized)).toBe(
      "PDF 解析失败，文件可能已损坏或不是有效 PDF。",
    );
  });

  test("PasswordException 归类为 EncryptionError（为后续 M5 密码项铺路）", () => {
    const err = new Error("Password required.");
    err.name = "PasswordException";
    expect(classifyPdfjsException(err)).toBe("EncryptionError");
    expect(normalizeError(err).code).toBe("EncryptionError");
  });

  test("UnknownErrorException 归类为 Unknown", () => {
    const err = new Error("unexpected end of stream");
    err.name = "UnknownErrorException";
    expect(classifyPdfjsException(err)).toBe("Unknown");
  });

  test("普通 Error（非 PDF.js 异常）不被误归类，返回 null + Unknown", () => {
    const err = new Error("network timeout");
    expect(classifyPdfjsException(err)).toBeNull();
    expect(normalizeError(err).code).toBe("Unknown");
  });

  test("已是 AppError 形态优先原样返回，不触发 PDF.js 识别", () => {
    const appErr = { code: "PermissionDenied" as const, message: "denied" };
    expect(normalizeError(appErr)).toEqual(appErr);
  });
});
