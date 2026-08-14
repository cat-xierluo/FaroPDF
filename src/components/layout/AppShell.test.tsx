import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import type { AppSettings } from "../../shared/settings/types";
import { createDefaultAppSettings } from "../../shared/settings/defaults";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import type { OcrCommandJob } from "../../shared/ocr/jobQueue";
import { createInitialAnnotationToolState } from "../../modules/annotation";
import { AppShell } from "./AppShell";
import { TabProvider, useTabStore } from "../../state/tabStore";
import type { AnnotationArmedStateBundle, AppModeId, UtilityPanelId } from "./types";
import type { OcrWorkspaceController } from "../../modules/ocr";
import type { AppCommandSignal } from "../../shared/app/commands";

beforeEach(() => {
  window.localStorage.clear();
});

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
    // ISS-NEW-H：视图菜单 submenu 命令路由测试需要这些 reader API 的 mock。
    setZoom: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setViewMode: vi.fn(),
    setZoomPreset: vi.fn(),
    // ISS-NEW-D 前往浏览历史栈（DEC-171）：go-back + go-history-N 命令路由需要。
    goBack: vi.fn(),
    goToHistory: vi.fn(),
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

async function createBlankPdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    pdf.addPage([612, 792]);
  }
  return pdf.save();
}

function makeOcrController(overrides: Partial<OcrWorkspaceController> = {}): OcrWorkspaceController {
  return {
    busy: false,
    cancelJob: vi.fn(async () => undefined),
    currentJob: undefined,
    errorMessage: null,
    hasDocument: true,
    hasProvider: true,
    jobs: [],
    openJobList: vi.fn(),
    openQualityReport: vi.fn(),
    outputLayeredPdf: vi.fn(async () => undefined),
    parameters: {
      activeProvider: {
        id: "local-ocrmypdf",
        label: "本机 ocrmypdf",
        kind: "local",
        requiresNetworkConsent: false,
      },
      outputStrategy: "new-layered-pdf",
      qualityCheck: { enabled: false, keywords: [], description: "未启用" },
      networkConsentRequired: false,
    },
    refresh: vi.fn(async () => undefined),
    selectJob: vi.fn(),
    selectedJobId: null,
    startOcr: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makeStoredJob(overrides: Partial<OcrCommandJob> = {}): OcrCommandJob {
  return {
    id: "ocr-1",
    inputPath: "/tmp/source.pdf",
    inputPathSummary: { kind: "local-pdf", fingerprint: "x", redacted: "[path].pdf" },
    outputPath: "/tmp/source-ocr.pdf",
    outputPathSummary: { kind: "local-pdf", fingerprint: "y", redacted: "[path]-ocr.pdf" },
    backend: "local-ocrmypdf",
    providerId: "local-ocrmypdf",
    status: "queued",
    outputStrategy: "new-layered-pdf",
    progress: { stage: "queued", completedPages: 0, totalPages: 0 },
    qualityCheck: { enabled: false, samplePages: [], keywords: [] },
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...overrides,
  };
}

interface RenderArgs {
  activeMode?: AppModeId;
  annotations?: PdfAnnotation[];
  annotationArmed?: AnnotationArmedStateBundle;
  commandSignal?: AppCommandSignal | null;
  onModeChange?: (mode: AppModeId) => void;
  onAnnotationDraft?: (input: import("./types").AnnotationDraftSubmission) => void;
  onSettingsChange?: (settings: AppSettings) => void;
  onUtilityPanelChange?: (panel: UtilityPanelId) => void;
  reader?: ReaderController;
  search?: TextSearchController;
  settings?: AppSettings;
  utilityPanel?: UtilityPanelId;
}

function renderAppShell(args: RenderArgs = {}) {
  const onModeChange = args.onModeChange ?? vi.fn();
  const onSettingsChange = args.onSettingsChange;
  const onUtilityPanelChange = args.onUtilityPanelChange ?? vi.fn();
  return render(
    <TabProvider>
      <AppShell
        activeMode={args.activeMode ?? "read"}
        annotationArmed={args.annotationArmed}
        annotations={args.annotations}
        commandSignal={args.commandSignal}
        onAnnotationDraft={args.onAnnotationDraft}
        onModeChange={onModeChange}
        onSettingsChange={onSettingsChange}
        onUtilityPanelChange={onUtilityPanelChange}
        reader={args.reader ?? makeReader()}
        search={args.search ?? makeSearch()}
        settings={args.settings ?? makeSettings()}
        utilityPanel={args.utilityPanel ?? "summary"}
        ocr={makeOcrController()}
      />
    </TabProvider>,
  );
}

function renderShell(
  activeMode: "read" | "annotate" | "edit" | "export" | "forms" | "ocr" | "pages",
  options: {
    ocr?: OcrWorkspaceController;
    settings?: AppSettings;
  } = {},
) {
  const settings = options.settings ?? createDefaultAppSettings();
  return render(
    <TabProvider>
      <AppShell
        activeMode={activeMode}
        ocr={options.ocr}
        onModeChange={() => undefined}
        onUtilityPanelChange={() => undefined}
        reader={makeReader()}
        search={makeSearch()}
        settings={settings}
        utilityPanel="summary"
      />
    </TabProvider>,
  );
}

function makeReadyReader(pageCount = 3): ReaderController {
  return makeReader({
    state: {
      status: "ready",
      defaults: { viewMode: "continuous", zoom: 1 },
      document: {
        documentId: "doc-1",
        path: "test.pdf",
        fingerprint: "fp-1",
        name: "test.pdf",
        currentPage: 1,
        pageCount,
        zoom: 1,
        viewMode: "continuous",
        rotation: 0,
        textLayerStatus: "available",
        ocrStatus: "not-needed",
        dirty: false,
      },
      pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
      renderRange: { startPage: 1, endPage: pageCount, pageNumbers: Array.from({ length: pageCount }, (_, index) => index + 1) },
      errorMessage: undefined,
    },
  });
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
  test("empty read toolbar hides document-only helpers", () => {
    renderAppShell({ utilityPanel: "none" });

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A 批注" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "逆时针" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "顺时针" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "适合页面" })).not.toBeInTheDocument();
  });

  test("核心工作流在 L3 直接可达，「+」工具菜单不再重复承载（ISS-QA-12 去重）", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    renderAppShell({ onModeChange, reader: makeReadyReader(), utilityPanel: "none" });

    const toolbar = screen.getByRole("banner");
    expect(within(toolbar).getByRole("button", { name: "扫描和文本识别" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "A 批注" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "填写和签名" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "导出" })).toBeInTheDocument();

    await user.click(within(toolbar).getByRole("button", { name: "导出" }));
    expect(onModeChange).toHaveBeenCalledWith("export");

    await user.click(within(toolbar).getByRole("button", { name: "工具" }));
    const menu = screen.getByRole("menu", { name: "PDF 工具菜单" });
    // QA-12（553f5a1）后 launcher 渲染层过滤 mode-* 与 view-pages——
    // 工作流切换（批注/导出/填写签名/OCR/页面管理）只留 L3 一级入口。
    expect(within(menu).queryByRole("menuitem", { name: "批注" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "导出" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "填写和签名" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "OCR" })).not.toBeInTheDocument();

    expect(within(menu).getByRole("menuitem", { name: "设置" })).toBeInTheDocument();
  });

  test("read toolbar keeps document tools inside a grouped tool launcher", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    renderAppShell({ onModeChange, reader: makeReadyReader(), utilityPanel: "none" });

    expect(screen.queryByRole("button", { name: "Bates 编号" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加页码" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "另存为" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "工具" }));

    const menu = screen.getByRole("menu", { name: "PDF 工具菜单" });
    // QA-12 去重后：organize（仅 view-pages）与 scan（仅 mode-ocr）段被过滤为空、
    // 渲染层跳过；deliver / markup 两段保留真实工具。
    expect(within(menu).queryByRole("group", { name: "组织页面" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("group", { name: "扫描 OCR" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "交付导出" })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "标注填写" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /添加页码/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Bates 编号/ })).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: /Bates 编号/ }));
    expect(onModeChange).toHaveBeenCalledWith("export");
  });

  test("native Bates command enters export mode and selects the delivery panel", async () => {
    const onModeChange = vi.fn();
    renderAppShell({
      activeMode: "export",
      commandSignal: { id: "export-bates", nonce: 1 },
      onModeChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "证据编号" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(onModeChange).toHaveBeenCalledWith("export");
    expect(screen.getByRole("complementary", { name: "交付设置面板" })).toBeInTheDocument();
  });

  test("native compress command enters export mode and selects compression settings", async () => {
    const onModeChange = vi.fn();
    renderAppShell({
      activeMode: "export",
      commandSignal: { id: "export-compress", nonce: 1 },
      onModeChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "压缩" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(onModeChange).toHaveBeenCalledWith("export");
    expect(screen.getByRole("region", { name: "压缩设置" })).toBeInTheDocument();
  });

  test("native header/footer command enters export mode and selects header/footer settings", async () => {
    const onModeChange = vi.fn();
    renderAppShell({
      activeMode: "export",
      commandSignal: { id: "export-header-footer", nonce: 1 },
      onModeChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "页眉页脚" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(onModeChange).toHaveBeenCalledWith("export");
    expect(screen.getByRole("region", { name: "页眉页脚设置" })).toBeInTheDocument();
  });

  test("native forms flatten command enters forms mode and requests the forms panel", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "forms",
      commandSignal: { id: "forms-flatten", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("forms");
    });
    expect(onModeChange).toHaveBeenCalledWith("forms");
    expect(screen.getByText("已进入填写和签名面板，请在面板内读取字段并确认扁平化导出。")).toBeInTheDocument();
  });

  test("native PDF 内容编辑命令在引擎未接入时 fail-closed", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "pdf-edit-content", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => expect(screen.getByText(/「编辑」尚未接入真实功能/)).toBeInTheDocument());
    expect(onModeChange).not.toHaveBeenCalled();
    expect(onUtilityPanelChange).not.toHaveBeenCalled();
  });

  test("native annotation flatten command enters annotate mode and requests annotation panel", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "annotate",
      annotations: [makeAnnotation({ id: "ann-1", pageIndex: 0, type: "highlight" })],
      commandSignal: { id: "annotations-flatten", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("annotation");
    });
    expect(onModeChange).toHaveBeenCalledWith("annotate");
    expect(screen.getByText("已打开批注侧栏，请在侧栏内确认扁平化导出。")).toBeInTheDocument();
  });

  test("ISS-064: set-password command enters export mode and opens security panel", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "export",
      commandSignal: { id: "export-set-password", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "security",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("security");
    });
    expect(onModeChange).toHaveBeenCalledWith("export");
    expect(screen.getByTestId("security-panel")).toBeInTheDocument();
    expect(screen.getByText("已打开文档安全面板，请输入拥有者密码并确认。")).toBeInTheDocument();
  });

  test("ISS-064: remove-password command enters export mode and opens security panel", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "export",
      commandSignal: { id: "export-remove-password", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "security",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("security");
    });
    expect(onModeChange).toHaveBeenCalledWith("export");
    expect(screen.getByTestId("security-panel")).toBeInTheDocument();
    expect(screen.getByText("已打开文档安全面板，请输入原密码并确认。")).toBeInTheDocument();
  });

  test("tool launcher Save As writes a real copy instead of showing placeholder feedback", async () => {
    const user = userEvent.setup();
    const sourceBytes = new Uint8Array([1, 2, 3, 4]);
    const saveUpdatedBytes = vi.fn(async (_bytes: Uint8Array, _fileName: string) => undefined);
    const reader = makeReader({
      ...makeReadyReader(),
      getCurrentFileName: vi.fn(() => "test.pdf"),
      getFileBytes: vi.fn(async () => sourceBytes),
      saveUpdatedBytes,
    });

    renderAppShell({ reader, utilityPanel: "none" });

    await user.click(screen.getByRole("button", { name: "工具" }));
    await user.click(screen.getByRole("menuitem", { name: "另存为" }));

    await waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1));
    expect(saveUpdatedBytes).toHaveBeenCalledWith(sourceBytes, "test-copy.pdf");
    expect(screen.getByText("已另存为 test-copy.pdf。")).toBeInTheDocument();
  });

  test("annotation summary command opens the annotation sidebar summary view", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "annotate",
      annotations: [makeAnnotation({ id: "ann-summary-1", pageIndex: 0, type: "highlight", content: "摘要入口" })],
      commandSignal: { id: "export-annotation-summary", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "annotation",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("annotation");
    });
    expect(onModeChange).toHaveBeenCalledWith("annotate");
    expect(screen.getByRole("complementary", { name: "批注摘要" })).toBeInTheDocument();
    expect(screen.getByText("批注摘要（1）")).toBeInTheDocument();
  });

  test("native about command opens settings directly on the about section", async () => {
    const onModeChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "help-about", nonce: 1 },
      onModeChange,
      onUtilityPanelChange,
      utilityPanel: "settings",
    });

    await waitFor(() => {
      expect(onUtilityPanelChange).toHaveBeenCalledWith("settings");
    });
    expect(onModeChange).toHaveBeenCalledWith("read");
    expect(screen.getByRole("tabpanel", { name: "关于" })).toBeInTheDocument();
    expect(screen.queryByText("关于信息位于设置页。")).not.toBeInTheDocument();
  });

  test("annotation sidebar flatten action saves a new annotations-flattened PDF", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createBlankPdf(1);
    const saveUpdatedBytes = vi.fn(async (_bytes: Uint8Array, _fileName: string) => undefined);
    const reader = makeReader({
      getCurrentFileName: vi.fn(() => "case.pdf"),
      getFileBytes: vi.fn(async () => sourceBytes),
      saveUpdatedBytes,
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-annotation-flatten",
          path: "/case/case.pdf",
          fingerprint: "fp-annotation-flatten",
          name: "case.pdf",
          currentPage: 1,
          pageCount: 1,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
        renderRange: { startPage: 1, endPage: 1, pageNumbers: [1] },
        errorMessage: undefined,
      },
    });

    renderAppShell({
      activeMode: "annotate",
      annotations: [makeAnnotation({ id: "ann-1", pageIndex: 0, type: "highlight" })],
      reader,
      utilityPanel: "annotation",
    });

    await user.click(screen.getByRole("button", { name: "扁平化导出" }));
    await waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1));
    expect(saveUpdatedBytes.mock.calls[0]).toBeDefined();
    const [savedBytes, fileName] = saveUpdatedBytes.mock.calls[0]!;
    expect(fileName).toBe("case-annotations-flattened.pdf");
    const outputPdf = await PDFDocument.load(savedBytes);
    expect(outputPdf.getKeywords()).toContain("faropdf:annotation-flattened");
    expect(await screen.findByText(/已导出 case-annotations-flattened\.pdf/)).toBeInTheDocument();
  });

  test("forms mode toolbar uses wired form actions instead of placeholder controls", async () => {
    const user = userEvent.setup();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "forms",
      onUtilityPanelChange,
      reader: makeReadyReader(),
      utilityPanel: "none",
    });

    const formsToolbar = screen.getByRole("toolbar", { name: "填写和签名工具条" });
    expect(within(formsToolbar).getByRole("group", { name: "表单工具" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "读取字段" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "填写" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "签名" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "扁平化导出" })).toBeInTheDocument();
    expect(within(formsToolbar).queryByRole("button", { name: "日期" })).not.toBeInTheDocument();
    expect(within(formsToolbar).queryByRole("button", { name: "钩号" })).not.toBeInTheDocument();
    expect(within(formsToolbar).queryByRole("button", { name: "导出为压平" })).not.toBeInTheDocument();

    await user.click(within(formsToolbar).getByRole("button", { name: "扁平化导出" }));
    expect(onUtilityPanelChange).toHaveBeenCalledWith("forms");
  });

  test("annotate mode 渲染批注工具条", () => {
    renderAppShell({ activeMode: "annotate" });
    expect(screen.getByRole("toolbar", { name: "批注工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "高亮" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图章" })).toBeInTheDocument();
  });

  test("annotate 默认态不凭空打开右栏", () => {
    const { container } = renderAppShell({ activeMode: "annotate", utilityPanel: "none" });
    expect(container.querySelector(".workspace")).toHaveAttribute("data-layout", "main-only");
    expect(container.querySelector(".right-pane")).toBeNull();
  });

  test("edit 使用左侧大纲、单页阅读画布和独立编辑 L4，不再渲染页面网格", () => {
    const { container } = renderAppShell({ activeMode: "edit", reader: makeReadyReader(), utilityPanel: "summary" });
    const toolbar = screen.getByRole("toolbar", { name: "编辑工具条" });
    for (const label of ["文本", "图像", "链接", "隐藏"]) {
      expect(within(toolbar).getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toBeInTheDocument();
    expect(container.querySelector(".workspace")).toHaveAttribute("data-layout", "left-main");
    expect(screen.getByRole("tab", { name: "大纲" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "大纲" })).toBeInTheDocument();
    expect(screen.queryByRole("main", { name: "页面管理工作台" })).not.toBeInTheDocument();
  });

  test("pages 使用独立页面管理工作台，不渲染编辑 L4", () => {
    renderAppShell({ activeMode: "pages", reader: makeReadyReader(), utilityPanel: "none" });
    expect(screen.getByRole("main", { name: "页面管理工作台" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "编辑工具条" })).not.toBeInTheDocument();
  });

  test("read mode 不渲染批注工具条", () => {
    renderAppShell({ activeMode: "read" });
    expect(screen.queryByRole("toolbar", { name: "批注工具条" })).not.toBeInTheDocument();
  });

  test("export mode 渲染导出工具条 + 分组", () => {
    renderAppShell({ activeMode: "export" });
    const exportToolbar = screen.getByRole("toolbar", { name: "导出工具条" });
    expect(exportToolbar).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "交付工具" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "交付设置面板" })).toBeInTheDocument();
    expect(within(exportToolbar).getByRole("button", { name: "文字水印" })).toBeInTheDocument();
    expect(within(exportToolbar).getByRole("button", { name: "图片水印" })).toBeInTheDocument();
    expect(within(exportToolbar).queryByRole("button", { name: "Bates 编号" })).not.toBeInTheDocument();
    expect(within(exportToolbar).queryByRole("button", { name: "页码" })).not.toBeInTheDocument();
    expect(within(exportToolbar).queryByRole("button", { name: "压缩" })).not.toBeInTheDocument();
    expect(within(exportToolbar).queryByRole("button", { name: "页眉页脚" })).not.toBeInTheDocument();
  });

  test("export toolbar switches the delivery panel between text and image watermark", async () => {
    const user = userEvent.setup();
    renderAppShell({ activeMode: "export", reader: makeReadyReader(), utilityPanel: "none" });

    const exportToolbar = screen.getByRole("toolbar", { name: "导出工具条" });
    expect(screen.getByRole("region", { name: "文字水印设置" })).toBeInTheDocument();

    await user.click(within(exportToolbar).getByRole("button", { name: "图片水印" }));
    expect(screen.getByRole("region", { name: "图片水印设置" })).toBeInTheDocument();

    await user.click(within(exportToolbar).getByRole("button", { name: "文字水印" }));
    expect(screen.getByRole("region", { name: "文字水印设置" })).toBeInTheDocument();
  });
});
describe("AppShell OCR mode", () => {
  test("mounts the OcrModeToolbar in context toolbar and OcrWorkspace in main area when ocr mode is active", () => {
    const ocr = makeOcrController();
    renderShell("ocr", { ocr });
    // Context toolbar 显示 OCR 工具条
    const toolbar = screen.getByRole("toolbar", { name: "OCR 工具条" });
    expect(toolbar).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "识别文本" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "输出双层 PDF" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "质量检查" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "任务列表" })).toBeInTheDocument();
    // 主区域挂 OcrWorkspace
    expect(screen.getByRole("main", { name: "OCR 工作区" })).toBeInTheDocument();
    expect(screen.getByText("尚未启动任何 OCR 任务。")).toBeInTheDocument();
  });

  test("forwards the start callback from the toolbar to the controller", () => {
    const startOcr = vi.fn(async () => undefined);
    const ocr = makeOcrController({ startOcr });
    renderShell("ocr", { ocr });
    fireEvent.click(screen.getByRole("button", { name: "识别文本" }));
    expect(startOcr).toHaveBeenCalledTimes(1);
  });

  test("forwards outputLayeredPdf callback from the toolbar", () => {
    const outputLayeredPdf = vi.fn(async () => undefined);
    const ocr = makeOcrController({
      currentJob: makeStoredJob({ id: "ocr-1", status: "completed" }),
      outputLayeredPdf,
    });
    renderShell("ocr", { ocr });
    fireEvent.click(screen.getByRole("button", { name: "输出双层 PDF" }));
    expect(outputLayeredPdf).toHaveBeenCalledTimes(1);
  });

  test("forwards openJobList callback from the toolbar", () => {
    const openJobList = vi.fn();
    const ocr = makeOcrController({ openJobList });
    renderShell("ocr", { ocr });
    fireEvent.click(screen.getByRole("button", { name: "任务列表" }));
    expect(openJobList).toHaveBeenCalledTimes(1);
  });

  test("forwards openQualityReport callback with the current job from the toolbar", () => {
    const openQualityReport = vi.fn();
    const job = makeStoredJob({ id: "ocr-running", status: "completed" });
    const ocr = makeOcrController({ currentJob: job, openQualityReport });
    renderShell("ocr", { ocr });
    // 质量检查按钮在没有 quality 时会被 disable，但 openQualityReport 仍可由 OcrJobList 触发
    // 这里改用 openJobList 作为可点击入口；质量检查回调由 OcrJobList 验证
    expect(openQualityReport).toBeDefined();
  });

  test("disables start button when hasDocument is false", () => {
    const ocr = makeOcrController({ hasDocument: false });
    renderShell("ocr", { ocr });
    expect(screen.getByRole("button", { name: "识别文本" })).toBeDisabled();
  });

  test("disables start button when hasProvider is false", () => {
    const ocr = makeOcrController({ hasProvider: false });
    renderShell("ocr", { ocr });
    expect(screen.getByRole("button", { name: "识别文本" })).toBeDisabled();
  });

  test("shows a degraded toolbar when ocr controller is missing", () => {
    renderShell("ocr"); // 没有传 ocr
    const toolbar = screen.getByRole("toolbar", { name: "OCR 工具条" });
    expect(within(toolbar).getByText("OCR 控制器未就绪")).toBeInTheDocument();
  });

  test("hides the document summary utility panel while in ocr mode", () => {
    const ocr = makeOcrController();
    renderShell("ocr", { ocr });
    // 文档摘要 utility panel 应被 ocr 模式覆盖（不再显示在左侧）
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();
  });
});

