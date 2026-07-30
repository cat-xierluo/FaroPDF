import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";
import type { OcrJob, OcrProviderConfig, OcrRequest } from "../../../shared/ocr/types";
import type { OcrBridgeService } from "../service/bridge";
import type { OcrJobController } from "../service/ocrJobController";
import {
  deriveLayeredOutputPath,
  useOcrWorkspaceController,
  type OcrWorkspaceController,
} from "./useOcrWorkspaceController";

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
  apiKeyRef: "env:PADDLE_KEY",
  enabled: true,
  requiresNetworkConsent: true,
};

function makeStoredJob(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
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
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

interface HarnessProps {
  controller: OcrJobController;
  bridge: OcrBridgeService;
  documentPath?: string;
  providers?: ReadonlyArray<OcrProviderConfig>;
  providerId?: string;
  controllerRef: { current: OcrWorkspaceController | null };
  pollIntervalMs?: number;
}

function Harness({
  bridge,
  controller,
  controllerRef,
  documentPath,
  pollIntervalMs,
  providerId,
  providers = [localProvider, paddleProvider],
}: HarnessProps) {
  const ocr = useOcrWorkspaceController({
    bridge,
    controller,
    documentPath,
    pollIntervalMs,
    providerId,
    providers,
  });
  controllerRef.current = ocr;
  return (
    <ul data-testid="jobs">
      {ocr.jobs.map((job) => (
        <li data-job-id={job.id} data-job-status={job.status} key={job.id}>
          {job.id}:{job.status}
        </li>
      ))}
    </ul>
  );
}

function makeBridgeMock(): OcrBridgeService {
  return {
    startOcr: vi.fn(async (_request: OcrRequest): Promise<OcrJob> => {
      const job = makeStoredJob({ status: "running" });
      return {
        id: job.id,
        inputPath: job.inputPath,
        pageRange: job.pageRange,
        backend: "local-ocrmypdf",
        providerId: job.providerId,
        status: "running",
        outputStrategy: "new-layered-pdf",
        progress: { stage: "running-provider", completedPages: 0, totalPages: 0 },
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    }),
    validateRequest: vi.fn(() => ({ valid: true, errors: [] })),
    getAdapter: vi.fn(),
  };
}

function makeControllerMock(overrides: Partial<OcrJobController> = {}): OcrJobController {
  return {
    startOcrJob: vi.fn(async () => makeStoredJob()),
    listOcrJobs: vi.fn(async () => []),
    pollOcrJob: vi.fn(async () => null),
    cancelOcrJob: vi.fn(async () => makeStoredJob({ status: "cancelled" })),
    extractText: vi.fn(async () => ({ pages: [], totalPages: 0, searchablePages: 0 })),
    ...overrides,
  };
}

describe("useOcrWorkspaceController", () => {
  let bridge: OcrBridgeService;
  let controller: OcrJobController;

  beforeEach(() => {
    bridge = makeBridgeMock();
    controller = makeControllerMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("exposes hasDocument false when no documentPath is provided", () => {
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(<Harness bridge={bridge} controller={controller} controllerRef={ref} />);
    expect(ref.current?.hasDocument).toBe(false);
    expect(ref.current?.hasProvider).toBe(true);
  });

  test("lists existing jobs on mount and falls back to jobs[0] when no selection", async () => {
    const listOcrJobs = vi.fn(async () => [
      makeStoredJob({ id: "ocr-a", status: "completed", createdAt: "2026-06-04T01:00:00.000Z" }),
      makeStoredJob({ id: "ocr-b", status: "completed" }),
    ]);
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, listOcrJobs } as OcrJobController}
        controllerRef={ref}
      />,
    );
    await waitFor(() => {
      expect(listOcrJobs).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(ref.current?.selectedJobId).toBe("ocr-a");
    });
  });

  test("startOcr forwards request with default provider and new-layered-pdf strategy", async () => {
    const startOcr = vi.fn(async () => makeStoredJob({ status: "running" }));
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={{ ...bridge, startOcr } as OcrBridgeService}
        controller={controller}
        controllerRef={ref}
        documentPath="/Users/alice/cases/case.pdf"
      />,
    );
    await act(async () => {
      await ref.current!.startOcr({ pageRange: "2-4" });
    });
    expect(startOcr).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: "/Users/alice/cases/case.pdf",
        outputPath: "/Users/alice/cases/case-ocr.pdf",
        pageRange: "2-4",
        providerId: "local-ocrmypdf",
        outputStrategy: "new-layered-pdf",
      }),
      expect.objectContaining({ providers: expect.any(Array) }),
    );
  });

  test("startOcr records an error message when no document is open", async () => {
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(<Harness bridge={bridge} controller={controller} controllerRef={ref} />);
    await act(async () => {
      await ref.current!.startOcr();
    });
    // 双 act 兜底，确保 React 19 batching 在 microtask 之后再 flush 一次
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(ref.current?.errorMessage).toMatch(/打开.*PDF/);
    });
  });

  test("startOcr records an error message when provider is not enabled", async () => {
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={controller}
        controllerRef={ref}
        documentPath="/tmp/source.pdf"
        providers={[
          { ...localProvider, enabled: false },
          { ...paddleProvider, enabled: false },
        ]}
      />,
    );
    await act(async () => {
      await ref.current!.startOcr();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(ref.current?.errorMessage).toMatch(/OCR 后端/);
    });
  });

  test("startOcr propagates bridge errors into errorMessage", async () => {
    const startOcr = vi.fn(async () => {
      throw new Error("OCR 桥接失败");
    });
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={{ ...bridge, startOcr } as OcrBridgeService}
        controller={controller}
        controllerRef={ref}
        documentPath="/tmp/source.pdf"
      />,
    );
    await act(async () => {
      await ref.current!.startOcr();
    });
    expect(ref.current?.errorMessage).toContain("OCR 桥接失败");
  });

  test("outputLayeredPdf always uses new-layered-pdf strategy", async () => {
    const startOcr = vi.fn(async () => makeStoredJob());
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={{ ...bridge, startOcr } as OcrBridgeService}
        controller={controller}
        controllerRef={ref}
        documentPath="/tmp/source.pdf"
        providerId="local-ocrmypdf"
      />,
    );
    await act(async () => {
      await ref.current!.outputLayeredPdf();
    });
    expect(startOcr).toHaveBeenCalledWith(
      expect.objectContaining({ outputStrategy: "new-layered-pdf" }),
      expect.anything(),
    );
  });

  test("cancelJob forwards the job id to controller", async () => {
    const cancelOcrJob = vi.fn(async (jobId: string) => makeStoredJob({ id: jobId, status: "cancelled" }));
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, cancelOcrJob } as OcrJobController}
        controllerRef={ref}
      />,
    );
    const job = makeStoredJob({ id: "ocr-42", status: "running" });
    await act(async () => {
      await ref.current!.cancelJob(job);
    });
    expect(cancelOcrJob).toHaveBeenCalledWith("ocr-42");
  });

  test("selectJob changes selectedJobId and currentJob follows", async () => {
    const listOcrJobs = vi.fn(async () => [
      makeStoredJob({ id: "ocr-a", status: "completed" }),
      makeStoredJob({ id: "ocr-b", status: "completed", createdAt: "2026-06-04T01:00:00.000Z" }),
    ]);
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, listOcrJobs } as OcrJobController}
        controllerRef={ref}
      />,
    );
    await waitFor(() => {
      expect(ref.current?.jobs.length).toBe(2);
    });
    act(() => {
      ref.current!.selectJob(makeStoredJob({ id: "ocr-a", status: "completed" }));
    });
    expect(ref.current?.selectedJobId).toBe("ocr-a");
    expect(ref.current?.currentJob?.id).toBe("ocr-a");
  });

  test("active job is preferred over selectedJob when computing currentJob", async () => {
    const listOcrJobs = vi.fn(async () => [
      makeStoredJob({ id: "ocr-completed", status: "completed" }),
      makeStoredJob({ id: "ocr-running", status: "running" }),
    ]);
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, listOcrJobs } as OcrJobController}
        controllerRef={ref}
      />,
    );
    await waitFor(() => {
      expect(ref.current?.jobs.length).toBe(2);
    });
    // 默认选中第一个（最新）；但有 active job 时应优先 active
    await waitFor(() => {
      expect(ref.current?.currentJob?.id).toBe("ocr-running");
    });
  });

  test("openQualityReport selects the requested job", async () => {
    const listOcrJobs = vi.fn(async () => [
      makeStoredJob({ id: "ocr-a", status: "completed" }),
      makeStoredJob({ id: "ocr-b", status: "completed" }),
    ]);
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, listOcrJobs } as OcrJobController}
        controllerRef={ref}
      />,
    );
    await waitFor(() => {
      expect(ref.current?.jobs.length).toBe(2);
    });
    act(() => {
      ref.current!.openQualityReport(makeStoredJob({ id: "ocr-a", status: "completed" }));
    });
    expect(ref.current?.selectedJobId).toBe("ocr-a");
  });

  test("polls while there is an active job and stops when none remain", async () => {
    vi.useFakeTimers();
    const listOcrJobs = vi
      .fn()
      .mockResolvedValueOnce([makeStoredJob({ id: "ocr-running", status: "running" })])
      .mockResolvedValueOnce([makeStoredJob({ id: "ocr-running", status: "running" })])
      .mockResolvedValueOnce([makeStoredJob({ id: "ocr-running", status: "completed" })]);
    const ref: { current: OcrWorkspaceController | null } = { current: null };
    render(
      <Harness
        bridge={bridge}
        controller={{ ...controller, listOcrJobs } as OcrJobController}
        controllerRef={ref}
        pollIntervalMs={1000}
      />,
    );
    // 首次拉取同步触发；等待 microtask 跑完
    await act(async () => {
      await Promise.resolve();
    });
    expect(listOcrJobs).toHaveBeenCalledTimes(1);

    // 推进 1s：进入轮询
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(listOcrJobs).toHaveBeenCalledTimes(2);

    // 推进 1s：第三次拉取，状态已变 completed
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(listOcrJobs).toHaveBeenCalledTimes(3);
    // 此时已无 active job；下一轮 1s 不应再触发
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(listOcrJobs).toHaveBeenCalledTimes(3);
  });
});

describe("deriveLayeredOutputPath", () => {
  test("appends -ocr.pdf to the basename in the same directory", () => {
    expect(deriveLayeredOutputPath("/Users/alice/cases/case.pdf")).toBe(
      "/Users/alice/cases/case-ocr.pdf",
    );
  });

  test("handles a bare filename", () => {
    expect(deriveLayeredOutputPath("case.pdf")).toBe("case-ocr.pdf");
  });

  test("preserves the input path when re-running (no suffix stripping for v0.1)", () => {
    // v0.1 行为：不去重 -ocr 后缀；交给后端幂等性保护
    expect(deriveLayeredOutputPath("/tmp/case-ocr.pdf")).toBe("/tmp/case-ocr-ocr.pdf");
  });
});
