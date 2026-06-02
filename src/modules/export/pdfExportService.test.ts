import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { createMemoryPdfExportStorage, createPdfExportService } from "./pdfExportService";

describe("pdf export service", () => {
  test("writes exported PDF bytes to a new output path without overwriting the source", async () => {
    const inputBytes = await createOnePagePdf();
    const storage = createMemoryPdfExportStorage({
      "/case/source.pdf": inputBytes,
    });
    const service = createPdfExportService({ storage });

    const result = await service.exportToPath({
      id: "export-copy-1",
      inputPath: "/case/source.pdf",
      outputPath: "/case/source-exported.pdf",
      operations: [],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const sourceAfterExport = await storage.readFile("/case/source.pdf");
    const exportedBytes = await storage.readFile("/case/source-exported.pdf");
    const exportedPdf = await PDFDocument.load(exportedBytes);

    expect(Array.from(sourceAfterExport)).toEqual(Array.from(inputBytes));
    expect(result.destination).toEqual({
      type: "file",
      outputPath: "/case/source-exported.pdf",
    });
    expect(exportedBytes.length).toBeGreaterThan(0);
    expect(exportedPdf.getPageCount()).toBe(1);
  });

  test("rejects export requests that would overwrite the source PDF path", async () => {
    const inputBytes = await createOnePagePdf();
    const storage = createMemoryPdfExportStorage({
      "/case/source.pdf": inputBytes,
    });
    const service = createPdfExportService({ storage });

    await expect(
      service.exportToPath({
        id: "export-invalid-1",
        inputPath: "/case/source.pdf",
        outputPath: "/case/source.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径不能与原始 PDF 相同");
  });
});

async function createOnePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);

  return pdf.save();
}

