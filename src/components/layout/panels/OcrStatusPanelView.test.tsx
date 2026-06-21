import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OcrStatusPanelView, type OcrJobStatus } from "./OcrStatusPanelView";

describe("OcrStatusPanelView (ISS-NEW-C)", () => {
  const idleStatus: OcrJobStatus = {
    state: "idle",
    message: "尚未开始 OCR",
    progress: 0,
  };

  test("idle 状态显示「开始 OCR」按钮", () => {
    render(<OcrStatusPanelView status={idleStatus} onStart={() => undefined} />);
    expect(screen.getByRole("button", { name: /开始 OCR/ })).toBeTruthy();
  });

  test("idle 状态点击开始按钮 → 调用 onStart（不传参）", () => {
    const onStart = vi.fn();
    render(<OcrStatusPanelView status={idleStatus} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /开始 OCR/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test("页码范围输入变化 → 反映在 button 点击时回传给 onStart", () => {
    const onStart = vi.fn();
    render(<OcrStatusPanelView status={idleStatus} onStart={onStart} />);
    const input = screen.getByLabelText(/页码范围/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1-5" } });
    fireEvent.click(screen.getByRole("button", { name: /开始 OCR/ }));
    expect(onStart).toHaveBeenCalledWith({ pageRange: "1-5" });
  });

  test("running 状态显示进度 + 状态文字，按钮禁用", () => {
    const running: OcrJobStatus = {
      state: "running",
      message: "正在识别第 12 / 42 页",
      progress: 0.28,
    };
    render(<OcrStatusPanelView status={running} onStart={() => undefined} />);
    expect(screen.getByText(/正在识别第 12/)).toBeTruthy();
    const button = screen.getByRole("button", { name: /开始 OCR/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("completed 状态显示「已完成」文案，无开始按钮", () => {
    const done: OcrJobStatus = {
      state: "completed",
      message: "OCR 已完成，识别 42 / 42 页",
      progress: 1,
    };
    render(<OcrStatusPanelView status={done} onStart={() => undefined} />);
    expect(screen.getByText(/OCR 已完成/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /开始 OCR/ })).toBeNull();
  });

  test("failed 状态显示错误文案，无开始按钮", () => {
    const failed: OcrJobStatus = {
      state: "failed",
      message: "OCR 后端超时",
      progress: 0,
      error: "timeout after 30s",
    };
    render(<OcrStatusPanelView status={failed} onStart={() => undefined} />);
    expect(screen.getByText(/OCR 后端超时/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /开始 OCR/ })).toBeNull();
  });
});
