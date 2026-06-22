import { useSyncExternalStore } from "react";
import type { AppLanguage } from "../settings/types";
import { dictionaries, type Dictionary } from "./dictionaries";

/**
 * ISS-NEW-G（2026-06-22 收口）：全量 UI 字符串 i18n runtime。
 *
 * 设计要点：
 *   1. 语言作为 module-level 状态 + listener set，App 顶层 `setCurrentLanguage(settings.language)` 同步
 *   2. 任何 `useI18n()` 订阅当前语言，语言切换触发 useSyncExternalStore 重渲染
 *   3. 不依赖 React Context（避免 provider 嵌套 + 与现有 settings 状态并行维护）
 *   4. 服务端渲染安全：`getServerSnapshot` 与 `getSnapshot` 返回同一字典（v0.2 Tauri 桌面端，无 SSR 场景）
 *   5. 字典查表失败兜底：dictionary[language] 在 `normalizeAppSettings` 已经限定为 "en" | "zh-CN"
 */

type Listener = () => void;
const listeners = new Set<Listener>();

let currentLanguage: AppLanguage = "zh-CN";

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function setCurrentLanguage(next: AppLanguage): void {
  if (currentLanguage === next) {
    return;
  }
  currentLanguage = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Dictionary {
  return dictionaries[currentLanguage]!;
}

export function useI18n(): Dictionary {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
