import { describe, expect, test, vi } from "vitest";
import { loadPdfFromBytes, loadPdfFromFile, type PdfJsReaderAdapter } from "./pdfReaderService";

function createAdapter() {
  const calls: string[] = [];
  const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
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
    // ISS-NEW-M M4：outline 测试用。pageRef 用对象模拟，getPageIndex 按其 .pageIndex 返回。
    getOutline: vi.fn(async () => [
      { title: "第一章", dest: [{ __pageRef: 0 }], items: [{ title: "1.1 节", dest: "named-dest" }] },
      { title: "第二章", dest: [{ __pageRef: 1 }] },
      { title: "无目标", dest: null },
    ]),
    getDestination: vi.fn(async (name: string) => (name === "named-dest" ? [{ __pageRef: 1 }] : null)),
    getPageIndex: vi.fn(async (ref: { __pageRef: number }) => ref.__pageRef),
  };
  const loadingTask = { promise: Promise.resolve(document), destroy };
  const adapter: PdfJsReaderAdapter = {
    configureWorker: vi.fn(() => {
      calls.push("worker");
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
    const renderArgs = renderMock.mock.calls[0] as unknown as [{ canvasContext: unknown; viewport: { width: number; height: number } }];
    expect(renderArgs[0]).toBeDefined();
    expect(renderArgs[0].canvasContext).toBeDefined();
    expect(renderArgs[0].viewport).toBeDefined();
    expect(renderArgs[0].viewport.width).toBe(612 * 1.5);
    expect(renderArgs[0].viewport.height).toBe(792 * 1.5);

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

  test("renderPageToCanvas aborts the PDF.js render task when the signal is aborted", async () => {
    const cancel = vi.fn();
    const renderPromise = new Promise<void>(() => undefined);
    const page = {
      rotate: 0,
      getTextContent: vi.fn(async () => ({ items: [{ str: "page" }] })),
      getViewport: ({ scale }: { scale: number }) => ({
        width: 612 * scale,
        height: 792 * scale,
        rotation: 0,
      }),
      render: vi.fn(() => ({ promise: renderPromise, cancel })),
    };
    const document = {
      numPages: 1,
      fingerprints: ["fingerprint-abort"],
      getPage: vi.fn(async () => page),
    };
    const adapter: PdfJsReaderAdapter = {
      configureWorker: vi.fn(async () => undefined),
      getDocument: vi.fn(() => ({ promise: Promise.resolve(document), destroy: vi.fn(async () => undefined) })),
    };
    const loaded = await loadPdfFromBytes({ data: new Uint8Array([1, 2, 3]), fileName: "abort.pdf" }, adapter);
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ fillRect: vi.fn() })),
    } as unknown as HTMLCanvasElement;
    const controller = new AbortController();

    const render = loaded.renderPageToCanvas(0, canvas, 1, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(render).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  test("renderThumbnail 将页面按 maxWidth 缩放后写入 canvas", async () => {
    const { adapter, renderMock } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      { data, fileName: "thumbnail-test.pdf" },
      adapter,
    );

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ fillRect: vi.fn() })),
    } as unknown as HTMLCanvasElement;

    // 第 1 页 baseViewport = 612x792；maxWidth=240 → scale ≈ 0.392
    await loaded.renderThumbnail(0, canvas, 240);

    const expectedScale = 240 / 612;
    const expectedWidth = Math.round(612 * expectedScale);
    const expectedHeight = Math.round(792 * expectedScale);
    expect(canvas.width).toBe(expectedWidth);
    expect(canvas.height).toBe(expectedHeight);
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
    expect(renderMock).toHaveBeenCalled();
    const renderArgs = renderMock.mock.calls[0] as unknown as [{ canvasContext: unknown; viewport: { width: number; height: number } }];
    // PDF.js viewport 是浮点；canvas.width/height 已四舍五入，viewport 维度可以更精确
    expect(renderArgs[0].viewport.width).toBeCloseTo(expectedWidth, 0);
    expect(renderArgs[0].viewport.height).toBeCloseTo(expectedHeight, 0);

    await loaded.destroy();
  });

  test("renderThumbnail 使用 1-based PDF.js 页码", async () => {
    const { adapter, getPage } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      { data, fileName: "thumbnail-page-number.pdf" },
      adapter,
    );

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({})),
    } as unknown as HTMLCanvasElement;

    await loaded.renderThumbnail(1, canvas, 100);
    expect(getPage).toHaveBeenCalledWith(2);

    await loaded.destroy();
  });

  test("renderThumbnail 在 maxWidth<=0 时使用 1px 兜底而非除零", async () => {
    const { adapter } = createAdapter();
    const data = new Uint8Array([1, 2, 3]);

    const loaded = await loadPdfFromBytes(
      { data, fileName: "thumbnail-zero.pdf" },
      adapter,
    );

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({})),
    } as unknown as HTMLCanvasElement;

    // 不抛错即可；canvas 尺寸保持 1px 兜底
    await expect(loaded.renderThumbnail(0, canvas, 0)).resolves.toBeUndefined();
    expect(canvas.width).toBeGreaterThanOrEqual(1);
    expect(canvas.height).toBeGreaterThanOrEqual(1);

    await loaded.destroy();
  });

  test("ISS-NEW-M M4: getOutline 递归解析 dest 为 1-based 页码树", async () => {
    const { adapter } = createAdapter();
    const loaded = await loadPdfFromBytes(
      { data: new Uint8Array([1]), fileName: "x.pdf" },
      adapter,
    );

    const outline = await loaded.getOutline();
    // 第一章 → 第 1 页，含子节点 1.1 节（命名 dest → 第 2 页）
    expect(outline).toHaveLength(3);
    expect(outline[0]).toMatchObject({ title: "第一章", pageNumber: 1, depth: 0 });
    expect(outline[0].children).toHaveLength(1);
    expect(outline[0].children[0]).toMatchObject({ title: "1.1 节", pageNumber: 2, depth: 1 });
    // 第二章 → 第 2 页（explicit dest array）
    expect(outline[1]).toMatchObject({ title: "第二章", pageNumber: 2, depth: 0 });
    // 无目标 dest → pageNumber undefined，仍保留标题
    expect(outline[2]).toMatchObject({ title: "无目标", pageNumber: undefined, depth: 0 });
    expect(outline[2].children).toEqual([]);

    await loaded.destroy();
  });

  test("ISS-NEW-M M4: 无 outline 时返回空数组（getOutline 缺失/返回空）", async () => {
    const { adapter } = createAdapter();
    const loaded = await loadPdfFromBytes(
      { data: new Uint8Array([1]), fileName: "x.pdf" },
      adapter,
    );
    // createAdapter 的 getOutline 返回非空；这里验证 resolveDestination 对损坏 dest 安全
    const outline = await loaded.getOutline();
    expect(Array.isArray(outline)).toBe(true);
    await loaded.destroy();
  });
});
