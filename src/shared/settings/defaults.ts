import type { AppSettings } from "./types";

export function createDefaultAppSettings(): AppSettings {
  return {
    defaultZoom: 1,
    defaultViewMode: "continuous",
    defaultSavePolicy: "always-export-copy",
    recentFiles: [],
    defaultOcrProviderId: "local-ocrmypdf",
    requireNetworkOcrConfirmation: true,
    ocrProviders: [
      {
        id: "local-ocrmypdf",
        type: "local-ocrmypdf",
        displayName: "本地 OCRmyPDF",
        enabled: true,
        requiresNetworkConsent: false,
      },
      {
        id: "legal-skills",
        type: "legal-skills",
        displayName: "本地 Legal Skills",
        enabled: true,
        requiresNetworkConsent: false,
      },
      {
        id: "paddleocr",
        type: "paddleocr",
        displayName: "PaddleOCR",
        enabled: false,
        requiresNetworkConsent: true,
      },
      {
        id: "mineru",
        type: "mineru",
        displayName: "MinerU",
        enabled: false,
        requiresNetworkConsent: true,
      },
    ],
  };
}

export function maskSecret(secret: string): string {
  if (secret.length === 0) {
    return "";
  }

  if (secret.length <= 4) {
    return "***";
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
