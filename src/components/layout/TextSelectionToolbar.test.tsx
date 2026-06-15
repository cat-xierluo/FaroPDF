import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

describe("TextSelectionToolbar (ISS-061 stage 1: render contract)", () => {
  test("bounds 为 null 时不渲染任何节点", () => {
    const { container } = render(
      <TextSelectionToolbar bounds={null} onAction={() => undefined} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("bounds 提供时渲染 7 个动作：5 启用 + 2 disabled 占位", () => {
    const handler = () => undefined;
    render(
      <TextSelectionToolbar
        bounds={{ bottom: 200, left: 100, right: 400, top: 150 }}
        onAction={handler}
        onClose={handler}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(7);
    const labels = buttons.map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "对选中文本应用高亮批注",
      "对选中文本应用下划线批注",
      "对选中文本应用删除线批注",
      "在选中文本旁添加便签",
      "复制选中文本到剪贴板",
      "翻译（v0.2 候选）",
      "朗读（v0.2 候选）",
    ]);
    // 翻译 / 朗读应当 disabled
    const disabled = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(disabled).toHaveLength(2);
  });

  test("点击启用动作后回调正确", () => {
    let captured: string | null = null;
    render(
      <TextSelectionToolbar
        bounds={{ bottom: 200, left: 100, right: 400, top: 150 }}
        onAction={(a) => {
          captured = a;
        }}
        onClose={() => undefined}
      />,
    );
    const highlightButton = screen.getByText("高亮");
    highlightButton.click();
    expect(captured).toBe("annotate-highlight");
  });

  test("点击 disabled 占位（翻译 / 朗读）不触发回调", () => {
    let count = 0;
    render(
      <TextSelectionToolbar
        bounds={{ bottom: 200, left: 100, right: 400, top: 150 }}
        onAction={() => {
          count += 1;
        }}
        onClose={() => undefined}
      />,
    );
    screen.getByText("翻译").click();
    screen.getByText("朗读").click();
    expect(count).toBe(0);
  });
});
