import type { OcrProviderConfig } from "../ocr/types";
import type { PdfViewMode } from "../pdf/types";

export type DefaultSavePolicy = "always-export-copy" | "ask-each-time" | "allow-overwrite-with-confirmation";
export type AppThemePreference = "light" | "dark";
/** ISS-NEW-G：界面语言（状态栏 toggle 切换 + appSettings 持久化）。全量字符串 i18n 留后续。 */
export type AppLanguage = "en" | "zh-CN";

export interface RecentPdfFile {
  path: string;
  name: string;
  lastOpenedAt: string;
  lastPage?: number;
  lastZoom?: number;
}

export interface AppSettings {
  defaultSaveDirectory?: string;
  defaultZoom: number;
  defaultViewMode: PdfViewMode;
  defaultSavePolicy: DefaultSavePolicy;
  themePreference: AppThemePreference;
  recentFiles: RecentPdfFile[];
  defaultOcrProviderId?: string;
  ocrProviders: OcrProviderConfig[];
  requireNetworkOcrConfirmation: boolean;
  /**
   * ISS-021 follow-up：是否在 About section 挂载时自动调用 `checkForAppUpdate`。
   * 默认 `true`（与 DEC-048 / DEC-056 决策一致）。关闭时仅手动按钮触发检查，
   * 自动检查在 mount 时跳过；切换实时经 `onChange` 路径持久化。
   */
  autoUpdateCheck: boolean;
  /** ISS-NEW-G：界面语言（状态栏 toggle 切换）。默认 "zh-CN"。全量字符串 i18n 留后续。 */
  language: AppLanguage;
}
