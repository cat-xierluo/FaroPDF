import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import { PDF_ANNOTATION_TYPES } from "../../shared/pdf/annotation";
import { ANNOTATION_COLOR_SWATCHES } from "./toolbarModel";
import {
  matchesPageFilter,
  matchesQuery,
  matchesTypeFilter,
  searchAnnotations,
  type AnnotationSearchOptions,
} from "./search";
import { sortAnnotations } from "./sidecar";

/**
 * 侧边栏分组维度。AnnotationSidebar 暴露一个 segment control 切换维度。
 * v0.2 §107 要求：按页码、颜色、标签和批注类型分组 — 4 个维度全部覆盖。
 */
export type AnnotationSidebarGroupBy = "page" | "color" | "type" | "label";

export const ANNOTATION_SIDEBAR_GROUP_BY_LIST: AnnotationSidebarGroupBy[] = [
  "page",
  "color",
  "type",
  "label",
];

export const ANNOTATION_SIDEBAR_GROUP_BY_LABELS: Record<AnnotationSidebarGroupBy, string> = {
  page: "按页码",
  color: "按颜色",
  type: "按类型",
  label: "按标签",
};

/** 侧边栏可筛选的 4 个 chip 维度 */
export interface AnnotationSidebarFilterState {
  query?: string;
  types?: ReadonlyArray<PdfAnnotationType>;
  colors?: ReadonlyArray<string>;
  pageNumbers?: ReadonlyArray<number>;
  labels?: ReadonlyArray<string>;
}

/** 分组结果：每个分组携带一个可读标题 + 该组批注 */
export interface AnnotationSidebarGroup {
  /** 分组主键（如页码数字、颜色 hex、类型 id、标签字符串） */
  key: string;
  /** 用于显示的标题 */
  title: string;
  /** 排序后的批注列表 */
  annotations: PdfAnnotation[];
}

/** 标签提取：图章用 stamp.label；其他用 content/quote 第一句截断 */
export function deriveAnnotationLabel(annotation: PdfAnnotation): string | null {
  if (annotation.stamp?.label?.trim()) {
    return annotation.stamp.label.trim();
  }
  if (annotation.content?.trim()) {
    return truncateLabel(annotation.content.trim());
  }
  if (annotation.quote?.trim()) {
    return truncateLabel(annotation.quote.trim());
  }
  return null;
}

function truncateLabel(value: string, max = 24): string {
  if (value.length <= max) {
    return value;
  }
  return value.slice(0, max) + "…";
}

/** 把颜色 hex 规整为小写无 # 形式，与 search.ts 的 normalizeColor 保持一致 */
function normalizeHex(value: string): string {
  return value.trim().replace(/^#/, "").toLowerCase();
}

/** 按页码分组（pageIndex 0-based 转为显示用 1-based 页码） */
export function groupAnnotationsByPage(annotations: ReadonlyArray<PdfAnnotation>): AnnotationSidebarGroup[] {
  const map = new Map<number, PdfAnnotation[]>();
  for (const annotation of annotations) {
    const list = map.get(annotation.pageIndex);
    if (list) {
      list.push(annotation);
    } else {
      map.set(annotation.pageIndex, [annotation]);
    }
  }
  return [...map.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pageIndex, items]) => ({
      key: String(pageIndex),
      title: `第 ${pageIndex + 1} 页`,
      annotations: items,
    }));
}

/** 按颜色分组：先按色板定义顺序，再追加未知颜色到末尾 */
export function groupAnnotationsByColor(annotations: ReadonlyArray<PdfAnnotation>): AnnotationSidebarGroup[] {
  const paletteSet = new Set(ANNOTATION_COLOR_SWATCHES.map((swatch) => normalizeHex(swatch.value)));
  const map = new Map<string, PdfAnnotation[]>();
  const order: string[] = [];
  for (const annotation of annotations) {
    const raw = normalizeHex(annotation.color);
    const key = raw && paletteSet.has(raw) ? raw : "其他";
    const list = map.get(key);
    if (list) {
      list.push(annotation);
    } else {
      map.set(key, [annotation]);
      order.push(key);
    }
  }
  const sortedKnown = order.filter((key) => key !== "其他");
  const otherEntries = order.includes("其他")
    ? [{ key: "其他", title: "其他颜色", annotations: map.get("其他") ?? [] }]
    : [];
  return [
    ...sortedKnown.map((key) => ({
      key,
      title: formatColorTitle(key),
      annotations: map.get(key) ?? [],
    })),
    ...otherEntries,
  ];
}

function formatColorTitle(hex: string): string {
  const swatch = ANNOTATION_COLOR_SWATCHES.find(
    (entry) => normalizeHex(entry.value) === hex,
  );
  if (swatch) {
    return `${swatch.label}（${hex}）`;
  }
  return `#${hex}`;
}

/** 按类型分组（按 PDF_ANNOTATION_TYPES 固定顺序，未出现的类型跳过） */
export function groupAnnotationsByType(annotations: ReadonlyArray<PdfAnnotation>): AnnotationSidebarGroup[] {
  const map = new Map<PdfAnnotationType, PdfAnnotation[]>();
  for (const annotation of annotations) {
    const list = map.get(annotation.type);
    if (list) {
      list.push(annotation);
    } else {
      map.set(annotation.type, [annotation]);
    }
  }
  return PDF_ANNOTATION_TYPES.filter((type) => map.has(type)).map((type) => ({
    key: type,
    title: ANNOTATION_TYPE_LABELS[type],
    annotations: map.get(type) ?? [],
  }));
}

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
  ink: "手写",
  stamp: "图章",
};

