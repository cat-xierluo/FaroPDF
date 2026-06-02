import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createDefaultAppSettings } from "../../shared/settings/defaults";
import type { AppSettings } from "../../shared/settings/types";
import { SettingsPanel } from "./SettingsPanel";

function settingsWithRawPaddleKey() {
  const settings = createDefaultAppSettings();
  settings.ocrProviders = settings.ocrProviders.map((provider) =>
    provider.id === "paddleocr"
      ? {
          ...provider,
          enabled: true,
          endpoint: "https://ocr.example.test/paddle",
          apiKeyRef: "paddle-secret-123456",
        }
      : provider,
  );
  return settings;
}

describe("SettingsPanel", () => {
  test("renders OCR provider settings without exposing a full API key", () => {
    render(<SettingsPanel settings={settingsWithRawPaddleKey()} />);

    expect(screen.getByLabelText("默认 OCR 后端")).toBeInTheDocument();
    expect(screen.getByLabelText("默认保存策略")).toBeInTheDocument();
    expect(screen.getByLabelText("默认缩放")).toBeInTheDocument();
    expect(screen.getByLabelText("默认阅读模式")).toBeInTheDocument();
    expect(screen.getByLabelText("PaddleOCR API Key 引用")).toHaveAttribute("placeholder", "padd...3456");
    expect(screen.queryByDisplayValue("paddle-secret-123456")).not.toBeInTheDocument();
    expect(screen.queryByText("paddle-secret-123456")).not.toBeInTheDocument();
  });

  test("edits provider enablement, endpoint, key reference and network confirmation", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn<(settings: AppSettings) => void>();
    render(<SettingsPanel settings={createDefaultAppSettings()} onSettingsChange={onSettingsChange} />);

    await user.click(screen.getByLabelText("启用 PaddleOCR"));
    await user.type(screen.getByLabelText("PaddleOCR Endpoint"), "https://ocr.example.test/paddle");
    await user.type(screen.getByLabelText("PaddleOCR API Key 引用"), "paddle-secret-123456");
    await user.tab();
    await user.click(screen.getByLabelText("联网 OCR 需要确认"));

    const lastSettings = onSettingsChange.mock.calls.at(-1)?.[0];
    const paddleocr = lastSettings?.ocrProviders.find((provider) => provider.id === "paddleocr");

    expect(paddleocr?.enabled).toBe(true);
    expect(paddleocr?.endpoint).toBe("https://ocr.example.test/paddle");
    expect(paddleocr?.apiKeyRef).toBe("padd...3456");
    expect(JSON.stringify(lastSettings)).not.toContain("paddle-secret-123456");
    expect(lastSettings?.requireNetworkOcrConfirmation).toBe(false);
  });
});
