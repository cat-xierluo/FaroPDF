import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OcrQueuePanelView } from "./OcrQueuePanelView";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";

function makeJob(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
  return {
    id: "ocr-1",
    inputPath: "/case/材料/合同.pdf",
    inputPathSummary: { kind: "local-pdf", fingerprint: "x", redacted: "[path].pdf" },
    outputPath: "/case/材料/合同-ocr.pdf",
    outputPathSummary: { kind: "local-pdf", fingerprint: "y", redacted: "[path]-ocr.pdf" },
    backend: "local-ocrmypdf",
    providerId: "local-ocrmypdf",
    status: "queued",
    outputStrategy: "new-layered-pdf",
    progress: { stage: "queued", completedPages: 0, totalPages: 0 },
    qualityCheck: { enabled: false, samplePages: [], keywords: [] },
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("OcrQueuePanelView（ISS-NEW-C 阶段 2 后续 2026-06-22 收口）", () => {
  test("jobs 为空时显示「无 OCR 任务」", () => {
    render(<OcrQueuePanelView jobs={[]} />);
    expect(screen.getByTestId("ocr-queue-empty")).toBeInTheDocument();
  });

  test("jobs 列表渲染：status dot + 文件名 + status label", () => {
    const jobs = [
      makeJob({ id: "ocr-1", status: "queued" }),
      makeJob({ id: "ocr-2", inputPath: "/case/材料/证据.pdf", status: "running" }),
      makeJob({ id: "ocr-3", inputPath: "/case/材料/扫描件.pdf", status: "completed" }),
    ];
    render(<OcrQueuePanelView jobs={jobs} />);
    const list = screen.getByTestId("ocr-queue-list");
    const items = within(list).getAllByTestId("ocr-queue-item");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByTestId("ocr-queue-name")).toHaveTextContent("合同.pdf");
    expect(within(items[0]!).getByTestId("ocr-queue-status")).toHaveTextContent("排队中");
    expect(within(items[1]!).getByTestId("ocr-queue-status")).toHaveTextContent("运行中");
    expect(within(items[2]!).getByTestId("ocr-queue-status")).toHaveTextContent("已完成");
  });

  test("active 状态（queued/running）的 job 显示可点 cancel 按钮", async () => {
    const onCancelJob = vi.fn();
    const user = userEvent.setup();
    const jobs = [
      makeJob({ id: "ocr-active", status: "running" }),
      makeJob({ id: "ocr-done", status: "completed" }),
    ];
    render(<OcrQueuePanelView jobs={jobs} onCancelJob={onCancelJob} />);
    const list = screen.getByTestId("ocr-queue-list");
    const items = within(list).getAllByTestId("ocr-queue-item");
    const activeCancel = within(items[0]!).getByTestId("ocr-queue-cancel");
    const doneCancel = within(items[1]!).getByTestId("ocr-queue-cancel");
    expect(activeCancel).toBeEnabled();
    expect(doneCancel).toBeDisabled();

    await user.click(activeCancel);
    expect(onCancelJob).toHaveBeenCalledWith("ocr-active");
  });

  test("无 onCancelJob 回调时不渲染 cancel 按钮", () => {
    const jobs = [makeJob({ status: "running" })];
    render(<OcrQueuePanelView jobs={jobs} />);
    expect(screen.queryByTestId("ocr-queue-cancel")).not.toBeInTheDocument();
  });
});
