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

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("hash mismatch");
    }
  });
});
