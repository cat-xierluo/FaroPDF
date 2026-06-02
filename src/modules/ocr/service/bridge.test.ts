import { beforeEach, describe, expect, test, vi } from "vitest";
import type { OcrProviderConfig } from "../../../shared/ocr/types";
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

  test("rejects cloud OCR without explicit consent before backend invocation", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
        },
        { providers: [paddleProvider] },
      ),
    ).rejects.toThrow("联网 OCR 需要用户明确确认。");

    expect(backend.startOcr).not.toHaveBeenCalled();
  });

  test("rejects cloud OCR without a configured API key reference", async () => {
    const service = createOcrBridgeService(backend);

    await expect(
      service.startOcr(
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
          networkConsentGranted: true,
        },
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
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
          networkConsentGranted: true,
        },
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
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
          networkConsentGranted: true,
        },
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
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "paddleocr",
          networkConsentGranted: true,
        },
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
      {
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "paddleocr",
        networkConsentGranted: true,
      },
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
      {
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        providerId: "paddleocr",
        networkConsentGranted: true,
      },
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
        {
          inputPath: "/tmp/faropdf-fixtures/source.pdf",
          providerId: "mineru",
          networkConsentGranted: true,
        },
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
