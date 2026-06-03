import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import { sortAnnotations } from "./sidecar";

/**
 * 批注搜索/筛选条件。
 *
 * - query: 命中批注 content / quote / stamp.label / author.displayName / typeLabel
 * - types: 限定批注类型
 * - pageNumbers: 限定页码（1-based）
 * - color: 限定颜色（不区分大小写）
 */
export interface AnnotationSearchOptions {
  query?: string;
  types?: ReadonlyArray<PdfAnnotationType>;
  pageNumbers?: ReadonlyArray<number>;
  color?: string;
}

/** 提取可被 query 命中的所有文本字段（小写、去首尾空白） */
export function collectAnnotationSearchHaystack(annotation: PdfAnnotation): string {
  const fields: string[] = [annotation.type];

  if (annotation.content) {
    fields.push(annotation.content);
  }

  if (annotation.quote) {
    fields.push(annotation.quote);
  }

  if (annotation.stamp?.label) {
    fields.push(annotation.stamp.label);
  }

  if (annotation.author?.displayName) {
    fields.push(annotation.author.displayName);
  }

  if (annotation.author?.id) {
    fields.push(annotation.author.id);
  }

  return fields.join(" ").toLowerCase();
}

/** 判断一个批注是否匹配 type 过滤 */
export function matchesTypeFilter(
  annotation: PdfAnnotation,
  types: ReadonlyArray<PdfAnnotationType> | undefined,
): boolean {
  if (!types || types.length === 0) {
    return true;
  }

  return types.includes(annotation.type);
}

/** 判断一个批注是否匹配 page 过滤（pageNumbers 为 1-based） */
export function matchesPageFilter(
  annotation: PdfAnnotation,
  pageNumbers: ReadonlyArray<number> | undefined,
): boolean {
  if (!pageNumbers || pageNumbers.length === 0) {
    return true;
  }

  return pageNumbers.includes(annotation.pageIndex + 1);
}

/** 判断一个批注是否匹配 color 过滤（不区分大小写、忽略 #） */
export function matchesColorFilter(annotation: PdfAnnotation, color: string | undefined): boolean {
  if (!color) {
    return true;
  }

  return normalizeColor(annotation.color) === normalizeColor(color);
}

function normalizeColor(value: string): string {
  return value.trim().replace(/^#/, "").toLowerCase();
}

/** 判断一个批注是否匹配 query（大小写不敏感；空 query 视为全命中） */
export function matchesQuery(annotation: PdfAnnotation, query: string | undefined): boolean {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return collectAnnotationSearchHaystack(annotation).includes(normalized);
}

/** 综合所有过滤条件，返回满足条件的批注列表，按 sortAnnotations 的页/时间顺序输出 */
export function searchAnnotations(
  annotations: ReadonlyArray<PdfAnnotation>,
  options: AnnotationSearchOptions = {},
): PdfAnnotation[] {
  const filtered = annotations.filter(
    (annotation) =>
      matchesQuery(annotation, options.query) &&
      matchesTypeFilter(annotation, options.types) &&
      matchesPageFilter(annotation, options.pageNumbers) &&
      matchesColorFilter(annotation, options.color),
  );

  return sortAnnotations(filtered);
}
