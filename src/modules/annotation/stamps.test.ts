import { describe, expect, test } from "vitest";
import {
  STAMP_TEMPLATES,
  renderStampSvg,
  resolveStampTemplate,
} from "./stamps";

describe("annotation stamp templates", () => {
  test("5 个内置图章模板都存在并带有默认颜色和文本", () => {
    const ids = ["reviewed", "important", "todo", "evidence", "custom"] as const;
    for (const id of ids) {
      const template = STAMP_TEMPLATES[id];
      expect(template.id).toBe(id);
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.defaultLabel.length).toBeGreaterThan(0);
      expect(template.defaultColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
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

  test("5 个图章各自使用不同的形状", () => {
    expect(renderStampSvg("reviewed", { width: 200, height: 50 })).toContain("<rect");
    expect(renderStampSvg("important", { width: 200, height: 50 })).toContain("<ellipse");
    expect(renderStampSvg("todo", { width: 200, height: 50 })).toContain("<rect");
    expect(renderStampSvg("evidence", { width: 200, height: 50 })).toContain("<path");
    expect(renderStampSvg("custom", { width: 200, height: 50 })).toContain("<rect");
  });
});
