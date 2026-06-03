import { createOcrQualityCheckService } from "./qualityCheckService";
import type { OcrQualityCheckInput, OcrQualityReport } from "../../../shared/ocr/quality";
import type { OcrTextExtractionResponse } from "../../../shared/ocr/jobQueue";

/**
 * OCR 完成后处理：把 Rust 端 `extract_ocr_text` 提取的页面文本
 * 喂给 ISS-017 质量检查服务，生成与共享契约对齐的 `OcrQualityReport`。
 *
 * 不直接修改 `OcrJob`；调用方把 `report` 写回 job 的 `quality` 字段。
 */

export interface OcrPostProcessInput {
  pages: OcrTextExtractionResponse["pages"];
  totalPages: number;
  keywords: string[];
  inputFileSizeBytes?: number;
  outputFileSizeBytes?: number;
  elapsedMs?: number;
  minTextPageRatio?: number;
  maxFileSizeRatio?: number;
  cerReferenceText?: string;
}

export interface OcrPostProcessor {
  buildReport: (input: OcrPostProcessInput) => OcrQualityReport;
  toOcrQualitySummary: (
    report: OcrQualityReport,
  ) => {
    searchedKeywords: string[];
    matchedKeywords: string[];
    textPages: number;
    emptyTextPages: number;
    fileSizeRatio?: number;
    elapsedMs?: number;
  };
}

export function createOcrPostProcessor(
  service: ReturnType<typeof createOcrQualityCheckService> = createOcrQualityCheckService(),
): OcrPostProcessor {
  return {
    buildReport(input) {
      const qualityInput: OcrQualityCheckInput = {
        pages: input.pages.map((page) => ({
          pageIndex: page.pageIndex,
          text: page.text,
        })),
        totalPages: input.totalPages,
        keywords: input.keywords,
        inputFileSizeBytes: input.inputFileSizeBytes,
        outputFileSizeBytes: input.outputFileSizeBytes,
        elapsedMs: input.elapsedMs,
        cerReferenceText: input.cerReferenceText,
        thresholds: {
          ...(input.minTextPageRatio !== undefined
            ? { minSearchablePageRatio: input.minTextPageRatio }
            : {}),
          ...(input.maxFileSizeRatio !== undefined
            ? { maxFileSizeRatio: input.maxFileSizeRatio }
            : {}),
        },
      };
      return service.check(qualityInput);
    },
    toOcrQualitySummary(report) {
      return {
        searchedKeywords: report.summary.searchedKeywords,
        matchedKeywords: report.summary.matchedKeywords,
        textPages: report.summary.textPages,
        emptyTextPages: report.summary.emptyTextPages,
        ...(report.summary.fileSizeRatio !== undefined
          ? { fileSizeRatio: report.summary.fileSizeRatio }
          : {}),
        ...(report.summary.elapsedMs !== undefined
          ? { elapsedMs: report.summary.elapsedMs }
          : {}),
      };
    },
  };
}
