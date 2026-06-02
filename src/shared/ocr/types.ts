export type OcrProviderType = "local-ocrmypdf" | "legal-skills" | "paddleocr" | "mineru";
export type OcrBackend = OcrProviderType;
export type OcrJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface OcrProviderConfig {
  id: string;
  type: OcrProviderType;
  displayName: string;
  endpoint?: string;
  apiKeyRef?: string;
  enabled: boolean;
  requiresNetworkConsent: boolean;
}

export interface OcrQualitySummary {
  searchedKeywords: string[];
  matchedKeywords: string[];
  textPages: number;
  emptyTextPages: number;
  fileSizeRatio?: number;
  elapsedMs?: number;
}

export interface OcrJob {
  id: string;
  inputPath: string;
  pageRange?: string;
  backend: OcrBackend;
  status: OcrJobStatus;
  outputPath?: string;
  quality?: OcrQualitySummary;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
