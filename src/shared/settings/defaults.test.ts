import { describe, expect, test } from "vitest";
import { createDefaultAppSettings, maskSecret } from "./defaults";

describe("default app settings", () => {
  test("keeps OCR providers disabled unless the user configures them", () => {
    const settings = createDefaultAppSettings();

    expect(settings.defaultZoom).toBe(1);
    expect(settings.defaultViewMode).toBe("continuous");
    expect(settings.defaultSavePolicy).toBe("always-export-copy");
    expect(settings.requireNetworkOcrConfirmation).toBe(true);
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
  });

  test("masks API keys before they can be rendered or logged", () => {
    expect(maskSecret("paddle-secret-123456")).toBe("padd...3456");
    expect(maskSecret("abc")).toBe("***");
    expect(maskSecret("")).toBe("");
  });
});
