import type { OcrQualitySummary } from "./types";

export interface OcrQualityPageInput {
  pageIndex: number;
  text: string;
  searchableMinChars?: number;
}

export interface OcrQualityCheckInput {
  pages: OcrQualityPageInput[];
  totalPages: number;
  keywords: string[];
  inputFileSizeBytes?: number;
  outputFileSizeBytes?: number;
  elapsedMs?: number;
  cerReferenceText?: string;
  thresholds?: Partial<OcrQualityThresholds>;
}

export interface OcrQualityThresholds {
  minSearchablePageRatio: number;
  minKeywordHitRate: number;
  maxCer: number;
  maxFileSizeRatio: number;
  maxElapsedMs: number;
  searchableMinChars: number;
}

export type OcrQualityCheckName =
  | "searchable-page-ratio"
  | "keyword-hit-rate"
  | "cer"
  | "file-size-ratio"
  | "elapsed-time";

export interface OcrQualityCheckResult {
  name: OcrQualityCheckName;
  value: number;
  threshold: number;
  operator: ">=" | "<=";
  passed: boolean;
}

export interface OcrQualityKeywordHit {
  keyword: string;
  hit: boolean;
}

export interface OcrQualityProblemPage {
  pageIndex: number;
  reason: string;
}

export interface OcrQualityReport {
  totalPages: number;
  searchablePages: number;
  searchablePageRatio: number;
  keywordTotal: number;
  keywordHitRate: number | null;
  keywordHits: OcrQualityKeywordHit[];
  cer: number | null;
  fileSizeRatio: number | null;
  elapsedMs: number | null;
  checks: OcrQualityCheckResult[];
  problemPages: OcrQualityProblemPage[];
  passed: boolean;
  summary: OcrQualitySummary;
}

export function createDefaultOcrQualityThresholds(): OcrQualityThresholds {
  return {
    minSearchablePageRatio: 0.95,
    minKeywordHitRate: 0.8,
    maxCer: 0.05,
    maxFileSizeRatio: 10,
    maxElapsedMs: 600_000,
    searchableMinChars: 10,
  };
}

export function normalizeOcrQualityThresholds(
  input: Partial<OcrQualityThresholds> | undefined,
): OcrQualityThresholds {
  const defaults = createDefaultOcrQualityThresholds();
  if (!input) {
    return defaults;
  }

  return {
    minSearchablePageRatio: clamp(input.minSearchablePageRatio, 0, 1, defaults.minSearchablePageRatio),
    minKeywordHitRate: clamp(input.minKeywordHitRate, 0, 1, defaults.minKeywordHitRate),
    maxCer: clamp(input.maxCer, 0, 1, defaults.maxCer),
    maxFileSizeRatio: positiveNumber(input.maxFileSizeRatio, defaults.maxFileSizeRatio),
    maxElapsedMs: positiveNumber(input.maxElapsedMs, defaults.maxElapsedMs),
    searchableMinChars: positiveInteger(input.searchableMinChars, defaults.searchableMinChars),
  };
}

export function validateOcrQualityInput(input: OcrQualityCheckInput): string[] {
  const errors: string[] = [];

  if (!Array.isArray(input.pages)) {
    errors.push("质量检查输入缺少页面数组。");
  } else {
    const pageIndexes = new Set<number>();
    for (const page of input.pages) {
      if (!isRecord(page)) {
        errors.push("页面输入必须是对象。");
        continue;
      }
      if (typeof page.pageIndex !== "number" || !Number.isInteger(page.pageIndex) || page.pageIndex < 0) {
        errors.push(`页面索引必须是非负整数，收到 ${page.pageIndex}。`);
      }
      if (typeof page.text !== "string") {
        errors.push(`页面 ${page.pageIndex} 的文本必须是字符串。`);
      }
      if (
        page.searchableMinChars !== undefined &&
        (typeof page.searchableMinChars !== "number" ||
          !Number.isInteger(page.searchableMinChars) ||
          page.searchableMinChars <= 0)
      ) {
        errors.push(`页面 ${page.pageIndex} 的可检索字符阈值必须是正整数。`);
      }
      if (pageIndexes.has(page.pageIndex)) {
        errors.push(`页面索引 ${page.pageIndex} 重复。`);
      }
      pageIndexes.add(page.pageIndex);
    }
  }

  if (typeof input.totalPages !== "number" || !Number.isInteger(input.totalPages) || input.totalPages <= 0) {
    errors.push("总页数必须是正整数。");
  }

  if (Array.isArray(input.pages) && input.pages.length === 0) {
    errors.push("质量检查至少需要一页文本输入。");
  }

  if (Array.isArray(input.pages) && typeof input.totalPages === "number" && input.totalPages > 0) {
    const maxIndex = input.pages.reduce((max, page) => {
      if (!isRecord(page) || typeof page.pageIndex !== "number") {
        return max;
      }
      return Math.max(max, page.pageIndex);
    }, -1);
    if (maxIndex >= input.totalPages) {
      errors.push(`页面索引 ${maxIndex} 超出总页数 ${input.totalPages}。`);
    }
  }

  if (!Array.isArray(input.keywords)) {
    errors.push("质量检查关键词必须是字符串数组。");
  } else {
    for (const keyword of input.keywords) {
      if (typeof keyword !== "string" || keyword.trim().length === 0) {
        errors.push("质量检查关键词不能为空字符串。");
      }
    }
  }

  if (input.inputFileSizeBytes !== undefined && (typeof input.inputFileSizeBytes !== "number" || input.inputFileSizeBytes <= 0)) {
    errors.push("输入文件体积必须大于 0。");
  }

  if (input.outputFileSizeBytes !== undefined && (typeof input.outputFileSizeBytes !== "number" || input.outputFileSizeBytes <= 0)) {
    errors.push("输出文件体积必须大于 0。");
  }

  if (input.elapsedMs !== undefined && (typeof input.elapsedMs !== "number" || input.elapsedMs < 0)) {
    errors.push("耗时不能为负数。");
  }

  return errors;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function positiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
