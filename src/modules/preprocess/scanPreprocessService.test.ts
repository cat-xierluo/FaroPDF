import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultScanPreprocessOptions } from "../../shared/preprocess/defaults";
import { createScanPreprocessService, type ScanPreprocessBackend } from "./scanPreprocessService";

describe("scan preprocess service", () => {
  let backend: ScanPreprocessBackend;

  beforeEach(() => {
    backend = {
      startScanPreprocess: vi.fn(),
    };
  });

  test("starts a queued preprocess-only job through the backend bridge", async () => {
    vi.mocked(backend.startScanPreprocess).mockImplementation(async (request) => ({
      id: "scan-preprocess-1",
      inputPath: request.inputPath,
      outputPath: request.outputPath ?? "",
      status: "queued",
      options: request.options,
      progress: {
        stage: "queued",
        completedPages: 0,
        totalPages: 0,
      },
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    }));
    const service = createScanPreprocessService(backend);

    const job = await service.startPreprocess({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      options: createDefaultScanPreprocessOptions(),
    });

    expect(backend.startScanPreprocess).toHaveBeenCalledWith({
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      outputPath: "/tmp/faropdf-fixtures/source-preprocessed.pdf",
      options: createDefaultScanPreprocessOptions(),
    });
    expect(job.status).toBe("queued");
    expect(job.outputPath).toBe("/tmp/faropdf-fixtures/source-preprocessed.pdf");
    expect(job.progress.completedPages).toBe(0);
  });

  test("rejects invalid requests before invoking the backend and redacts paths", async () => {
    const service = createScanPreprocessService(backend);

    await expect(
      service.startPreprocess({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        outputPath: "/tmp/faropdf-fixtures/source.pdf",
        options: {
          ...createDefaultScanPreprocessOptions(),
          dpi: 10,
        },
      }),
    ).rejects.toThrow("扫描预处理参数校验失败");

    try {
      await service.startPreprocess({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        outputPath: "/tmp/faropdf-fixtures/source.pdf",
        options: {
          ...createDefaultScanPreprocessOptions(),
          dpi: 10,
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("/tmp/faropdf-fixtures/source.pdf");
    }
    expect(backend.startScanPreprocess).not.toHaveBeenCalled();
  });

  test("redacts backend error paths without retaining the raw error in cause", async () => {
    vi.mocked(backend.startScanPreprocess).mockRejectedValue(
      new Error("无法写入 /tmp/faropdf fixtures/source bundle.pdf"),
    );
    const service = createScanPreprocessService(backend);

    try {
      await service.startPreprocess({
        inputPath: "/tmp/faropdf-fixtures/source.pdf",
        options: createDefaultScanPreprocessOptions(),
      });
      expect.fail("expected backend failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("[path]");
      expect((error as Error).message).not.toContain("/tmp/faropdf fixtures/source bundle.pdf");
      const cause = (error as Error & { cause?: unknown }).cause;
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message).toContain("[path]");
      expect((cause as Error).message).not.toContain("/tmp/faropdf fixtures/source bundle.pdf");
    }
  });
});
