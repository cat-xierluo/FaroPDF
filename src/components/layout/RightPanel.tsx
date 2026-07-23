import { useId } from "react";
import { CustomStampPanel } from "../../modules/annotation/ui/CustomStampPanel";
import type { CustomStamp } from "../../modules/annotation/customStampStore";
import { SignaturePanel } from "../../modules/forms/ui/SignaturePanel";
import type { SignatureRecord } from "../../modules/forms/signatureStore";
import { ShapeToolPanel, type ShapeToolValue } from "./panels/ShapeToolPanel";
import { SearchResultsPanel, type SearchHitItem } from "./panels/SearchResultsPanel";
import type { AppModeId, RightPanelId } from "./types";
import {
  DocSummaryPanelView,
  type DocSummary,
} from "./panels/DocSummaryPanelView";
import {
  OcrStatusPanelView,
  type OcrJobStatus,
  type OcrStartOptions,
} from "./panels/OcrStatusPanelView";
import {
  ExportPreviewPanelView,
  type ExportPreviewSummary,
} from "./panels/ExportPreviewPanelView";
import { OcrQueuePanelView } from "./panels/OcrQueuePanelView";
import type { OcrCommandJob } from "../../shared/ocr/jobQueue";

/**
 * ISS-060：右栏模式驱动面板（v0.2）。
 *
 * 阶段 1 是 skeleton 占位；阶段 2（DEC-112 / DEC-113）真实模块接入：
 * - annotate / forms / export + stamps → 渲染 CustomStampPanel（DEC-112）
 * - annotate / forms / export + signatures → 渲染 SignaturePanel（DEC-113）
 * - export + export-preview → 导出预览（待启动）
 * - ocr + ocr-queue → OCR 任务队列（v0.2 follow-up）
 * - read / pages → 折叠或简版
 */
export interface RightPanelProps {
  activeMode: AppModeId;
  rightPanel: RightPanelId;
  /** 用户从右栏选中自定义图章时的回调（接到 annotationArmed） */
  onSelectCustomStamp?: (stamp: CustomStamp) => void;
  /** 用户从右栏选中签名时的回调（接到 FormsPanel / annotationArmed） */
  onSelectSignature?: (signature: SignatureRecord) => void;
  /** ISS-060 阶段 2 后续：用户点击 tab 显式切换面板内容（annotate/forms 模式有效） */
  onPanelChange?: (panel: RightPanelId) => void;
  /** ISS-NEW-C：文档摘要面板输入（null = 无文档，空态）。仅当 rightPanel="summary" 生效。 */
  docSummary?: DocSummary | null;
  /** ISS-NEW-C：OCR 状态面板输入。仅当 rightPanel="ocr-status" 生效。 */
  ocrStatus?: OcrJobStatus;
  /** ISS-NEW-C：用户点击 OCR 状态面板「开始」按钮（placeholder，真实 OCR 调用不在本任务）。 */
  onStartOcr?: (options: OcrStartOptions) => void;
  /**
   * ISS-NEW-C 阶段 2 后续（2026-06-22 收口）：右栏「导出预览」面板输入。
   * 仅当 rightPanel="export-preview" 生效。
   */
  exportPreview?: ExportPreviewSummary;
  /**
   * ISS-NEW-C 阶段 2 后续（2026-06-22 收口）：右栏「OCR 队列」面板输入。
   * 仅当 rightPanel="ocr-queue" 生效。
   */
  ocrQueueJobs?: ReadonlyArray<OcrCommandJob>;
  onCancelOcrJob?: (jobId: string) => void;
  /** ISS-NEW-I（W2 worker）：形状工具右栏当前值 + onChange（受控 placeholder） */
  shapeToolValue?: ShapeToolValue;
  onShapeToolChange?: (next: ShapeToolValue) => void;
  /** ISS-NEW-I（W2 worker）：搜索右栏 query/hits + 回调 */
  searchQuery?: string;
  searchHits?: ReadonlyArray<SearchHitItem>;
  searchActiveHitId?: string | null;
  onSearchQueryChange?: (query: string) => void;
  onSearchSelectHit?: (hitId: string) => void;
  onSearchJumpPrevious?: () => void;
  onSearchJumpNext?: () => void;
  onSearchClose?: () => void;
}

interface PanelDescriptor {
  title: string;
  hint: string;
}

