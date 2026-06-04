import { isTauri } from "@tauri-apps/api/core";
import type { AppUpdateCapability } from "./types";

/**
 * 当前环境是否支持「应用内检查更新」。
 *
 * Tauri 2 的 `tauri-plugin-updater` 在非 Tauri 环境（普通浏览器 / SSR）下调用会抛错；
 * 业务侧（AboutSection）应当先调本函数，能力不足时把按钮 disable 或切换到「unsupported」态。
 */
export async function detectUpdateCapability(): Promise<AppUpdateCapability> {
  const inTauri = await isTauri();

  if (!inTauri) {
    return { inTauri, endpointConfigured: false };
  }

  // 端点是否配置在 tauri.conf.json 的 plugins.updater.endpoints 字段里。
  // tauri-plugin-updater 在 init 时若 endoints 为空会直接 panic，
  // 我们的 release.yml 总是写入至少一个 GitHub Releases 端点；
  // 这里把探测结果传给 UI 即可，不在运行时读 tauri.conf.json（避免硬编码路径）。
  return { inTauri, endpointConfigured: true };
}
