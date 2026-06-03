import { describe, expect, test } from "vitest";
import {
  annotationBoundingRect,
  clampRectToBounds,
  inkStrokesToRect,
  isRectWithinBounds,
  lineToRect,
  normalizeRect,
  pointsToRect,
  recomputeInkRects,
  recomputeLineRects,
  sanitizeRects,
  unionRects,
} from "./geometry";
import type { PdfAnnotation } from "../../shared/pdf/annotation";

describe("annotation geometry utilities", () => {
  test("normalizeRect 把反向矩形转为正宽高", () => {
    expect(normalizeRect({ x: 100, y: 100, width: -50, height: -20 })).toEqual({
      x: 50,
      y: 80,
      width: 50,
      height: 20,
    });
  });

  test("pointsToRect 把任意方向的两点包成正矩形", () => {
    expect(pointsToRect({ x: 10, y: 20 }, { x: 60, y: 50 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 30,
    });
    expect(pointsToRect({ x: 60, y: 50 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 30,
    });
  });

  test("inkStrokesToRect 计算所有笔触的最小包围盒", () => {
    const rect = inkStrokesToRect([
      [
        { x: 10, y: 10 },
        { x: 30, y: 25 },
      ],
      [{ x: 40, y: 5 }],
    ]);

    expect(rect).toEqual({ x: 10, y: 5, width: 30, height: 20 });
  });

  test("inkStrokesToRect 在没有点时返回 null", () => {
    expect(inkStrokesToRect([])).toBeNull();
    expect(inkStrokesToRect([[]])).toBeNull();
  });

  test("lineToRect 把直线/箭头转 bbox", () => {
    expect(lineToRect({ start: { x: 10, y: 10 }, end: { x: 70, y: 80 } })).toEqual({
      x: 10,
      y: 10,
      width: 60,
      height: 70,
    });
  });

  test("recomputeInkRects 与 recomputeLineRects 都输出第一个 rect 是 bbox 的数组", () => {
    expect(recomputeInkRects({ strokes: [[{ x: 0, y: 0 }, { x: 20, y: 30 }]] })).toEqual([
      { x: 0, y: 0, width: 20, height: 30 },
    ]);
    expect(recomputeLineRects({ start: { x: 0, y: 0 }, end: { x: 30, y: 40 } })).toEqual([
      { x: 0, y: 0, width: 30, height: 40 },
    ]);
  });

  test("sanitizeRects 过滤非法矩形", () => {
    expect(
      sanitizeRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 1, y: 1, width: 0, height: 5 },
        { x: 1, y: 1, width: 5, height: 0 },
        { x: 1, y: 1, width: -5, height: 5 },
        { x: Number.NaN, y: 0, width: 5, height: 5 },
        { x: 1, y: 1, width: 5, height: 5 },
      ]),
    ).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 1, y: 1, width: 5, height: 5 },
    ]);
  });

  test("isRectWithinBounds 检查矩形是否完全落在视口内", () => {
    const viewport = { width: 100, height: 200 };
    expect(isRectWithinBounds({ x: 0, y: 0, width: 10, height: 10 }, viewport)).toBe(true);
    expect(isRectWithinBounds({ x: 0, y: 0, width: 100, height: 200 }, viewport)).toBe(true);
    expect(isRectWithinBounds({ x: -1, y: 0, width: 10, height: 10 }, viewport)).toBe(false);
    expect(isRectWithinBounds({ x: 90, y: 190, width: 11, height: 10 }, viewport)).toBe(false);
    expect(isRectWithinBounds({ x: 0, y: 0, width: 10, height: 201 }, viewport)).toBe(false);
  });

  test("clampRectToBounds 裁剪到视口", () => {
    expect(clampRectToBounds({ x: -5, y: 150, width: 200, height: 200 }, { width: 100, height: 200 })).toEqual({
      x: 0,
      y: 150,
      width: 100,
      height: 50,
    });
  });

  test("unionRects 把多矩形并集", () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 15, height: 15 });
    expect(unionRects([])).toBeNull();
  });

  test("annotationBoundingRect 优先 rects，再 line，再 ink", () => {
    const fromRects: PdfAnnotation = {
      id: "a",
      type: "highlight",
      pageIndex: 0,
      rects: [{ x: 0, y: 0, width: 10, height: 10 }],
      color: "#fff",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(annotationBoundingRect(fromRects)).toEqual({ x: 0, y: 0, width: 10, height: 10 });

    const fromLine: PdfAnnotation = {
      id: "b",
      type: "arrow",
      pageIndex: 0,
      rects: [],
      color: "#000",
      line: { start: { x: 1, y: 2 }, end: { x: 5, y: 6 } },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(annotationBoundingRect(fromLine)).toEqual({ x: 1, y: 2, width: 4, height: 4 });

    const fromInk: PdfAnnotation = {
      id: "c",
      type: "ink",
      pageIndex: 0,
      rects: [],
      color: "#000",
      ink: { strokes: [[{ x: 0, y: 0 }, { x: 10, y: 20 }]] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(annotationBoundingRect(fromInk)).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });
});
