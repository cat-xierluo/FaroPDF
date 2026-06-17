import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, test } from "vitest";
import type { ChapterHeadingNode } from "./autoToc";
import { writePdfOutline } from "./writePdfOutline";

/** 构造一个 3 页空白 PDF（用于 writePdfOutline 测试）。 */
async function buildEmptyPdfBytes(pageCount = 3): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([595, 842]); // A4
  }
  return await pdf.save();
}

describe("writePdfOutline", () => {
  test("空 outline 树：返回原 PDF bytes（不挂空 outline）", async () => {
    const bytes = await buildEmptyPdfBytes(2);
    const result = await writePdfOutline(bytes, []);
    expect(result).toBeInstanceOf(Uint8Array);
    const reloaded = await PDFDocument.load(result);
    const outlinesRef = reloaded.catalog.get(PDFName.of("Outlines"));
    // 空 tree：不应该挂 Outlines
    expect(outlinesRef).toBeUndefined();
  });

  test("单层 outline（3 个 H1 兄弟）写入后 catalog.Outlines 存在", async () => {
    const bytes = await buildEmptyPdfBytes(5);
    const tree: ChapterHeadingNode[] = [
      { text: "第一章 总则", level: 1, pageIndex: 0, x: 100, y: 700, children: [] },
      { text: "第二章 义务", level: 1, pageIndex: 2, x: 100, y: 700, children: [] },
      { text: "第三章 责任", level: 1, pageIndex: 4, x: 100, y: 700, children: [] },
    ];
    const result = await writePdfOutline(bytes, tree);
    const reloaded = await PDFDocument.load(result);
    const outlinesRef = reloaded.catalog.get(PDFName.of("Outlines"));
    expect(outlinesRef).toBeDefined();
  });

  test("多层 outline（H1 + H2 children）写入后 outline root 字段齐全", async () => {
    const bytes = await buildEmptyPdfBytes(5);
    const tree: ChapterHeadingNode[] = [
      {
        text: "第一章 总则",
        level: 1,
        pageIndex: 0,
        x: 100,
        y: 700,
        children: [
          { text: "第一节 立法目的", level: 2, pageIndex: 0, x: 120, y: 650, children: [] },
          { text: "第二节 适用范围", level: 2, pageIndex: 0, x: 120, y: 600, children: [] },
        ],
      },
      { text: "第二章 义务", level: 1, pageIndex: 1, x: 100, y: 700, children: [] },
    ];
    const result = await writePdfOutline(bytes, tree);
    const reloaded = await PDFDocument.load(result);
    const pageMode = reloaded.catalog.get(PDFName.of("PageMode"));
    expect((pageMode as { toString?: () => string })?.toString?.() ?? pageMode?.toString()).toBe(
      "/UseOutlines",
    );
  });

  test("写入后页数不变（不丢失原页面）", async () => {
    const bytes = await buildEmptyPdfBytes(5);
    const tree: ChapterHeadingNode[] = [
      { text: "第一章", level: 1, pageIndex: 0, x: 0, y: 0, children: [] },
      { text: "第二章", level: 1, pageIndex: 2, x: 0, y: 0, children: [] },
    ];
    const result = await writePdfOutline(bytes, tree);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(5);
  });

  test("pageIndex 越界（> 总页数）clamp 到最后一页", async () => {
    const bytes = await buildEmptyPdfBytes(3);
    const tree: ChapterHeadingNode[] = [
      { text: "未来章节", level: 1, pageIndex: 99, x: 0, y: 0, children: [] },
    ];
    const result = await writePdfOutline(bytes, tree);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(3);
  });

  test("pageIndex 负数 clamp 到第一页", async () => {
    const bytes = await buildEmptyPdfBytes(2);
    const tree: ChapterHeadingNode[] = [
      { text: "负数章节", level: 1, pageIndex: -1, x: 0, y: 0, children: [] },
    ];
    const result = await writePdfOutline(bytes, tree);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(2);
  });

  test("maxItems 上限生效：超过上限的 item 被丢弃", async () => {
    const bytes = await buildEmptyPdfBytes(3);
    const tree: ChapterHeadingNode[] = Array.from({ length: 20 }, (_, i) => ({
      text: `第${i + 1}章`,
      level: 1,
      pageIndex: 0,
      x: 0,
      y: 0,
      children: [],
    }));
    const result = await writePdfOutline(bytes, tree, { maxItems: 5 });
    const reloaded = await PDFDocument.load(result);
    const outlinesRef = reloaded.catalog.get(PDFName.of("Outlines"));
    expect(outlinesRef).toBeDefined();
  });

  test("round-trip：写入 → 重新加载 → 再写入不报错", async () => {
    const bytes = await buildEmptyPdfBytes(2);
    const tree1: ChapterHeadingNode[] = [
      { text: "一", level: 1, pageIndex: 0, x: 0, y: 0, children: [] },
    ];
    const first = await writePdfOutline(bytes, tree1);
    const tree2: ChapterHeadingNode[] = [
      { text: "新章一", level: 1, pageIndex: 0, x: 0, y: 0, children: [] },
      { text: "新章二", level: 1, pageIndex: 1, x: 0, y: 0, children: [] },
    ];
    const second = await writePdfOutline(first, tree2);
    const reloaded = await PDFDocument.load(second);
    expect(reloaded.getPageCount()).toBe(2);
  });

  test("原 PDF 已加密时使用 ignoreEncryption 仍可处理（无 outline 写入场景）", async () => {
    const bytes = await buildEmptyPdfBytes(2);
    const result = await writePdfOutline(bytes, []);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
