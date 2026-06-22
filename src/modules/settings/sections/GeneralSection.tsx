import { useState } from "react";
import type {
  AppSettings,
  AppThemePreference,
  DefaultSavePolicy,
  PageNumberIndicator,
  PdfExpertOpenMode,
} from "../../../shared/settings/types";
import { useI18n } from "../../../shared/i18n/useI18n";
import type { SectionProps } from "./types";

interface GeneralSectionProps extends SectionProps {
  /** 受控变更：直接触发 settings 草稿更新。 */
  onChange: (next: AppSettings) => void;
}

/**
 * 「常规」section：默认保存策略 + 默认保存目录 + 最近文件列表 + PDF Expert Preferences 5 字段。
 * 默认保存目录可手填文本，落后于持久化时由调用方兜底。
 *
 * ISS-NEW-G（2026-06-22 收口）：所有用户可见字符串从 useI18n() 字典查表。
 * 新增 4 字段：默认 PDF 查看应用 / PDF Expert 打开方式 / 回到页面 / 页码指示符。
 * "关闭文档时的保存方式" 对应现有 `defaultSavePolicy` 字段。
 */
export function GeneralSection({ settings, onChange }: GeneralSectionProps) {
  const dict = useI18n();
  const [pendingSaveDir, setPendingSaveDir] = useState(settings.defaultSaveDirectory ?? "");
  const [pendingPdfViewer, setPendingPdfViewer] = useState(settings.defaultPdfViewer ?? "");

  function updateSavePolicy(policy: DefaultSavePolicy) {
    onChange({ ...settings, defaultSavePolicy: policy });
  }

  function updateThemePreference(themePreference: AppThemePreference) {
    onChange({ ...settings, themePreference });
  }

  function commitSaveDirectory() {
    const trimmed = pendingSaveDir.trim();
    onChange({
      ...settings,
      defaultSaveDirectory: trimmed.length === 0 ? undefined : trimmed,
    });
  }

  function commitPdfViewer() {
    const trimmed = pendingPdfViewer.trim();
    onChange({
      ...settings,
      defaultPdfViewer: trimmed.length === 0 ? undefined : trimmed,
    });
  }

  function updatePdfExpertOpenMode(mode: PdfExpertOpenMode) {
    onChange({ ...settings, pdfExpertOpenMode: mode });
  }

  function updateResumeLastPage(value: boolean) {
    onChange({ ...settings, resumeLastPage: value });
  }

  function updatePageNumberIndicator(indicator: PageNumberIndicator) {
    onChange({ ...settings, pageNumberIndicator: indicator });
  }

  return (
    <section className="settings-section" aria-label={dict.settings.general.title}>
      <h2 className="settings-section__title">{dict.settings.general.title}</h2>
      <p className="settings-section__hint">{dict.settings.general.hint}</p>

      <label className="settings-field" htmlFor="theme-preference">
        <span>{dict.settings.general.theme}</span>
        <select
          id="theme-preference"
          onChange={(event) => updateThemePreference(event.currentTarget.value as AppThemePreference)}
          value={settings.themePreference}
        >
          {(Object.keys(dict.settings.themeOptions) as AppThemePreference[]).map((themePreference) => (
            <option key={themePreference} value={themePreference}>
              {dict.settings.themeOptions[themePreference]}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field" htmlFor="default-save-policy">
        <span>{dict.settings.general.savePolicy}</span>
        <select
          id="default-save-policy"
          onChange={(event) => updateSavePolicy(event.currentTarget.value as DefaultSavePolicy)}
          value={settings.defaultSavePolicy}
        >
          {(Object.keys(dict.settings.savePolicyOptions) as DefaultSavePolicy[]).map((policy) => (
            <option key={policy} value={policy}>
              {dict.settings.savePolicyOptions[policy]}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field" htmlFor="default-save-directory">
        <span>{dict.settings.general.saveDirectory}</span>
        <input
          id="default-save-directory"
          onBlur={commitSaveDirectory}
          onChange={(event) => setPendingSaveDir(event.currentTarget.value)}
          placeholder={dict.settings.general.saveDirectoryPlaceholder}
          type="text"
          value={pendingSaveDir}
        />
      </label>

      <label className="settings-field" htmlFor="default-document-author">
        <span>{dict.settings.general.documentAuthor}</span>
        <input
          id="default-document-author"
          onChange={(event) => onChange({ ...settings, documentAuthor: event.currentTarget.value })}
          placeholder={dict.settings.general.documentAuthorPlaceholder}
          type="text"
          value={settings.documentAuthor ?? ""}
        />
      </label>

      <label className="settings-field" htmlFor="default-pdf-viewer">
        <span>{dict.settings.general.defaultPdfViewer}</span>
        <input
          id="default-pdf-viewer"
          onBlur={commitPdfViewer}
          onChange={(event) => setPendingPdfViewer(event.currentTarget.value)}
          placeholder={dict.settings.general.defaultPdfViewerPlaceholder}
          type="text"
          value={pendingPdfViewer}
        />
      </label>

      <label className="settings-field" htmlFor="pdf-expert-open-mode">
        <span>{dict.settings.general.pdfExpertOpenMode}</span>
        <select
          id="pdf-expert-open-mode"
          onChange={(event) => updatePdfExpertOpenMode(event.currentTarget.value as PdfExpertOpenMode)}
          value={settings.pdfExpertOpenMode}
        >
          {(Object.keys(dict.settings.pdfExpertOpenModeOptions) as PdfExpertOpenMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {dict.settings.pdfExpertOpenModeOptions[mode]}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field" htmlFor="resume-last-page">
        <span>{dict.settings.general.resumeLastPage}</span>
        <input
          checked={settings.resumeLastPage}
          id="resume-last-page"
          onChange={(event) => updateResumeLastPage(event.currentTarget.checked)}
          type="checkbox"
        />
      </label>

      <label className="settings-field" htmlFor="page-number-indicator">
        <span>{dict.settings.general.pageNumberIndicator}</span>
        <select
          id="page-number-indicator"
          onChange={(event) => updatePageNumberIndicator(event.currentTarget.value as PageNumberIndicator)}
          value={settings.pageNumberIndicator}
        >
          {(Object.keys(dict.settings.pageNumberIndicatorOptions) as PageNumberIndicator[]).map((indicator) => (
            <option key={indicator} value={indicator}>
              {dict.settings.pageNumberIndicatorOptions[indicator]}
            </option>
          ))}
        </select>
      </label>

      <section className="settings-recent" aria-label={dict.settings.general.recentSection}>
        <h3>{dict.settings.general.recentSection}</h3>
        {settings.recentFiles.length === 0 ? (
          <p className="settings-section__empty">{dict.settings.general.recentEmpty}</p>
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
