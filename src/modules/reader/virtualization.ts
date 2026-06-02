import type { PdfViewMode } from "../../shared/pdf/types";

export interface ReaderRenderRangeInput {
  pageCount: number;
  currentPage: number;
  viewMode: PdfViewMode;
  overscanPages?: number;
}

export interface ReaderRenderRange {
  startPage: number;
  endPage: number;
  pageNumbers: number[];
}

const DEFAULT_OVERSCAN_PAGES = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateReaderRenderRange({
  pageCount,
  currentPage,
  viewMode,
  overscanPages = DEFAULT_OVERSCAN_PAGES,
}: ReaderRenderRangeInput): ReaderRenderRange {
  if (pageCount <= 0) {
    return { startPage: 0, endPage: 0, pageNumbers: [] };
  }

  const page = clamp(Math.trunc(currentPage), 1, pageCount);
  const overscan = Math.max(0, Math.trunc(overscanPages));
  const visiblePageCount = viewMode === "double" ? 2 : 1;
  const visibleEndPage = clamp(page + visiblePageCount - 1, 1, pageCount);
  const startPage = clamp(page - overscan, 1, pageCount);
  const endPage = clamp(visibleEndPage + overscan, 1, pageCount);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);

  return { startPage, endPage, pageNumbers };
}
