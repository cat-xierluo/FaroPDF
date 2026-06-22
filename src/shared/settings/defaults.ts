import type { OcrProviderConfig, OcrProviderType } from "../ocr/types";
import { isAllowedOcrEndpoint, isCredentialReference, isMaskedSecret, isSafeApiKeyRef } from "../ocr/providerSecurity";
import type { PdfViewMode } from "../pdf/types";
import type {
  AppSettings,
  AppThemePreference,
  DefaultSavePolicy,
  PageNumberIndicator,
  PdfExpertOpenMode,
  RecentPdfFile,
} from "./types";

const DEFAULT_RECENT_FILE_LIMIT = 20;
const allowedViewModes = new Set<PdfViewMode>(["continuous", "single", "double", "fit-width"]);
const allowedSavePolicies = new Set<DefaultSavePolicy>([
  "always-export-copy",
  "ask-each-time",
  "allow-overwrite-with-confirmation",
]);
const allowedThemePreferences = new Set<AppThemePreference>(["light", "dark"]);
const allowedPdfExpertOpenModes = new Set<PdfExpertOpenMode>([
  "always-pdf-expert",
  "system-default",
  "ask-each-time",
]);
const allowedPageNumberIndicators = new Set<PageNumberIndicator>([
  "current-only",
  "current-of-total",
  "page-prefix",
]);
const networkProviderTypes = new Set<OcrProviderType>(["paddleocr", "mineru"]);
const localProviderTypes = new Set<OcrProviderType>(["local-ocrmypdf", "legal-skills"]);

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}

function createDefaultOcrProviders(): OcrProviderConfig[] {
  return [
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
      endpoint: "",
      apiKeyRef: "",
      enabled: false,
      requiresNetworkConsent: true,
    },
    {
      id: "mineru",
      type: "mineru",
      displayName: "MinerU",
      endpoint: "",
      apiKeyRef: "",
      enabled: false,
      requiresNetworkConsent: true,
    },
  ];
}

export function createDefaultAppSettings(): AppSettings {
  return {
    defaultZoom: 1,
    defaultViewMode: "continuous",
    defaultSavePolicy: "always-export-copy",
    themePreference: "light",
    recentFiles: [],
    defaultOcrProviderId: "local-ocrmypdf",
    requireNetworkOcrConfirmation: true,
    ocrProviders: createDefaultOcrProviders(),
    autoUpdateCheck: true,
    language: "zh-CN",
    // ISS-NEW-G（2026-06-22 收口）：PDF Expert Preferences 4 字段默认值。
    pdfExpertOpenMode: "ask-each-time",
    resumeLastPage: true,
    pageNumberIndicator: "current-of-total",
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

export function sanitizeApiKeyRefForStorage(apiKeyRef: string | undefined): string | undefined {
  if (apiKeyRef === undefined) {
    return undefined;
  }

  const trimmed = apiKeyRef.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (isCredentialReference(trimmed) || isMaskedSecret(trimmed)) {
    return trimmed;
  }

  return maskSecret(trimmed);
}

export function exportSafeAppSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    recentFiles: settings.recentFiles.map((file) => ({ ...file })),
    ocrProviders: settings.ocrProviders.map((provider) => ({
      ...provider,
      apiKeyRef: sanitizeApiKeyRefForDisplay(provider.apiKeyRef),
    })),
  };
}

export function sanitizeAppSettingsForStorage(settings: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(settings);

  return {
    ...normalized,
    ocrProviders: normalized.ocrProviders.map((provider) => ({
      ...provider,
      apiKeyRef: sanitizeApiKeyRefForStorage(provider.apiKeyRef),
    })),
  };
}

export function normalizeAppSettings(input: unknown): AppSettings {
  const defaults = createDefaultAppSettings();
  if (!isRecord(input)) {
    return defaults;
  }

  return {
    defaultSaveDirectory:
      typeof input.defaultSaveDirectory === "string" ? input.defaultSaveDirectory : defaults.defaultSaveDirectory,
    defaultZoom: typeof input.defaultZoom === "number" ? input.defaultZoom : defaults.defaultZoom,
    defaultViewMode: isPdfViewMode(input.defaultViewMode) ? input.defaultViewMode : defaults.defaultViewMode,
    defaultSavePolicy: isDefaultSavePolicy(input.defaultSavePolicy)
      ? input.defaultSavePolicy
      : defaults.defaultSavePolicy,
    themePreference: isAppThemePreference(input.themePreference)
      ? input.themePreference
      : defaults.themePreference,
    recentFiles: normalizeRecentFiles(input.recentFiles),
    defaultOcrProviderId:
      typeof input.defaultOcrProviderId === "string" ? input.defaultOcrProviderId : defaults.defaultOcrProviderId,
    ocrProviders: normalizeOcrProviders(input.ocrProviders),
    requireNetworkOcrConfirmation:
      typeof input.requireNetworkOcrConfirmation === "boolean"
        ? input.requireNetworkOcrConfirmation
        : defaults.requireNetworkOcrConfirmation,
    autoUpdateCheck:
      typeof input.autoUpdateCheck === "boolean" ? input.autoUpdateCheck : defaults.autoUpdateCheck,
    language:
      input.language === "en" || input.language === "zh-CN" ? input.language : defaults.language,
    documentAuthor:
      typeof input.documentAuthor === "string" ? input.documentAuthor : undefined,
    defaultPdfViewer:
      typeof input.defaultPdfViewer === "string" ? input.defaultPdfViewer : undefined,
    pdfExpertOpenMode: isPdfExpertOpenMode(input.pdfExpertOpenMode)
      ? input.pdfExpertOpenMode
      : defaults.pdfExpertOpenMode,
    resumeLastPage:
      typeof input.resumeLastPage === "boolean" ? input.resumeLastPage : defaults.resumeLastPage,
    pageNumberIndicator: isPageNumberIndicator(input.pageNumberIndicator)
      ? input.pageNumberIndicator
      : defaults.pageNumberIndicator,
  };
}

