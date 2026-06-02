import type { AnnotationSidecar, PdfAnnotationType } from "./annotation";
import type { PdfPageOperation, PdfPageOperationType } from "./types";

export type PdfExportOperationType = "flatten-annotations" | "flatten-form" | "page-operations";

export interface PdfExportSource {
  bytes: Uint8Array;
  path?: string;
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
  | PdfPageOperationsExportOperation;

export interface PdfFlattenAnnotationsOperation {
  id: string;
  type: "flatten-annotations";
  sidecar: AnnotationSidecar;
  strategy?: PdfAnnotationFlattenStrategy;
}

export type PdfAnnotationFlattenStrategy = "plan-only";

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

export type PdfPageOperationExportMode = "plan-only";

export interface PdfExportRequest {
  id: string;
  source: PdfExportSource;
  destination: PdfExportDestination;
  operations: PdfExportOperation[];
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
}

export interface PdfAnnotationFlattenPlanEntry {
  annotationId: string;
  type: PdfAnnotationType;
  pageIndex: number;
  rectCount: number;
  status: "planned";
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
  status: "planned";
}

export interface PdfExportSummary {
  inputPageCount: number;
  outputPageCount: number;
  operationCount: number;
  annotationPlan?: PdfAnnotationFlattenPlan;
  formFlattening?: PdfFormFlatteningSummary;
  pageOperationPlan?: PdfPageOperationPlan;
  warnings?: string[];
}

export interface PdfExportResult {
  id: string;
  bytes: Uint8Array;
  destination: PdfExportDestination;
  summary: PdfExportSummary;
  completedAt: string;
}

