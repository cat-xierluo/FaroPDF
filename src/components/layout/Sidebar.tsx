import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Files, ListTree, MessageSquareText, Plus } from "lucide-react";
import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import type { PdfViewMode, ZoomPresetId } from "../../shared/pdf/types";
import { ZOOM_PRESETS } from "../../shared/pdf/types";

/** 缩略图渲染函数（来自 reader controller） */
export type RenderThumbnailFn = (
  pageIndex: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
) => Promise<void>;

const summaryTabs = ["书签", "大纲", "批注列表", "缩略图"] as const;
export type SummaryTab = (typeof summaryTabs)[number];
const summaryTabIcons = {
  书签: Bookmark,
  大纲: ListTree,
  批注列表: MessageSquareText,
  缩略图: Files,
} as const;
const viewModeOptions: Array<{ id: PdfViewMode; label: string }> = [
  { id: "continuous", label: "连续" },
  { id: "single", label: "单页" },
  { id: "double", label: "双页" },
  { id: "fit-width", label: "适合宽度" },
];

/** 缩略图默认渲染宽度，约束最长边像素 */
const THUMBNAIL_MAX_WIDTH = 220;

/** 批注类型的中文标签映射 */
const ANNOTATION_TYPE_LABELS: Record<PdfAnnotationType, string> = {
  highlight: "高亮",
  ellipse: "椭圆",
  "double-arrow": "双向箭头",
  line: "直线",
  underline: "下划线",
  strikeout: "删除线",
  note: "备注",
  textbox: "文本框",
  rectangle: "矩形",
  arrow: "箭头",
  ink: "墨迹",
  stamp: "图章",
};

/** 批注类型对应的图标符号 */
const ANNOTATION_TYPE_ICONS: Record<PdfAnnotationType, string> = {
  highlight: "▮",
  ellipse: "○",
  "double-arrow": "↔",
  line: "／",
  underline: "＿",
  strikeout: "̶",
  note: "💬",
  textbox: "T",
  rectangle: "▭",
  arrow: "→",
  ink: "✎",
  stamp: "YPD",
};

const THUMBNAIL_STATUS_MARKERS = [
  { className: "thumbnail-status-marker--annotation", label: "本页有批注", shortLabel: "A" },
  { className: "thumbnail-status-marker--search", label: "本页有搜索命中", shortLabel: "S" },
  { className: "thumbnail-status-marker--ocr", label: "本页需要 OCR", shortLabel: "O" },
] as const;

interface DocumentSummaryPanelProps {
  /** 当前打开的文档是否有批注数据可用 */
  hasDocument: boolean;
  /** 批注列表 */
  annotations?: PdfAnnotation[];
  /** 点击批注或缩略图时跳转到对应页面的回调，参数为 pageIndex (0-based) */
  onSelectPage?: (pageIndex: number) => void;
  /** 当前页码（1-based）；用于高亮缩略图 */
  currentPage?: number;
  /** 总页数；用于渲染完整缩略图列表 */
  pageCount?: number;
  /** 缩略图渲染函数；提供时启用真实 PDF.js canvas，未提供时退回到占位 */
  renderThumbnail?: RenderThumbnailFn;
  /** 拥有搜索命中的页码集合（1-based） */
  pagesWithHits?: Set<number>;
  /** 是否需要 OCR（来自 document.ocrStatus === "needed"） */
  ocrNeeded?: boolean;
  /** 进入特定工作流时应显示的参考 tab；变化时同步一次，用户仍可继续切换。 */
  preferredTab?: SummaryTab;
}

