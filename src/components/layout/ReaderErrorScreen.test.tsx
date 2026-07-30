import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setCurrentLanguage } from "../../shared/i18n/useI18n";
import { ReaderErrorScreen } from "./ReaderErrorScreen";

describe("ReaderErrorScreen", () => {
  afterEach(() => {
    setCurrentLanguage("zh-CN");
  });

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

describe("ReaderErrorScreen i18n（与 WelcomeScreen 对齐）", () => {
  afterEach(() => {
    setCurrentLanguage("zh-CN");
  });

  test("zh-CN 下显示中文标题与按钮（默认）", () => {
    setCurrentLanguage("zh-CN");
    render(<ReaderErrorScreen errorMessage="损坏" />);
    expect(screen.getByText("无法打开此 PDF")).toBeInTheDocument();
    expect(screen.getByTestId("reader-error-retry")).toHaveTextContent("重新选择文件");
    expect(screen.getByTestId("reader-error-file-input")).toHaveAttribute(
      "aria-label",
      "重新选择 PDF 文件",
    );
  });

  test("en 下切换为英文标题与按钮", () => {
    setCurrentLanguage("en");
    render(<ReaderErrorScreen errorMessage="corrupted" />);
    expect(screen.getByText("Unable to open this PDF")).toBeInTheDocument();
    expect(screen.getByTestId("reader-error-retry")).toHaveTextContent("Choose another file");
    expect(screen.getByTestId("reader-error-file-input")).toHaveAttribute(
      "aria-label",
      "Select another PDF file",
    );
    // errorMessage 来自 friendlyMessageForCode（错误码→中文，暂不随语言切换，与 SecurityPanel 同模式）
    expect(screen.getByTestId("reader-error-message")).toHaveTextContent("corrupted");
  });
});
