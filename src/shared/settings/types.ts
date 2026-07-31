import type { OcrProviderConfig } from "../ocr/types";
import type { PdfViewMode } from "../pdf/types";

export type DefaultSavePolicy = "always-export-copy" | "ask-each-time" | "allow-overwrite-with-confirmation";
export type AppThemePreference = "light" | "dark";
/** ISS-NEW-G：界面语言（状态栏 toggle 切换 + appSettings 持久化）。全量字符串 i18n 留后续。 */
export type AppLanguage = "en" | "zh-CN";
/** ISS-NEW-G（2026-06-22 收口）：外部 PDF 打开方式偏好（双击 PDF 时路由）。 */
export type PdfOpenMode = "always-external" | "system-default" | "ask-each-time";
/** ISS-NEW-G（2026-06-22 收口）：页码指示符显示风格（状态栏页码字段）。 */
export type PageNumberIndicator = "current-only" | "current-of-total" | "page-prefix";

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
  /** ISS-NEW-G：默认作者名（写 PDF metadata 时预填）。可选。 */
  documentAuthor?: string;
  /**
   * ISS-NEW-G（2026-06-22 收口）：默认 PDF 查看应用（macOS LaunchServices 应用标识，
   * 如 `com.adobe.Reader`）。留空走系统默认。真实读写 macOS LaunchServices 留后续。
   */
  defaultPdfViewer?: string;
  /** ISS-NEW-G（2026-06-22 收口）：外部 PDF 打开方式偏好。默认 "ask-each-time"。 */
  pdfOpenMode: PdfOpenMode;
  /**
   * ISS-NEW-G（2026-06-22 收口）：重新打开 PDF 时是否回到上次阅读位置。默认 true（用户体验友好）。
   */
  resumeLastPage: boolean;
  /** ISS-NEW-G（2026-06-22 收口）：页码指示符显示风格（状态栏页码字段）。默认 "current-of-total"。 */
  pageNumberIndicator: PageNumberIndicator;
}
