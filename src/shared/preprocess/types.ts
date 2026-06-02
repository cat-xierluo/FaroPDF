export type ScanPreprocessJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ScanPreprocessOutputMode = "preprocess-only";
export type ScanPreprocessProgressStage =
  | "queued"
  | "validating"
  | "preprocessing"
  | "writing-output"
  | "completed"
  | "failed";

export interface ScanPreprocessOptions {
  enhanceScans: boolean;
  detectOrientation: boolean;
  deskew: boolean;
  splitPages: boolean;
  cropPages: boolean;
  trimBlankEdges: boolean;
  outputMode: ScanPreprocessOutputMode;
  dpi: number;
  jpegQuality: number;
  skewThresholdDegrees: number;
  rotationConfidence: number;
  maxDeskewDegrees: number;
  blankEdgeMarginPx: number;
  blankEdgeThreshold: number;
  parallelJobs: number;
  chunkPages: number;
  preserveOriginalPageSize: boolean;
}

export interface ScanPreprocessRequest {
  inputPath: string;
  outputPath?: string;
  pageRange?: string;
  options: ScanPreprocessOptions;
}

export interface ScanPreprocessProgress {
  stage: ScanPreprocessProgressStage;
  completedPages: number;
  totalPages: number;
  message?: string;
}

export interface ScanPreprocessSummary {
  totalPages: number;
  processedPages: number;
  rotatedPages: number;
  deskewedPages: number;
  splitPages: number;
  croppedPages: number;
  blankEdgesClearedPages: number;
  elapsedMs: number;
  outputPath: string;
  preprocessOnly: boolean;
}

export interface ScanPreprocessJob {
  id: string;
  inputPath: string;
  outputPath: string;
  pageRange?: string;
  status: ScanPreprocessJobStatus;
  options: ScanPreprocessOptions;
  progress: ScanPreprocessProgress;
  summary?: ScanPreprocessSummary;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
