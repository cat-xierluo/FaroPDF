import { afterEach, describe, expect, test, vi } from "vitest";

const isTauriMock = vi.fn();
const checkMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

import { createTauriUpdateClient } from "./updateService";

afterEach(() => {
  isTauriMock.mockReset();
  checkMock.mockReset();
});

describe("createTauriUpdateClient", () => {
  test("checkForAppUpdate returns unsupported outside Tauri", async () => {
    isTauriMock.mockResolvedValue(false);
    const client = createTauriUpdateClient();

    const result = await client.checkForAppUpdate();

    expect(result.kind).toBe("unsupported");
    expect(checkMock).not.toHaveBeenCalled();
  });

  test("checkForAppUpdate returns latest when plugin reports null", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue(null);
    const client = createTauriUpdateClient();

    const result = await client.checkForAppUpdate();

    expect(result.kind).toBe("latest");
    if (result.kind === "latest") {
      expect(typeof result.currentVersion).toBe("string");
    }
  });

  test("checkForAppUpdate returns available with version metadata", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      body: "release notes",
      downloadAndInstall: vi.fn(),
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.checkForAppUpdate();

    expect(result).toEqual({
      kind: "available",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
      releaseNotes: "release notes",
    });
  });

  test("checkForAppUpdate returns error when plugin throws", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockRejectedValue(new Error("network down"));
    const client = createTauriUpdateClient();

    const result = await client.checkForAppUpdate();

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("network down");
    }
  });

  test("downloadAndInstallUpdate aggregates Progress chunks into cumulative progress", async () => {
    isTauriMock.mockResolvedValue(true);
    const downloadAndInstallMock = vi.fn(
      async (onEvent?: (event: unknown) => void) => {
        if (onEvent) {
          onEvent({ event: "Started", data: { contentLength: 1000 } });
          onEvent({ event: "Progress", data: { chunkLength: 300 } });
          onEvent({ event: "Progress", data: { chunkLength: 400 } });
          onEvent({ event: "Finished" });
        }
      },
    );
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: downloadAndInstallMock,
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const progress: number[] = [];
    const result = await client.downloadAndInstallUpdate((p) => {
      progress.push(p.downloadedBytes);
    });

    expect(result.kind).toBe("installed");
    expect(progress).toEqual([0, 300, 700, 700]);
  });

  test("downloadAndInstallUpdate returns error when no update is available", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue(null);
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("error");
  });

  test("downloadAndInstallUpdate returns error when download throws", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("hash mismatch")),
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.message).toContain("签名校验失败");
      expect(result.releasesUrl).toContain("github.com");
    }
  });

  // ISS-021 增量更新失败回退测试：首次失败后自动重试，两次均失败返回 fallback。
  test("downloadAndInstallUpdate retries once and returns fallback when both attempts fail", async () => {
    isTauriMock.mockResolvedValue(true);
    const downloadAndInstallMock = vi.fn().mockRejectedValue(new Error("network timeout"));
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: downloadAndInstallMock,
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.message).toContain("回退");
      expect(result.releasesUrl).toBe("https://github.com/cat-xierluo/FaroPDF/releases");
    }
    // 首次 + 重试 = 2 次 check + 2 次 downloadAndInstall
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(downloadAndInstallMock).toHaveBeenCalledTimes(2);
  });

  test("downloadAndInstallUpdate succeeds on retry after first failure", async () => {
    isTauriMock.mockResolvedValue(true);
    let callCount = 0;
    const downloadAndInstallMock = vi.fn(async (onEvent?: (event: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("chunk retry failed");
      }
      if (onEvent) {
        onEvent({ event: "Started", data: { contentLength: 100 } });
        onEvent({ event: "Finished" });
      }
    });
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: downloadAndInstallMock,
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("installed");
    expect(downloadAndInstallMock).toHaveBeenCalledTimes(2);
  });

  test("downloadAndInstallUpdate fallback classifies chunk retry errors", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("chunk retry exhausted")),
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.message).toContain("增量更新下载重试");
    }
  });

  test("downloadAndInstallUpdate fallback classifies signature errors", async () => {
    isTauriMock.mockResolvedValue(true);
    checkMock.mockResolvedValue({
      available: true,
      currentVersion: "0.1.0",
      version: "0.2.0",
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("signature verification failed")),
      close: vi.fn(),
    });
    const client = createTauriUpdateClient();

    const result = await client.downloadAndInstallUpdate();

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.message).toContain("签名校验失败");
    }
  });
});
