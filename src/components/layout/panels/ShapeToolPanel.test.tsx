import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShapeToolPanel, type ShapeToolValue } from "./ShapeToolPanel";

describe("ShapeToolPanel (ISS-NEW-I 段 1-6)", () => {
  test("默认渲染所有 6 段（形状/线条/线宽/不透明度/边框色/填充色）", () => {
    render(<ShapeToolPanel />);
    expect(screen.getByTestId("shape-tool-panel")).toBeTruthy();
    // 段 1：6 个形状按钮
    expect(screen.getByTestId("shape-option-rectangle")).toBeTruthy();
    expect(screen.getByTestId("shape-option-pencil")).toBeTruthy();
    // 段 2：实线 + 虚线
    expect(screen.getByTestId("shape-stroke-solid")).toBeTruthy();
    expect(screen.getByTestId("shape-stroke-dashed")).toBeTruthy();
    // 段 3/4：slider
    expect(screen.getByTestId("shape-stroke-width")).toBeTruthy();
    expect(screen.getByTestId("shape-opacity")).toBeTruthy();
    // 段 5/6：7 + 7 色块
    expect(screen.getByTestId("shape-stroke-color-black")).toBeTruthy();
    expect(screen.getByTestId("shape-fill-color-transparent")).toBeTruthy();
    expect(screen.getByTestId("shape-fill-color-blue-fill")).toBeTruthy();
  });

  test("默认值 → 矩形 + 实线 + 线宽 2 + 不透明度 100 + 边框黑 + 填充透明", () => {
    render(<ShapeToolPanel />);
    expect(screen.getByTestId("shape-option-rectangle").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-stroke-solid").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-stroke-width-value").textContent).toBe("2 px");
    expect(screen.getByTestId("shape-opacity-value").textContent).toBe("100 %");
    expect(screen.getByTestId("shape-stroke-color-black").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-fill-color-transparent").getAttribute("aria-checked")).toBe("true");
  });

  test("点击椭圆 → onChange 收到 shape=ellipse", () => {
    const onChange = vi.fn();
    render(<ShapeToolPanel onChange={onChange} />);
    fireEvent.click(screen.getByTestId("shape-option-ellipse"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].shape).toBe("ellipse");
  });

  test("切换虚线 → onChange.strokeStyle=dashed", () => {
    const onChange = vi.fn();
    render(<ShapeToolPanel onChange={onChange} />);
    fireEvent.click(screen.getByTestId("shape-stroke-dashed"));
    expect(onChange.mock.calls[0][0].strokeStyle).toBe("dashed");
  });

  test("受控 value → 选中态跟随 props", () => {
    const value: ShapeToolValue = {
      shape: "arrow",
      strokeStyle: "dashed",
      strokeWidth: 5,
      opacity: 50,
      strokeColor: "#d04444",
      fillColor: "#2a8df0",
    };
    render(<ShapeToolPanel value={value} />);
    expect(screen.getByTestId("shape-option-arrow").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-stroke-dashed").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-stroke-width-value").textContent).toBe("5 px");
    expect(screen.getByTestId("shape-opacity-value").textContent).toBe("50 %");
    expect(screen.getByTestId("shape-stroke-color-red").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("shape-fill-color-blue-fill").getAttribute("aria-checked")).toBe("true");
  });

  test("onChange 拼装完整对象（保留其它字段）", () => {
    const onChange = vi.fn();
    const value: ShapeToolValue = {
      shape: "rectangle",
      strokeStyle: "solid",
      strokeWidth: 8,
      opacity: 75,
      strokeColor: "#000000",
      fillColor: "transparent",
    };
    render(<ShapeToolPanel onChange={onChange} value={value} />);
    fireEvent.click(screen.getByTestId("shape-option-pencil"));
    const next = onChange.mock.calls[0][0];
    expect(next.shape).toBe("pencil");
    // 其它字段保留
    expect(next.strokeWidth).toBe(8);
    expect(next.opacity).toBe(75);
    expect(next.strokeColor).toBe("#000000");
  });

  test("色块点击 → onChange.strokeColor 更新", () => {
    const onChange = vi.fn();
    render(<ShapeToolPanel onChange={onChange} />);
    fireEvent.click(screen.getByTestId("shape-stroke-color-blue"));
    expect(onChange.mock.calls[0][0].strokeColor).toBe("#2a8df0");
  });
});