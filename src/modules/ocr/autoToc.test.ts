import { describe, expect, test } from "vitest";
import {
  buildOutlineTree,
  buildOutlineTreeFromOcrText,
  clusterBySizeAndFont,
  detectChapterHeadings,
  extractTextItems,
  type ChapterHeading,
  type TextItemFeature,
} from "./autoToc";

/** 构造一个模拟 PDF.js textItem，便于在纯函数层测试。 */
function item(
  str: string,
  opts: { height?: number; fontName?: string; x?: number; y?: number; pageIndex?: number } = {},
): TextItemFeature {
  return {
    str,
    height: opts.height ?? 12,
    fontName: opts.fontName ?? "g_font_1",
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    pageIndex: opts.pageIndex ?? 0,
  };
}

describe("extractTextItems", () => {
  test("从 PDF.js textContent 抽取 {str, height, fontName, x, y, pageIndex}", () => {
    const textContent = {
      items: [
        { str: "第一章", transform: [12, 0, 0, 12, 100, 700], height: 12, fontName: "g_font_1" },
        { str: "总则", transform: [18, 0, 0, 18, 100, 750], height: 18, fontName: "g_font_2" },
      ],
    };
    const result = extractTextItems(textContent, { pageIndex: 0 });
    expect(result).toEqual([
      { str: "第一章", height: 12, fontName: "g_font_1", x: 100, y: 700, pageIndex: 0 },
      { str: "总则", height: 18, fontName: "g_font_2", x: 100, y: 750, pageIndex: 0 },
    ]);
  });

  test("忽略缺 str 字段的项（marked content / 不可见项）", () => {
    const textContent = {
      items: [
        { str: "证据一", transform: [12, 0, 0, 12, 100, 700], height: 12, fontName: "g_font_1" },
        { type: "beginMarkedContent", id: "P" } as unknown as Record<string, unknown>,
        { str: "借条", transform: [12, 0, 0, 12, 100, 800], height: 12, fontName: "g_font_1" },
      ],
    };
    const result = extractTextItems(textContent, { pageIndex: 1 });
    expect(result).toHaveLength(2);
    expect(result[0].str).toBe("证据一");
    expect(result[1].str).toBe("借条");
    expect(result[1].pageIndex).toBe(1);
  });

  test("空 textContent 返回空数组", () => {
    expect(extractTextItems({ items: [] }, { pageIndex: 0 })).toEqual([]);
    expect(extractTextItems({}, { pageIndex: 0 })).toEqual([]);
  });

  test("pageIndex 默认 0，可被 options 覆盖", () => {
    const textContent = {
      items: [
        { str: "附件一", transform: [12, 0, 0, 12, 0, 0], height: 12, fontName: "g_font_1" },
      ],
    };
    const result = extractTextItems(textContent, { pageIndex: 5 });
    expect(result[0].pageIndex).toBe(5);
  });
});

describe("clusterBySizeAndFont", () => {
  test("按 height 整数化 + fontName 分组，统计出现次数", () => {
    const items: TextItemFeature[] = [
      item("正文第一段", { height: 12, fontName: "g_body" }),
      item("正文第二段", { height: 12, fontName: "g_body" }),
      item("正文第三段", { height: 12, fontName: "g_body" }),
      item("第一章 总则", { height: 18, fontName: "g_h1" }),
      item("第一节 适用范围", { height: 16, fontName: "g_h2" }),
    ];
    const clusters = clusterBySizeAndFont(items);
    expect(clusters).toHaveLength(3);
    // 按 (高度, 出现次数, 字体名) 排序：高字号标题先
    expect(clusters[0].height).toBe(18);
    expect(clusters[0].count).toBe(1);
    expect(clusters[1].height).toBe(16);
    expect(clusters[2].height).toBe(12);
    expect(clusters[2].count).toBe(3);
  });

  test("height 1pt 之内归为同一字号（律师扫描件字号浮动）", () => {
    const items: TextItemFeature[] = [
      item("A", { height: 12.0, fontName: "g_body" }),
      item("B", { height: 12.3, fontName: "g_body" }),
      item("C", { height: 12.7, fontName: "g_body" }),
    ];
    const clusters = clusterBySizeAndFont(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].height).toBe(12);
    expect(clusters[0].count).toBe(3);
  });

  test("同字号不同字体区分（标题黑体 / 正文宋体）", () => {
    const items: TextItemFeature[] = [
      item("A", { height: 14, fontName: "g_bold" }),
      item("B", { height: 14, fontName: "g_regular" }),
    ];
    const clusters = clusterBySizeAndFont(items);
    expect(clusters).toHaveLength(2);
  });

  test("空输入返回空数组", () => {
    expect(clusterBySizeAndFont([])).toEqual([]);
  });
});

