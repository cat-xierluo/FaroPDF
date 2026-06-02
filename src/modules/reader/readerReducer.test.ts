import { describe, expect, test } from "vitest";
import type { ReaderLoadedMetadata } from "../../shared/pdf/reader";
import { createInitialReaderState, readerReducer } from "./readerState";

const loadedMetadata: ReaderLoadedMetadata = {
  fileName: "evidence.pdf",
  filePath: "/case/evidence.pdf",
  fingerprint: "fingerprint-a",
  pageCount: 12,
  initialViewport: {
    pageIndex: 0,
    width: 612,
    height: 792,
    rotation: 0,
    scale: 1,
  },
  textLayerStatus: "available",
};

describe("readerReducer", () => {
  test("records document state when a PDF is loaded", () => {
    const state = readerReducer(
      createInitialReaderState({ defaultZoom: 1.25, defaultViewMode: "double" }),
      { type: "reader/loadSucceeded", payload: loadedMetadata },
    );

    expect(state.status).toBe("ready");
    expect(state.document).toMatchObject({
      path: "/case/evidence.pdf",
      name: "evidence.pdf",
      fingerprint: "fingerprint-a",
      pageCount: 12,
      currentPage: 1,
      zoom: 1.25,
      viewMode: "double",
      dirty: false,
      textLayerStatus: "available",
      ocrStatus: "not-needed",
    });
    expect(state.pageViewports).toEqual([loadedMetadata.initialViewport]);
    expect(state.renderRange.pageNumbers).toEqual([1, 2, 3, 4]);
  });

  test("clamps page navigation to the loaded document", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: loadedMetadata,
    });

    const afterTooLarge = readerReducer(loaded, {
      type: "reader/setCurrentPage",
      payload: { currentPage: 99 },
    });
    const afterTooSmall = readerReducer(afterTooLarge, {
      type: "reader/setCurrentPage",
      payload: { currentPage: -5 },
    });

    expect(afterTooLarge.document?.currentPage).toBe(12);
    expect(afterTooSmall.document?.currentPage).toBe(1);
  });

  test("updates zoom, view mode, and text layer status without losing document identity", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: loadedMetadata,
    });
    const zoomed = readerReducer(loaded, {
      type: "reader/setZoom",
      payload: { zoom: 1.5 },
    });
    const singlePage = readerReducer(zoomed, {
      type: "reader/setViewMode",
      payload: { viewMode: "single" },
    });
    const missingText = readerReducer(singlePage, {
      type: "reader/setTextLayerStatus",
      payload: { textLayerStatus: "missing" },
    });

    expect(missingText.document).toMatchObject({
      name: "evidence.pdf",
      zoom: 1.5,
      viewMode: "single",
      textLayerStatus: "missing",
    });
    expect(missingText.renderRange.pageNumbers).toEqual([1, 2, 3]);
  });
});
