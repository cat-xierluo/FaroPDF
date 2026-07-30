import type { AnnotationSidecar, PdfAnnotationType } from "./annotation";
import type { PdfPageOperation, PdfPageOperationType } from "./types";

export type PdfExportOperationType =
  | "flatten-annotations"
  | "flatten-form"
  | "page-operations"
  | PdfOutputToolOperationType;

export type PdfOutputToolOperationType = "watermark" | "page-number" | "bates-number" | "compress";
export type PdfOutputToolStatus = "applied" | "planned";
export type PdfOutputPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PdfExportSource {
  bytes: Uint8Array;
  path?: string;
  fileName?: string;
  fingerprint?: string;
}

export type PdfExportDestination =
  | {
      type: "bytes";
    }
  | {
      type: "file";
      outputPath: string;
    };

export type PdfExportOperation =
  | PdfFlattenAnnotationsOperation
  | PdfFlattenFormOperation
  | PdfPageOperationsExportOperation
  | PdfWatermarkOperation
  | PdfPageNumberOperation
  | PdfBatesNumberOperation
  | PdfCompressionOperation
  | PdfInsertPagesOperation
  | PdfInsertBlankPagesOperation
  | PdfMergePdfsOperation
  | PdfExtractPagesOperation;

export interface PdfFlattenAnnotationsOperation {
  id: string;
  type: "flatten-annotations";
  sidecar: AnnotationSidecar;
  strategy?: PdfAnnotationFlattenStrategy;
}

export type PdfAnnotationFlattenStrategy = "plan-only" | "draw";

export type PdfAnnotationFlattenEntryStatus = "planned" | "applied" | "skipped";

export interface PdfFlattenFormOperation {
  id: string;
  type: "flatten-form";
}

export interface PdfPageOperationsExportOperation {
  id: string;
  type: "page-operations";
  operations: PdfPageOperation[];
  mode?: PdfPageOperationExportMode;
}

export type PdfPageOperationExportMode = "plan-only" | "execute";

export interface PdfWatermarkOperation {
  id: string;
  type: "watermark";
  pageIndexes?: number[];
  watermark: PdfWatermarkSpec;
}

export type PdfWatermarkSpec = PdfTextWatermarkSpec | PdfImageWatermarkSpec;

export interface PdfTextWatermarkSpec {
  kind: "text";
  text: string;
  placement?: PdfOutputPlacement;
  fontSize?: number;
  color?: string;
  opacity?: number;
  rotationDegrees?: number;
  margin?: number;
}

export interface PdfImageWatermarkSpec {
  kind: "image";
  imageBytes: Uint8Array;
  imageType: "png" | "jpg";
  placement?: PdfOutputPlacement;
  width?: number;
  height?: number;
  opacity?: number;
  rotationDegrees?: number;
  margin?: number;
}

export interface PdfPageNumberOperation {
  id: string;
  type: "page-number";
  pageIndexes?: number[];
  format?: string;
  startNumber?: number;
  placement?: PdfOutputPlacement;
  fontSize?: number;
  color?: string;
  margin?: number;
}

export interface PdfBatesNumberOperation {
  id: string;
  type: "bates-number";
  pageIndexes?: number[];
  prefix?: string;
  suffix?: string;
  startNumber: number;
  digits?: number;
  placement?: PdfOutputPlacement;
  fontSize?: number;
  color?: string;
  margin?: number;
}

export type PdfCompressionPreset =
  | "screen"
  | "ebook"
  | "print"
  | "court-upload"
  | "court-5mb"
  | "court-10mb"
  | "court-20mb"
  | "court-50mb";
export type PdfCompressionMode = "plan-only" | "apply";

export interface PdfCompressionOperation {
  id: string;
  type: "compress";
  pageIndexes?: number[];
  preset: PdfCompressionPreset;
  mode?: PdfCompressionMode;
}

export interface PdfInsertPagesOperation {
  id: string;
  type: "insert-pages";
  /** 待插入的另一份 PDF 字节流（0-based `insertAtIndex` 之后插入到主源）。 */
  insertSource: PdfExportSource;
  insertAtIndex: number;
  /** 可选：1-based 页码范围（如 "1-3"）只取该范围；省略则取全部页。 */
  pageRange?: string;
}

/**
 * ISS-NEW-M M3：插入空白页。在 `insertAtIndex`（0-based）之后插入 `count` 张空白页，
 * 默认 A4 纵向尺寸。与 insert-pages（插入已有 PDF）互补，互斥一次只允许 1 个 rewrite op。
 */
export interface PdfInsertBlankPagesOperation {
  id: string;
  type: "insert-blank-pages";
  /** 插入位置：0-based，插入到该页之后（=totalPages 时追加到末尾）。 */
  insertAtIndex: number;
  /** 插入空白页数量，正整数。 */
  count: number;
  /** 可选：页面尺寸 [width, height]（PDF points），默认 A4 纵向 [595.28, 841.89]。 */
  pageSize?: [number, number];
}

