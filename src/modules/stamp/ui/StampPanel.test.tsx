import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StampPanel } from "./StampPanel";
import { STAMP_TEMPLATE_LIST } from "../../annotation";
import type { PdfStampName } from "../../../shared/pdf/annotation";

describe("StampPanel (ISS-NEW-N-P04)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("默认标准 tab：渲染标准/自定义 tab + 9 个标准模板预设", () => {
    const onSelectStandardStamp = vi.fn();
    const onSelectCustomStamp = vi.fn();
    render(
      <StampPanel
        onSelectStandardStamp={onSelectStandardStamp}
        onSelectCustomStamp={onSelectCustomStamp}
      />,
    );

    // tab 存在
    expect(screen.getByRole("tab", { name: "标准" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "自定义" })).toHaveAttribute("aria-selected", "false");

    // 标准 tab 渲染 9 个预设按钮（每个 aria-label "选择图章: <label>"）
    for (const template of STAMP_TEMPLATE_LIST) {
      expect(screen.getByRole("button", { name: `选择图章: ${template.label}` })).toBeInTheDocument();
    }
  });

  test("标准 tab 点击预设触发 onSelectStandardStamp + 选中蓝描边 className", () => {
    const onSelectStandardStamp = vi.fn();
    render(
      <StampPanel
        onSelectStandardStamp={onSelectStandardStamp}
        onSelectCustomStamp={() => undefined}
      />,
    );

    const firstTemplate = STAMP_TEMPLATE_LIST[0];
    const btn = screen.getByRole("button", { name: `选择图章: ${firstTemplate.label}` });
    expect(btn).not.toHaveClass("stamp-panel__preset--selected");

    fireEvent.click(btn);
    expect(onSelectStandardStamp).toHaveBeenCalledWith(firstTemplate.id);
  });

  test("selectedStandardName 高亮对应预设", () => {
    const target: PdfStampName = "important";
    render(
      <StampPanel
        onSelectStandardStamp={() => undefined}
        onSelectCustomStamp={() => undefined}
        selectedStandardName={target}
      />,
    );

    const targetTemplate = STAMP_TEMPLATE_LIST.find((t) => t.id === target)!;
    const targetBtn = screen.getByRole("button", { name: `选择图章: ${targetTemplate.label}` });
    expect(targetBtn).toHaveClass("stamp-panel__preset--selected");
    expect(targetBtn).toHaveAttribute("aria-pressed", "true");

    // 其他预设不选中
    const otherTemplate = STAMP_TEMPLATE_LIST.find((t) => t.id !== target)!;
    const otherBtn = screen.getByRole("button", { name: `选择图章: ${otherTemplate.label}` });
    expect(otherBtn).not.toHaveClass("stamp-panel__preset--selected");
  });

  test("切到自定义 tab：标准预设消失，渲染 CustomStampPanel 上传入口", () => {
    render(
      <StampPanel
        onSelectStandardStamp={() => undefined}
        onSelectCustomStamp={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "自定义" }));
    expect(screen.getByRole("tab", { name: "自定义" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "标准" })).toHaveAttribute("aria-selected", "false");

    // 标准预设不再渲染
    expect(screen.queryByTestId("stamp-panel-standard-grid")).not.toBeInTheDocument();
    // CustomStampPanel 的上传入口出现
    expect(screen.getByTestId("custom-stamp-panel-upload")).toBeInTheDocument();
  });
});
