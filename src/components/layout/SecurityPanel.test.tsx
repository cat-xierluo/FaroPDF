import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { SecurityPanel } from "./SecurityPanel";

describe("SecurityPanel (ISS-064 阶段 1 + DEC-102 P1-4)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("currentPdfPath=null → 展示 empty 提示，不显示密码表单", () => {
    render(<SecurityPanel currentPdfPath={null} onClose={() => undefined} onFeedback={() => undefined} />);
    expect(screen.getByText("打开 PDF 后才能设置 / 移除密码。")).toBeInTheDocument();
    // empty 状态下不渲染密码模式选择 tab
    expect(screen.queryByRole("tab", { name: "设置密码" })).toBeNull();
  });

  test("set 模式 → 渲染 stub 警示 + 按钮 disabled（P1-1）", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    // 默认 set 模式
    expect(screen.getByTestId("security-panel-stub-hint")).toBeInTheDocument();
    const setButton = screen.getByRole("button", { name: /设置密码并导出/ });
    expect(setButton).toBeDisabled();
    // 按钮不应触发 invoke 即便点击
    fireEvent.click(setButton);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("set 模式输入框启用了 password manager 兼容 autoComplete（P2-5）", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    const userInput = screen.getByLabelText(/用户密码/);
    expect(userInput).toHaveAttribute("autocomplete", "new-password");
    expect(userInput).toHaveAttribute("type", "password");
    const ownerInput = screen.getByLabelText("拥有者密码");
    expect(ownerInput).toHaveAttribute("autocomplete", "new-password");
  });

  test("remove 模式输入框启用了 current-password autoComplete（P2-5）", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    const orig = screen.getByLabelText("原密码");
    expect(orig).toHaveAttribute("autocomplete", "current-password");
    expect(orig).toHaveAttribute("type", "password");
  });

  test("remove 模式成功路径：invoke 收到正确 payload + onFeedback 收到成功消息", async () => {
    invokeMock.mockResolvedValueOnce({ path: "/tmp/sample-unsecured.pdf", size_bytes: 12345 });
    const onFeedback = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={onFeedback}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    fireEvent.change(screen.getByLabelText("原密码"), { target: { value: "user-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "移除密码并导出" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("remove_pdfpassword", {
        request: { input_path: "/tmp/sample.pdf", user_password: "user-secret" },
      });
    });
    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledWith(
        expect.stringContaining("/tmp/sample-unsecured.pdf"),
        false,
      );
    });
  });

  test("remove 模式失败路径：invoke 抛错 → errMessage 显示 + onFeedback(msg, true)", async () => {
    invokeMock.mockRejectedValueOnce("密码错误或解密失败。");
    const onFeedback = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={onFeedback}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    fireEvent.change(screen.getByLabelText("原密码"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "移除密码并导出" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("密码错误或解密失败。");
    });
    expect(onFeedback).toHaveBeenCalledWith("密码错误或解密失败。", true);
    // errMessage 也应在 isError 通道上送达
  });

  test("remove 模式：未输入原密码点按钮 → 走客户端校验，不发起 invoke", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    // input 为空时按钮 disabled，不可点
    const button = screen.getByRole("button", { name: "移除密码并导出" });
    expect(button).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("点击关闭按钮 → 触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={onClose}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关闭安全面板" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
