import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabProvider } from "../../state/tabStore";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import { Toolbar } from "./Toolbar";
import { _resetToolbarRegistry, registerModeTools, type ToolbarToolItem } from "./toolbarRegistry";
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
  onUtilityPanelChange?: (panel: import("./types").UtilityPanelId) => void;
}

function Harness({
  activeMode = "read",
  reader,
  search,
  utilityPanel = "none",
  onCommand,
  onModeChange,
  onUtilityPanelChange,
}: HarnessProps) {
  return (
    <TabProvider>
      <Toolbar
        activeMode={activeMode}
        onCommand={onCommand ?? vi.fn()}
        onModeChange={onModeChange ?? vi.fn()}
        onUtilityPanelChange={onUtilityPanelChange ?? vi.fn()}
        reader={reader ?? makeReader()}
        search={search ?? makeSearch()}
        utilityPanel={utilityPanel}
      />
    </TabProvider>
  );
}

describe("Toolbar ISS-NEW-A 阶段 1：5 段骨架", () => {
  test("header 渲染 5 段，data-section 顺序固定", () => {
    const { container } = render(<Harness />);
    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    expect(toolbar).not.toBeNull();

    const sections = Array.from(toolbar?.querySelectorAll<HTMLElement>("[data-section]") ?? []);
    expect(sections.map((el) => el.dataset.section)).toEqual([
      "sidebar-toggles",
      "file",
      "reading",
      "mode",
      "right",
    ]);
  });

  test("5 段中每个段都有 aria-label，screen reader 友好", () => {
    const { container } = render(<Harness />);
    const expected = [
      "侧栏切换",
      "文件操作",
      "阅读控制",
      "模式切换",
      "搜索和设置",
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
  test("mode 段包含 A 批注 + T 编辑 两个按钮", () => {
    const { container } = render(<Harness />);
    const modeSection = container.querySelector('[data-section="mode"]');
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

  test("activeMode=pages 时 T 编辑按钮 aria-pressed=true,A 批注 false", () => {
    render(<Harness activeMode="pages" />);
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "A 批注" })).toHaveAttribute("aria-pressed", "false");
  });

  test("activeMode=read 时两个按钮都 aria-pressed=false", () => {
    render(<Harness activeMode="read" />);
    expect(screen.getByRole("button", { name: "A 批注" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "T 编辑" })).toHaveAttribute("aria-pressed", "false");
  });

  test("点击 A 批注 → onModeChange('annotate')", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="read" onModeChange={onModeChange} />);

    await user.click(screen.getByRole("button", { name: "A 批注" }));
    expect(onModeChange).toHaveBeenCalledWith("annotate");
  });

  test("点击 T 编辑 → onModeChange('pages')", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="read" onModeChange={onModeChange} />);

    await user.click(screen.getByRole("button", { name: "T 编辑" }));
    expect(onModeChange).toHaveBeenCalledWith("pages");
  });

  test("再次点击同一 mode → toggle 回 read（不卡死在 mode 上）", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness activeMode="annotate" onModeChange={onModeChange} />);

    await user.click(screen.getByRole("button", { name: "A 批注" }));
    expect(onModeChange).toHaveBeenLastCalledWith("read");
  });
});

describe("Toolbar ISS-NEW-A 阶段 1：视图模式 4-icon toggle", () => {
  test("视图模式段（reading 段）渲染 4 个 radio 选项", () => {
    const { container } = render(<Harness reader={makeReadyReader("continuous")} />);
    const readingSection = container.querySelector('[data-section="reading"]');
    expect(readingSection).not.toBeNull();
    if (!readingSection) return;

    const radios = within(readingSection as HTMLElement).getAllByRole("radio");
    expect(radios).toHaveLength(4);

    const labels = ["单页", "连续", "双页", "适合宽度"];
    for (const label of labels) {
      expect(within(readingSection as HTMLElement).getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  test("当前 viewMode=continuous 时「连续」aria-checked=true，其余 false", () => {
    const { container } = render(<Harness reader={makeReadyReader("continuous")} />);
    const readingSection = container.querySelector('[data-section="reading"]') as HTMLElement;
    expect(within(readingSection).getByRole("radio", { name: "连续" })).toHaveAttribute("aria-checked", "true");
    expect(within(readingSection).getByRole("radio", { name: "单页" })).toHaveAttribute("aria-checked", "false");
    expect(within(readingSection).getByRole("radio", { name: "双页" })).toHaveAttribute("aria-checked", "false");
    expect(within(readingSection).getByRole("radio", { name: "适合宽度" })).toHaveAttribute("aria-checked", "false");
  });

  test("点击「适合宽度」→ reader.setViewMode('fit-width')", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader("continuous");
    render(<Harness reader={reader} />);

    await user.click(screen.getByRole("radio", { name: "适合宽度" }));
    expect(reader.setViewMode).toHaveBeenCalledWith("fit-width");
  });

  test("点击「单页」→ reader.setViewMode('single')", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader("continuous");
    render(<Harness reader={reader} />);

    await user.click(screen.getByRole("radio", { name: "单页" }));
    expect(reader.setViewMode).toHaveBeenCalledWith("single");
  });

  test("点击「双页」→ reader.setViewMode('double')", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader("continuous");
    render(<Harness reader={reader} />);

    await user.click(screen.getByRole("radio", { name: "双页" }));
    expect(reader.setViewMode).toHaveBeenCalledWith("double");
  });

  test("data-viewmode 属性映射 viewMode id", () => {
    const { container } = render(<Harness reader={makeReadyReader("double")} />);
    const readingSection = container.querySelector('[data-section="reading"]') as HTMLElement;
    const radios = within(readingSection).getAllByRole("radio");
    const idMap = radios.map((el) => el.getAttribute("data-viewmode"));
    expect(idMap).toEqual(["single", "continuous", "double", "fit-width"]);
  });

  test("重复点击同一 viewMode 不触发 setViewMode（避免无谓的 reducer dispatch）", () => {
    const reader = makeReadyReader("continuous");
    render(<Harness reader={reader} />);

    fireEvent.click(screen.getByRole("radio", { name: "连续" }));
    expect(reader.setViewMode).not.toHaveBeenCalled();
  });

  test("无文档时 4 个 radio 全部 disabled", () => {
    const { container } = render(<Harness reader={makeReader()} />);
    const readingSection = container.querySelector('[data-section="reading"]') as HTMLElement;
    const radios = within(readingSection).getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toBeDisabled();
    }
  });
});

