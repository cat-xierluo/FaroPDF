import { useState } from "react";
import type { OcrProviderConfig } from "../../../shared";
import { sanitizeApiKeyRefForStorage } from "../../../shared/settings/defaults";
import type { AppSettings } from "../../../shared/settings/types";
import type { SectionProps } from "./types";

interface OcrProviderSectionProps extends SectionProps {
  onChange: (next: AppSettings) => void;
}

/**
 * 「OCR provider」section：默认后端、联网确认开关、provider 启用 / 禁
 * 用、网络 provider 的 endpoint + apiKeyRef。所有变更走 onChange 提交草稿。
 */
export function OcrProviderSection({ settings, onChange }: OcrProviderSectionProps) {
  const [pendingApiKeyRefs, setPendingApiKeyRefs] = useState<Record<string, string>>({});
  const defaultProvider = settings.defaultOcrProviderId ?? settings.ocrProviders[0]?.id ?? "";

  function updateSettings(patch: Partial<AppSettings>) {
    onChange({ ...settings, ...patch });
  }

  function updateProvider(providerId: string, patch: Partial<OcrProviderConfig>) {
    onChange({
      ...settings,
      ocrProviders: settings.ocrProviders.map((provider) =>
        provider.id === providerId ? { ...provider, ...patch } : provider,
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
    <section className="settings-section" aria-label="OCR provider">
      <h2 className="settings-section__title">OCR provider</h2>
      <p className="settings-section__hint">默认后端、provider 启用与联网凭证。</p>

      <label className="settings-field" htmlFor="default-ocr-provider">
        <span>默认 OCR 后端</span>
        <select
          id="default-ocr-provider"
          onChange={(event) => updateSettings({ defaultOcrProviderId: event.currentTarget.value })}
          value={defaultProvider}
        >
          {settings.ocrProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-row" htmlFor="network-ocr-confirmation">
        <input
          checked={settings.requireNetworkOcrConfirmation}
          id="network-ocr-confirmation"
          onChange={(event) =>
            updateSettings({ requireNetworkOcrConfirmation: event.currentTarget.checked })
          }
          type="checkbox"
        />
        <span>联网 OCR 需要确认</span>
      </label>

      <div className="settings-list" aria-label="OCR provider 列表">
        {settings.ocrProviders.map((provider) => (
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

      {settings.ocrProviders
        .filter((provider) => provider.requiresNetworkConsent)
        .map((provider) => (
          <section aria-label={`${provider.displayName} 配置`} key={provider.id} className="settings-provider-config">
            <h3>{provider.displayName}</h3>
            <label className="settings-field" htmlFor={`${provider.id}-endpoint`}>
              <span>{provider.displayName} Endpoint</span>
              <input
                id={`${provider.id}-endpoint`}
                onChange={(event) => updateProvider(provider.id, { endpoint: event.currentTarget.value })}
                placeholder="https://ocr.example/api"
                type="url"
                value={provider.endpoint ?? ""}
              />
            </label>
            <label className="settings-field" htmlFor={`${provider.id}-api-key-ref`}>
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
    </section>
  );
}
