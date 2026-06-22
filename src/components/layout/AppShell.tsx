import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getPanelWidth } from "../../shared/panelWidthStore";
import type { AnnotationSidecar, PdfAnnotation } from "../../shared";
import type { ZoomPresetId } from "../../shared/pdf/types";
import { ZOOM_PRESETS } from "../../shared/pdf/types";
import type { AppSettings } from "../../shared";
import { setCurrentLanguage, useI18n } from "../../shared/i18n/useI18n";
import { suggestOutputName } from "../../shared/naming";
import { getCommandById, type AppCommandId, type AppCommandSignal } from "../../shared/app/commands";
import { getModeTools } from "./toolbarRegistry";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import {
  OcrModeToolbar,
  OcrWorkspace,
  type OcrWorkspaceController,
} from "../../modules/ocr";
import {
  armAnnotationTool,
  createInitialAnnotationToolState,
  disarmAnnotationTool,
} from "../../modules/annotation";
import type { AnnotationToolState } from "../../modules/annotation";
import { useFormController } from "../../modules/forms/useFormController";
import { setActiveFormController } from "../../modules/forms/activeFormController";
import { FormsPanel } from "../../modules/forms/ui/FormsPanel";
import { createPdfOperationEngine } from "../../modules/export";
import { ExportDeliveryPanel, type ExportDeliveryTool } from "../../modules/export/ui/ExportDeliveryPanel";
import { ReaderCanvas } from "./ReaderCanvas";
import { DocumentSummaryPanel, ViewSettingsPanel } from "./Sidebar";
import { AnnotationSidebar, type AnnotationFlattenResult } from "./AnnotationSidebar";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { EditModeGridView } from "./EditModeGridView";
import { RightPanel } from "./RightPanel";
import { SecurityPanel } from "./SecurityPanel";
import type { ShapeToolValue } from "./panels/ShapeToolPanel";
import type { SearchHitItem } from "./panels/SearchResultsPanel";
import {
  TextSelectionToolbar,
  usePdfTextSelection,
  type AnnotationAction,
  type CopyAction,
} from "./TextSelectionToolbar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { TitlebarTabs } from "./TitlebarTabs";
import { useTabStore } from "../../state/tabStore";
import { SettingsPanel } from "../../modules/settings/SettingsPanel";
import type { SectionId } from "../../modules/settings/sections";
import { AnnotationOverlay, type AnnotationDraftInput, type AnnotationOverlayViewport } from "./AnnotationOverlay";
import { RedactionOverlay, type RedactionRegionDraft } from "../../modules/redaction/ui/RedactionOverlay";
import { applyRedaction } from "../../modules/redaction/redactionEngine";
import { regionsScreenToPdf, selectPageCanvas } from "../../modules/redaction/redactionCoords";
import { readPdfMetadata, writePdfMetadata, type PdfMetadata } from "../../modules/document/properties";
import { PropertiesDialog } from "../../modules/document/ui/PropertiesDialog";
import {
  buildOutlineTreeFromOcrText,
  buildOutlineTreeFromPages,
  type ChapterHeadingNode,
  writePdfOutline,
} from "../../modules/ocr";
import type { OcrTextExtractionResponse } from "../../shared/ocr/jobQueue";
import { loadPdfFromBytes } from "../../modules/reader/pdfReaderService";
import { AutoTocDialog } from "../../modules/ocr/ui/AutoTocDialog";
import type {
  AnnotationArmedStateBundle,
  AnnotationDraftSubmission,
  AppModeId,
  RightPanelId,
  UtilityPanelId,
} from "./types";

interface AppShellProps {
  activeMode: AppModeId;
  annotations?: PdfAnnotation[];
  onModeChange: (mode: AppModeId) => void;
  onSettingsChange?: (settings: AppSettings) => void;
  onUtilityPanelChange: (panel: UtilityPanelId) => void;
  commandSignal?: AppCommandSignal | null;
  reader: ReaderController;
  search: TextSearchController;
  settings: AppSettings;
  utilityPanel: UtilityPanelId;
  /**
   * OCR 工作区控制器；当 activeMode === "ocr" 时挂入 context toolbar + 主区域。
   * 测试可传 mock controller；生产环境由 App.tsx 调用 useOcrWorkspaceController 创建。
   */
  ocr?: OcrWorkspaceController;
  /**
   * 批注 armed 状态 bundle（state + setter）。stage 4 接入 AppShell
   * 后，App.tsx 持有单一真相源并把受控值回填；未传时回退到初始 state，
   * 以保证既有 AppShell 测试不破。
   */
  annotationArmed?: AnnotationArmedStateBundle;
  /** 用户在 overlay 上完成一次新建时回调；stage 4 由 App.tsx 注入 service.addAnnotation 链 */
  onAnnotationDraft?: (input: AnnotationDraftSubmission) => void;
  /** 用户点击已有批注时回调（用于侧边栏跳转等扩展） */
  onAnnotationClick?: (annotationId: string) => void;
  /**
   * OCR-needed 状态条"前往 OCR 模式"按钮的回调（ISS-009 M1 / DEC-049）。
   * 由 App.tsx 注入到 ReaderCanvas，避免阅读态组件直接依赖 mode setter。
   */
  onRequestOcr?: () => void;
}

const exportToolGroups = [
  {
    label: "交付工具",
    tools: [
      { commandId: "export-watermark-text", label: "文字水印" },
      { commandId: "export-watermark-image", label: "图片水印" },
    ],
  },
] satisfies Array<{ label: string; tools: Array<{ commandId: AppCommandId; label: string }> }>;

// ISS-NEW-E（2026-06-22 收口）：read 模式也作为 L4 二级工具条的一员，
// aria-label 与其他模式对齐为「阅读模式工具」。
const contextualToolbarLabels: Record<Exclude<AppModeId, "pages">, string> = {
  read: "阅读模式工具",
  annotate: "批注工具条",
  export: "导出工具条",
  forms: "填写和签名工具条",
  ocr: "OCR 工具条",
};

