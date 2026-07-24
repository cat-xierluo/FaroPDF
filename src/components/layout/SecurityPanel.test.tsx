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

  test("set 模式 → 渲染密码表单 + 按钮 enabled (ISS-064 阶段 2 激活)", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    // 默认 set 模式 + 真实表单
    expect(screen.getByLabelText(/^用户密码/)).toBeInTheDocument();
    expect(screen.getByLabelText("拥有者密码")).toBeInTheDocument();
    const setButton = screen.getByRole("button", { name: /设置密码并导出/ });
    // 按钮初始 disabled（无 owner 密码），有 owner 密码后 enabled
    expect(setButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("拥有者密码"), { target: { value: "owner-pwd" } });
    expect((setButton as HTMLButtonElement).disabled).toBe(false);
  });

  test("set 模式成功路径：invoke 收到 owner_password + onFeedback 收到成功消息", async () => {
    invokeMock.mockResolvedValueOnce({ path: "/tmp/sample-secured.pdf", size_bytes: 54321 });
    const onFeedback = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={onFeedback}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^用户密码/), { target: { value: "user-pwd" } });
    fireEvent.change(screen.getByLabelText("拥有者密码"), { target: { value: "owner-pwd" } });
    fireEvent.click(screen.getByRole("button", { name: /设置密码并导出/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("set_pdfpassword", {
        request: {
          input_path: "/tmp/sample.pdf",
          user_password: "user-pwd",
          owner_password: "owner-pwd",
        },
      });
    });
    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledWith(
        expect.stringContaining("/tmp/sample-secured.pdf"),
        false,
      );
    });
  });

  test("set 模式失败路径：EncryptionError 错误 → 显示友好文案", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "EncryptionError",
      message: "PDF 加密失败：some internal error",
    });
    const onFeedback = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={onFeedback}
      />,
    );
    fireEvent.change(screen.getByLabelText("拥有者密码"), { target: { value: "owner-pwd" } });
    fireEvent.click(screen.getByRole("button", { name: /设置密码并导出/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("PDF 加密失败");
    });
    expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("PDF 加密失败"), true);
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

  test("set 模式用户密码文案不暗示可沿用旧密码", () => {
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );

    expect(screen.getByText("用户密码（留空 = 无需密码即可打开副本）")).toBeInTheDocument();
    expect(screen.queryByText(/沿用旧用户密码/)).toBeNull();
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
    // ISS-071 阶段 3：Rust 现在返回 AppError { code, message }，前端按 code 走友好文案。
    invokeMock.mockRejectedValueOnce({
      code: "DecryptionError",
      message: "密码错误或解密失败。",
    });
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
      // 友好文案覆盖了 Rust 原始 message（用户视角更清晰）
      expect(screen.getByRole("alert")).toHaveTextContent("密码错误或解密失败，请检查原密码后重试。");
    });
    expect(onFeedback).toHaveBeenCalledWith(
      expect.stringContaining("密码错误或解密失败"),
      true,
    );
  });

  test("remove 模式：FileNotFound 错误 → 显示「文件不存在」友好文案", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "FileNotFound",
      message: "文件不存在: [path:missing.pdf]",
      context: { path: "[path:missing.pdf]" },
    });
    render(
      <SecurityPanel
        currentPdfPath="/tmp/missing.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    fireEvent.change(screen.getByLabelText("原密码"), { target: { value: "any" } });
    fireEvent.click(screen.getByRole("button", { name: "移除密码并导出" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("文件不存在或路径已变更");
    });
  });

  test("remove 模式：Unknown 错误 → fallback 到原始 message", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "Unknown",
      message: "Something weird happened",
    });
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    fireEvent.change(screen.getByLabelText("原密码"), { target: { value: "any" } });
    fireEvent.click(screen.getByRole("button", { name: "移除密码并导出" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something weird happened");
    });
  });

  test("remove 模式：旧版 string 错误仍能 fallback（向后兼容）", async () => {
    // 历史 Rust 命令（未迁移的）可能仍返回字符串；normalizeError 应兜底。
    invokeMock.mockRejectedValueOnce("plain string error from legacy command");
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={() => undefined}
        onFeedback={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "移除密码" }));
    fireEvent.change(screen.getByLabelText("原密码"), { target: { value: "any" } });
    fireEvent.click(screen.getByRole("button", { name: "移除密码并导出" }));

    await waitFor(() => {
      // 字符串错误 → normalizeError → code=Unknown, message=原字符串 → 透传
      expect(screen.getByRole("alert")).toHaveTextContent("plain string error from legacy command");
    });
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

  test("ISS-NEW-N-P02：center modal + backdrop 形态 + 点击遮罩关闭", () => {
    const onClose = vi.fn();
    render(
      <SecurityPanel
        currentPdfPath="/tmp/sample.pdf"
        onClose={onClose}
        onFeedback={() => undefined}
      />,
    );
    // dialog role + aria-modal
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // backdrop 存在
    const backdrop = screen.getByTestId("security-panel-backdrop");
    // 点击遮罩关闭
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
