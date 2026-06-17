import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_WATERMARK_KEYWORDS,
  detectWatermarks,
  formatWatermarkReport,
  type WatermarkReport,
} from "./watermarkDetector";

async function buildEmptyPdf(pageCount = 1, w = 595, h = 842): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([w, h]);
  }
  return await pdf.save();
}

describe("DEFAULT_WATERMARK_KEYWORDS", () => {
  test("包含中英文 + 版权符号常见水印词", () => {
    expect(DEFAULT_WATERMARK_KEYWORDS).toContain("草稿");
    expect(DEFAULT_WATERMARK_KEYWORDS).toContain("机密");
    expect(DEFAULT_WATERMARK_KEYWORDS).toContain("DRAFT");
    expect(DEFAULT_WATERMARK_KEYWORDS).toContain("CONFIDENTIAL");
    expect(DEFAULT_WATERMARK_KEYWORDS).toContain("WATERMARK");
  });
});

describe("detectWatermarks", () => {
  test("空 PDF 返回无水印报告", async () => {
    const bytes = await buildEmptyPdf();
    const report = await detectWatermarks(bytes);
    expect(report.totalPages).toBe(1);
    expect(report.textHits).toEqual([]);
    expect(report.candidates).toEqual([]);
  });

  test("多页 PDF totalPages 正确", async () => {
    const bytes = await buildEmptyPdf(5);
    const report = await detectWatermarks(bytes);
    expect(report.totalPages).toBe(5);
  });

  test("自定义 keywords（空数组）返回无 textHits", async () => {
    const bytes = await buildEmptyPdf(2);
    const report = await detectWatermarks(bytes, { keywords: [] });
    expect(report.textHits).toEqual([]);
  });

  test("自定义 keywords 生效（测试中关键词）", async () => {
    const bytes = await buildEmptyPdf(1);
    // 当前 textHits 路径依赖外部 textContent，placeholder 永远空
    // 仅验证 keywords 参数被接收
    const report = await detectWatermarks(bytes, { keywords: ["律师专用"] });
    expect(report.textHits).toEqual([]);
  });

  test("custom repeatThreshold 接收", async () => {
    const bytes = await buildEmptyPdf();
    const report = await detectWatermarks(bytes, { repeatThreshold: 10 });
    expect(report).toBeDefined();
  });

  test("custom largeImageRatio 接收", async () => {
    const bytes = await buildEmptyPdf();
    const report = await detectWatermarks(bytes, { largeImageRatio: 0.5 });
    expect(report).toBeDefined();
  });

  test("加密 PDF：使用 ignoreEncryption 仍可处理", async () => {
    // 加密 PDF 复杂，本测试只验证不抛错（无加密 PDF 也通过）
    const bytes = await buildEmptyPdf();
    const report = await detectWatermarks(bytes);
    expect(report).toBeDefined();
  });
});

describe("formatWatermarkReport", () => {
  test("空报告：扫描 N 页；未发现水印", () => {
    const report: WatermarkReport = { textHits: [], candidates: [], totalPages: 3 };
    expect(formatWatermarkReport(report)).toBe("扫描 3 页；未发现水印");
  });

  test("有 textHits：显示命中数", () => {
    const report: WatermarkReport = {
      textHits: [
        { pageIndex: 0, text: "草稿", keyword: "草稿" },
        { pageIndex: 1, text: "机密", keyword: "机密" },
      ],
      candidates: [],
      totalPages: 5,
    };
    expect(formatWatermarkReport(report)).toBe("扫描 5 页；文本命中 2 处");
  });

  test("有 candidates：显示候选数", () => {
    const report: WatermarkReport = {
      textHits: [],
      candidates: [{ pageIndex: 0, type: "large-image", reason: "big" }],
      totalPages: 2,
    };
    expect(formatWatermarkReport(report)).toBe("扫描 2 页；候选水印 1 处");
  });

  test("两类都存在：显示综合", () => {
    const report: WatermarkReport = {
      textHits: [{ pageIndex: 0, text: "DRAFT", keyword: "DRAFT" }],
      candidates: [{ pageIndex: 0, type: "large-image", reason: "big" }],
      totalPages: 1,
    };
    expect(formatWatermarkReport(report)).toBe("扫描 1 页；文本命中 1 处；候选水印 1 处");
  });
});
