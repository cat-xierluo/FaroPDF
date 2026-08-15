import type { PdfPageText } from "../../shared/pdf/text";
import type { TextLayerStatus } from "../../shared/pdf/types";

export type TextSearchStatus = "idle" | "indexing" | "ready" | "empty" | "needs-ocr" | "error";
export type SearchOcrHintReason = "missing-text-layer" | "partial-text-layer" | "poor-text-layer";

export interface TextSearchHit {
  id: string;
  pageIndex: number;
  pageNumber: number;
  matchIndex: number;
  range: {
    start: number;
    end: number;
  };
  matchText: string;
  snippet: string;
}

export interface TextSearchHighlight {
  id: string;
  matchText: string;
  range: TextSearchHit["range"];
  active: boolean;
}

export interface SearchOcrHint {
  visible: boolean;
  reason: SearchOcrHintReason;
  message: string;
  actionLabel: string;
}

export interface TextSearchState {
  query: string;
  normalizedQuery: string;
  status: TextSearchStatus;
  hits: TextSearchHit[];
  activeHitId?: string;
  activeHit?: TextSearchHit;
  indexedPageIndexes: number[];
  pendingPageCount: number;
  textLayerStatus: TextLayerStatus;
  ocrHint: SearchOcrHint | null;
  errorMessage?: string;
}

export interface TextSearchPageSource {
  pageCount: number;
  readPageText: (pageIndex: number) => Promise<PdfPageText>;
}

export interface TextSearchBatchOptions {
  batchSize?: number;
  startPageIndex?: number;
}

export interface TextSearchSession {
  getState: () => TextSearchState;
  search: (query: string, options?: TextSearchBatchOptions) => Promise<TextSearchState>;
  indexNextBatch: (options?: Pick<TextSearchBatchOptions, "batchSize">) => Promise<TextSearchState>;
  selectNextHit: () => TextSearchState;
  selectPreviousHit: () => TextSearchState;
  selectHit: (hitId: string) => TextSearchState;
  reset: () => TextSearchState;
}

const DEFAULT_BATCH_SIZE = 8;
const SNIPPET_RADIUS = 18;

export function createTextSearchSession(source: TextSearchPageSource): TextSearchSession {
  const indexedPages = new Map<number, PdfPageText>();
  let state = createIdleSearchState(source.pageCount);

  function updateState(nextState: TextSearchState) {
    state = nextState;
    return state;
  }

  function buildState(query: string, status: TextSearchStatus = "ready"): TextSearchState {
    const normalizedQuery = normalizeSearchQuery(query);
    const indexedPageList = Array.from(indexedPages.values()).sort((left, right) => left.pageIndex - right.pageIndex);
    const hits = normalizedQuery ? findSearchHits(indexedPageList, normalizedQuery) : [];
    const activeHit = hits.find((hit) => hit.id === state.activeHitId) ?? hits[0];
    const textLayerStatus = summarizeTextLayerStatus(indexedPageList, source.pageCount);
    const ocrHint = buildSearchOcrHint(textLayerStatus);
    const pendingPageCount = Math.max(source.pageCount - indexedPages.size, 0);
    const resolvedStatus = resolveSearchStatus({
      requestedStatus: status,
      normalizedQuery,
      hits,
      pendingPageCount,
      ocrHint,
    });

    return {
      query,
      normalizedQuery,
      status: resolvedStatus,
      hits,
      activeHitId: activeHit?.id,
      activeHit,
      indexedPageIndexes: indexedPageList.map((page) => page.pageIndex),
      pendingPageCount,
      textLayerStatus,
      ocrHint,
    };
  }

  async function indexPages(pageIndexes: number[]) {
    for (const pageIndex of pageIndexes) {
      if (!indexedPages.has(pageIndex)) {
        indexedPages.set(pageIndex, await source.readPageText(pageIndex));
      }
    }
  }

  return {
    getState: () => state,
    search: async (query, options = {}) => {
      const normalizedQuery = normalizeSearchQuery(query);

      if (!normalizedQuery) {
        return updateState(createIdleSearchState(source.pageCount));
      }

      state = { ...state, query, normalizedQuery, status: "indexing", errorMessage: undefined };

      try {
        await indexPages(resolveSearchBatch(source.pageCount, indexedPages, options));
        return updateState(buildState(query));
      } catch (error) {
        return updateState({
          ...state,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "搜索索引失败",
        });
      }
    },
    indexNextBatch: async (options = {}) => {
      if (!state.normalizedQuery) {
        return state;
      }

      state = { ...state, status: "indexing", errorMessage: undefined };

      try {
        await indexPages(resolveSearchBatch(source.pageCount, indexedPages, options));
        return updateState(buildState(state.query));
      } catch (error) {
        return updateState({
          ...state,
          status: "error",
          errorMessage: error instanceof Error ? error.message : "搜索索引失败",
        });
      }
    },
    selectNextHit: () => updateState(selectRelativeHit(state, 1)),
    selectPreviousHit: () => updateState(selectRelativeHit(state, -1)),
    selectHit: (hitId) => {
      const activeHit = state.hits.find((hit) => hit.id === hitId);

      return updateState({
        ...state,
        activeHitId: activeHit?.id ?? state.activeHitId,
        activeHit: activeHit ?? state.activeHit,
      });
    },
    reset: () => updateState(createIdleSearchState(source.pageCount)),
  };
}

