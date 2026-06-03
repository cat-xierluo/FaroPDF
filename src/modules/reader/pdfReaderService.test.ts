import { describe, expect, test, vi } from "vitest";
import { loadPdfFromBytes, loadPdfFromFile, type PdfJsReaderAdapter } from "./pdfReaderService";

function createAdapter() {
  const calls: string[] = [];
  const renderMock = vi.fn(async () => ({ promise: Promise.resolve() }));
  const getPage = vi.fn(async (pageNumber: number) => ({
    rotate: pageNumber === 2 ? 90 : 0,
    getTextContent: vi.fn(async () => ({
      items: pageNumber === 1 ? [{ str: "United" }, { str: "States" }, { str: "合同" }, { str: "第一页" }] : [],
    })),
    getViewport: ({ scale }: { scale: number }) => ({
      width: (pageNumber === 1 ? 612 : 700) * scale,
      height: (pageNumber === 1 ? 792 : 500) * scale,
      rotation: pageNumber === 2 ? 90 : 0,
    }),
    render: renderMock,
  }));
  const destroy = vi.fn(async () => undefined);
  const document = {
    numPages: 2,
    fingerprints: ["fingerprint-a", null],
    getPage,
  };
  const loadingTask = { promise: Promise.resolve(document), destroy };
  const adapter: PdfJsReaderAdapter = {
    configureWorker: vi.fn(() => {
      calls.push("worker");
      return "/assets/pdf.worker.mjs";
    }),
    getDocument: vi.fn((params) => {
      calls.push("getDocument");
      expect(calls).toEqual(["worker", "getDocument"]);
      expect(params.data).toBeInstanceOf(Uint8Array);
      return loadingTask;
    }),
  };

  return { adapter, destroy, getPage, renderMock };
}

describe("pdfReaderService", () => {
  test("loads PDF bytes through a configured PDF.js worker and reads first page metadata", async () => {
    const { adapter, destroy, getPage } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      {
        data,
        fileName: "case.pdf",
        filePath: "/case/case.pdf",
      },
      adapter,
    );

    expect(adapter.configureWorker).toHaveBeenCalledOnce();
    expect(adapter.getDocument).toHaveBeenCalledOnce();
    expect(getPage).toHaveBeenCalledWith(1);
    expect(loaded.metadata).toEqual({
      fileName: "case.pdf",
      filePath: "/case/case.pdf",
      fingerprint: "fingerprint-a",
      pageCount: 2,
      initialViewport: {
        pageIndex: 0,
        width: 612,
        height: 792,
        rotation: 0,
        scale: 1,
      },
      textLayerStatus: "available",
    });

    await expect(loaded.getPageViewport(1, 1.25)).resolves.toEqual({
      pageIndex: 1,
      width: 875,
      height: 625,
      rotation: 90,
      scale: 1.25,
    });
    const expectedPageText = "United States合同第一页";

    await expect(loaded.getPageText(0)).resolves.toEqual({
      pageIndex: 0,
      text: expectedPageText,
      status: "available",
      itemCount: 4,
      charCount: expectedPageText.length,
    });
    await expect(loaded.getPageText(1)).resolves.toEqual({
      pageIndex: 1,
      text: "",
      status: "missing",
      itemCount: 0,
      charCount: 0,
    });
    await loaded.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  test("loads a browser File by converting it to Uint8Array data", async () => {
    const { adapter } = createAdapter();
    const file = new File([new Uint8Array([4, 5, 6])], "motion.pdf", {
      type: "application/pdf",
    });

    const loaded = await loadPdfFromFile(file, adapter);

    expect(loaded.metadata.fileName).toBe("motion.pdf");
    expect(adapter.getDocument).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    });
  });

  test("renderPageToCanvas calls PDF.js page.render with correct parameters", async () => {
    const { adapter, renderMock } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      { data, fileName: "render-test.pdf" },
      adapter,
    );

    // 创建模拟 canvas 元素
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ fillRect: vi.fn() })),
    } as unknown as HTMLCanvasElement;

    await loaded.renderPageToCanvas(0, canvas, 1.5);

    // 验证 canvas 尺寸已按 zoom 缩放设置
    expect(canvas.width).toBe(612 * 1.5);
    expect(canvas.height).toBe(792 * 1.5);
    // 验证调用了 getContext('2d')
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
    // 验证 PDF.js page.render 被调用
    expect(renderMock).toHaveBeenCalledOnce();
    const renderArgs = renderMock.mock.calls[0][0];
    expect(renderArgs).toHaveProperty("canvasContext");
    expect(renderArgs).toHaveProperty("viewport");
    expect(renderArgs.viewport.width).toBe(612 * 1.5);
    expect(renderArgs.viewport.height).toBe(792 * 1.5);

    await loaded.destroy();
  });

  test("renderPageToCanvas uses 1-based page numbers for PDF.js", async () => {
    const { adapter, getPage } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      { data, fileName: "page-number-test.pdf" },
      adapter,
    );

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({})),
    } as unknown as HTMLCanvasElement;

    // pageIndex 1 应该调用 getPage(2)
    await loaded.renderPageToCanvas(1, canvas, 1);
    expect(getPage).toHaveBeenCalledWith(2);

    await loaded.destroy();
  });
});