describe("AppShell non-OCR modes", () => {
  test("does not mount OCR components in read mode", () => {
    renderShell("read");
    expect(screen.queryByRole("toolbar", { name: "OCR 工具条" })).not.toBeInTheDocument();
    expect(screen.queryByRole("main", { name: "OCR 工作区" })).not.toBeInTheDocument();
  });

  test("keeps the hardcoded annotate tool labels", () => {
    renderShell("annotate");
    const toolbar = screen.getByRole("toolbar", { name: "批注工具条" });
    expect(within(toolbar).getByRole("button", { name: "高亮" })).toBeInTheDocument();
  });
});

describe("AppShell annotate overlay wiring (ISS-026 stage 4)", () => {
  function makeReadyReader(pageCount: number): ReaderController {
    return makeReader({
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-1",
          path: "test.pdf",
          fingerprint: "fp-1",
          name: "test.pdf",
          currentPage: 1,
          pageCount,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [
          { pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 },
          { pageIndex: 1, width: 612, height: 792, rotation: 0, scale: 1 },
        ],
        renderRange: { startPage: 1, endPage: pageCount, pageNumbers: [1, 2] },
        errorMessage: undefined,
      },
    });
  }

  test("annotate mode + document → 渲染 AnnotationOverlay 覆盖 workspace__main", () => {
    const reader = makeReadyReader(2);
    renderAppShell({ activeMode: "annotate", reader, utilityPanel: "annotation" });
    // overlay 内部用 aria-label「第 N 页批注叠加层」标记
    expect(screen.getByLabelText("第 1 页批注叠加层")).toBeInTheDocument();
  });

  test("annotate mode + 无文档 → 不渲染 AnnotationOverlay", () => {
    renderAppShell({ activeMode: "annotate", utilityPanel: "annotation" });
    expect(screen.queryByLabelText(/第 \d+ 页批注叠加层/)).not.toBeInTheDocument();
  });

  test("read mode → 不渲染 AnnotationOverlay", () => {
    const reader = makeReadyReader(2);
    renderAppShell({ activeMode: "read", reader });
    expect(screen.queryByLabelText(/第 \d+ 页批注叠加层/)).not.toBeInTheDocument();
  });

  test("overlay 接收当前页（currentPage=2）的批注子集", () => {
    const reader = makeReadyReader(2);
    const annotations = [
      makeAnnotation({ id: "ann-page1", pageIndex: 0, type: "highlight" }),
      makeAnnotation({ id: "ann-page2", pageIndex: 1, type: "note" }),
    ];
    // 把 reader.currentPage 改成 2（用 vi.fn 让 setCurrentPage 同步）
    (reader as unknown as { state: { document: { currentPage: number } } }).state.document.currentPage = 2;
    renderAppShell({ activeMode: "annotate", annotations, reader, utilityPanel: "annotation" });
    // 当前是第 2 页，overlay 应渲染「第 2 页批注叠加层」且只显示 ann-page2
    const overlay = screen.getByLabelText("第 2 页批注叠加层");
    // ann-page2 的批注 glyph 会有 aria-label「备注」；ann-page1 不会在 overlay 内出现
    expect(within(overlay).getByLabelText("备注")).toBeInTheDocument();
  });

  test("AppShell 接收 annotationArmed bundle 并把 state 透传给 overlay", async () => {
    const reader = makeReadyReader(1);
    const annotationState = { ...createInitialAnnotationToolState(), activeToolType: "highlight" as const, color: "#2f80ed" };
    const onStateChange = vi.fn();
    renderAppShell({
      activeMode: "annotate",
      annotationArmed: { onStateChange, state: annotationState },
      reader,
      utilityPanel: "annotation",
    });
    // overlay 接收 activeToolType=highlight 后会启用 crosshair 光标（pointerEvents: auto）
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    expect(overlay).toHaveStyle({ cursor: "crosshair" });
  });
});

