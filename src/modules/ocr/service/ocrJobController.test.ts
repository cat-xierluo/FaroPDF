import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  commandJobToOcrJob,
  createTauriOcrJobController,
  filterOcrJobs,
  type OcrJobController,
} from "./ocrJobController";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";

function makeStored(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
  return {
    id: "ocr-1",
    inputPath: "/tmp/source.pdf",
    inputPathSummary: { kind: "local-pdf", fingerprint: "x", redacted: "[path].pdf" },
    outputPath: "/tmp/source-ocr.pdf",
    outputPathSummary: { kind: "local-pdf", fingerprint: "y", redacted: "[path]-ocr.pdf" },
    backend: "local-ocrmypdf",
    providerId: "local-ocrmypdf",
    status: "queued",
    outputStrategy: "new-layered-pdf",
    progress: { stage: "queued", completedPages: 0, totalPages: 0 },
    qualityCheck: { enabled: false, samplePages: [], keywords: [] },
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("OcrJobController", () => {
  let invoker: ReturnType<typeof vi.fn>;
  let controller: OcrJobController;

  beforeEach(() => {
    invoker = vi.fn(async <T>(_command: string, args?: Record<string, unknown>) => {
      if (args?.["request"]) {
        return { id: "ocr-1", status: "running" } as unknown as T;
      }
      return [] as unknown as T;
    });
    controller = createTauriOcrJobController({ invoker: invoker as never });
  });

  test("startOcrJob forwards the request and returns the running job", async () => {
    invoker.mockResolvedValueOnce(makeStored({ status: "running" }));
    const job = await controller.startOcrJob(makeStored());
    expect(invoker).toHaveBeenCalledWith("start_ocr_job", { request: expect.any(Object) });
    expect(job.status).toBe("running");
  });

  test("startOcrJob sanitises backend errors so paths do not leak", async () => {
    invoker.mockRejectedValueOnce(
      new Error("无法读取 /Users/alice/Cases, secret/file.pdf"),
    );
    await expect(controller.startOcrJob(makeStored())).rejects.toThrow("[path]");
  });

  test("listOcrJobs returns an empty array when backend returns null", async () => {
    invoker.mockResolvedValueOnce(null);
    const jobs = await controller.listOcrJobs();
    expect(jobs).toEqual([]);
  });

  test("pollOcrJob returns null when backend has no record", async () => {
    invoker.mockResolvedValueOnce(null);
    const job = await controller.pollOcrJob("missing");
    expect(job).toBeNull();
  });

  test("cancelOcrJob forwards the job id and returns the updated job", async () => {
    invoker.mockResolvedValueOnce(makeStored({ status: "cancelled" }));
    const job = await controller.cancelOcrJob("ocr-1");
    expect(invoker).toHaveBeenCalledWith("cancel_ocr_job", { jobId: "ocr-1" });
    expect(job?.status).toBe("cancelled");
  });

  test("extractText normalises backend payloads", async () => {
    invoker.mockResolvedValueOnce({
      pages: [
        { pageIndex: 0, text: "第一页" },
        { pageIndex: 1, text: "第二页" },
      ],
      totalPages: 2,
      searchablePages: 2,
    });
    const result = await controller.extractText("/tmp/source-ocr.pdf");
    expect(result.totalPages).toBe(2);
    expect(result.searchablePages).toBe(2);
    expect(result.pages).toHaveLength(2);
  });

  test("commandJobToOcrJob maps back-end fields to the shared OcrJob", () => {
    const stored = makeStored({
      status: "completed",
      progress: { stage: "completed", completedPages: 4, totalPages: 4, message: "完成" },
    });
    const job = commandJobToOcrJob(stored);
    expect(job.id).toBe("ocr-1");
    expect(job.status).toBe("completed");
    expect(job.progress.stage).toBe("completed");
    expect(job.progress.providerMessage).toBe("完成");
  });

  test("filterOcrJobs respects activeOnly and backend filters", () => {
    const jobs: OcrCommandJob[] = [
      makeStored({ id: "a", status: "running", backend: "local-ocrmypdf" }),
      makeStored({ id: "b", status: "completed", backend: "local-ocrmypdf" }),
      makeStored({ id: "c", status: "running", backend: "paddleocr" }),
    ];
    expect(filterOcrJobs(jobs, { backend: "paddleocr" })).toHaveLength(1);
    expect(filterOcrJobs(jobs, { backend: "paddleocr" })[0].id).toBe("c");
  });
});