describe("detectChapterHeadings", () => {
  test("识别中文 第X章 模式", () => {
    const items: TextItemFeature[] = [
      item("第一章 总则", { height: 18, fontName: "g_h1" }),
      item("第一条 立法目的", { height: 14, fontName: "g_h2" }),
      item("本法旨在规范...", { height: 12, fontName: "g_body" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe("第一章 总则");
    expect(headings[0].level).toBe(1);
    expect(headings[1].text).toBe("第一条 立法目的");
    expect(headings[1].level).toBe(2);
  });

  test("识别阿拉伯数字编号 1.1 / 1.1.1", () => {
    const items: TextItemFeature[] = [
      item("1. 合同概要", { height: 16, fontName: "g_h1" }),
      item("1.1 背景", { height: 14, fontName: "g_h2" }),
      item("1.1.1 双方当事人", { height: 13, fontName: "g_h3" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toHaveLength(3);
    expect(headings[0].level).toBe(1);
    expect(headings[1].level).toBe(2);
    expect(headings[2].level).toBe(3);
  });

  test("识别证据X / 附件X 律师卷宗模式", () => {
    const items: TextItemFeature[] = [
      item("证据一 借款合同", { height: 14, fontName: "g_h2" }),
      item("证据二 银行流水", { height: 14, fontName: "g_h2" }),
      item("附件一 营业执照", { height: 14, fontName: "g_h2" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toHaveLength(3);
    expect(headings[0].text).toBe("证据一 借款合同");
    expect(headings[2].text).toBe("附件一 营业执照");
  });

  test("混合多级 + 中文括号 (一) (二) 编号", () => {
    const items: TextItemFeature[] = [
      item("第一章 总则", { height: 18, fontName: "g_h1" }),
      item("（一）立法依据", { height: 14, fontName: "g_h3" }),
      item("（二）适用范围", { height: 14, fontName: "g_h3" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toHaveLength(3);
    expect(headings[1].text).toBe("（一）立法依据");
    expect(headings[1].level).toBe(3);
  });

  test("不匹配正文（无章节模式）", () => {
    const items: TextItemFeature[] = [
      item("本法所称合同，是指...", { height: 12, fontName: "g_body" }),
      item("当事人享有以下权利：", { height: 12, fontName: "g_body" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toEqual([]);
  });

  test("空输入返回空数组", () => {
    expect(detectChapterHeadings([])).toEqual([]);
  });

  test("heading 携带 pageIndex / y 坐标（用于 outline 跳转）", () => {
    const items: TextItemFeature[] = [
      item("第二章 义务", { height: 18, fontName: "g_h1", y: 700, pageIndex: 2 }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings[0].pageIndex).toBe(2);
    expect(headings[0].y).toBe(700);
  });

  test("中文数字 + 阿拉伯数字混用都能识别", () => {
    const items: TextItemFeature[] = [
      item("第三章 法律责任", { height: 18, fontName: "g_h1" }),
      item("第3条 具体规定", { height: 14, fontName: "g_h2" }),
    ];
    const headings = detectChapterHeadings(items);
    expect(headings).toHaveLength(2);
  });
});

describe("buildOutlineTree", () => {
  test("扁平列表按 level 嵌套（1.1 嵌在 1 之下）", () => {
    const flat: ChapterHeading[] = [
      { text: "1. 概要", level: 1, pageIndex: 0, y: 700, x: 100 },
      { text: "1.1 背景", level: 2, pageIndex: 0, y: 750, x: 100 },
      { text: "1.1.1 当事人", level: 3, pageIndex: 0, y: 800, x: 100 },
      { text: "2. 条款", level: 1, pageIndex: 1, y: 700, x: 100 },
    ];
    const tree = buildOutlineTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].text).toBe("1. 概要");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].text).toBe("1.1 背景");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].text).toBe("1.1.1 当事人");
    expect(tree[1].text).toBe("2. 条款");
    expect(tree[1].children).toHaveLength(0);
  });

  test("同 level 兄弟：递减 level 后回退到对应祖先", () => {
    const flat: ChapterHeading[] = [
      { text: "1.", level: 1, pageIndex: 0, y: 0, x: 0 },
      { text: "1.1", level: 2, pageIndex: 0, y: 0, x: 0 },
      { text: "1.2", level: 2, pageIndex: 0, y: 0, x: 0 },
      { text: "2.", level: 1, pageIndex: 0, y: 0, x: 0 },
    ];
    const tree = buildOutlineTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[1].children).toHaveLength(0);
  });

  test("跳跃 level（如 1 → 3）不丢：3 作为 1 的子节点", () => {
    const flat: ChapterHeading[] = [
      { text: "1.", level: 1, pageIndex: 0, y: 0, x: 0 },
      { text: "1.1.1", level: 3, pageIndex: 0, y: 0, x: 0 },
    ];
    const tree = buildOutlineTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].level).toBe(3);
  });

  test("空输入返回空数组", () => {
    expect(buildOutlineTree([])).toEqual([]);
  });

  test("单条 heading 也正确包成节点", () => {
    const flat: ChapterHeading[] = [
      { text: "第一章", level: 1, pageIndex: 0, y: 0, x: 0 },
    ];
    const tree = buildOutlineTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe("第一章");
    expect(tree[0].children).toEqual([]);
  });
});

describe("buildOutlineTreeFromOcrText", () => {
  test("OCR 文本（无字号）识别第X章 + 证据X", () => {
    const pages = [
      {
        pageIndex: 0,
        text: "第一章 总则\n第一条 立法目的\n本法旨在规范...",
      },
      {
        pageIndex: 1,
        text: "第二章 义务\n第二条 付款\n证据一 借条\n证据二 银行流水",
      },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree.length).toBeGreaterThanOrEqual(2);
    // 第一章 / 第二章 应该是 root
    const rootTexts = tree.map((n) => n.text);
    expect(rootTexts).toContain("第一章 总则");
    expect(rootTexts).toContain("第二章 义务");
  });

  test("空 pages 返回空树", () => {
    expect(buildOutlineTreeFromOcrText([])).toEqual([]);
  });

  test("单页多章节按行 split", () => {
    const pages = [
      { pageIndex: 0, text: "第一章\n第二章\n第三章" },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.text)).toEqual(["第一章", "第二章", "第三章"]);
  });

  test("跨页 pageIndex 保留", () => {
    const pages = [
      { pageIndex: 2, text: "第一章 概述" },
      { pageIndex: 5, text: "第二章 细节" },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree[0].pageIndex).toBe(2);
    expect(tree[1].pageIndex).toBe(5);
  });

  test("多行混合：识别非章节行忽略", () => {
    const pages = [
      {
        pageIndex: 0,
        text: "这是普通段落。\n第一章 总则\n这是另一段。\n第一条 目的",
      },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe("第一章 总则");
    expect(tree[0].children[0].text).toBe("第一条 目的");
  });

  test("嵌套结构：1.1 / 1.1.1 在 OCR 文本中正确嵌套", () => {
    const pages = [
      { pageIndex: 0, text: "1. 概要\n1.1 背景\n1.1.1 当事人" },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe("1. 概要");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].text).toBe("1.1 背景");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].text).toBe("1.1.1 当事人");
  });

  test("中文括号编号（一）作为 H3 嵌在 H1 下", () => {
    const pages = [
      { pageIndex: 0, text: "第一章 总则\n（一）立法依据\n（二）适用范围" },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe("第一章 总则");
    expect(tree[0].children.length).toBeGreaterThanOrEqual(2);
  });

  test("空白行 / 纯空格行忽略", () => {
    const pages = [
      { pageIndex: 0, text: "\n\n第一章\n   \n\n第二章\n" },
    ];
    const tree = buildOutlineTreeFromOcrText(pages);
    expect(tree).toHaveLength(2);
  });
});
