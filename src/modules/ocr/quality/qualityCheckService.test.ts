import { describe, expect, test } from "vitest";
import type { OcrQualityCheckInput } from "../../../shared/ocr/quality";
import { createOcrQualityCheckService } from "./qualityCheckService";

function pageInput(pageIndex: number, text: string): { pageIndex: number; text: string } {
  return { pageIndex, text };
}

function makeInput(overrides: Partial<OcrQualityCheckInput> = {}): OcrQualityCheckInput {
  return {
    pages: [
      pageInput(0, "合同第一页约定付款义务，甲方应按时付款。"),
      pageInput(1, "第二页是附件目录，包含合同附件清单。"),
      pageInput(2, "判决书再次提到合同履行，乙方已按合同完成交付。"),
    ],
    totalPages: 3,
    keywords: ["合同", "付款"],
    inputFileSizeBytes: 1_000_000,
    outputFileSizeBytes: 2_500_000,
    elapsedMs: 30_000,
    ...overrides,
  };
}

describe("OcrQualityCheckService", () => {
  test("produces a passing report for fully searchable pages with keyword hits", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(makeInput());

    expect(report.totalPages).toBe(3);
    expect(report.searchablePages).toBe(3);
    expect(report.searchablePageRatio).toBe(1);
    expect(report.keywordTotal).toBe(2);
    expect(report.keywordHitRate).toBe(1);
    expect(report.keywordHits).toEqual([
      { keyword: "合同", hit: true },
      { keyword: "付款", hit: true },
    ]);
    expect(report.fileSizeRatio).toBe(2.5);
    expect(report.elapsedMs).toBe(30_000);
    expect(report.passed).toBe(true);
    expect(report.problemPages).toEqual([]);
    expect(report.summary.searchedKeywords).toEqual(["合同", "付款"]);
    expect(report.summary.matchedKeywords).toEqual(["合同", "付款"]);
    expect(report.summary.textPages).toBe(3);
    expect(report.summary.emptyTextPages).toBe(0);
    expect(report.summary.fileSizeRatio).toBe(2.5);
    expect(report.summary.elapsedMs).toBe(30_000);
  });

  test("fails when searchable page ratio is below threshold", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          pageInput(0, "可检索文字页内容足够长"),
          pageInput(1, ""),
          pageInput(2, ""),
        ],
        keywords: [],
      }),
    );

    expect(report.searchablePages).toBe(1);
    expect(report.searchablePageRatio).toBeCloseTo(1 / 3);
    expect(report.passed).toBe(false);

    const ratioCheck = report.checks.find((c) => c.name === "searchable-page-ratio");
    expect(ratioCheck?.passed).toBe(false);
    expect(ratioCheck?.value).toBeCloseTo(1 / 3);
  });

  test("fails when keyword hit rate is below threshold", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [pageInput(0, "只有部分内容")],
        totalPages: 1,
        keywords: ["不存在关键词", "另一个缺失词"],
      }),
    );

    expect(report.keywordHitRate).toBe(0);
    expect(report.passed).toBe(false);

    const keywordCheck = report.checks.find((c) => c.name === "keyword-hit-rate");
    expect(keywordCheck?.passed).toBe(false);
  });

  test("reports keyword hits with case-insensitive matching", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [pageInput(0, "Contract Agreement PAYMENT")],
        totalPages: 1,
        keywords: ["contract", "payment"],
      }),
    );

    expect(report.keywordHits).toEqual([
      { keyword: "contract", hit: true },
      { keyword: "payment", hit: true },
    ]);
  });

  test("trims keywords before matching and reporting", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [pageInput(0, "合同付款义务已经完整识别")],
        totalPages: 1,
        keywords: [" 合同 ", " 付款"],
      }),
    );

    expect(report.keywordHits).toEqual([
      { keyword: "合同", hit: true },
      { keyword: "付款", hit: true },
    ]);
    expect(report.summary.searchedKeywords).toEqual(["合同", "付款"]);
  });

  test("computes CER when reference text is provided", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [pageInput(0, "合同甲方签署")],
        totalPages: 1,
        keywords: [],
        cerReferenceText: "合同乙方签署",
      }),
    );

    expect(report.cer).not.toBeNull();
    expect(report.cer!).toBeGreaterThan(0);
    expect(report.cer!).toBeLessThan(1);

    const cerCheck = report.checks.find((c) => c.name === "cer");
    expect(cerCheck).toBeDefined();
    expect(cerCheck!.value).toBe(report.cer);
  });

  test("reports CER as 0 for identical text", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [pageInput(0, "完全一致的文本")],
        totalPages: 1,
        keywords: [],
        cerReferenceText: "完全一致的文本",
      }),
    );

    expect(report.cer).toBe(0);
  });

  test("skips CER check when no reference text is provided", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(makeInput({ keywords: [] }));

    expect(report.cer).toBeNull();
    expect(report.checks.find((c) => c.name === "cer")).toBeUndefined();
  });

  test("fails when file size ratio exceeds threshold", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        inputFileSizeBytes: 100,
        outputFileSizeBytes: 2_000,
        keywords: [],
      }),
    );

    expect(report.fileSizeRatio).toBe(20);

    const sizeCheck = report.checks.find((c) => c.name === "file-size-ratio");
    expect(sizeCheck?.passed).toBe(false);
  });

  test("skips file size check when input or output size is missing", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        inputFileSizeBytes: undefined,
        outputFileSizeBytes: 2_000,
        keywords: [],
      }),
    );

    expect(report.fileSizeRatio).toBeNull();
    expect(report.checks.find((c) => c.name === "file-size-ratio")).toBeUndefined();
  });

  test("fails when elapsed time exceeds threshold", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        elapsedMs: 700_000,
        keywords: [],
      }),
    );

    const timeCheck = report.checks.find((c) => c.name === "elapsed-time");
    expect(timeCheck?.passed).toBe(false);
  });

  test("skips elapsed time check when not provided", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({ elapsedMs: undefined, keywords: [] }),
    );

    expect(report.elapsedMs).toBeNull();
    expect(report.checks.find((c) => c.name === "elapsed-time")).toBeUndefined();
  });

  test("identifies problem pages with insufficient text", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          pageInput(0, "合同第一页已经包含足够多文字"),
          pageInput(1, "短"),
          pageInput(2, ""),
        ],
        keywords: [],
      }),
    );

    expect(report.problemPages).toHaveLength(2);
    expect(report.problemPages[0].pageIndex).toBe(1);
    expect(report.problemPages[0].reason).toContain("文字不足");
    expect(report.problemPages[1].pageIndex).toBe(2);
  });

  test("identifies problem pages where all keywords are missing", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          pageInput(0, "有文字但不含关键词"),
          pageInput(1, "合同第一页付款义务"),
        ],
        totalPages: 2,
        keywords: ["合同", "付款"],
      }),
    );

    const problemPage0 = report.problemPages.find((p) => p.pageIndex === 0);
    expect(problemPage0).toBeDefined();
    expect(problemPage0!.reason).toContain("关键词");
  });

  test("respects per-page searchableMinChars override", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          { pageIndex: 0, text: "12345", searchableMinChars: 3 },
          { pageIndex: 1, text: "12", searchableMinChars: 3 },
        ],
        totalPages: 2,
        keywords: [],
      }),
    );

    expect(report.searchablePages).toBe(1);
    expect(report.problemPages).toHaveLength(1);
    expect(report.problemPages[0].pageIndex).toBe(1);
  });

  test("uses custom thresholds from input", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          pageInput(0, "文字足够"),
          pageInput(1, "文字足够"),
        ],
        totalPages: 2,
        keywords: ["文字"],
        thresholds: {
          minSearchablePageRatio: 1.0,
          minKeywordHitRate: 1.0,
          maxFileSizeRatio: 1.5,
          maxElapsedMs: 10_000,
        },
        inputFileSizeBytes: 100,
        outputFileSizeBytes: 200,
        elapsedMs: 15_000,
      }),
    );

    expect(report.passed).toBe(false);

    const sizeCheck = report.checks.find((c) => c.name === "file-size-ratio");
    expect(sizeCheck?.passed).toBe(false);

    const timeCheck = report.checks.find((c) => c.name === "elapsed-time");
    expect(timeCheck?.passed).toBe(false);
  });

  test("passes when all checks pass with default thresholds", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(
      makeInput({
        pages: [
          pageInput(0, "合同全文可检索，包含多个关键词。"),
          pageInput(1, "附件目录也有足够文字内容。"),
        ],
        totalPages: 2,
        keywords: ["合同", "文字"],
        inputFileSizeBytes: 1_000_000,
        outputFileSizeBytes: 2_000_000,
        elapsedMs: 1_000,
      }),
    );

    expect(report.passed).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  test("rejects empty pages array with zero total pages", () => {
    const service = createOcrQualityCheckService();

    expect(() =>
      service.check({
        pages: [],
        totalPages: 0,
        keywords: [],
      }),
    ).toThrow("OCR 质量检查输入无效");
  });

  test("summary matches OcrQualitySummary contract", () => {
    const service = createOcrQualityCheckService();
    const report = service.check(makeInput());

    expect(report.summary).toEqual({
      searchedKeywords: ["合同", "付款"],
      matchedKeywords: ["合同", "付款"],
      textPages: 3,
      emptyTextPages: 0,
      fileSizeRatio: 2.5,
      elapsedMs: 30_000,
    });
  });
});
