import { describe, expect, test, vi } from "vitest";
import { loadPdfFromBytes, loadPdfFromFile, type PdfJsReaderAdapter } from "./pdfReaderService";

function createAdapter() {
  const calls: string[] = [];
  const getPage = vi.fn(async (pageNumber: number) => ({
    rotate: pageNumber === 2 ? 90 : 0,
    getTextContent: vi.fn(async () => ({
      items: pageNumber === 1 ? [{ str: "合同" }] : [],
    })),
    getViewport: ({ scale }: { scale: number }) => ({
      width: (pageNumber === 1 ? 612 : 700) * scale,
      height: (pageNumber === 1 ? 792 : 500) * scale,
      rotation: pageNumber === 2 ? 90 : 0,
    }),
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

  return { adapter, destroy, getPage };
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
});
