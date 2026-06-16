import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SplitPagesDialog } from "./SplitPagesDialog";

describe("SplitPagesDialog (ISS-066 阶段 2)", () => {
  const baseProps = {
    defaultFileName: "contract.pdf",
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  test("默认渲染：行=1，列=2（拆双页），输出名 = contract-cut.pdf", () => {
    render(<SplitPagesDialog {...baseProps} />);
    expect(screen.getByRole("heading", { name: /扫描拆页/ })).toBeTruthy();
    const rowsInput = screen.getByLabelText(/行数/) as HTMLInputElement;
    const colsInput = screen.getByLabelText(/列数/) as HTMLInputElement;
    expect(rowsInput.value).toBe("1");
    expect(colsInput.value).toBe("2");
    const outputInput = screen.getByLabelText(/输出文件名/) as HTMLInputElement;
    expect(outputInput.value).toBe("contract-cut.pdf");
  });

  test("点击取消调用 onClose", () => {
    const onClose = vi.fn();
    render(<SplitPagesDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("行=0 → 阻止提交并显示错误", () => {
    const onConfirm = vi.fn();
    render(<SplitPagesDialog {...baseProps} onConfirm={onConfirm} />);
    const rowsInput = screen.getByLabelText(/行数/) as HTMLInputElement;
    fireEvent.change(rowsInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /确认拆页/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/行数必须是 ≥ 1 的整数/)).toBeTruthy();
  });

  test("列=0 → 阻止提交", () => {
    const onConfirm = vi.fn();
    render(<SplitPagesDialog {...baseProps} onConfirm={onConfirm} />);
    const colsInput = screen.getByLabelText(/列数/) as HTMLInputElement;
    fireEvent.change(colsInput, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /确认拆页/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/列数必须是 ≥ 1 的整数/)).toBeTruthy();
  });

  test("行=2 列=2 → 提交传入 {rows: 2, cols: 2, pageIndexes: undefined, outputName}", () => {
    const onConfirm = vi.fn();
    render(<SplitPagesDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/行数/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/列数/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /确认拆页/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const call = onConfirm.mock.calls[0][0];
    expect(call.rows).toBe(2);
    expect(call.cols).toBe(2);
    expect(call.pageIndexes).toBeUndefined();
    expect(call.outputName).toBe("contract-cut.pdf");
  });

  test("selectedPageNumbers=[3,5] → 提交传入 pageIndexes=[2,4]", () => {
    const onConfirm = vi.fn();
    render(
      <SplitPagesDialog
        {...baseProps}
        onConfirm={onConfirm}
        selectedPageNumbers={[3, 5]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /确认拆页/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const call = onConfirm.mock.calls[0][0];
    expect(call.pageIndexes).toEqual([2, 4]);
  });

  test("selectedPageNumbers 显示「仅切 N 页」标签", () => {
    render(<SplitPagesDialog {...baseProps} selectedPageNumbers={[1, 2, 3]} />);
    expect(screen.getByText(/仅切 3 页/)).toBeTruthy();
  });

  test("无 selectedPageNumbers → 显示「全部页面」", () => {
    render(<SplitPagesDialog {...baseProps} />);
    expect(screen.getByText(/全部页面/)).toBeTruthy();
  });

  test("输出名为空 → 阻止提交", () => {
    const onConfirm = vi.fn();
    render(<SplitPagesDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/输出文件名/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /确认拆页/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/输出文件名不能为空/)).toBeTruthy();
  });
});
