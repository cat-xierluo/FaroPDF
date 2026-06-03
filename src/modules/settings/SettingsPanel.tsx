import { useEffect, useMemo, useState } from "react";
import type { OcrProviderConfig } from "../../shared";
import {
  exportSafeAppSettings,
  sanitizeApiKeyRefForStorage,
  validateAppSettings,
} from "../../shared/settings/defaults";
import type { AppSettings, DefaultSavePolicy } from "../../shared/settings/types";
import type { PdfViewMode } from "../../shared/pdf/types";

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange?: (settings: AppSettings) => void;
}

const savePolicyLabels: Record<DefaultSavePolicy, string> = {
  "always-export-copy": "始终另存副本",
  "ask-each-time": "每次询问",
  "allow-overwrite-with-confirmation": "二次确认后允许覆盖",
};

const viewModeLabels: Record<PdfViewMode, string> = {
  continuous: "连续",
  single: "单页",
  double: "双页",
  "fit-width": "适合宽度",
};

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const [draft, setDraft] = useState(() => exportSafeAppSettings(settings));
  const [pendingApiKeyRefs, setPendingApiKeyRefs] = useState<Record<string, string>>({});
  const defaultProvider = draft.defaultOcrProviderId ?? draft.ocrProviders[0]?.id ?? "";
  const validation = useMemo(() => validateAppSettings(draft), [draft]);

  useEffect(() => {
    setDraft(exportSafeAppSettings(settings));
  }, [settings]);

  function emitSettingsChange(nextSettings: AppSettings) {
    const safeSettings = exportSafeAppSettings(nextSettings);
    setDraft(safeSettings);
    onSettingsChange?.(safeSettings);
  }

  function updateSettings(patch: Partial<AppSettings>) {
    emitSettingsChange({
      ...draft,
      ...patch,
    });
  }

  function updateProvider(providerId: string, patch: Partial<OcrProviderConfig>) {
    emitSettingsChange({
      ...draft,
      ocrProviders: draft.ocrProviders.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              ...patch,
            }
          : provider,
      ),
    });
  }

  function commitApiKeyRef(providerId: string) {
    const pendingValue = pendingApiKeyRefs[providerId]?.trim();
    if (!pendingValue) {
      return;
    }

    updateProvider(providerId, {
      apiKeyRef: sanitizeApiKeyRefForStorage(pendingValue),
    });
    setPendingApiKeyRefs((current) => ({
      ...current,
      [providerId]: "",
    }));
  }

  return (
    <section className="settings-panel">
      <h2>设置</h2>
      <label className="field" htmlFor="default-save-policy">
        <span>默认保存策略</span>
        <select
          id="default-save-policy"
          onChange={(event) => updateSettings({ defaultSavePolicy: event.currentTarget.value as DefaultSavePolicy })}
          value={draft.defaultSavePolicy}
        >
          {(Object.keys(savePolicyLabels) as DefaultSavePolicy[]).map((policy) => (
            <option key={policy} value={policy}>
              {savePolicyLabels[policy]}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="default-zoom">
        <span>默认缩放</span>
        <input
          id="default-zoom"
          min="0.25"
          max="4"
          onChange={(event) => updateSettings({ defaultZoom: Number(event.currentTarget.value) })}
          step="0.05"
          type="number"
          value={draft.defaultZoom}
        />
      </label>
      <label className="field" htmlFor="default-view-mode">
        <span>默认阅读模式</span>
        <select
          id="default-view-mode"
          onChange={(event) => updateSettings({ defaultViewMode: event.currentTarget.value as PdfViewMode })}
          value={draft.defaultViewMode}
        >
          {(Object.keys(viewModeLabels) as PdfViewMode[]).map((viewMode) => (
            <option key={viewMode} value={viewMode}>
              {viewModeLabels[viewMode]}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="default-ocr-provider">
        <span>默认 OCR 后端</span>
        <select
          id="default-ocr-provider"
          onChange={(event) => updateSettings({ defaultOcrProviderId: event.currentTarget.value })}
          value={defaultProvider}
        >
          {draft.ocrProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="setting-row" htmlFor="network-ocr-confirmation">
        <input
          checked={draft.requireNetworkOcrConfirmation}
          id="network-ocr-confirmation"
          onChange={(event) => updateSettings({ requireNetworkOcrConfirmation: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>联网 OCR 需要确认</span>
      </label>
      <div className="settings-list" aria-label="OCR Provider">
        {draft.ocrProviders.map((provider) => (
          <div className="settings-list__row" key={provider.id}>
            <label htmlFor={`${provider.id}-enabled`}>
              <input
                checked={provider.enabled}
                id={`${provider.id}-enabled`}
                onChange={(event) => updateProvider(provider.id, { enabled: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>启用 {provider.displayName}</span>
            </label>
            <span>{provider.requiresNetworkConsent ? "联网" : "本地"}</span>
            <span>{provider.enabled ? "已启用" : "未启用"}</span>
          </div>
        ))}
      </div>
      {draft.ocrProviders
        .filter((provider) => provider.requiresNetworkConsent)
        .map((provider) => (
          <section aria-label={`${provider.displayName} 配置`} key={provider.id}>
            <h3>{provider.displayName}</h3>
            <label className="field" htmlFor={`${provider.id}-endpoint`}>
              <span>{provider.displayName} Endpoint</span>
              <input
                id={`${provider.id}-endpoint`}
                onChange={(event) => updateProvider(provider.id, { endpoint: event.currentTarget.value })}
                placeholder="https://ocr.example/api"
                type="url"
                value={provider.endpoint ?? ""}
              />
            </label>
            <label className="field" htmlFor={`${provider.id}-api-key-ref`}>
              <span>{provider.displayName} API Key 引用</span>
              <input
                autoComplete="off"
                id={`${provider.id}-api-key-ref`}
                onBlur={() => commitApiKeyRef(provider.id)}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setPendingApiKeyRefs((current) => ({
                    ...current,
                    [provider.id]: nextValue,
                  }));
                }}
                placeholder={provider.apiKeyRef || "keychain:provider-name 或已脱敏占位"}
                type="password"
                value={pendingApiKeyRefs[provider.id] ?? ""}
              />
            </label>
          </section>
        ))}
      <section aria-label="最近文件">
        <h3>最近文件</h3>
        <p className="panel-placeholder">{draft.recentFiles.length === 0 ? "暂无最近文件" : `${draft.recentFiles.length} 个文件`}</p>
      </section>
      {!validation.valid ? (
        <ul aria-label="设置校验错误">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