export function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function summarizeTextLayerStatus(pages: PdfPageText[], expectedPageCount: number): TextLayerStatus {
  if (pages.length === 0) {
    return "unknown";
  }

  const availablePages = pages.filter((page) => page.status === "available" && page.charCount > 0).length;
  const missingPages = pages.filter((page) => page.status === "missing").length;
  const poorPages = pages.filter((page) => page.status === "poor" || (page.status === "available" && page.charCount === 0)).length;
  const indexedPageCount = pages.length;

  if (availablePages === 0 && missingPages > 0 && missingPages + poorPages === indexedPageCount) {
    return "missing";
  }

  if (availablePages === 0 && poorPages === indexedPageCount) {
    return "poor";
  }

  if (availablePages > 0 && availablePages < expectedPageCount) {
    return "partial";
  }

  if (availablePages === expectedPageCount) {
    return "available";
  }

  return missingPages > 0 || poorPages > 0 ? "partial" : "unknown";
}

export function buildSearchOcrHint(textLayerStatus: TextLayerStatus): SearchOcrHint | null {
  if (textLayerStatus === "missing") {
    return {
      visible: true,
      reason: "missing-text-layer",
      message: "当前 PDF 缺少可搜索文字层，建议先进行 OCR 后再搜索。",
      actionLabel: "转到 OCR",
    };
  }

  if (textLayerStatus === "poor") {
    return {
      visible: true,
      reason: "poor-text-layer",
      message: "当前 PDF 文字层质量较差，搜索可能不完整，建议进行 OCR 质量检查。",
      actionLabel: "查看 OCR",
    };
  }

  if (textLayerStatus === "partial") {
    return {
      visible: true,
      reason: "partial-text-layer",
      message: "部分页面缺少可搜索文字层，未命中的扫描页可能需要 OCR。",
      actionLabel: "查看 OCR",
    };
  }

  return null;
}

export function getSearchHighlightsForPage(state: TextSearchState, pageIndex: number): TextSearchHighlight[] {
  return state.hits
    .filter((hit) => hit.pageIndex === pageIndex)
    .map((hit) => ({
      id: hit.id,
      matchText: hit.matchText,
      range: hit.range,
      active: hit.id === state.activeHitId,
    }));
}

export function createIdleSearchState(pageCount: number): TextSearchState {
  return {
    query: "",
    normalizedQuery: "",
    status: "idle",
    hits: [],
    indexedPageIndexes: [],
    pendingPageCount: pageCount,
    textLayerStatus: "unknown",
    ocrHint: null,
  };
}

function findSearchHits(pages: PdfPageText[], normalizedQuery: string): TextSearchHit[] {
  const hits: TextSearchHit[] = [];

  for (const page of pages) {
    const normalizedText = page.text.toLocaleLowerCase();
    let fromIndex = 0;
    let matchIndex = 0;

    while (fromIndex <= normalizedText.length) {
      const start = normalizedText.indexOf(normalizedQuery, fromIndex);

      if (start === -1) {
        break;
      }

      const end = start + normalizedQuery.length;
      const matchText = page.text.slice(start, end);
      hits.push({
        id: `p${page.pageIndex}-m${matchIndex}`,
        pageIndex: page.pageIndex,
        pageNumber: page.pageIndex + 1,
        matchIndex,
        range: { start, end },
        matchText,
        snippet: createSnippet(page.text, start, end),
      });
      matchIndex += 1;
      fromIndex = end;
    }
  }

  return hits;
}