export function AppShell({
  activeMode,
  annotations,
  annotationArmed,
  commandSignal,
  onAnnotationClick,
  onAnnotationDraft,
  onModeChange,
  onSettingsChange,
  onUtilityPanelChange,
  ocr,
  onRequestOcr,
  reader,
  search,
  settings,
  utilityPanel,
}: AppShellProps): ReactElement {
  // ISS-NEW-G（2026-06-22 收口）：i18n 字典查表。
  const i18n = useI18n();
  // ISS-059 Phase 1：Tab bar 集成。文件打开时 openTab 派发，关闭时由 TitlebarTabs 内部处理。
  const tabStore = useTabStore();
  useEffect(() => {
    const doc = reader.state.document;
    if (!doc) {
      return;
    }
    // 用 filePath 或 fingerprint 判断 tab 是否已存在；首次打开时新建 tab
    const exists = tabStore.state.tabs.some(
      (t) => t.filePath === (doc.path ?? "") || t.id.startsWith(`${doc.name}::`),
    );
    if (!exists) {
      tabStore.openTab(doc.path ?? "", doc.name);
    }
  }, [reader.state.document, tabStore]);
  // ISS-NEW-E（2026-06-22 收口）：showContextToolbar 改为 `activeMode !== "pages"`，
  // read 模式也显示 L4 二级工具条（由 ContextToolbar mode === "read" 分支统一渲染）。
  const showContextToolbar = activeMode !== "pages";
  // ISS-067 阶段 2：涂黑模式开关（先声明，再写 useEffect 依赖）
  const [redactActive, setRedactActive] = useState(false);
  // 离开 annotate 模式自动退出涂黑状态，避免 overlay 卡在非文档页。
  useEffect(() => {
    if (activeMode !== "annotate" && redactActive) {
      setRedactActive(false);
    }
  }, [activeMode, redactActive]);
  // ocr 模式独占主区域（OcrWorkspace 包含任务列表 + 质量报告），隐藏 utility panel
  const showUtilityPanel = utilityPanel !== "none" && activeMode !== "pages" && activeMode !== "ocr";
  const isOcrMode = activeMode === "ocr";
  const isAnnotateMode = activeMode === "annotate";
  // stage 4 批注 armed 状态：App.tsx 持有单一真相源；未传时回退到初始 state，保证既有测试不破
  const annotationState: AnnotationToolState = annotationArmed?.state ?? createInitialAnnotationToolState();
  // 批注 active 联动：AnnotationOverlay 与 AnnotationSidebar 共享选中状态（DEC-058 / ISS-026 active 联动）。
  // 状态由 AppShell 持有——Overlay 点击 → setActiveAnnotationId → Sidebar 高亮；Sidebar 点击 → setActiveAnnotationId → Overlay 高亮。
  // 离开 annotate 模式时自动清空，避免切换到 read / pages 等模式后保留 stale 选中态。
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [activeExportTool, setActiveExportTool] = useState<ExportDeliveryTool>("text-watermark");
  const [annotationViewSignal, setAnnotationViewSignal] = useState<{ view: "list" | "summary"; nonce: number }>({
    view: "list",
    nonce: 0,
  });
  const [settingsInitialSection, setSettingsInitialSection] = useState<SectionId>("general");
  // ISS-NEW-I（W2 worker）：形状工具受控 state — 真实绘制引擎由后续 worker 接入；
  // 当前 stage 仅 UI 状态持久化 + 右栏渲染 shape panel。
  const [shapeToolValue, setShapeToolValue] = useState<ShapeToolValue>({
    shape: "rectangle",
    strokeStyle: "solid",
    strokeWidth: 2,
    opacity: 100,
    strokeColor: "#000000",
    fillColor: "transparent",
  });
  // ISS-060 阶段 2 后续：用户显式 tab 切换的 override。annotate/forms 模式下用户可
  // 在 [图章][签名] 间切换；切 mode 时 reset override 回 null（让默认派生接管）。
  const [rightPanelOverride, setRightPanelOverride] = useState<RightPanelId | null>(null);
  useEffect(() => {
    setRightPanelOverride(null);
  }, [activeMode]);

  // ISS-060 阶段 2 后续：左右栏宽度持久化（panelWidthStore 提供 localStorage 读写）。
  // 当前 ship：mount 时读 localStorage 注入 inline style；用户拖拽 divider 留后续 session。
  const [leftWidth] = useState<number>(() => getPanelWidth("left"));
  const [rightWidth] = useState<number>(() => getPanelWidth("right"));
  // ISS-060：右栏驱动 — 默认按 mode 派生；用户 tab override 优先。
  // P2-6 修复：之前用 useState(() => initial) 只在 mount 时算一次，read→annotate
  // 切换后 rightPanel 永远 stuck 在 mount 时的 "none"，导致右栏永不显示。
  const defaultRightPanel = useMemo<RightPanelId>(() => {
    if (activeMode === "annotate") return "stamps";
    if (activeMode === "ocr") return "ocr-queue";
    if (activeMode === "export") return "export-preview";
    return "none";
  }, [activeMode]);
  // override 优先（用户 tab 显式切换），否则用 mode 默认派生
  const rightPanel: RightPanelId = rightPanelOverride ?? defaultRightPanel;
  // ISS-NEW-I（W2 worker）：L3 联动 — T 编辑模式（activeMode === "forms"）下，
  // 用户从 Toolbar L3 段4「形状/搜索」二级按钮进入时应自动打开右栏 shape / search
  // panel。当前实现：进入 forms 模式且 rightPanel === "none" 时，派生为 "shape"。
  // annotate 模式默认走 stamps（保持原派生），不动既有行为。
  const rightPanelWithEditFallback: RightPanelId =
    rightPanel === "none" && activeMode === "forms" ? "shape" : rightPanel;
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  // ISS-NEW-G（2026-06-22 收口）：把 settings.language 同步到 i18n runtime。
  // 任何 useI18n() 组件（StatusBar / WelcomeScreen / GeneralSection）均跟随重渲染。
  useEffect(() => {
    setCurrentLanguage(settings.language);
  }, [settings.language]);
  // ISS-072 阶段 2：文档属性对话框 state
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesMetadata, setPropertiesMetadata] = useState<PdfMetadata | null>(null);
  // ISS-072 阶段 2 后续 / DEC-136：Rust 后端 Producer 真覆盖 UI 状态
  const [producerOverrideInFlight, setProducerOverrideInFlight] = useState(false);
  const [producerOverrideMessage, setProducerOverrideMessage] =
    useState<import("../../modules/document/ui/PropertiesDialog").ProducerOverrideMessage | null>(null);
  // ISS-061 阶段 2：真接选区——usePdfTextSelection 监听 workspace__main 内的文本选择。
  // P1-3 修复：toolbarHidden 在每次 selectionBounds 变化时无条件重置（不是只在 null 时），
  // 让用户主动关掉 toolbar 后，下次重新选区可以再次浮出。
  const workspaceMainRef = useRef<HTMLDivElement>(null);
  const selectionBounds = usePdfTextSelection(workspaceMainRef);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  useEffect(() => {
    setToolbarHidden(false);
  }, [selectionBounds]);
  const handleSelectionAction = useCallback(
    (action: AnnotationAction | CopyAction) => {
      if (action === "copy") {
        const selectedText = window.getSelection?.()?.toString() ?? "";
        if (selectedText && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(selectedText).catch(() => undefined);
          setCommandFeedback("已复制选中文本到剪贴板。");
        }
      }
      setToolbarHidden(true);
    },
    [],
  );
  const handleSelectionClose = useCallback(() => setToolbarHidden(true), []);
  // ISS-061：浮动文本工具条 - 监听 toolbar 通过自定义事件上传的工具激活请求
  useEffect(() => {
    function handleFloatingTool(event: Event) {
      const detail = (event as CustomEvent<{ toolType: string }>).detail;
      if (!annotationArmed) {
        setCommandFeedback("请先打开 PDF 文档并 arm 批注。");
        return;
      }
      // 把 toolbar action 翻译成批注工具类型，回灌到 armed state。
      // 当前实现为 v0.1 的「armed 模式」：用户点 toolbar 后需在画布拖拽以应用。
      // v0.2 计划：直接拿选区 boundingClientRect 创建 draft，跳过 user 二次拖拽。
      if (detail.toolType === "annotate-highlight") {
        annotationArmed.onStateChange({ ...annotationArmed.state, activeToolType: "highlight" });
      } else if (detail.toolType === "annotate-underline") {
        annotationArmed.onStateChange({ ...annotationArmed.state, activeToolType: "underline" });
      } else if (detail.toolType === "annotate-strikeout") {
        annotationArmed.onStateChange({ ...annotationArmed.state, activeToolType: "strikeout" });
      } else if (detail.toolType === "annotate-note") {
        annotationArmed.onStateChange({ ...annotationArmed.state, activeToolType: "note" });
      }
      // Copy 已经在 TextSelectionToolbar 内处理，这里不再管
    }
    window.addEventListener("floating-annotation-tool", handleFloatingTool);
    return () => window.removeEventListener("floating-annotation-tool", handleFloatingTool);
  }, [annotationArmed]);
  useEffect(() => {
    if (activeMode !== "annotate") {
      setActiveAnnotationId(null);
    }
  }, [activeMode]);
  // forms controller：在 AppShell 层创建以供 utility panel 使用
  const formController = useFormController(reader);
  useEffect(() => {
    setActiveFormController(formController);
    return () => setActiveFormController(null);
  }, [formController]);
  // ISS-NEW-I（W2 worker）：搜索右栏数据 — 从 TextSearchController 派生
  // TextSearchHit → SearchResultsPanel.SearchHitItem。
  // lineNumber 字段在 search service 没有，用 matchIndex + 1 占位（snippet 来自
  // 实际搜索结果，仍是真实上下文）。
  const searchHits: SearchHitItem[] = useMemo(
    () =>
      search.state.hits.map((hit) => ({
        id: hit.id,
        pageNumber: hit.pageNumber,
        lineNumber: hit.matchIndex + 1,
        snippet: hit.snippet,
      })),
    [search.state.hits],
  );
  const document = reader.state.document;
  const hasDocument = document !== null;
  useEffect(() => {
    if (hasDocument && commandFeedback === "请先打开 PDF 文档。") {
      setCommandFeedback(null);
    }
  }, [commandFeedback, hasDocument]);
  // 当前页 PDF viewport（pt），用于 overlay 真实坐标
  const currentPageNumber = document?.currentPage ?? 1;
  const currentPageViewport = reader.state.pageViewports.find((viewport) => viewport.pageIndex + 1 === currentPageNumber);
  const overlayViewport: AnnotationOverlayViewport | null = currentPageViewport
    ? {
        width: currentPageViewport.width,
        height: currentPageViewport.height,
        rotation: currentPageViewport.rotation,
      }
    : null;
  // 当前页的批注子集
  const currentPageAnnotations = (annotations ?? []).filter((annotation) => annotation.pageIndex === currentPageNumber - 1);

  const handleFlattenAnnotations = useCallback(async (): Promise<AnnotationFlattenResult> => {
    if (!document) {
      throw new Error("请先打开 PDF 文档。");
    }

    const sourceBytes = await reader.getFileBytes();
    if (!sourceBytes) {
      throw new Error("未找到当前 PDF 的源文件字节。");
    }

    const requestedAt = new Date().toISOString();
    const sidecar: AnnotationSidecar = {
      schemaVersion: 1,
      document: {
        ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
        pageCount: document.pageCount,
      },
      annotations: [...(annotations ?? [])],
      createdAt: requestedAt,
      updatedAt: requestedAt,
    };
    const engine = createPdfOperationEngine();
    const result = await engine.exportPdf({
      id: `annotation-flatten-${document.documentId}-${Date.now()}`,
      source: {
        bytes: new Uint8Array(sourceBytes),
        ...(document.path ? { path: document.path } : {}),
        ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
      },
      destination: { type: "bytes" },
      operations: [
        {
          id: `flatten-annotations-${document.documentId}`,
          type: "flatten-annotations",
          sidecar,
          strategy: "draw",
        },
      ],
      requestedAt,
    });
    const fileName = suggestOutputName(reader.getCurrentFileName() ?? document.name, "annotations-flattened");
    await reader.saveUpdatedBytes(result.bytes, fileName);
    const plan = result.summary.annotationPlan;

    return {
      annotationCount: plan?.annotationCount ?? sidecar.annotations.length,
      drawnCount: plan?.drawnCount ?? sidecar.annotations.length,
      fileName,
      skippedCount: plan?.skippedCount ?? 0,
    };
  }, [annotations, document, reader]);

  // ISS-067 阶段 2：应用涂黑矩形 → 调 applyRedaction → 输出 *-redacted.pdf 新副本。
  // 坐标转换：RedactionOverlay 传的是屏幕 clientX/Y，需减去 canvas origin 并按 PDF 视口缩放。
  // DEC-114 review P0-1 修复：选择器从虚构的 ".reader-canvas canvas" 改为真实 DOM
  // `.pdf-page[data-page-number="N"] canvas`（ReaderCanvas 给每页 section 加 data-page-number），
  // 精确命中当前页 canvas。之前选择器指向不存在的类名，querySelector 永远 null，涂黑功能死。
  const handleApplyRedaction = useCallback(
    async (regions: RedactionRegionDraft[]): Promise<void> => {
      if (!document || !overlayViewport) {
        setCommandFeedback("请先打开 PDF 文档。");
        return;
      }
      if (regions.length === 0) {
        setCommandFeedback("请先画出至少一个遮蔽矩形。");
        return;
      }
      const canvas = selectPageCanvas(currentPageNumber);
      if (!canvas) {
        setCommandFeedback("找不到当前页画布，无法转换坐标。");
        return;
      }
      const rect = canvas.getBoundingClientRect();
      // 屏幕 clientX/Y → PDF 用户空间（Y 翻转），逻辑提取到 redactionCoords 可测模块
      const pdfRegions = regionsScreenToPdf(regions, rect, overlayViewport);
      try {
        setCommandFeedback("正在应用遮蔽...");
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const newBytes = await applyRedaction(new Uint8Array(sourceBytes), pdfRegions);
        const outputName = suggestOutputName(reader.getCurrentFileName() ?? document.name, "redacted");
        await reader.saveUpdatedBytes(newBytes, outputName);
        setCommandFeedback(`已应用 ${regions.length} 个遮蔽矩形，另存为 ${outputName}。`);
        setRedactActive(false);
      } catch (error) {
        setCommandFeedback(error instanceof Error ? error.message : "应用遮蔽失败。");
      }
    },
    [document, overlayViewport, reader, currentPageNumber],
  );

  // ISS-072 阶段 2：打开文档属性对话框 — 读当前 PDF metadata 预填
  const openPropertiesDialog = useCallback(async (): Promise<void> => {
    if (!document) {
      setCommandFeedback("请先打开 PDF 文档。");
      return;
    }
    try {
      const sourceBytes = await reader.getFileBytes();
      if (!sourceBytes) {
        throw new Error("未找到当前 PDF 的源文件字节。");
      }
      const metadata = await readPdfMetadata(new Uint8Array(sourceBytes));
      setPropertiesMetadata(metadata);
      setPropertiesOpen(true);
    } catch (error) {
      setCommandFeedback(error instanceof Error ? error.message : "读取文档属性失败。");
    }
  }, [document, reader]);

  // ISS-072 阶段 2：应用属性写回 → 调 writePdfMetadata → 输出 *-metadata.pdf 新副本
  const handleApplyProperties = useCallback(
    async (options: { updates: Partial<PdfMetadata>; outputName: string }): Promise<void> => {
      if (!document) {
        setCommandFeedback("请先打开 PDF 文档。");
        return;
      }
      try {
        setCommandFeedback("正在写回元数据...");
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const newBytes = await writePdfMetadata(new Uint8Array(sourceBytes), options.updates);
        await reader.saveUpdatedBytes(newBytes, options.outputName);
        setCommandFeedback(`已写回元数据，另存为 ${options.outputName}。`);
        setPropertiesOpen(false);
      } catch (error) {
        setCommandFeedback(error instanceof Error ? error.message : "写回元数据失败。");
      }
    },
    [document, reader],
  );

  // ISS-072 阶段 2 后续 / DEC-136：调 Rust `set_pdf_producer` 真覆盖 Producer 字段。
  // 写一份 `<stem>-metadata.pdf` 到源 PDF 同目录（与 remove_pdfpassword 同模式，DEC-102 P0-3
  // 拒绝静默覆盖）。Producer = "FaroPDF" 覆盖后通过 lopdf 直接编辑 InfoDict 持久化，
  // 绕开 pdf-lib `save()` 的 force override（DEC-109 已知限制）。
  const handleProducerOverride = useCallback(
    async (producer: string): Promise<void> => {
      if (!document) {
        setProducerOverrideMessage({ type: "error", text: "请先打开 PDF 文档。" });
        return;
      }
      const inputPath = document.path;
      if (!inputPath) {
        // 浏览器拖拽打开的 PDF 没有真实磁盘路径，Rust 后端无法定位文件。
        setProducerOverrideMessage({
          type: "error",
          text: "真覆盖 Producer 需要通过 macOS 文件对话框打开的 PDF（拖拽打开的 PDF 没有磁盘路径）。",
        });
        return;
      }
      setProducerOverrideInFlight(true);
      setProducerOverrideMessage(null);
      try {
        const result = await invoke<{ path: string; producer: string; size_bytes: number }>(
          "set_pdf_producer",
          { request: { input_path: inputPath, producer } },
        );
        setProducerOverrideMessage({
          type: "success",
          text: `已真覆盖 Producer 为「${result.producer}」，另存为 ${result.path}。`,
        });
      } catch (error) {
        const message = typeof error === "string" ? error : (error as Error).message;
        setProducerOverrideMessage({ type: "error", text: message });
      } finally {
        setProducerOverrideInFlight(false);
      }
    },
    [document],
  );

  // ISS-069 阶段 2：自动生成目录状态
  const [autoTocOpen, setAutoTocOpen] = useState(false);
  const [autoTocHeadings, setAutoTocHeadings] = useState<ChapterHeadingNode[]>([]);
  const [autoTocLoading, setAutoTocLoading] = useState(false);
  const [autoTocError, setAutoTocError] = useState<string | null>(null);

  const openAutoTocDialog = useCallback(async (): Promise<void> => {
    if (!document) {
      setCommandFeedback("请先打开 PDF 文档。");
      return;
    }
    setAutoTocOpen(true);
    setAutoTocLoading(true);
    setAutoTocError(null);
    setAutoTocHeadings([]);
    try {
      const sourceBytes = await reader.getFileBytes();
      if (!sourceBytes) {
        throw new Error("未找到当前 PDF 的源文件字节。");
      }
      const loaded = await loadPdfFromBytes({
        data: new Uint8Array(sourceBytes),
        fileName: reader.getCurrentFileName() ?? document.name,
      });
      try {
        // 路径 1：先尝试 PDF.js 文字层
        const pages: import("../../modules/ocr/autoToc").PdfJsTextContentLike[] = [];
        let hasTextLayer = false;
        for (let i = 0; i < loaded.metadata.pageCount; i += 1) {
          // DEC-141 Playwright E2E 修复：用 LoadedPdfDocument.getRawTextContent 替代错误的 cast
          const textContent = await loaded.getRawTextContent(i);
          if (!textContent) {
            continue;
          }
          pages.push(textContent as unknown as import("../../modules/ocr/autoToc").PdfJsTextContentLike);
          const items = (textContent.items ?? []) as Array<Record<string, unknown>>;
          if (items.some((it) => typeof it.str === "string" && it.str.length > 0)) {
            hasTextLayer = true;
          }
        }
        if (hasTextLayer) {
          const tree = buildOutlineTreeFromPages(pages);
          setAutoTocHeadings(tree);
          return;
        }
        // 路径 2：fallback 到 Rust extract_ocr_text（纯扫描 OCR 后文档）
        if (!document.path) {
          throw new Error("当前 PDF 没有源文件路径，无法调用 OCR 提取。");
        }
        const ocrResponse = await invoke<OcrTextExtractionResponse>("extract_ocr_text", {
          pdfPath: document.path,
        });
        const tree = buildOutlineTreeFromOcrText(ocrResponse.pages);
        setAutoTocHeadings(tree);
      } finally {
        await loaded.destroy();
      }
    } catch (error) {
      setAutoTocError(error instanceof Error ? error.message : "扫描文字层失败。");
    } finally {
      setAutoTocLoading(false);
    }
  }, [document, reader]);

  const handleApplyAutoToc = useCallback(
    async (options: { tree: ChapterHeadingNode[]; outputName: string }): Promise<void> => {
      if (!document) {
        setCommandFeedback("请先打开 PDF 文档。");
        return;
      }
      try {
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const newBytes = await writePdfOutline(
          new Uint8Array(sourceBytes),
          options.tree,
        );
        await reader.saveUpdatedBytes(newBytes, options.outputName);
        setCommandFeedback(`已生成 ${options.outputName}，含 ${options.tree.length} 条目录项。`);
        setAutoTocOpen(false);
      } catch (error) {
        setCommandFeedback(error instanceof Error ? error.message : "生成目录失败。");
      }
    },
    [document, reader],
  );

  const executeCommand = useCallback(async (commandId: AppCommandId) => {
    const command = getCommandById(commandId);
    if (!command) {
      return;
    }

    if (command.requiresDocument && !hasDocument) {
      setCommandFeedback("请先打开 PDF 文档。");
      return;
    }

    if (command.id === "file-save-as") {
      try {
        setCommandFeedback("正在另存副本...");
        const sourceBytes = await reader.getFileBytes();
        if (!sourceBytes) {
          throw new Error("未找到当前 PDF 的源文件字节。");
        }
        const outputName = suggestOutputName(reader.getCurrentFileName() ?? document?.name ?? null, "copy");
        await reader.saveUpdatedBytes(sourceBytes, outputName);
        setCommandFeedback(`已另存为 ${outputName}。`);
      } catch (error) {
        setCommandFeedback(error instanceof Error ? error.message : "另存失败。");
      }
      return;
    }

    if (command.id === "view-pages") {
      onModeChange(activeMode === "pages" ? "read" : "pages");
      onUtilityPanelChange("none");
      return;
    }

    // ISS-NEW-H：缩放 submenu 5 个命令（放大 / 缩小 / 实际大小 / 适合页面 / 缩放工具）。
    if (command.id === "view-zoom-in") {
      reader.zoomIn();
      return;
    }
    if (command.id === "view-zoom-out") {
      reader.zoomOut();
      return;
    }
    if (command.id === "view-actual-size") {
      reader.setZoomPreset("1");
      return;
    }
    if (command.id === "view-fit-page") {
      reader.setZoomPreset("fit-page");
      return;
    }
    if (command.id === "view-zoom-tool") {
      // 占位：与 view-actual-size 共用 route（v0.2 不引入独立缩放工具模式）。
      reader.setZoomPreset("1");
      setCommandFeedback("缩放工具待后续 worker 接入；当前已切到实际大小。");
      return;
    }

    // ISS-NEW-H：缩略图 submenu 2 个命令（单列 / 双列 → setViewMode）。
    if (command.id === "view-thumbnails-single") {
      reader.setViewMode("single");
      return;
    }
    if (command.id === "view-thumbnails-double") {
      reader.setViewMode("double");
      return;
    }

    // ISS-NEW-D 阶段 1（2026-06-22）：批注菜单 8 工具（armAnnotationTool 真实 arm）。
    // 形状 submenu 6 项（rectangle / ellipse / arrow / double-arrow / line / pen）v0.2 占位
    // 反馈（PDF_ANNOTATION_TYPES 当前仅 rectangle / arrow / ink，缺 ellipse / line / double-arrow，
    // 真实形状绘制由 AnnotationOverlay 接 armAnnotationTool，DEC-147 已 ship 6 段 ShapeToolPanel）。
    const annotationArmSetter = annotationArmed?.onStateChange;
    if (command.id === "annotation-highlight" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "highlight"));
      return;
    }
    if (command.id === "annotation-underline" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "underline"));
      return;
    }
    if (command.id === "annotation-strikeout" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "strikeout"));
      return;
    }
    if (command.id === "annotation-text" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "textbox"));
      return;
    }
    if (command.id === "annotation-pen" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "ink"));
      return;
    }
    if (command.id === "annotation-eraser" && annotationArmSetter) {
      annotationArmSetter(disarmAnnotationTool(annotationState));
      return;
    }
    if (command.id === "annotation-note" && annotationArmSetter) {
      annotationArmSetter(armAnnotationTool(annotationState, "note"));
      return;
    }
    // 形状 submenu 6 项 v0.2 占位反馈（v0.3 由真实形状绘制 worker 接入）。
    if (
      command.id === "annotation-shape-rectangle" ||
      command.id === "annotation-shape-ellipse" ||
      command.id === "annotation-shape-arrow" ||
      command.id === "annotation-shape-double-arrow" ||
      command.id === "annotation-shape-line" ||
      command.id === "annotation-shape-pen"
    ) {
      setCommandFeedback(`${command.label}形状待后续 worker 接入；当前可通过 L4 形状工具条（annotate 模式）切换。`);
      return;
    }

    // ISS-NEW-D 阶段 1（2026-06-22）：扫描菜单 4 档质量 + 4 顶层动作 v0.2 占位反馈。
    // 真实 OCR 入口由 OcrWorkspace / OcrModeToolbar 提供（activeMode=ocr 走主区域）。
    if (
      command.id === "ocr-quality-original" ||
      command.id === "ocr-quality-standard" ||
      command.id === "ocr-quality-advanced" ||
      command.id === "ocr-quality-custom"
    ) {
      setCommandFeedback(`OCR 质量档「${command.label}」待后续 worker 接入；当前可切到 OCR 模式在主区域选择。`);
      return;
    }
    if (
      command.id === "ocr-scan-to-searchable" ||
      command.id === "ocr-recognize-text" ||
      command.id === "ocr-make-searchable" ||
      command.id === "ocr-enhance-all"
    ) {
      setCommandFeedback(`${command.label}功能待后续 worker 接入；当前可切到 OCR 模式在主区域操作。`);
      return;
    }

    // ISS-NEW-D 阶段 1（2026-06-22）：编辑 PDF 菜单 5 动作 v0.2 占位反馈。
    if (
      command.id === "pdf-edit-content" ||
      command.id === "pdf-add-image" ||
      command.id === "pdf-add-link" ||
      command.id === "pdf-add-text" ||
      command.id === "pdf-redact"
    ) {
      setCommandFeedback(`${command.label}功能待后续 worker 接入 PDF 直接编辑链路；当前可用 L4 批注 / 导出工具条。`);
      return;
    }

    // ISS-NEW-H：3 顶层占位命令（不 return，让末尾通用 fallback 设 feedback）。
    if (
      command.id === "view-go-current-page" ||
      command.id === "view-reload" ||
      command.id === "view-add-bookmark"
    ) {
      // 占位：命令定义自带 feedback「视图功能开发中，等待后续 worker 接入。」，
      // executeCommand 末尾的 `if (command.feedback)` fallback 会自动 setCommandFeedback。
    }

    if (command.id === "export-watermark-text") {
      setActiveExportTool("text-watermark");
    } else if (command.id === "export-watermark-image") {
      setActiveExportTool("image-watermark");
    } else if (command.id === "export-header-footer") {
      setActiveExportTool("header-footer");
    } else if (command.id === "export-page-number") {
      setActiveExportTool("page-number");
    } else if (command.id === "export-bates") {
      setActiveExportTool("bates");
    } else if (command.id === "export-compress") {
      setActiveExportTool("compress");
    }

    if (command.id === "export-annotation-summary") {
      setAnnotationViewSignal((prev) => ({ view: "summary", nonce: prev.nonce + 1 }));
    } else if (command.id === "annotations-flatten") {
      setAnnotationViewSignal((prev) => ({ view: "list", nonce: prev.nonce + 1 }));
    } else if (command.id === "redact-region") {
      setRedactActive(true);
    } else if (command.id === "forms-sign-handwrite") {
      // ISS-070 阶段 3：进 forms 模式 + 打开签名编辑器（含签名库选择）
      formController.openPanel("sign");
    } else if (command.id === "document-properties") {
      void openPropertiesDialog();
    } else if (command.id === "auto-generate-toc") {
      void openAutoTocDialog();
    }

    if (command.id === "help-about") {
      setSettingsInitialSection("about");
    } else if (command.id === "settings-open") {
      setSettingsInitialSection("general");
    }

    if (command.targetMode) {
      onModeChange(command.targetMode as AppModeId);
    }

    if (command.targetUtilityPanel) {
      onUtilityPanelChange(command.targetUtilityPanel as UtilityPanelId);
    } else if (command.group === "export" || command.group === "forms" || (command.group === "mode" && command.targetMode !== "annotate")) {
      onUtilityPanelChange("none");
    }

    if (command.feedback) {
      setCommandFeedback(command.feedback);
    }
  }, [activeMode, document?.name, hasDocument, onModeChange, onUtilityPanelChange, reader]);

  useEffect(() => {
    if (!commandSignal || commandSignal.id === "file-open") {
      return;
    }
    void executeCommand(commandSignal.id);
    // P1-2：依赖加 commandSignal?.id 以支持同 nonce 不同 id 的边界（理论上 App 层
    // 通过 nonce 递增控制重发，但 effect 列出全部源以满足 react-hooks/exhaustive-deps）。
  }, [commandSignal?.id, commandSignal?.nonce, executeCommand]);

  return (
    <div className="app-shell" role="application" aria-label="FaroPDF PDF 工作台">
      <TitlebarTabs
        onRequestNewTab={() => {
          // + 号：触发 Toolbar 的隐藏 file input，复用"打开"按钮
          if (typeof globalThis.document !== "undefined") {
            const fileInput = globalThis.document.querySelector<HTMLInputElement>(
              'input[type="file"][aria-label="选择本地 PDF 文件"]',
            );
            fileInput?.click();
          }
        }}
      />
      <Toolbar
        activeMode={activeMode}
        onCommand={executeCommand}
        onModeChange={onModeChange}
        onUtilityPanelChange={onUtilityPanelChange}
        reader={reader}
        search={search}
        utilityPanel={utilityPanel}
      />
      {showContextToolbar ? (
        <ContextToolbar
          annotationDisabled={!hasDocument}
          annotationState={annotationState}
          hasDocument={hasDocument}
          mode={activeMode}
          ocr={ocr}
          onCommand={executeCommand}
          onAnnotationStateChange={annotationArmed?.onStateChange ?? (() => undefined)}
          onUtilityPanelChange={onUtilityPanelChange}
          formController={formController}
          reader={reader}
        />
      ) : null}
      {/* ISS-NEW-A 阶段 2 / ISS-NEW-B 收口（2026-06-22）：L4 二级工具条接管 read-mode
          工具（旋转 + 适合页面）。仅在 read 模式 + 有文档时显示，让 L3 reading 段
          瘦身到 4 元素（页码 + 视图模式 4-icon toggle + 缩放% + -/+）。
          ISS-NEW-E 收口（2026-06-22）：ReadModeToolbar 已并入 ContextToolbar（mode === "read" 分支），此独立 render 块删除。 */}
      <div
        className={showUtilityPanel ? "workspace" : "workspace workspace--full"}
        style={{
          gridTemplateColumns: showUtilityPanel
            ? `${leftWidth}px minmax(420px, 1fr) ${rightWidth}px`
            : `${leftWidth}px minmax(420px, 1fr)`,
        }}
      >
        {showUtilityPanel ? (
          <UtilityPanel
            activeAnnotationId={activeAnnotationId}
            annotations={annotations}
            currentPdfPath={document?.path ?? null}
            formController={formController}
            onAnnotationClick={setActiveAnnotationId}
            annotationViewSignal={annotationViewSignal}
            onFlattenAnnotations={handleFlattenAnnotations}
            onSecurityClose={() => onUtilityPanelChange("none")}
            onSecurityFeedback={(message) => setCommandFeedback(message)}
            panel={utilityPanel}
            reader={reader}
            search={search}
          />
        ) : null}
        <RightPanel
          activeMode={activeMode}
          rightPanel={rightPanelWithEditFallback}
          // ISS-NEW-C：文档摘要 + OCR 状态面板输入。来源在 Reader 派生，
          // 当前实现给空（null / idle）。W2 / 后续 PM 收口时把 App.tsx 真值接进来。
          docSummary={null}
          ocrStatus={{ state: "idle", message: "尚未开始 OCR", progress: 0 }}
          onStartOcr={() => undefined}
          // ISS-NEW-C 阶段 2 后续（2026-06-22 收口）：导出预览 + OCR 队列。
          exportPreview={{
            activeTool: activeExportTool,
            fileName: reader.state.document?.name ?? null,
            pageCount: reader.state.document?.pageCount ?? null,
          }}
          ocrQueueJobs={ocr?.jobs ?? []}
          onCancelOcrJob={(jobId) => {
            const job = ocr?.jobs.find((j) => j.id === jobId);
            if (job) {
              void ocr?.cancelJob(job);
            }
          }}
          onPanelChange={setRightPanelOverride}
          shapeToolValue={shapeToolValue}
          onShapeToolChange={setShapeToolValue}
          searchQuery={search.state.query}
          searchHits={searchHits}
          searchActiveHitId={search.state.activeHitId ?? null}
          onSearchQueryChange={search.setQuery}
          onSearchSelectHit={search.selectHit}
          onSearchJumpPrevious={search.selectPreviousHit}
          onSearchJumpNext={search.selectNextHit}
          onSearchClose={() => onUtilityPanelChange("none")}
          onSelectCustomStamp={(stamp) => {
            // DEC-112 ISS-060 阶段 2 + ISS-062 阶段 3：用户从右栏选自定义图章 →
            // 把 stamp.image (base64) 写到 annotationArmed 让画布 stamp 工具立刻可用。
            if (!annotationArmed) {
              setCommandFeedback("请先打开 PDF 文档并进入批注模式。");
              return;
            }
            annotationArmed.onStateChange({
              ...annotationArmed.state,
              activeToolType: "stamp",
              stampName: "custom",
              stampLabel: stamp.name,
              stampImage: stamp.image,
            });
            setCommandFeedback(`已选中图章「${stamp.name}」，请在画布点按落点。`);
          }}
          onSelectSignature={(signature) => {
            // DEC-113 ISS-060 阶段 2 + ISS-070 阶段 2：用户从右栏选签名 →
            // 当 annotate 模式：把 signature.image 当 stamp 落点（与 customStamp 同套路）
            // 当 forms 模式：暂只反馈，后续接入 formController.applySignature
            if (activeMode === "annotate") {
              if (!annotationArmed) {
                setCommandFeedback("请先打开 PDF 文档并进入批注模式。");
                return;
              }
              annotationArmed.onStateChange({
                ...annotationArmed.state,
                activeToolType: "stamp",
                stampName: "custom",
                stampLabel: signature.name,
                stampImage: signature.image,
              });
              setCommandFeedback(`已选中签名「${signature.name}」，请在画布点按落点。`);
            } else if (activeMode === "forms") {
              setCommandFeedback(`已选中签名「${signature.name}」，下次接入填写签名字段后可直接落入。`);
            } else {
              setCommandFeedback(`已选中签名「${signature.name}」。`);
            }
          }}
        />
        <div ref={workspaceMainRef} className="workspace__main" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, position: "relative" }}>
          {activeMode === "pages" ? (
            <EditModeGridView
              reader={reader}
              onSelectPage={(pageNumber) => reader.setCurrentPage(pageNumber)}
              onReorder={() => {
                // TODO：真实重排（reader.reorderPages）由后续 worker 接入；
                // 当前 stage 只占位反馈，避免静默吞掉用户操作意图。
                setCommandFeedback("编辑模式重排已触发，等待后续 worker 接入真实重排。");
              }}
            />
          ) : isOcrMode ? (
            ocr ? (
              <OcrWorkspace
                availableProviders={settings.ocrProviders}
                controller={ocr}
                documentLabel={reader.state.document?.name}
                pageCount={reader.state.document?.pageCount}
              />
            ) : (
              <OcrWorkspaceUnavailable />
            )
          ) : (
            <ReaderCanvas
              onClearRecent={() => {
                // ISS-NEW-G（Wave 3 W1）：清空最近文件，触发 settings 持久化。
                if (onSettingsChange) {
                  onSettingsChange({ ...settings, recentFiles: [] });
                }
              }}
              onConvertFromImages={() => {
                // ISS-NEW-G（2026-06-22 收口）：图片转 PDF 转换卡占位反馈。
                // 真实流程依赖 img2pdf / OCR pipeline，由后续 worker 接入。
                setCommandFeedback(i18n.feedback.convertImagesPending);
              }}
              onConvertFromWord={() => {
                // ISS-NEW-G（2026-06-22 收口）：Word 转 PDF 转换卡占位反馈。
                // 真实流程依赖 Word → PDF merge engine，由后续 worker 接入。
                setCommandFeedback(i18n.feedback.convertWordPending);
              }}
              onOpenFile={reader.openFile}
              onOpenRecent={(entry) => {
                // ISS-NEW-G（Wave 3 W1）：点击最近缩略图 — 当前 stage 占位反馈。
                // 真实路径打开（reader.openFile + 路径寻址）由后续 worker 接入。
                setCommandFeedback(`已选择最近文件「${entry.name}」，等待真实打开链路接入。`);
              }}
              onPageNavigate={reader.setCurrentPage}
              onPageVisible={reader.setCurrentPage}
              onRequestOcr={onRequestOcr}
              readerState={reader.state}
              recentFiles={settings.recentFiles}
              renderPageToCanvas={reader.renderPageToCanvas}
              searchState={search.state}
            />
          )}
          {activeMode === "export" ? (
            <ExportDeliveryPanel
              onSelectedToolChange={setActiveExportTool}
              reader={reader}
              selectedTool={activeExportTool}
            />
          ) : null}
          {isAnnotateMode && hasDocument && overlayViewport ? (
            <AnnotationOverlay
              activeAnnotationId={activeAnnotationId}
              activeColor={annotationState.color}
              activeStampLabel={annotationState.stampLabel}
              activeStampName={annotationState.stampName}
              activeStampImage={annotationState.stampImage}
              activeToolType={annotationState.activeToolType}
              annotations={currentPageAnnotations}
              onAnnotationClick={(annotationId) => {
                setActiveAnnotationId(annotationId);
                onAnnotationClick?.(annotationId);
              }}
              onAnnotationDraft={
                onAnnotationDraft
                  ? (input: AnnotationDraftInput) =>
                      onAnnotationDraft({ ...input, pageIndex: currentPageNumber - 1 })
                  : undefined
              }
              pageIndex={currentPageNumber - 1}
              viewport={overlayViewport}
            />
          ) : null}
          {isAnnotateMode && redactActive && overlayViewport ? (
            <RedactionOverlay
              active={redactActive}
              onApply={handleApplyRedaction}
              onCancel={() => setRedactActive(false)}
              pageIndex={currentPageNumber - 1}
              viewport={overlayViewport}
            />
          ) : null}
        </div>
      </div>
      <TextSelectionToolbar
        bounds={toolbarHidden ? null : selectionBounds}
        color={annotationState.color}
        onAction={handleSelectionAction}
        onClose={handleSelectionClose}
        onToast={(message) => setCommandFeedback(message)}
      />
      <StatusBar
        activeMode={activeMode}
        language={settings.language}
        ocrState={{
          cursorPage: reader.state.document?.currentPage ?? null,
          // ISS-NEW-G（2026-06-22 收口）：OcrCommandJob.status 是 string（非 OcrJobStatus），
          // 此处 narrow 为 5 个有效枚举之一；不识别时退到 busy 派生（running）或 idle。
          jobStatus: ((): "queued" | "running" | "completed" | "failed" | "cancelled" | "idle" => {
            const raw = ocr?.currentJob?.status;
            if (raw === "queued" || raw === "running" || raw === "completed" || raw === "failed" || raw === "cancelled") {
              return raw;
            }
            return ocr?.busy ? "running" : "idle";
          })(),
        }}
        onLanguageChange={(next) => {
          // ISS-NEW-G（2026-06-22 收口）：同时同步到 i18n runtime，触发 useI18n() 组件重渲染。
          setCurrentLanguage(next);
          onSettingsChange?.({ ...settings, language: next });
        }}
        readerState={reader.state}
      />
      {commandFeedback ? (
        <div className="command-feedback" data-testid="command-feedback" role="status" aria-live="polite">
          <span>{commandFeedback}</span>
          <button
            aria-label="关闭命令提示"
            className="compact-button"
            onClick={() => setCommandFeedback(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}
      {propertiesOpen && propertiesMetadata && document ? (
        <PropertiesDialog
          metadata={propertiesMetadata}
          defaultFileName={reader.getCurrentFileName() ?? document.name}
          inputFilePath={document.path || null}
          onClose={() => setPropertiesOpen(false)}
          onConfirm={(opts) => {
            void handleApplyProperties(opts);
          }}
          onProducerOverride={(producer) => {
            void handleProducerOverride(producer);
          }}
          producerOverrideInFlight={producerOverrideInFlight}
          producerOverrideMessage={producerOverrideMessage}
        />
      ) : null}
      {autoTocOpen ? (
        <AutoTocDialog
          initialHeadings={autoTocHeadings}
          isLoading={autoTocLoading}
          error={autoTocError}
          defaultFileName={reader.getCurrentFileName() ?? document?.name ?? "document"}
          onClose={() => setAutoTocOpen(false)}
          onConfirm={(opts) => {
            void handleApplyAutoToc(opts);
          }}
        />
      ) : null}
      <SettingsPanel
        initialSection={settingsInitialSection}
        onClose={() => {
          setSettingsInitialSection("general");
          onUtilityPanelChange("none");
        }}
        onSettingsChange={onSettingsChange}
        open={utilityPanel === "settings"}
        settings={settings}
      />
    </div>
  );
}

function OcrWorkspaceUnavailable() {
  return (
    <main className="ocr-workspace" aria-label="OCR 工作区">
      <div className="ocr-quality-report ocr-quality-report--missing" role="status">
        <p>OCR 控制器尚未就绪。</p>
        <p>请刷新页面或在设置中确认 OCR 后端已启用。</p>
      </div>
    </main>
  );
}

function UtilityPanel({
  activeAnnotationId,
  annotations,
  currentPdfPath,
  formController,
  annotationViewSignal,
  onAnnotationClick,
  onFlattenAnnotations,
  onSecurityClose,
  onSecurityFeedback,
  panel,
  reader,
  search,
}: {
  activeAnnotationId: string | null;
  annotationViewSignal: { view: "list" | "summary"; nonce: number };
  currentPdfPath: string | null;
  onAnnotationClick: (annotationId: string) => void;
  onFlattenAnnotations: () => Promise<AnnotationFlattenResult>;
  onSecurityClose: () => void;
  onSecurityFeedback: (message: string | null) => void;
  panel: Exclude<UtilityPanelId, "none">;
  reader: ReaderController;
  search: TextSearchController;
  annotations?: PdfAnnotation[];
  formController: import("../../modules/forms/useFormController").FormController;
}) {
  if (panel === "view") {
    const document = reader.state.document;
    const viewMode = document?.viewMode ?? reader.state.defaults.viewMode;
    const zoom = document?.zoom ?? reader.state.defaults.zoom;
    // 推断当前激活的缩放预设（数字预设按 0.01 容差匹配）
    const matchedPreset: ZoomPresetId | undefined = matchZoomPreset(zoom);
    return (
      <ViewSettingsPanel
        activeZoomPresetId={matchedPreset}
        canChangeViewMode={reader.state.document !== null}
        isFitWidth={viewMode === "fit-width"}
        onRotate={(direction) => {
          if (direction === "clockwise") {
            reader.rotateClockwise();
          } else {
            reader.rotateCounterClockwise();
          }
        }}
        onViewModeChange={reader.setViewMode}
        onZoomPresetChange={reader.setZoomPreset}
        viewMode={viewMode}
      />
    );
  }

  if (panel === "settings") {
    // 设置浮层已挪到 AppShell 顶层以走 Portal 模式，此处仅占位避免 UtilityPanel fallback。
    return null;
  }

  if (panel === "annotation") {
    return (
      <AnnotationSidebar
        activeAnnotationId={activeAnnotationId}
        annotations={annotations ?? []}
        currentPage={reader.state.document?.currentPage}
        hasDocument={reader.state.document !== null}
        onAnnotationClick={onAnnotationClick}
        onFlattenAnnotations={(annotations ?? []).length > 0 ? onFlattenAnnotations : undefined}
        onSelectPage={reader.setCurrentPage}
        pageCount={reader.state.document?.pageCount}
        preferredViewSignal={annotationViewSignal}
      />
    );
  }

  if (panel === "forms") {
    return <FormsPanel controller={formController} layoutMode="utility-panel" />;
  }

  if (panel === "security") {
    return (
      <SecurityPanel
        currentPdfPath={currentPdfPath}
        onClose={onSecurityClose}
        onFeedback={(message) => onSecurityFeedback(message)}
      />
    );
  }

  // ISS-NEW-A 阶段 2 收口（2026-06-22）：侧栏「书签」面板占位。
  // 当前 stage 不接 PDF outline 解析 / 持久化 / 跳转，由后续 worker 接入。
  if (panel === "bookmark") {
    return <BookmarkPanelPlaceholder />;
  }

  return (
    <DocumentSummaryPanel
      annotations={annotations}
      currentPage={reader.state.document?.currentPage}
      hasDocument={reader.state.document !== null}
      ocrNeeded={reader.state.document?.ocrStatus === "needed"}
      onSelectPage={reader.setCurrentPage}
      pageCount={reader.state.document?.pageCount}
      pagesWithHits={collectPagesWithSearchHits(search.state.hits)}
      renderThumbnail={reader.renderThumbnail}
    />
  );
}

/** ISS-NEW-A 阶段 2 收口（2026-06-22）：侧栏书签面板占位。
 *  真实能力（outline 解析 / 添加 / 跳转 / 持久化）留后续 worker。 */
function BookmarkPanelPlaceholder() {
  return (
    <aside className="bookmark-panel" aria-label="书签面板" data-testid="bookmark-panel">
      <h2 className="bookmark-panel__title">书签</h2>
      <p className="bookmark-panel__empty">书签功能开发中，等待后续 worker 接入 PDF outline 解析与持久化。</p>
    </aside>
  );
}

/** 收集拥有搜索命中的页码集合（1-based） */
function collectPagesWithSearchHits(hits: ReadonlyArray<{ pageNumber: number }>): Set<number> {
  const set = new Set<number>();
  for (const hit of hits) {
    set.add(hit.pageNumber);
  }
  return set;
}

/** 将当前 zoom 匹配到 ZOOM_PRESETS 中的预设 id（数字预设按 0.01 容差）。
 *  自动模式（fit-width / fit-page）不会通过此函数匹配 — 调用方根据 viewMode 判断。 */
function matchZoomPreset(zoom: number): ZoomPresetId | undefined {
  for (const preset of ZOOM_PRESETS) {
    if (preset.kind === "fixed" && preset.value !== null && Math.abs(preset.value - zoom) < 0.01) {
      return preset.id;
    }
  }
  return undefined;
}

function ContextToolbar({
  annotationDisabled,
  annotationState,
  formController,
  hasDocument,
  mode,
  ocr,
  onCommand,
  onAnnotationStateChange,
  onUtilityPanelChange,
  reader,
}: {
  annotationDisabled: boolean;
  annotationState: AnnotationToolState;
  formController: import("../../modules/forms/useFormController").FormController;
  hasDocument: boolean;
  // ISS-NEW-E（2026-06-22 收口）：read 模式也作为 L4 二级工具条的一员，
  // 由 ContextToolbar mode === "read" 分支统一渲染（参见下方分支）。
  mode: Exclude<AppModeId, "pages">;
  ocr?: OcrWorkspaceController;
  onCommand: (commandId: AppCommandId) => void;
  onAnnotationStateChange: (next: AnnotationToolState) => void;
  onUtilityPanelChange: (panel: UtilityPanelId) => void;
  reader: ReaderController;
}) {
  // ISS-NEW-E（2026-06-22 收口）：read 模式 L4 二级工具条接管 read-mode 工具
  // （旋转 + 适合页面，复用 registerReadModeTools 注册的 3 工具）。从原独立
  // `<ReadModeToolbar>` 组件并入，让 ContextToolbar 真正按 activeMode 路由 5 模式。
  if (mode === "read") {
    const items = getModeTools("read")
      .slice()
      .sort((a, b) => a.order - b.order);
    return (
      <div
        className="context-toolbar context-toolbar--read"
        data-testid="read-mode-toolbar"
        role="toolbar"
        aria-label={contextualToolbarLabels[mode]}
      >
        {items.map((item) => {
          const disabled =
            item.isDisabled?.({ activeMode: "read", reader, search: undefined as never }) ?? false;
          return (
            <button
              aria-pressed={item.isActive({ activeMode: "read", reader, search: undefined as never })}
              className="tool-button tool-button--icon tool-button--reader"
              data-toolbar-section="read-l4"
              disabled={disabled}
              key={item.id}
              onClick={() => item.onClick({ activeMode: "read", reader, search: undefined as never })}
              title={item.label}
              type="button"
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (mode === "annotate") {
    // stage 4 milestone 2：annotate 模式用真正的 AnnotationToolbar（受控），
    // 取代 milestone 1 之前 hardcoded 9 工具 + 6 色板 + stamp 模板按钮。
    // 外层 div 保留 role="toolbar" aria-label="批注工具条" 以保持既有 AppShell 测试契约。
    return (
      <div className="context-toolbar context-toolbar--annotation" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
        <AnnotationToolbar disabled={annotationDisabled} state={annotationState} onStateChange={onAnnotationStateChange} />
      </div>
    );
  }

  if (mode === "ocr") {
    if (!ocr) {
      return (
        <div className="context-toolbar" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
          <span className="ocr-mode-toolbar__status ocr-mode-toolbar__status--idle" aria-live="polite">
            OCR 控制器未就绪
          </span>
        </div>
      );
    }
    return (
      <OcrModeToolbar
        busy={ocr.busy}
        currentJob={ocr.currentJob}
        hasDocument={ocr.hasDocument}
        hasProvider={ocr.hasProvider}
        onCancelJob={(job) => {
          void ocr.cancelJob(job);
        }}
        onOpenJobList={() => ocr.openJobList()}
        onOpenQualityReport={(job) => ocr.openQualityReport(job)}
        onOutputLayeredPdf={() => {
          void ocr.outputLayeredPdf();
        }}
        onStartOcr={() => {
          void ocr.startOcr();
        }}
      />
    );
  }

  if (mode === "export") {
    return (
      <div className="context-toolbar context-toolbar--grouped" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
        {exportToolGroups.map((group) => (
          <div className="context-tool-group" role="group" aria-label={group.label} key={group.label}>
            <span>{group.label}</span>
            {group.tools.map((tool) => (
              <button
                className="context-tool"
                disabled={!hasDocument}
                key={tool.commandId}
                onClick={() => onCommand(tool.commandId)}
                type="button"
              >
                {tool.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (mode === "forms") {
    const disabled = !hasDocument || formController.loading;
    return (
      <div className="context-toolbar context-toolbar--grouped" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
        <div className="context-tool-group" role="group" aria-label="表单工具">
          <span>表单工具</span>
          <button
            className="context-tool context-tool--primary"
            disabled={disabled}
            onClick={() => {
              onUtilityPanelChange("forms");
              void formController.refreshFormState();
            }}
            type="button"
          >
            {formController.loading ? "处理中..." : "读取字段"}
          </button>
          <button
            className="context-tool"
            disabled={disabled}
            onClick={() => {
              onUtilityPanelChange("forms");
              formController.openPanel("fill");
            }}
            type="button"
          >
            填写
          </button>
          <button
            className="context-tool"
            disabled={disabled}
            onClick={() => {
              onUtilityPanelChange("forms");
              formController.openPanel("sign");
            }}
            type="button"
          >
            签名
          </button>
          <button
            className="context-tool"
            disabled={!hasDocument}
            onClick={() => onCommand("forms-flatten")}
            type="button"
          >
            扁平化导出
          </button>
        </div>
      </div>
    );
  }

  return null;
}
