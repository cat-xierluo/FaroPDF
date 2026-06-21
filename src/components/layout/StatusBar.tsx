import { formatZoom, textLayerStatusLabels, viewModeLabels } from "../../modules/reader/readerLabels";
import type { ReaderState } from "../../modules/reader/readerState";
import type { AppLanguage } from "../../shared/settings/types";

interface StatusBarProps {
  readerState: ReaderState;
  /** ISS-NEW-G：当前界面语言（来自 appSettings.language）。 */
  language?: AppLanguage;
  /** ISS-NEW-G：用户点击语言 toggle 时回调（外部持久化到 appSettings）。 */
  onLanguageChange?: (next: AppLanguage) => void;
}

const LANGUAGE_OPTIONS: ReadonlyArray<{ id: AppLanguage; label: string }> = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en", label: "English" },
];

export function StatusBar({ readerState, language = "zh-CN", onLanguageChange }: StatusBarProps) {
  const document = readerState.document;
  const zoom = document?.zoom ?? readerState.defaults.zoom;
  const viewMode = document?.viewMode ?? readerState.defaults.viewMode;
  const textLayerStatus = document?.textLayerStatus ?? "unknown";

  return (
    <footer className="status-bar">
      <span>页码：{document ? `${document.currentPage} / ${document.pageCount}` : "-"}</span>
      <span>缩放：{formatZoom(zoom)}</span>
      <span>视图：{viewModeLabels[viewMode]}</span>
      <span>文字层：{textLayerStatusLabels[textLayerStatus]}</span>
      <span>保存：{document?.dirty ? "有未导出改动" : "原始 PDF 未修改"}</span>
      <span className="status-bar__language" aria-label="界面语言">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            aria-pressed={language === option.id}
            className={"status-bar__language-toggle" + (language === option.id ? " status-bar__language-toggle--active" : "")}
            data-language={option.id}
            data-testid={`status-bar-language-${option.id}`}
            disabled={!onLanguageChange || language === option.id}
            key={option.id}
            onClick={() => onLanguageChange?.(option.id)}
            title={`切换到${option.label}`}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </span>
    </footer>
  );
}
