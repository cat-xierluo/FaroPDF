import type { OcrNetworkConsentDecision, OcrPrivacyAuditRecord } from "../security/types";

export type OcrProviderType = "local-ocrmypdf" | "legal-skills" | "paddleocr" | "mineru";
export type OcrBackend = OcrProviderType;
export type OcrJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type OcrOutputStrategy = "new-layered-pdf" | "text-sidecar" | "quality-check-only";
export type OcrJobProgressStage =
  | "queued"
  | "validating"
  | "dispatching-provider"
  | "running-provider"
  | "writing-output"
  | "quality-check"
  | "completed"
  | "failed";

export interface OcrProviderConfig {
  id: string;
  type: OcrProviderType;
  displayName: string;
  endpoint?: string;
  apiKeyRef?: string;
  enabled: boolean;
  requiresNetworkConsent: boolean;
}

export interface OcrPageRangeSegment {
  startPage: number;
  endPage: number;
}

export interface OcrPageRange {
  raw: string;
  segments: OcrPageRangeSegment[];
}

export interface OcrQualityCheckRequest {
  enabled: boolean;
  samplePages: number[];
  keywords: string[];
  minTextPageRatio?: number;
  maxFileSizeRatio?: number;
}

export interface OcrQualitySummary {
  searchedKeywords: string[];
  matchedKeywords: string[];
  textPages: number;
  emptyTextPages: number;
  fileSizeRatio?: number;
  elapsedMs?: number;
}

export interface OcrRequest {
  inputPath: string;
  outputPath?: string;
  pageRange?: string;
  providerId: string;
  outputStrategy?: OcrOutputStrategy;
  networkConsentGranted?: boolean;
  privacyConsent?: OcrNetworkConsentDecision;
  qualityCheck?: OcrQualityCheckRequest;
}

export interface PreparedOcrRequest extends OcrRequest {
  outputPath: string;
  outputStrategy: OcrOutputStrategy;
  qualityCheck: OcrQualityCheckRequest;
}

export interface OcrProviderBridgeRequest extends PreparedOcrRequest {
  provider: OcrProviderConfig;
  networkConsentGranted: boolean;
  privacyAuditRecord?: OcrPrivacyAuditRecord;
}

export interface OcrJobProgress {
  stage: OcrJobProgressStage;
  completedPages: number;
  totalPages: number;
  message?: string;
  providerMessage?: string;
}

export interface OcrJob {
  id: string;
  inputPath: string;
  pageRange?: string;
  backend: OcrBackend;
  providerId?: string;
  status: OcrJobStatus;
  outputStrategy?: OcrOutputStrategy;
  outputPath?: string;
  progress: OcrJobProgress;
  qualityCheck?: OcrQualityCheckRequest;
  quality?: OcrQualitySummary;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
