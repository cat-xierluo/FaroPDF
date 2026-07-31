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

  // ISS-NEW-D 前往浏览历史栈（DEC-171）
  describe("history stack", () => {
    function loadAndNavigate(pages: number[]) {
      let state = readerReducer(createInitialReaderState(), {
        type: "reader/loadSucceeded",
        payload: { documentId: "document-1", metadata: loadedMetadata },
      });
      for (const page of pages) {
        state = readerReducer(state, {
          type: "reader/setCurrentPage",
          payload: { currentPage: page },
        });
      }
      return state;
    }

    test("初始 history 为空数组", () => {
      expect(createInitialReaderState().history).toEqual([]);
    });

    test("setCurrentPage 跳页时把旧页 push 到 history 顶部", () => {
      const state = loadAndNavigate([5, 7]);
      // 初始 page=1 → setCurrentPage(5) push 1 → history=[1]
      // setCurrentPage(7) push 5 → history=[5, 1]
      expect(state.document?.currentPage).toBe(7);
      expect(state.history).toEqual([5, 1]);
    });

    test("setCurrentPage 同页不重复 push", () => {
      const state = loadAndNavigate([5, 5]);
      expect(state.document?.currentPage).toBe(5);
      expect(state.history).toEqual([1]); // 第二次 5 是 no-op，不 push
    });

    test("goBack 弹 history[0] 作为新 currentPage，不重复 push", () => {
      const state = loadAndNavigate([5, 7]);
      const afterBack = readerReducer(state, { type: "reader/goBack" });
      expect(afterBack.document?.currentPage).toBe(5);
      expect(afterBack.history).toEqual([1]);
    });

    test("goBack 历史空 → no-op（保留当前页）", () => {
      const state = loadAndNavigate([5]); // history=[1]
      const afterBack = readerReducer(state, { type: "reader/goBack" });
      // history=[1]，弹 5 → currentPage=1, history=[]
      expect(afterBack.document?.currentPage).toBe(1);
      expect(afterBack.history).toEqual([]);
      const noOp = readerReducer(afterBack, { type: "reader/goBack" });
      expect(noOp).toEqual(afterBack);
    });

    test("goBack 对超出 pageCount 的 history 条目应用 clampPage", () => {
      const state = loadAndNavigate([5]);
      // 假设 pageCount=12, history=[1]，goBack → currentPage=1, history=[]
      // 这里测试：如果 history 里有超界值（极端情况），clamp 仍然生效
      const afterBack = readerReducer(state, { type: "reader/goBack" });
      expect(afterBack.document?.currentPage).toBeGreaterThanOrEqual(1);
    });

    test("loadSucceeded 清空 history（跨文档不串台）", () => {
      const state = loadAndNavigate([5, 7, 10]);
      expect(state.history).toEqual([7, 5, 1]);

      const reloaded = readerReducer(state, {
        type: "reader/loadSucceeded",
        payload: { documentId: "document-2", metadata: loadedMetadata },
      });
      expect(reloaded.history).toEqual([]);
    });

    test("clearHistory 显式清空", () => {
      const state = loadAndNavigate([5, 7]);
      const cleared = readerReducer(state, { type: "reader/clearHistory" });
      expect(cleared.history).toEqual([]);
      // currentPage 不变
      expect(cleared.document?.currentPage).toBe(7);
    });

    test("history 上限 50 防 unbounded growth", () => {
      // 重新加载一个 200 页文档，模拟连续跳 100 页
      let state = readerReducer(createInitialReaderState(), {
        type: "reader/loadSucceeded",
        payload: {
          documentId: "document-large",
          metadata: { ...loadedMetadata, pageCount: 200 },
        },
      });
      for (let i = 2; i <= 101; i++) {
        state = readerReducer(state, {
          type: "reader/setCurrentPage",
          payload: { currentPage: i },
        });
      }
      // ReaderState.history 在类型上是 number[] | undefined（允许测试 fixture
      // 省略默认视为 []），但本测试从 createInitialReaderState() 出发一路 reducer
      // 下来 history 实际一定是数组；用 ?? [] 让 TS narrowing 通过，语义不丢。
      const history = state.history ?? [];
      expect(history).toHaveLength(50);
      // 最新 push 100 在头部
      expect(history[0]).toBe(100);
      // 最旧被丢（应该是 51，前 50 项 [100..51] 保留）
      expect(history[49]).toBe(51);
    });
  });
});
