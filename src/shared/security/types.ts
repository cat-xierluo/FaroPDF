import type { OcrOutputStrategy, OcrProviderType } from "../ocr/types";

export type OcrPrivacyNoticeVersion = "network-ocr-v1";

export interface RedactedPathSummary {
  kind: "empty" | "local-path" | "local-pdf";
  fingerprint: string;
  extension?: string;
  redacted: string;
}

export interface OcrPrivacyNotice {
  noticeVersion: OcrPrivacyNoticeVersion;
  noticeId: string;
  noticeNonce: string;
  noticeIssuedAt: string;
  expiresAt: string;
  providerId: string;
  providerType: OcrProviderType;
  providerDisplayName: string;
  backend: OcrProviderType;
  pageRangeLabel: string;
  outputPath: string;
  outputPathSummary: RedactedPathSummary;
  inputPathSummary: RedactedPathSummary;
  inputPathFingerprint: string;
  outputStrategy: OcrOutputStrategy;
  isNetworkRequired: boolean;
  originalPdfWillBeOverwritten: false;
  apiKeyRefLabel: string;
  summaryLines: string[];
}

export interface OcrNetworkConsentDecision {
  noticeVersion: OcrPrivacyNoticeVersion;
  noticeId: string;
  noticeNonce: string;
  noticeIssuedAt: string;
  expiresAt: string;
  providerId: string;
  providerType: OcrProviderType;
  backend: OcrProviderType;
  pageRangeLabel: string;
  inputPath: RedactedPathSummary;
  inputPathFingerprint: string;
  outputPath: RedactedPathSummary;
  outputPathFingerprint: string;
  outputStrategy: OcrOutputStrategy;
  isNetworkRequired: boolean;
  originalPdfWillBeOverwritten: false;
  apiKeyRefLabel: string;
  granted: boolean;
  decidedAt: string;
}

export type OcrPrivacyConsentStatus =
  | "not-required"
  | "missing"
  | "denied"
  | "mismatched"
  | "expired"
  | "granted";

export interface OcrPrivacyAuditRecord {
  schemaVersion: 1;
  id: string;
  eventType: "ocr-privacy-consent";
  noticeVersion: OcrPrivacyNoticeVersion;
  noticeId: string;
  noticeNonce: string;
  providerId: string;
  providerType: OcrProviderType;
  providerDisplayName: string;
  backend: OcrProviderType;
  pageRangeLabel: string;
  inputPath: RedactedPathSummary;
  outputPath: RedactedPathSummary;
  outputStrategy: OcrOutputStrategy;
  isNetworkRequired: boolean;
  originalPdfWillBeOverwritten: false;
  apiKeyRefLabel: string;
  consentStatus: OcrPrivacyConsentStatus;
  createdAt: string;
}
