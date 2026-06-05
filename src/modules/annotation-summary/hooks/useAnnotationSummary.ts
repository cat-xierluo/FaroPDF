import { useMemo } from "react";
import type { PdfAnnotation } from "../../../shared/pdf/annotation";
import { buildDimensionSummary } from "../service/summaryGrouping";
import type { SummaryDimension, SummaryDimensionResult } from "../types";

export interface UseAnnotationSummaryResult {
  total: number;
  currentDimension: SummaryDimension;
  dimensionResult: SummaryDimensionResult;
}

export function useAnnotationSummary(
  annotations: ReadonlyArray<PdfAnnotation>,
  dimension: SummaryDimension,
): UseAnnotationSummaryResult {
  const dimensionResult = useMemo(
    () => buildDimensionSummary(annotations, dimension),
    [annotations, dimension],
  );

  return {
    total: annotations.length,
    currentDimension: dimension,
    dimensionResult,
  };
}
