import { describe, expect, test } from "vitest";
import type { OcrProviderConfig, PreparedOcrRequest } from "../../../shared/ocr/types";
import { createOcrNetworkConsentDecision, createOcrPrivacyNotice } from "../../../shared/security/ocrPrivacy";
import { createOcrPrivacyConsentGuard } from "./consentGuard";

const localProvider: OcrProviderConfig = {
  id: "local-ocrmypdf",
  type: "local-ocrmypdf",
  displayName: "本地 OCRmyPDF",
  enabled: true,
  requiresNetworkConsent: false,
};

const cloudProvider: OcrProviderConfig = {
  id: "paddleocr",
  type: "paddleocr",
  displayName: "PaddleOCR",
  endpoint: "https://ocr.example.test/paddle",
  apiKeyRef: "keychain:paddle",
  enabled: true,
  requiresNetworkConsent: true,
};

const cloudRequest: PreparedOcrRequest = {
  inputPath: "/Users/alice/Cases/secret/source.pdf",
  outputPath: "/Users/alice/Cases/secret/source-ocr.pdf",
  outputStrategy: "new-layered-pdf",
  providerId: "paddleocr",
  pageRange: "1-2",
  qualityCheck: { enabled: false, samplePages: [], keywords: [] },
};

describe("OCR privacy consent guard", () => {
  test("rejects cloud OCR when the current request has no consent decision", () => {
    const guard = createOcrPrivacyConsentGuard();

    const result = guard.evaluate({
      request: cloudRequest,
      provider: cloudProvider,
      now: "2026-06-02T12:00:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("联网 OCR 需要本次隐私确认。");
    expect(result.notice?.providerId).toBe("paddleocr");
    expect(result.auditRecord.consentStatus).toBe("missing");
    expect(JSON.stringify(result.auditRecord)).not.toContain("/Users/alice/Cases/secret/source.pdf");
  });

  test("allows cloud OCR only when consent matches the current provider, page range, and output path", () => {
    const guard = createOcrPrivacyConsentGuard();
    const notice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-current",
    });
    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });

    const result = guard.evaluate({
      request: { ...cloudRequest, privacyNotice: notice, privacyConsent: consent },
      provider: cloudProvider,
      now: "2026-06-02T12:01:00.000Z",
    });

    expect(result.allowed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.auditRecord.consentStatus).toBe("granted");
    expect(result.auditRecord.providerId).toBe("paddleocr");
  });

  test("rejects legacy network consent flags for cloud OCR", () => {
    const guard = createOcrPrivacyConsentGuard();

    const result = guard.evaluate({
      request: {
        ...cloudRequest,
        networkConsentGranted: true,
      },
      provider: cloudProvider,
      now: "2026-06-02T12:01:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("联网 OCR 需要本次隐私确认。");
    expect(result.auditRecord.consentStatus).toBe("missing");
  });

  test("rejects denied cloud OCR consent decisions", () => {
    const guard = createOcrPrivacyConsentGuard();
    const notice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-denied",
    });
    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: false,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });

    const result = guard.evaluate({
      request: { ...cloudRequest, privacyNotice: notice, privacyConsent: consent },
      provider: cloudProvider,
      now: "2026-06-02T12:01:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("联网 OCR 隐私确认未授予。");
    expect(result.auditRecord.consentStatus).toBe("denied");
  });

  test("rejects stale consent decisions from a different output path", () => {
    const guard = createOcrPrivacyConsentGuard();
    const staleNotice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-output",
    });
    const staleConsent = createOcrNetworkConsentDecision({
      notice: staleNotice,
      granted: true,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });

    const result = guard.evaluate({
      request: {
        ...cloudRequest,
        outputPath: "/Users/alice/Cases/secret/changed-ocr.pdf",
        privacyNotice: staleNotice,
        privacyConsent: staleConsent,
      },
      provider: cloudProvider,
      now: "2026-06-02T12:01:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("隐私确认与当前 OCR 请求不匹配。");
    expect(result.auditRecord.consentStatus).toBe("mismatched");
  });

  test("rejects stale consent decisions from a different input file", () => {
    const guard = createOcrPrivacyConsentGuard();
    const staleNotice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-input",
    });
    const staleConsent = createOcrNetworkConsentDecision({
      notice: staleNotice,
      granted: true,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });

    const result = guard.evaluate({
      request: {
        ...cloudRequest,
        inputPath: "/Users/alice/Cases/secret/different-source.pdf",
        privacyNotice: staleNotice,
        privacyConsent: staleConsent,
      },
      provider: cloudProvider,
      now: "2026-06-02T12:01:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("隐私确认与当前 OCR 请求不匹配。");
    expect(result.auditRecord.consentStatus).toBe("mismatched");
  });

  test("rejects expired cloud OCR consent decisions", () => {
    const guard = createOcrPrivacyConsentGuard();
    const notice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-expired",
      expiresAt: "2026-06-02T12:05:00.000Z",
    });
    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:01:00.000Z",
    });

    const result = guard.evaluate({
      request: { ...cloudRequest, privacyNotice: notice, privacyConsent: consent },
      provider: cloudProvider,
      now: "2026-06-02T12:06:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("隐私确认已过期，请重新确认。");
    expect(result.auditRecord.consentStatus).toBe("expired");
  });

  test("rejects consent decisions at the exact expiry boundary", () => {
    const guard = createOcrPrivacyConsentGuard();
    const notice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-expiry-boundary",
      expiresAt: "2026-06-02T12:05:00.000Z",
    });
    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:01:00.000Z",
    });

    const result = guard.evaluate({
      request: { ...cloudRequest, privacyNotice: notice, privacyConsent: consent },
      provider: cloudProvider,
      now: "2026-06-02T12:05:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.auditRecord.consentStatus).toBe("expired");
  });

  test("rejects consent decisions with invalid expiry timestamps", () => {
    const guard = createOcrPrivacyConsentGuard();
    const notice = createOcrPrivacyNotice({
      request: cloudRequest,
      provider: cloudProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      noticeNonce: "notice-invalid-expiry",
      expiresAt: "not-a-date",
    });
    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:01:00.000Z",
    });

    const result = guard.evaluate({
      request: { ...cloudRequest, privacyNotice: notice, privacyConsent: consent },
      provider: cloudProvider,
      now: "2026-06-02T12:02:00.000Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.auditRecord.consentStatus).toBe("expired");
  });

  test("allows local OCR without network consent", () => {
    const guard = createOcrPrivacyConsentGuard();

    const result = guard.evaluate({
      request: {
        ...cloudRequest,
        providerId: "local-ocrmypdf",
      },
      provider: localProvider,
      now: "2026-06-02T12:00:00.000Z",
    });

    expect(result.allowed).toBe(true);
    expect(result.notice).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.auditRecord.consentStatus).toBe("not-required");
    expect(result.auditRecord.isNetworkRequired).toBe(false);
  });
});
