import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ReaderErrorScreen } from "./ReaderErrorScreen";

describe("ReaderErrorScreen", () => {
  test("渲染错误标题与 errorMessage，错误区 role=alert 可达性", () => {
    render(<ReaderErrorScreen errorMessage="PDF 解析失败，文件可能已损坏或不是有效 PDF。" />);
    const region = screen.getByTestId("reader-error-screen");
    expect(region).toHaveAttribute("role", "alert");
    expect(screen.getByText("无法打开此 PDF")).toBeInTheDocument();
    expect(screen.getByTestId("reader-error-message")).toHaveTextContent(
      "PDF 解析失败，文件可能已损坏或不是有效 PDF。",
    );
  });

  test("点击「重新选择文件」触发隐藏 file input 的 click", () => {
    render(<ReaderErrorScreen errorMessage="x" />);
    const input = screen.getByTestId("reader-error-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByTestId("reader-error-retry"));
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  test("选择 PDF 文件后调用 onOpenFile 并清空 input value", () => {
    const onOpenFile = vi.fn();
    render(<ReaderErrorScreen errorMessage="x" onOpenFile={onOpenFile} />);
    const input = screen.getByTestId("reader-error-file-input") as HTMLInputElement;
    const file = new File(["%PDF-1.4 broken"], "bad.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onOpenFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  test("拖拽 PDF 文件到错误区触发 onOpenFile", () => {
    const onOpenFile = vi.fn();
    render(<ReaderErrorScreen errorMessage="x" onOpenFile={onOpenFile} />);
    const region = screen.getByTestId("reader-error-screen");
    const file = new File(["%PDF-1.4"], "dropped.pdf", { type: "application/pdf" });
    fireEvent.drop(region, {
      dataTransfer: { files: [file] },
    });
    expect(onOpenFile).toHaveBeenCalledWith(file);
  });

  test("未传 onOpenFile 时选择文件不崩溃", () => {
    render(<ReaderErrorScreen errorMessage="x" />);
    const input = screen.getByTestId("reader-error-file-input") as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "bad.pdf", { type: "application/pdf" });
    expect(() => fireEvent.change(input, { target: { files: [file] } })).not.toThrow();
  });
});
