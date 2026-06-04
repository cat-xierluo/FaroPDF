import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultScanPreprocessOptions } from "../../shared/preprocess/defaults";
import { createScanPreprocessService, type ScanPreprocessBackend } from "./scanPreprocessService";

describe("scan preprocess service", () => {
  let backend: ScanPreprocessBackend;

  beforeEach(() => {
    backend = {
      startScanPreprocess: vi.fn(),
      listScanPreprocessJobs: vi.fn(),
      pollScanPreprocessJob: vi.fn(),
      cancelScanPreprocessJob: vi.fn(),
    };
  });

  test("starts a queued preprocess-only job through the backend bridge", async () => {
    vi.mocked(backend.startScanPreprocess).mockImplementation(async (request) => ({
      id: "scan-preprocess-1",
      inputPath: request.inputPath,
      outputPath: request.outputPath ?? "",
      status: "running",
      options: request.options,
      progress: {
        stage: "validating",
        completedPages: 0,
        totalPages: 0,
      },
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
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
    expect(job.status).toBe("running");
    expect(job.outputPath).toBe("/tmp/faropdf-fixtures/source-preprocessed.pdf");
    expect(job.progress.stage).toBe("validating");
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

  test("lists jobs from the backend and sorts newest first", async () => {
    vi.mocked(backend.listScanPreprocessJobs).mockResolvedValue([
      {
        id: "scan-preprocess-old",
        inputPath: "/tmp/faropdf-fixtures/old.pdf",
        outputPath: "/tmp/faropdf-fixtures/old-preprocessed.pdf",
        status: "completed",
        options: createDefaultScanPreprocessOptions(),
        progress: { stage: "completed", completedPages: 1, totalPages: 1 },
        summary: {
          totalPages: 1,
          processedPages: 1,
          rotatedPages: 0,
          deskewedPages: 0,
          splitPages: 0,
          croppedPages: 0,
          blankEdgesClearedPages: 0,
          elapsedMs: 100,
          outputPath: "/tmp/faropdf-fixtures/old-preprocessed.pdf",
          preprocessOnly: true,
        },
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:01.000Z",
      },
      {
        id: "scan-preprocess-new",
        inputPath: "/tmp/faropdf-fixtures/new.pdf",
        outputPath: "/tmp/faropdf-fixtures/new-preprocessed.pdf",
        status: "running",
        options: createDefaultScanPreprocessOptions(),
        progress: { stage: "preprocessing", completedPages: 1, totalPages: 3 },
        createdAt: "2026-06-04T01:00:00.000Z",
        updatedAt: "2026-06-04T01:00:05.000Z",
      },
    ]);

    const service = createScanPreprocessService(backend);
    const jobs = await service.listPreprocessJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).toBe("scan-preprocess-new");
    expect(jobs[1].id).toBe("scan-preprocess-old");
  });

  test("polls a job by id and returns null when backend has no record", async () => {
    vi.mocked(backend.pollScanPreprocessJob).mockResolvedValueOnce(null);
    const service = createScanPreprocessService(backend);
    const result = await service.pollPreprocessJob("scan-missing");
    expect(result).toBeNull();

    vi.mocked(backend.pollScanPreprocessJob).mockResolvedValueOnce({
      id: "scan-preprocess-1",
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      outputPath: "/tmp/faropdf-fixtures/source-preprocessed.pdf",
      status: "running",
      options: createDefaultScanPreprocessOptions(),
      progress: { stage: "preprocessing", completedPages: 1, totalPages: 3 },
      createdAt: "2026-06-04T01:00:00.000Z",
      updatedAt: "2026-06-04T01:00:01.000Z",
    });
    const polled = await service.pollPreprocessJob("scan-preprocess-1");
    expect(polled).not.toBeNull();
    expect(polled?.status).toBe("running");
    expect(polled?.progress.completedPages).toBe(1);
  });

  test("rejects empty job id for poll and cancel", async () => {
    const service = createScanPreprocessService(backend);
    await expect(service.pollPreprocessJob("")).rejects.toThrow("jobId 不能为空");
    await expect(service.cancelPreprocessJob("")).rejects.toThrow("jobId 不能为空");
    expect(backend.pollScanPreprocessJob).not.toHaveBeenCalled();
    expect(backend.cancelScanPreprocessJob).not.toHaveBeenCalled();
  });

  test("cancels a job and returns the cancelled record", async () => {
    vi.mocked(backend.cancelScanPreprocessJob).mockResolvedValue({
      id: "scan-preprocess-1",
      inputPath: "/tmp/faropdf-fixtures/source.pdf",
      outputPath: "/tmp/faropdf-fixtures/source-preprocessed.pdf",
      status: "cancelled",
      options: createDefaultScanPreprocessOptions(),
      progress: { stage: "preprocessing", completedPages: 1, totalPages: 3, message: "已取消" },
      createdAt: "2026-06-04T01:00:00.000Z",
      updatedAt: "2026-06-04T01:00:01.000Z",
    });
    const service = createScanPreprocessService(backend);
    const cancelled = await service.cancelPreprocessJob("scan-preprocess-1");
    expect(cancelled).not.toBeNull();
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.progress.message).toBe("已取消");
  });
});
