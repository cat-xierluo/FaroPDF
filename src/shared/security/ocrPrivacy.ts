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
const defaultNoticeTtlMs = 10 * 60 * 1000;

export interface CreateOcrPrivacyNoticeInput {
  request: PreparedOcrRequest;
  provider: OcrProviderConfig;
  issuedAt?: string;
  expiresAt?: string;
  noticeNonce?: string;
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

export function createOcrPrivacyNotice({
  request,
  provider,
  issuedAt = new Date().toISOString(),
  expiresAt,
  noticeNonce = createNoticeNonce(),
}: CreateOcrPrivacyNoticeInput): OcrPrivacyNotice {
  const isNetworkRequired = isNetworkOcrProviderForPrivacy(provider);
  const pageRangeLabel = formatOcrPageRangeForPrivacy(request.pageRange);
  const outputPathSummary = summarizeLocalPathForAudit(request.outputPath);
  const inputPathSummary = summarizeLocalPathForAudit(request.inputPath);
  const apiKeyRefLabel = redactApiKeyRefForPrivacy(provider.apiKeyRef);
  const originalPdfWillBeOverwritten = false as const;
  const resolvedExpiresAt = expiresAt ?? createNoticeExpiry(issuedAt);
  const noticeId = createNoticeId({
    noticeNonce,
    noticeIssuedAt: issuedAt,
    expiresAt: resolvedExpiresAt,
    providerId: provider.id,
    providerType: provider.type,
    pageRangeLabel,
    inputPathFingerprint: inputPathSummary.fingerprint,
    outputPathFingerprint: outputPathSummary.fingerprint,
    outputStrategy: request.outputStrategy,
    isNetworkRequired,
    originalPdfWillBeOverwritten,
    apiKeyRefLabel,
  });

  return {
    noticeVersion: networkOcrNoticeVersion,
    noticeId,
    noticeNonce,
    noticeIssuedAt: issuedAt,
    expiresAt: resolvedExpiresAt,
    providerId: provider.id,
    providerType: provider.type,
    providerDisplayName: provider.displayName,
    backend: provider.type,
    pageRangeLabel,
    outputPath: request.outputPath,
    outputPathSummary,
    inputPathSummary,
    inputPathFingerprint: inputPathSummary.fingerprint,
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
    noticeNonce: notice.noticeNonce,
    noticeIssuedAt: notice.noticeIssuedAt,
    expiresAt: notice.expiresAt,
    providerId: notice.providerId,
    providerType: notice.providerType,
    backend: notice.backend,
    pageRangeLabel: notice.pageRangeLabel,
    inputPath: notice.inputPathSummary,
    inputPathFingerprint: notice.inputPathSummary.fingerprint,
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
    noticeNonce: notice.noticeNonce,
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
    consent.noticeNonce === notice.noticeNonce &&
    consent.noticeIssuedAt === notice.noticeIssuedAt &&
    consent.expiresAt === notice.expiresAt &&
    consent.providerId === notice.providerId &&
    consent.providerType === notice.providerType &&
    consent.backend === notice.backend &&
    consent.pageRangeLabel === notice.pageRangeLabel &&
    consent.inputPathFingerprint === notice.inputPathSummary.fingerprint &&
    consent.outputPathFingerprint === notice.outputPathSummary.fingerprint &&
    consent.outputStrategy === notice.outputStrategy &&
    consent.isNetworkRequired === notice.isNetworkRequired &&
    consent.originalPdfWillBeOverwritten === notice.originalPdfWillBeOverwritten &&
    consent.apiKeyRefLabel === notice.apiKeyRefLabel
  );
}

export function doesOcrPrivacyNoticeMatchRequest(
  notice: OcrPrivacyNotice,
  request: PreparedOcrRequest,
  provider: OcrProviderConfig,
): boolean {
  const expectedNotice = createOcrPrivacyNotice({
    request,
    provider,
    issuedAt: notice.noticeIssuedAt,
    expiresAt: notice.expiresAt,
    noticeNonce: notice.noticeNonce,
  });

  return (
    notice.noticeVersion === expectedNotice.noticeVersion &&
    notice.noticeId === expectedNotice.noticeId &&
    notice.providerId === expectedNotice.providerId &&
    notice.providerType === expectedNotice.providerType &&
    notice.backend === expectedNotice.backend &&
    notice.pageRangeLabel === expectedNotice.pageRangeLabel &&
    notice.inputPathSummary.fingerprint === expectedNotice.inputPathSummary.fingerprint &&
    notice.outputPathSummary.fingerprint === expectedNotice.outputPathSummary.fingerprint &&
    notice.outputStrategy === expectedNotice.outputStrategy &&
    notice.isNetworkRequired === expectedNotice.isNetworkRequired &&
    notice.originalPdfWillBeOverwritten === expectedNotice.originalPdfWillBeOverwritten &&
    notice.apiKeyRefLabel === expectedNotice.apiKeyRefLabel
  );
}

export function isOcrNetworkConsentExpired(consent: OcrNetworkConsentDecision, now: string): boolean {
  const nowTime = Date.parse(now);
  const expiresAtTime = Date.parse(consent.expiresAt);
  return Number.isFinite(nowTime) && Number.isFinite(expiresAtTime) && nowTime > expiresAtTime;
}

export function isNetworkOcrProviderForPrivacy(provider: OcrProviderConfig): boolean {
  return provider.requiresNetworkConsent || cloudProviderTypes.has(provider.type);
}

export function formatOcrPageRangeForPrivacy(pageRange: string | undefined): string {
  const trimmed = pageRange?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "全部页面";
}

function createNoticeId(input: {
  noticeNonce: string;
  noticeIssuedAt: string;
  expiresAt: string;
  providerId: string;
  providerType: string;
  pageRangeLabel: string;
  inputPathFingerprint: string;
  outputPathFingerprint: string;
  outputStrategy: string;
  isNetworkRequired: boolean;
  originalPdfWillBeOverwritten: boolean;
  apiKeyRefLabel: string;
}): string {
  return `ocr-notice-${createPrivacyFingerprint(JSON.stringify(input))}`;
}

function createNoticeNonce(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return createPrivacyFingerprint(`${Date.now()}|${Math.random()}`);
}

function createNoticeExpiry(issuedAt: string): string {
  const issuedAtTime = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtTime)) {
    return new Date(Date.now() + defaultNoticeTtlMs).toISOString();
  }

  return new Date(issuedAtTime + defaultNoticeTtlMs).toISOString();
}