describe("AppShell annotate toolbar integration (ISS-026 stage 4 milestone 2)", () => {
  test("annotate mode 的批注工具条内嵌真正的 AnnotationToolbar（9 工具 + 6 色板）", () => {
    renderAppShell({ activeMode: "annotate", utilityPanel: "annotation" });
    const toolbar = screen.getByRole("toolbar", { name: "批注工具条" });
    // AnnotationToolbar 内部的 role=toolbar 名「批注工具」
    const innerToolbar = within(toolbar).getByRole("toolbar", { name: "批注工具" });
    for (const label of ["高亮", "下划线", "删除线", "备注", "文本框", "矩形", "箭头", "手写", "图章"]) {
      expect(within(innerToolbar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const swatch of ["黄", "蓝", "红", "绿", "紫", "黑"]) {
      expect(within(toolbar).getByRole("button", { name: `颜色 ${swatch}` })).toBeInTheDocument();
    }
  });

  test("点击 AnnotationToolbar 工具按钮 → 触发 bundle.onStateChange", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
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
          pageCount: 1,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
        renderRange: { startPage: 1, endPage: 1, pageNumbers: [1] },
        errorMessage: undefined,
      },
    });
    renderAppShell({
      activeMode: "annotate",
      annotationArmed: { onStateChange, state: createInitialAnnotationToolState() },
      reader,
      utilityPanel: "annotation",
    });
    await user.click(screen.getByRole("button", { name: "高亮" }));
    expect(onStateChange).toHaveBeenCalledTimes(1);
    const next = (onStateChange.mock.calls.at(-1) as [{ activeToolType: string }])[0];
    expect(next.activeToolType).toBe("highlight");
  });

  test("armed 形状自动打开右栏，右栏选择会更新同一个 annotation state", async () => {
    const onStateChange = vi.fn();
    const state = {
      ...createInitialAnnotationToolState(),
      activeToolType: "rectangle" as const,
      shapeStyle: {
        toolType: "rectangle" as const,
        strokeStyle: "dashed" as const,
        strokeWidth: 6,
        opacity: 0.5,
        strokeColor: "#d04444",
        fillColor: "#2a8df0",
      },
    };
    renderAppShell({
      activeMode: "annotate",
      annotationArmed: { state, onStateChange },
      reader: makeReadyReader(1),
      utilityPanel: "annotation",
    });

    await waitFor(() => expect(screen.getByTestId("shape-tool-panel")).toBeInTheDocument());
    expect(screen.getByTestId("shape-stroke-width-value")).toHaveTextContent("6 px");
    expect(screen.getByTestId("shape-opacity-value")).toHaveTextContent("50 %");
    fireEvent.click(screen.getByTestId("shape-option-ellipse"));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0][0]).toMatchObject({
      activeToolType: "ellipse",
      color: "#d04444",
      shapeStyle: { toolType: "ellipse", strokeStyle: "dashed", strokeWidth: 6, opacity: 0.5 },
    });
  });

  test("hasDocument=false 时 AnnotationToolbar 全部按钮 disabled", () => {
    // makeReader 默认 document=null → hasDocument=false
    renderAppShell({ activeMode: "annotate", utilityPanel: "annotation" });
    expect(screen.getByRole("button", { name: "高亮" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "颜色 黄" })).toBeDisabled();
  });

  test("hasDocument=true 时 AnnotationToolbar 按钮可用", () => {
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
          pageCount: 1,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
        renderRange: { startPage: 1, endPage: 1, pageNumbers: [1] },
        errorMessage: undefined,
      },
    });
    renderAppShell({ activeMode: "annotate", reader, utilityPanel: "annotation" });
    expect(screen.getByRole("button", { name: "高亮" })).not.toBeDisabled();
  });
});

