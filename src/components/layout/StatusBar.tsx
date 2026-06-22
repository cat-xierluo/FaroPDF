import { useEffect } from "react";
import { useI18n, setCurrentLanguage } from "../../shared/i18n/useI18n";
import { formatZoom } from "../../modules/reader/readerLabels";
import type { ReaderState } from "../../modules/reader/readerState";
import type { AppLanguage } from "../../shared/settings/types";
import type { OcrJobStatus } from "../../shared/ocr/types";
import type { AppModeId } from "./types";

export interface StatusBarOcrState {
  /** 当前阅读器光标所在页码（0-based 或 1-based，由调用方决定）；null 表示无文档。 */
  cursorPage: number | null;
  /** 当前 OCR 任务状态；"idle" 表示无任务或已结束。 */
  jobStatus: OcrJobStatus | "idle";
}

interface StatusBarProps {
  readerState: ReaderState;
  /** ISS-NEW-G：当前界面语言（来自 appSettings.language）。 */
  language?: AppLanguage;
  /** ISS-NEW-G：用户点击语言 toggle 时回调（外部持久化到 appSettings）。 */
  onLanguageChange?: (next: AppLanguage) => void;
  /**
   * ISS-NEW-G（2026-06-22 收口）：当前 app 模式。当 activeMode === "ocr" 时状态栏切到
   * OCR 模式布局（光标位置 + 状态文字），其余模式仍按 read 模式渲染。
   */
  activeMode?: AppModeId;
  /**
   * ISS-NEW-G（2026-06-22 收口）：OCR 模式专用状态。activeMode === "ocr" 时必传，
   * 其他模式可省略。StatusBar 不直接读 OCR controller — 由 AppShell 计算后注入。
   */
  ocrState?: StatusBarOcrState;
}

const LANGUAGE_OPTIONS: ReadonlyArray<{ id: AppLanguage; label: string }> = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en", label: "English" },
];

export function StatusBar({
  readerState,
  language = "zh-CN",
  onLanguageChange,
  activeMode = "read",
  ocrState,
}: StatusBarProps) {
  const dict = useI18n();
  // ISS-NEW-G（2026-06-22 收口）：StatusBar 内部同步 language prop → i18n runtime，
  // 让单测 / 单组件使用时也能正确查表（不依赖外部 AppShell useEffect）。
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);
  const document = readerState.document;
  const zoom = document?.zoom ?? readerState.defaults.zoom;
  const viewMode = document?.viewMode ?? readerState.defaults.viewMode;
  const textLayerStatus = document?.textLayerStatus ?? "unknown";

  const languageToggle = (
    <span className="status-bar__language" aria-label={dict.statusBar.languageToggle}>
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
  );

  if (activeMode === "ocr") {
    const state: StatusBarOcrState = ocrState ?? { cursorPage: null, jobStatus: "idle" };
    const statusText = state.jobStatus === "idle"
      ? dict.ocrStatusBar.statusIdle
      : dict.ocrStatusBar.statusOptions[state.jobStatus];
    return (
      <footer className="status-bar" data-mode="ocr" data-testid="status-bar">
        <span data-testid="status-bar-ocr-cursor">{dict.ocrStatusBar.cursorPage(state.cursorPage)}</span>
        <span data-testid="status-bar-ocr-status">{dict.ocrStatusBar.statusLabel}{statusText}</span>
        {languageToggle}
      </footer>
    );
  }

  return (
    <footer className="status-bar" data-testid="status-bar">
      <span>{dict.statusBar.pageNumber(document?.currentPage ?? null, document?.pageCount ?? null)}</span>
      <span>{dict.statusBar.zoom(formatZoom(zoom))}</span>
      <span>{dict.statusBar.viewMode}{dict.reader.viewModeOptions[viewMode]}</span>
      <span>{dict.statusBar.textLayer}{dict.reader.textLayerStatusOptions[textLayerStatus]}</span>
      <span>{dict.statusBar.save(document?.dirty ?? false)}</span>
      {languageToggle}
    </footer>
  );
}