function createSnippet(text: string, start: number, end: number) {
  const snippetStart = Math.max(start - SNIPPET_RADIUS, 0);
  const snippetEnd = Math.min(end + SNIPPET_RADIUS, text.length);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < text.length ? "..." : "";

  return `${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`;
}

function resolveSearchBatch(
  pageCount: number,
  indexedPages: Map<number, PdfPageText>,
  { batchSize = DEFAULT_BATCH_SIZE, startPageIndex = 0 }: TextSearchBatchOptions,
) {
  const safeBatchSize = Math.max(Math.trunc(batchSize), 1);
  const normalizedStart = Math.min(Math.max(Math.trunc(startPageIndex), 0), Math.max(pageCount - 1, 0));
  const orderedPageIndexes = [
    ...Array.from({ length: pageCount - normalizedStart }, (_, offset) => normalizedStart + offset),
    ...Array.from({ length: normalizedStart }, (_, offset) => offset),
  ];

  return orderedPageIndexes.filter((pageIndex) => !indexedPages.has(pageIndex)).slice(0, safeBatchSize);
}

function resolveSearchStatus({
  requestedStatus,
  normalizedQuery,
  hits,
  pendingPageCount,
  ocrHint,
}: {
  requestedStatus: TextSearchStatus;
  normalizedQuery: string;
  hits: TextSearchHit[];
  pendingPageCount: number;
  ocrHint: SearchOcrHint | null;
}) {
  if (!normalizedQuery) {
    return "idle";
  }

  if (ocrHint?.reason === "missing-text-layer" && hits.length === 0) {
    return "needs-ocr";
  }

  if (hits.length === 0 && pendingPageCount === 0) {
    return "empty";
  }

  return requestedStatus;
}

function selectRelativeHit(state: TextSearchState, direction: 1 | -1): TextSearchState {
  if (state.hits.length === 0) {
    return state;
  }

  const activeIndex = Math.max(
    state.hits.findIndex((hit) => hit.id === state.activeHitId),
    0,
  );
  const nextIndex = (activeIndex + direction + state.hits.length) % state.hits.length;
  const activeHit = state.hits[nextIndex];

  return {
    ...state,
    activeHitId: activeHit.id,
    activeHit,
  };
}

/** 文本项几何（pdfjs TextItem 的结构化子集；纯函数解耦，避免 search→reader 反向依赖） */
export interface TextItemGeometry {
  str?: string;
  width?: number;
  height?: number;
  /** pdfjs transform [a,b,c,d,e,f]：e/f 为基线起点（PDF 用户空间，y 向上） */
  transform?: ReadonlyArray<number>;
}

/** 搜索命中矩形（PDF pt 域，y 已翻转为页面左上原点；UI 侧 × zoom 定位） */
export interface TextItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 真实搜索高亮矩形（2026-08-15，替换页内文字 chips 占位）：
 * 在 pdfjs 原始 text items 里做大小写不敏感匹配，返回命中 item 的包围盒
 * （pt 域、页面左上原点）。v1 为 **item 级**高亮（整个 text run 一个矩形，
 * pdf.js viewer 的字符级推进算法留后续）；跨 item 的命中不覆盖（搜索
 * 引擎的拼接命中仍进结果列表，只是页内不画矩形）。
 */
export function computeTextItemRects(
  items: ReadonlyArray<TextItemGeometry>,
  query: string,
  pageHeightPt: number,
): TextItemRect[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  const rects: TextItemRect[] = [];
  for (const item of items) {
    if (!item.str || !item.str.toLowerCase().includes(normalized)) {
      continue;
    }
    const transform = item.transform;
    if (!transform || transform.length < 6 || !item.width || !item.height) {
      continue;
    }
    const x = transform[4];
    const baselineY = transform[5];
    // PDF 用户空间 y 向上、基线为原点 → 页面左上原点：top = pageH - (baseline + ascent 高度)
    rects.push({
      x,
      y: pageHeightPt - baselineY - item.height,
      width: item.width,
      height: item.height,
    });
  }
  return rects;
}
