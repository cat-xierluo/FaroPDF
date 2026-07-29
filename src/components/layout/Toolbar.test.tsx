import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabProvider } from "../../state/tabStore";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import { Toolbar } from "./Toolbar";
import type { AppModeId } from "./types";

function makeReader(overrides: Partial<ReaderController> = {}): ReaderController {
  return {
    state: {
      status: "ready",
      defaults: { viewMode: "continuous", zoom: 1 },
      document: null,
      pageViewports: [],
      renderRange: { startPage: 0, endPage: 0, pageNumbers: [] },
      errorMessage: undefined,
    },
    setCurrentPage: vi.fn(),
    setZoom: vi.fn(),
    setZoomPreset: vi.fn(),
    setViewMode: vi.fn(),
    openFile: vi.fn(),
    rotateClockwise: vi.fn(),
    rotateCounterClockwise: vi.fn(),
    renderPageToCanvas: vi.fn().mockResolvedValue(undefined),
    renderThumbnail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ReaderController;
}

function makeReadyReader(viewMode: "continuous" | "single" | "double" | "fit-width" = "continuous"): ReaderController {
  return makeReader({
    state: {
      status: "ready",
      defaults: { viewMode, zoom: 1 },
      document: {
        documentId: "doc-toolbar-test",
        path: "/case/contract.pdf",
        fingerprint: "fp-toolbar-test",
        name: "contract.pdf",
        currentPage: 2,
        pageCount: 10,
        zoom: 1.5,
        viewMode,
        rotation: 0,
        textLayerStatus: "available",
        ocrStatus: "not-needed",
        dirty: false,
      },
      pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
      renderRange: { startPage: 1, endPage: 10, pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      errorMessage: undefined,
    },
  });
}

function makeSearch(): TextSearchController {
  return {
    state: { status: "idle", hits: [], query: "" },
    setQuery: vi.fn(),
    selectHit: vi.fn(),
    selectPreviousHit: vi.fn(),
    selectNextHit: vi.fn(),
    indexMore: vi.fn(),
    requestOcr: vi.fn(),
  } as unknown as TextSearchController;
}

interface HarnessProps {
  activeMode?: AppModeId;
  reader?: ReaderController;
  search?: TextSearchController;
  utilityPanel?: import("./types").UtilityPanelId;
  onCommand?: (commandId: import("../../shared/app/commands").AppCommandId) => void;
  onModeChange?: (mode: AppModeId) => void;
  onRightPanelChange?: (panel: import("./types").RightPanelId) => void;
  onUtilityPanelChange?: (panel: import("./types").UtilityPanelId) => void;
}

function Harness({
  activeMode = "read",
  reader,
  search,
  utilityPanel = "none",
  onCommand,
  onModeChange,
  onRightPanelChange,
  onUtilityPanelChange,
}: HarnessProps) {
  return (
    <TabProvider>
      <Toolbar
        activeMode={activeMode}
        onCommand={onCommand ?? vi.fn()}
        onModeChange={onModeChange ?? vi.fn()}
        onRightPanelChange={onRightPanelChange}
        onUtilityPanelChange={onUtilityPanelChange ?? vi.fn()}
        reader={reader ?? makeReader()}
        search={search ?? makeSearch()}
        utilityPanel={utilityPanel}
      />
    </TabProvider>
  );
}

describe("Toolbar M2.2：5 段语义层级", () => {
  test("header 渲染 5 段，data-section 顺序固定", () => {
    const { container } = render(<Harness />);
    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    expect(toolbar).not.toBeNull();

    const sections = Array.from(toolbar?.querySelectorAll<HTMLElement>("[data-section]") ?? []);
    expect(sections.map((el) => el.dataset.section)).toEqual([
      "navigation",
      "zoom",
      "workflows",
      "collaboration",
      "search",
    ]);
  });

  test("5 段中每个段都有 aria-label，screen reader 友好", () => {
    const { container } = render(<Harness />);
    const expected = [
      "导航与视图",
      "缩放",
      "核心工作流",
      "协作与交付",
      "全文搜索",
    ];
    for (const label of expected) {
      const group = container.querySelector(`[data-section] [aria-label="${label}"]`)
        ?? container.querySelector(`[data-section][aria-label="${label}"]`);
      expect(group, `段 aria-label="${label}" 应在 DOM 中`).not.toBeNull();
    }
  });

  test("5 段 DOM 严格 5 段（不能多不能少）", () => {
    const { container } = render(<Harness />);
    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    const sections = toolbar?.querySelectorAll("[data-section]") ?? [];
    expect(sections).toHaveLength(5);
  });
});

describe("Toolbar ISS-NEW-A 阶段 1：A 批注 / T 编辑 按钮", () => {
  test("workflows 段包含 A 批注 + T 编辑两个按钮", () => {
    const { container } = render(<Harness />);
    const modeSection = container.querySelector('[data-section="workflows"]');
    expect(modeSection).not.toBeNull();
    if (!modeSection) return;

    expect(within(modeSection as HTMLElement).getByRole("button", { name: "A 批注" })).toBeInTheDocument();
    expect(within(modeSection as HTMLElement).getByRole("button", { name: "T 编辑" })).toBeInTheDocument();
  });

  test("activeMode=annotate 时 A 批注按钮 aria-pressed=true,T 编辑 false", () => {
    render(<Harness activeMode="annotate" />);
    expect(screen.getByRole("button", { name: "A 批注" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "false");
  });

  test("activeMode=edit 时 T 编辑按钮 aria-pressed=true,A 批注 false", () => {
    render(<Harness activeMode="edit" />);
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "A 批注" })).toHaveAttribute("aria-pressed", "false");
  });

  test("activeMode=pages 时页面管理激活，但 T 编辑保持未按下", () => {
    render(<Harness activeMode="pages" />);
    expect(screen.getByRole("button", { name: "页面管理" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "false");
  });

  test("activeMode=read 时两个按钮都 aria-pressed=false", () => {
    render(<Harness activeMode="read" />);
    expect(screen.getByRole("button", { name: "A 批注" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "false");
  });

  test("点击 A 批注 → onModeChange('annotate')", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="read" onModeChange={onModeChange} reader={makeReadyReader()} />);

    await user.click(screen.getByRole("button", { name: "A 批注" }));
    expect(onModeChange).toHaveBeenCalledWith("annotate");
  });

  test("点击 T 编辑 → onModeChange('edit')", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="read" onModeChange={onModeChange} reader={makeReadyReader()} />);

    await user.click(screen.getByRole("button", { name: "T 编辑" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  test("再次点击同一 mode → toggle 回 read（不卡死在 mode 上）", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="annotate" onModeChange={onModeChange} reader={makeReadyReader()} />);

    await user.click(screen.getByRole("button", { name: "A 批注" }));
    expect(onModeChange).toHaveBeenLastCalledWith("read");
  });
});

describe("Toolbar M2.2：密度与入口收口", () => {
  test("视图模式从 L3 移入视图设置面板，L3 不再渲染 radio 堆叠", () => {
    render(<Harness reader={makeReadyReader("continuous")} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "视图设置" })).toBeInTheDocument();
  });

  test("缩放段只保留缩放值与 +/-", () => {
    const { container } = render(<Harness reader={makeReadyReader()} />);
    const zoomSection = container.querySelector('[data-section="zoom"]') as HTMLElement;
    expect(within(zoomSection).getByText("150%")).toBeInTheDocument();
    expect(within(zoomSection).getByRole("button", { name: "缩小" })).toBeInTheDocument();
    expect(within(zoomSection).getByRole("button", { name: "放大" })).toBeInTheDocument();
  });

  test("核心工作流平铺导出、填写和签名、OCR，更多命令仍由工具菜单承载", () => {
    render(<Harness reader={makeReadyReader()} />);
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "填写和签名" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "扫描和文本识别" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
  });

  test("导航段只有三个稳定入口，不再把书签占位平铺到 L3", () => {
    const { container } = render(<Harness reader={makeReadyReader()} />);
    const navigation = container.querySelector('[data-section="navigation"]') as HTMLElement;
    expect(within(navigation).getAllByRole("button")).toHaveLength(3);
    expect(within(navigation).queryByRole("button", { name: "书签" })).not.toBeInTheDocument();
  });

  test("聚焦或输入搜索时打开 measured 右侧搜索面板", async () => {
    const user = userEvent.setup();
    const onRightPanelChange = vi.fn();
    const search = makeSearch();
    render(<Harness onRightPanelChange={onRightPanelChange} reader={makeReadyReader()} search={search} />);

    const input = screen.getByRole("searchbox", { name: "全文搜索" });
    await user.click(input);
    await user.type(input, "P");

    expect(onRightPanelChange).toHaveBeenCalledWith("search");
    expect(search.setQuery).toHaveBeenCalledWith("P");
  });
});
