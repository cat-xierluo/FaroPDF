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

export type PdfViewMode = "continuous" | "single" | "double";
export type TextLayerStatus = "unknown" | "available" | "partial" | "missing" | "poor";
export type OcrStatus = "not-needed" | "needed" | "running" | "completed" | "failed";

export interface PdfDocumentState {
  documentId: string;
  path: string;
  name: string;
  fingerprint?: string;
  pageCount: number;
  currentPage: number;
  zoom: number;
  viewMode: PdfViewMode;
  dirty: boolean;
  textLayerStatus: TextLayerStatus;
  ocrStatus: OcrStatus;
  lastSavedAt?: string;
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
