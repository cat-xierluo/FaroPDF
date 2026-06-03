import { describe, expect, test } from "vitest";
import { createOcrPostProcessor } from "./ocrPostProcessor";

describe("OcrPostProcessor", () => {
  test("builds a quality report from extracted text", () => {
    const processor = createOcrPostProcessor();
    const report = processor.buildReport({
      pages: [
        { pageIndex: 0, text: "合同第一页约定付款义务，按时履行" },
        { pageIndex: 1, text: "第二页附件目录，包含完整合同清单" },
      ],
      totalPages: 2,
      keywords: ["合同", "付款"],
      inputFileSizeBytes: 1_000_000,
      outputFileSizeBytes: 2_500_000,
      elapsedMs: 30_000,
      minTextPageRatio: 0.9,
      maxFileSizeRatio: 5,
    });

    expect(report.searchablePages).toBe(2);
    expect(report.searchablePageRatio).toBe(1);
    expect(report.keywordHitRate).toBe(1);
    expect(report.fileSizeRatio).toBe(2.5);
    expect(report.passed).toBe(true);
  });

  test("toOcrQualitySummary preserves only the stable fields", () => {
    const processor = createOcrPostProcessor();
    const report = processor.buildReport({
      pages: [{ pageIndex: 0, text: "判决书认定合同有效，应继续履行" }],
      totalPages: 1,
      keywords: ["判决"],
    });
    const summary = processor.toOcrQualitySummary(report);
    expect(summary.searchedKeywords).toEqual(["判决"]);
    expect(summary.matchedKeywords).toEqual(["判决"]);
    expect(summary.textPages).toBe(1);
  });

  test("forwards minTextPageRatio and maxFileSizeRatio to thresholds", () => {
    const processor = createOcrPostProcessor();
    const report = processor.buildReport({
      pages: [{ pageIndex: 0, text: "判决书继续认定双方权利义务" }],
      totalPages: 5,
      keywords: [],
      minTextPageRatio: 0.5,
      maxFileSizeRatio: 2,
    });
    expect(report.checks.some((c) => c.name === "searchable-page-ratio")).toBe(true);
    expect(report.checks.find((c) => c.name === "searchable-page-ratio")?.threshold).toBe(0.5);
  });
});
