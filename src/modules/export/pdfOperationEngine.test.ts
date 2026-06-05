import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AnnotationSidecar, PdfAnnotation, PdfPageOperation } from "../../shared";
import { createPdfOperationEngine } from "./pdfOperationEngine";
import { resetFontkitCache } from "../../shared/pdf/fontLoader";

vi.mock("../../../assets/fonts/SourceHanSansSC-Regular.otf?arraybuffer", () => ({
  default: new ArrayBuffer(0),
}));

afterEach(() => {
  resetFontkitCache();
  vi.restoreAllMocks();
});

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
            strategy: "stamp-flood" as never,
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注扁平化不支持的策略");

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

  test("applies text watermark, page numbers, and Bates numbers as delivery tool operations", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-output-tools-1",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "watermark-1",
          type: "watermark",
          watermark: {
            kind: "text",
            text: "CONFIDENTIAL",
            placement: "center",
            fontSize: 28,
            opacity: 0.2,
            rotationDegrees: -35,
          },
        },
        {
          id: "page-number-1",
          type: "page-number",
          format: "Page {page} / {total}",
          placement: "bottom-center",
          startNumber: 1,
        },
        {
          id: "bates-1",
          type: "bates-number",
          prefix: "FARO-",
          startNumber: 120,
          digits: 6,
          placement: "bottom-right",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    expect(outputPdf.getPageCount()).toBe(2);
    expect(result.summary.outputToolPlan?.entries).toEqual([
      {
        operationId: "watermark-1",
        type: "watermark",
        pageIndexes: [0, 1],
        status: "applied",
        label: "CONFIDENTIAL",
      },
      {
        operationId: "page-number-1",
        type: "page-number",
        pageIndexes: [0, 1],
        status: "applied",
        label: "Page 1 / 2, Page 2 / 2",
      },
      {
        operationId: "bates-1",
        type: "bates-number",
        pageIndexes: [0, 1],
        status: "applied",
        label: "FARO-000120, FARO-000121",
      },
    ]);
    expect(outputPdf.getKeywords()).toContain("faropdf:output-tools");
  });

  test("keeps compression presets as a plan-only delivery tool entry", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-compress-plan-1",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "compress-1",
          type: "compress",
          preset: "court-upload",
          mode: "plan-only",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(result.summary.outputToolPlan?.entries).toEqual([
      {
        operationId: "compress-1",
        type: "compress",
        pageIndexes: [0],
        status: "planned",
        label: "court-upload",
      },
    ]);
    expect(result.summary.warnings).toContain("PDF 压缩当前仅生成导出计划，尚未执行图像重编码。");
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

  test("rejects delivery tools with invalid pages", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    await expect(
      engine.exportPdf({
        id: "export-output-tool-page",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "watermark-out-of-range",
            type: "watermark",
            pageIndexes: [1],
            watermark: {
              kind: "text",
              text: "CONFIDENTIAL",
            },
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("交付工具页码超出源 PDF 页数。");
  });

  test("applies compression preset in apply mode and surfaces ratio + image inventory", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-compress-apply",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "compress-apply",
          type: "compress",
          preset: "court-upload",
          mode: "apply",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(2);
    const compressionEntry = result.summary.outputToolPlan?.entries.find(
      (entry) => entry.operationId === "compress-apply",
    );
    expect(compressionEntry).toMatchObject({
      operationId: "compress-apply",
      type: "compress",
      status: "applied",
    });
    expect(compressionEntry?.label ?? "").toMatch(/^court-upload \(ratio /);
    // apply 模式下不再发 plan-only 警告；只断言无空输出。
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  test("applies court-5mb preset in apply mode with target size check", async () => {
    const inputBytes = await createPdfWithBlankPages(2);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-compress-court-5mb",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "compress-court-5mb",
          type: "compress",
          preset: "court-5mb",
          mode: "apply",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(2);
    const entry = result.summary.outputToolPlan?.entries[0];
    expect(entry?.status).toBe("applied");
    expect(entry?.label).toMatch(/^court-5mb \(ratio /);
  });

  test("applies court-20mb preset in plan-only mode as planned entry", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-compress-court-20mb-plan",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "compress-court-20mb-plan",
          type: "compress",
          preset: "court-20mb",
          mode: "plan-only",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(result.summary.outputToolPlan?.entries).toEqual([
      {
        operationId: "compress-court-20mb-plan",
        type: "compress",
        pageIndexes: [0],
        status: "planned",
        label: "court-20mb",
      },
    ]);
  });

  test("rejects invalid page number and Bates numbering inputs", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    await expect(
      engine.exportPdf({
        id: "export-page-number-invalid-start",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "page-number-invalid-start",
            type: "page-number",
            startNumber: Number.NaN,
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("页码起始号必须是正整数。");

    await expect(
      engine.exportPdf({
        id: "export-bates-invalid-digits",
        source: {
          bytes: inputBytes,
          path: "/case/source.pdf",
        },
        destination: {
          type: "bytes",
        },
        operations: [
          {
            id: "bates-invalid-digits",
            type: "bates-number",
            startNumber: 1,
            digits: Number.POSITIVE_INFINITY,
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("Bates 编号位数必须是 0 到 12 的整数。");
  });

  test("embeds CJK text via the Chinese font path (no longer rejects non-Latin)", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-output-tool-cjk",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "watermark-chinese",
          type: "watermark",
          watermark: {
            kind: "text",
            text: "机密文档",
          },
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(1);
    expect(result.summary.outputToolPlan?.entries).toEqual([
      {
        operationId: "watermark-chinese",
        type: "watermark",
        pageIndexes: [0],
        status: "applied",
        label: "机密文档",
      },
    ]);
  });

  test("embeds CJK page number format strings via the Chinese font path", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-page-number-cjk",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "page-number-cjk",
          type: "page-number",
          format: "第 {page} 页 / 共 {total} 页",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(1);
    expect(result.summary.outputToolPlan?.entries[0].label).toBe("第 1 页 / 共 1 页");
  });

  test("embeds CJK bates prefix and suffix via the Chinese font path", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-bates-cjk",
      source: {
        bytes: inputBytes,
        path: "/case/source.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "bates-cjk",
          type: "bates-number",
          prefix: "合同-",
          suffix: "-号",
          startNumber: 1,
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(1);
    expect(result.summary.outputToolPlan?.entries[0].label).toBe("合同-1-号");
  });

  // ==================== flatten-annotations draw 策略测试 ====================

  test("flatten-annotations draw 策略：把批注真实绘制到 PDF 字节流", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const sidecar = createAnnotationSidecar([
      createAnnotation("ann-highlight", "highlight"),
      createAnnotation("ann-note", "note"),
    ]);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-flatten-draw-1",
      source: { bytes: inputBytes, path: "/case/source.pdf" },
      destination: { type: "bytes" },
      operations: [
        {
          id: "flatten-draw-1",
          type: "flatten-annotations",
          sidecar,
          strategy: "draw",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);
    // 输出仍是 1 页（writeAnnotationPdf 不删页）
    expect(outputPdf.getPageCount()).toBe(1);
    // summary 中 annotationPlan 切换到 draw 模式 + 完整 drawnCount
    expect(result.summary.annotationPlan).toMatchObject({
      strategy: "draw",
      annotationCount: 2,
      drawnCount: 2,
      skippedCount: 0,
      skipped: [],
      pageDrawCounts: { 0: 2 },
      fingerprintChecked: false,
    });
    expect(result.summary.annotationPlan?.entries.every((e) => e.status === "applied")).toBe(true);
    // PDF metadata 切换到 flattened 标签
    expect(outputPdf.getKeywords()).toContain("faropdf:annotation-flattened");
    expect(outputPdf.getKeywords()).toContain("faropdf:annotation-drawn:2");
  });

  test("flatten-annotations draw 策略：sidecar 与 source fingerprint 不一致时整体抛错", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const sidecar = createAnnotationSidecar([createAnnotation("ann-mismatch", "highlight")]);
    sidecar.document.fingerprint = "stale-fingerprint";
    const engine = createPdfOperationEngine();

    await expect(
      engine.exportPdf({
        id: "export-flatten-draw-fingerprint",
        source: { bytes: inputBytes, path: "/case/source.pdf", fingerprint: "fresh-fingerprint" },
        destination: { type: "bytes" },
        operations: [
          {
            id: "flatten-draw-fingerprint",
            type: "flatten-annotations",
            sidecar,
            strategy: "draw",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow("批注 sidecar 指纹与源 PDF 不一致。");
  });

  test("flatten-annotations draw 策略：sidecar 越界 pageIndex 抛错（不静默丢弃）", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const sidecar = createAnnotationSidecar([createAnnotation("ann-oob", "highlight")]);
    sidecar.annotations[0].pageIndex = 5;
    const engine = createPdfOperationEngine();

    await expect(
      engine.exportPdf({
        id: "export-flatten-draw-oob",
        source: { bytes: inputBytes, path: "/case/source.pdf" },
        destination: { type: "bytes" },
        operations: [
          {
            id: "flatten-draw-oob",
            type: "flatten-annotations",
            sidecar,
            strategy: "draw",
          },
        ],
        requestedAt: "2026-06-02T00:00:00.000Z",
      }),
    ).rejects.toThrow(/页码.*超出/);
  });

  test("flatten-annotations draw 策略：单个批注被跳过时记录到 warnings + skipped（不抛错）", async () => {
    const inputBytes = await createPdfWithBlankPages(1);
    const sidecar = createAnnotationSidecar([
      createAnnotation("ann-good", "highlight"),
      // 中文 textbox 会因 Helvetica WinAnsi 限制被 skip（非致命）
      createAnnotation("ann-cjk-textbox", "textbox"),
    ]);
    sidecar.annotations[1].content = "中文文本框内容";
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "export-flatten-draw-skip",
      source: { bytes: inputBytes, path: "/case/source.pdf" },
      destination: { type: "bytes" },
      operations: [
        {
          id: "flatten-draw-skip",
          type: "flatten-annotations",
          sidecar,
          strategy: "draw",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(result.summary.annotationPlan?.drawnCount).toBe(1);
    expect(result.summary.annotationPlan?.skippedCount).toBe(1);
    expect(result.summary.annotationPlan?.skipped?.[0].annotationId).toBe("ann-cjk-textbox");
    expect(result.summary.warnings?.some((w) => w.includes("ann-cjk-textbox") && w.includes("未绘制"))).toBe(true);
  });

  // ==================== execute 模式测试 ====================

  test("execute 模式 reorder：重排页面顺序", async () => {
    // 创建 4 页 PDF，每页用不同宽度标记页码（页 0=200, 页 1=210, 页 2=220, 页 3=230）
    const inputBytes = await createPdfWithLabeledPages(4);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "execute-reorder-1",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "page-ops-reorder",
          type: "page-operations",
          operations: [
            {
              id: "reorder-1",
              type: "reorder",
              pageIndexes: [2, 0, 1, 3],
              payload: {},
              createdAt: "2026-06-03T00:00:00.000Z",
            },
          ],
          mode: "execute",
        },
      ],
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    // 输出 PDF 应有 4 页
    expect(outputPdf.getPageCount()).toBe(4);
    // 页序应为 [2, 0, 1, 3]，即宽度依次为 220, 200, 210, 230
    expect(outputPdf.getPage(0).getWidth()).toBe(220);
    expect(outputPdf.getPage(1).getWidth()).toBe(200);
    expect(outputPdf.getPage(2).getWidth()).toBe(210);
    expect(outputPdf.getPage(3).getWidth()).toBe(230);
    // 计划应标记为 applied
    expect(result.summary.pageOperationPlan?.mode).toBe("execute");
    expect(result.summary.pageOperationPlan?.entries[0].status).toBe("applied");
  });

  test("execute 模式 delete：删除指定页面", async () => {
    // 创建 5 页 PDF，删除页 1 和页 3
    const inputBytes = await createPdfWithLabeledPages(5);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "execute-delete-1",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "page-ops-delete",
          type: "page-operations",
          operations: [
            {
              id: "delete-1",
              type: "delete",
              pageIndexes: [1, 3],
              payload: {},
              createdAt: "2026-06-03T00:00:00.000Z",
            },
          ],
          mode: "execute",
        },
      ],
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    // 输出 PDF 应只有 3 页（页 0, 2, 4）
    expect(outputPdf.getPageCount()).toBe(3);
    // 页序应为 [0, 2, 4]，即宽度依次为 200, 220, 240
    expect(outputPdf.getPage(0).getWidth()).toBe(200);
    expect(outputPdf.getPage(1).getWidth()).toBe(220);
    expect(outputPdf.getPage(2).getWidth()).toBe(240);
    expect(result.summary.pageOperationPlan?.entries[0].status).toBe("applied");
  });

  test("execute 模式 rotate：旋转指定页面", async () => {
    // 创建 2 页 PDF，旋转页 0 角度 90
    const inputBytes = await createPdfWithLabeledPages(2);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "execute-rotate-1",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "page-ops-rotate",
          type: "page-operations",
          operations: [
            {
              id: "rotate-1",
              type: "rotate",
              pageIndexes: [0],
              payload: { angle: 90 },
              createdAt: "2026-06-03T00:00:00.000Z",
            },
          ],
          mode: "execute",
        },
      ],
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    // 页数不变
    expect(outputPdf.getPageCount()).toBe(2);
    // 计划标记为 applied
    expect(result.summary.pageOperationPlan?.entries[0].status).toBe("applied");
    // 页 0 应有 Rotate=90，页 1 无旋转（Rotate 不存在或为 0）
    const page0Rotation = outputPdf.getPage(0).getRotation().angle;
    const page1Rotation = outputPdf.getPage(1).getRotation().angle;
    expect(page0Rotation).toBe(90);
    expect(page1Rotation).toBe(0);
  });

  test("execute 模式 reorder + delete + rotate 组合操作", async () => {
    // 创建 6 页 PDF（页 0-5，宽度 200-250）
    // reorder 为 [5, 4, 3, 2, 1, 0]（倒序）
    // delete 页 0 和页 5（从 reorder 结果中过滤掉原始页 0 和 5）
    // rotate 页 1（原始页 1，角度 180）
    // 最终页序：从 [5,4,3,2,1,0] 过滤掉 0 和 5 → [4,3,2,1]
    const inputBytes = await createPdfWithLabeledPages(6);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "execute-combo-1",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "page-ops-combo",
          type: "page-operations",
          operations: [
            {
              id: "reorder-combo",
              type: "reorder",
              pageIndexes: [5, 4, 3, 2, 1, 0],
              payload: {},
              createdAt: "2026-06-03T00:00:00.000Z",
            },
            {
              id: "delete-combo",
              type: "delete",
              pageIndexes: [0, 5],
              payload: {},
              createdAt: "2026-06-03T00:00:00.000Z",
            },
            {
              id: "rotate-combo",
              type: "rotate",
              pageIndexes: [1],
              payload: { angle: 180 },
              createdAt: "2026-06-03T00:00:00.000Z",
            },
          ],
          mode: "execute",
        },
      ],
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    // 最终页序 [4, 3, 2, 1]，宽度依次 240, 230, 220, 210
    expect(outputPdf.getPageCount()).toBe(4);
    expect(outputPdf.getPage(0).getWidth()).toBe(240);
    expect(outputPdf.getPage(1).getWidth()).toBe(230);
    expect(outputPdf.getPage(2).getWidth()).toBe(220);
    expect(outputPdf.getPage(3).getWidth()).toBe(210);
    // 原始页 1（输出中第 3 页，宽度 210）应被旋转 180 度
    expect(outputPdf.getPage(3).getRotation().angle).toBe(180);
    // 其他页无旋转
    expect(outputPdf.getPage(0).getRotation().angle).toBe(0);
    expect(outputPdf.getPage(1).getRotation().angle).toBe(0);
    expect(outputPdf.getPage(2).getRotation().angle).toBe(0);
    // 三个操作都标记为 applied
    expect(result.summary.pageOperationPlan?.entries).toHaveLength(3);
    expect(result.summary.pageOperationPlan?.entries.every((e) => e.status === "applied")).toBe(true);
  });

  test("execute 模式空操作：operations 为空时输出与输入一致", async () => {
    const inputBytes = await createPdfWithLabeledPages(2);
    const engine = createPdfOperationEngine();

    const result = await engine.exportPdf({
      id: "execute-empty-1",
      source: { bytes: inputBytes },
      destination: { type: "bytes" },
      operations: [
        {
          id: "page-ops-empty",
          type: "page-operations",
          operations: [],
          mode: "execute",
        },
      ],
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    const outputPdf = await PDFDocument.load(result.bytes);

    // 输出应与输入完全一致：2 页，顺序不变
    expect(outputPdf.getPageCount()).toBe(2);
    expect(outputPdf.getPage(0).getWidth()).toBe(200);
    expect(outputPdf.getPage(1).getWidth()).toBe(210);
    // 计划存在但操作数为 0
    expect(result.summary.pageOperationPlan?.mode).toBe("execute");
    expect(result.summary.pageOperationPlan?.operationCount).toBe(0);
    expect(result.summary.pageOperationPlan?.entries).toHaveLength(0);
  });

  test("execute 模式页码越界：正确报错", async () => {
    const inputBytes = await createPdfWithBlankPages(3);
    const engine = createPdfOperationEngine();

    // delete 操作引用不存在的页码
    await expect(
      engine.exportPdf({
        id: "execute-oob-delete",
        source: { bytes: inputBytes },
        destination: { type: "bytes" },
        operations: [
          {
            id: "page-ops-oob-delete",
            type: "page-operations",
            operations: [
              {
                id: "delete-oob",
                type: "delete",
                pageIndexes: [0, 5],
                payload: {},
                createdAt: "2026-06-03T00:00:00.000Z",
              },
            ],
            mode: "execute",
          },
        ],
        requestedAt: "2026-06-03T00:00:00.000Z",
      }),
    ).rejects.toThrow("页面操作页码超出源 PDF 页数。");

    // rotate 操作引用不存在的页码
    await expect(
      engine.exportPdf({
        id: "execute-oob-rotate",
        source: { bytes: inputBytes },
        destination: { type: "bytes" },
        operations: [
          {
            id: "page-ops-oob-rotate",
            type: "page-operations",
            operations: [
              {
                id: "rotate-oob",
                type: "rotate",
                pageIndexes: [3],
                payload: { angle: 90 },
                createdAt: "2026-06-03T00:00:00.000Z",
              },
            ],
            mode: "execute",
          },
        ],
        requestedAt: "2026-06-03T00:00:00.000Z",
      }),
    ).rejects.toThrow("页面操作页码超出源 PDF 页数。");

    // reorder 操作引用不存在的页码
    await expect(
      engine.exportPdf({
        id: "execute-oob-reorder",
        source: { bytes: inputBytes },
        destination: { type: "bytes" },
        operations: [
          {
            id: "page-ops-oob-reorder",
            type: "page-operations",
            operations: [
              {
                id: "reorder-oob",
                type: "reorder",
                pageIndexes: [0, 1, 99],
                payload: {},
                createdAt: "2026-06-03T00:00:00.000Z",
              },
            ],
            mode: "execute",
          },
        ],
        requestedAt: "2026-06-03T00:00:00.000Z",
      }),
    ).rejects.toThrow("页面操作页码超出源 PDF 页数。");

    // 负数页码
    await expect(
      engine.exportPdf({
        id: "execute-oob-negative",
        source: { bytes: inputBytes },
        destination: { type: "bytes" },
        operations: [
          {
            id: "page-ops-oob-negative",
            type: "page-operations",
            operations: [
              {
                id: "rotate-negative",
                type: "rotate",
                pageIndexes: [-1],
                payload: { angle: 90 },
                createdAt: "2026-06-03T00:00:00.000Z",
              },
            ],
            mode: "execute",
          },
        ],
        requestedAt: "2026-06-03T00:00:00.000Z",
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

/**
 * 创建每页宽度不同的 PDF，方便通过宽度识别页码。
 * 页 i 的宽度为 200 + i * 10，高度固定 200。
 */
async function createPdfWithLabeledPages(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const width = 200 + pageIndex * 10;
    pdf.addPage([width, 200]);
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
