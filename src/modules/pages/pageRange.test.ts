import { describe, expect, test } from "vitest";
import { parsePageRange } from "./pageRange";

describe("ISS-071 m1: parsePageRange DSL", () => {
  test("all → 全部页（0-based）", () => {
    expect(parsePageRange("all", 5)).toEqual([0, 1, 2, 3, 4]);
    expect(parsePageRange("*", 3)).toEqual([0, 1, 2]);
    expect(parsePageRange("ALL", 3)).toEqual([0, 1, 2]); // 大小写不敏感
  });

  test("even / odd → 偶数页 / 奇数页", () => {
    expect(parsePageRange("even", 6)).toEqual([1, 3, 5]); // 1-based [2,4,6] → 0-based [1,3,5]
    expect(parsePageRange("odd", 6)).toEqual([0, 2, 4]); // 1-based [1,3,5] → 0-based [0,2,4]
    expect(parsePageRange("EVEN", 5)).toEqual([1, 3]); // 大小写不敏感
  });

  test("单页 + N → 最后一页", () => {
    expect(parsePageRange("3", 5)).toEqual([2]);
    expect(parsePageRange("N", 5)).toEqual([4]);
    expect(parsePageRange("1", 1)).toEqual([0]); // 单页文档
  });

  test("范围 + 跨 N", () => {
    expect(parsePageRange("1-3", 5)).toEqual([0, 1, 2]);
    expect(parsePageRange("3-N", 5)).toEqual([2, 3, 4]); // 3 到最后
    expect(parsePageRange("N-N", 5)).toEqual([4]);
  });

  test("混合 + 去重 + 排序", () => {
    expect(parsePageRange("1,3-5", 10)).toEqual([0, 2, 3, 4]);
    expect(parsePageRange("5,1,3", 10)).toEqual([0, 2, 4]); // 自动排序
    expect(parsePageRange("1,1,2,2,3", 10)).toEqual([0, 1, 2]); // 去重
    expect(parsePageRange("1-3,2-4", 10)).toEqual([0, 1, 2, 3]); // 范围重叠
  });

  test("反向 !1-3 → 除 1-3 外", () => {
    expect(parsePageRange("!1-3", 5)).toEqual([3, 4]); // 1-based 除 1,2,3 → [4,5] → 0-based [3,4]
    expect(parsePageRange("!2,!4", 5)).toEqual([0, 2, 4]); // 1-based 除 2,4 → [1,3,5]
    expect(parsePageRange("!N", 5)).toEqual([0, 1, 2, 3]); // 除最后一页
  });

  test("混合语义：'!2,4' 是 segment-level → exclude 2 + include 4 = [4]", () => {
    // 注意：'!' 是 segment-level（每个 `,` 分的 segment 独立 ! 或不 !）。
    // 想"反向 [2, 4]" 必须写 "!2,!4"。
    expect(parsePageRange("!2,4", 5)).toEqual([3]); // exclude 2 + include 4 → 0-based [3]
    expect(parsePageRange("1,!2,3", 5)).toEqual([0, 2]); // include 1, exclude 2, include 3 → [1, 3] → 0-based [0, 2]
  });

  test("混合反向（先并集后扣除）", () => {
    expect(parsePageRange("1-5,!3", 5)).toEqual([0, 1, 3, 4]); // 1-5 然后扣除 3
    expect(parsePageRange("1,3-5,!4", 5)).toEqual([0, 2, 4]); // 1,3,4,5 扣除 4 → [1,3,5]
    expect(parsePageRange("all,!even", 6)).toEqual([0, 2, 4]); // 全部扣除偶数 → 奇数
  });

  test("空 / 非法输入抛错", () => {
    expect(() => parsePageRange("", 5)).toThrow(/empty input/);
    expect(() => parsePageRange("   ", 5)).toThrow(/empty input/);
    expect(() => parsePageRange("0", 5)).toThrow(/page must be >= 1|>= 1/);
    expect(() => parsePageRange("6", 5)).toThrow(/> totalPages/);
    expect(() => parsePageRange("3-1", 5)).toThrow(/start > end/);
    expect(() => parsePageRange("1-2-3", 5)).toThrow(/too many "-"/);
    expect(() => parsePageRange("abc", 5)).toThrow(/not a positive integer/);
    expect(() => parsePageRange("!", 5)).toThrow(/"!" without operand/);
  });

  test("totalPages 校验", () => {
    expect(() => parsePageRange("1", 0)).toThrow(/totalPages must be a positive integer/);
    expect(() => parsePageRange("1", -1)).toThrow(/totalPages must be a positive integer/);
    expect(() => parsePageRange("1", 1.5)).toThrow(/totalPages must be a positive integer/);
    expect(() => parsePageRange("1", Number.NaN)).toThrow(/totalPages must be a positive integer/);
  });

  test("边界：单页文档", () => {
    expect(parsePageRange("all", 1)).toEqual([0]);
    expect(parsePageRange("N", 1)).toEqual([0]);
    expect(parsePageRange("odd", 1)).toEqual([0]);
    expect(parsePageRange("even", 1)).toEqual([]); // 单页无偶数
    expect(parsePageRange("!1", 1)).toEqual([]); // 反向单页 = 空
  });

  test("空白处理：segment 前后空格", () => {
    expect(parsePageRange("1, 3 - 5", 10)).toEqual([0, 2, 3, 4]);
    expect(parsePageRange(" 1,3 ", 10)).toEqual([0, 2]);
    expect(parsePageRange("1,,3", 10)).toEqual([0, 2]); // 空 segment 跳过
  });
});
