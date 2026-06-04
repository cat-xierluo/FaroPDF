import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";
import { OcrWorkspace } from "./OcrWorkspace";
import type { OcrWorkspaceController } from "./useOcrWorkspaceController";

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

function makeController(overrides: Partial<OcrWorkspaceController> = {}): OcrWorkspaceController {
  return {
    busy: false,
    cancelJob: vi.fn(async () => undefined),
    currentJob: undefined,
    errorMessage: null,
    hasDocument: true,
    hasProvider: true,
    jobs: [],
    openJobList: vi.fn(),
    openQualityReport: vi.fn(),
    outputLayeredPdf: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    selectJob: vi.fn(),
    selectedJobId: null,
    startOcr: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("OcrWorkspace", () => {
  test("renders the job list empty state and a placeholder report when there are no jobs", () => {
    render(<OcrWorkspace controller={makeController()} />);
    expect(screen.getByText("尚未启动任何 OCR 任务。")).toBeInTheDocument();
    expect(screen.getByText("尚未选中 OCR 任务。")).toBeInTheDocument();
  });

  test("renders job rows with backend/status and forwards cancel events", () => {
    const cancelJob = vi.fn(async () => undefined);
    const controller = makeController({
      cancelJob,
      jobs: [makeStoredJob({ id: "ocr-running", status: "running" })],
      selectedJobId: "ocr-running",
    });
    render(<OcrWorkspace controller={controller} />);
    const item = screen.getByRole("listitem");
    expect(within(item).getByText(/本地 ocrmypdf · 运行中/)).toBeInTheDocument();
    fireEvent.click(within(item).getByRole("button", { name: "取消" }));
    expect(cancelJob).toHaveBeenCalledTimes(1);
  });

  test("selecting a job calls selectJob and shows the report for the selected job", () => {
    const selectJob = vi.fn();
    const controller = makeController({
      jobs: [
        makeStoredJob({ id: "ocr-a", status: "completed" }),
        makeStoredJob({
          id: "ocr-b",
          status: "completed",
          quality: {
            searchedKeywords: ["合同"],
            matchedKeywords: ["合同"],
            textPages: 3,
            emptyTextPages: 1,
            fileSizeRatio: 1.8,
            elapsedMs: 12_000,
          },
        }),
      ],
      selectJob,
      selectedJobId: "ocr-b",
    });
    render(<OcrWorkspace controller={controller} />);
    // 选中 ocr-b（带 quality），右侧应显示完整报告；h2 标题"质量报告"在右侧 section header
    const reportHeadings = screen.getAllByRole("heading", { name: "质量报告" });
    expect(reportHeadings.length).toBeGreaterThan(0);
    expect(screen.getByText(/OCR 质量报告/)).toBeInTheDocument();
    // 点击第一个列表项触发 selectJob
    const summaryButtons = screen.getAllByRole("button", { name: /本地 ocrmypdf/ });
    fireEvent.click(summaryButtons[0]);
    expect(selectJob).toHaveBeenCalled();
  });

  test("renders the missing-quality placeholder for a selected job without quality", () => {
    const controller = makeController({
      jobs: [makeStoredJob({ id: "ocr-x", status: "completed" })],
      selectedJobId: "ocr-x",
    });
    render(<OcrWorkspace controller={controller} />);
    expect(screen.getByText(/尚未生成质量报告/)).toBeInTheDocument();
  });

  test("surfaces the error message as an alert", () => {
    const controller = makeController({
      errorMessage: "OCR 桥接失败：无法找到 ocrmypdf",
      jobs: [makeStoredJob({ id: "ocr-1" })],
      selectedJobId: "ocr-1",
    });
    render(<OcrWorkspace controller={controller} />);
    expect(screen.getByRole("alert")).toHaveTextContent("OCR 桥接失败：无法找到 ocrmypdf");
  });

  test("auto-selects the active job when one appears and selectedJobId is empty", () => {
    const selectJob = vi.fn();
    const runningJob = makeStoredJob({ id: "ocr-running", status: "running" });
    const controller = makeController({
      currentJob: runningJob,
      jobs: [runningJob],
      selectJob,
      selectedJobId: null,
    });
    render(<OcrWorkspace controller={controller} />);
    expect(selectJob).toHaveBeenCalledWith(expect.objectContaining({ id: "ocr-running" }));
  });
});
