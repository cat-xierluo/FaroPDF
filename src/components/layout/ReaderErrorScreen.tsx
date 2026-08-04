import { useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type FormEvent } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { useI18n } from "../../shared/i18n/useI18n";
import "./ReaderErrorScreen.css";

/**
 * ISS-NEW-M M5：阅读区加载失败错误卡片。
 *
 * 两种态：
 * 1. **密码提示态**（`passwordChallenge` 存在）：加密 PDF 打开时，渲染密码输入框 +
 *    提交 / 取消。提交复用 reader 缓存的源 bytes 带密码重试（成功打开 / 错误密码再提示）。
 *    `reason` 对齐 PDF.js PasswordResponses：1=需要密码，2=密码错误（据此切换提示文案）。
 * 2. **错误态**（无 passwordChallenge）：损坏等加载失败，展示归一化后的中文 errorMessage +
 *    「重新选择文件」入口（隐藏 file input + 拖拽 drop），复用 WelcomeScreen 的 file input 模式。
 */
export interface ReaderErrorScreenProps {
  /** 归一化后的中文错误文案（来自 `friendlyMessageForCode(normalizeError(error))`）。 */
  errorMessage: string;
  /** 用户通过「重新选择文件」按钮 / drop zone 选中或拖入文件时回调，接回 reader.openFile。 */
  onOpenFile?: (file: File) => void | Promise<void>;
  /** 加密 PDF 进入「等待密码」态；存在时渲染密码输入框而非错误文案。 */
  passwordChallenge?: { reason: number };
  /** 用户提交密码时回调，接回 reader.submitPassword（带密码重试加载）。 */
  onSubmitPassword?: (password: string) => void | Promise<void>;
  /** 用户取消密码输入时回调，接回 reader.cancelPassword（回到错误态）。 */
  onCancelPassword?: () => void;
}

const fileInputStyle: CSSProperties = {
  height: 1,
  opacity: 0,
  position: "absolute",
  width: 1,
};

export function ReaderErrorScreen({
  errorMessage,
  onOpenFile,
  passwordChallenge,
  onSubmitPassword,
  onCancelPassword,
}: ReaderErrorScreenProps) {
  const dict = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");

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

  // 密码提示态：reason=2（密码错误）用错密码提示，否则用「需要密码」提示。
  if (passwordChallenge) {
    const isIncorrect = passwordChallenge.reason === 2;
    const promptText = isIncorrect ? dict.readerError.passwordIncorrect : dict.readerError.passwordNeeded;
    function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!password) {
        return;
      }
      void onSubmitPassword?.(password);
      setPassword("");
    }
    return (
      <main className="reader" aria-label="PDF 阅读区">
        <section
          className="reader-error reader-error--password"
          aria-label="加密 PDF 需要密码"
          data-testid="reader-error-screen"
          role="alert"
        >
          <span className="reader-error__icon" aria-hidden="true">
            <Lock size={40} strokeWidth={1.5} />
          </span>
          <h2 className="reader-error__title">{dict.readerError.passwordTitle}</h2>
          <p className="reader-error__message" data-testid="reader-error-message">
            {promptText}
          </p>
          <form className="reader-error__password-form" onSubmit={handlePasswordSubmit}>
            <input
              autoComplete="current-password"
              autoFocus
              className="reader-error__password-input"
              data-testid="reader-error-password-input"
              data-1p-ignore
              onChange={(event) => setPassword(event.target.value)}
              placeholder={dict.readerError.passwordPlaceholder}
              type="password"
              value={password}
            />
            <div className="reader-error__password-actions">
              <button
                className="reader-error__retry"
                data-testid="reader-error-password-submit"
                disabled={!password}
                type="submit"
              >
                {dict.readerError.passwordSubmit}
              </button>
              <button
                className="reader-error__cancel"
                data-testid="reader-error-password-cancel"
                onClick={() => {
                  setPassword("");
                  onCancelPassword?.();
                }}
                type="button"
              >
                {dict.readerError.passwordCancel}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
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
          <AlertTriangle size={40} strokeWidth={1.5} />
        </span>
        <h2 className="reader-error__title">{dict.readerError.title}</h2>
        <p className="reader-error__message" data-testid="reader-error-message">
          {errorMessage}
        </p>
        <input
          ref={fileInputRef}
          accept="application/pdf,.pdf"
          aria-label={dict.readerError.fileInputAria}
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
          {dict.readerError.retryButton}
        </button>
      </section>
    </main>
  );
}
