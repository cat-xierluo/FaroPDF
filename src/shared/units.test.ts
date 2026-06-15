import { describe, expect, test } from "vitest";
import { convertLength, type Unit } from "./units";

describe("ISS-071 m2: convertLength", () => {
  test("同单位 = 原值", () => {
    expect(convertLength(72, "pt", "pt")).toBe(72);
    expect(convertLength(2.54, "cm", "cm")).toBe(2.54);
    expect(convertLength(25.4, "mm", "mm")).toBe(25.4);
    expect(convertLength(1, "in", "in")).toBe(1);
  });

  test("pt ↔ in", () => {
    expect(convertLength(72, "pt", "in")).toBeCloseTo(1, 6);
    expect(convertLength(1, "in", "pt")).toBeCloseTo(72, 6);
    expect(convertLength(144, "pt", "in")).toBeCloseTo(2, 6);
  });

  test("in ↔ cm", () => {
    expect(convertLength(1, "in", "cm")).toBeCloseTo(2.54, 6);
    expect(convertLength(2.54, "cm", "in")).toBeCloseTo(1, 6);
  });

  test("in ↔ mm", () => {
    expect(convertLength(1, "in", "mm")).toBeCloseTo(25.4, 6);
    expect(convertLength(25.4, "mm", "in")).toBeCloseTo(1, 6);
  });

  test("cm ↔ mm", () => {
    expect(convertLength(1, "cm", "mm")).toBeCloseTo(10, 6);
    expect(convertLength(10, "mm", "cm")).toBeCloseTo(1, 6);
  });

  test("pt ↔ cm", () => {
    expect(convertLength(72, "pt", "cm")).toBeCloseTo(2.54, 6);
    expect(convertLength(2.54, "cm", "pt")).toBeCloseTo(72, 6);
  });

  test("pt ↔ mm", () => {
    expect(convertLength(72, "pt", "mm")).toBeCloseTo(25.4, 6);
    expect(convertLength(25.4, "mm", "pt")).toBeCloseTo(72, 6);
  });

  test("边界：0", () => {
    expect(convertLength(0, "pt", "cm")).toBe(0);
    expect(convertLength(0, "in", "mm")).toBe(0);
  });

  test("边界：负值（合法用于偏移量）", () => {
    expect(convertLength(-72, "pt", "in")).toBeCloseTo(-1, 6);
    expect(convertLength(-2.54, "cm", "in")).toBeCloseTo(-1, 6);
  });

  test("非法 value（NaN / Infinity）抛错", () => {
    expect(() => convertLength(Number.NaN, "pt", "cm")).toThrow(/value must be a finite number/);
    expect(() => convertLength(Number.POSITIVE_INFINITY, "pt", "cm")).toThrow(/finite/);
    expect(() => convertLength(Number.NEGATIVE_INFINITY, "pt", "cm")).toThrow(/finite/);
  });

  test("非法 unit 抛错", () => {
    // @ts-expect-error 故意传非法单位测试运行时校验
    expect(() => convertLength(1, "foo", "pt")).toThrow(/Invalid unit: from/);
    // @ts-expect-error 故意传非法单位测试运行时校验
    expect(() => convertLength(1, "pt", "bar")).toThrow(/Invalid unit: to/);
  });

  test("12 种互转矩阵（精度 4 位小数）", () => {
    const units: Unit[] = ["pt", "cm", "mm", "in"];
    // 1 inch 在所有单位下的等价值
    const oneInch: Record<Unit, number> = {
      pt: 72,
      in: 1,
      cm: 2.54,
      mm: 25.4,
    };
    for (const from of units) {
      for (const to of units) {
        const result = convertLength(oneInch[from], from, to);
        expect(result).toBeCloseTo(oneInch[to], 4);
      }
    }
  });
});
