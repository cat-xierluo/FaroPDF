import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createDefaultAppSettings } from "../../../shared/settings/defaults";
import { ShortcutSection } from "./ShortcutSection";

describe("ShortcutSection", () => {
  test("renders shortcut groups and key descriptions", () => {
    render(<ShortcutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);

    expect(screen.getByText("阅读翻页")).toBeInTheDocument();
    expect(screen.getByText("缩放与旋转")).toBeInTheDocument();
    expect(screen.getByText("工具切换")).toBeInTheDocument();

    expect(screen.getByText(/PageDown/)).toBeInTheDocument();
    expect(screen.getByText("跳到第一页")).toBeInTheDocument();
  });

  test("does not accept settings changes (display only)", () => {
    render(<ShortcutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    // 没有可交互控件；input / button 数量为 0
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
