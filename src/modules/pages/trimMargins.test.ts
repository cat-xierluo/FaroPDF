import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { trimPageMargins } from "./trimMargins";

async function buildPdfWithPages(pageSizes: Array<[number, number]>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const [w, h] of pageSizes) {
    pdf.addPage([w, h]);
  }
  return await pdf.save();
}

describe("trimPageMargins", () => {
  test("trim 4 边 margin 后 CropBox / MediaBox 缩小", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]); // A4
    const result = await trimPageMargins(bytes, {
      top: 20,
      right: 30,
      bottom: 20,
      left: 30,
    });
    const reloaded = await PDFDocument.load(result);
    const page = reloaded.getPage(0);
    expect(page.getWidth()).toBe(595 - 30 - 30); // 535
    expect(page.getHeight()).toBe(842 - 20 - 20); // 802
    expect(page.getCropBox()).toEqual({
      x: 30,
      y: 20,
      width: 535,
      height: 802,
    });
  });

  test("pageIndexes 限定：仅裁剪指定页", async () => {
    const bytes = await buildPdfWithPages([
      [595, 842],
      [595, 842],
      [595, 842],
    ]);
    const result = await trimPageMargins(bytes, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 50,
      pageIndexes: [1],
    });
    const reloaded = await PDFDocument.load(result);
    // 第 1 页（index 0）保持原 595
    expect(reloaded.getPage(0).getWidth()).toBe(595);
    // 第 2 页（index 1）裁剪 50
    expect(reloaded.getPage(1).getWidth()).toBe(545);
    // 第 3 页（index 2）保持
    expect(reloaded.getPage(2).getWidth()).toBe(595);
  });

  test("left + right ≥ width 抛错", async () => {
    const bytes = await buildPdfWithPages([[200, 800]]);
    await expect(
      trimPageMargins(bytes, { top: 0, right: 150, bottom: 0, left: 100 }),
    ).rejects.toThrow(/left \+ right margins/);
  });

  test("top + bottom ≥ height 抛错", async () => {
    const bytes = await buildPdfWithPages([[800, 200]]);
    await expect(
      trimPageMargins(bytes, { top: 100, right: 0, bottom: 150, left: 0 }),
    ).rejects.toThrow(/top \+ bottom margins/);
  });

  test("pageIndexes 越界抛错", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    await expect(
      trimPageMargins(bytes, { top: 0, right: 0, bottom: 0, left: 0, pageIndexes: [5] }),
    ).rejects.toThrow(/Page index out of range/);
  });

  test("负数 margin 抛错", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    await expect(
      trimPageMargins(bytes, { top: -1, right: 0, bottom: 0, left: 0 }),
    ).rejects.toThrow(/non-negative finite/);
  });

  test("NaN margin 抛错", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    await expect(
      trimPageMargins(bytes, { top: Number.NaN, right: 0, bottom: 0, left: 0 }),
    ).rejects.toThrow(/non-negative finite/);
  });

  test("0 margin 不改变页面（identity）", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    const result = await trimPageMargins(bytes, { top: 0, right: 0, bottom: 0, left: 0 });
    const reloaded = await PDFDocument.load(result);
    const page = reloaded.getPage(0);
    expect(page.getWidth()).toBe(595);
    expect(page.getHeight()).toBe(842);
  });

  test("round-trip：trim → reload → trim 仍可", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    const first = await trimPageMargins(bytes, { top: 20, right: 30, bottom: 20, left: 30 });
    const second = await trimPageMargins(first, { top: 10, right: 10, bottom: 10, left: 10 });
    const reloaded = await PDFDocument.load(second);
    expect(reloaded.getPage(0).getWidth()).toBe(595 - 30 - 30 - 10 - 10); // 515
  });

  test("trim 后 PDF 字节合法（用 CropBox 存在验证）", async () => {
    const bytes = await buildPdfWithPages([[595, 842]]);
    const result = await trimPageMargins(bytes, { top: 20, right: 30, bottom: 20, left: 30 });
    const reloaded = await PDFDocument.load(result);
    const page = reloaded.getPage(0);
    const cropBox = page.node.lookup(PDFName.of("CropBox"));
    expect(cropBox).toBeDefined();
  });
});