export function validateAppSettings(settings: AppSettings): SettingsValidationResult {
  const errors: string[] = [];

  if (!Number.isFinite(settings.defaultZoom) || settings.defaultZoom < 0.25 || settings.defaultZoom > 4) {
    errors.push("默认缩放必须在 0.25 到 4 之间。");
  }

  if (!allowedViewModes.has(settings.defaultViewMode)) {
    errors.push("默认阅读模式无效。");
  }

  if (!allowedSavePolicies.has(settings.defaultSavePolicy)) {
    errors.push("默认保存策略无效。");
  }

  if (!allowedThemePreferences.has(settings.themePreference)) {
    errors.push("外观偏好无效。");
  }

  const providerIds = new Set(settings.ocrProviders.map((provider) => provider.id));
  const defaultProvider = settings.ocrProviders.find((provider) => provider.id === settings.defaultOcrProviderId);
  if (settings.defaultOcrProviderId && !providerIds.has(settings.defaultOcrProviderId)) {
    errors.push("默认 OCR 后端不存在。");
  }
  if (defaultProvider && !defaultProvider.enabled) {
    errors.push("默认 OCR 后端必须先启用。");
  }

  for (const provider of settings.ocrProviders) {
    if (provider.id.trim().length === 0) {
      errors.push("OCR Provider 缺少 id。");
    }
    if (provider.displayName.trim().length === 0) {
      errors.push(`${provider.id} 缺少显示名称。`);
    }
    if (networkProviderTypes.has(provider.type) && !provider.requiresNetworkConsent) {
      errors.push(`${provider.displayName} 必须标记为需要联网确认。`);
    }
    if (localProviderTypes.has(provider.type) && provider.requiresNetworkConsent) {
      errors.push(`${provider.displayName} 不应要求联网确认。`);
    }
    if (provider.apiKeyRef && !isSafeApiKeyRef(provider.apiKeyRef)) {
      errors.push(`${provider.displayName} 的 apiKeyRef 必须使用凭证引用或脱敏占位。`);
    }
    if (!provider.enabled || !networkProviderTypes.has(provider.type)) {
      continue;
    }

    if (!isAllowedOcrEndpoint(provider.endpoint)) {
      errors.push(`${provider.displayName} 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。`);
    }
    if (!provider.apiKeyRef || provider.apiKeyRef.trim().length === 0) {
      errors.push(`${provider.displayName} 需要配置 apiKeyRef 或已脱敏密钥占位。`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function sanitizeApiKeyRefForDisplay(apiKeyRef: string | undefined): string | undefined {
  if (!apiKeyRef) {
    return apiKeyRef;
  }

  const trimmed = apiKeyRef.trim();
  if (isCredentialReference(trimmed) || isMaskedSecret(trimmed)) {
    return trimmed;
  }

  return maskSecret(trimmed);
}

function normalizeOcrProviders(input: unknown): OcrProviderConfig[] {
  const defaults = createDefaultOcrProviders();
  if (!Array.isArray(input)) {
    return defaults;
  }

  return defaults.map((defaultProvider) => {
    const incoming = input.find((provider) => isRecord(provider) && provider.id === defaultProvider.id);
    if (!isRecord(incoming)) {
      return defaultProvider;
    }

    return {
      ...defaultProvider,
      endpoint: typeof incoming.endpoint === "string" ? incoming.endpoint : defaultProvider.endpoint,
      apiKeyRef: typeof incoming.apiKeyRef === "string" ? incoming.apiKeyRef : defaultProvider.apiKeyRef,
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : defaultProvider.enabled,
      requiresNetworkConsent:
        typeof incoming.requiresNetworkConsent === "boolean"
          ? incoming.requiresNetworkConsent
          : defaultProvider.requiresNetworkConsent,
    };
  });
}

function normalizeRecentFiles(input: unknown): RecentPdfFile[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((file): file is RecentPdfFile => {
      if (!isRecord(file)) {
        return false;
      }
      return typeof file.path === "string" && typeof file.name === "string" && typeof file.lastOpenedAt === "string";
    })
    .slice(0, DEFAULT_RECENT_FILE_LIMIT)
    .map((file) => ({
      path: file.path,
      name: file.name,
      lastOpenedAt: file.lastOpenedAt,
      lastPage: typeof file.lastPage === "number" ? file.lastPage : undefined,
      lastZoom: typeof file.lastZoom === "number" ? file.lastZoom : undefined,
    }));
}

function isPdfViewMode(value: unknown): value is PdfViewMode {
  return typeof value === "string" && allowedViewModes.has(value as PdfViewMode);
}

function isDefaultSavePolicy(value: unknown): value is DefaultSavePolicy {
  return typeof value === "string" && allowedSavePolicies.has(value as DefaultSavePolicy);
}

function isAppThemePreference(value: unknown): value is AppThemePreference {
  return typeof value === "string" && allowedThemePreferences.has(value as AppThemePreference);
}

function isPdfExpertOpenMode(value: unknown): value is PdfExpertOpenMode {
  return typeof value === "string" && allowedPdfExpertOpenModes.has(value as PdfExpertOpenMode);
}

function isPageNumberIndicator(value: unknown): value is PageNumberIndicator {
  return typeof value === "string" && allowedPageNumberIndicators.has(value as PageNumberIndicator);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
