import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  OcrJobList,
  OcrModeToolbar,
  OcrQualityReportView,
} from "./OcrModeToolbar";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";

function makeJob(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
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

describe("OcrModeToolbar", () => {
  test("disables start when no document or provider is configured", () => {
    render(
      <OcrModeToolbar
        hasDocument={false}
        hasProvider={false}
        busy={false}
        onStartOcr={() => {}}
        onOutputLayeredPdf={() => {}}
        onOpenQualityReport={() => {}}
        onOpenJobList={() => {}}
        onCancelJob={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "识别文本" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "输出双层 PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "质量检查" })).toBeDisabled();
  });

  test("emits start callback when no active job is in flight", () => {
    const onStartOcr = vi.fn();
    const onCancelJob = vi.fn();
    render(
      <OcrModeToolbar
        hasDocument={true}
        hasProvider={true}
        busy={false}
        onStartOcr={onStartOcr}
        onOutputLayeredPdf={() => {}}
        onOpenQualityReport={() => {}}
        onOpenJobList={() => {}}
        onCancelJob={onCancelJob}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "识别文本" }));
    expect(onStartOcr).toHaveBeenCalledTimes(1);
  });

  test("emits cancel callback for an active job", () => {
    const onCancelJob = vi.fn();
    render(
      <OcrModeToolbar
        currentJob={makeJob({ status: "running" })}
        hasDocument={true}
        hasProvider={true}
        busy={false}
        onStartOcr={() => {}}
        onOutputLayeredPdf={() => {}}
        onOpenQualityReport={() => {}}
        onOpenJobList={() => {}}
        onCancelJob={onCancelJob}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancelJob).toHaveBeenCalledTimes(1);
  });

  test("disables start while a job is running", () => {
    render(
      <OcrModeToolbar
        currentJob={makeJob({ status: "running" })}
        hasDocument={true}
        hasProvider={true}
        busy={false}
        onStartOcr={() => {}}
        onOutputLayeredPdf={() => {}}
        onOpenQualityReport={() => {}}
        onOpenJobList={() => {}}
        onCancelJob={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "识别中…" })).toBeDisabled();
  });

  test("shows the running job backend and status", () => {
    render(
      <OcrModeToolbar
        currentJob={makeJob({
          status: "running",
          backend: "paddleocr",
          progress: { stage: "running-provider", completedPages: 3, totalPages: 10 },
        })}
        hasDocument={true}
        hasProvider={true}
        busy={false}
        onStartOcr={() => {}}
        onOutputLayeredPdf={() => {}}
        onOpenQualityReport={() => {}}
        onOpenJobList={() => {}}
        onCancelJob={() => {}}
      />,
    );
    expect(screen.getByText(/PaddleOCR · 运行中 · 3 页/)).toBeInTheDocument();
  });
});

describe("OcrJobList", () => {
  test("renders an empty state when there are no jobs", () => {
    render(
      <OcrJobList
        jobs={[]}
        onSelect={() => {}}
        onOpenQualityReport={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/暂无 OCR 任务/)).toBeInTheDocument();
  });

  test("shows the redacted path summaries instead of raw paths", () => {
    const jobs = [
      makeJob({
        id: "ocr-1",
        status: "completed",
        inputPathSummary: { kind: "local-pdf", fingerprint: "x", redacted: "[path].pdf" },
        outputPathSummary: { kind: "local-pdf", fingerprint: "y", redacted: "[path]-ocr.pdf" },
      }),
    ];
    render(
      <OcrJobList
        jobs={jobs}
        onSelect={() => {}}
        onOpenQualityReport={() => {}}
        onCancel={() => {}}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(within(item).getByText(/本地 ocrmypdf · 已完成/)).toBeInTheDocument();
    expect(item.textContent).toContain("[path].pdf");
    expect(item.textContent).toContain("[path]-ocr.pdf");
  });

  test("emits cancel events for active jobs", () => {
    const onCancel = vi.fn();
    render(
      <OcrJobList
        jobs={[makeJob({ id: "ocr-active", status: "running" })]}
        onSelect={() => {}}
        onOpenQualityReport={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("OcrQualityReportView", () => {
  test("shows a missing state when no quality summary is attached", () => {
    render(<OcrQualityReportView job={makeJob({ id: "ocr-x" })} />);
    expect(screen.getByText(/尚未生成质量报告/)).toBeInTheDocument();
  });

  test("renders the searchable pages, matched keywords and ratio", () => {
    render(
      <OcrQualityReportView
        job={makeJob({
          status: "completed",
          quality: {
            searchedKeywords: ["合同", "付款"],
            matchedKeywords: ["合同"],
            textPages: 2,
            emptyTextPages: 1,
            fileSizeRatio: 2.5,
            elapsedMs: 30_000,
          },
        })}
      />,
    );
    expect(screen.getByText(/OCR 质量报告/)).toBeInTheDocument();
    expect(screen.getByText("合同")).toBeInTheDocument();
    expect(screen.getByText("付款")).toBeInTheDocument();
    expect(screen.getByText(/体积比/)).toBeInTheDocument();
  });
});