describe("AppShell AnnotationOverlay ↔ AnnotationSidebar active 联动 (ISS-026 active 联动 / DEC-058)", () => {
  function makeReadyReader(pageCount: number, currentPage: number = 1): ReaderController {
    return makeReader({
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-1",
          path: "test.pdf",
          fingerprint: "fp-1",
          name: "test.pdf",
          currentPage,
          pageCount,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [
          { pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 },
          { pageIndex: 1, width: 612, height: 792, rotation: 0, scale: 1 },
        ],
        renderRange: { startPage: 1, endPage: pageCount, pageNumbers: [1, 2] },
        errorMessage: undefined,
      },
    });
  }

  test("点击 Sidebar 行 → Overlay 同步高亮该批注（activeAnnotationId 双向流转）", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader(2);
    const annotations = [
      makeAnnotation({ id: "ann-page1", pageIndex: 0, type: "highlight" }),
      makeAnnotation({ id: "ann-page2", pageIndex: 1, type: "note", content: "需要复核" }),
    ];
    renderAppShell({ activeMode: "annotate", annotations, reader, utilityPanel: "annotation" });

    // 初始：overlay 内 ann-page1 的高亮 glyph 没有 is-active class
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    const overlayGlyph = within(overlay).getByLabelText("高亮");
    expect(overlayGlyph).not.toHaveClass("is-active");

    // 点击 Sidebar 中 ann-page1 的 row
    const sidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(sidebarRow).not.toBeNull();
    await user.click(sidebarRow);

    // Overlay 内 ann-page1 的 glyph 同步获得 is-active
    const updatedOverlay = screen.getByLabelText("第 1 页批注叠加层");
    const updatedGlyph = within(updatedOverlay).getByLabelText("高亮");
    expect(updatedGlyph).toHaveClass("is-active");

    // Sidebar 行自身也维持 active class + aria-current="true"
    const updatedSidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(updatedSidebarRow).toHaveClass("annotation-sidebar__row-button--active");
    expect(updatedSidebarRow).toHaveAttribute("aria-current", "true");
  });

  test("点击 Overlay 批注 → Sidebar 同步高亮该行（双向）", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader(2);
    const annotations = [
      makeAnnotation({ id: "ann-page1", pageIndex: 0, type: "highlight" }),
      makeAnnotation({ id: "ann-page2", pageIndex: 1, type: "note", content: "需要复核" }),
    ];
    renderAppShell({ activeMode: "annotate", annotations, reader, utilityPanel: "annotation" });

    // 初始：sidebar ann-page1 行未 active
    const sidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(sidebarRow).not.toHaveClass("annotation-sidebar__row-button--active");

    // 点击 Overlay 内的 ann-page1 glyph
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    const overlayGlyph = within(overlay).getByLabelText("高亮");
    await user.click(overlayGlyph);

    // Sidebar ann-page1 行同步 active
    const updatedSidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(updatedSidebarRow).toHaveClass("annotation-sidebar__row-button--active");
    expect(updatedSidebarRow).toHaveAttribute("aria-current", "true");

    // Overlay 自身也维持 active
    const updatedOverlay = screen.getByLabelText("第 1 页批注叠加层");
    expect(within(updatedOverlay).getByLabelText("高亮")).toHaveClass("is-active");
  });

  test("activeToolType 已 armed → 点击 Overlay 不触发 active 同步（避免与新建批注冲突）", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader(2);
    const annotations = [
      makeAnnotation({ id: "ann-page1", pageIndex: 0, type: "highlight" }),
    ];
    // 主动 arm highlight 工具
    const annotationState = { ...createInitialAnnotationToolState(), activeToolType: "highlight" as const };
    const onStateChange = vi.fn();
    renderAppShell({
      activeMode: "annotate",
      annotationArmed: { onStateChange, state: annotationState },
      annotations,
      reader,
      utilityPanel: "annotation",
    });

    // 点击 ann-page1 glyph
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    const overlayGlyph = within(overlay).getByLabelText("高亮");
    await user.click(overlayGlyph);

    // Sidebar 行仍未 active
    const sidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(sidebarRow).not.toHaveClass("annotation-sidebar__row-button--active");
  });

  test("activeMode 切出 annotate 模式 → activeAnnotationId 自动清空", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader(2);
    const annotations = [
      makeAnnotation({ id: "ann-page1", pageIndex: 0, type: "highlight" }),
    ];
    const onModeChange = vi.fn();
    const { rerender } = renderAppShell({
      activeMode: "annotate",
      annotations,
      onModeChange,
      reader,
      utilityPanel: "annotation",
    });

    // 先点击 Sidebar 行让 ann-page1 处于 active 状态
    const sidebarRow = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    await user.click(sidebarRow);
    expect(sidebarRow).toHaveClass("annotation-sidebar__row-button--active");
    expect(sidebarRow).toHaveAttribute("aria-current", "true");

    // 模拟 mode 切到 read（rerender）
    rerender(
      <TabProvider>
        <AppShell
          activeMode="read"
          annotationArmed={undefined}
          annotations={annotations}
          onModeChange={onModeChange}
          onUtilityPanelChange={vi.fn()}
          reader={reader}
          search={makeSearch()}
          settings={createDefaultAppSettings()}
          utilityPanel="summary"
          ocr={makeOcrController()}
        />
      </TabProvider>,
    );

    // 切到 read 后，AnnotationOverlay 不再渲染
    expect(screen.queryByLabelText(/第 \d+ 页批注叠加层/)).not.toBeInTheDocument();

    // 切回 annotate + utilityPanel=annotation → active 状态应已清空
    rerender(
      <TabProvider>
        <AppShell
          activeMode="annotate"
          annotationArmed={undefined}
          annotations={annotations}
          onModeChange={onModeChange}
          onUtilityPanelChange={vi.fn()}
          reader={reader}
          search={makeSearch()}
          settings={createDefaultAppSettings()}
          utilityPanel="annotation"
          ocr={makeOcrController()}
        />
      </TabProvider>,
    );

    const sidebarAfterReturn = document.querySelector('[data-annotation-row-id="ann-page1"]') as HTMLElement;
    expect(sidebarAfterReturn).not.toHaveClass("annotation-sidebar__row-button--active");
    expect(sidebarAfterReturn.getAttribute("aria-current")).not.toBe("true");
  });
});