const PANELS_BY_MODE: Record<AppModeId, Record<Exclude<RightPanelId, "none">, PanelDescriptor>> = {
  annotate: {
    stamps: { title: "图章", hint: "标准 9 个图章在批注工具条；下方自定义图章可上传 PNG / JPG。" },
    signatures: { title: "签名", hint: "右栏画手写签名或选历史签名，落入文档" },
    "export-preview": { title: "导出预览", hint: "在导出模式下，右栏展示导出文件预览" },
    "ocr-queue": { title: "OCR 队列", hint: "OCR 模式不进入批注流程" },
    // 历史 skeleton：具体字段、顺序和密度等待 M1 参考证据。
    summary: { title: "文档摘要", hint: "文件名 / 页数 / 大小 / 元数据；目标层级待 M1 验证" },
    "ocr-status": { title: "OCR 状态", hint: "当前 OCR 任务状态 + 页码范围 + 开始按钮（placeholder）" },
    shape: { title: "形状", hint: "批注时插入矩形/椭圆/箭头/直线/铅笔，含线宽/不透明度/边框/填充色。" },
    search: { title: "搜索", hint: "批注文档的全文搜索命中导航与高亮。" },
  },
  export: {
    stamps: { title: "图章", hint: "在导出过程中复用已保存的图章模板" },
    signatures: { title: "签名", hint: "导入或选择签名图作为导出附加" },
    "export-preview": { title: "导出预览", hint: "v0.2 落地的导出 PDF 实时预览" },
    "ocr-queue": { title: "OCR 队列", hint: "导出模式下不需要 OCR 队列" },
    summary: { title: "文档摘要", hint: "导出目标文档元数据 + 文件大小" },
    "ocr-status": { title: "OCR 状态", hint: "导出前可对扫描件先跑 OCR" },
    shape: { title: "形状", hint: "导出模式下形状工具不直接落点。" },
    search: { title: "搜索", hint: "导出前用搜索定位需要处理的段落。" },
  },
  forms: {
    stamps: { title: "图章", hint: "在表单填充后加盖业务图章" },
    signatures: { title: "签名", hint: "我的签名缩略图，点击选用或新画签名" },
    "export-preview": { title: "导出预览", hint: "表单填写 + 扁平的合并预览" },
    "ocr-queue": { title: "OCR 队列", hint: "扫描表单可走 OCR 后再补填" },
    summary: { title: "文档摘要", hint: "表单 PDF 文件元数据" },
    "ocr-status": { title: "OCR 状态", hint: "扫描表单识别后补填字段" },
    shape: { title: "形状", hint: "表单内可插入形状标注当前字段。" },
    search: { title: "搜索", hint: "搜索表单字段标签快速跳转。" },
  },
  ocr: {
    stamps: { title: "图章", hint: "OCR 完成后可对识别结果盖戳" },
    signatures: { title: "签名", hint: "OCR 后用签名手签批注" },
    "export-preview": { title: "导出预览", hint: "OCR 报告导出预览" },
    "ocr-queue": { title: "OCR 队列", hint: "v0.2 接入：显示任务列表 / 进度 / 报告跳转" },
    summary: { title: "文档摘要", hint: "OCR 源文档元数据" },
    "ocr-status": { title: "OCR 状态", hint: "当前任务进度 + 失败重试" },
    shape: { title: "形状", hint: "OCR 模式下形状工具不直接落点。" },
    search: { title: "搜索", hint: "OCR 文本层上跑搜索。" },
  },
  read: {
    stamps: { title: "图章", hint: "阅读态不活跃，右栏折叠" },
    signatures: { title: "签名", hint: "阅读态不活跃" },
    "export-preview": { title: "导出预览", hint: "阅读态不活跃" },
    "ocr-queue": { title: "OCR 队列", hint: "阅读态不活跃" },
    summary: { title: "文档摘要", hint: "阅读时右栏折叠，summary 不可选" },
    "ocr-status": { title: "OCR 状态", hint: "阅读时右栏折叠，ocr-status 不可选" },
    shape: { title: "形状", hint: "阅读态不活跃" },
    search: { title: "搜索", hint: "阅读态不活跃" },
  },
  pages: {
    stamps: { title: "图章", hint: "页面管理态不显示右栏" },
    signatures: { title: "签名", hint: "页面管理态不显示右栏" },
    "export-preview": { title: "导出预览", hint: "页面管理态不显示右栏" },
    "ocr-queue": { title: "OCR 队列", hint: "页面管理态不显示右栏" },
    summary: { title: "文档摘要", hint: "页面管理态不显示右栏" },
    "ocr-status": { title: "OCR 状态", hint: "页面管理态不显示右栏" },
    shape: { title: "形状", hint: "页面管理态不显示右栏" },
    search: { title: "搜索", hint: "页面管理态不显示右栏" },
  },
};

const READ_INACTIVE_IDS: ReadonlyArray<RightPanelId> = [
  "stamps",
  "signatures",
  "export-preview",
  "ocr-queue",
  "summary",
  "ocr-status",
  "shape",
  "search",
];

