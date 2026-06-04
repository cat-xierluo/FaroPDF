import { afterEach, describe, expect, test, vi } from "vitest";

const isTauriMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

import { detectUpdateCapability } from "./updateCapability";

afterEach(() => {
  isTauriMock.mockReset();
});

describe("detectUpdateCapability", () => {
  test("returns inTauri=false and endpointConfigured=false outside Tauri", async () => {
    isTauriMock.mockResolvedValue(false);

    const capability = await detectUpdateCapability();

    expect(capability).toEqual({ inTauri: false, endpointConfigured: false });
  });

  test("returns inTauri=true and endpointConfigured=true inside Tauri", async () => {
    isTauriMock.mockResolvedValue(true);

    const capability = await detectUpdateCapability();

    expect(capability).toEqual({ inTauri: true, endpointConfigured: true });
  });
});
