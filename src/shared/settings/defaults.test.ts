import { describe, expect, test } from "vitest";
import {
  createDefaultAppSettings,
  exportSafeAppSettings,
  maskSecret,
  normalizeAppSettings,
  sanitizeAppSettingsForStorage,
  validateAppSettings,
} from "./defaults";

describe("default app settings", () => {
  test("keeps OCR providers disabled unless the user configures them", () => {
    const settings = createDefaultAppSettings();
    const paddleocr = settings.ocrProviders.find((provider) => provider.id === "paddleocr");
    const mineru = settings.ocrProviders.find((provider) => provider.id === "mineru");

    expect(settings.defaultZoom).toBe(1);
    expect(settings.defaultViewMode).toBe("continuous");
    expect(settings.defaultSavePolicy).toBe("always-export-copy");
    expect(settings.themePreference).toBe("light");
    expect(settings.requireNetworkOcrConfirmation).toBe(true);
    expect(settings.autoUpdateCheck).toBe(true);
    expect(settings.recentFiles).toEqual([]);
    expect(settings.ocrProviders.map((provider) => provider.type)).toEqual([
      "local-ocrmypdf",
      "legal-skills",
      "paddleocr",
      "mineru",
    ]);
    expect(
      settings.ocrProviders
        .filter((provider) => provider.requiresNetworkConsent)
        .every((provider) => provider.enabled === false),
    ).toBe(true);
    expect(paddleocr?.endpoint).toBe("");
    expect(paddleocr?.apiKeyRef).toBe("");
    expect(mineru?.endpoint).toBe("");
    expect(mineru?.apiKeyRef).toBe("");
  });

  test("masks API keys before they can be rendered or logged", () => {
    expect(maskSecret("paddle-secret-123456")).toBe("padd...3456");
    expect(maskSecret("abc")).toBe("***");
    expect(maskSecret("")).toBe("");
  });

  test("exports a safe settings view without raw provider keys", () => {
    const rawKey = "paddle-secret-123456";
    const settings = createDefaultAppSettings();
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            endpoint: "https://ocr.example.test/paddle",
            apiKeyRef: rawKey,
          }
        : provider,
    );

    const safe = exportSafeAppSettings(settings);

    expect(JSON.stringify(safe)).not.toContain(rawKey);
    expect(safe.ocrProviders.find((provider) => provider.id === "paddleocr")?.apiKeyRef).toBe("padd...3456");
  });

  test("sanitizes settings before storage so raw provider keys are not persisted", () => {
    const rawKey = "mineru-secret-abcdef";
    const settings = createDefaultAppSettings();
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "mineru"
        ? {
            ...provider,
            endpoint: "https://ocr.example.test/mineru",
            apiKeyRef: rawKey,
          }
        : provider,
    );

    const stored = sanitizeAppSettingsForStorage(settings);

    expect(JSON.stringify(stored)).not.toContain(rawKey);
    expect(stored.ocrProviders.find((provider) => provider.id === "mineru")?.apiKeyRef).toBe("mine...cdef");
  });

  test("normalizes theme preference and keeps legacy payloads light", () => {
    expect(normalizeAppSettings({}).themePreference).toBe("light");
    expect(normalizeAppSettings({ themePreference: "dark" }).themePreference).toBe("dark");
    expect(normalizeAppSettings({ themePreference: "sepia" }).themePreference).toBe("light");
  });

  test("rejects invalid theme preference during validation", () => {
    const settings = createDefaultAppSettings();
    settings.themePreference = "sepia" as never;

    expect(validateAppSettings(settings).errors).toContain("外观偏好无效。");
  });

  test("validates provider configuration without leaking key material", () => {
    const rawKey = "paddle-secret-123456";
    const settings = createDefaultAppSettings();
    settings.defaultOcrProviderId = "paddleocr";
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            enabled: true,
            endpoint: "",
            apiKeyRef: rawKey,
          }
        : provider,
    );

    const result = validateAppSettings(settings);

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("PaddleOCR");
    expect(result.errors.join("\n")).not.toContain(rawKey);
  });

  test("requires secure remote OCR endpoints while allowing localhost HTTP for debugging", () => {
    const settings = createDefaultAppSettings();
    settings.defaultOcrProviderId = "paddleocr";
    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            enabled: true,
            endpoint: "http://ocr.example.test/paddle",
            apiKeyRef: "keychain:paddle",
          }
        : provider,
    );

    expect(validateAppSettings(settings).errors).toContain(
      "PaddleOCR 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。",
    );

    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            endpoint: "http://127.evil.example/paddle",
          }
        : provider,
    );

    expect(validateAppSettings(settings).errors).toContain(
      "PaddleOCR 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。",
    );

    settings.ocrProviders = settings.ocrProviders.map((provider) =>
      provider.id === "paddleocr"
        ? {
            ...provider,
            endpoint: "http://127.0.24.8:8080/paddle",
          }
        : provider,
    );

    expect(validateAppSettings(settings)).toEqual({ valid: true, errors: [] });
  });
});
