import { PDFDocument } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import { createMemoryPdfExportStorage, createPdfExportService, type PdfExportStorage } from "./pdfExportService";

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

  test("rejects equivalent output paths that resolve back to the source PDF", async () => {
    const inputBytes = await createOnePagePdf();
    const storage = createMemoryPdfExportStorage({
      "/case/source.pdf": inputBytes,
    });
    const service = createPdfExportService({ storage });

    await expect(
      service.exportToPath({
        id: "export-invalid-equivalent",
        inputPath: "/case/source.pdf",
        outputPath: "/case/../case/source.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径不能与原始 PDF 相同");
  });

  test("rejects non-PDF output paths and existing output files", async () => {
    const inputBytes = await createOnePagePdf();
    const existingBytes = await createOnePagePdf();
    const storage = createMemoryPdfExportStorage({
      "/case/source.pdf": inputBytes,
      "/case/existing.pdf": existingBytes,
    });
    const service = createPdfExportService({ storage });

    await expect(
      service.exportToPath({
        id: "export-invalid-extension",
        inputPath: "/case/source.pdf",
        outputPath: "/case/source-exported.docx",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径必须是 PDF。");

    await expect(
      service.exportToPath({
        id: "export-existing",
        inputPath: "/case/source.pdf",
        outputPath: "/case/existing.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径已存在");
  });

  test("rejects relative export paths before storage access", async () => {
    const storage: PdfExportStorage = {
      readFile: vi.fn(async () => createOnePagePdf()),
      writeNewFile: vi.fn(async () => undefined),
      exists: vi.fn(async () => false),
    };
    const service = createPdfExportService({ storage });

    await expect(
      service.exportToPath({
        id: "export-relative",
        inputPath: "/case/source.pdf",
        outputPath: "source-exported.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径必须是绝对路径。");

    expect(storage.readFile).not.toHaveBeenCalled();
  });

  test("uses storage path resolution to reject output aliases that point at the source PDF", async () => {
    const inputBytes = await createOnePagePdf();
    const storage = createMemoryPdfExportStorage({
      "/case/source.pdf": inputBytes,
    });
    const service = createPdfExportService({
      storage: {
        ...storage,
        resolvePath: async (path) => (path === "/case/source-link.pdf" ? "/case/source.pdf" : path),
      } as PdfExportStorage,
    });

    await expect(
      service.exportToPath({
        id: "export-alias",
        inputPath: "/case/source.pdf",
        outputPath: "/case/source-link.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("导出输出路径不能与原始 PDF 相同");
  });

  test("uses exclusive output creation instead of a normal overwrite-capable writer", async () => {
    const inputBytes = await createOnePagePdf();
    const writeNewFile = vi.fn(async () => undefined);
    const storage = {
      readFile: async () => inputBytes,
      writeFile: vi.fn(async () => {
        throw new Error("non-exclusive writer should not be used");
      }),
      writeNewFile,
      exists: async () => false,
      resolvePath: async (path: string) => path,
    } as unknown as PdfExportStorage;
    const service = createPdfExportService({ storage });

    await service.exportToPath({
      id: "export-exclusive",
      inputPath: "/case/source.pdf",
      outputPath: "/case/source-exported.pdf",
      operations: [],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(writeNewFile).toHaveBeenCalledWith("/case/source-exported.pdf", expect.any(Uint8Array));
  });

  test("redacts output path checks and exclusive write failures without keeping raw paths in causes", async () => {
    const inputBytes = await createOnePagePdf();
    const pathCheckFailureStorage: PdfExportStorage = {
      readFile: async () => inputBytes,
      writeNewFile: async () => undefined,
      exists: async () => {
        throw new Error("无法检查 /tmp/faropdf fixtures/output bundle.pdf token=secret-value");
      },
    };
    const exclusiveWriteFailureStorage = {
      readFile: async () => inputBytes,
      writeFile: async () => undefined,
      writeNewFile: async () => {
        throw new Error("无法创建 /tmp/faropdf fixtures/output bundle.pdf token=secret-value");
      },
      exists: async () => false,
      resolvePath: async (path: string) => path,
    } as unknown as PdfExportStorage;

    for (const storage of [pathCheckFailureStorage, exclusiveWriteFailureStorage]) {
      try {
        await createPdfExportService({ storage }).exportToPath({
          id: "export-redacted-check",
          inputPath: "/case/source.pdf",
          outputPath: "/case/source-exported.pdf",
          operations: [],
          requestedAt: "2026-06-02T00:00:00.000Z",
        });
        expect.fail("expected sanitized storage failure");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("[path]");
        expect((error as Error).message).toContain("token=[redacted]");
        expect((error as Error).message).not.toContain("/tmp/faropdf fixtures/output bundle.pdf");
        expect((error as Error).message).not.toContain("secret-value");
        const cause = (error as Error & { cause?: unknown }).cause;
        expect(cause).toBeInstanceOf(Error);
        expect((cause as Error).message).not.toContain("/tmp/faropdf fixtures/output bundle.pdf");
        expect((cause as Error).message).not.toContain("secret-value");
      }
    }
  });

  test("redacts local paths from storage read and write failures", async () => {
    const inputBytes = await createOnePagePdf();
    const readFailureStorage: PdfExportStorage = {
      readFile: async () => {
        throw new Error("无法读取 /tmp/faropdf fixtures/source bundle.pdf");
      },
      writeNewFile: async () => undefined,
      exists: async () => false,
    };
    const writeFailureStorage: PdfExportStorage = {
      readFile: async () => inputBytes,
      writeNewFile: async () => {
        throw new Error("无法写入 /tmp/faropdf fixtures/output bundle.pdf");
      },
      exists: async () => false,
    };

    await expect(
      createPdfExportService({ storage: readFailureStorage }).exportToPath({
        id: "export-read-failure",
        inputPath: "/case/source.pdf",
        outputPath: "/case/source-exported.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("PDF 导出读取失败：无法读取 [path]");

    try {
      await createPdfExportService({ storage: writeFailureStorage }).exportToPath({
        id: "export-write-failure",
        inputPath: "/case/source.pdf",
        outputPath: "/case/source-exported.pdf",
        operations: [],
        requestedAt: "2026-06-02T00:00:00.000Z",
      });
      expect.fail("expected write failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("[path]");
      expect((error as Error).message).not.toContain("/tmp/faropdf fixtures/output bundle.pdf");
      const cause = (error as Error & { cause?: unknown }).cause;
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message).not.toContain("/tmp/faropdf fixtures/output bundle.pdf");
    }
  });
});

async function createOnePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);

  return pdf.save();
}
