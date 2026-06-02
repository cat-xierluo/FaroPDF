import type { OcrProviderConfig, PreparedOcrRequest } from "../../../shared/ocr/types";
import {
  createOcrPrivacyAuditRecord,
  createOcrPrivacyNotice,
  doesOcrNetworkConsentMatchNotice,
  doesOcrPrivacyNoticeMatchRequest,
  isOcrNetworkConsentExpired,
  isNetworkOcrProviderForPrivacy,
} from "../../../shared/security/ocrPrivacy";
import type { OcrPrivacyAuditRecord, OcrPrivacyNotice } from "../../../shared/security/types";

export interface OcrPrivacyConsentGuardInput {
  request: PreparedOcrRequest;
  provider: OcrProviderConfig;
  now?: string;
}

export interface OcrPrivacyConsentGuardResult {
  allowed: boolean;
  errors: string[];
  isNetworkRequired: boolean;
  notice?: OcrPrivacyNotice;
  auditRecord: OcrPrivacyAuditRecord;
}

export interface OcrPrivacyConsentGuard {
  evaluate: (input: OcrPrivacyConsentGuardInput) => OcrPrivacyConsentGuardResult;
  assert: (input: OcrPrivacyConsentGuardInput) => OcrPrivacyAuditRecord;
}

export function createOcrPrivacyConsentGuard(): OcrPrivacyConsentGuard {
  return {
    evaluate(input) {
      return evaluateOcrPrivacyConsent(input);
    },
    assert(input) {
      const result = evaluateOcrPrivacyConsent(input);
      if (!result.allowed) {
        throw new Error(result.errors.join("；"));
      }

      return result.auditRecord;
    },
  };
}

function evaluateOcrPrivacyConsent({
  request,
  provider,
  now = new Date().toISOString(),
}: OcrPrivacyConsentGuardInput): OcrPrivacyConsentGuardResult {
  const notice = request.privacyNotice ?? createOcrPrivacyNotice({ request, provider, issuedAt: now });
  const isNetworkRequired = isNetworkOcrProviderForPrivacy(provider);

  if (!isNetworkRequired) {
    return {
      allowed: true,
      errors: [],
      isNetworkRequired,
      auditRecord: createOcrPrivacyAuditRecord({
        notice,
        consentStatus: "not-required",
        createdAt: now,
      }),
    };
  }

  if (!request.privacyConsent) {
    return buildDeniedResult(notice, now, "missing", ["联网 OCR 需要本次隐私确认。"]);
  }

  if (!request.privacyNotice || !doesOcrPrivacyNoticeMatchRequest(notice, request, provider)) {
    return buildDeniedResult(notice, now, "mismatched", ["隐私确认与当前 OCR 请求不匹配。"]);
  }

  if (!request.privacyConsent.granted) {
    return buildDeniedResult(notice, now, "denied", ["联网 OCR 隐私确认未授予。"]);
  }

  if (isOcrNetworkConsentExpired(request.privacyConsent, now)) {
    return buildDeniedResult(notice, now, "expired", ["隐私确认已过期，请重新确认。"]);
  }

  if (!doesOcrNetworkConsentMatchNotice(request.privacyConsent, notice)) {
    return buildDeniedResult(notice, now, "mismatched", ["隐私确认与当前 OCR 请求不匹配。"]);
  }

  return {
    allowed: true,
    errors: [],
    isNetworkRequired,
    notice,
    auditRecord: createOcrPrivacyAuditRecord({
      notice,
      consentStatus: "granted",
      createdAt: now,
    }),
  };
}

function buildDeniedResult(
  notice: OcrPrivacyNotice,
  now: string,
  consentStatus: "missing" | "denied" | "mismatched" | "expired",
  errors: string[],
): OcrPrivacyConsentGuardResult {
  return {
    allowed: false,
    errors,
    isNetworkRequired: notice.isNetworkRequired,
    notice,
    auditRecord: createOcrPrivacyAuditRecord({
      notice,
      consentStatus,
      createdAt: now,
    }),
  };
}
