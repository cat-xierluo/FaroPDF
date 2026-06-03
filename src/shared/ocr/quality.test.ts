import { describe, expect, test } from "vitest";
import {
  createDefaultOcrQualityThresholds,
  normalizeOcrQualityThresholds,
  validateOcrQualityInput,
} from "./quality";

describe("OCR quality shared types", () => {
  test("provides conservative default thresholds", () => {
    const defaults = createDefaultOcrQualityThresholds();

    expect(defaults.minSearchablePageRatio).toBe(0.95);
    expect(defaults.minKeywordHitRate).toBe(0.8);
    expect(defaults.maxCer).toBe(0.05);
    expect(defaults.maxFileSizeRatio).toBe(10);
    expect(defaults.maxElapsedMs).toBe(600_000);
    expect(defaults.searchableMinChars).toBe(10);
  });

  test("normalizes partial thresholds by filling in defaults", () => {
    const normalized = normalizeOcrQualityThresholds({
      minSearchablePageRatio: 0.9,
      maxCer: 0.1,
    });

    expect(normalized.minSearchablePageRatio).toBe(0.9);
    expect(normalized.minKeywordHitRate).toBe(0.8);
    expect(normalized.maxCer).toBe(0.1);
    expect(normalized.maxFileSizeRatio).toBe(10);
    expect(normalized.maxElapsedMs).toBe(600_000);
    expect(normalized.searchableMinChars).toBe(10);
  });

  test("clamps ratio thresholds to [0, 1]", () => {
    const normalized = normalizeOcrQualityThresholds({
      minSearchablePageRatio: -0.1,
      minKeywordHitRate: 2.0,
      maxCer: -1,
    });

    expect(normalized.minSearchablePageRatio).toBe(0);
    expect(normalized.minKeywordHitRate).toBe(1);
    expect(normalized.maxCer).toBe(0);
  });

  test("falls back to defaults for non-finite values", () => {
    const defaults = createDefaultOcrQualityThresholds();
    const normalized = normalizeOcrQualityThresholds({
      minSearchablePageRatio: NaN,
      maxFileSizeRatio: Infinity,
      maxElapsedMs: -100,
      searchableMinChars: 0,
    });

    expect(normalized.minSearchablePageRatio).toBe(defaults.minSearchablePageRatio);
    expect(normalized.maxFileSizeRatio).toBe(defaults.maxFileSizeRatio);
    expect(normalized.maxElapsedMs).toBe(defaults.maxElapsedMs);
    expect(normalized.searchableMinChars).toBe(defaults.searchableMinChars);
  });

  test("returns empty array for valid quality check input", () => {
    const errors = validateOcrQualityInput({
      pages: [
        { pageIndex: 0, text: "合同第一页" },
        { pageIndex: 1, text: "第二页附件" },
      ],
      totalPages: 2,
      keywords: ["合同"],
    });

    expect(errors).toEqual([]);
  });

  test("rejects non-integer page indexes", () => {
    const errors = validateOcrQualityInput({
      pages: [{ pageIndex: -1, text: "invalid" }],
      totalPages: 1,
      keywords: [],
    });

    expect(errors).toContain("页面索引必须是非负整数，收到 -1。");
  });

  test("rejects malformed page objects", () => {
    const errors = validateOcrQualityInput({
      pages: [
        null,
        { pageIndex: 0, text: 123 },
        { pageIndex: 1, text: "valid", searchableMinChars: 0 },
      ] as unknown as Parameters<typeof validateOcrQualityInput>[0]["pages"],
      totalPages: 2,
      keywords: [],
    });

    expect(errors).toContain("页面输入必须是对象。");
    expect(errors).toContain("页面 0 的文本必须是字符串。");
    expect(errors).toContain("页面 1 的可检索字符阈值必须是正整数。");
  });

  test("rejects duplicate page indexes", () => {
    const errors = validateOcrQualityInput({
      pages: [
        { pageIndex: 0, text: "a" },
        { pageIndex: 0, text: "b" },
      ],
      totalPages: 2,
      keywords: [],
    });

    expect(errors).toContain("页面索引 0 重复。");
  });

  test("rejects page index beyond total pages", () => {
    const errors = validateOcrQualityInput({
      pages: [{ pageIndex: 5, text: "beyond" }],
      totalPages: 3,
      keywords: [],
    });

    expect(errors).toContain("页面索引 5 超出总页数 3。");
  });

  test("rejects empty keyword strings", () => {
    const errors = validateOcrQualityInput({
      pages: [{ pageIndex: 0, text: "valid page text" }],
      totalPages: 1,
      keywords: ["valid", "", "  "],
    });

    expect(errors).toContain("质量检查关键词不能为空字符串。");
  });

  test("rejects invalid file size and elapsed time", () => {
    const errors = validateOcrQualityInput({
      pages: [{ pageIndex: 0, text: "valid page text" }],
      totalPages: 1,
      keywords: [],
      inputFileSizeBytes: 0,
      outputFileSizeBytes: -100,
      elapsedMs: -1,
    });

    expect(errors).toContain("输入文件体积必须大于 0。");
    expect(errors).toContain("输出文件体积必须大于 0。");
    expect(errors).toContain("耗时不能为负数。");
  });

  test("rejects non-positive total pages and empty page input", () => {
    const errors = validateOcrQualityInput({
      pages: [],
      totalPages: 0,
      keywords: [],
    });

    expect(errors).toContain("总页数必须是正整数。");
    expect(errors).toContain("质量检查至少需要一页文本输入。");
  });
});
