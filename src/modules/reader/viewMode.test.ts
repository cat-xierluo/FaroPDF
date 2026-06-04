import { describe, expect, test } from "vitest";
import {
  applyZoomPresetId,
  calculateFitPageZoom,
  calculateFitWidthZoom,
  clampZoom,
  resolveEffectiveZoom,
} from "./viewMode";

describe("calculateFitWidthZoom", () => {
  test("页面宽度 612、容器 800 时返回约 1.28", () => {
    expect(calculateFitWidthZoom(612, 800)).toBeCloseTo((800 - 16) / 612, 5);
  });

  test("页面宽度大于容器时缩放小于 1", () => {
    const zoom = calculateFitWidthZoom(1200, 800);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeCloseTo((800 - 16) / 1200, 5);
  });

  test("容器宽度为 0 或负数时返回 1 兜底", () => {
    expect(calculateFitWidthZoom(612, 0)).toBe(1);
    expect(calculateFitWidthZoom(612, -10)).toBe(1);
  });
});

describe("calculateFitPageZoom", () => {
  test("页面宽高均小于容器时按较紧维度计算缩放（可大于 1）", () => {
    // 400 x 500 放入 800 x 1000，宽度限制 (800-16)/400 = 1.96，高度限制 (1000-16)/500 = 1.968
    // 取较小值 1.96
    expect(calculateFitPageZoom(400, 500, 800, 1000)).toBeCloseTo(1.96, 2);
  });

  test("按较窄维度计算，保证页面整体可见", () => {
    // 612 x 792 放入 1000 x 600，宽度限制 (1000-16)/612 ≈ 1.607，高度限制 (600-16)/792 ≈ 0.738
    // 取较小值 0.738
    const zoom = calculateFitPageZoom(612, 792, 1000, 600);
    expect(zoom).toBeCloseTo(0.738, 2);
  });

  test("页面尺寸异常时返回 1 兜底", () => {
    expect(calculateFitPageZoom(0, 0, 800, 600)).toBe(1);
  });

  test("容器尺寸异常时返回 1 兜底", () => {
    expect(calculateFitPageZoom(400, 500, 0, 0)).toBe(1);
  });
});

describe("clampZoom", () => {
  test("将超出 [0.25, 4] 的值夹紧", () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(5)).toBe(4);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe("resolveEffectiveZoom", () => {
  test("fit-width 模式下按容器宽度计算，忽略 manualZoom", () => {
    const zoom = resolveEffectiveZoom({
      containerWidth: 800,
      manualZoom: 2.5,
      pageWidth: 612,
      viewMode: "fit-width",
    });
    expect(zoom).toBeCloseTo((800 - 16) / 612, 5);
  });

  test("非 fit-width 模式下使用 manualZoom", () => {
    expect(
      resolveEffectiveZoom({
        containerWidth: 800,
        manualZoom: 1.5,
        pageWidth: 612,
        viewMode: "continuous",
      }),
    ).toBe(1.5);
  });
});

describe("applyZoomPresetId", () => {
  test("fit-width 预设切换 viewMode 为 fit-width 并标记需要重算", () => {
    expect(applyZoomPresetId("fit-width", "continuous", 1)).toEqual({
      needsRecompute: true,
      viewMode: "fit-width",
      zoom: 1,
    });
  });

  test("fit-page 预设切换 viewMode 为 single", () => {
    expect(applyZoomPresetId("fit-page", "continuous", 1)).toEqual({
      needsRecompute: true,
      viewMode: "single",
      zoom: 1,
    });
  });

  test("固定数字预设设置 zoom 但保持 viewMode（若之前是 fit-width 则回退到 continuous）", () => {
    expect(applyZoomPresetId("1.5", "fit-width", 1)).toEqual({
      needsRecompute: false,
      viewMode: "continuous",
      zoom: 1.5,
    });
    expect(applyZoomPresetId("0.5", "double", 1)).toEqual({
      needsRecompute: false,
      viewMode: "double",
      zoom: 0.5,
    });
  });

  test("非法 id 返回原状", () => {
    expect(applyZoomPresetId("bogus" as never, "single", 1.2)).toEqual({
      needsRecompute: false,
      viewMode: "single",
      zoom: 1.2,
    });
  });
});
