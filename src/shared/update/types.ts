/**
 * 应用内更新流程的共享契约（ISS-021）。
 *
 * 之所以做这一层抽象：Tauri 上层 (`@tauri-apps/plugin-updater`) 直接抛出 `Update` 实例，
 * 业务侧（AboutSection）需要稳定的本地类型；同时让测试可以在不引入 Tauri 上下文的情况下
 * 用内存替身验证 UI 状态机。
 *
 * 现状（v1）：仅暴露「手动检查」和「下载并安装」两个动作，update 状态机由调用方管理；
 * 自动检查（`autoUpdateCheck` 设置项）作为后续 follow-up，本期不实现以避免触碰被禁的
 * `src/shared/settings/`。
 */

/** UI 展示用的更新状态枚举。 */
export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "unsupported"
  | "error";

/** 检查更新的结果（不区分 UI 状态，仅是 outcome）。 */
export type AppUpdateCheckOutcome =
  | { kind: "latest"; currentVersion: string }
  | { kind: "available"; currentVersion: string; availableVersion: string; releaseNotes?: string }
  | { kind: "unsupported"; reason: string }
  | { kind: "error"; message: string };

/** 下载进度事件（聚合自 tauri-plugin-updater 的 chunk 事件）。 */
export interface AppUpdateProgress {
  /** 已经下载的字节数。 */
  downloadedBytes: number;
  /** 整个更新包总字节数（可能为 undefined，Tauri 不一定在 Started 事件里给出）。 */
  totalBytes?: number;
}

/** 下载并安装的结果。 */
export type AppUpdateApplyResult =
  | { kind: "installed" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/** 当前环境是否支持「应用内检查更新」。 */
export interface AppUpdateCapability {
  /** 是否在 Tauri WebView 中（@tauri-apps/api 的 `isTauri()`）。 */
  inTauri: boolean;
  /** updater 端点是否配置（避免 dev mode 启动时报错）。 */
  endpointConfigured: boolean;
}

/** 给 `checkForAppUpdate` / `downloadAndInstallUpdate` 使用的依赖注入接口。 */
export interface AppUpdateClient {
  /** 当前环境是否支持自动更新（不抛错）。 */
  detectCapability(): Promise<AppUpdateCapability>;
  /** 检查更新；返回 outcome 而非抛错，UI 负责把 error 渲染为可读信息。 */
  checkForAppUpdate(): Promise<AppUpdateCheckOutcome>;
  /**
   * 下载并安装更新；安装完成后 Tauri 会请求用户重启应用。
   * `onProgress` 是可选的进度回调，按 chunk 事件聚合。
   */
  downloadAndInstallUpdate(onProgress?: (progress: AppUpdateProgress) => void): Promise<AppUpdateApplyResult>;
}
