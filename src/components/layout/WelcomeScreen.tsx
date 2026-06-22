import { useRef, type ChangeEvent, type CSSProperties, type DragEvent } from "react";
import type { RecentPdfFile } from "../../shared/settings/types";
import { useI18n } from "../../shared/i18n/useI18n";
import "./WelcomeScreen.css";

/**
 * ISS-NEW-G（Wave 3 W1 / 2026-06-22 收口）：PDF Expert 风格 Welcome 屏。
 *
 * 严格子集（仅 Welcome）：
 *   1) 顶部「转换」区：2 张卡片「图片转 PDF」「Word 转 PDF」（占位 — 真实转换 out of scope）
 *   2) 中部大蓝色「选择文件」按钮 + drop zone
 *   3) 底部「最近」：最多 4 张缩略图网格 + 右上「清除最近」链接
 *
 * 2026-06-22 收口：所有用户可见字符串从 useI18n() 字典查表，支持 zh-CN / en 切换。
 */

export interface WelcomeScreenProps {
  /** 最近文件列表（来自 settings.recentFiles）。空数组时隐藏「最近」段。 */
  recentFiles: RecentPdfFile[];
  /** 用户通过「选择文件」按钮 / drop zone 选中或拖入文件时回调。 */
  onOpenFile?: (file: File) => void | Promise<void>;
  /** 用户点击最近缩略图时回调（当前仅反馈，真实打开需 reader.openFile 链）。 */
  onOpenRecent?: (entry: RecentPdfFile) => void;
  /** 用户点击「清除最近」时回调。 */
  onClearRecent?: () => void;
  /** 用户点击「图片转 PDF」卡片时回调（占位）。 */
  onConvertFromImages?: () => void;
  /** 用户点击「Word 转 PDF」卡片时回调（占位）。 */
  onConvertFromWord?: () => void;
}

const fileInputStyle: CSSProperties = {
  height: 1,
  opacity: 0,
  position: "absolute",
  width: 1,
};

/** Welcome 屏最近文件区最大展示数量 */
const RECENT_PREVIEW_LIMIT = 4;

export function WelcomeScreen({
  recentFiles,
  onOpenFile,
  onOpenRecent,
  onClearRecent,
  onConvertFromImages,
  onConvertFromWord,
}: WelcomeScreenProps) {
  const dict = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void onOpenFile?.(file);
      event.target.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find(
      (droppedFile) =>
        droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith(".pdf"),
    );
    if (file) {
      void onOpenFile?.(file);
    }
  }

  const visibleRecent = recentFiles.slice(0, RECENT_PREVIEW_LIMIT);
  const hasRecent = visibleRecent.length > 0;

  return (
    <main className="welcome" aria-label="Welcome 屏">
      {/* 段 1：转换卡片（占位 — 真实转换 out of scope） */}
      <section className="welcome__convert" aria-label={dict.welcome.convertSection}>
        <div className="welcome__convert-grid">
          <button
            className="welcome-convert-card"
            data-testid="welcome-convert-images"
            onClick={onConvertFromImages}
            type="button"
          >
            <span className="welcome-convert-card__icon" aria-hidden="true">🖼️</span>
            <span className="welcome-convert-card__title">{dict.welcome.convertImagesTitle}</span>
            <span className="welcome-convert-card__subtitle">{dict.welcome.convertImagesSubtitle}</span>
          </button>
          <button
            className="welcome-convert-card"
            data-testid="welcome-convert-word"
            onClick={onConvertFromWord}
            type="button"
          >
            <span className="welcome-convert-card__icon" aria-hidden="true">📄</span>
            <span className="welcome-convert-card__title">{dict.welcome.convertWordTitle}</span>
            <span className="welcome-convert-card__subtitle">{dict.welcome.convertWordSubtitle}</span>
          </button>
        </div>
      </section>

      {/* 段 2：中部 drop zone + 大蓝色「选择文件」按钮 */}
      <section
        className="welcome__dropzone"
        aria-label={dict.welcome.openDocument}
        data-testid="welcome-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          accept="application/pdf,.pdf"
          aria-label={dict.welcome.fileInputAria}
          data-testid="welcome-file-input"
          onChange={handleFileChange}
          style={fileInputStyle}
          type="file"
        />
        <p className="welcome__dropzone-hint">{dict.welcome.dropHint}</p>
        <button
          className="welcome__primary-button"
          data-testid="welcome-choose-file"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {dict.welcome.chooseFile}
        </button>
      </section>

      {/* 段 3：最近 — 4 张缩略图网格 + 右上「清除最近」 */}
      {hasRecent ? (
        <section className="welcome__recent" aria-label={dict.welcome.recentSection}>
          <header className="welcome__recent-header">
            <h3 className="welcome__recent-title">{dict.welcome.recentSection}</h3>
            <button
              className="welcome__recent-clear"
              data-testid="welcome-clear-recent"
              onClick={onClearRecent}
              type="button"
            >
              {dict.welcome.clearRecent}
            </button>
          </header>
          <ul className="welcome__recent-grid" data-testid="welcome-recent-grid">
            {visibleRecent.map((entry) => (
              <li key={entry.path} className="welcome-recent-tile">
                <button
                  className="welcome-recent-tile__button"
                  data-testid="welcome-recent-tile"
                  data-recent-path={entry.path}
                  onClick={() => onOpenRecent?.(entry)}
                  type="button"
                >
                  <span className="welcome-recent-tile__thumb" aria-hidden="true">
                    {entry.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="welcome-recent-tile__name" title={entry.name}>
                    {entry.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
