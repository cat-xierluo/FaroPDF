import { describe, expect, test } from "vitest";
import {
  STAMP_TEMPLATES,
  STAMP_TEMPLATE_LIST,
  STAMP_PREVIEW_VIEWBOX_HEIGHT,
  STAMP_PREVIEW_VIEWBOX_WIDTH,
  renderStampPreview,
  renderStampSvg,
  resolveStampTemplate,
} from "./stamps";

describe("annotation stamp templates", () => {
  test("8 + 1 个内置图章模板都存在并带有默认颜色和文本", () => {
    const ids = [
      "reviewed",
      "important",
      "todo",
      "evidence",
      "forReview",
      "notForDistribution",
      "internalOnly",
      "proprietary",
      "custom",
    ] as const;
    for (const id of ids) {
      const template = STAMP_TEMPLATES[id];
      expect(template.id).toBe(id);
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.defaultLabel.length).toBeGreaterThan(0);
      expect(template.defaultColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(Object.keys(STAMP_TEMPLATES)).toHaveLength(9);
  });

  test("resolveStampTemplate 使用 stamp.label 覆盖默认", () => {
    const resolved = resolveStampTemplate({ name: "reviewed", label: "  已复核  " }, "reviewed");
    expect(resolved.label).toBe("已复核");
  });

  test("resolveStampTemplate 在 stamp.label 为空时回落到模板默认", () => {
    const resolved = resolveStampTemplate({ name: "todo", label: "   " }, "todo");
    expect(resolved.label).toBe("待核");
  });

  test("renderStampSvg 输出 SVG 子树并包含标签文本", () => {
    const svg = renderStampSvg("reviewed", { width: 200, height: 50, label: "已阅" });
    expect(svg).toContain("<rect");
    expect(svg).toContain("已阅");
    expect(svg).toContain(STAMP_TEMPLATES.reviewed.defaultColor);
  });

  test("renderStampSvg 在未指定 label 时回退到模板默认文本", () => {
    const svg = renderStampSvg("important", { width: 200, height: 50 });
    expect(svg).toContain("重点");
  });

  test("renderStampSvg 对 label 做 XML 转义", () => {
    const svg = renderStampSvg("custom", { width: 200, height: 50, label: '<x>"&\'</x>' });
    expect(svg).toContain("&lt;x&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
    expect(svg).toContain("&apos;");
  });

  test("8 + 1 个图章各自使用对应的形状 (rect/rounded/ellipse/banner/diagonal)", () => {
    expect(renderStampSvg("reviewed", { width: 200, height: 50 })).toContain("<rect");                // rectangle
    expect(renderStampSvg("important", { width: 200, height: 50 })).toContain("<ellipse");         // ellipse
    expect(renderStampSvg("todo", { width: 200, height: 50 })).toContain("<rect");              // rounded (rect with rx)
    expect(renderStampSvg("evidence", { width: 200, height: 50 })).toContain("<path");            // banner
    expect(renderStampSvg("forReview", { width: 200, height: 50 })).toContain("<rect");          // rounded (rect with rx)
    expect(renderStampSvg("notForDistribution", { width: 200, height: 50 })).toContain("<polygon"); // diagonal
    expect(renderStampSvg("internalOnly", { width: 200, height: 50 })).toContain("<rect");       // rectangle
    expect(renderStampSvg("proprietary", { width: 200, height: 50 })).toContain("<path");         // banner
    expect(renderStampSvg("custom", { width: 200, height: 50 })).toContain("<rect");              // rounded
  });
});

describe("annotation stamp template preview (ISS-026 stage 4)", () => {
  test("renderStampPreview 输出 5 个模板的非空 SVG 子树", () => {
    for (const template of STAMP_TEMPLATE_LIST) {
      const inner = renderStampPreview(template.id, { label: template.label });
      expect(inner.length).toBeGreaterThan(0);
      // 子树必须含传入的 label（与 renderStampSvg 行为一致：options.label 优先）
      expect(inner).toContain(template.label);
    }
  });

  test("renderStampPreview viewBox 常量与 renderStampSvg 兼容", () => {
    expect(STAMP_PREVIEW_VIEWBOX_WIDTH).toBe(400);
    expect(STAMP_PREVIEW_VIEWBOX_HEIGHT).toBe(100);
  });

  test("renderStampPreview 自定义 label 走 XML 转义", () => {
    const inner = renderStampPreview("reviewed", { label: "<script>&'\"" });
    // < > & " ' 全部转义
    expect(inner).toContain("&lt;script&gt;&amp;&apos;&quot;");
    expect(inner).not.toContain("<script>");
  });

  test("renderStampPreview 颜色可被自定义覆盖", () => {
    const inner = renderStampPreview("reviewed", { color: "#ff00ff" });
    expect(inner).toContain("#ff00ff");
    // 默认绿色不再出现
    expect(inner).not.toContain("#1f7a3a");
  });

  test("renderStampPreview 4 种 shape 几何分别可识别（rect/rounded/ellipse/banner）", () => {
    const rectInner = renderStampPreview("reviewed");
    const roundedInner = renderStampPreview("todo");
    const ellipseInner = renderStampPreview("important");
    const bannerInner = renderStampPreview("evidence");
    // rectangle + rounded 用 <rect>
    expect(rectInner).toContain("<rect");
    expect(roundedInner).toContain("<rect");
    // ellipse 用 <ellipse>
    expect(ellipseInner).toContain("<ellipse");
    // banner 用 <path>
    expect(bannerInner).toContain("<path");
    // 四者都必须含 <text> + label
    for (const inner of [rectInner, roundedInner, ellipseInner, bannerInner]) {
      expect(inner).toContain("<text");
    }
  });
});
