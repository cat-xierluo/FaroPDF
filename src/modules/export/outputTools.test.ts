import { describe, expect, test } from "vitest";
import { createPdfOutputToolsExportRequest, suggestPdfOutputToolsPath } from "./outputTools";

const FIXED_TIME = "2026-06-02T00:00:00.000Z";

describe("PDF output tools export request", () => {
  test("builds a safe delivery tools export request", () => {
    const request = createPdfOutputToolsExportRequest({
      id: "delivery-tools-1",
      inputPath: "/case/source.pdf",
      fingerprint: "fixture",
      requestedAt: FIXED_TIME,
      operations: [
        {
          id: "watermark-1",
          type: "watermark",
          watermark: {
            kind: "text",
            text: "CONFIDENTIAL",
            placement: "center",
          },
        },
        {
          id: "bates-1",
          type: "bates-number",
          prefix: "CASE-",
          startNumber: 1,
          digits: 5,
          placement: "bottom-right",
        },
      ],
    });

    expect(request).toEqual({
      id: "delivery-tools-1",
      inputPath: "/case/source.pdf",
      outputPath: "/case/source-delivery.pdf",
      fingerprint: "fixture",
      requestedAt: FIXED_TIME,
      operations: [
        {
          id: "watermark-1",
          type: "watermark",
          watermark: {
            kind: "text",
            text: "CONFIDENTIAL",
            placement: "center",
          },
        },
        {
          id: "bates-1",
          type: "bates-number",
          prefix: "CASE-",
          startNumber: 1,
          digits: 5,
          placement: "bottom-right",
        },
      ],
    });
  });

  test("rejects unsafe delivery tool paths and empty tool sets", () => {
    expect(suggestPdfOutputToolsPath("/case/source.pdf")).toBe("/case/source-delivery.pdf");

    expect(() =>
      createPdfOutputToolsExportRequest({
        inputPath: "/case/source.pdf",
        outputPath: "source-delivery.pdf",
        requestedAt: FIXED_TIME,
        operations: [
          {
            id: "page-number-1",
            type: "page-number",
          },
        ],
      }),
    ).toThrow("交付工具输出路径必须是绝对路径。");

    expect(() =>
      createPdfOutputToolsExportRequest({
        inputPath: "/case/source.pdf",
        outputPath: "/case/nested/../source.pdf",
        requestedAt: FIXED_TIME,
        operations: [
          {
            id: "page-number-1",
            type: "page-number",
          },
        ],
      }),
    ).toThrow("交付工具输出 PDF 必须是不同于原始 PDF 的新文件。");

    expect(() =>
      createPdfOutputToolsExportRequest({
        inputPath: "/case/source.pdf",
        requestedAt: FIXED_TIME,
        operations: [],
      }),
    ).toThrow("至少需要选择一个 PDF 交付工具。");
  });
});
