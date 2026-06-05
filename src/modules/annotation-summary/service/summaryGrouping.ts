import type { PdfAnnotation } from "../../../shared/pdf/annotation";
import {
  groupAnnotations,
  type AnnotationSidebarGroupBy,
} from "../../annotation/sidebarGroups";
import type { SummaryDimensionResult, SummaryDimension, SummaryGroupEntry, AnnotationSummaryResult } from "../types";

const MAX_SAMPLES = 3;

/** 按指定维度分组并返回摘要（每组包含 key、数量和前 N 个示例） */
export function buildDimensionSummary(
  annotations: ReadonlyArray<PdfAnnotation>,
  dimension: SummaryDimension,
): SummaryDimensionResult {
  const groups = groupAnnotations(annotations, dimension as AnnotationSidebarGroupBy);
  return {
    dimension,
    groups: groups.map((group) => ({
      key: group.key,
      displayTitle: group.title,
      count: group.annotations.length,
      samples: group.annotations.slice(0, MAX_SAMPLES),
    })),
  };
}

/** 按 4 个维度生成完整摘要 */
export function buildFullSummary(
  annotations: ReadonlyArray<PdfAnnotation>,
): AnnotationSummaryResult {
  const dimensions: SummaryDimension[] = ["page", "color", "type", "label"];
  return {
    total: annotations.length,
    dimensions: dimensions.map((dim) => buildDimensionSummary(annotations, dim)),
  };
}
