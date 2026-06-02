import { invoke } from "@tauri-apps/api/core";
import {
  exportSafeAppSettings,
  normalizeAppSettings,
  sanitizeAppSettingsForStorage,
  validateAppSettings,
  type SettingsValidationResult,
} from "./defaults";
import type { AppSettings } from "./types";

export interface SettingsBackend {
  readSettings: () => Promise<unknown | null>;
  writeSettings: (settings: AppSettings) => Promise<unknown | null>;
}

export interface SettingsService {
  readSettings: () => Promise<AppSettings>;
  updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  validateSettings: (settings: AppSettings) => SettingsValidationResult;
  exportSafeView: (settings: AppSettings) => AppSettings;
}

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriSettingsBackend(invoker: TauriInvoker = invoke): SettingsBackend {
  return {
    readSettings: () => invoker<unknown | null>("read_app_settings"),
    writeSettings: (settings) => invoker<unknown | null>("write_app_settings", { settings }),
  };
}

export function createSettingsService(backend: SettingsBackend = createTauriSettingsBackend()): SettingsService {
  return {
    async readSettings() {
      const persistedSettings = await backend.readSettings();
      return exportSafeAppSettings(normalizeAppSettings(persistedSettings));
    },

    async updateSettings(settings) {
      const storageSettings = sanitizeAppSettingsForStorage(settings);
      const validation = validateAppSettings(storageSettings);
      if (!validation.valid) {
        throw new Error(`设置校验失败：${validation.errors.join("；")}`);
      }

      const persistedSettings = await backend.writeSettings(storageSettings);
      return exportSafeAppSettings(normalizeAppSettings(persistedSettings ?? storageSettings));
    },

    validateSettings(settings) {
      return validateAppSettings(sanitizeAppSettingsForStorage(settings));
    },

    exportSafeView(settings) {
      return exportSafeAppSettings(settings);
    },
  };
}
