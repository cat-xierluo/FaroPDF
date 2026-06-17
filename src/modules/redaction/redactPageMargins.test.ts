import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { redactPageMargins } from "./redactPageMargins";

async function buildPdf(pageCount = 1, w = 595, h = 842): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([w, h]);
  }
  return await pdf.save();
}

describe("redactPageMargins", () => {
  test("4 边 margin 涂白后 content stream 增长（真绘制了矩形）", async () => {
    const bytes = await buildPdf(1);
    const result = await redactPageMargins(bytes, {
      top: 30,
      bottom: 20,
      left: 25,
      right: 35,
    });
    const reloaded = await PDFDocument.load(result);
    // page.Contents 应至少 1 个 stream（绘制操作）
    expect(reloaded.getPage(0).node.Contents()).toBeDefined();
  });

  test("0 margin 不改 PDF（不绘制任何矩形）", async () => {
    const bytes = await buildPdf(1);
    const result = await redactPageMargins(bytes, {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
    const reloaded = await PDFDocument.load(result);
    // 不应添加 Contents
    const contents = reloaded.getPage(0).node.Contents();
    expect(contents).toBeUndefined();
  });

  test("pageIndexes 限定：仅处理指定页", async () => {
    const bytes = await buildPdf(3);
    const result = await redactPageMargins(bytes, {
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
      pageIndexes: [1],
    });
    const reloaded = await PDFDocument.load(result);
    // 第 2 页有 Contents，第 1/3 页没有
    expect(reloaded.getPage(1).node.Contents()).toBeDefined();
    expect(reloaded.getPage(0).node.Contents()).toBeUndefined();
    expect(reloaded.getPage(2).node.Contents()).toBeUndefined();
  });

  test("负数 margin 抛错", async () => {
    const bytes = await buildPdf();
    await expect(
      redactPageMargins(bytes, { top: -1, bottom: 0, left: 0, right: 0 }),
    ).rejects.toThrow(/non-negative finite/);
  });

  test("NaN margin 抛错", async () => {
    const bytes = await buildPdf();
    await expect(
      redactPageMargins(bytes, { top: Number.NaN, bottom: 0, left: 0, right: 0 }),
    ).rejects.toThrow(/non-negative finite/);
  });

  test("pageIndexes 越界抛错", async () => {
    const bytes = await buildPdf(1);
    await expect(
      redactPageMargins(bytes, { top: 0, bottom: 0, left: 0, right: 0, pageIndexes: [5] }),
    ).rejects.toThrow(/Page index out of range/);
  });

  test("自定义 color 参数生效（涂红色）", async () => {
    const bytes = await buildPdf(1);
    const result = await redactPageMargins(bytes, {
      top: 10,
      bottom: 0,
      left: 0,
      right: 0,
      color: { r: 1, g: 0, b: 0 },
    });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPage(0).node.Contents()).toBeDefined();
  });

  test("页尺寸保持不变（与 trimPageMargins 的关键区别）", async () => {
    const bytes = await buildPdf(1, 595, 842);
    const result = await redactPageMargins(bytes, {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    });
    const reloaded = await PDFDocument.load(result);
    const page = reloaded.getPage(0);
    expect(page.getWidth()).toBe(595);
    expect(page.getHeight()).toBe(842);
  });

  test("round-trip：涂白后 PDF 字节合法", async () => {
    const bytes = await buildPdf(2);
    const result = await redactPageMargins(bytes, {
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
    });
    // 再次加载不应抛错
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(2);
  });
});
