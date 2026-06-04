import { describe, expect, test } from "vitest";
import type { ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type { ReaderSession } from "../../shared/pdf/types";
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

function makeSession(overrides: Partial<ReaderSession> = {}): ReaderSession {
  return {
    fingerprint: "fingerprint-a",
    currentPage: 7,
    zoom: 1.5,
    viewMode: "fit-width",
    rotation: 90,
    savedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("readerReducer", () => {
  test("records document state when a PDF is loaded", () => {
    const state = readerReducer(
      createInitialReaderState({ defaultZoom: 1.25, defaultViewMode: "double" }),
      { type: "reader/loadSucceeded", payload: { documentId: "document-1", metadata: loadedMetadata } },
    );

    expect(state.status).toBe("ready");
    expect(state.document).toMatchObject({
      path: "/case/evidence.pdf",
      documentId: "document-1",
      name: "evidence.pdf",
      fingerprint: "fingerprint-a",
      pageCount: 12,
      currentPage: 1,
      zoom: 1.25,
      viewMode: "double",
      rotation: 0,
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
      payload: { documentId: "document-1", metadata: loadedMetadata },
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
      payload: { documentId: "document-1", metadata: loadedMetadata },
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

  test("clamps zoom to [0.25, 4] 范围", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    const tooSmall = readerReducer(loaded, { type: "reader/setZoom", payload: { zoom: 0.01 } });
    const tooBig = readerReducer(loaded, { type: "reader/setZoom", payload: { zoom: 10 } });
    expect(tooSmall.document?.zoom).toBe(0.25);
    expect(tooBig.document?.zoom).toBe(4);
  });

  test("setRotation 写入指定角度", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    const rotated = readerReducer(loaded, { type: "reader/setRotation", payload: { rotation: 180 } });
    expect(rotated.document?.rotation).toBe(180);
  });

  test("rotate 顺时针累加 90 度，跨 360 回到 0", () => {
    let state = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    state = readerReducer(state, { type: "reader/rotate", payload: { direction: "clockwise" } });
    expect(state.document?.rotation).toBe(90);
    state = readerReducer(state, { type: "reader/rotate", payload: { direction: "clockwise" } });
    expect(state.document?.rotation).toBe(180);
    state = readerReducer(state, { type: "reader/rotate", payload: { direction: "clockwise" } });
    expect(state.document?.rotation).toBe(270);
    state = readerReducer(state, { type: "reader/rotate", payload: { direction: "clockwise" } });
    expect(state.document?.rotation).toBe(0);
  });

  test("rotate 逆时针累减 90 度，跨 0 回到 270", () => {
    let state = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    state = readerReducer(state, { type: "reader/rotate", payload: { direction: "counter-clockwise" } });
    expect(state.document?.rotation).toBe(270);
  });

  test("applySession 仅在 fingerprint 匹配时覆盖 currentPage/zoom/viewMode/rotation", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    const restored = readerReducer(loaded, {
      type: "reader/applySession",
      payload: { session: makeSession({ currentPage: 9, zoom: 1.75, viewMode: "fit-width", rotation: 90 }) },
    });
    expect(restored.document).toMatchObject({
      currentPage: 9,
      zoom: 1.75,
      viewMode: "fit-width",
      rotation: 90,
    });
    // fit-width 视为单页，overscan 默认 2，所以是 [7, 8, 9, 10, 11]
    expect(restored.renderRange.pageNumbers).toEqual([7, 8, 9, 10, 11]);
  });

  test("applySession 在 fingerprint 不匹配时不做任何修改", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    const sameState = readerReducer(loaded, {
      type: "reader/applySession",
      payload: { session: makeSession({ fingerprint: "other-fp" }) },
    });
    expect(sameState).toEqual(loaded);
  });

  test("applySession 对超界 currentPage 应用 clampPage 夹紧", () => {
    const loaded = readerReducer(createInitialReaderState(), {
      type: "reader/loadSucceeded",
      payload: { documentId: "document-1", metadata: loadedMetadata },
    });
    const restored = readerReducer(loaded, {
      type: "reader/applySession",
      payload: { session: makeSession({ currentPage: 999 }) },
    });
    expect(restored.document?.currentPage).toBe(12);
  });
});