export interface PdfMergePdfsOperation {
  id: string;
  type: "merge-pdfs";
  /**
   * 多源 PDF 字节流。从 `PdfExportRequest.additionalSources` 顺序读取，
   * 与主源 `source` 按顺序拼接（主源在前，additionalSources 顺次追加）。
   * 省略则仅输出主源（不报错，warning 状态）。
   */
  /** 选填：从主源 + additionalSources 中各取哪些页，1-based 字符串（如 "1-3, 5"）。省略则全取。 */
  pageRange?: string;
}

export interface PdfExtractPagesOperation {
  id: string;
  type: "extract-pages";
  /** 1-based 页码范围字符串（如 "2-5" / "2, 4, 6" / "1-3, 5"）。必填。 */
  pageRange: string;
}

export interface PdfExportRequest {
  id: string;
  source: PdfExportSource;
  destination: PdfExportDestination;
  operations: PdfExportOperation[];
  /**
   * 合并多源 PDF 时的额外源（仅 `merge-pdfs` 使用）。数组顺序决定合并顺序。
   * `merge-pdfs` 输出 = `source` + `additionalSources[0]` + `additionalSources[1]` + ...
   */
  additionalSources?: PdfExportSource[];
  requestedAt: string;
}

export interface PdfExportFileRequest {
  id: string;
  inputPath: string;
  outputPath: string;
  operations: PdfExportOperation[];
  requestedAt: string;
  fingerprint?: string;
}

export interface PdfAnnotationFlattenPlan {
  strategy: PdfAnnotationFlattenStrategy;
  annotationCount: number;
  entries: PdfAnnotationFlattenPlanEntry[];
  /** draw 策略下：实际绘制到 PDF 的批注数（drawnCount === annotationCount - skippedCount） */
  drawnCount?: number;
  skippedCount?: number;
  /** draw 策略下：被跳过的批注 ID + 原因 */
  skipped?: Array<{ annotationId: string; type: PdfAnnotationType; reason: string }>;
  /** draw 策略下：每页绘制数量统计（key 为 pageIndex 0-based） */
  pageDrawCounts?: Record<number, number>;
  /** draw 策略下：是否做了 sidecar fingerprint 校验 */
  fingerprintChecked?: boolean;
}

export interface PdfAnnotationFlattenPlanEntry {
  annotationId: string;
  type: PdfAnnotationType;
  pageIndex: number;
  rectCount: number;
  status: PdfAnnotationFlattenEntryStatus;
}

export interface PdfFormFlatteningSummary {
  requested: boolean;
  flattened: boolean;
  fieldCountBeforeFlatten: number;
}

export interface PdfPageOperationPlan {
  mode: PdfPageOperationExportMode;
  operationCount: number;
  entries: PdfPageOperationPlanEntry[];
}

export interface PdfPageOperationPlanEntry {
  operationId: string;
  type: PdfPageOperationType;
  pageIndexes: number[];
  status: "planned" | "applied";
}

export interface PdfOutputToolPlan {
  entries: PdfOutputToolPlanEntry[];
}

export interface PdfOutputToolPlanEntry {
  operationId: string;
  type: PdfOutputToolOperationType;
  pageIndexes: number[];
  status: PdfOutputToolStatus;
  label: string;
}

export interface PdfExportSummary {
  inputPageCount: number;
  outputPageCount: number;
  operationCount: number;
  annotationPlan?: PdfAnnotationFlattenPlan;
  formFlattening?: PdfFormFlatteningSummary;
  pageOperationPlan?: PdfPageOperationPlan;
  outputToolPlan?: PdfOutputToolPlan;
  /** ISS-NEW-A: insert-pages / merge-pdfs / extract-pages 互斥改写方案 */
  rewritePlan?: PdfRewritePlan;
  /** ISS-NEW-A: insert-pages 实际插入的页数 */
  insertedPageCount?: number;
  /** ISS-NEW-A: merge-pdfs 实际追加的 additionalSources 数量 */
  mergedAdditionalSourceCount?: number;
  /** ISS-NEW-A: extract-pages 提取后输出页数（= 解析后的页码范围长度） */
  extractedPageCount?: number;
  warnings?: string[];
}

export interface PdfRewritePlan {
  operationId: string;
  type: "insert-pages" | "merge-pdfs" | "extract-pages" | "insert-blank-pages";
  pageIndexes: number[];
  status: PdfOutputToolStatus;
  label: string;
}

export interface PdfExportResult {
  id: string;
  bytes: Uint8Array;
  destination: PdfExportDestination;
  summary: PdfExportSummary;
  completedAt: string;
}
