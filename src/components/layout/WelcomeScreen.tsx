import { useRef, type ChangeEvent, type CSSProperties, type DragEvent } from "react";
import type { RecentPdfFile } from "../../shared/settings/types";
import "./WelcomeScreen.css";

/**
 * ISS-NEW-G（Wave 3 W1）：PDF Expert 风格 Welcome 屏。
 *
 * 严格子集（仅 Welcome）：
 *   1) 顶部「转换」区：2 张卡片「图片转 PDF」「Word 转 PDF」（占位 — 真实转换 out of scope）
 *   2) 中部大蓝色「选择文件」按钮 + drop zone
 *   3) 底部「最近」：最多 4 张缩略图网格 + 右上「清除最近」链接
 *
 * 不在本任务范围：语言切换、Preferences 字段、OCR 状态栏光标。
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
      <section className="welcome__convert" aria-label="转换">
        <div className="welcome__convert-grid">
          <button
            className="welcome-convert-card"
            data-testid="welcome-convert-images"
            onClick={onConvertFromImages}
            type="button"
          >
            <span className="welcome-convert-card__icon" aria-hidden="true">🖼️</span>
            <span className="welcome-convert-card__title">图片转 PDF</span>
            <span className="welcome-convert-card__subtitle">将多张图片合并为 PDF</span>
          </button>
          <button
            className="welcome-convert-card"
            data-testid="welcome-convert-word"
            onClick={onConvertFromWord}
            type="button"
          >
            <span className="welcome-convert-card__icon" aria-hidden="true">📄</span>
            <span className="welcome-convert-card__title">Word 转 PDF</span>
            <span className="welcome-convert-card__subtitle">将 Word 文档转为 PDF</span>
          </button>
        </div>
      </section>

      {/* 段 2：中部 drop zone + 大蓝色「选择文件」按钮 */}
      <section
        className="welcome__dropzone"
        aria-label="打开 PDF 文档"
        data-testid="welcome-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          accept="application/pdf,.pdf"
          aria-label="选择 PDF 文件"
          data-testid="welcome-file-input"
          onChange={handleFileChange}
          style={fileInputStyle}
          type="file"
        />
        <p className="welcome__dropzone-hint">或将文件拖至此处</p>
        <button
          className="welcome__primary-button"
          data-testid="welcome-choose-file"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          选择文件
        </button>
      </section>

      {/* 段 3：最近 — 4 张缩略图网格 + 右上「清除最近」 */}
      {hasRecent ? (
        <section className="welcome__recent" aria-label="最近">
          <header className="welcome__recent-header">
            <h3 className="welcome__recent-title">最近</h3>
            <button
              className="welcome__recent-clear"
              data-testid="welcome-clear-recent"
              onClick={onClearRecent}
              type="button"
            >
              清除最近
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
