import { useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings } from "../../../shared/settings/types";

/**
 * 受控测试包装：用 useState 模拟真实 SettingsPanel 父组件的行为。
 * 父组件收到子组件的 onChange 后更新状态并重渲，使受控 section 在下一个事件
 * 中看到最新的 settings 草稿。
 */
export function ControlledHarness({
  initial,
  children,
}: {
  initial: AppSettings;
  children: (settings: AppSettings, setSettings: (next: AppSettings) => void) => ReactNode;
}) {
  const [settings, setSettings] = useState<AppSettings>(initial);
  return <>{children(settings, setSettings)}</>;
}