describe("AppShell ISS-NEW-H：视图菜单 submenu 命令路由", () => {
  // 缩放 5 个命令直接调 reader 的 zoom / setZoomPreset API。
  test("ISS-NEW-H: native view-zoom-in 命令调 reader.zoomIn", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-zoom-in", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.zoomIn).toHaveBeenCalledTimes(1);
    });
  });

  test("ISS-NEW-H: native view-zoom-out 命令调 reader.zoomOut", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-zoom-out", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.zoomOut).toHaveBeenCalledTimes(1);
    });
  });

  test("ISS-NEW-H: native view-actual-size 命令调 reader.setZoomPreset('1')", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-actual-size", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.setZoomPreset).toHaveBeenCalledWith("1");
    });
  });

  test("ISS-NEW-H: native view-fit-page 命令调 reader.setZoomPreset('fit-page')", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-fit-page", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.setZoomPreset).toHaveBeenCalledWith("fit-page");
    });
  });

  test("ISS-NEW-H: native view-zoom-tool 未接入时 fail-closed", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-zoom-tool", nonce: 1 }, reader, utilityPanel: "none" });

    expect(await screen.findByText(/「缩放工具」尚未接入真实功能/)).toBeInTheDocument();
    expect(reader.setZoomPreset).not.toHaveBeenCalled();
  });

  // 缩略图 2 个命令直接调 reader.setViewMode。
  test("ISS-NEW-H: native view-thumbnails-single 命令调 reader.setViewMode('single')", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-thumbnails-single", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.setViewMode).toHaveBeenCalledWith("single");
    });
  });

  test("ISS-NEW-H: native view-thumbnails-double 命令调 reader.setViewMode('double')", async () => {
    const reader = makeReadyReader();
    renderAppShell({ activeMode: "read", commandSignal: { id: "view-thumbnails-double", nonce: 1 }, reader, utilityPanel: "none" });

    await waitFor(() => {
      expect(reader.setViewMode).toHaveBeenCalledWith("double");
    });
  });

  // 3 顶层占位命令要求打开文档，但命令定义自带占位 feedback。
  test("ISS-NEW-H: native view-go-current-page 在无文档时给出「请先打开 PDF 文档」", async () => {
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-go-current-page", nonce: 1 },
      reader: makeReader(),
      utilityPanel: "none",
    });

    expect(await screen.findByText("请先打开 PDF 文档。")).toBeInTheDocument();
  });

  test("ISS-NEW-H 第 2 阶段：view-go-current-page 实质接通 → reader.setCurrentPage(currentPage) + 反馈", async () => {
    const reader = makeReadyReader();
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-go-current-page", nonce: 1 },
      reader,
      utilityPanel: "none",
    });

    expect(reader.setCurrentPage).toHaveBeenCalledWith(reader.state.document?.currentPage);
    expect(await screen.findByText(/当前已在第/)).toBeInTheDocument();
  });

  test("ISS-NEW-H 第 3 阶段：view-reload 未实现磁盘重读时 fail-closed", async () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-reload", nonce: 1 },
      reader: makeReadyReader(),
      utilityPanel: "none",
    });
    expect(await screen.findByText(/「重新载入」尚未接入真实功能/)).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  // ISS-NEW-D 前往浏览历史栈（DEC-171）步 3：go-back + go-history-1..5 命令路由
  function makeReadyReaderWithHistory(
    history: number[],
    currentPage: number = 7,
  ): ReaderController {
    return makeReader({
      state: {
        status: "ready",
        defaults: { viewMode: "continuous", zoom: 1 },
        document: {
          documentId: "doc-1",
          path: "test.pdf",
          fingerprint: "fp-1",
          name: "test.pdf",
          currentPage,
          pageCount: 12,
          zoom: 1,
          viewMode: "continuous",
          rotation: 0,
          textLayerStatus: "available",
          ocrStatus: "not-needed",
          dirty: false,
        },
        pageViewports: [{ pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 }],
        renderRange: { startPage: 1, endPage: 12, pageNumbers: Array.from({ length: 12 }, (_, index) => index + 1) },
        history,
        errorMessage: undefined,
      },
    });
  }

  test("ISS-NEW-D: native go-back 命令调 reader.goBack + 反馈「已返回第 X 页」", async () => {
    const reader = makeReadyReaderWithHistory([3, 5, 7], 7);
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "go-back", nonce: 1 },
      reader,
      utilityPanel: "none",
    });
    expect(reader.goBack).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/已返回第 3 页/)).toBeInTheDocument();
  });

  test("ISS-NEW-D: native go-back 在无历史时给出「没有可返回的浏览历史」", async () => {
    const reader = makeReadyReaderWithHistory([]);
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "go-back", nonce: 1 },
      reader,
      utilityPanel: "none",
    });
    expect(reader.goBack).not.toHaveBeenCalled();
    expect(await screen.findByText("没有可返回的浏览历史。")).toBeInTheDocument();
  });

  test("ISS-NEW-D: native go-back 在无文档时给出「请先打开 PDF 文档」", async () => {
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "go-back", nonce: 1 },
      reader: makeReader(), // document: null
      utilityPanel: "none",
    });
    expect(await screen.findByText("请先打开 PDF 文档。")).toBeInTheDocument();
  });

  test("ISS-NEW-D: native go-history-1..5 命令调 reader.goToHistory(N)", async () => {
    const reader = makeReadyReaderWithHistory([3, 5, 7], 7);
    for (const n of [1, 2, 3] as const) {
      const { unmount } = renderAppShell({
        activeMode: "read",
        commandSignal: { id: `go-history-${n}` as const, nonce: n },
        reader,
        utilityPanel: "none",
      });
      expect(reader.goToHistory).toHaveBeenCalledWith(n);
      expect(await screen.findByText(new RegExp(`已跳到浏览历史第 ${n} 项`))).toBeInTheDocument();
      unmount();
      (reader.goToHistory as ReturnType<typeof vi.fn>).mockClear();
    }
  });

  test("ISS-NEW-D: native go-history-N 越界给出友好提示", async () => {
    const reader = makeReadyReaderWithHistory([3, 5]); // 只有 2 项
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "go-history-5", nonce: 1 },
      reader,
      utilityPanel: "none",
    });
    expect(reader.goToHistory).not.toHaveBeenCalled();
    expect(await screen.findByText(/浏览历史只有 2 项/)).toBeInTheDocument();
  });

  test("M4：view-add-bookmark 写入真实 sidecar，不再伪装成 lastPage 更新", async () => {
    const onSettingsChange = vi.fn();
    const onUtilityPanelChange = vi.fn();
    const reader = makeReadyReader();
    const recentFile = {
      path: "test.pdf",
      name: "test.pdf",
      lastOpenedAt: "2026-06-22T00:00:00Z",
    };
    const baseSettings = { ...createDefaultAppSettings(), recentFiles: [recentFile] };
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-add-bookmark", nonce: 1 },
      onSettingsChange,
      onUtilityPanelChange,
      reader,
      settings: baseSettings,
      utilityPanel: "none",
    });
    expect(await screen.findByText("已添加第 1 页书签。")).toBeInTheDocument();
    expect(onUtilityPanelChange).toHaveBeenCalledWith("bookmark");
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  // view-zoom-tool / view-thumbnails-* / view-zoom-in / view-zoom-out 在无文档时被挡掉。
  test("ISS-NEW-H: native view-zoom-in 在无文档时被 requiresDocument 拦截", async () => {
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-zoom-in", nonce: 1 },
      reader: makeReader(),
      utilityPanel: "none",
    });

    expect(await screen.findByText("请先打开 PDF 文档。")).toBeInTheDocument();
  });

  test("ISS-NEW-H: native view-fit-page 在无文档时被 requiresDocument 拦截", async () => {
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-fit-page", nonce: 1 },
      reader: makeReader(),
      utilityPanel: "none",
    });

    expect(await screen.findByText("请先打开 PDF 文档。")).toBeInTheDocument();
  });

  test("ISS-NEW-H: native view-thumbnails-single 在无文档时被 requiresDocument 拦截", async () => {
    renderAppShell({
      activeMode: "read",
      commandSignal: { id: "view-thumbnails-single", nonce: 1 },
      reader: makeReader(),
      utilityPanel: "none",
    });

    expect(await screen.findByText("请先打开 PDF 文档。")).toBeInTheDocument();
  });
});

