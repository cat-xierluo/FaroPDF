import { describe, expect, test } from "vitest";
import {
  formatOcrBackendLabel,
  formatOcrStatusLabel,
  isActiveOcrStatus,
  isTerminalOcrStatus,
  type OcrCommandJob,
} from "./jobQueue";

function makeJob(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
  return {
    id: "ocr-test",
    inputPath: "/tmp/source.pdf",
    inputPathSummary: { kind: "local-pdf", fingerprint: "abc", redacted: "[path].pdf" },
    outputPath: "/tmp/source-ocr.pdf",
    outputPathSummary: { kind: "local-pdf", fingerprint: "def", redacted: "[path]-ocr.pdf" },
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

describe("OCR job queue helpers", () => {
  test("formats known backend labels", () => {
    expect(formatOcrBackendLabel("local-ocrmypdf")).toBe("本地 ocrmypdf");
    expect(formatOcrBackendLabel("paddleocr")).toBe("PaddleOCR");
    expect(formatOcrBackendLabel("mineru")).toBe("MinerU");
    expect(formatOcrBackendLabel("custom")).toBe("custom");
  });

  test("formats known status labels", () => {
    expect(formatOcrStatusLabel("queued")).toBe("排队中");
    expect(formatOcrStatusLabel("running")).toBe("运行中");
    expect(formatOcrStatusLabel("completed")).toBe("已完成");
    expect(formatOcrStatusLabel("cancelled")).toBe("已取消");
    expect(formatOcrStatusLabel("custom")).toBe("custom");
  });

  test("classifies active vs terminal job status", () => {
    expect(isActiveOcrStatus("queued")).toBe(true);
    expect(isActiveOcrStatus("running")).toBe(true);
    expect(isActiveOcrStatus("dispatching-provider")).toBe(true);
    expect(isActiveOcrStatus("completed")).toBe(false);

    expect(isTerminalOcrStatus("completed")).toBe(true);
    expect(isTerminalOcrStatus("failed")).toBe(true);
    expect(isTerminalOcrStatus("cancelled")).toBe(true);
    expect(isTerminalOcrStatus("running")).toBe(false);
  });

  test("stores redacted summaries without leaking the full path", () => {
    const job = makeJob({
      inputPath: "/Users/secret/Cases, confidential/source.pdf",
      inputPathSummary: { kind: "local-pdf", fingerprint: "deadbeef", redacted: "[path].pdf" },
    });
    expect(job.inputPathSummary.redacted).toBe("[path].pdf");
    expect(job.inputPathSummary.redacted).not.toContain("secret");
  });
});
