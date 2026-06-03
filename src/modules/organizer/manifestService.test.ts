import { describe, expect, test } from "vitest";
import { createDocumentManifest } from "./manifestService";

const FIXED_TIME = "2026-06-03T00:00:00.000Z";

describe("document manifest service", () => {
  test("throws on empty pageTexts", () => {
    expect(() => createDocumentManifest({ pageTexts: [] })).toThrow("manifest 输入校验失败");
  });

  test("throws on non-string pageTexts entries", () => {
    expect(() =>
      createDocumentManifest({ pageTexts: [123 as unknown as string] }),
    ).toThrow("manifest 输入校验失败");
  });

  test("creates manifest for a single page document", () => {
    const text = "这是一份合同的正文内容，用于测试单页文档。";
    const manifest = createDocumentManifest({
      pageTexts: [text],
      id: "single-page-manifest",
      createdAt: FIXED_TIME,
    });

    expect(manifest.id).toBe("single-page-manifest");
    expect(manifest.createdAt).toBe(FIXED_TIME);
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.pages[0]).toEqual({
      pageIndex: 0,
      textSnippet: "这是一份合同的正文内容，用于测试单页文档。",
      textLength: text.length,
      detectedBoundaries: [],
    });
    expect(manifest.suggestedBoundaries).toHaveLength(0);
    expect(manifest.suggestedNames).toHaveLength(1);
    expect(manifest.suggestedNames[0]).toEqual({
      startPage: 0,
      endPage: 0,
      suggestedName: "这是一份合同的正文内容，用于测试单页文档。",
      confidence: 0.7,
    });
  });

  test("creates manifest for multi-page continuous text without boundaries", () => {
    const text1 = "这是第一页的正文内容，讲述了一个完整的法律故事。";
    const text2 = "这是第二页，继续上一页的内容，没有明显的文书边界。";
    const text3 = "第三页也是连续内容，文本长度相近。";
    const pageTexts = [text1, text2, text3];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    expect(manifest.pages).toHaveLength(3);
    expect(manifest.pages[0].textLength).toBe(text1.length);
    expect(manifest.pages[1].textLength).toBe(text2.length);
    expect(manifest.pages[2].textLength).toBe(text3.length);
    // 三页文本长度相近，不应检测到边界
    expect(manifest.suggestedBoundaries).toHaveLength(0);
    // 只有一个命名建议覆盖全部页
    expect(manifest.suggestedNames).toHaveLength(1);
    expect(manifest.suggestedNames[0]).toEqual({
      startPage: 0,
      endPage: 2,
      suggestedName: expect.any(String),
      confidence: 0.7,
    });
  });

  test("detects boundaries at blank pages", () => {
    const pageTexts = [
      "合同 A 的全部内容，包含详细条款。",
      "", // 空白页
      "合同 B 的全部内容，这是另一份独立的文书。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 空白页（第1页）前面产生边界 betweenPageIndex=0（blank-page 信号）
    // 第1→2页文本从空白到有内容也会产生 betweenPageIndex=1（text-length-increase 信号）
    expect(manifest.suggestedBoundaries.length).toBeGreaterThanOrEqual(1);

    const blankBoundary = manifest.suggestedBoundaries.find((b) =>
      b.betweenPageIndex === 0 && b.signals.includes("blank-page"),
    );
    expect(blankBoundary).toBeDefined();
    expect(blankBoundary!.confidence).toBeGreaterThanOrEqual(0.85);

    // 命名建议根据所有边界分段
    expect(manifest.suggestedNames.length).toBeGreaterThanOrEqual(2);
  });

  test("detects boundaries at near-blank pages", () => {
    const pageTexts = [
      "这是一份起诉状正文内容，包含了详细的诉讼请求和事实理由。",
      "页", // 极少文字（1 字），视为空白页
      "答辩状正文内容，被告针对原告的诉讼请求进行答辩。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 第1页只有 1 字，视为空白页，边界在 betweenPageIndex=0
    expect(manifest.suggestedBoundaries.length).toBeGreaterThanOrEqual(1);
    const blankBoundary = manifest.suggestedBoundaries.find((b) => b.signals.includes("blank-page"));
    expect(blankBoundary).toBeDefined();
    expect(blankBoundary!.betweenPageIndex).toBe(0);
  });

  test("detects boundaries at text length changes", () => {
    const shortText = "短";
    const longText = "这是一段非常长的文本内容，用来测试文本长度剧变检测功能是否正常工作。这段文字需要足够长以触发阈值。";

    const pageTexts = [longText, shortText, longText];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 第0页到第1页有剧变（长→短），第1页到第2页有剧变（短→长）
    expect(manifest.suggestedBoundaries.length).toBeGreaterThanOrEqual(1);
    const hasLengthSignals = manifest.suggestedBoundaries.some(
      (b) => b.signals.includes("text-length-decrease") || b.signals.includes("text-length-increase"),
    );
    expect(hasLengthSignals).toBe(true);
  });

  test("generates naming suggestions from first page content", () => {
    const pageTexts = [
      "民事起诉状\n\n原告张三，被告李四。",
      "证据材料清单：1. 合同原件；2. 转账凭证。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    expect(manifest.suggestedNames).toHaveLength(1);
    expect(manifest.suggestedNames[0].suggestedName).toBe("民事起诉状 原告张三，被告李四。");
    expect(manifest.suggestedNames[0].confidence).toBe(0.7);
  });

  test("uses default name for empty content segments", () => {
    const pageTexts = ["", "", ""];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 第0页不产生边界（i=0, i>0 不满足）
    // 第1页空白产生边界(betweenPageIndex=0)，第2页空白产生边界(betweenPageIndex=1)
    expect(manifest.suggestedNames.length).toBeGreaterThanOrEqual(1);
    // 所有分段都是空白，命名应全是"未命名文书"
    for (const suggestion of manifest.suggestedNames) {
      expect(suggestion.suggestedName).toBe("未命名文书");
      expect(suggestion.confidence).toBe(0.3);
    }
  });

  test("truncates long document names at punctuation", () => {
    const longText = "这是一份非常长的文书标题，包含了大量的描述性文字，用于测试截断功能是否在标点符号处正确断开，确保命名建议的可读性。";
    const manifest = createDocumentManifest({
      pageTexts: [longText],
      createdAt: FIXED_TIME,
    });

    const name = manifest.suggestedNames[0].suggestedName;
    expect(name.length).toBeLessThan(longText.length);
    expect(name.length).toBeGreaterThan(0);
  });

  test("generates correct page snippets and lengths", () => {
    const pageTexts = [
      "第一页内容",
      "   第二页有前导空白   ",
      "第三页\n有换行",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    expect(manifest.pages[0].textLength).toBe(5); // "第一页内容"
    expect(manifest.pages[0].textSnippet).toBe("第一页内容");

    expect(manifest.pages[1].textLength).toBe("   第二页有前导空白   ".length);
    expect(manifest.pages[1].textSnippet).toBe("第二页有前导空白");

    expect(manifest.pages[2].textLength).toBe("第三页\n有换行".length);
    expect(manifest.pages[2].textSnippet).toBe("第三页 有换行");
  });

  test("auto-generates id and createdAt when not provided", () => {
    const manifest = createDocumentManifest({
      pageTexts: ["测试文本内容"],
    });

    expect(manifest.id).toMatch(/^doc-manifest-/);
    expect(manifest.createdAt).toBeTruthy();
  });

  test("splits documents at multiple blank pages", () => {
    const pageTexts = [
      "合同 A 内容，包含甲方和乙方的权利义务条款。",
      "",         // 空白页
      "合同 B 内容，这是买卖合同的正文部分。",
      "合同 B 续页，继续列明附则和补充条款。",
      "",         // 空白页
      "合同 C 内容，这是租赁合同的正文内容。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 两处空白页分别产生边界
    const blankBoundaries = manifest.suggestedBoundaries.filter((b) => b.signals.includes("blank-page"));
    expect(blankBoundaries.length).toBeGreaterThanOrEqual(2);

    // 第一处空白页边界在 betweenPageIndex=0
    expect(blankBoundaries[0].betweenPageIndex).toBe(0);
    // 第二处空白页边界在 betweenPageIndex=3
    expect(blankBoundaries[1].betweenPageIndex).toBe(3);

    // 至少三段命名建议
    expect(manifest.suggestedNames.length).toBeGreaterThanOrEqual(3);
  });

  test("associates boundaries to adjacent pages", () => {
    const pageTexts = [
      "文书内容，这是一段有实质意义的法律文本。",
      "",
      "另一文书，包含不同的法律事实和主张。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // 至少有 blank-page 边界在 betweenPageIndex=0
    const blankBoundary = manifest.suggestedBoundaries.find((b) => b.signals.includes("blank-page"));
    expect(blankBoundary).toBeDefined();
    expect(blankBoundary!.betweenPageIndex).toBe(0);

    // 第0页和第1页关联了此边界
    const boundaryIndex = manifest.suggestedBoundaries.indexOf(blankBoundary!);
    expect(manifest.pages[0].detectedBoundaries).toContain(boundaryIndex);
    expect(manifest.pages[1].detectedBoundaries).toContain(boundaryIndex);
  });

  test("handles mix of blank-page and text-length-change signals", () => {
    const pageTexts = [
      "这是一段中等长度的文本内容，不算太长也不算太短。",
      "",         // 空白页
      "这是一段很长的文本内容，应该能够触发文本长度剧变检测功能的正常工作。这段文字需要足够长。",
    ];

    const manifest = createDocumentManifest({
      pageTexts,
      createdAt: FIXED_TIME,
    });

    // betweenPageIndex=0: 空白页 blank-page 信号 + text-length-decrease 信号
    const boundary0 = manifest.suggestedBoundaries.find((b) => b.betweenPageIndex === 0);
    expect(boundary0).toBeDefined();
    expect(boundary0!.signals).toContain("blank-page");

    // betweenPageIndex=1: 从空白到长文本，text-length-increase 信号
    const boundary1 = manifest.suggestedBoundaries.find((b) => b.betweenPageIndex === 1);
    expect(boundary1).toBeDefined();
    expect(boundary1!.signals).toContain("text-length-increase");
  });
});