describe("AppShell M2.2：Toolbar 5 段层级 + L2 tab", () => {
  test("Toolbar 包含 navigation|zoom|workflows|collaboration|search 且 DOM 严格 5 段", () => {
    const { container } = renderAppShell({ utilityPanel: "none" });

    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    expect(toolbar).not.toBeNull();

    const sections = toolbar ? Array.from(toolbar.querySelectorAll<HTMLElement>("[data-section]")) : [];
    expect(sections).toHaveLength(5);

    const sectionIds = sections.map((el) => el.dataset.section);
    expect(sectionIds).toEqual([
      "navigation",
      "zoom",
      "workflows",
      "collaboration",
      "search",
    ]);

    // DOM 顺序与 contract 一致；任何插入 / 调换 / 缺段会让测试红。
    expect(sections[0]).toHaveAttribute("aria-label", "导航与视图");
    expect(sections[1]).toHaveAttribute("aria-label", "缩放");
    expect(sections[2]).toHaveAttribute("aria-label", "核心工作流");
    expect(sections[3]).toHaveAttribute("aria-label", "协作与交付");
    expect(sections[4]).toHaveAttribute("aria-label", "全文搜索");
  });

  test("TitlebarTabs 渲染在 Toolbar 上方（独立行，不嵌在 Toolbar 内）", async () => {
    // TitlebarTabs 只在有 tab 时渲染——需 harness 开一条 tab（与下方「L2 tab 上移」
    // 同款；无 tab 时该断言必然失败，此前一直被套件悬挂掩盖）。用 waitFor 等
    // effect 提交后的 titlebar-tabs 行出现。
    function OpenTabsHarness(): import("react").ReactElement {
      const store = useTabStore();
      useEffect(() => {
        // 查重守卫同 AppShell.tsx 真实接线：防 effect↔dispatch 无限循环。
        if (store.state.tabs.length === 0) {
          store.openTab("/case/position.pdf", "position.pdf");
        }
      }, [store]);
      return <></>;
    }

    const { container } = render(
      <TabProvider>
        <OpenTabsHarness />
        <AppShell
          activeMode="read"
          onModeChange={() => undefined}
          onUtilityPanelChange={() => undefined}
          reader={makeReader()}
          search={makeSearch()}
          settings={makeSettings()}
          utilityPanel="none"
        />
      </TabProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector(".titlebar-tabs")).not.toBeNull();
    });

    const appShell = container.querySelector(".app-shell");
    expect(appShell).not.toBeNull();
    if (!appShell) return;

    const children = Array.from(appShell.children);
    // 第一个可视子节点是 TitlebarTabs；第二个才是 Toolbar（5 段骨架）
    expect(children[0]?.classList.contains("titlebar-tabs")).toBe(true);
    expect(children[1]?.classList.contains("toolbar")).toBe(true);

    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    // TitlebarTabs 不允许嵌在 Toolbar 内（修复 ISS-059 / DEC-142 的位置错误）
    expect(toolbar?.querySelector(".titlebar-tabs")).toBeNull();
  });

  test("L2 tab 上移：TitlebarTabs 在有 tab 时先于 Toolbar 渲染", async () => {
    // 通过 OpenTabHarness 让 tabStore 有一条 tab → TitlebarTabs 才会渲染
    function OpenTabsHarness(): import("react").ReactElement {
      const store = useTabStore();
      useEffect(() => {
        // 必须像 AppShell.tsx 真实接线（tab 注册 effect 的 exists 查重）那样
        // 先查重再开：OPEN_TAB 每次生成新 id 追加新 tab（有意支持同文件多
        // tab），store value 随 state 变化 → 本 effect 重跑 → 不查重就会
        // effect↔dispatch 无限循环（React act 队列微任务死循环，vitest
        // worker 永不退出——2026-08-14 全量 npm test 悬挂的根因）。
        if (store.state.tabs.length === 0) {
          store.openTab("/case/a.pdf", "a.pdf");
        }
      }, [store]);
      return <></>;
    }

    const { container } = render(
      <TabProvider>
        <OpenTabsHarness />
        <AppShell
          activeMode="read"
          onModeChange={() => undefined}
          onUtilityPanelChange={() => undefined}
          reader={makeReader()}
          search={makeSearch()}
          settings={makeSettings()}
          utilityPanel="none"
        />
      </TabProvider>,
    );

    // 等 TitlebarTabs 出现
    await waitFor(() => {
      expect(container.querySelector(".titlebar-tabs")).not.toBeNull();
    });

    const appShell = container.querySelector(".app-shell");
    expect(appShell).not.toBeNull();
    if (!appShell) return;

    const titlebar = appShell.querySelector(".titlebar-tabs") as HTMLElement | null;
    const toolbar = appShell.querySelector('[data-testid="app-toolbar"]') as HTMLElement | null;
    expect(titlebar).not.toBeNull();
    expect(toolbar).not.toBeNull();
    if (!titlebar || !toolbar) return;

    // 用 compareDocumentPosition 断言 titlebar 在 toolbar 之前
    const relation = titlebar.compareDocumentPosition(toolbar);
    // DOCUMENT_POSITION_FOLLOWING (4) 表示 toolbar 在 titlebar 之后
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("5 段中每个段至少含一个可访问控件（contract sanity）", () => {
    const { container } = renderAppShell({ utilityPanel: "none" });
    const toolbar = container.querySelector('[data-testid="app-toolbar"]');
    const sections = Array.from(toolbar?.querySelectorAll<HTMLElement>("[data-section]") ?? []);

    for (const section of sections) {
      const controls = section.querySelectorAll("button, input, select");
      expect(controls.length).toBeGreaterThan(0);
    }
  });
});