describe("Toolbar ModeActiveTools 集成", () => {
  // 注册一个 "annotate" 模式工具，用于验证 ModeActiveTools 仍能正常工作
  const ROTATE_ITEM: ToolbarToolItem = {
    id: "test.rotate",
    icon: ({ size }: { size?: number }) => (
      <span data-testid="rotate-icon" data-size={size} />
    ),
    isActive: () => false,
    label: "测试旋转",
    modeId: "annotate",
    onClick: () => undefined,
    order: 1,
  };

  test("activeMode=annotate 时 ModeActiveTools 渲染注册的 annotate 工具（位于 reading 段）", () => {
    _resetToolbarRegistry();
    registerModeTools("annotate", [ROTATE_ITEM]);
    try {
      const { container } = render(<Harness activeMode="annotate" reader={makeReadyReader()} />);
      const readingSection = container.querySelector('[data-section="reading"]') as HTMLElement;
      expect(within(readingSection).getByTestId("rotate-icon")).toBeInTheDocument();
    } finally {
      _resetToolbarRegistry();
    }
  });
});

describe("Toolbar ISS-NEW-A 阶段 2 收口（2026-06-22）：侧栏 4 toggle", () => {
  test("sidebar-toggles 段有 4 个按钮（摘要 / 页面 / 视图设置 / 书签）", () => {
    const { container } = render(<Harness reader={makeReadyReader()} />);
    const sidebarTogglesSection = container.querySelector(
      '[data-section="sidebar-toggles"]',
    ) as HTMLElement;
    const buttons = within(sidebarTogglesSection).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(within(sidebarTogglesSection).getByLabelText("书签")).toBeInTheDocument();
  });

  test("书签按钮默认 aria-pressed=false（panel 未激活）", () => {
    render(<Harness reader={makeReadyReader()} />);
    const bookmark = screen.getByTestId("toolbar-sidebar-bookmark");
    expect(bookmark).toHaveAttribute("aria-pressed", "false");
  });

  test("点击书签 → onUtilityPanelChange('bookmark')", async () => {
    const onUtilityPanelChange = vi.fn();
    render(
      <Harness onUtilityPanelChange={onUtilityPanelChange} reader={makeReadyReader()} />,
    );
    await userEvent.click(screen.getByTestId("toolbar-sidebar-bookmark"));
    expect(onUtilityPanelChange).toHaveBeenCalledWith("bookmark");
    expect(onUtilityPanelChange).toHaveBeenCalledTimes(1);
  });

  test("再次点击书签 → onUtilityPanelChange('none')（toggle 回关闭）", async () => {
    const onUtilityPanelChange = vi.fn();
    render(
      <Harness
        onUtilityPanelChange={onUtilityPanelChange}
        reader={makeReadyReader()}
        utilityPanel="bookmark"
      />,
    );
    await userEvent.click(screen.getByTestId("toolbar-sidebar-bookmark"));
    expect(onUtilityPanelChange).toHaveBeenCalledWith("none");
  });

  test("utilityPanel=bookmark 时书签按钮 aria-pressed=true", () => {
    render(<Harness reader={makeReadyReader()} utilityPanel="bookmark" />);
    const bookmark = screen.getByTestId("toolbar-sidebar-bookmark");
    expect(bookmark).toHaveAttribute("aria-pressed", "true");
  });
});
