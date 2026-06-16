import { afterEach, describe, expect, test } from "vitest";
import { regionsScreenToPdf, selectPageCanvas } from "./redactionCoords";
import type { RedactionRegionDraft } from "./ui/RedactionOverlay";

const VIEWPORT = { width: 612, height: 792 };

function injectReaderDom(pageNumbers: number[]): void {
  document.body.innerHTML = pageNumbers
    .map(
      (n) =>
        `<section class="pdf-page" data-page-number="${n}"><div class="page-container"><canvas></canvas></div></section>`,
    )
    .join("");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("selectPageCanvas (DEC-114 review P0-1 回归防护)", () => {
  test("currentPageNumber=1 命中 [data-page-number=1] canvas", () => {
    injectReaderDom([1, 2, 3]);
    const canvas = selectPageCanvas(1);
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName).toBe("CANVAS");
  });

  test("currentPageNumber=2 在多页 DOM 命中第 2 页 canvas（不是第 1 页）", () => {
    injectReaderDom([1, 2, 3]);
    const pages = document.querySelectorAll(".pdf-page");
    const canvas = selectPageCanvas(2);
    // 命中的 canvas 应在第 2 个 pdf-page 内
    expect(pages[1].contains(canvas)).toBe(true);
  });

  test("currentPageNumber 不存在 → 返回 null（不再命中虚构的 .reader-canvas）", () => {
    injectReaderDom([1, 2]);
    expect(selectPageCanvas(99)).toBeNull();
  });

  test("空 DOM → 返回 null", () => {
    expect(selectPageCanvas(1)).toBeNull();
  });
});

describe("regionsScreenToPdf (DEC-114 坐标转换 + Y 翻转)", () => {
  test("单个 region：屏幕坐标 → PDF 用户空间，Y 翻转（PDF 原点左下）", () => {
    // canvas 在屏幕 (0,0) ~ (612,792)，scale=1（viewport == canvas CSS）
    const canvasRect = { left: 0, top: 0, width: 612, height: 792 };
    const region: RedactionRegionDraft = {
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 50,
      height: 30,
    };
    const [pdf] = regionsScreenToPdf([region], canvasRect, VIEWPORT);
    expect(pdf.x).toBe(100);
    // y = viewport.height - (screenY - rect.top)*scale - height*scale = 792 - 200 - 30 = 562
    expect(pdf.y).toBe(562);
    expect(pdf.width).toBe(50);
    expect(pdf.height).toBe(30);
  });

  test("canvas 有偏移（rect.left/top）→ 减去偏移再 scale", () => {
    const canvasRect = { left: 50, top: 30, width: 306, height: 396 }; // 半尺寸，scale=2
    const region: RedactionRegionDraft = {
      pageIndex: 0,
      x: 150, // = rect.left 50 + 100 canvas-local
      y: 130, // = rect.top 30 + 100 canvas-local
      width: 20,
      height: 10,
    };
    const [pdf] = regionsScreenToPdf([region], canvasRect, VIEWPORT);
    // canvas-local x = 150-50 = 100; *scale 2 = 200
    expect(pdf.x).toBe(200);
    // canvas-local y = 130-30 = 100; viewport.h - 100*2 - 10*2 = 792 - 200 - 20 = 572
    expect(pdf.y).toBe(572);
    expect(pdf.width).toBe(40);
    expect(pdf.height).toBe(20);
  });

  test("多 region 全部转换", () => {
    const canvasRect = { left: 0, top: 0, width: 612, height: 792 };
    const regions: RedactionRegionDraft[] = [
      { pageIndex: 0, x: 10, y: 10, width: 5, height: 5 },
      { pageIndex: 0, x: 200, y: 300, width: 50, height: 50 },
    ];
    const pdf = regionsScreenToPdf(regions, canvasRect, VIEWPORT);
    expect(pdf).toHaveLength(2);
    expect(pdf[0].x).toBe(10);
    expect(pdf[1].x).toBe(200);
  });
});
