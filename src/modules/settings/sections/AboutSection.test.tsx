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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
    render(
      <AboutSection
        settings={createDefaultAppSettings()}
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
});
