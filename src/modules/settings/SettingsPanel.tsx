import type { AppSettings } from "../../shared";
import { maskSecret } from "../../shared/settings/defaults";

interface SettingsPanelProps {
  settings: AppSettings;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const defaultProvider = settings.defaultOcrProviderId ?? settings.ocrProviders[0]?.id ?? "";

  return (
    <section className="settings-panel">
      <h2>设置</h2>
      <label className="field" htmlFor="default-ocr-provider">
        <span>默认 OCR 后端</span>
        <select defaultValue={defaultProvider} id="default-ocr-provider">
          {settings.ocrProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="setting-row">
        <input checked={settings.requireNetworkOcrConfirmation} readOnly type="checkbox" />
        <span>联网 OCR 需要确认</span>
      </div>
      <div className="settings-list" aria-label="OCR Provider">
        {settings.ocrProviders.map((provider) => (
          <div className="settings-list__row" key={provider.id}>
            <span>{provider.displayName}</span>
            <span>{provider.enabled ? "已启用" : "未启用"}</span>
            <span>{provider.apiKeyRef ? maskSecret(provider.apiKeyRef) : "未配置"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
