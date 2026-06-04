import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ZoomPresetId } from "../../shared/pdf/types";
import { ZOOM_PRESETS } from "../../shared/pdf/types";
import { ViewSettingsPanel } from "./Sidebar";

describe("ViewSettingsPanel 阅读深化", () => {
  test("渲染 4 个视图模式按钮：连续 / 单页 / 双页 / 适合宽度", () => {
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="continuous"
      />,
    );

    const grid = screen.getByTestId("view-mode-grid");
    const buttons = within(grid).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent)).toEqual(["连续", "单页", "双页", "适合宽度"]);
  });

  test("点击视图模式按钮调用 onViewModeChange 并高亮当前选中", async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        onRotate={() => undefined}
        onViewModeChange={onViewModeChange}
        onZoomPresetChange={() => undefined}
        viewMode="double"
      />,
    );

    const viewModeGrid = screen.getByTestId("view-mode-grid");
    const fitWidthButton = within(viewModeGrid).getByRole("button", { name: "适合宽度" });
    expect(fitWidthButton).toHaveAttribute("aria-pressed", "false");
    await user.click(fitWidthButton);
    expect(onViewModeChange).toHaveBeenCalledWith("fit-width");

    // 当前高亮应保持 double
    expect(within(viewModeGrid).getByRole("button", { name: "双页" })).toHaveAttribute("aria-pressed", "true");
  });

  test("未打开文档时按钮全部 disabled", () => {
    render(
      <ViewSettingsPanel
        canChangeViewMode={false}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="continuous"
      />,
    );

    const viewModeGrid = screen.getByTestId("view-mode-grid");
    for (const button of within(viewModeGrid).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }

    const rotateGrid = screen.getByTestId("rotate-grid");
    for (const button of within(rotateGrid).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  test("渲染 8 个缩放预设按钮（与 ZOOM_PRESETS 对齐）", () => {
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="continuous"
      />,
    );

    const grid = screen.getByTestId("zoom-preset-grid");
    const buttons = within(grid).getAllByRole("button");
    expect(buttons).toHaveLength(ZOOM_PRESETS.length);
    expect(ZOOM_PRESETS).toHaveLength(8);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "50%",
      "75%",
      "100%",
      "125%",
      "150%",
      "200%",
      "适合宽度",
      "适合页面",
    ]);
  });

  test("点击缩放预设调用 onZoomPresetChange", async () => {
    const user = userEvent.setup();
    const onZoomPresetChange = vi.fn<(id: ZoomPresetId) => void>();
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={onZoomPresetChange}
        viewMode="continuous"
      />,
    );

    await user.click(screen.getByRole("button", { name: "125%" }));
    expect(onZoomPresetChange).toHaveBeenCalledWith("1.25");
  });

  test("activeZoomPresetId 高亮对应的预设按钮", () => {
    render(
      <ViewSettingsPanel
        activeZoomPresetId="1.5"
        canChangeViewMode={true}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="continuous"
      />,
    );

    expect(screen.getByRole("button", { name: "150%" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "100%" })).toHaveAttribute("aria-pressed", "false");
  });

  test("isFitWidth=true 时强制高亮「适合宽度」预设", () => {
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        isFitWidth={true}
        onRotate={() => undefined}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="fit-width"
      />,
    );

    const zoomGrid = screen.getByTestId("zoom-preset-grid");
    expect(within(zoomGrid).getByRole("button", { name: "适合宽度" })).toHaveAttribute("aria-pressed", "true");
  });

  test("旋转按钮调用 onRotate 并传入方向", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn<(direction: "clockwise" | "counter-clockwise") => void>();
    render(
      <ViewSettingsPanel
        canChangeViewMode={true}
        onRotate={onRotate}
        onViewModeChange={() => undefined}
        onZoomPresetChange={() => undefined}
        viewMode="continuous"
      />,
    );

    const rotateGrid = screen.getByTestId("rotate-grid");
    await user.click(within(rotateGrid).getByRole("button", { name: /顺时针/ }));
    expect(onRotate).toHaveBeenCalledWith("clockwise");

    await user.click(within(rotateGrid).getByRole("button", { name: /逆时针/ }));
    expect(onRotate).toHaveBeenCalledWith("counter-clockwise");
  });
});
