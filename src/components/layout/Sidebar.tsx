import { useMemo, useState } from "react";
import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import type { PdfViewMode } from "../../shared/pdf/types";

const placeholderPages = [1, 2, 3];
const summaryTabs = ["书签", "大纲", "批注列表", "缩略图"] as const;
type SummaryTab = (typeof summaryTabs)[number];
const viewModeOptions: Array<{ id: PdfViewMode; label: string }> = [
  { id: "continuous", label: "连续" },
  { id: "single", label: "单页" },
  { id: "double", label: "双页" },
];

/** 批注类型的中文标签映射 */
const ANNOTATION_TYPE_LABELS: Record<PdfAnnotationType, string> = {
  highlight: "高亮",
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
  underline: "＿",
  strikeout: "̶",
  note: "💬",
  textbox: "T",
  rectangle: "▭",
  arrow: "→",
  ink: "✎",
  stamp: "YPD",
};

interface DocumentSummaryPanelProps {
  /** 当前打开的文档是否有批注数据可用 */
  hasDocument: boolean;
  /** 批注列表 */
  annotations?: PdfAnnotation[];
  /** 点击批注时跳转到对应页面的回调 */
  onSelectPage?: (pageIndex: number) => void;
}

export function DocumentSummaryPanel({ hasDocument, annotations, onSelectPage }: DocumentSummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<SummaryTab>("缩略图");

  return (
    <aside className="utility-panel document-summary" aria-label="文档摘要">
      <div className="summary-tabs" role="tablist" aria-label="文档摘要视图">
        {summaryTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "缩略图" ? (
        <ol className="thumbnail-list" aria-label="页面缩略图">
          {placeholderPages.map((page) => (
            <li className="thumbnail-item thumbnail-item--large" key={page}>
              <div className="thumbnail-page" aria-hidden="true" />
              <span>第 {page} 页</span>
              <small>A4 (210 x 297 毫米)</small>
            </li>
          ))}
        </ol>
      ) : activeTab === "批注列表" ? (
        <AnnotationListPanel
          hasDocument={hasDocument}
          annotations={annotations}
          onSelectPage={onSelectPage}
        />
      ) : (
        <div className="summary-empty" role="tabpanel">
          <p>{activeTab}会在打开 PDF 后显示。</p>
        </div>
      )}
    </aside>
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
  viewMode: PdfViewMode;
}

export function ViewSettingsPanel({ canChangeViewMode, onViewModeChange, viewMode }: ViewSettingsPanelProps) {
  return (
    <aside className="utility-panel view-settings" aria-label="视图设置">
      <h2>布局选项</h2>
      <section aria-label="页面布局">
        <p className="utility-label">页面布局</p>
        <div className="choice-grid choice-grid--three">
          {viewModeOptions.map((option) => (
            <button
              aria-pressed={viewMode === option.id}
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