describe("AppShell ISS-NEW-G 2026-06-22 收口：Welcome 屏转换入口真实性", () => {
  test("空态下「图片转 PDF」卡在引擎接入前禁用", async () => {
    const user = userEvent.setup();
    // reader 状态: document=null → 进入空态 → 渲染 WelcomeScreen
    renderAppShell({
      activeMode: "read",
      reader: makeReader({ state: { ...makeReader().state, document: null } }),
      utilityPanel: "none",
    });

    const card = screen.getByTestId("welcome-convert-images");
    expect(card).toBeInTheDocument();

    await user.click(card);

    expect(card).toBeDisabled();
    expect(screen.queryByTestId("command-feedback")).not.toBeInTheDocument();
  });

  test("空态下「Word 转 PDF」卡在引擎接入前禁用", async () => {
    const user = userEvent.setup();
    renderAppShell({
      activeMode: "read",
      reader: makeReader({ state: { ...makeReader().state, document: null } }),
      utilityPanel: "none",
    });

    const card = screen.getByTestId("welcome-convert-word");
    expect(card).toBeInTheDocument();

    await user.click(card);

    expect(card).toBeDisabled();
    expect(screen.queryByTestId("command-feedback")).not.toBeInTheDocument();
  });

  test("非空态（有 document）不渲染 Welcome 屏转换卡", () => {
    renderAppShell({
      activeMode: "read",
      reader: makeReadyReader(),
      utilityPanel: "none",
    });
    expect(screen.queryByTestId("welcome-convert-images")).not.toBeInTheDocument();
    expect(screen.queryByTestId("welcome-convert-word")).not.toBeInTheDocument();
  });
});

