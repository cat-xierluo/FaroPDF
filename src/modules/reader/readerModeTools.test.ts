import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { _resetToolbarRegistry, getModeTools, type ToolbarState } from "../../components/layout/toolbarRegistry";
import type { ReaderController } from "./useReaderController";
import { READ_MODE_TOOL_IDS, registerReadModeTools } from "./readerModeTools";

function makeState(overrides: Partial<ReaderController> = {}): ToolbarState {
  return {
    activeMode: "read",
    reader: {
      rotateClockwise: vi.fn(),
      rotateCounterClockwise: vi.fn(),
      setZoomPreset: vi.fn(),
      state: {
        defaults: { viewMode: "continuous", zoom: 1 },
        document: null,
        errorMessage: undefined,
        pageViewports: [],
        renderRange: { endPage: 0, pageNumbers: [], startPage: 0 },
        status: "idle",
      },
    } as unknown as ReaderController,
    search: {} as ToolbarState["search"],
    ...overrides,
  };
}

describe("registerReadModeTools", () => {
  beforeEach(() => {
    _resetToolbarRegistry();
  });
  afterEach(() => {
    _resetToolbarRegistry();
  });

  test("向 read mode 注册 3 个工具：顺时针 / 逆时针 / 适合页面", () => {
    registerReadModeTools();
    const tools = getModeTools("read");
    const ids = tools.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        READ_MODE_TOOL_IDS.rotateClockwise,
        READ_MODE_TOOL_IDS.rotateCounterClockwise,
        READ_MODE_TOOL_IDS.fitPage,
      ]),
    );
  });

  test("无文档时所有工具处于 disabled 状态", () => {
    registerReadModeTools();
    const tools = getModeTools("read");
    const state = makeState();
    for (const tool of tools) {
      expect(tool.isDisabled?.(state)).toBe(true);
    }
  });

  test("点击顺时针工具调用 reader.rotateClockwise", () => {
    registerReadModeTools();
    const state = makeState();
    const tool = getModeTools("read").find((t) => t.id === READ_MODE_TOOL_IDS.rotateClockwise);
    expect(tool).toBeDefined();
    tool?.onClick(state);
    expect(state.reader.rotateClockwise).toHaveBeenCalledTimes(1);
  });

  test("点击逆时针工具调用 reader.rotateCounterClockwise", () => {
    registerReadModeTools();
    const state = makeState();
    const tool = getModeTools("read").find((t) => t.id === READ_MODE_TOOL_IDS.rotateCounterClockwise);
    expect(tool).toBeDefined();
    tool?.onClick(state);
    expect(state.reader.rotateCounterClockwise).toHaveBeenCalledTimes(1);
  });

  test("点击适合页面工具调用 reader.setZoomPreset('fit-page')", () => {
    registerReadModeTools();
    const state = makeState();
    const tool = getModeTools("read").find((t) => t.id === READ_MODE_TOOL_IDS.fitPage);
    expect(tool).toBeDefined();
    tool?.onClick(state);
    expect(state.reader.setZoomPreset).toHaveBeenCalledWith("fit-page");
  });

  test("有文档时工具不再 disabled", () => {
    registerReadModeTools();
    const state = makeState();
    // 直接覆盖 reader 字段
    (state as { reader: ReaderController }).reader = {
      rotateClockwise: vi.fn(),
      rotateCounterClockwise: vi.fn(),
      setZoomPreset: vi.fn(),
      state: {
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          currentPage: 1,
          dirty: false,
          documentId: "doc-1",
          name: "x.pdf",
          ocrStatus: "not-needed",
          pageCount: 5,
          path: "",
          rotation: 0,
          textLayerStatus: "available",
          viewMode: "continuous",
          zoom: 1,
        },
        errorMessage: undefined,
        pageViewports: [],
        renderRange: { endPage: 0, pageNumbers: [], startPage: 0 },
        status: "ready",
      },
    } as unknown as ReaderController;
    for (const tool of getModeTools("read")) {
      expect(tool.isDisabled?.(state)).toBeFalsy();
    }
  });
});
