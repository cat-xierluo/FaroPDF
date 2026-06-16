import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { splitPagesByGrid, splitPagesByBreakpoints } from "./scanSplit";

/**
 * ISS-066 阶段 1：扫描清洁校正之拆双页 / 网格切 / 自定义断点切测试。
 *
 * 律师卷宗扫描场景：A3 扫成 A4 双页拼一起 / A4 多面拼图扫成单页 / 需要按断点切。
 */

async function makeFixturePdf(pageCount: number, pageSize: [number, number] = [595, 842]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    const page = pdf.addPage(pageSize);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 800, size: 12 });
  }
  return pdf.save();
}

describe("splitPagesByGrid", () => {
  test("1×2 拆双页 → 输出页数 = 输入页数 × 2", async () => {
    const source = await makeFixturePdf(3, [1190, 842]); // A3 横向
    const result = await splitPagesByGrid(source, { rows: 1, cols: 2 });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(6); // 3 × 2 = 6
  });

  test("2×2 网格切 → 输出页数 = 输入页数 × 4", async () => {
    const source = await makeFixturePdf(2);
    const result = await splitPagesByGrid(source, { rows: 2, cols: 2 });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(8); // 2 × 4 = 8
  });

  test("拆双页后每个子页 width = 原 width / 2", async () => {
    const source = await makeFixturePdf(1, [1190, 842]);
    const result = await splitPagesByGrid(source, { rows: 1, cols: 2 });
    const reopened = await PDFDocument.load(result);
    const page0 = reopened.getPage(0);
    const { width, height } = page0.getSize();
    expect(width).toBeCloseTo(595, 1); // 1190 / 2
    expect(height).toBeCloseTo(842, 1);
  });

  test("pageIndexes 限定：只切指定页，其他保留原样", async () => {
    const source = await makeFixturePdf(3, [1190, 842]);
    // 只切第 0 页 → 输出 = 2（来自 page 0 切两份）+ 2（保留 page 1, 2）= 4
    const result = await splitPagesByGrid(source, { rows: 1, cols: 2, pageIndexes: [0] });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(4);
  });

  test("rows = 0 抛错", async () => {
    const source = await makeFixturePdf(1);
    await expect(splitPagesByGrid(source, { rows: 0, cols: 2 })).rejects.toThrow(/rows/);
  });

  test("cols = 0 抛错", async () => {
    const source = await makeFixturePdf(1);
    await expect(splitPagesByGrid(source, { rows: 2, cols: 0 })).rejects.toThrow(/cols/);
  });

  test("pageIndexes 越界抛错", async () => {
    const source = await makeFixturePdf(2);
    await expect(splitPagesByGrid(source, { rows: 1, cols: 2, pageIndexes: [5] })).rejects.toThrow(/pageIndex|range/);
  });
});

describe("splitPagesByBreakpoints", () => {
  test("1 个水平断点 → 切成 2 页", async () => {
    const source = await makeFixturePdf(1, [595, 842]);
    const result = await splitPagesByBreakpoints(source, {
      pageIndex: 0,
      horizontalBreaks: [421], // y=421 切（一半）
    });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(2);
  });

  test("1 横 + 1 纵 → 切成 4 页", async () => {
    const source = await makeFixturePdf(1, [595, 842]);
    const result = await splitPagesByBreakpoints(source, {
      pageIndex: 0,
      horizontalBreaks: [421],
      verticalBreaks: [297],
    });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(4);
  });

  test("不切：无 horizontalBreaks 也无 verticalBreaks → 原页保留", async () => {
    const source = await makeFixturePdf(2, [595, 842]);
    const result = await splitPagesByBreakpoints(source, { pageIndex: 0 });
    const reopened = await PDFDocument.load(result);
    expect(reopened.getPageCount()).toBe(2); // 不切，原 2 页保留
  });

  test("pageIndex 越界抛错", async () => {
    const source = await makeFixturePdf(2);
    await expect(splitPagesByBreakpoints(source, { pageIndex: 5, horizontalBreaks: [100] })).rejects.toThrow(/pageIndex|range/);
  });
});
