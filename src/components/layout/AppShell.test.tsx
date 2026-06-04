import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import type { AppSettings } from "../../shared/settings/types";
import { createDefaultAppSettings } from "../../shared/settings/defaults";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import { AppShell } from "./AppShell";
import type { AppModeId, UtilityPanelId } from "./types";

function makeAnnotation(overrides: Partial<PdfAnnotation> & { id: string; pageIndex: number }): PdfAnnotation {
  return {
    type: "highlight",
    rects: [{ x: 0, y: 0, width: 100, height: 20 }],
    color: "#f6d66f",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReader(overrides: Partial<ReaderController> = {}): ReaderController {
  return {
    state: {
      status: "ready",
      defaults: {
        viewMode: "continuous",
        zoom: 1,
      },
      document: null,
      pageViewports: [],
      renderRange: { startPage: 0, endPage: 0, pageNumbers: [] },
      errorMessage: undefined,
    },
    setCurrentPage: vi.fn(),
    openFile: vi.fn(),
    renderPageToCanvas: vi.fn().mockResolvedValue(undefined),
    renderThumbnail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ReaderController;
}

function makeSearch(overrides: Partial<TextSearchController> = {}): TextSearchController {
  return {
    state: { status: "idle", hits: [], query: "" },
    ...overrides,
  } as unknown as TextSearchController;
}

function makeSettings(): AppSettings {
  return createDefaultAppSettings();
}

interface RenderArgs {
  activeMode?: AppModeId;
  annotations?: PdfAnnotation[];
  onModeChange?: (mode: AppModeId) => void;
  onUtilityPanelChange?: (panel: UtilityPanelId) => void;
  reader?: ReaderController;
  search?: TextSearchController;
  settings?: AppSettings;
  utilityPanel?: UtilityPanelId;
}

function renderAppShell(args: RenderArgs = {}) {
  const onModeChange = args.onModeChange ?? vi.fn();
  const onUtilityPanelChange = args.onUtilityPanelChange ?? vi.fn();
  return render(
    <AppShell
      activeMode={args.activeMode ?? "read"}
      annotations={args.annotations}
      onModeChange={onModeChange}
      onUtilityPanelChange={onUtilityPanelChange}
      reader={args.reader ?? makeReader()}
      search={args.search ?? makeSearch()}
      settings={args.settings ?? makeSettings()}
      utilityPanel={args.utilityPanel ?? "summary"}
    />,
  );
}

describe("AppShell AnnotationSidebar 挂载", () => {
  test("utilityPanel=annotation 时渲染批注侧边栏，不渲染文档摘要", () => {
    renderAppShell({ utilityPanel: "annotation" });
    expect(screen.getByRole("complementary", { name: "批注侧边栏" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();
  });

  test("utilityPanel=summary 时渲染文档摘要，不渲染批注侧边栏", () => {
    renderAppShell({ utilityPanel: "summary" });
    expect(screen.getByRole("complementary", { name: "文档摘要" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "批注侧边栏" })).not.toBeInTheDocument();
  });

  test("utilityPanel=none 时不渲染 utility panel", () => {
    renderAppShell({ utilityPanel: "none" });
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "批注侧边栏" })).not.toBeInTheDocument();
  });

  test("utilityPanel=annotation 时，AnnotationSidebar 接收当前页码与跳转回调", async () => {
    const setCurrentPage = vi.fn();
    const reader = makeReader({
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-1",
          path: "test.pdf",
          fingerprint: "fp-1",
          name: "test.pdf",
          currentPage: 2,
          pageCount: 5,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [
          { pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 },
        ],
        renderRange: { startPage: 1, endPage: 5, pageNumbers: [1, 2, 3, 4, 5] },
        errorMessage: undefined,
      },
    });
    (reader.setCurrentPage as ReturnType<typeof vi.fn>).mockImplementation(setCurrentPage);
    const annotations = [
      makeAnnotation({ id: "hl-1", pageIndex: 0, type: "highlight", content: "要点" }),
      makeAnnotation({ id: "nt-1", pageIndex: 2, type: "note", content: "需要复核" }),
    ];
    const user = userEvent.setup();
    renderAppShell({ annotations, reader, utilityPanel: "annotation" });

    // 4 维度分组的页码 tab 默认激活
    expect(screen.getByRole("tab", { name: "按页码", selected: true })).toBeInTheDocument();
    // 当前页码 chip 在筛选区可被点击触发跳转
    await user.click(screen.getByRole("button", { name: /高亮 · 第 1 页/ }));
    expect(setCurrentPage).toHaveBeenCalledWith(0);
  });

  test("utilityPanel=annotation 时，搜索框支持中文过滤", async () => {
    const user = userEvent.setup();
    const reader = makeReader({
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-1",
          path: "test.pdf",
          fingerprint: "fp-1",
          name: "test.pdf",
          currentPage: 1,
          pageCount: 3,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [
          { pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 },
        ],
        renderRange: { startPage: 1, endPage: 3, pageNumbers: [1, 2, 3] },
        errorMessage: undefined,
      },
    });
    const annotations = [
      makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", content: "需要复核" }),
      makeAnnotation({ id: "b", pageIndex: 0, type: "note", content: "无关" }),
    ];
    renderAppShell({ annotations, reader, utilityPanel: "annotation" });

    const search = screen.getByTestId("annotation-sidebar-search");
    await user.type(search, "复核");
    expect(screen.getByText("批注（1 / 2）")).toBeInTheDocument();
  });
});

describe("AppShell modes 上下文工具条", () => {
  test("annotate mode 渲染批注工具条", () => {
    renderAppShell({ activeMode: "annotate" });
    expect(screen.getByRole("toolbar", { name: "批注工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "高亮" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图章" })).toBeInTheDocument();
  });

  test("read mode 不渲染批注工具条", () => {
    renderAppShell({ activeMode: "read" });
    expect(screen.queryByRole("toolbar", { name: "批注工具条" })).not.toBeInTheDocument();
  });

  test("export mode 渲染导出工具条 + 分组", () => {
    renderAppShell({ activeMode: "export" });
    expect(screen.getByRole("toolbar", { name: "导出工具条" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "格式转换" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "交付工具" })).toBeInTheDocument();
  });
});
