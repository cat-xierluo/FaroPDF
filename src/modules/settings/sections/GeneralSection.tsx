import { useState } from "react";
import type { AppSettings, DefaultSavePolicy } from "../../../shared/settings/types";
import type { SectionProps } from "./types";

const savePolicyLabels: Record<DefaultSavePolicy, string> = {
  "always-export-copy": "始终另存副本",
  "ask-each-time": "每次询问",
  "allow-overwrite-with-confirmation": "二次确认后允许覆盖",
};

interface GeneralSectionProps extends SectionProps {
  /** 受控变更：直接触发 settings 草稿更新。 */
  onChange: (next: AppSettings) => void;
}

/**
 * 「常规」section：默认保存策略 + 默认保存目录 + 最近文件列表。
 * 默认保存目录可手填文本，落后于持久化时由调用方兜底。
 */
export function GeneralSection({ settings, onChange }: GeneralSectionProps) {
  const [pendingSaveDir, setPendingSaveDir] = useState(settings.defaultSaveDirectory ?? "");

  function updateSavePolicy(policy: DefaultSavePolicy) {
    onChange({ ...settings, defaultSavePolicy: policy });
  }

  function commitSaveDirectory() {
    const trimmed = pendingSaveDir.trim();
    onChange({
      ...settings,
      defaultSaveDirectory: trimmed.length === 0 ? undefined : trimmed,
    });
  }

  return (
    <section className="settings-section" aria-label="常规">
      <h2 className="settings-section__title">常规</h2>
      <p className="settings-section__hint">默认保存行为、最近打开过的文件。</p>

      <label className="settings-field" htmlFor="default-save-policy">
        <span>默认保存策略</span>
        <select
          id="default-save-policy"
          onChange={(event) => updateSavePolicy(event.currentTarget.value as DefaultSavePolicy)}
          value={settings.defaultSavePolicy}
        >
          {(Object.keys(savePolicyLabels) as DefaultSavePolicy[]).map((policy) => (
            <option key={policy} value={policy}>
              {savePolicyLabels[policy]}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field" htmlFor="default-save-directory">
        <span>默认保存目录（留空跟随系统）</span>
        <input
          id="default-save-directory"
          onBlur={commitSaveDirectory}
          onChange={(event) => setPendingSaveDir(event.currentTarget.value)}
          placeholder="/Users/you/Documents"
          type="text"
          value={pendingSaveDir}
        />
      </label>

      <section className="settings-recent" aria-label="最近文件">
        <h3>最近文件</h3>
        {settings.recentFiles.length === 0 ? (
          <p className="settings-section__empty">暂无最近文件</p>
        ) : (
          <ul className="settings-recent__list">
            {settings.recentFiles.map((file) => (
              <li className="settings-recent__item" key={file.path}>
                <span className="settings-recent__name">{file.name}</span>
                <span className="settings-recent__meta">
                  {file.lastOpenedAt}
                  {typeof file.lastPage === "number" ? ` · 第 ${file.lastPage} 页` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
