import { useId, useMemo, useState, type ChangeEvent } from "react";
import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import {
  ANNOTATION_SIDEBAR_COLOR_CHOICES,
  ANNOTATION_SIDEBAR_GROUP_BY_LABELS,
  ANNOTATION_SIDEBAR_GROUP_BY_LIST,
  ANNOTATION_SIDEBAR_TYPE_CHOICES,
  applyAnnotationSidebarFilters,
  collectAnnotationLabelChoices,
  groupAnnotations,
  type AnnotationSidebarFilterState,
  type AnnotationSidebarGroupBy,
} from "../../modules/annotation/sidebarGroups";
import { AnnotationSummaryPanel } from "../../modules/annotation-summary";

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

const ANNOTATION_TYPE_LABELS: Record<PdfAnnotationType, string> = {
  highlight: "高亮",
  underline: "下划线",
  strikeout: "删除线",
  note: "备注",
  textbox: "文本框",
  rectangle: "矩形",
  arrow: "箭头",
  ink: "手写",
  stamp: "图章",
};

const ANNOTATION_SIDEBAR_GROUP_BY_ARIA: Record<AnnotationSidebarGroupBy, string> = {
  page: "按页码分组的批注",
  color: "按颜色分组的批注",
  type: "按类型分组的批注",
  label: "按标签分组的批注",
};

const NO_LABELS_KEY = "__no_labels__";

/**
 * 批注侧边栏：4 维度分组（页码/颜色/类型/标签）+ 搜索/筛选 + 跳转。
 *
 * 设计为受控组件：annotations / onSelectPage 由父组件传入，组件内只持有筛选 UI 状态。
 * 当前 v0.2 不接 AppShell，由 layout worker 在后续 PR 把 utilityPanel 接入。
 */
export interface AnnotationSidebarProps {
  hasDocument: boolean;
  annotations: ReadonlyArray<PdfAnnotation>;
  /** 当前页码（1-based），用于高亮 active item */
  currentPage?: number;
  /** 总页数（用于筛选 chip 显示） */
  pageCount?: number;
  /** 点击批注时跳转，参数为 0-based pageIndex（与 AnnotationListPanel 协议一致） */
  onSelectPage?: (pageIndex: number) => void;
  /** 选中批注的 id（联动 AnnotationOverlay 高亮） */
  activeAnnotationId?: string | null;
  /** 点击批注触发选中回调 */
  onAnnotationClick?: (annotationId: string) => void;
}

