import { beforeEach, describe, expect, test, vi } from "vitest";
import { prepareOcrRequest } from "../../../shared/ocr/defaults";
import type { OcrProviderConfig, OcrRequest } from "../../../shared/ocr/types";
import { createOcrNetworkConsentDecision, createOcrPrivacyNotice } from "../../../shared/security/ocrPrivacy";
import { createOcrBridgeService, type OcrBridgeBackend } from "./bridge";

const localProvider: OcrProviderConfig = {
  id: "local-ocrmypdf",
  type: "local-ocrmypdf",
  displayName: "本地 OCRmyPDF",
  enabled: true,
  requiresNetworkConsent: false,
};

const paddleProvider: OcrProviderConfig = {
  id: "paddleocr",
  type: "paddleocr",
  displayName: "PaddleOCR",
  endpoint: "https://ocr.example.test/paddle",
  apiKeyRef: "keychain:paddle",
  enabled: true,
  requiresNetworkConsent: true,
};

const mineruProvider: OcrProviderConfig = {
  id: "mineru",
  type: "mineru",
  displayName: "MinerU",
  endpoint: "https://ocr.example.test/mineru",
  apiKeyRef: "env:MINERU_API_KEY",
  enabled: true,
  requiresNetworkConsent: true,
};

let consentSequence = 0;

function withCurrentPrivacyConsent(request: OcrRequest, provider: OcrProviderConfig): OcrRequest {
  consentSequence += 1;
  const preparedRequest = prepareOcrRequest(request);
  const notice = createOcrPrivacyNotice({
    request: preparedRequest,
    provider,
    issuedAt: "2026-06-02T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    noticeNonce: `bridge-test-${consentSequence}`,
  });
  const privacyConsent = createOcrNetworkConsentDecision({
    notice,
    granted: true,
    decidedAt: "2026-06-02T12:01:00.000Z",
  });

  return {
    ...request,
    privacyNotice: notice,
    privacyConsent,
  };
}