export function DocumentSummaryPanel({
  hasDocument,
  annotations,
  onSelectPage,
  currentPage,
  pageCount,
  renderThumbnail,
  pagesWithHits,
  ocrNeeded,
  preferredTab,
}: DocumentSummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<SummaryTab>(preferredTab ?? "缩略图");

  useEffect(() => {
    if (preferredTab) {
      setActiveTab(preferredTab);
    }
  }, [preferredTab]);

  return (
    <aside className="utility-panel document-summary" aria-label="文档摘要">
      <div className="summary-tabs" role="tablist" aria-label="文档摘要视图">
        {summaryTabs.map((tab) => {
          const TabIcon = summaryTabIcons[tab];
          return (
            <button
              aria-label={tab}
              aria-selected={activeTab === tab}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              title={tab}
              type="button"
            >
              <TabIcon aria-hidden="true" size={15} strokeWidth={1.7} />
            </button>
          );
        })}
      </div>

      {activeTab === "缩略图" ? (
        <ThumbnailPanel
          hasDocument={hasDocument}
          pageCount={pageCount}
          currentPage={currentPage}
          renderThumbnail={renderThumbnail}
          annotations={annotations}
          pagesWithHits={pagesWithHits}
          ocrNeeded={ocrNeeded}
          onSelectPage={onSelectPage}
        />
      ) : activeTab === "批注列表" ? (
        <AnnotationListPanel
          hasDocument={hasDocument}
          annotations={annotations}
          onSelectPage={onSelectPage}
        />
      ) : activeTab === "大纲" || activeTab === "书签" ? (
        <div className="summary-outline" role="tabpanel" aria-label={activeTab}>
          <header className="summary-outline__header">
            <h2>{activeTab}</h2>
            <button aria-label={`添加${activeTab}项目`} title={`添加${activeTab}项目`} type="button">
              <Plus aria-hidden="true" size={16} />
            </button>
          </header>
          <div className="summary-outline__empty">
            <div className="summary-outline__illustration" aria-hidden="true">
              <span className="summary-outline__sheet summary-outline__sheet--back" />
              <span className="summary-outline__sheet summary-outline__sheet--front">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <p>
              {activeTab === "大纲"
                ? "右击文本并从菜单选择 添加大纲项目。"
                : "点击上方加号，为当前页面添加书签。"}
            </p>
          </div>
        </div>
      ) : (
        <div className="summary-empty" role="tabpanel">
          <p>{activeTab}会在打开 PDF 后显示。</p>
        </div>
      )}
    </aside>
  );
}

/** 缩略图面板：渲染所有页码的缩略图列表，支持当前页、批注/搜索/OCR 标记和懒加载 */
function ThumbnailPanel({
  hasDocument,
  pageCount,
  currentPage,
  renderThumbnail,
  annotations,
  pagesWithHits,
  ocrNeeded,
  onSelectPage,
}: {
  hasDocument: boolean;
  pageCount?: number;
  currentPage?: number;
  renderThumbnail?: RenderThumbnailFn;
  annotations?: PdfAnnotation[];
  pagesWithHits?: Set<number>;
  ocrNeeded?: boolean;
  onSelectPage?: (pageIndex: number) => void;
}) {
  if (!hasDocument || !pageCount || pageCount <= 0) {
    return (
      <div className="summary-empty" role="tabpanel" aria-label="缩略图">
        <p>打开 PDF 后显示缩略图</p>
      </div>
    );
  }

  const pagesWithAnnotations = useMemo(() => {
    if (!annotations || annotations.length === 0) {
      return new Set<number>();
    }

    const set = new Set<number>();
    for (const annotation of annotations) {
      set.add(annotation.pageIndex + 1);
    }
    return set;
  }, [annotations]);

  const totalPages = pageCount;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <ol className="thumbnail-list" aria-label="页面缩略图" data-testid="thumbnail-list">
      {pageNumbers.map((pageNumber) => (
        <ThumbnailItem
          current={pageNumber === currentPage}
          key={pageNumber}
          ocrNeeded={ocrNeeded === true}
          onSelectPage={onSelectPage}
          pageNumber={pageNumber}
          renderThumbnail={renderThumbnail}
          showAnnotationMarker={pagesWithAnnotations.has(pageNumber)}
          showSearchMarker={pagesWithHits?.has(pageNumber) ?? false}
        />
      ))}
    </ol>
  );
}

