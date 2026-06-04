import type { PdfAnnotation } from "../../shared";
import type { ZoomPresetId } from "../../shared/pdf/types";
import { ZOOM_PRESETS } from "../../shared/pdf/types";
import type { AppSettings } from "../../shared";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import {
  OcrModeToolbar,
  OcrWorkspace,
  type OcrWorkspaceController,
} from "../../modules/ocr";
import { createInitialAnnotationToolState } from "../../modules/annotation";
import type { AnnotationToolState } from "../../modules/annotation";
import { ReaderCanvas } from "./ReaderCanvas";
import { DocumentSummaryPanel, ViewSettingsPanel } from "./Sidebar";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "../../modules/settings/SettingsPanel";
import { AnnotationOverlay, type AnnotationDraftInput, type AnnotationOverlayViewport } from "./AnnotationOverlay";
import type {
  AnnotationArmedStateBundle,
  AnnotationDraftSubmission,
  AppModeId,
  UtilityPanelId,
} from "./types";

interface AppShellProps {
  activeMode: AppModeId;
  annotations?: PdfAnnotation[];
  onModeChange: (mode: AppModeId) => void;
  onSettingsChange?: (settings: AppSettings) => void;
  onUtilityPanelChange: (panel: UtilityPanelId) => void;
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
}

const contextualTools: Partial<Record<Exclude<AppModeId, "read" | "pages" | "ocr">, string[]>> = {
  annotate: ["高亮", "下划线", "删除线", "笔", "橡皮擦", "文本", "形状", "笔记", "图章", "签名", "内容选定", "裁剪"],
  forms: ["文本", "签名", "日期", "钩号", "叉号", "图章", "图像", "导出为压平"],
};

const exportToolGroups = [
  {
    label: "格式转换",
    tools: ["转成 Word", "转成 Excel", "转成 PowerPoint", "转成文本", "转成图片"],
  },
  {
    label: "交付工具",
    tools: ["文字水印", "图片水印", "页码", "Bates 编号", "压缩", "批注摘要"],
  },
];

const contextualToolbarLabels: Record<Exclude<AppModeId, "read" | "pages">, string> = {
  annotate: "批注工具条",
  export: "导出工具条",
  forms: "填写和签名工具条",
  ocr: "OCR 工具条",
};

export function AppShell({
  activeMode,
  annotations,
  annotationArmed,
  onAnnotationClick,
  onAnnotationDraft,
  onModeChange,
  onSettingsChange,
  onUtilityPanelChange,
  ocr,
  reader,
  search,
  settings,
  utilityPanel,
}: AppShellProps) {
  const showContextToolbar = activeMode !== "read" && activeMode !== "pages";
  // ocr 模式独占主区域（OcrWorkspace 包含任务列表 + 质量报告），隐藏 utility panel
  const showUtilityPanel = utilityPanel !== "none" && activeMode !== "pages" && activeMode !== "ocr";
  const isOcrMode = activeMode === "ocr";
  const isAnnotateMode = activeMode === "annotate";
  // stage 4 批注 armed 状态：App.tsx 持有单一真相源；未传时回退到初始 state，保证既有测试不破
  const annotationState: AnnotationToolState = annotationArmed?.state ?? createInitialAnnotationToolState();
  const document = reader.state.document;
  const hasDocument = document !== null;
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

  return (
    <div className="app-shell" role="application" aria-label="FaroPDF PDF 工作台">
      <Toolbar
        activeMode={activeMode}
        onModeChange={onModeChange}
        onUtilityPanelChange={onUtilityPanelChange}
        reader={reader}
        search={search}
        utilityPanel={utilityPanel}
      />
      {showContextToolbar ? <ContextToolbar mode={activeMode} ocr={ocr} /> : null}
      <div className={showUtilityPanel ? "workspace" : "workspace workspace--full"}>
        {showUtilityPanel ? <UtilityPanel panel={utilityPanel} reader={reader} search={search} annotations={annotations} /> : null}
        <div className="workspace__main" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, position: "relative" }}>
          {activeMode === "pages" ? (
            <PageOrganizerWorkspace reader={reader} />
          ) : isOcrMode ? (
            ocr ? (
              <OcrWorkspace controller={ocr} />
            ) : (
              <OcrWorkspaceUnavailable />
            )
          ) : (
            <ReaderCanvas
              onOpenFile={reader.openFile}
              onPageNavigate={reader.setCurrentPage}
              onPageVisible={reader.setCurrentPage}
              readerState={reader.state}
              renderPageToCanvas={reader.renderPageToCanvas}
              searchState={search.state}
            />
          )}
          {isAnnotateMode && hasDocument && overlayViewport ? (
            <AnnotationOverlay
              activeAnnotationId={null}
              activeColor={annotationState.color}
              activeStampLabel={annotationState.stampLabel}
              activeStampName={annotationState.stampName}
              activeToolType={annotationState.activeToolType}
              annotations={currentPageAnnotations}
              onAnnotationClick={onAnnotationClick}
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
        </div>
      </div>
      <StatusBar readerState={reader.state} />
      <SettingsPanel
        onClose={() => onUtilityPanelChange(utilityPanel === "settings" ? "none" : "none")}
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
  panel,
  reader,
  search,
  annotations,
}: {
  panel: Exclude<UtilityPanelId, "none">;
  reader: ReaderController;
  search: TextSearchController;
  annotations?: PdfAnnotation[];
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
        annotations={annotations ?? []}
        currentPage={reader.state.document?.currentPage}
        hasDocument={reader.state.document !== null}
        onSelectPage={reader.setCurrentPage}
        pageCount={reader.state.document?.pageCount}
      />
    );
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
  mode,
  ocr,
}: {
  mode: Exclude<AppModeId, "read" | "pages">;
  ocr?: OcrWorkspaceController;
}) {
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
              <button className="context-tool" key={tool} type="button">
                {tool}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="context-toolbar" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
      {contextualTools[mode]?.map((tool) => (
        <button className="context-tool" key={tool} type="button">
          {tool}
        </button>
      ))}
    </div>
  );
}

function PageOrganizerWorkspace({ reader }: { reader: ReaderController }) {
  const pageCount = reader.state.document?.pageCount ?? 0;
  const pages = Array.from({ length: Math.min(pageCount, 12) }, (_, index) => index + 1);

  if (!reader.state.document) {
    return (
      <main className="page-organizer" aria-label="页面管理工作台">
        <section className="page-organizer__empty" aria-label="页面管理空态">
          <div className="open-dropzone__sheet" aria-hidden="true" />
          <h2>打开 PDF 后管理页面</h2>
          <p>旋转、摘录、删除和另存操作只会在文档打开后启用。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-organizer" aria-label="页面管理工作台">
      <div className="page-organizer__toolbar" role="toolbar" aria-label="页面管理工具条">
        {["插入页", "附加文件", "旋转", "复制", "粘贴", "摘录", "删除"].map((action) => (
          <button className="context-tool" disabled={action === "粘贴"} key={action} type="button">
            {action}
          </button>
        ))}
        <button className="context-tool context-tool--primary" type="button">
          另存为新 PDF
        </button>
      </div>
      <ol className="page-grid" aria-label="页面网格">
        {pages.map((page) => (
          <li className="page-card" key={page}>
            <div className="page-card__sheet" aria-hidden="true" />
            <span>第 {page} 页</span>
            <small>A4 (210 x 297 毫米)</small>
          </li>
        ))}
      </ol>
    </main>
  );
}
