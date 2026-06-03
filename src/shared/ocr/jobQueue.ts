/**
 * OCR job queue 共享类型。
 *
 * 与 `src-tauri/src/ocr_queue.rs` 中的 `OcrStoredJob` / `OcrStoredQualitySummary`
 * 保持同步：Rust 端 camelCase 序列化后结构与本文件 `OcrStoredJob` 等价。任务
 * 真实状态来自后端持久化文件 `ocr-jobs.json`；前端从不自己写入磁盘。
 */

export interface OcrStoredRedactedPathSummary {
  kind: "empty" | "local-path" | "local-pdf";
  fingerprint: string;
  redacted: string;
}

export interface OcrStoredQualityCheck {
  enabled: boolean;
  samplePages: number[];
  keywords: string[];
}

export interface OcrStoredQualitySummary {
  searchedKeywords: string[];
  matchedKeywords: string[];
  textPages: number;
  emptyTextPages: number;
  fileSizeRatio?: number;
  elapsedMs?: number;
}

export interface OcrStoredProgress {
  stage: string;
  completedPages: number;
  totalPages: number;
  message?: string;
}

export interface OcrStoredJob {
  id: string;
  inputPath: string;
  inputPathSummary: OcrStoredRedactedPathSummary;
  outputPath: string;
  outputPathSummary: OcrStoredRedactedPathSummary;
  pageRange?: string;
  backend: string;
  providerId: string;
  status: string;
  outputStrategy: string;
  progress: OcrStoredProgress;
  qualityCheck: OcrStoredQualityCheck;
  quality?: OcrStoredQualitySummary;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  networkConsentGranted?: boolean;
  privacyAuditRedacted?: string;
}

/**
 * 与现有 `OcrJob` 共享类型保持兼容的 job bridge DTO。本类型由后端
 * 直接序列化出来；前端 controller 只做字段归一化，不引入新的语义层。
 */
export type OcrCommandJob = OcrStoredJob;

export interface OcrTextExtractionPage {
  pageIndex: number;
  text: string;
}

export interface OcrTextExtractionResponse {
  pages: OcrTextExtractionPage[];
  totalPages: number;
  searchablePages: number;
}

export interface OcrJobFilter {
  status?: OcrStoredJob["status"] | "all";
  backend?: string;
  inputPathPrefix?: string;
  includeCompleted?: boolean;
}

export function isTerminalOcrStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isActiveOcrStatus(status: string): boolean {
  return status === "queued" || status === "running" || status === "dispatching-provider";
}

export function formatOcrBackendLabel(backend: string): string {
  switch (backend) {
    case "local-ocrmypdf":
      return "本地 ocrmypdf";
    case "legal-skills":
      return "Legal Skills";
    case "paddleocr":
      return "PaddleOCR";
    case "mineru":
      return "MinerU";
    default:
      return backend;
  }
}

export function formatOcrStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "dispatching-provider":
      return "派发中";
    case "completed":
      return "已完成";
    case "failed":
      return "已失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}
