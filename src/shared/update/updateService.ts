import type {
  AppUpdateApplyResult,
  AppUpdateCapability,
  AppUpdateCheckOutcome,
  AppUpdateClient,
  AppUpdateProgress,
} from "./types";
import { detectUpdateCapability } from "./updateCapability";

/**
 * Tauri updater 插件的事件子集（与 @tauri-apps/plugin-updater 的 DownloadEvent 同步）。
 * 不直接 import plugin-updater 的类型是为了避免在没有 tauri 上下文的环境（普通浏览器 / SSR）
 * 引用其类型时把整个 plugin 链拖进类型图谱。
 */
type TauriUpdateEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

interface UpdateLike {
  currentVersion: string;
  version: string;
  body?: string;
  downloadAndInstall: (
    onEvent?: (event: TauriUpdateEvent) => void,
    options?: { headers?: HeadersInit; timeout?: number },
  ) => Promise<void>;
  close(): Promise<void>;
}

interface CheckFn {
  (options?: {
    headers?: HeadersInit;
    timeout?: number;
    proxy?: string;
    target?: string;
    allowDowngrades?: boolean;
  }): Promise<UpdateLike | null>;
}

interface TauriPluginModule {
  check: CheckFn;
}

async function loadPluginModule(): Promise<TauriPluginModule> {
  // 动态 import 让 vite 在普通浏览器 / 测试环境不会把 plugin-updater 打进主 bundle；
  // 同时 SSR / 单元测试可以走 mock 路径（参见 updateService.test.ts）。
  return (await import("@tauri-apps/plugin-updater")) as TauriPluginModule;
}

/**
 * 把 plugin-updater 的「每帧事件」聚合成本地累计 progress。
 *
 * plugin-updater v2 的 DownloadEvent 是单帧事件（Progress 仅给出 chunkLength），
 * 没有 AsyncIterable；本适配器维护一个累加器，把累计结果推给上层 `onProgress`。
 */
function createProgressAdapter(
  onProgress: (progress: AppUpdateProgress) => void,
): (event: TauriUpdateEvent) => void {
  let downloadedBytes = 0;
  let totalBytes: number | undefined;
  return (event) => {
    if (event.event === "Started") {
      totalBytes =
        typeof event.data.contentLength === "number" ? event.data.contentLength : undefined;
      downloadedBytes = 0;
      onProgress({ downloadedBytes, totalBytes });
    } else if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress({ downloadedBytes, totalBytes });
    } else if (event.event === "Finished") {
      onProgress({ downloadedBytes, totalBytes });
    }
  };
}

/**
 * 默认 client：薄封装 `@tauri-apps/plugin-updater`。
 *
 * 业务侧不应直接接触 `Update` 实例；本 client 把所有原始 API 转成稳定的
 * `AppUpdateCheckOutcome` / `AppUpdateApplyResult` 类型，便于 UI 收敛分支。
 * 测试可通过实现 `AppUpdateClient` 接口注入替身（参见 AboutSection.test.tsx）。
 */
export function createTauriUpdateClient(): AppUpdateClient {
  return {
    async detectCapability(): Promise<AppUpdateCapability> {
      return await detectUpdateCapability();
    },

    async checkForAppUpdate(): Promise<AppUpdateCheckOutcome> {
      const capability = await detectUpdateCapability();
      if (!capability.inTauri || !capability.endpointConfigured) {
        return {
          kind: "unsupported",
          reason: "当前环境不支持应用内自动更新（需在 Tauri 桌面端运行）。",
        };
      }

      let plugin: TauriPluginModule;
      try {
        plugin = await loadPluginModule();
      } catch (error) {
        return { kind: "error", message: describeError(error) };
      }

      try {
        const result = await plugin.check();
        if (!result) {
          const metadata = await readAppVersionSafely();
          return { kind: "latest", currentVersion: metadata };
        }
        return {
          kind: "available",
          currentVersion: result.currentVersion,
          availableVersion: result.version,
          releaseNotes: result.body ?? undefined,
        };
      } catch (error) {
        return { kind: "error", message: describeError(error) };
      }
    },

    async downloadAndInstallUpdate(
      onProgress?: (progress: AppUpdateProgress) => void,
    ): Promise<AppUpdateApplyResult> {
      const capability = await detectUpdateCapability();
      if (!capability.inTauri || !capability.endpointConfigured) {
        return {
          kind: "error",
          message: "当前环境不支持应用内自动更新（需在 Tauri 桌面端运行）。",
        };
      }

      let plugin: TauriPluginModule;
      try {
        plugin = await loadPluginModule();
      } catch (error) {
        return { kind: "error", message: describeError(error) };
      }

      // ISS-021 增量更新失败回退：首次尝试失败后自动重试一次完整下载。
      // tauri-plugin-updater 内部已有 chunk 级别重试；此处是 chunk 重试用尽后的兜底。
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await plugin.check();
          if (!result) {
            return { kind: "error", message: "未检测到可用更新。" };
          }
          const adapter = onProgress ? createProgressAdapter(onProgress) : undefined;
          await result.downloadAndInstall(adapter);
          return { kind: "installed" };
        } catch (error) {
          const rawMessage = describeError(error);
          if (attempt === 0) {
            // 首次失败：继续循环进入第二次尝试
            continue;
          }
          // 第二次也失败：返回 fallback 结果
          const message = classifyFallbackMessage(sanitizeErrorMessage(rawMessage));
          return {
            kind: "fallback",
            message,
            releasesUrl: GITHUB_RELEASES_URL,
          };
        }
      }

      // 理论上不可达（循环必在 return/continue 中退出），TS 需要兜底。
      return { kind: "error", message: "更新失败。" };
    },
  };
}

async function readAppVersionSafely(): Promise<string> {
  try {
    const { readAppMetadata } = await import("../app/metadata");
    return readAppMetadata().version;
  } catch {
    return "0.0.0";
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}

const GITHUB_RELEASES_URL = "https://github.com/cat-xierluo/FaroPDF/releases";

/**
 * 分类更新错误为用户友好的消息（与 Rust 端 `update_fallback.rs` 同步的分类规则）。
 */
function classifyFallbackMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("chunk") || lower.includes("retry")) {
    return "增量更新下载重试已用尽，正在回退到完整安装包。";
  }
  if (
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("connection") ||
    lower.includes("timed out")
  ) {
    return "网络连接中断，正在回退到完整安装包。";
  }
  if (
    lower.includes("signature") ||
    lower.includes("hash mismatch") ||
    lower.includes("checksum")
  ) {
    return "更新包签名校验失败，正在回退到完整安装包。";
  }
  if (lower.includes("cancel") || lower.includes("abort")) {
    return "用户已取消更新。";
  }
  return "更新失败，正在回退到完整安装包。";
}

/**
 * 脱敏错误消息：移除本地路径和 URL query 参数。
 */
function sanitizeErrorMessage(message: string): string {
  let result = message;
  // 替换常见路径前缀
  result = result.replace(/\/Users\/[^\s]+/g, "[path]");
  result = result.replace(/\/home\/[^\s]+/g, "[path]");
  result = result.replace(/\/tmp\/[^\s]+/g, "[path]");
  result = result.replace(/\/var\/folders\/[^\s]+/g, "[path]");
  result = result.replace(/C:\\Users\\[^\s]+/g, "[path]");
  // 移除 URL query 参数（含 token）
  result = result.replace(/\?[^\s]+/, "");
  // 截断
  if (result.length > 200) {
    result = result.slice(0, 200) + "…";
  }
  return result;
}