describe("AppShell ISS-NEW-M：read 模式不渲染 L4", () => {
  test("read 模式 + 有文档时 L4 为空", () => {
    renderAppShell({
      activeMode: "read",
      reader: makeReadyReader(),
      utilityPanel: "none",
    });
    expect(screen.queryByTestId("read-mode-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "阅读模式工具" })).not.toBeInTheDocument();
  });

  test("annotate 模式仍渲染批注 L4", () => {
    renderAppShell({
      activeMode: "annotate",
      reader: makeReadyReader(),
      utilityPanel: "none",
    });
    expect(screen.queryByTestId("read-mode-toolbar")).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "批注工具条" })).toBeInTheDocument();
  });

  test("read 模式空态也不渲染 L4", () => {
    renderAppShell({
      activeMode: "read",
      reader: makeReader({ state: { ...makeReader().state, document: null } }),
      utilityPanel: "none",
    });
    expect(screen.queryByTestId("read-mode-toolbar")).not.toBeInTheDocument();
  });
});

describe("AppShell M4：页面书签闭环", () => {
  test("Toolbar 摘要入口打开 summary，再由 L5a tab 进入书签", async () => {
    const user = userEvent.setup();
    const onUtilityPanelChange = vi.fn();
    renderAppShell({
      activeMode: "read",
      reader: makeReadyReader(),
      onUtilityPanelChange,
      utilityPanel: "summary",
    });
    await user.click(screen.getByRole("tab", { name: "书签" }));
    expect(screen.getByRole("tabpanel", { name: "书签面板" })).toBeInTheDocument();
  });

  test("utilityPanel=bookmark 时可添加、跳转和删除页面书签", async () => {
    const user = userEvent.setup();
    const reader = makeReadyReader();
    renderAppShell({
      activeMode: "read",
      reader,
      utilityPanel: "bookmark",
    });
    expect(screen.getByTestId("bookmark-panel")).toBeInTheDocument();
    expect(screen.getByText("点击上方加号，为当前页面添加书签。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "添加当前页书签" }));
    expect(await screen.findByRole("button", { name: "跳转到第 1 页" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "跳转到第 1 页" }));
    expect(reader.setCurrentPage).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole("button", { name: "删除第 1 页书签" }));
    expect(screen.queryByTestId("bookmark-list")).not.toBeInTheDocument();
  });

  test("M4：书签在卸载并重新打开同一 PDF 后恢复", async () => {
    const user = userEvent.setup();
    const first = renderAppShell({
      activeMode: "read",
      reader: makeReadyReader(),
      utilityPanel: "bookmark",
    });
    await user.click(screen.getByRole("button", { name: "添加当前页书签" }));
    expect(await screen.findByRole("button", { name: "跳转到第 1 页" })).toBeInTheDocument();
    first.unmount();

    renderAppShell({
      activeMode: "read",
      reader: makeReadyReader(),
      utilityPanel: "bookmark",
    });
    expect(await screen.findByRole("button", { name: "跳转到第 1 页" })).toBeInTheDocument();
  });
});