/** 按标签分组（deriveAnnotationLabel 抽取；无法抽取的归到 "无标签"）；保持首次出现顺序 */
export function groupAnnotationsByLabel(annotations: ReadonlyArray<PdfAnnotation>): AnnotationSidebarGroup[] {
  const map = new Map<string, PdfAnnotation[]>();
  const order: string[] = [];
  for (const annotation of annotations) {
    const label = deriveAnnotationLabel(annotation);
    const key = label ?? "无标签";
    const list = map.get(key);
    if (list) {
      list.push(annotation);
    } else {
      map.set(key, [annotation]);
      order.push(key);
    }
  }
  return order.map((label) => ({
    key: label,
    title: label,
    annotations: map.get(label) ?? [],
  }));
}

/** 通用分组函数：按指定维度分组 */
export function groupAnnotations(
  annotations: ReadonlyArray<PdfAnnotation>,
  groupBy: AnnotationSidebarGroupBy,
): AnnotationSidebarGroup[] {
  switch (groupBy) {
    case "page":
      return groupAnnotationsByPage(annotations);
    case "color":
      return groupAnnotationsByColor(annotations);
    case "type":
      return groupAnnotationsByType(annotations);
    case "label":
      return groupAnnotationsByLabel(annotations);
    default:
      return groupAnnotationsByPage(annotations);
  }
}

/**
 * 应用侧边栏筛选条件。colors 和 labels 列表语义为「任一命中即通过」（OR），
 * 多个 chip 维度之间是 AND。
 */
export function applyAnnotationSidebarFilters(
  annotations: ReadonlyArray<PdfAnnotation>,
  filters: AnnotationSidebarFilterState,
): PdfAnnotation[] {
  const { colors, labels, query, types, pageNumbers } = filters;
  const filtered = annotations.filter((annotation) => {
    if (!matchesQuery(annotation, query)) return false;
    if (!matchesTypeFilter(annotation, types)) return false;
    if (!matchesPageFilter(annotation, pageNumbers)) return false;
    if (colors && colors.length > 0) {
      const normalizedAnnotationColor = normalizeHex(annotation.color);
      const hit = colors.some((color) => normalizeHex(color) === normalizedAnnotationColor);
      if (!hit) return false;
    }
    if (labels && labels.length > 0) {
      const annotationLabel = deriveAnnotationLabel(annotation);
      if (!annotationLabel) return false;
      if (!labels.includes(annotationLabel)) return false;
    }
    return true;
  });
  return sortAnnotations(filtered);
}

/** 侧边栏可用的颜色去重列表（来自 toolbarModel 6 色色板） */
export const ANNOTATION_SIDEBAR_COLOR_CHOICES: ReadonlyArray<{ id: string; value: string; label: string }> =
  ANNOTATION_COLOR_SWATCHES.map((swatch) => ({
    id: swatch.id,
    value: swatch.value,
    label: swatch.label,
  }));

/** 侧边栏可用的类型列表（来自 PDF_ANNOTATION_TYPES，保持稳定顺序） */
export const ANNOTATION_SIDEBAR_TYPE_CHOICES: ReadonlyArray<{ id: PdfAnnotationType; label: string }> =
  PDF_ANNOTATION_TYPES.map((type) => ({ id: type, label: ANNOTATION_TYPE_LABELS[type] }));

/**
 * 提取一批批注中出现过的所有非空标签（去重、按出现先后排序），用于筛选 chip。
 * 图章的 stamp.label 优先，否则回退到 content/quote 截断。
 */
export function collectAnnotationLabelChoices(annotations: ReadonlyArray<PdfAnnotation>): string[] {
  const seen = new Set<string>();
  for (const annotation of annotations) {
    const label = deriveAnnotationLabel(annotation);
    if (label) {
      seen.add(label);
    }
  }
  return [...seen];
}

/** 内部工具：从 AnnotationSearchOptions 派生侧边栏筛选条件（保留 query/types/pageNumbers/color） */
export function sidebarFiltersFromSearch(
  options: AnnotationSearchOptions,
  extra?: { colors?: ReadonlyArray<string>; labels?: ReadonlyArray<string> },
): AnnotationSidebarFilterState {
  return {
    ...(options.query ? { query: options.query } : {}),
    ...(options.types ? { types: options.types } : {}),
    ...(options.pageNumbers ? { pageNumbers: options.pageNumbers } : {}),
    ...(options.color ? { colors: [options.color] } : {}),
    ...(extra?.colors ? { colors: extra.colors } : {}),
    ...(extra?.labels ? { labels: extra.labels } : {}),
  };
}

/** 反向：把侧边栏筛选条件折叠回 searchAnnotations 接受的 options */
export function sidebarFiltersToSearch(filters: AnnotationSidebarFilterState): AnnotationSearchOptions {
  return {
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.types ? { types: filters.types } : {}),
    ...(filters.pageNumbers ? { pageNumbers: filters.pageNumbers } : {}),
    ...(filters.colors && filters.colors.length === 1 ? { color: filters.colors[0] } : {}),
  };
}

/** 用 AnnotationSearchOptions 兼容路径直接过滤（不传 colors/labels） */
export function filterAnnotationsByOptions(
  annotations: ReadonlyArray<PdfAnnotation>,
  options: AnnotationSearchOptions,
): PdfAnnotation[] {
  return searchAnnotations(annotations, options);
}
