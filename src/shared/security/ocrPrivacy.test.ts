import { describe, expect, test } from "vitest";
import type { OcrProviderConfig } from "../ocr/types";
import {
  createOcrNetworkConsentDecision,
  createOcrPrivacyAuditRecord,
  createOcrPrivacyNotice,
} from "./ocrPrivacy";

const cloudProvider: OcrProviderConfig = {
  id: "paddleocr",
  type: "paddleocr",
  displayName: "PaddleOCR",
  endpoint: "https://ocr.example.test/paddle",
  apiKeyRef: "keychain:paddle",
  enabled: true,
  requiresNetworkConsent: true,
};

describe("OCR privacy notice and audit records", () => {
  test("builds a network OCR notice with provider, page range, output path, network status, no-overwrite promise, and key reference", () => {
    const notice = createOcrPrivacyNotice({
      provider: cloudProvider,
      request: {
        inputPath: "/Users/alice/Cases/secret/source.pdf",
        outputPath: "/Users/alice/Cases/secret/source-ocr.pdf",
        outputStrategy: "new-layered-pdf",
        providerId: "paddleocr",
        pageRange: "2-4",
        qualityCheck: { enabled: false, samplePages: [], keywords: [] },
      },
    });

    expect(notice.noticeVersion).toBe("network-ocr-v1");
    expect(notice.providerId).toBe("paddleocr");
    expect(notice.providerDisplayName).toBe("PaddleOCR");
    expect(notice.pageRangeLabel).toBe("2-4");
    expect(notice.outputPath).toBe("/Users/alice/Cases/secret/source-ocr.pdf");
    expect(notice.isNetworkRequired).toBe(true);
    expect(notice.originalPdfWillBeOverwritten).toBe(false);
    expect(notice.apiKeyRefLabel).toBe("keychain:paddle");
    expect(notice.summaryLines.join("\n")).toContain("联网处理：是");
    expect(notice.summaryLines.join("\n")).toContain("不会覆盖原 PDF");
  });

  test("creates consent decisions and audit records without retaining full local paths or raw keys", () => {
    const rawApiKey = "paddle-secret-1234567890";
    const inputPath = "/Users/alice/Cases/秘密案号/source, confidential.pdf";
    const outputPath = "/Users/alice/Cases/秘密案号/source, confidential-ocr.pdf";
    const provider: OcrProviderConfig = {
      ...cloudProvider,
      apiKeyRef: rawApiKey,
    };
    const notice = createOcrPrivacyNotice({
      provider,
      request: {
        inputPath,
        outputPath,
        outputStrategy: "new-layered-pdf",
        providerId: "paddleocr",
        pageRange: "1,3-5",
        qualityCheck: { enabled: false, samplePages: [], keywords: [] },
      },
    });

    const consent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });
    const auditRecord = createOcrPrivacyAuditRecord({
      notice,
      consentStatus: "granted",
      createdAt: "2026-06-02T12:00:00.000Z",
    });

    const consentJson = JSON.stringify(consent);
    const auditJson = JSON.stringify(auditRecord);

    expect(consent.granted).toBe(true);
    expect(consent.noticeId).toBe(notice.noticeId);
    expect(auditRecord.providerId).toBe("paddleocr");
    expect(auditRecord.pageRangeLabel).toBe("1,3-5");
    expect(auditRecord.outputStrategy).toBe("new-layered-pdf");
    expect(auditRecord.outputPath.redacted).toMatch(/^\[local-pdf:[a-f0-9]{8}\.pdf\]$/);
    expect(auditRecord.apiKeyRefLabel).toBe("[redacted-api-key-ref]");

    for (const serialized of [consentJson, auditJson]) {
      expect(serialized).not.toContain(inputPath);
      expect(serialized).not.toContain(outputPath);
      expect(serialized).not.toContain("/Users/alice");
      expect(serialized).not.toContain("秘密案号");
      expect(serialized).not.toContain("confidential");
      expect(serialized).not.toContain(rawApiKey);
    }
  });
});