/** 单个缩略图项：IntersectionObserver 懒加载 canvas */
function ThumbnailItem({
  pageNumber,
  current,
  renderThumbnail,
  showAnnotationMarker,
  showSearchMarker,
  ocrNeeded,
  onSelectPage,
}: {
  pageNumber: number;
  current: boolean;
  renderThumbnail?: RenderThumbnailFn;
  showAnnotationMarker: boolean;
  showSearchMarker: boolean;
  ocrNeeded: boolean;
  onSelectPage?: (pageIndex: number) => void;
}) {
  const containerRef = useRef<HTMLLIElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  // 监听元素进入视口，触发懒加载
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // 不支持 IntersectionObserver 时直接显示（SSR / 旧浏览器兜底）
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  // 元素可见后调用 PDF.js 渲染
  useEffect(() => {
    if (!visible || !renderThumbnail || !canvasRef.current || rendered) {
      return;
    }

    let cancelled = false;
    renderThumbnail(pageNumber - 1, canvasRef.current, THUMBNAIL_MAX_WIDTH)
      .then(() => {
        if (!cancelled) {
          setRendered(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, renderThumbnail, pageNumber, rendered]);

  const handleClick = () => {
    onSelectPage?.(pageNumber - 1);
  };

  const showCanvas = renderThumbnail !== undefined && !failed;

  return (
    <li
      aria-current={current ? "page" : undefined}
      className={
        "thumbnail-item thumbnail-item--large" +
        (current ? " thumbnail-item--current" : "")
      }
      data-page-number={pageNumber}
      data-rendered={rendered ? "true" : "false"}
      ref={containerRef}
    >
      <button
        aria-label={`第 ${pageNumber} 页${current ? "（当前页）" : ""}`}
        className="thumbnail-button"
        onClick={handleClick}
        type="button"
      >
        <div
          className="thumbnail-page"
          style={{
            aspectRatio: "210 / 297",
            background: "var(--paper, #f8f6f1)",
          }}
        >
          {showCanvas ? (
            <canvas
              aria-hidden="true"
              data-testid={`thumbnail-canvas-${pageNumber}`}
              ref={canvasRef}
              style={{ display: rendered ? "block" : "none", width: "100%", height: "auto" }}
            />
          ) : null}
          {!rendered && !failed ? <div className="thumbnail-placeholder" aria-hidden="true" /> : null}
          {failed ? <div className="thumbnail-error" aria-hidden="true">无法生成</div> : null}
        </div>
        <div className="thumbnail-meta">
          <span>第 {pageNumber} 页</span>
          <ThumbnailStatusMarkers
            showAnnotationMarker={showAnnotationMarker}
            showSearchMarker={showSearchMarker}
            ocrNeeded={ocrNeeded}
          />
        </div>
      </button>
    </li>
  );
}

function ThumbnailStatusMarkers({
  ocrNeeded,
  showAnnotationMarker,
  showSearchMarker,
}: {
  ocrNeeded: boolean;
  showAnnotationMarker: boolean;
  showSearchMarker: boolean;
}) {
  const markers = [
    showAnnotationMarker ? THUMBNAIL_STATUS_MARKERS[0] : null,
    showSearchMarker ? THUMBNAIL_STATUS_MARKERS[1] : null,
    ocrNeeded ? THUMBNAIL_STATUS_MARKERS[2] : null,
  ].filter((marker): marker is (typeof THUMBNAIL_STATUS_MARKERS)[number] => marker !== null);

  if (markers.length === 0) {
    return null;
  }

  return (
    <div className="thumbnail-status-markers" aria-label="页状态标记">
      {markers.map((marker) => (
        <span
          aria-label={marker.label}
          className={`thumbnail-status-marker ${marker.className}`}
          key={marker.label}
          title={marker.label}
        >
          <span aria-hidden="true">{marker.shortLabel}</span>
        </span>
      ))}
    </div>
  );
}

/** 批注列表面板：按页码分组展示批注 */
function AnnotationListPanel({
  hasDocument,
  annotations,
  onSelectPage,
}: {
  hasDocument: boolean;
  annotations?: PdfAnnotation[];
  onSelectPage?: (pageIndex: number) => void;
}) {
  if (!hasDocument) {
    return (
      <div className="summary-empty" role="tabpanel" aria-label="批注列表">
        <p>打开 PDF 后显示批注列表</p>
      </div>
    );
  }

  const loadedAnnotations = annotations ?? [];

  if (loadedAnnotations.length === 0) {
    return (
      <div className="summary-empty" role="tabpanel" aria-label="批注列表">
        <p>当前文档暂无批注</p>
      </div>
    );
  }

  return (
    <div className="annotation-list" role="tabpanel" aria-label="批注列表">
      <AnnotationGroups annotations={loadedAnnotations} onSelectPage={onSelectPage} />
    </div>
  );
}

/** 按页码分组的批注列表 */
function AnnotationGroups({
  annotations,
  onSelectPage,
}: {
  annotations: PdfAnnotation[];
  onSelectPage?: (pageIndex: number) => void;
}) {
  const groups = useMemo(() => groupAnnotationsByPage(annotations), [annotations]);

  return (
    <ul aria-label="按页码分组的批注">
      {groups.map((group) => (
        <li key={group.pageIndex}>
          <div className="annotation-group-header">
            第 {group.pageIndex + 1} 页
          </div>
          <ul aria-label={`第 ${group.pageIndex + 1} 页的批注`}>
            {group.annotations.map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                onSelectPage={onSelectPage}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** 单条批注条目 */
function AnnotationItem({
  annotation,
  onSelectPage,
}: {
  annotation: PdfAnnotation;
  onSelectPage?: (pageIndex: number) => void;
}) {
  const handleClick = () => {
    onSelectPage?.(annotation.pageIndex);
  };

  const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type];
  const typeIcon = ANNOTATION_TYPE_ICONS[annotation.type];
  const contentText = annotation.content || annotation.quote;

  return (
    <button
      className="annotation-item"
      onClick={handleClick}
      type="button"
      aria-label={`${typeLabel} - 第 ${annotation.pageIndex + 1} 页${contentText ? `: ${truncateText(contentText, 40)}` : ""}`}
    >
      <span className="annotation-item__icon" aria-hidden="true">{typeIcon}</span>
      <span
        className="annotation-item__color"
        style={{ backgroundColor: annotation.color }}
        aria-hidden="true"
      />
      <span className="annotation-item__body">
        <span className="annotation-item__type">{typeLabel}</span>
        {contentText ? (
          <span className="annotation-item__content">{truncateText(contentText, 40)}</span>
        ) : null}
      </span>
    </button>
  );
}

/** 按页码分组 */
function groupAnnotationsByPage(annotations: PdfAnnotation[]): Array<{ pageIndex: number; annotations: PdfAnnotation[] }> {
  const map = new Map<number, PdfAnnotation[]>();

  for (const annotation of annotations) {
    const existing = map.get(annotation.pageIndex);
    if (existing) {
      existing.push(annotation);
    } else {
      map.set(annotation.pageIndex, [annotation]);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([pageIndex, pageAnnotations]) => ({ pageIndex, annotations: pageAnnotations }));
}

/** 截断文本 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "…";
}

interface ViewSettingsPanelProps {
  canChangeViewMode: boolean;
  onViewModeChange: (viewMode: PdfViewMode) => void;
  onZoomPresetChange: (presetId: ZoomPresetId) => void;
  onRotate: (direction: "clockwise" | "counter-clockwise") => void;
  viewMode: PdfViewMode;
  /** 当前缩放预设 id；若当前 zoom 不匹配任何预设则为 undefined */
  activeZoomPresetId?: ZoomPresetId;
  /** 是否在 fit-width 视图模式下（影响 activeZoomPreset 展示） */
  isFitWidth?: boolean;
}

export function ViewSettingsPanel({
  activeZoomPresetId,
  canChangeViewMode,
  isFitWidth,
  onRotate,
  onViewModeChange,
  onZoomPresetChange,
  viewMode,
}: ViewSettingsPanelProps) {
  // fit-width 视图模式下强制高亮 "fit-width" 缩放预设
  const resolvedActiveZoomPreset: ZoomPresetId | undefined = isFitWidth ? "fit-width" : activeZoomPresetId;

  return (
    <aside className="utility-panel view-settings" aria-label="视图设置">
      <h2>布局选项</h2>
      <section aria-label="页面布局">
        <p className="utility-label">页面布局</p>
        <div className="choice-grid choice-grid--four" data-testid="view-mode-grid">
          {viewModeOptions.map((option) => (
            <button
              aria-pressed={viewMode === option.id}
              data-view-mode={option.id}
              disabled={!canChangeViewMode}
              key={option.id}
              onClick={() => onViewModeChange(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="缩放预设">
        <p className="utility-label">缩放预设</p>
        <div className="choice-grid choice-grid--four" data-testid="zoom-preset-grid">
          {ZOOM_PRESETS.map((preset) => (
            <button
              aria-pressed={resolvedActiveZoomPreset === preset.id}
              data-zoom-preset={preset.id}
              disabled={!canChangeViewMode}
              key={preset.id}
              onClick={() => onZoomPresetChange(preset.id)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="旋转">
        <p className="utility-label">旋转</p>
        <div className="choice-grid choice-grid--two" data-testid="rotate-grid">
          <button
            aria-label="逆时针旋转 90 度"
            data-rotate-direction="counter-clockwise"
            disabled={!canChangeViewMode}
            onClick={() => onRotate("counter-clockwise")}
            type="button"
          >
            逆时针 90°
          </button>
          <button
            aria-label="顺时针旋转 90 度"
            data-rotate-direction="clockwise"
            disabled={!canChangeViewMode}
            onClick={() => onRotate("clockwise")}
            type="button"
          >
            顺时针 90°
          </button>
        </div>
      </section>
      <section aria-label="分屏视图">
        <p className="utility-label">分屏视图</p>
        <div className="choice-grid choice-grid--three">
          <button aria-pressed="true" disabled type="button">
            无拆分
          </button>
          <button aria-pressed="false" disabled type="button">
            垂直
          </button>
          <button aria-pressed="false" disabled type="button">
            水平
          </button>
        </div>
      </section>
    </aside>
  );
}
