import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RedactionOverlay, type RedactionRegionDraft } from "./RedactionOverlay";

const VIEWPORT = { width: 800, height: 600 };

describe("RedactionOverlay (ISS-067 阶段 2)", () => {
  test("active=false → 不渲染任何覆盖层", () => {
    const { container } = render(
      <RedactionOverlay
        active={false}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    expect(container.querySelector(".redaction-overlay")).toBeNull();
  });

  test("active=true → 渲染覆盖层容器和 '涂黑矩形' 标题", () => {
    render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    expect(screen.getByTestId("redaction-overlay")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /涂黑矩形/ })).toBeTruthy();
  });

  test("显示「应用遮蔽」「取消」两个按钮", () => {
    render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    expect(screen.getByRole("button", { name: /应用遮蔽/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /取消/ })).toBeTruthy();
  });

  test("初始无 region → 应用按钮 disabled", () => {
    render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    const applyButton = screen.getByRole("button", { name: /应用遮蔽/ });
    expect((applyButton as HTMLButtonElement).disabled).toBe(true);
  });

  test("鼠标按下并拖动 → 显示 draft 矩形（redaction-overlay__draft）", () => {
    const { container } = render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    expect(container.querySelector(".redaction-overlay__draft")).toBeTruthy();
  });

  test("鼠标抬起 → 提交 region 到已选列表，draft 消失", () => {
    const { container } = render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });
    expect(container.querySelector(".redaction-overlay__draft")).toBeNull();
    const committed = container.querySelectorAll(".redaction-overlay__region");
    expect(committed.length).toBe(1);
  });

  test("提交多个 region 后应用按钮 enabled", () => {
    render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    // 第一个矩形
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });
    // 第二个矩形
    fireEvent.mouseDown(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(overlay, { clientX: 300, clientY: 280 });
    fireEvent.mouseUp(overlay, { clientX: 300, clientY: 280 });
    const applyButton = screen.getByRole("button", { name: /应用遮蔽/ });
    expect((applyButton as HTMLButtonElement).disabled).toBe(false);
  });

  test("点击应用遮蔽 → 调用 onApply 传入所有 region（pageIndex 从外部传入）", () => {
    const onApply = vi.fn();
    render(
      <RedactionOverlay
        active={true}
        onApply={onApply}
        onCancel={vi.fn()}
        pageIndex={2}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseDown(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(overlay, { clientX: 300, clientY: 280 });
    fireEvent.mouseUp(overlay, { clientX: 300, clientY: 280 });
    fireEvent.click(screen.getByRole("button", { name: /应用遮蔽/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const passed = onApply.mock.calls[0][0] as RedactionRegionDraft[];
    expect(passed).toHaveLength(2);
    expect(passed[0].pageIndex).toBe(2);
    expect(passed[1].pageIndex).toBe(2);
    expect(passed[0].x).toBe(10);
    expect(passed[0].y).toBe(20);
    expect(passed[0].width).toBe(100);
    expect(passed[0].height).toBe(50);
  });

  test("点击取消 → 清空所有 region 并调用 onCancel", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={onCancel}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".redaction-overlay__region").length).toBe(0);
  });

  test("拖动距离小于 5px → 不提交 region", () => {
    const { container } = render(
      <RedactionOverlay
        active={true}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        viewport={VIEWPORT}
      />,
    );
    const overlay = screen.getByTestId("redaction-overlay");
    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 12, clientY: 22 });
    fireEvent.mouseUp(overlay, { clientX: 12, clientY: 22 });
    expect(container.querySelectorAll(".redaction-overlay__region").length).toBe(0);
  });
});
