import type { OcrQualitySummary } from "../../../shared/ocr/types";
import {
  normalizeOcrQualityThresholds,
  validateOcrQualityInput,
  type OcrQualityCheckInput,
  type OcrQualityCheckResult,
  type OcrQualityKeywordHit,
  type OcrQualityProblemPage,
  type OcrQualityReport,
} from "../../../shared/ocr/quality";

export interface OcrQualityCheckService {
  check: (input: OcrQualityCheckInput) => OcrQualityReport;
}

export function createOcrQualityCheckService(): OcrQualityCheckService {
  return {
    check(input) {
      return runQualityCheck(input);
    },
  };
}

function runQualityCheck(input: OcrQualityCheckInput): OcrQualityReport {
  const validationErrors = validateOcrQualityInput(input);
  if (validationErrors.length > 0) {
    throw new Error(`OCR 质量检查输入无效：${validationErrors.join("；")}`);
  }

  const thresholds = normalizeOcrQualityThresholds(input.thresholds);
  const searchableMinChars = thresholds.searchableMinChars;

  const searchablePages = countSearchablePages(input.pages, searchableMinChars);
  const searchablePageRatio = input.totalPages > 0 ? searchablePages / input.totalPages : 0;

  const keywords = normalizeKeywords(input.keywords);
  const keywordHits = computeKeywordHits(input.pages, keywords);
  const keywordHitCount = keywordHits.filter((h) => h.hit).length;
  const keywordHitRate = keywordHits.length > 0 ? keywordHitCount / keywordHits.length : null;

  const fullText = extractFullText(input.pages);
  const cer = computeCer(input.cerReferenceText, fullText);

  const fileSizeRatio = computeFileSizeRatio(input.inputFileSizeBytes, input.outputFileSizeBytes);
  const elapsedMs = input.elapsedMs ?? null;

  const problemPages = identifyProblemPages(input.pages, searchableMinChars, keywords);

  const checks: OcrQualityCheckResult[] = [];
  addThresholdCheck(checks, "searchable-page-ratio", searchablePageRatio, thresholds.minSearchablePageRatio, ">=");

  if (keywordHitRate !== null) {
    addThresholdCheck(checks, "keyword-hit-rate", keywordHitRate, thresholds.minKeywordHitRate, ">=");
  }

  if (cer !== null) {
    addThresholdCheck(checks, "cer", cer, thresholds.maxCer, "<=");
  }

  if (fileSizeRatio !== null) {
    addThresholdCheck(checks, "file-size-ratio", fileSizeRatio, thresholds.maxFileSizeRatio, "<=");
  }

  if (elapsedMs !== null) {
    addThresholdCheck(checks, "elapsed-time", elapsedMs, thresholds.maxElapsedMs, "<=");
  }

  const passed = checks.length > 0 ? checks.every((c) => c.passed) : true;

  const emptyTextPages = input.pages.filter((p) => !isPageSearchable(p, searchableMinChars)).length;

  const summary: OcrQualitySummary = {
    searchedKeywords: keywords,
    matchedKeywords: keywordHits.filter((h) => h.hit).map((h) => h.keyword),
    textPages: searchablePages,
    emptyTextPages,
    fileSizeRatio: fileSizeRatio ?? undefined,
    elapsedMs: elapsedMs ?? undefined,
  };

  return {
    totalPages: input.totalPages,
    searchablePages,
    searchablePageRatio,
    keywordTotal: keywordHits.length,
    keywordHitRate,
    keywordHits,
    cer,
    fileSizeRatio,
    elapsedMs,
    checks,
    problemPages,
    passed,
    summary,
  };
}

function countSearchablePages(pages: OcrQualityCheckInput["pages"], minChars: number): number {
  return pages.filter((page) => isPageSearchable(page, minChars)).length;
}

function isPageSearchable(page: { text: string; searchableMinChars?: number }, minChars: number): boolean {
  const threshold = page.searchableMinChars ?? minChars;
  return countSearchableCharacters(page.text) >= threshold;
}

function countSearchableCharacters(text: string): number {
  return (text || "").replace(/\s+/g, "").length;
}

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map((keyword) => keyword.trim());
}

function computeKeywordHits(
  pages: OcrQualityCheckInput["pages"],
  keywords: string[],
): OcrQualityKeywordHit[] {
  const fullText = extractFullText(pages);
  const normalizedFullText = fullText.toLocaleLowerCase();

  return keywords.map((keyword) => ({
    keyword,
    hit: normalizedFullText.includes(keyword.trim().toLocaleLowerCase()),
  }));
}

function extractFullText(pages: OcrQualityCheckInput["pages"]): string {
  return pages.map((page) => page.text || "").join("\n");
}

function computeCer(referenceText: string | undefined, outputText: string): number | null {
  if (!referenceText) {
    return null;
  }

  const refNorm = normalizeForCer(referenceText);
  const outNorm = normalizeForCer(outputText);

  if (refNorm.length === 0) {
    return null;
  }

  const distance = levenshteinDistance(outNorm, refNorm);
  return distance / refNorm.length;
}

function normalizeForCer(text: string): string {
  return (text || "").replace(/\s+/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const insertCost = curr[j - 1] + 1;
      const deleteCost = prev[j] + 1;
      const replaceCost = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      curr.push(Math.min(insertCost, deleteCost, replaceCost));
    }
    prev = curr;
  }

  return prev[b.length];
}

function computeFileSizeRatio(
  inputBytes: number | undefined,
  outputBytes: number | undefined,
): number | null {
  if (typeof inputBytes !== "number" || inputBytes <= 0) return null;
  if (typeof outputBytes !== "number" || outputBytes <= 0) return null;
  return outputBytes / inputBytes;
}

function identifyProblemPages(
  pages: OcrQualityCheckInput["pages"],
  searchableMinChars: number,
  keywords: string[],
): OcrQualityProblemPage[] {
  const problems: OcrQualityProblemPage[] = [];
  const normalizedKeywords = keywords.map((k) => k.trim().toLocaleLowerCase()).filter((k) => k.length > 0);

  for (const page of pages) {
    const reasons: string[] = [];

    if (!isPageSearchable(page, searchableMinChars)) {
      reasons.push("页面文字不足，可能未成功 OCR。");
    }

    if (normalizedKeywords.length > 0) {
      const pageText = (page.text || "").toLocaleLowerCase();
      const missingKeywords = normalizedKeywords.filter((kw) => !pageText.includes(kw));
      if (missingKeywords.length === normalizedKeywords.length && pageText.length > 0) {
        reasons.push(`所有关键词均未在本页命中。`);
      }
    }

    if (reasons.length > 0) {
      problems.push({ pageIndex: page.pageIndex, reason: reasons.join(" ") });
    }
  }

  return problems;
}

function addThresholdCheck(
  checks: OcrQualityCheckResult[],
  name: OcrQualityCheckResult["name"],
  value: number,
  threshold: number,
  operator: OcrQualityCheckResult["operator"],
): void {
  const passed = operator === ">=" ? value >= threshold : value <= threshold;
  checks.push({ name, value, threshold, operator, passed });
}