export function RightPanel({
  activeMode,
  rightPanel,
  onSelectCustomStamp,
  onSelectSignature,
  onPanelChange,
  docSummary,
  ocrStatus,
  onStartOcr,
  exportPreview,
  ocrQueueJobs,
  onCancelOcrJob,
  shapeToolValue,
  onShapeToolChange,
  searchQuery,
  searchHits,
  searchActiveHitId,
  onSearchQueryChange,
  onSearchSelectHit,
  onSearchJumpPrevious,
  onSearchJumpNext,
  onSearchClose,
}: RightPanelProps) {
  const headingId = useId();

  if (activeMode === "read" || activeMode === "pages") {
    if (rightPanel === "none" || READ_INACTIVE_IDS.includes(rightPanel)) {
      return null;
    }
  }

  const descriptor = PANELS_BY_MODE[activeMode]?.[rightPanel as Exclude<RightPanelId, "none">];
  const title = descriptor?.title ?? "右栏";
  const hint = descriptor?.hint ?? "v0.2 候选";

  // 真实模块接入条件（DEC-112 / DEC-113）：
  // - stamps panel：annotate / forms / export 模式都可以叠加自定义图章
  // - signatures panel：annotate / forms 模式都可以叠加签名
  const showCustomStamp = rightPanel === "stamps" && (activeMode === "annotate" || activeMode === "forms" || activeMode === "export");
  const showSignaturePanel = rightPanel === "signatures" && (activeMode === "annotate" || activeMode === "forms");

  // ISS-NEW-I（W2 worker）：shape / search panel 路由。
  // shape: 主要在 annotate 模式（编辑模式下也在用），其余模式占位 hint。
  // search: 全模式可用；空 query 时仍渲染（提供输入框入口），具体命中由 AppShell 注入。
  const showShapePanel = rightPanel === "shape";
  const showSearchPanel = rightPanel === "search";

  // ISS-060 阶段 2 后续：annotate / forms 模式有 2 个可选面板（图章/签名），渲染显式 tab
  // 让用户主动切换，不依赖 mode 派生。其他模式（ocr/export 单一面板）不显示 tab。
  // ISS-NEW-I：annotate 模式下 shape 与 stamps/signatures 互为并列分支，由
  // RightPanelId 决定渲染哪个分支，不通过 tab 切换。
  const showTabs = activeMode === "annotate" || activeMode === "forms";

  return (
    <aside aria-labelledby={headingId} className="right-pane" data-active-mode={activeMode} data-panel={rightPanel}>
      <header className="right-pane__header">
        <h2 id={headingId} className="right-pane__title">{title}</h2>
        <span aria-hidden="true" className="right-pane__mode-pill">{activeMode}</span>
      </header>
      {showTabs ? (
        <div className="right-pane__tabs" role="tablist" aria-label="右栏面板切换">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanel === "stamps"}
            className={"right-pane__tab" + (rightPanel === "stamps" ? " right-pane__tab--active" : "")}
            onClick={() => onPanelChange?.("stamps")}
          >
            图章
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanel === "signatures"}
            className={"right-pane__tab" + (rightPanel === "signatures" ? " right-pane__tab--active" : "")}
            onClick={() => onPanelChange?.("signatures")}
          >
            签名
          </button>
        </div>
      ) : null}
      <div className="right-pane__body" data-testid="right-pane-body">
        {showShapePanel ? (
          <ShapeToolPanel value={shapeToolValue} onChange={onShapeToolChange} />
        ) : showSearchPanel ? (
          <SearchResultsPanel
            query={searchQuery}
            results={searchHits}
            activeHitId={searchActiveHitId}
            onChangeQuery={onSearchQueryChange}
            onSelectHit={onSearchSelectHit}
            onJumpPrevious={onSearchJumpPrevious}
            onJumpNext={onSearchJumpNext}
            onClose={onSearchClose}
          />
        ) : rightPanel === "summary" ? (
          <DocSummaryPanelView summary={docSummary ?? null} />
        ) : rightPanel === "ocr-status" ? (
          <OcrStatusPanelView
            status={ocrStatus ?? { state: "idle", message: "尚未开始 OCR", progress: 0 }}
            onStart={onStartOcr ?? (() => undefined)}
          />
        ) : rightPanel === "export-preview" ? (
          <ExportPreviewPanelView summary={exportPreview ?? { activeTool: null, fileName: null, pageCount: null }} />
        ) : rightPanel === "ocr-queue" ? (
          <OcrQueuePanelView jobs={ocrQueueJobs ?? []} onCancelJob={onCancelOcrJob} />
        ) : (
          <>
            <p className="right-pane__hint">{hint}</p>
            {showCustomStamp ? (
              <CustomStampPanel onSelectStamp={onSelectCustomStamp ?? (() => undefined)} />
            ) : null}
            {showSignaturePanel ? (
              <SignaturePanel onSelectSignature={onSelectSignature ?? (() => undefined)} />
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
