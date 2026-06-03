import { describe, expect, test } from "vitest";
import {
  collectAnnotationSearchHaystack,
  matchesColorFilter,
  matchesPageFilter,
  matchesQuery,
  matchesTypeFilter,
  searchAnnotations,
} from "./search";
import type { PdfAnnotation } from "../../shared/pdf/annotation";

function makeAnnotation(overrides: Partial<PdfAnnotation> & { id: string; type: PdfAnnotation["type"]; pageIndex: number }): PdfAnnotation {
  return {
    id: overrides.id,
    type: overrides.type,
    pageIndex: overrides.pageIndex,
    rects: overrides.rects ?? [{ x: 0, y: 0, width: 10, height: 10 }],
    color: overrides.color ?? "#f6d66f",
    ...(overrides.content ? { content: overrides.content } : {}),
    ...(overrides.quote ? { quote: overrides.quote } : {}),
    ...(overrides.author ? { author: overrides.author } : {}),
    ...(overrides.stamp ? { stamp: overrides.stamp } : {}),
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const annotations: PdfAnnotation[] = [
  makeAnnotation({
    id: "ann-1",
    type: "highlight",
    pageIndex: 0,
    content: "重点条款",
    quote: "甲方应于三日内付款",
    color: "#f6d66f",
  }),
  makeAnnotation({
    id: "ann-2",
    type: "note",
    pageIndex: 1,
    content: "核对原件",
    color: "#f2b84b",
    author: { id: "u1", displayName: "李律师" },
  }),
  makeAnnotation({
    id: "ann-3",
    type: "stamp",
    pageIndex: 1,
    color: "#b7791f",
    stamp: { name: "reviewed", label: "已阅" },
  }),
  makeAnnotation({
    id: "ann-4",
    type: "rectangle",
    pageIndex: 2,
    color: "#6c5ce7",
    content: "红框提醒",
  }),
];

describe("annotation search utilities", () => {
  test("collectAnnotationSearchHaystack 拼出可搜索的字符串", () => {
    const haystack = collectAnnotationSearchHaystack(annotations[0]);
    expect(haystack).toContain("highlight");
    expect(haystack).toContain("重点条款");
    expect(haystack).toContain("甲方应于三日内付款");
  });

  test("matchesQuery 不区分大小写并忽略首尾空白", () => {
    expect(matchesQuery(annotations[0], "  重点  ")).toBe(true);
    expect(matchesQuery(annotations[0], "重点条款")).toBe(true);
    expect(matchesQuery(annotations[0], "未命中")).toBe(false);
  });

  test("matchesQuery 对 author.displayName 生效", () => {
    expect(matchesQuery(annotations[1], "李律师")).toBe(true);
  });

  test("matchesQuery 对 stamp.label 生效", () => {
    expect(matchesQuery(annotations[2], "已阅")).toBe(true);
  });

  test("matchesQuery 在 query 为空/undefined 时视为全命中", () => {
    expect(matchesQuery(annotations[0], undefined)).toBe(true);
    expect(matchesQuery(annotations[0], "")).toBe(true);
    expect(matchesQuery(annotations[0], "  ")).toBe(true);
  });

  test("matchesTypeFilter 按类型筛选", () => {
    expect(matchesTypeFilter(annotations[0], ["highlight"])).toBe(true);
    expect(matchesTypeFilter(annotations[0], ["note"])).toBe(false);
    expect(matchesTypeFilter(annotations[0], undefined)).toBe(true);
    expect(matchesTypeFilter(annotations[0], [])).toBe(true);
  });

  test("matchesPageFilter 按页码筛选（1-based）", () => {
    expect(matchesPageFilter(annotations[0], [1])).toBe(true);
    expect(matchesPageFilter(annotations[0], [2])).toBe(false);
    expect(matchesPageFilter(annotations[0], undefined)).toBe(true);
  });

  test("matchesColorFilter 不区分大小写、忽略 #", () => {
    expect(matchesColorFilter(annotations[0], "#F6D66F")).toBe(true);
    expect(matchesColorFilter(annotations[0], "f6d66f")).toBe(true);
    expect(matchesColorFilter(annotations[0], undefined)).toBe(true);
    expect(matchesColorFilter(annotations[0], "#000000")).toBe(false);
  });

  test("searchAnnotations 综合所有筛选条件并按页/时间排序", () => {
    const result = searchAnnotations(annotations, { query: "已阅" });
    expect(result.map((annotation) => annotation.id)).toEqual(["ann-3"]);

    const byPage = searchAnnotations(annotations, { pageNumbers: [1, 2] });
    expect(byPage.map((annotation) => annotation.id)).toEqual(["ann-1", "ann-2", "ann-3"]);

    const byType = searchAnnotations(annotations, { types: ["highlight", "rectangle"] });
    expect(byType.map((annotation) => annotation.id)).toEqual(["ann-1", "ann-4"]);

    const combined = searchAnnotations(annotations, { types: ["note", "stamp"], pageNumbers: [2] });
    expect(combined.map((annotation) => annotation.id)).toEqual(["ann-2", "ann-3"]);

    const noMatch = searchAnnotations(annotations, { types: ["note", "stamp"], pageNumbers: [3] });
    expect(noMatch).toEqual([]);
  });
});