describe("OCR bridge service", () => {
  let backend: OcrBridgeBackend;

  beforeEach(() => {
    backend = {
      startOcr: vi.fn(async (request) => ({
        id: "ocr-1",
        inputPath: request.inputPath,
        outputPath: request.outputPath,
        pageRange: request.pageRange,
        backend: request.provider.type,
        providerId: request.provider.id,
        status: "queued",
        outputStrategy: request.outputStrategy,
        progress: {
          stage: "queued",
          completedPages: 0,
          totalPages: 0,
        },
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z",
      })),
    };
  });

  test("starts a local OCRmyPDF request as a queued bridge job", async () => {
    const service = createOcrBridgeService(backend);

    const job = await service.startOcr(
      {
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "local-ocrmypdf",
        pageRange: "1,3-5",
      },
      { providers: [localProvider] },
    );

    expect(backend.startOcr).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        outputPath: "/tmp/faropdf-fixtures/source-ocr.pdf",
        outputStrategy: "new-layered-pdf",
        pageRange: "1,3-5",
        provider: expect.objectContaining({ id: "local-ocrmypdf", type: "local-ocrmypdf" }),
      }),
    );
    expect(job.status).toBe("queued");
    expect(job.backend).toBe("local-ocrmypdf");
    expect(job.outputPath).toBe("/tmp/faropdf-fixtures/source-ocr.pdf");
    expect(job.progress.stage).toBe("queued");
  });

  test("rejects cloud OCR with only a legacy consent flag before backend invocation", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
          networkConsentGranted: true,
        },
        { providers: [paddleProvider] },
      ),
    ).rejects.toThrow("联网 OCR 需要本次隐私确认。");

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("validateRequest rejects cloud OCR with only a legacy consent flag", () => {
    const service = createOcrBridgeService(backend);

    const result = service.validateRequest(
      {
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "paddleocr",
        networkConsentGranted: true,
      },
      { providers: [paddleProvider] },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("联网 OCR 需要本次隐私确认。");
  });

  test("forwards a redacted privacy audit record when cloud OCR carries current consent", async () => {
    const service = createOcrBridgeService(backend);
    const preparedRequest = {
      inputPath: "/Users/alice/Cases/secret/source.pdf",
      outputPath: "/Users/alice/Cases/secret/source-ocr.pdf",
      outputStrategy: "new-layered-pdf" as const,
      providerId: "paddleocr",
      pageRange: "2-4",
      qualityCheck: { enabled: false, samplePages: [], keywords: [] },
    };
    const notice = createOcrPrivacyNotice({
      request: preparedRequest,
      provider: paddleProvider,
      issuedAt: "2026-06-02T12:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
      noticeNonce: "bridge-forward-audit",
    });
    const privacyConsent = createOcrNetworkConsentDecision({
      notice,
      granted: true,
      decidedAt: "2026-06-02T12:00:00.000Z",
    });

    await service.startOcr(
      {
        ...preparedRequest,
        privacyNotice: notice,
        privacyConsent,
      },
      { providers: [paddleProvider] },
    );

    expect(backend.startOcr).toHaveBeenCalledWith(
      expect.objectContaining({
        networkConsentGranted: true,
        privacyAuditRecord: expect.objectContaining({
          providerId: "paddleocr",
          consentStatus: "granted",
          pageRangeLabel: "2-4",
          outputStrategy: "new-layered-pdf",
        }),
      }),
    );
    const bridgeRequest = vi.mocked(backend.startOcr).mock.calls[0][0];
    expect(JSON.stringify(bridgeRequest.privacyAuditRecord)).not.toContain("/Users/alice");
    expect(JSON.stringify(bridgeRequest.privacyAuditRecord)).not.toContain("source-ocr.pdf");
  });

  test("rejects cloud OCR without a configured API key reference", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        withCurrentPrivacyConsent({
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
        }, { ...paddleProvider, apiKeyRef: "" }),
        {
          providers: [
            {
              ...paddleProvider,
              apiKeyRef: "",
            },
          ],
        },
      ),
    ).rejects.toThrow("PaddleOCR 需要配置 apiKeyRef。");

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("rejects raw cloud API keys before backend invocation", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        withCurrentPrivacyConsent({
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
        }, { ...paddleProvider, apiKeyRef: "paddle-secret-123456" }),
        {
          providers: [
            {
              ...paddleProvider,
              apiKeyRef: "paddle-secret-123456",
            },
          ],
        },
      ),
    ).rejects.toThrow("PaddleOCR 的 apiKeyRef 必须使用凭证引用或脱敏占位。");

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("rejects remote HTTP and spoofed 127 hostnames but allows true loopback HTTP", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        withCurrentPrivacyConsent({
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
        }, { ...paddleProvider, endpoint: "http://ocr.example.test/paddle" }),
        {
          providers: [
            {
              ...paddleProvider,
              endpoint: "http://ocr.example.test/paddle",
            },
          ],
        },
      ),
    ).rejects.toThrow("PaddleOCR 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。");

    await expect(
      service.startOcr(
        withCurrentPrivacyConsent({
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
        }, { ...paddleProvider, endpoint: "http://127.evil.example/paddle" }),
        {
          providers: [
            {
              ...paddleProvider,
              endpoint: "http://127.evil.example/paddle",
            },
          ],
        },
      ),
    ).rejects.toThrow("PaddleOCR 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。");

    await service.startOcr(
      withCurrentPrivacyConsent({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "paddleocr",
      }, { ...paddleProvider, endpoint: "http://127.42.0.8:8080/paddle" }),
      {
        providers: [
          {
            ...paddleProvider,
            endpoint: "http://127.42.0.8:8080/paddle",
          },
        ],
      },
    );

    await service.startOcr(
      withCurrentPrivacyConsent({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "paddleocr",
      }, { ...paddleProvider, endpoint: "http://[::1]:8080/paddle" }),
      {
        providers: [
          {
            ...paddleProvider,
            endpoint: "http://[::1]:8080/paddle",
          },
        ],
      },
    );

    expect(backend.startOcr).toHaveBeenCalledTimes(2);
  });

  test("validates MinerU and disabled providers through the same network rules", () => {
    const service = createOcrBridgeService(backend);

    expect(
      service.validateRequest(
        withCurrentPrivacyConsent({
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "mineru",
        }, mineruProvider),
        { providers: [mineruProvider] },
      ),
    ).toEqual({ valid: true, errors: [] });

    expect(
      service.validateRequest(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "local-ocrmypdf",
        },
        { providers: [{ ...localProvider, enabled: false }] },
      ).errors,
    ).toContain("本地 OCRmyPDF 未启用。");
  });

  test("rejects invalid quality check sample pages before normalization", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "local-ocrmypdf",
          qualityCheck: {
            enabled: true,
            samplePages: [0],
            keywords: [],
          },
        },
        { providers: [localProvider] },
      ),
    ).rejects.toThrow("OCR 质量抽查页码必须是正整数。");

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("rejects output paths that would overwrite the source PDF without leaking the source path", async () => {
    const service = createOcrBridgeService(backend);

    try {
      await service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          outputPath: "/tmp/faropdf-fixtures/nested/../source.pdf",
          providerId: "local-ocrmypdf",
        },
        { providers: [localProvider] },
      );
      expect.fail("expected same-path validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("OCR 参数校验失败");
      expect((error as Error).message).toContain("输出 PDF 必须是不同于原始 PDF 的新文件。");
      expect((error as Error).message).not.toContain("/tmp/faropdf-fixtures/source.pdf");
    }

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("redacts backend error paths with punctuation and does not retain the raw path in cause", async () => {
    const sensitivePath = "/Users/example/Cases/case, confidential.pdf";
    vi.mocked(backend.startOcr).mockRejectedValue(
      new Error(`无法读取 ${sensitivePath}，请检查文件权限。`),
    );
    const service = createOcrBridgeService(backend);

    try {
      await service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "local-ocrmypdf",
        },
        { providers: [localProvider] },
      );
      expect.fail("expected backend failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("[path]");
      expect((error as Error).message).not.toContain(sensitivePath);
      const cause = (error as Error & { cause?: unknown }).cause;
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message).toContain("[path]");
      expect((cause as Error).message).not.toContain(sensitivePath);
    }
  });
});
