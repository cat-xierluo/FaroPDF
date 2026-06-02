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
      inputPath: "/secret/case/evidence.pdf",
      options: createDefaultScanPreprocessOptions(),
    });

    expect(backend.startScanPreprocess).toHaveBeenCalledWith({
      inputPath: "/secret/case/evidence.pdf",
      outputPath: "/secret/case/evidence-preprocessed.pdf",
      options: createDefaultScanPreprocessOptions(),
    });
    expect(job.status).toBe("queued");
    expect(job.outputPath).toBe("/secret/case/evidence-preprocessed.pdf");
    expect(job.progress.completedPages).toBe(0);
  });

  test("rejects invalid requests before invoking the backend and redacts paths", async () => {
    const service = createScanPreprocessService(backend);

    await expect(
      service.startPreprocess({
        inputPath: "/secret/case/evidence.pdf",
        outputPath: "/secret/case/evidence.pdf",
        options: {
          ...createDefaultScanPreprocessOptions(),
          dpi: 10,
        },
      }),
    ).rejects.toThrow("扫描预处理参数校验失败");

    try {
      await service.startPreprocess({
        inputPath: "/secret/case/evidence.pdf",
        outputPath: "/secret/case/evidence.pdf",
        options: {
          ...createDefaultScanPreprocessOptions(),
          dpi: 10,
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("/secret/case/evidence.pdf");
    }
    expect(backend.startScanPreprocess).not.toHaveBeenCalled();
  });
});
