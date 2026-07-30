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

describe("ReaderErrorScreen 密码提示态（ISS-NEW-M M5）", () => {
  afterEach(() => {
    setCurrentLanguage("zh-CN");
  });

  test("passwordChallenge 存在时渲染密码输入框而非错误文案 + 重新选择", () => {
    render(<ReaderErrorScreen errorMessage="不应显示" passwordChallenge={{ reason: 1 }} />);
    expect(screen.getByTestId("reader-error-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("reader-error-password-submit")).toBeInTheDocument();
    expect(screen.getByTestId("reader-error-password-cancel")).toBeInTheDocument();
    // 密码态标题
    expect(screen.getByText("此 PDF 已加密")).toBeInTheDocument();
    // 不渲染错误态的重新选择文件入口
    expect(screen.queryByTestId("reader-error-retry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reader-error-file-input")).not.toBeInTheDocument();
  });

  test("reason=1 显示「需要密码」提示，reason=2 显示「密码错误」提示", () => {
    const { rerender } = render(<ReaderErrorScreen errorMessage="" passwordChallenge={{ reason: 1 }} />);
    expect(screen.getByTestId("reader-error-message")).toHaveTextContent("请输入密码");
    rerender(<ReaderErrorScreen errorMessage="" passwordChallenge={{ reason: 2 }} />);
    expect(screen.getByTestId("reader-error-message")).toHaveTextContent("密码错误");
  });

  test("输入密码后提交按钮启用，提交触发 onSubmitPassword 并清空输入", () => {
    const onSubmitPassword = vi.fn();
    render(
      <ReaderErrorScreen errorMessage="" passwordChallenge={{ reason: 1 }} onSubmitPassword={onSubmitPassword} />,
    );
    const input = screen.getByTestId("reader-error-password-input") as HTMLInputElement;
    const submit = screen.getByTestId("reader-error-password-submit") as HTMLButtonElement;
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "test123" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onSubmitPassword).toHaveBeenCalledWith("test123");
    expect(input.value).toBe("");
  });

  test("点击取消触发 onCancelPassword 并清空输入", () => {
    const onCancelPassword = vi.fn();
    render(
      <ReaderErrorScreen errorMessage="" passwordChallenge={{ reason: 1 }} onCancelPassword={onCancelPassword} />,
    );
    const input = screen.getByTestId("reader-error-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "secret" } });
    fireEvent.click(screen.getByTestId("reader-error-password-cancel"));
    expect(onCancelPassword).toHaveBeenCalledTimes(1);
  });

  test("密码态 en 文案", () => {
    setCurrentLanguage("en");
    render(<ReaderErrorScreen errorMessage="" passwordChallenge={{ reason: 1 }} />);
    expect(screen.getByText("This PDF is encrypted")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter PDF password")).toBeInTheDocument();
  });

  test("无 passwordChallenge 时仍走错误态（向后兼容）", () => {
    render(<ReaderErrorScreen errorMessage="损坏" />);
    expect(screen.queryByTestId("reader-error-password-input")).not.toBeInTheDocument();
    expect(screen.getByText("无法打开此 PDF")).toBeInTheDocument();
  });
});