export function AnnotationSidebar({
  activeAnnotationId,
  annotations,
  currentPage,
  hasDocument,
  onAnnotationClick,
  onSelectPage,
  pageCount,
}: AnnotationSidebarProps) {
  const [view, setView] = useState<"list" | "summary">("list");
  const [groupBy, setGroupBy] = useState<AnnotationSidebarGroupBy>("page");
  const [filters, setFilters] = useState<AnnotationSidebarFilterState>({});
  const groupById = useId();
  const queryId = useId();

  const allLabelChoices = useMemo(() => collectAnnotationLabelChoices(annotations), [annotations]);

  const filtered = useMemo(
    () => applyAnnotationSidebarFilters(annotations, filters),
    [annotations, filters],
  );

  const groups = useMemo(() => groupAnnotations(filtered, groupBy), [filtered, groupBy]);

  if (!hasDocument) {
    if (view === "summary") {
      return <AnnotationSummaryPanel hasDocument={false} annotations={[]} />;
    }
    return (
      <aside className="annotation-sidebar" aria-label="批注侧边栏">
        <div className="annotation-sidebar__empty" role="status">
          <p>打开 PDF 后显示批注列表</p>
        </div>
      </aside>
    );
  }

  if (annotations.length === 0) {
    if (view === "summary") {
      return <AnnotationSummaryPanel hasDocument={true} annotations={[]} />;
    }
    return (
      <aside className="annotation-sidebar" aria-label="批注侧边栏">
        <header className="annotation-sidebar__header">
          <h2>批注</h2>
          <p className="annotation-sidebar__hint">本工具支持搜索、筛选、跳转和分组</p>
        </header>
        <div className="annotation-sidebar__empty" role="status">
          <p>当前文档暂无批注</p>
          <p className="annotation-sidebar__hint">在批注模式下选择工具，即可在 PDF 上添加高亮、备注、图章等。</p>
        </div>
      </aside>
    );
  }

  const hasActiveFilters =
    Boolean(filters.query) ||
    Boolean(filters.types?.length) ||
    Boolean(filters.colors?.length) ||
    Boolean(filters.pageNumbers?.length) ||
    Boolean(filters.labels?.length);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setFilters((prev) => ({ ...prev, query: next || undefined }));
  }

  function handleClearFilters() {
    setFilters({});
  }

  function toggleType(type: PdfAnnotationType) {
    setFilters((prev) => {
      const list = prev.types ?? [];
      const next = list.includes(type) ? list.filter((t) => t !== type) : [...list, type];
      return { ...prev, types: next.length > 0 ? next : undefined };
    });
  }

  function toggleColor(color: string) {
    setFilters((prev) => {
      const list = prev.colors ?? [];
      const next = list.includes(color) ? list.filter((c) => c !== color) : [...list, color];
      return { ...prev, colors: next.length > 0 ? next : undefined };
    });
  }

  function togglePage(pageNumber: number) {
    setFilters((prev) => {
      const list = prev.pageNumbers ?? [];
      const next = list.includes(pageNumber) ? list.filter((p) => p !== pageNumber) : [...list, pageNumber];
      return { ...prev, pageNumbers: next.length > 0 ? next : undefined };
    });
  }

  function toggleLabel(label: string) {
    setFilters((prev) => {
      const list = prev.labels ?? [];
      const next = list.includes(label) ? list.filter((l) => l !== label) : [...list, label];
      return { ...prev, labels: next.length > 0 ? next : undefined };
    });
  }

  if (view === "summary") {
    return (
      <AnnotationSummaryPanel
        annotations={annotations}
        documentLabel={`PDF（${annotations.length} 个批注）`}
        hasDocument={true}
        onAnnotationClick={onAnnotationClick}
        onSelectPage={onSelectPage}
      />
    );
  }

  return (
    <aside className="annotation-sidebar" aria-label="批注侧边栏">
      <header className="annotation-sidebar__header">
        <h2>批注（{filtered.length} / {annotations.length}）</h2>
        <div className="annotation-sidebar__view-toggle">
          <button
            aria-pressed={true}
            className="annotation-sidebar__view-btn annotation-sidebar__view-btn--active"
            data-testid="sidebar-view-list"
            onClick={() => setView("list")}
            type="button"
          >
            列表
          </button>
          <button
            aria-pressed={false}
            className="annotation-sidebar__view-btn"
            data-testid="sidebar-view-summary"
            onClick={() => setView("summary")}
            type="button"
          >
            摘要
          </button>
        </div>
        <p className="annotation-sidebar__hint">支持搜索、筛选、跳转与分组</p>
      </header>

      <div
        aria-label="分组维度"
        className="annotation-sidebar__groupby"
        id={groupById}
        role="tablist"
      >
        {ANNOTATION_SIDEBAR_GROUP_BY_LIST.map((option) => (
          <button
            aria-selected={groupBy === option}
            className={
              "annotation-sidebar__groupby-button" +
              (groupBy === option ? " annotation-sidebar__groupby-button--active" : "")
            }
            data-group-by={option}
            key={option}
            onClick={() => setGroupBy(option)}
            role="tab"
            type="button"
          >
            {ANNOTATION_SIDEBAR_GROUP_BY_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="annotation-sidebar__search">
        <label className="annotation-sidebar__search-label" htmlFor={queryId}>
          搜索批注
        </label>
        <input
          aria-label="搜索批注"
          className="annotation-sidebar__search-input"
          data-testid="annotation-sidebar-search"
          id={queryId}
          onChange={handleQueryChange}
          placeholder="搜索批注内容、图章、作者…"
          type="search"
          value={filters.query ?? ""}
        />
      </div>

      <div aria-label="筛选条件" className="annotation-sidebar__filters" role="group">
        <FilterChips
          colors={filters.colors}
          labels={filters.labels}
          labelChoices={allLabelChoices}
          onClear={handleClearFilters}
          onToggleColor={toggleColor}
          onToggleLabel={toggleLabel}
          onTogglePage={togglePage}
          onToggleType={toggleType}
          pageNumbers={filters.pageNumbers}
          pages={buildPageChoices(pageCount)}
          showClear={hasActiveFilters}
          types={filters.types}
        />
      </div>

      {groups.length === 0 ? (
        <div className="annotation-sidebar__empty" role="status">
          <p>当前筛选条件下没有批注</p>
          {hasActiveFilters ? (
            <button className="annotation-sidebar__clear" onClick={handleClearFilters} type="button">
              清除筛选
            </button>
          ) : null}
        </div>
      ) : (
        <ol aria-label={ANNOTATION_SIDEBAR_GROUP_BY_ARIA[groupBy]} className="annotation-sidebar__list">
          {groups.map((group) => (
            <li className="annotation-sidebar__group" data-group-key={group.key} key={group.key}>
              <header className="annotation-sidebar__group-header">
                <span className="annotation-sidebar__group-title">{group.title}</span>
                <span className="annotation-sidebar__group-count">{group.annotations.length}</span>
              </header>
              <ul aria-label={`${group.title} 下的批注`} className="annotation-sidebar__group-items">
                {group.annotations.map((annotation) => (
                  <AnnotationRow
                    annotation={annotation}
                    currentPage={currentPage}
                    isActive={annotation.id === activeAnnotationId}
                    key={annotation.id}
                    onAnnotationClick={onAnnotationClick}
                    onSelectPage={onSelectPage}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

interface AnnotationRowProps {
  annotation: PdfAnnotation;
  currentPage?: number;
  isActive: boolean;
  onAnnotationClick?: (annotationId: string) => void;
  onSelectPage?: (pageIndex: number) => void;
}

function AnnotationRow({
  annotation,
  currentPage,
  isActive,
  onAnnotationClick,
  onSelectPage,
}: AnnotationRowProps) {
  const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type];
  const typeIcon = ANNOTATION_TYPE_ICONS[annotation.type];
  const stampLabel = annotation.stamp?.label?.trim();
  const textPreview = annotation.content?.trim() || annotation.quote?.trim();
  const isCurrentPage = currentPage !== undefined && annotation.pageIndex + 1 === currentPage;

  function handleClick() {
    onSelectPage?.(annotation.pageIndex);
    onAnnotationClick?.(annotation.id);
  }

  return (
    <li className="annotation-sidebar__row" data-annotation-id={annotation.id}>
      <button
        aria-current={isActive ? "true" : undefined}
        aria-label={
          `${typeLabel} · 第 ${annotation.pageIndex + 1} 页` +
          (stampLabel ? ` · 图章：${stampLabel}` : "") +
          (textPreview ? ` · ${truncateForAria(textPreview, 30)}` : "")
        }
        className={
          "annotation-sidebar__row-button" +
          (isActive ? " annotation-sidebar__row-button--active" : "") +
          (isCurrentPage ? " annotation-sidebar__row-button--current-page" : "")
        }
        data-annotation-row-id={annotation.id}
        onClick={handleClick}
        type="button"
      >
        <span className="annotation-sidebar__row-icon" aria-hidden="true">{typeIcon}</span>
        <span
          aria-hidden="true"
          className="annotation-sidebar__row-color"
          style={{ backgroundColor: annotation.color }}
        />
        <span className="annotation-sidebar__row-body">
          <span className="annotation-sidebar__row-type">
            <span>{typeLabel}</span>
            <span className="annotation-sidebar__row-page">第 {annotation.pageIndex + 1} 页</span>
          </span>
          {stampLabel ? (
            <span className="annotation-sidebar__row-stamp">图章：{stampLabel}</span>
          ) : null}
          {textPreview ? (
            <span className="annotation-sidebar__row-content">{truncateForDisplay(textPreview, 30)}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

interface FilterChipsProps {
  colors: ReadonlyArray<string> | undefined;
  labels: ReadonlyArray<string> | undefined;
  labelChoices: ReadonlyArray<string>;
  pages: ReadonlyArray<number>;
  pageNumbers: ReadonlyArray<number> | undefined;
  showClear: boolean;
  types: ReadonlyArray<PdfAnnotationType> | undefined;
  onClear: () => void;
  onToggleColor: (color: string) => void;
  onToggleLabel: (label: string) => void;
  onTogglePage: (pageNumber: number) => void;
  onToggleType: (type: PdfAnnotationType) => void;
}

function FilterChips({
  colors,
  labelChoices,
  labels,
  onClear,
  onToggleColor,
  onToggleLabel,
  onTogglePage,
  onToggleType,
  pageNumbers,
  pages,
  showClear,
  types,
}: FilterChipsProps) {
  return (
    <div className="annotation-sidebar__chips">
      <div aria-label="按类型筛选" className="annotation-sidebar__chip-row" role="group">
        <span className="annotation-sidebar__chip-label">类型</span>
        {ANNOTATION_SIDEBAR_TYPE_CHOICES.map((choice) => {
          const active = types?.includes(choice.id) ?? false;
          return (
            <button
              aria-pressed={active}
              className={
                "annotation-sidebar__chip" +
                (active ? " annotation-sidebar__chip--active" : "")
              }
              data-chip-type={choice.id}
              key={choice.id}
              onClick={() => onToggleType(choice.id)}
              type="button"
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      <div aria-label="按颜色筛选" className="annotation-sidebar__chip-row" role="group">
        <span className="annotation-sidebar__chip-label">颜色</span>
        {ANNOTATION_SIDEBAR_COLOR_CHOICES.map((choice) => {
          const active = colors?.includes(choice.value) ?? false;
          return (
            <button
              aria-label={`颜色 ${choice.label}`}
              aria-pressed={active}
              className={
                "annotation-sidebar__chip annotation-sidebar__chip--color" +
                (active ? " annotation-sidebar__chip--active" : "")
              }
              data-chip-color={choice.value}
              key={choice.id}
              onClick={() => onToggleColor(choice.value)}
              style={{ backgroundColor: choice.value }}
              title={choice.label}
              type="button"
            />
          );
        })}
      </div>

      {pages.length > 0 ? (
        <div aria-label="按页码筛选" className="annotation-sidebar__chip-row" role="group">
          <span className="annotation-sidebar__chip-label">页码</span>
          {pages.slice(0, 12).map((page) => {
            const active = pageNumbers?.includes(page) ?? false;
            return (
              <button
                aria-pressed={active}
                className={
                  "annotation-sidebar__chip" +
                  (active ? " annotation-sidebar__chip--active" : "")
                }
                data-chip-page={page}
                key={page}
                onClick={() => onTogglePage(page)}
                type="button"
              >
                p{page}
              </button>
            );
          })}
        </div>
      ) : null}

      {labelChoices.length > 0 ? (
        <div aria-label="按标签筛选" className="annotation-sidebar__chip-row" role="group">
          <span className="annotation-sidebar__chip-label">标签</span>
          {labelChoices.slice(0, 8).map((label) => {
            const key = label === "无标签" ? NO_LABELS_KEY : label;
            const active = labels?.includes(label) ?? false;
            return (
              <button
                aria-pressed={active}
                className={
                  "annotation-sidebar__chip" +
                  (active ? " annotation-sidebar__chip--active" : "")
                }
                data-chip-label={key}
                key={key}
                onClick={() => onToggleLabel(label)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {showClear ? (
        <button
          className="annotation-sidebar__chip annotation-sidebar__chip--clear"
          data-testid="annotation-sidebar-clear"
          onClick={onClear}
          type="button"
        >
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

function buildPageChoices(pageCount: number | undefined): number[] {
  if (!pageCount || pageCount <= 0) {
    return [];
  }
  const count = Math.min(pageCount, 12);
  return Array.from({ length: count }, (_, index) => index + 1);
}

function truncateForDisplay(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max) + "…";
}

function truncateForAria(text: string, max: number): string {
  return truncateForDisplay(text, max);
}
