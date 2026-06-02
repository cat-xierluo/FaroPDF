import { describe, expect, test } from "vitest";
import {
  createDefaultOcrQualityCheckRequest,
  prepareOcrRequest,
  sanitizeOcrError,
  suggestOcrOutputPath,
  validateOcrRequest,
} from "./defaults";

describe("OCR shared defaults", () => {
  test("prepares OCR requests with a safe new layered PDF output path", () => {
    expect(suggestOcrOutputPath("/tmp/faropdf-fixtures/source.pdf")).toBe(
      "/tmp/faropdf-fixtures/source-ocr.pdf",
    );

    const request = prepareOcrRequest({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      providerId: "local-ocrmypdf",
    });

    expect(request.outputPath).toBe("/tmp/faropdf-fixtures/source-ocr.pdf");
    expect(request.outputStrategy).toBe("new-layered-pdf");
    expect(request.qualityCheck).toEqual(createDefaultOcrQualityCheckRequest());
  });

  test("rejects same input and output path without exposing the raw path", () => {
    const validation = validateOcrRequest({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      outputPath: "/tmp/faropdf-fixtures/nested/../source.pdf",
      providerId: "local-ocrmypdf",
      outputStrategy: "new-layered-pdf",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("输出 PDF 必须是不同于原始 PDF 的新文件。");
    expect(validation.errors.join("；")).not.toContain("/tmp/faropdf-fixtures/source.pdf");
  });

  test("validates page ranges and redacts PDF paths in OCR bridge errors", () => {
    const sensitivePath = "/Users/example/Cases/case, confidential.pdf";
    const validation = validateOcrRequest({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      providerId: "local-ocrmypdf",
      outputStrategy: "new-layered-pdf",
      pageRange: "3-1",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("页码范围必须使用正整数或正整数区间，例如 1,3-5。");
    expect(sanitizeOcrError(`无法写入 ${sensitivePath}，请检查文件权限。`)).toBe(
      "无法写入 [path]，请检查文件权限。",
    );
  });

  test("rejects invalid quality check sample pages before normalizing them away", () => {
    const validation = validateOcrRequest({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      providerId: "local-ocrmypdf",
      outputStrategy: "new-layered-pdf",
      qualityCheck: {
        enabled: true,
        samplePages: [0, 2],
        keywords: [],
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("OCR 质量抽查页码必须是正整数。");
  });
});
