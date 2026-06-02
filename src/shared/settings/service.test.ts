import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultAppSettings } from "./defaults";
import { createSettingsService, type SettingsBackend } from "./service";

describe("settings service", () => {
  let backend: SettingsBackend;

  beforeEach(() => {
    backend = {
      readSettings: vi.fn(),
      writeSettings: vi.fn(),
    };
  });

  test("reads default settings when no persisted settings exist", async () => {
    vi.mocked(backend.readSettings).mockResolvedValue(null);
    const service = createSettingsService(backend);

    const settings = await service.readSettings();

    expect(settings.defaultSavePolicy).toBe("always-export-copy");
    expect(settings.defaultOcrProviderId).toBe("local-ocrmypdf");
    expect(settings.requireNetworkOcrConfirmation).toBe(true);
  });

  test("updates settings through a sanitized storage view", async () => {
    const rawKey = "paddle-secret-123456";
    vi.mocked(backend.writeSettings).mockImplementation(async (settings) => settings);
    const service = createSettingsService(backend);
    const settings = createDefaultAppSettings();
    settings.defaultOcrProviderId = "paddleocr";
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            enabled: true,
            endpoint: "https://ocr.example.test/paddle",
            apiKeyRef: rawKey,
          }
        : provider,
    );

    const updated = await service.updateSettings(settings);

    expect(backend.writeSettings).toHaveBeenCalledTimes(1);
    const stored = vi.mocked(backend.writeSettings).mock.calls[0]?.[0];
    expect(JSON.stringify(stored)).not.toContain(rawKey);
    expect(stored?.ocrProviders.find((provider) => provider.id === "paddleocr")?.apiKeyRef).toBe("padd...3456");
    expect(JSON.stringify(updated)).not.toContain(rawKey);
  });

  test("rejects invalid settings without leaking raw keys", async () => {
    const rawKey = "mineru-secret-abcdef";
    const service = createSettingsService(backend);
    const settings = createDefaultAppSettings();
    settings.defaultOcrProviderId = "mineru";
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "mineru"
        ? {
            ...provider,
            enabled: true,
            endpoint: "",
            apiKeyRef: rawKey,
          }
        : provider,
    );

    await expect(service.updateSettings(settings)).rejects.toThrow("设置校验失败");

    try {
      await service.updateSettings(settings);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(rawKey);
    }
    expect(backend.writeSettings).not.toHaveBeenCalled();
  });
});
