import { describe, expect, test, vi } from "vitest";
import type { PdfPageText } from "../../shared/pdf/text";
import {
  computeTextItemRects,
  createTextSearchSession,
  getSearchHighlightsForPage,
  summarizeTextLayerStatus,
} from "./textSearchService";

function pageText(pageIndex: number, text: string, status: PdfPageText["status"] = "available"): PdfPageText {
  return {
    pageIndex,
    text,
    status,
    itemCount: text ? 1 : 0,
    charCount: text.length,
  };
}

describe("textSearchService", () => {
  test("builds the text index only when a query requests a batch", async () => {
    const readPageText = vi.fn(async (pageIndex: number) =>
      [
        pageText(0, "合同第一页约定付款义务。"),
        pageText(1, "第二页是附件目录。"),
        pageText(2, "判决书再次提到合同履行。"),
      ][pageIndex],
    );
    const session = createTextSearchSession({
      pageCount: 3,
      readPageText,
    });

    expect(readPageText).not.toHaveBeenCalled();

    const firstBatch = await session.search("合同", { batchSize: 1, startPageIndex: 0 });

    expect(readPageText).toHaveBeenCalledTimes(1);
    expect(firstBatch.indexedPageIndexes).toEqual([0]);
    expect(firstBatch.pendingPageCount).toBe(2);
    expect(firstBatch.hits).toHaveLength(1);
    expect(firstBatch.hits[0]).toMatchObject({
      pageIndex: 0,
      pageNumber: 1,
      matchText: "合同",
    });

    const complete = await session.indexNextBatch({ batchSize: 2 });

    expect(readPageText).toHaveBeenCalledTimes(3);
    expect(complete.indexedPageIndexes).toEqual([0, 1, 2]);
    expect(complete.pendingPageCount).toBe(0);
    expect(complete.hits.map((hit) => hit.pageNumber)).toEqual([1, 3]);
  });

  test("tracks active hits and current page highlights", async () => {
    const session = createTextSearchSession({
      pageCount: 2,
      readPageText: async (pageIndex) =>
        [
          pageText(0, "合同甲方签署，合同乙方签署。"),
          pageText(1, "裁判理由未再出现关键词。"),
        ][pageIndex],
    });

    const searched = await session.search("合同", { batchSize: 2, startPageIndex: 0 });

    expect(searched.hits).toHaveLength(2);
    expect(getSearchHighlightsForPage(searched, 0)).toEqual([
      expect.objectContaining({ matchText: "合同", active: true }),
      expect.objectContaining({ matchText: "合同", active: false }),
    ]);

    const next = session.selectNextHit();

    expect(next.activeHit?.matchIndex).toBe(1);
    expect(getSearchHighlightsForPage(next, 0)).toEqual([
      expect.objectContaining({ active: false }),
      expect.objectContaining({ active: true }),
    ]);

    const previous = session.selectPreviousHit();

    expect(previous.activeHit?.matchIndex).toBe(0);
  });

  test("models OCR hints when searchable text is missing", async () => {
    const session = createTextSearchSession({
      pageCount: 100,
      readPageText: async (pageIndex) => pageText(pageIndex, "", "missing"),
    });

    const state = await session.search("案号", { batchSize: 2, startPageIndex: 0 });

    expect(state.status).toBe("needs-ocr");
    expect(state.textLayerStatus).toBe("missing");
    expect(state.pendingPageCount).toBe(98);
    expect(state.ocrHint).toEqual({
      visible: true,
      reason: "missing-text-layer",
      message: "当前 PDF 缺少可搜索文字层，建议先进行 OCR 后再搜索。",
      actionLabel: "转到 OCR",
    });
  });

  test("reports empty only after all indexed text pages have no hits", async () => {
    const session = createTextSearchSession({
      pageCount: 2,
      readPageText: async (pageIndex) =>
        [
          pageText(0, "第一页只有目录。"),
          pageText(1, "第二页只有附录。"),
        ][pageIndex],
    });

    const state = await session.search("合同", { batchSize: 2, startPageIndex: 0 });

    expect(state.status).toBe("empty");
    expect(state.hits).toHaveLength(0);
    expect(state.ocrHint).toBeNull();
  });

  test("summarizes mixed text layer quality without treating partial scans as fully searchable", () => {
    expect(summarizeTextLayerStatus([pageText(0, "合同"), pageText(1, "", "missing")], 2)).toBe("partial");
    expect(summarizeTextLayerStatus([pageText(0, "", "missing"), pageText(1, "", "missing")], 2)).toBe("missing");
    expect(summarizeTextLayerStatus([pageText(0, ""), pageText(1, "")], 2)).toBe("poor");
  });
});

describe("computeTextItemRects（真实搜索高亮矩形，2026-08-15）", () => {
  const items = [
    // A4 页（595x842pt）顶部一行：基线 y=800（PDF 空间 y 向上），宽 200 高 10
    { str: "MUTUAL NON-DISCLOSURE AGREEMENT", transform: [10, 0, 0, 10, 60, 800], width: 200, height: 10 },
    { str: "reference fixture", transform: [10, 0, 0, 10, 60, 780], width: 80, height: 8 },
    { str: "无关键词行", transform: [10, 0, 0, 10, 60, 760], width: 60, height: 8 },
  ];

  test("命中 item 返回 pt 域矩形，y 已翻转为页面左上原点", () => {
    const rects = computeTextItemRects(items, "non-disclosure", 842);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 60, y: 842 - 800 - 10, width: 200, height: 10 });
  });

  test("大小写不敏感；多命中逐项返回", () => {
    const both = computeTextItemRects(
      [
        { str: "Contract A", transform: [1, 0, 0, 1, 10, 700], width: 50, height: 10 },
        { str: "contract B", transform: [1, 0, 0, 1, 10, 600], width: 50, height: 10 },
      ],
      "CONTRACT",
      842,
    );
    expect(both).toHaveLength(2);
  });

  test("无命中 / 空 query / 缺几何（transform/width/height 不全）跳过或返回空", () => {
    expect(computeTextItemRects(items, "不存在的词", 842)).toEqual([]);
    expect(computeTextItemRects(items, "  ", 842)).toEqual([]);
    expect(
      computeTextItemRects([{ str: "有词但缺 transform", width: 10, height: 5 }], "有词", 842),
    ).toEqual([]);
  });
});
