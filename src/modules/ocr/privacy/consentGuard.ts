import type { OcrProviderConfig, PreparedOcrRequest } from "../../../shared/ocr/types";
import {
  createOcrPrivacyAuditRecord,
  createOcrPrivacyNotice,
  doesOcrNetworkConsentMatchNotice,
  isNetworkOcrProviderForPrivacy,
} from "../../../shared/security/ocrPrivacy";
import type { OcrPrivacyAuditRecord, OcrPrivacyNotice } from "../../../shared/security/types";

export interface OcrPrivacyConsentGuardInput {
  request: PreparedOcrRequest;
  provider: OcrProviderConfig;
  now?: string;
  allowLegacyConsentFlag?: boolean;
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
  allowLegacyConsentFlag = false,
}: OcrPrivacyConsentGuardInput): OcrPrivacyConsentGuardResult {
  const notice = createOcrPrivacyNotice({ request, provider });
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

  if (request.privacyConsent) {
    if (!request.privacyConsent.granted) {
      return buildDeniedResult(notice, now, "denied", ["联网 OCR 隐私确认未授予。"]);
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

  if (allowLegacyConsentFlag && request.networkConsentGranted === true) {
    return {
      allowed: true,
      errors: [],
      isNetworkRequired,
      notice,
      auditRecord: createOcrPrivacyAuditRecord({
        notice,
        consentStatus: "legacy-granted",
        createdAt: now,
      }),
    };
  }

  return buildDeniedResult(notice, now, "missing", ["联网 OCR 需要本次隐私确认。"]);
}

function buildDeniedResult(
  notice: OcrPrivacyNotice,
  now: string,
  consentStatus: "missing" | "denied" | "mismatched",
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
