import { useRef, type ChangeEvent, type CSSProperties, type DragEvent } from "react";
import "./ReaderErrorScreen.css";

/**
 * ISS-NEW-M M5：阅读区加载失败错误卡片。
 *
 * 触发条件：`reader.state.status === "error"`（`useReaderController` 的 openFile /
 * openNativeFile catch dispatch `reader/loadFailed` 后进入）。在此之前损坏 / 加密等
 * PDF 加载异常会落到 silent failure（ReaderCanvas 只判断 `if (!document)` 渲染
 * WelcomeScreen，errorMessage 无任何消费方）。
 *
 * 范围：展示归一化后的中文 errorMessage，并提供「重新选择文件」入口（隐藏 file input +
 * 拖拽 drop），复用 WelcomeScreen 的 file input 模式。本卡不做密码输入 modal（加密 PDF
 * 仅在 normalizeError 层识别为 EncryptionError，密码 PDF 留作 M5 后续独立项）。
 */
export interface ReaderErrorScreenProps {
  /** 归一化后的中文错误文案（来自 `friendlyMessageForCode(normalizeError(error))`）。 */
  errorMessage: string;
  /** 用户通过「重新选择文件」按钮 / drop zone 选中或拖入文件时回调，接回 reader.openFile。 */
  onOpenFile?: (file: File) => void | Promise<void>;
}

const fileInputStyle: CSSProperties = {
  height: 1,
  opacity: 0,
  position: "absolute",
  width: 1,
};

export function ReaderErrorScreen({ errorMessage, onOpenFile }: ReaderErrorScreenProps) {
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

  return (
    <main className="reader" aria-label="PDF 阅读区">
      <section
        className="reader-error"
        aria-label="PDF 打开失败"
        data-testid="reader-error-screen"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        role="alert"
      >
        <span className="reader-error__icon" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="reader-error__title">无法打开此 PDF</h2>
        <p className="reader-error__message" data-testid="reader-error-message">
          {errorMessage}
        </p>
        <input
          ref={fileInputRef}
          accept="application/pdf,.pdf"
          aria-label="重新选择 PDF 文件"
          className="reader-error__file-input"
          data-testid="reader-error-file-input"
          onChange={handleFileChange}
          style={fileInputStyle}
          type="file"
        />
        <button
          className="reader-error__retry"
          data-testid="reader-error-retry"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          重新选择文件
        </button>
      </section>
    </main>
  );
}
