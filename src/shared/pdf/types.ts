export type {
  AnnotationDocumentRef,
  AnnotationSidecar,
  AnnotationSidecarDocumentRef,
  PdfAnnotation,
  PdfAnnotationAuthor,
  PdfAnnotationInk,
  PdfAnnotationInput,
  PdfAnnotationLine,
  PdfAnnotationPatch,
  PdfAnnotationStamp,
  PdfAnnotationStyle,
  PdfAnnotationType,
  PdfPoint,
  PdfRect,
  PdfStampName,
} from "./annotation";

export type PdfViewMode = "continuous" | "single" | "double" | "fit-width";
export type TextLayerStatus = "unknown" | "available" | "partial" | "missing" | "poor";
export type OcrStatus = "not-needed" | "needed" | "running" | "completed" | "failed";
export type PageRotation = 0 | 90 | 180 | 270;

export type ZoomPresetId = "0.5" | "0.75" | "1" | "1.25" | "1.5" | "2" | "fit-width" | "fit-page";

export interface ZoomPreset {
  id: ZoomPresetId;
  /** 预设值：固定缩放为数字，自动模式为 "fit-width" / "fit-page" */
  kind: "fixed" | "fit-width" | "fit-page";
  /** 固定缩放时使用；自动模式为 null */
  value: number | null;
  label: string;
}

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  { id: "0.5", kind: "fixed", value: 0.5, label: "50%" },
  { id: "0.75", kind: "fixed", value: 0.75, label: "75%" },
  { id: "1", kind: "fixed", value: 1, label: "100%" },
  { id: "1.25", kind: "fixed", value: 1.25, label: "125%" },
  { id: "1.5", kind: "fixed", value: 1.5, label: "150%" },
  { id: "2", kind: "fixed", value: 2, label: "200%" },
  { id: "fit-width", kind: "fit-width", value: null, label: "适合宽度" },
  { id: "fit-page", kind: "fit-page", value: null, label: "适合页面" },
] as const;

export interface PdfDocumentState {
  documentId: string;
  path: string;
  name: string;
  fingerprint?: string;
  pageCount: number;
  currentPage: number;
  zoom: number;
  viewMode: PdfViewMode;
  rotation: PageRotation;
  dirty: boolean;
  textLayerStatus: TextLayerStatus;
  ocrStatus: OcrStatus;
  lastSavedAt?: string;
}

/** 持久化的阅读会话：用于恢复上次阅读位置 */
export interface ReaderSession {
  fingerprint: string;
  currentPage: number;
  zoom: number;
  viewMode: PdfViewMode;
  rotation: PageRotation;
  savedAt: string;
}

export interface PdfPageViewport {
  pageIndex: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  scale: number;
}

export type PdfPageOperationType =
  | "rotate"
  | "delete"
  | "reorder"
  | "insert"
  | "extract"
  | "merge"
  | "crop"
  | "split-scan"
  | "number";

export interface PdfPageOperation {
  id: string;
  type: PdfPageOperationType;
  pageIndexes: number[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export type PdfExportJobType =
  | "flatten-annotations"
  | "flatten-form"
  | "watermark"
  | "page-number"
  | "bates-number"
  | "compress"
  | "page-operations";

export type PdfExportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface PdfExportJob {
  id: string;
  type: PdfExportJobType;
  inputPath: string;
  outputPath?: string;
  status: PdfExportJobStatus;
  payload: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
