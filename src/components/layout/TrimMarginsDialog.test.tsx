import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TrimMarginsDialog } from "./TrimMarginsDialog";

describe("TrimMarginsDialog (ISS-066 阶段 2 后续)", () => {
  const baseProps = {
    defaultFileName: "scan.pdf",
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  test("渲染裁边切对话框与 4 个 margin 输入框 + 输出文件名", () => {
    render(<TrimMarginsDialog {...baseProps} />);
    expect(screen.getByRole("heading", { name: /裁边切/ })).toBeTruthy();
    expect(screen.getByLabelText(/顶 margin/)).toBeTruthy();
    expect(screen.getByLabelText(/右 margin/)).toBeTruthy();
    expect(screen.getByLabelText(/底 margin/)).toBeTruthy();
    expect(screen.getByLabelText(/左 margin/)).toBeTruthy();
    expect(screen.getByLabelText(/输出文件名/)).toBeTruthy();
  });

  test("默认输出文件名 = scan-trimmed.pdf", () => {
    render(<TrimMarginsDialog {...baseProps} />);
    expect((screen.getByLabelText(/输出文件名/) as HTMLInputElement).value).toBe("scan-trimmed.pdf");
  });

  test("默认 margin 全部 0", () => {
    render(<TrimMarginsDialog {...baseProps} />);
    expect((screen.getByLabelText(/顶 margin/) as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText(/右 margin/) as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText(/底 margin/) as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText(/左 margin/) as HTMLInputElement).value).toBe("0");
  });

  test("输入合法 margin + 点击确认 → onConfirm 收到正确数值", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/顶 margin/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/右 margin/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/底 margin/), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/左 margin/), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const call = onConfirm.mock.calls[0][0];
    expect(call.top).toBe(10);
    expect(call.right).toBe(20);
    expect(call.bottom).toBe(30);
    expect(call.left).toBe(40);
    expect(call.outputName).toBe("scan-trimmed.pdf");
    expect(call.pageIndexes).toBeUndefined();
  });

  test("支持小数 margin（如 5.5 pt）", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/顶 margin/), { target: { value: "5.5" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].top).toBe(5.5);
  });

  test("选页模式：传入 selectedPageNumbers → pageIndexes 转换 1-based 到 0-based", () => {
    const onConfirm = vi.fn();
    render(
      <TrimMarginsDialog
        {...baseProps}
        selectedPageNumbers={[2, 5, 7]}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText(/右 margin/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].pageIndexes).toEqual([1, 4, 6]);
  });

  test("负数 margin → 阻止提交 + 显示错误", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/顶 margin/), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/顶 margin 必须 ≥ 0/)).toBeTruthy();
  });

  test("非数字 margin → 阻止提交 + 显示错误", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    // HTML <input type="number"> 会自动剥除非数字字符 (变空), 触发「不能为空」分支
    fireEvent.change(screen.getByLabelText(/底 margin/), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/底 margin 不能为空/)).toBeTruthy();
  });

  test("空 margin → 阻止提交 + 显示错误", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/左 margin/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/左 margin 不能为空/)).toBeTruthy();
  });

  test("输出文件名为空 → 阻止提交 + 显示错误", () => {
    const onConfirm = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/输出文件名/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /确认裁边/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/输出文件名不能为空/)).toBeTruthy();
  });

  test("点击取消 → onClose 触发", () => {
    const onClose = vi.fn();
    render(<TrimMarginsDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});