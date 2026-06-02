import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import type { AnnotationSidecar, PdfAnnotation, PdfPageOperation } from "../../shared";
import { createPdfOperationEngine } from "./pdfOperationEngine";

describe("pdf operation engine", () => {
  test("copies PDF bytes into a valid new PDF byte result", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const inputSnapshot = Array.from(inputBytes);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-copy-1",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    expect(Array.from(inputBytes)).toEqual(inputSnapshot);
    expect(result.bytes).not.toBe(inputBytes);
    expect(result.bytes[0]).toBe(0x25);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(result.summary.inputPageCount).toBe(2);
    expect(result.summary.outputPageCount).toBe(2);
  });

  test("associates annotation sidecar data with a plan-only flatten summary and PDF metadata", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const sidecar = createAnnotationSidecar([
      createAnnotation("ann-highlight", "highlight"),
      createAnnotation("ann-note", "note"),
    ]);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-annotations-1",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "flatten-ann-1",
          type: "flatten-annotations",
          sidecar,
          strategy: "plan-only",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    expect(result.summary.annotationPlan).toMatchObject({
      strategy: "plan-only",
      annotationCount: 2,
      entries: [
        {
          annotationId: "ann-highlight",
          type: "highlight",
          pageIndex: 0,
          rectCount: 1,
          status: "planned",
        },
        {
          annotationId: "ann-note",
          type: "note",
          pageIndex: 0,
          rectCount: 1,
          status: "planned",
        },
      ],
    });
    expect(outputPdf.getSubject()).toContain("annotation plan-only");
    expect(outputPdf.getKeywords()).toContain("faropdf:annotation-plan-only");
  });

  test("rejects annotation plans that do not match the source PDF", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();
    const sidecar = createAnnotationSidecar([createAnnotation("ann-out-of-range", "highlight")]);
    sidecar.document.pageCount = 2;

    await expect(
      engine.exportPdf({
        id: "export-annotation-mismatch",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
          fingerprint: "fixture",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "flatten-ann-mismatch",
            type: "flatten-annotations",
            sidecar,
            strategy: "plan-only",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注 sidecar 页数与源 PDF 不一致。");

    sidecar.document.pageCount = 1;
    sidecar.document.fingerprint = "other-fixture";

    await expect(
      engine.exportPdf({
        id: "export-annotation-fingerprint",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
          fingerprint: "fixture",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "flatten-ann-fingerprint",
            type: "flatten-annotations",
            sidecar,
            strategy: "plan-only",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注 sidecar 指纹与源 PDF 不一致。");
  });

  test("rejects unsupported annotation flatten strategy and out-of-range annotation pages", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();
    const sidecar = createAnnotationSidecar([createAnnotation("ann-out-of-range", "highlight")]);

    await expect(
      engine.exportPdf({
        id: "export-annotation-strategy",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "flatten-ann-strategy",
            type: "flatten-annotations",
            sidecar,
            strategy: "draw",
          } as never,
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注扁平化第一版只支持 plan-only 策略。");

    sidecar.annotations[0].pageIndex = 1;

    await expect(
      engine.exportPdf({
        id: "export-annotation-page",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "flatten-ann-page",
            type: "flatten-annotations",
            sidecar,
            strategy: "plan-only",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注页码超出源 PDF 页数。");
  });

  test("flattens AcroForm fields when the form flatten operation is requested", async () => {
    const inputBytes = await createPdfWithTextField();
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-form-1",
      source: {
        bytes: inputBytes,
        path: "/case/form.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "flatten-form-1",
          type: "flatten-form",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    expect(outputPdf.getForm().getFields()).toHaveLength(0);
    expect(result.summary.formFlattening).toEqual({
      requested: true,
      flattened: true,
      fieldCountBeforeFlatten: 1,
    });
  });

  test("keeps page operations as a validated plan entry when page manipulation is not yet applied", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const pageOperation: PdfPageOperation = {
      id: "page-op-1",
      type: "rotate",
      pageIndexes: [0],
      payload: { angle: 90 },
      createdAt: "2026-06-02T00:00:00.000Z",
    };
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-pages-1",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "page-plan-1",
          type: "page-operations",
          operations: [pageOperation],
          mode: "plan-only",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(result.summary.pageOperationPlan).toEqual({
      mode: "plan-only",
      operationCount: 1,
      entries: [
        {
          operationId: "page-op-1",
          type: "rotate",
          pageIndexes: [0],
          status: "planned",
        },
      ],
    });
    expect(result.summary.warnings).toContain("页面操作当前仅生成导出计划，尚未改写页面几何或顺序。");
  });

  test("rejects unsupported page operation mode and out-of-range page indexes", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const engine = createPdfOperationEngine();
    const pageOperation: PdfPageOperation = {
      id: "page-op-invalid",
      type: "rotate",
      pageIndexes: [2],
      payload: { angle: 90 },
      createdAt: "2026-06-02T00:00:00.000Z",
    };

    await expect(
      engine.exportPdf({
        id: "export-pages-mode",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "page-plan-mode",
            type: "page-operations",
            operations: [pageOperation],
            mode: "apply",
          } as never,
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("页面操作导出第一版只支持 plan-only 模式。");

    await expect(
      engine.exportPdf({
        id: "export-pages-out-of-range",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "page-plan-out-of-range",
            type: "page-operations",
            operations: [pageOperation],
            mode: "plan-only",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("页面操作页码超出源 PDF 页数。");
  });
});

async function createPdfWithBlankPages(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    pdf.addPage([200, 200]);
  }

  return pdf.save();
}

async function createPdfWithTextField(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 200]);
  const form = pdf.getForm();
  const field = form.createTextField("client_name");

  field.setText("FaroPDF");
  field.addToPage(page, {
    x: 20,
    y: 120,
    width: 180,
    height: 24,
  });

  return pdf.save();
}

function createAnnotationSidecar(annotations: PdfAnnotation[]): AnnotationSidecar {
  return {
    schemaVersion: 1,
    document: {
      fingerprint: "fixture",
      pageCount: 1,
    },
    annotations,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}

function createAnnotation(id: string, type: PdfAnnotation["type"]): PdfAnnotation {
  return {
    id,
    type,
    pageIndex: 0,
    rects: [{ x: 10, y: 20, width: 100, height: 16 }],
    color: "#f7d46a",
    opacity: 0.4,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}
