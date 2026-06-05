import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createDefaultAppSettings } from "../../../shared/settings/defaults";
import type {
  AppUpdateApplyResult,
  AppUpdateCapability,
  AppUpdateCheckOutcome,
  AppUpdateClient,
  AppUpdateProgress,
} from "../../../shared/update";
import { AboutSection } from "./AboutSection";

function createMockUpdateClient(overrides?: {
  capability?: AppUpdateCapability;
  outcome?: AppUpdateCheckOutcome;
  applyResult?: AppUpdateApplyResult;
  applyProgress?: AppUpdateProgress[];
}): AppUpdateClient & {
  checkForAppUpdate: ReturnType<typeof vi.fn>;
  downloadAndInstallUpdate: ReturnType<typeof vi.fn>;
} {
  const capability = overrides?.capability ?? { inTauri: true, endpointConfigured: true };
  const outcome: AppUpdateCheckOutcome =
    overrides?.outcome ?? { kind: "latest", currentVersion: "0.1.0" };
  const applyProgress = overrides?.applyProgress ?? [];
  const applyResult: AppUpdateApplyResult = overrides?.applyResult ?? { kind: "installed" };

  const checkForAppUpdate = vi.fn(async () => outcome);
  const downloadAndInstallUpdate = vi.fn(
    async (onProgress?: (p: AppUpdateProgress) => void) => {
      if (onProgress) {
        for (const p of applyProgress) {
          onProgress(p);
        }
      }
      return applyResult;
    },
  );
  return {
    detectCapability: vi.fn(async () => capability),
    checkForAppUpdate,
    downloadAndInstallUpdate,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AboutSection", () => {
  test("renders app name, version, homepage and repository link", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);

    expect(screen.getByText("FaroPDF").tagName).toMatch(/H3/);
    expect(screen.getByText(/^0\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "官网" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com/cat-xierluo/FaroPDF"),
    );
    expect(screen.getByRole("link", { name: "GitHub 仓库" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com/cat-xierluo/FaroPDF"),
    );
  });

  test("renders app icon with alt text", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    const icon = screen.getByAltText("FaroPDF 应用图标");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName).toBe("IMG");
  });

  test("renders author card with GitHub link when configured", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(screen.getByTestId("about-author")).toHaveTextContent(/maoking|GitHub/);
  });

  test("author card includes a WeChat QR image with descriptive alt text", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    const author = screen.getByTestId("about-author");
    const qrImage = author.querySelector("img");
    expect(qrImage).not.toBeNull();
    expect(qrImage?.getAttribute("alt")).toMatch(/微信|WeChat/);
    expect(qrImage?.getAttribute("src")).toMatch(/wechat-qrcode/);
  });

  test("author card surfaces the scan instruction text", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(screen.getByTestId("about-author")).toHaveTextContent(/微信扫码|关注/);
  });

  test("does not render the legacy placeholder footnote about future iterations", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(
      screen.queryByText(/作者卡暂为占位，公众号二维码和详细联系方式将在后续迭代补齐/),
    ).not.toBeInTheDocument();
  });

  test("check update shows unsupported when not running in Tauri", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      capability: { inTauri: false, endpointConfigured: false },
      outcome: { kind: "unsupported", reason: "test reason" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));

    expect(client.checkForAppUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("当前环境不支持自动更新")).toBeInTheDocument();
    expect(screen.getByText("test reason")).toBeInTheDocument();
  });

  test("check update shows latest status when current version is up to date", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: { kind: "latest", currentVersion: "0.1.0" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));

    await waitFor(() => {
      expect(screen.getByText("已是最新版本")).toBeInTheDocument();
    });
    expect(screen.getByText(/当前版本 0\.1\.0/)).toBeInTheDocument();
    expect(screen.queryByTestId("about-install-update")).not.toBeInTheDocument();
  });

  test("check update shows install button when an update is available", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
        releaseNotes: "新增搜索功能",
      },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));

    await waitFor(() => {
      expect(screen.getByTestId("about-install-update")).toBeInTheDocument();
    });
    expect(screen.getByText(/0\.1\.0 升级到 0\.2\.0/)).toBeInTheDocument();
  });

  test("check update surfaces error message from the service", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: { kind: "error", message: "network unreachable" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));

    await waitFor(() => {
      expect(screen.getByText("检查更新失败")).toBeInTheDocument();
    });
    expect(screen.getByText("network unreachable")).toBeInTheDocument();
  });

  test("install button triggers download with progress and reaches downloaded state", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      },
      applyProgress: [
        { downloadedBytes: 0, totalBytes: 1000 },
        { downloadedBytes: 500, totalBytes: 1000 },
        { downloadedBytes: 1000, totalBytes: 1000 },
      ],
      applyResult: { kind: "installed" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));
    const installButton = await screen.findByTestId("about-install-update");
    await user.click(installButton);

    expect(client.downloadAndInstallUpdate).toHaveBeenCalledTimes(1);
    expect(client.downloadAndInstallUpdate.mock.calls[0]?.[0]).toBeInstanceOf(Function);

    await waitFor(() => {
      expect(screen.getAllByText(/更新已下载/).length).toBeGreaterThan(0);
    });
  });

  test("install button surfaces error from the service", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      },
      applyResult: { kind: "error", message: "签名校验失败" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));
    const installButton = await screen.findByTestId("about-install-update");
    await user.click(installButton);

    await waitFor(() => {
      expect(screen.getByText("签名校验失败")).toBeInTheDocument();
    });
  });

  // ISS-021 follow-up（DEC-056）：autoUpdateCheck 设置项 + About section 挂载时
  // 自动检查契约。下面 6 项覆盖：toggle 默认值 / 切换持久化 / 自动检查触发 / 关
  // 闭时跳过 / 手动按钮始终可用 / 切换到 false 后再次 mount 仍跳过。

  test("auto-update toggle is on by default", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    const toggle = screen.getByTestId("about-auto-update-toggle").querySelector("input");
    expect(toggle).not.toBeNull();
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  test("toggling auto-update off persists autoUpdateCheck=false via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AboutSection settings={createDefaultAppSettings()} onChange={onChange} />);

    const toggle = screen.getByTestId("about-auto-update-toggle").querySelector("input") as HTMLInputElement;
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as ReturnType<typeof createDefaultAppSettings>;
    expect(next.autoUpdateCheck).toBe(false);
  });

  test("toggling auto-update back on persists autoUpdateCheck=true via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(<AboutSection settings={settings} onChange={onChange} />);

    const toggle = screen.getByTestId("about-auto-update-toggle").querySelector("input") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as ReturnType<typeof createDefaultAppSettings>;
    expect(next.autoUpdateCheck).toBe(true);
  });

  test("auto-checks for updates on mount when autoUpdateCheck is true", async () => {
    const client = createMockUpdateClient({
      outcome: { kind: "latest", currentVersion: "0.1.0" },
    });
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await waitFor(() => {
      expect(client.checkForAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("已是最新版本")).toBeInTheDocument();
  });

  test("does NOT auto-check on mount when autoUpdateCheck is false", async () => {
    const client = createMockUpdateClient({
      outcome: { kind: "latest", currentVersion: "0.1.0" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    // 等待一个 microtask 周期：若有自动检查会在 await 后 resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.checkForAppUpdate).not.toHaveBeenCalled();
    // 状态保持 idle
    expect(screen.getByText("未检查")).toBeInTheDocument();
  });

  test("manual check button still works when autoUpdateCheck is false", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: { kind: "latest", currentVersion: "0.1.0" },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    // 关闭自动检查 → 初始 mount 不调
    expect(client.checkForAppUpdate).not.toHaveBeenCalled();

    // 手动点击按钮 → 仍能触发
    await user.click(screen.getByTestId("about-check-update"));

    await waitFor(() => {
      expect(client.checkForAppUpdate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("已是最新版本")).toBeInTheDocument();
  });

  // ISS-021 增量更新失败回退：9→10 态 fallback 分支测试。

  test("install shows fallback status and GitHub Releases link when fallback result returned", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      },
      applyResult: {
        kind: "fallback",
        message: "网络连接中断，正在回退到完整安装包。",
        releasesUrl: "https://github.com/cat-xierluo/FaroPDF/releases",
      },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));
    const installButton = await screen.findByTestId("about-install-update");
    await user.click(installButton);

    await waitFor(() => {
      expect(screen.getByText("正在回退到完整安装…")).toBeInTheDocument();
    });
    expect(screen.getByText(/网络连接中断/)).toBeInTheDocument();
    const fallbackLink = screen.getByTestId("about-fallback-releases-link");
    expect(fallbackLink).toHaveAttribute(
      "href",
      "https://github.com/cat-xierluo/FaroPDF/releases",
    );
  });

  test("fallback status does not show install button", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      },
      applyResult: {
        kind: "fallback",
        message: "增量更新下载重试已用尽，正在回退到完整安装包。",
        releasesUrl: "https://github.com/cat-xierluo/FaroPDF/releases",
      },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));
    const installButton = await screen.findByTestId("about-install-update");
    await user.click(installButton);

    await waitFor(() => {
      expect(screen.getByText("正在回退到完整安装…")).toBeInTheDocument();
    });
    // fallback 状态下不应显示"下载并安装"按钮
    expect(screen.queryByTestId("about-install-update")).not.toBeInTheDocument();
  });

  test("check update button is re-enabled after fallback", async () => {
    const user = userEvent.setup();
    const client = createMockUpdateClient({
      outcome: {
        kind: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      },
      applyResult: {
        kind: "fallback",
        message: "更新包签名校验失败，正在回退到完整安装包。",
        releasesUrl: "https://github.com/cat-xierluo/FaroPDF/releases",
      },
    });
    const settings = { ...createDefaultAppSettings(), autoUpdateCheck: false };
    render(
      <AboutSection
        settings={settings}
        onChange={() => undefined}
        updateClient={client}
      />,
    );

    await user.click(screen.getByTestId("about-check-update"));
    const installButton = await screen.findByTestId("about-install-update");
    await user.click(installButton);

    await waitFor(() => {
      expect(screen.getByText("正在回退到完整安装…")).toBeInTheDocument();
    });

    // 检查更新按钮应可再次点击
    const checkButton = screen.getByTestId("about-check-update");
    expect(checkButton).not.toBeDisabled();
  });
});
