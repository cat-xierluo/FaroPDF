import type { OcrProviderConfig, PreparedOcrRequest } from "../ocr/types";
import { createPrivacyFingerprint, redactApiKeyRefForPrivacy, summarizeLocalPathForAudit } from "./redaction";
import type {
  OcrNetworkConsentDecision,
  OcrPrivacyAuditRecord,
  OcrPrivacyConsentStatus,
  OcrPrivacyNotice,
} from "./types";

const networkOcrNoticeVersion = "network-ocr-v1" as const;
const cloudProviderTypes = new Set(["paddleocr", "mineru"]);

export interface CreateOcrPrivacyNoticeInput {
  request: PreparedOcrRequest;
  provider: OcrProviderConfig;
}

export interface CreateOcrNetworkConsentDecisionInput {
  notice: OcrPrivacyNotice;
  granted: boolean;
  decidedAt: string;
}

export interface CreateOcrPrivacyAuditRecordInput {
  notice: OcrPrivacyNotice;
  consentStatus: OcrPrivacyConsentStatus;
  createdAt: string;
}

export function createOcrPrivacyNotice({ request, provider }: CreateOcrPrivacyNoticeInput): OcrPrivacyNotice {
  const isNetworkRequired = isNetworkOcrProviderForPrivacy(provider);
  const pageRangeLabel = formatOcrPageRangeForPrivacy(request.pageRange);
  const outputPathSummary = summarizeLocalPathForAudit(request.outputPath);
  const inputPathSummary = summarizeLocalPathForAudit(request.inputPath);
  const apiKeyRefLabel = redactApiKeyRefForPrivacy(provider.apiKeyRef);
  const originalPdfWillBeOverwritten = false as const;
  const noticeId = createNoticeId({
    providerId: provider.id,
    providerType: provider.type,
    pageRangeLabel,
    outputPathFingerprint: outputPathSummary.fingerprint,
    outputStrategy: request.outputStrategy,
    isNetworkRequired,
    originalPdfWillBeOverwritten,
    apiKeyRefLabel,
  });

  return {
    noticeVersion: networkOcrNoticeVersion,
    noticeId,
    providerId: provider.id,
    providerType: provider.type,
    providerDisplayName: provider.displayName,
    backend: provider.type,
    pageRangeLabel,
    outputPath: request.outputPath,
    outputPathSummary,
    inputPathSummary,
    outputStrategy: request.outputStrategy,
    isNetworkRequired,
    originalPdfWillBeOverwritten,
    apiKeyRefLabel,
    summaryLines: [
      `Provider：${provider.displayName}（${provider.id}）`,
      `页码范围：${pageRangeLabel}`,
      `输出路径：${request.outputPath}`,
      `联网处理：${isNetworkRequired ? "是" : "否"}`,
      "原始 PDF：不会覆盖原 PDF，OCR 结果将写入新的输出文件。",
      `API Key：${apiKeyRefLabel}`,
    ],
  };
}

export function createOcrNetworkConsentDecision({
  notice,
  granted,
  decidedAt,
}: CreateOcrNetworkConsentDecisionInput): OcrNetworkConsentDecision {
  return {
    noticeVersion: notice.noticeVersion,
    noticeId: notice.noticeId,
    providerId: notice.providerId,
    providerType: notice.providerType,
    backend: notice.backend,
    pageRangeLabel: notice.pageRangeLabel,
    outputPath: notice.outputPathSummary,
    outputPathFingerprint: notice.outputPathSummary.fingerprint,
    outputStrategy: notice.outputStrategy,
    isNetworkRequired: notice.isNetworkRequired,
    originalPdfWillBeOverwritten: notice.originalPdfWillBeOverwritten,
    apiKeyRefLabel: notice.apiKeyRefLabel,
    granted,
    decidedAt,
  };
}

export function createOcrPrivacyAuditRecord({
  notice,
  consentStatus,
  createdAt,
}: CreateOcrPrivacyAuditRecordInput): OcrPrivacyAuditRecord {
  const auditFingerprint = createPrivacyFingerprint(
    [
      notice.noticeId,
      notice.providerId,
      notice.backend,
      notice.pageRangeLabel,
      notice.outputPathSummary.fingerprint,
      consentStatus,
      createdAt,
    ].join("|"),
  );

  return {
    schemaVersion: 1,
    id: `ocr-privacy-${auditFingerprint}`,
    eventType: "ocr-privacy-consent",
    noticeVersion: notice.noticeVersion,
    noticeId: notice.noticeId,
    providerId: notice.providerId,
    providerType: notice.providerType,
    providerDisplayName: notice.providerDisplayName,
    backend: notice.backend,
    pageRangeLabel: notice.pageRangeLabel,
    inputPath: notice.inputPathSummary,
    outputPath: notice.outputPathSummary,
    outputStrategy: notice.outputStrategy,
    isNetworkRequired: notice.isNetworkRequired,
    originalPdfWillBeOverwritten: notice.originalPdfWillBeOverwritten,
    apiKeyRefLabel: notice.apiKeyRefLabel,
    consentStatus,
    createdAt,
  };
}

export function doesOcrNetworkConsentMatchNotice(
  consent: OcrNetworkConsentDecision,
  notice: OcrPrivacyNotice,
): boolean {
  return (
    consent.noticeVersion === notice.noticeVersion &&
    consent.noticeId === notice.noticeId &&
    consent.providerId === notice.providerId &&
    consent.providerType === notice.providerType &&
    consent.backend === notice.backend &&
    consent.pageRangeLabel === notice.pageRangeLabel &&
    consent.outputPathFingerprint === notice.outputPathSummary.fingerprint &&
    consent.outputStrategy === notice.outputStrategy &&
    consent.isNetworkRequired === notice.isNetworkRequired &&
    consent.originalPdfWillBeOverwritten === notice.originalPdfWillBeOverwritten &&
    consent.apiKeyRefLabel === notice.apiKeyRefLabel
  );
}

export function isNetworkOcrProviderForPrivacy(provider: OcrProviderConfig): boolean {
  return provider.requiresNetworkConsent || cloudProviderTypes.has(provider.type);
}

export function formatOcrPageRangeForPrivacy(pageRange: string | undefined): string {
  const trimmed = pageRange?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "全部页面";
}

function createNoticeId(input: {
  providerId: string;
  providerType: string;
  pageRangeLabel: string;
  outputPathFingerprint: string;
  outputStrategy: string;
  isNetworkRequired: boolean;
  originalPdfWillBeOverwritten: boolean;
  apiKeyRefLabel: string;
}): string {
  return `ocr-notice-${createPrivacyFingerprint(JSON.stringify(input))}`;
}
