import { describe, expect, test } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import {
  ANNOTATION_SIDEBAR_COLOR_CHOICES,
  ANNOTATION_SIDEBAR_TYPE_CHOICES,
  applyAnnotationSidebarFilters,
  collectAnnotationLabelChoices,
  deriveAnnotationLabel,
  groupAnnotations,
  groupAnnotationsByColor,
  groupAnnotationsByLabel,
  groupAnnotationsByPage,
  groupAnnotationsByType,
  sidebarFiltersFromSearch,
  sidebarFiltersToSearch,
} from "./sidebarGroups";

function makeAnnotation(overrides: Partial<PdfAnnotation> & { id: string; pageIndex: number }): PdfAnnotation {
  return {
    type: "highlight",
    rects: [{ x: 0, y: 0, width: 100, height: 20 }],
    color: "#f6d66f",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveAnnotationLabel", () => {
  test("图章返回 stamp.label", () => {
    expect(
      deriveAnnotationLabel(
        makeAnnotation({ id: "a", pageIndex: 0, type: "stamp", stamp: { name: "reviewed", label: "已阅" } }),
      ),
    ).toBe("已阅");
  });

  test("非图章回退到 content", () => {
    expect(
      deriveAnnotationLabel(makeAnnotation({ id: "a", pageIndex: 0, type: "note", content: "需要复核" })),
    ).toBe("需要复核");
  });

  test("非图章无 content 时回退到 quote", () => {
    expect(
      deriveAnnotationLabel(makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", quote: "证据原文" })),
    ).toBe("证据原文");
  });

  test("长 content 截断到 20 字", () => {
    const long = "这是一段非常长的批注内容，用于测试标签截断逻辑是否按预期工作";
    expect(deriveAnnotationLabel(makeAnnotation({ id: "a", pageIndex: 0, type: "note", content: long })))
      .toBe("这是一段非常长的批注内容，用于测试标签截断逻辑是…");
  });

  test("既无 content 也无 quote 也无 stamp.label 返回 null", () => {
    expect(deriveAnnotationLabel(makeAnnotation({ id: "a", pageIndex: 0, type: "rectangle" }))).toBeNull();
  });
});

describe("groupAnnotationsByPage", () => {
  test("按页码升序分组，标题是 1-based 页码", () => {
    const a = makeAnnotation({ id: "a", pageIndex: 2 });
    const b = makeAnnotation({ id: "b", pageIndex: 0 });
    const c = makeAnnotation({ id: "c", pageIndex: 0 });
    const groups = groupAnnotationsByPage([a, b, c]);
    expect(groups.map((g) => g.title)).toEqual(["第 1 页", "第 3 页"]);
    expect(groups[0].annotations).toEqual([b, c]);
    expect(groups[1].annotations).toEqual([a]);
  });

  test("空数组返回空", () => {
    expect(groupAnnotationsByPage([])).toEqual([]);
  });
});

describe("groupAnnotationsByColor", () => {
  test("按颜色 hex 归一化分组，命中色板带 label", () => {
    const yellow = makeAnnotation({ id: "a", pageIndex: 0, color: "#F6D66F" });
    const blue = makeAnnotation({ id: "b", pageIndex: 0, color: "#2f80ed" });
    const groups = groupAnnotationsByColor([yellow, blue]);
    expect(groups.map((g) => g.title)).toEqual(["黄（f6d66f）", "蓝（2f80ed）"]);
  });

  test("未知颜色归到 '其他颜色'", () => {
    const weird = makeAnnotation({ id: "a", pageIndex: 0, color: "#abcdef" });
    const yellow = makeAnnotation({ id: "b", pageIndex: 0, color: "#f6d66f" });
    const groups = groupAnnotationsByColor([weird, yellow]);
    expect(groups.at(-1)?.title).toBe("其他颜色");
  });
});

describe("groupAnnotationsByType", () => {
  test("9 种类型按字母排序分组", () => {
    const annotations = ANNOTATION_SIDEBAR_TYPE_CHOICES.map((choice, index) =>
      makeAnnotation({ id: `a-${index}`, pageIndex: 0, type: choice.id }),
    );
    const groups = groupAnnotationsByType(annotations);
    expect(groups).toHaveLength(9);
    expect(groups[0].title).toBe("高亮");
    expect(groups.map((g) => g.key).sort()).toEqual(
      ["arrow", "highlight", "ink", "note", "rectangle", "stamp", "strikeout", "textbox", "underline"].sort(),
    );
  });
});

describe("groupAnnotationsByLabel", () => {
  test("按 stamp.label 分组，无标签的归 '无标签'", () => {
    const stampA = makeAnnotation({
      id: "a",
      pageIndex: 0,
      type: "stamp",
      stamp: { name: "reviewed", label: "已阅" },
    });
    const stampB = makeAnnotation({
      id: "b",
      pageIndex: 0,
      type: "stamp",
      stamp: { name: "important", label: "重点" },
    });
    const rect = makeAnnotation({ id: "c", pageIndex: 0, type: "rectangle" });
    const groups = groupAnnotationsByLabel([stampA, stampB, rect]);
    const titles = groups.map((g) => g.title).sort();
    expect(titles).toEqual(["已阅", "无标签", "重点"]);
  });
});

describe("groupAnnotations 通用入口", () => {
  const stamp = makeAnnotation({
    id: "a",
    pageIndex: 1,
    type: "stamp",
    stamp: { name: "reviewed", label: "已阅" },
  });
  const note = makeAnnotation({ id: "b", pageIndex: 0, type: "note", content: "需要复核" });
  const annotations = [stamp, note];

  test("groupBy=page 走 page 分组", () => {
    expect(groupAnnotations(annotations, "page").map((g) => g.title)).toEqual(["第 1 页", "第 2 页"]);
  });

  test("groupBy=label 走 label 分组", () => {
    expect(groupAnnotations(annotations, "label").map((g) => g.title)).toEqual(["已阅", "需要复核"]);
  });
});

describe("applyAnnotationSidebarFilters", () => {
  const stampReviewed = makeAnnotation({
    id: "a",
    pageIndex: 0,
    type: "stamp",
    color: "#f6d66f",
    stamp: { name: "reviewed", label: "已阅" },
  });
  const noteBlue = makeAnnotation({
    id: "b",
    pageIndex: 0,
    type: "note",
    color: "#2f80ed",
    content: "需要复核",
  });
  const highlightRed = makeAnnotation({
    id: "c",
    pageIndex: 1,
    type: "highlight",
    color: "#d14d4d",
    content: "关键证据",
  });
  const annotations = [stampReviewed, noteBlue, highlightRed];

  test("query 命中 content", () => {
    const result = applyAnnotationSidebarFilters(annotations, { query: "复核" });
    expect(result.map((a) => a.id)).toEqual(["b"]);
  });

  test("types 命中 type", () => {
    const result = applyAnnotationSidebarFilters(annotations, { types: ["highlight"] });
    expect(result.map((a) => a.id)).toEqual(["c"]);
  });

  test("colors 命中颜色（不区分大小写）", () => {
    const result = applyAnnotationSidebarFilters(annotations, { colors: ["#F6D66F"] });
    expect(result.map((a) => a.id)).toEqual(["a"]);
  });

  test("colors 多选 OR 命中", () => {
    const result = applyAnnotationSidebarFilters(annotations, { colors: ["#2f80ed", "#d14d4d"] });
    expect(result.map((a) => a.id).sort()).toEqual(["b", "c"]);
  });

  test("pageNumbers 命中 1-based 页码", () => {
    const result = applyAnnotationSidebarFilters(annotations, { pageNumbers: [1] });
    expect(result.map((a) => a.id).sort()).toEqual(["a", "b"]);
  });

  test("labels 命中图章 label", () => {
    const result = applyAnnotationSidebarFilters(annotations, { labels: ["已阅"] });
    expect(result.map((a) => a.id)).toEqual(["a"]);
  });

  test("多 chip 维度之间 AND", () => {
    const result = applyAnnotationSidebarFilters(annotations, {
      colors: ["#2f80ed"],
      types: ["note"],
    });
    expect(result.map((a) => a.id)).toEqual(["b"]);
  });

  test("空筛选条件返回全部", () => {
    const result = applyAnnotationSidebarFilters(annotations, {});
    expect(result).toHaveLength(3);
  });

  test("labels 过滤会排除无标签批注", () => {
    const result = applyAnnotationSidebarFilters([highlightRed, noteBlue], { labels: ["需要复核"] });
    expect(result.map((a) => a.id)).toEqual(["b"]);
  });
});

describe("collectAnnotationLabelChoices", () => {
  test("去重保序", () => {
    const annotations = [
      makeAnnotation({ id: "a", pageIndex: 0, type: "stamp", stamp: { name: "reviewed", label: "已阅" } }),
      makeAnnotation({ id: "b", pageIndex: 0, type: "stamp", stamp: { name: "important", label: "重点" } }),
      makeAnnotation({ id: "c", pageIndex: 0, type: "stamp", stamp: { name: "reviewed", label: "已阅" } }),
      makeAnnotation({ id: "d", pageIndex: 0, type: "rectangle" }),
    ];
    expect(collectAnnotationLabelChoices(annotations)).toEqual(["已阅", "重点"]);
  });
});

describe("sidebarFiltersFromSearch / ToSearch", () => {
  test("把 search options 转侧边栏 filters", () => {
    const filters = sidebarFiltersFromSearch(
      { query: "x", types: ["highlight"], pageNumbers: [1], color: "#f6d66f" },
      { labels: ["已阅"] },
    );
    expect(filters).toEqual({
      query: "x",
      types: ["highlight"],
      pageNumbers: [1],
      colors: ["#f6d66f"],
      labels: ["已阅"],
    });
  });

  test("把侧边栏 filters 转 search options（单 colors 退化为 color 字段）", () => {
    const options = sidebarFiltersToSearch({
      query: "x",
      types: ["highlight"],
      pageNumbers: [1],
      colors: ["#f6d66f"],
    });
    expect(options).toEqual({
      query: "x",
      types: ["highlight"],
      pageNumbers: [1],
      color: "#f6d66f",
    });
  });

  test("colors 多个时不退化为 color", () => {
    const options = sidebarFiltersToSearch({ colors: ["#f6d66f", "#2f80ed"] });
    expect(options.color).toBeUndefined();
    expect(options).toEqual({});
  });
});

describe("ANNOTATION_SIDEBAR_COLOR_CHOICES / TYPE_CHOICES", () => {
  test("颜色色板来自 toolbarModel，6 个", () => {
    expect(ANNOTATION_SIDEBAR_COLOR_CHOICES).toHaveLength(6);
    expect(ANNOTATION_SIDEBAR_COLOR_CHOICES[0]).toMatchObject({ id: "yellow", value: "#f6d66f", label: "黄" });
  });

  test("类型 chip 9 个，顺序固定", () => {
    expect(ANNOTATION_SIDEBAR_TYPE_CHOICES.map((c) => c.id)).toEqual([
      "highlight",
      "underline",
      "strikeout",
      "note",
      "textbox",
      "rectangle",
      "arrow",
      "ink",
      "stamp",
    ]);
  });
});
