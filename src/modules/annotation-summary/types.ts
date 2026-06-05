import type { PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import type { AnnotationSidebarGroupBy } from "../annotation/sidebarGroups";

/** 摘要分组维度（复用 sidebarGroups 的 4 个维度） */
export type SummaryDimension = AnnotationSidebarGroupBy;

export const SUMMARY_DIMENSIONS: SummaryDimension[] = ["page", "color", "type", "label"];

export const SUMMARY_DIMENSION_LABELS: Record<SummaryDimension, string> = {
  page: "按页码",
  color: "按颜色",
  type: "按类型",
  label: "按标签",
};

/** 单个分组：包含 key、数量和前 N 个示例批注 */
export interface SummaryGroupEntry {
  key: string;
  displayTitle: string;
  count: number;
  samples: PdfAnnotation[];
}

/** 按维度返回的分组结构 */
export interface SummaryDimensionResult {
  dimension: SummaryDimension;
  groups: SummaryGroupEntry[];
}

/** 所有 4 个维度的摘要结果 */
export interface AnnotationSummaryResult {
  total: number;
  dimensions: SummaryDimensionResult[];
}
