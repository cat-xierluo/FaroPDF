import { describe, expect, test } from "vitest";
import {
  createDefaultScanPreprocessOptions,
  sanitizeScanPreprocessError,
  suggestScanPreprocessOutputPath,
  validateScanPreprocessRequest,
} from "./defaults";
import type { ScanPreprocessRequest } from "./types";

describe("scan preprocess defaults", () => {
  test("uses conservative preprocess-only defaults from the scan pipeline", () => {
    const options = createDefaultScanPreprocessOptions();

    expect(options.outputMode).toBe("preprocess-only");
    expect(options.enhanceScans).toBe(true);
    expect(options.detectOrientation).toBe(true);
    expect(options.deskew).toBe(true);
    expect(options.splitPages).toBe(false);
    expect(options.cropPages).toBe(false);
    expect(options.trimBlankEdges).toBe(false);
    expect(options.dpi).toBe(300);
    expect(options.jpegQuality).toBe(90);
    expect(options.skewThresholdDegrees).toBe(0.3);
    expect(options.rotationConfidence).toBe(0.5);
    expect(options.maxDeskewDegrees).toBe(5);
    expect(options.parallelJobs).toBe(1);
    expect(options.chunkPages).toBe(0);
  });

  test("suggests a new PDF path without overwriting the original", () => {
    expect(suggestScanPreprocessOutputPath("/matter/evidence.pdf")).toBe("/matter/evidence-preprocessed.pdf");
    expect(suggestScanPreprocessOutputPath("/matter/evidence.PDF")).toBe("/matter/evidence-preprocessed.pdf");
    expect(suggestScanPreprocessOutputPath("evidence")).toBe("evidence-preprocessed.pdf");
  });

  test("validates numeric bounds, page ranges, and destructive output paths", () => {
    const request: ScanPreprocessRequest = {
      inputPath: "/secret/case/evidence.pdf",
      outputPath: "/secret/case/evidence.pdf",
      pageRange: "0,3-1",
      options: {
        ...createDefaultScanPreprocessOptions(),
        dpi: 20,
        jpegQuality: 101,
        rotationConfidence: 1.2,
        skewThresholdDegrees: 0,
        maxDeskewDegrees: 16,
        parallelJobs: -1,
        chunkPages: -2,
      },
    };

    const validation = validateScanPreprocessRequest(request);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "输出 PDF 必须是不同于原始 PDF 的新文件。",
        "页码范围必须使用正整数或正整数区间，例如 1,3-5。",
        "DPI 必须在 72 到 600 之间。",
        "JPEG 质量必须在 1 到 100 之间。",
        "旋转置信度必须在 0 到 1 之间。",
        "倾斜阈值必须在 0.1 到 5 度之间。",
        "最大微倾斜角必须在 0.3 到 15 度之间。",
        "并行处理数必须为 0 到 64；0 表示自动。",
        "分块页数必须为 0 到 500；0 表示不分块。",
      ]),
    );
    expect(validation.errors.join(" ")).not.toContain("/secret/case/evidence.pdf");
  });

  test("sanitizes backend errors without leaking full local paths", () => {
    const error = sanitizeScanPreprocessError(
      "无法处理 /Users/maoking/案件/商业秘密/客户A证据.pdf，因为输出 /tmp/raw-output.pdf 不可写。",
    );

    expect(error).toBe("无法处理 [path]，因为输出 [path] 不可写。");
  });
});
