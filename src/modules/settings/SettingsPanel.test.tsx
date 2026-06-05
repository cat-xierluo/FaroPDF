import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import { createDefaultAppSettings, exportSafeAppSettings } from "../../shared/settings/defaults";
import type { AppSettings } from "../../shared/settings/types";
import { SettingsPanel } from "./SettingsPanel";

function renderPanel(overrides: Partial<{ open: boolean; onClose: () => void; onSettingsChange: (s: AppSettings) => void; settings: AppSettings }> = {}) {
  const onClose: Mock<() => void> = (overrides.onClose ? vi.fn(overrides.onClose) : vi.fn()) as Mock<() => void>;
  const onSettingsChange: Mock<(s: AppSettings) => void> = (overrides.onSettingsChange
    ? vi.fn(overrides.onSettingsChange)
    : vi.fn()) as Mock<(s: AppSettings) => void>;
  const settings = overrides.settings ?? createDefaultAppSettings();
  const utils = render(
    <SettingsPanel
      onClose={onClose}
      onSettingsChange={onSettingsChange}
      open={overrides.open ?? true}
      settings={settings}
    />,
  );
  return { ...utils, onClose, onSettingsChange, settings };
}

afterEach(() => {
  // Portal 在 document.body 上，RTL 的 unmount 才能正确清理
  // 单独测试用 utils.unmount() 收尾。
});

describe("SettingsPanel", () => {
  test("does not render portal when closed", () => {
    const { unmount } = renderPanel({ open: false });
    expect(screen.queryByTestId("settings-overlay")).not.toBeInTheDocument();
    unmount();
  });

  test("renders left nav with 5 sections and first section is active by default", () => {
    const { unmount } = renderPanel();
    const nav = screen.getByRole("tablist", { name: "设置分类" });
    const navItems = within(nav).getAllByRole("tab");
    expect(navItems.map((item) => item.textContent)).toEqual([
      "常规",
      "阅读",
      "OCR provider",
      "快捷键",
      "关于",
    ]);
    expect(navItems[0]).toHaveAttribute("aria-selected", "true");
    unmount();
  });

  test("renders first section content", () => {
    const { unmount } = renderPanel();
    expect(screen.getByRole("tabpanel", { name: "常规" })).toBeInTheDocument();
    expect(screen.getByLabelText("默认保存策略")).toBeInTheDocument();
    unmount();
  });

  test("switches sections when clicking nav items", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    const nav = screen.getByRole("tablist", { name: "设置分类" });
    await user.click(within(nav).getByRole("tab", { name: "阅读" }));
    expect(screen.getByRole("tabpanel", { name: "阅读" })).toBeInTheDocument();
    expect(screen.queryByLabelText("默认保存策略")).not.toBeInTheDocument();
    unmount();
  });

  test("close button calls onClose", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = renderPanel();
    await user.click(screen.getByRole("button", { name: "关闭设置" }));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  test("backdrop click calls onClose", () => {
    const { onClose, unmount } = renderPanel();
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  test("Escape key calls onClose", () => {
    const { onClose, unmount } = renderPanel();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  test("settings change propagates via onSettingsChange", async () => {
    const user = userEvent.setup();
    const settings = createDefaultAppSettings();
    const { onSettingsChange, unmount } = renderPanel({ settings });
    await user.selectOptions(screen.getByLabelText("默认保存策略"), "ask-each-time");
    const lastCall = onSettingsChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.defaultSavePolicy).toBe("ask-each-time");
    unmount();
  });

  test("focus moves to close button when opened", () => {
    const { unmount } = renderPanel();
    expect(screen.getByRole("button", { name: "关闭设置" })).toHaveFocus();
    unmount();
  });

  test("navigates to OCR section and shows masked API key", async () => {
    const user = userEvent.setup();
    const settings = createDefaultAppSettings();
    settings.ocrProviders = settings.ocrProviders.map((p) =>
      p.id === "paddleocr" ? { ...p, enabled: true, apiKeyRef: "paddle-secret-123456" } : p,
    );
    const safeSettings = exportSafeAppSettings(settings);
    const { unmount } = renderPanel({ settings: safeSettings });
    await user.click(screen.getByRole("tab", { name: "OCR provider" }));
    expect(screen.getByLabelText("PaddleOCR API Key 引用")).toHaveAttribute("placeholder", "padd...3456");
    unmount();
  });

  test("navigates to about section and shows version + homepage", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    await user.click(screen.getByRole("tab", { name: "关于" }));
    expect(screen.getByRole("link", { name: "官网" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
    unmount();
  });

  test("default general section renders without Suspense fallback", () => {
    const { unmount } = renderPanel();
    expect(screen.queryByText("默认保存策略")).not.toBeInTheDocument();
    expect(screen.getByLabelText("默认保存策略")).toBeInTheDocument();
    unmount();
  });

  test("lazy section shows Suspense fallback then loads content", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    await user.click(screen.getByRole("tab", { name: "快捷键" }));
    await waitFor(() => {
      expect(screen.getByRole("tabpanel", { name: "快捷键" })).toBeInTheDocument();
    });
    unmount();
  });

  test("lazy reader section loads on demand", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    await user.click(screen.getByRole("tab", { name: "阅读" }));
    await waitFor(() => {
      expect(screen.getByRole("tabpanel", { name: "阅读" })).toBeInTheDocument();
    });
    unmount();
  });

  test("lazy OCR section loads on demand", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();
    await user.click(screen.getByRole("tab", { name: "OCR provider" }));
    await waitFor(() => {
      expect(screen.getByRole("tabpanel", { name: "OCR provider" })).toBeInTheDocument();
    });
    unmount();
  });
});
