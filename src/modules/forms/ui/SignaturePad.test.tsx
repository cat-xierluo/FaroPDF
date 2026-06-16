import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignaturePad } from "./SignaturePad";

/**
 * ISS-070 阶段 1：SignaturePad 手写签名板测试。
 *
 * jsdom 下 HTMLCanvasElement 的 `getContext` 返回 null（无 2D context 实现），
 * 测试通过 spy / mock 验证组件行为契约，不验证真实像素渲染。
 */

describe("SignaturePad (ISS-070 阶段 1)", () => {
  test("默认渲染：canvas + 3 按钮（清空/保存/取消）", () => {
    render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByTestId("signature-pad-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  test("默认 width 600 / height 200，可覆盖", () => {
    const { rerender } = render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    const canvas = screen.getByTestId("signature-pad-canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(200);
    rerender(<SignaturePad onSave={() => undefined} onCancel={() => undefined} width={400} height={150} />);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(150);
  });

  test("mousedown + mousemove + mouseup → strokeCount = 1", () => {
    render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    const canvas = screen.getByTestId("signature-pad-canvas") as HTMLCanvasElement;
    expect(canvas.dataset.strokeCount).toBe("0");
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas, { clientX: 100, clientY: 100 });
    expect(canvas.dataset.strokeCount).toBe("1");
  });

  test("多笔画：两次 mousedown → strokeCount = 2", () => {
    render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    const canvas = screen.getByTestId("signature-pad-canvas") as HTMLCanvasElement;
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(canvas, { clientX: 50, clientY: 50 });
    expect(canvas.dataset.strokeCount).toBe("2");
  });

  test("「清空」按钮：strokeCount → 0", () => {
    render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    const canvas = screen.getByTestId("signature-pad-canvas") as HTMLCanvasElement;
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(canvas, { clientX: 10, clientY: 10 });
    expect(canvas.dataset.strokeCount).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(canvas.dataset.strokeCount).toBe("0");
  });

  test("「保存」按钮：toDataURL 被调用 + onSave 收到 data:image/png string", () => {
    const onSave = vi.fn();
    // mock toDataURL 让 jsdom canvas 返回固定值
    const toDataURLMock = vi.fn(() => "data:image/png;base64,FAKE_PNG_DATA");
    HTMLCanvasElement.prototype.toDataURL = toDataURLMock;

    render(<SignaturePad onSave={onSave} onCancel={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(toDataURLMock).toHaveBeenCalledWith("image/png");
    expect(onSave).toHaveBeenCalledWith("data:image/png;base64,FAKE_PNG_DATA");
  });

  test("「取消」按钮：onCancel 被调用", () => {
    const onCancel = vi.fn();
    render(<SignaturePad onSave={() => undefined} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("mouseleave 中止当前 stroke（鼠标移出 canvas 抬起）", () => {
    render(<SignaturePad onSave={() => undefined} onCancel={() => undefined} />);
    const canvas = screen.getByTestId("signature-pad-canvas") as HTMLCanvasElement;
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(canvas);
    // mouseleave 后再 mousedown 应该开始新 stroke
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(canvas, { clientX: 50, clientY: 50 });
    expect(canvas.dataset.strokeCount).toBe("2");
  });
});
