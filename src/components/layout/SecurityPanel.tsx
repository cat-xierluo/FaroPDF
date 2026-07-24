/**
 * SecurityPanel — ISS-064 文档密码保护入口
 *
 * 提供两类操作：
 * 1. set 密码：用户密码（可空）+ 拥有者密码（必填），对当前打开的 PDF 副本重加密为新副本（-secured.pdf）
 * 2. remove 密码：用户提供原密码后另存一份解密副本（-unsecured.pdf）
 *
 * v0.1 范围内 Rust 命令仅承担 "发现" 工作：探测 / 处理 / 命名 / 路径回填。
 * 实际 PDF 加密/解密能力是 v0.2 工作量（lopdf 升级 / 引入 qpdf），故按钮按 ISS-064 计划
 * 标明"暂未启用"并不阻塞 UI 流程；此处仅保持 UI 形态与命令可达，让 v0.2 一落地即接。
 */
import { useEffect, useId, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { normalizeError, type AppError } from "../../shared/error";
import "./SecurityPanel.css";

interface SecurityPanelProps {
  /** 当前 PDF 路径（来自 reader.state.document.path） */
  currentPdfPath: string | null;
  /** 关闭面板的回调 */
  onClose: () => void;
  /** 反馈回调：成功 / 失败信息会通过这个冒泡到 AppShell 顶部 command-feedback */
  onFeedback: (message: string | null, isError?: boolean) => void;
}

interface SecurityFeedback {
  path: string;
  size_bytes: number;
}

const NARROW_BREAKPOINT_PX = 720;

/**
 * ISS-071 阶段 3：把 AppError code 翻译成中文用户文案。
 * Rust 端 `AppError::message` 已是脱敏后的中文，但 i18n 后续可按 code 切英文 / 其他语言。
 * 现阶段单语兜底：code 已知则用预设友好文案（即使 Rust 误改 message），code 未知则 fallback 原 message。
 */
function friendlyMessageForCode(err: AppError): string {
  switch (err.code) {
    case "FileNotFound":
      return "文件不存在或路径已变更，请重新打开 PDF 后重试。";
    case "InvalidInput":
      return err.message || "输入有误，请检查后再试。";
    case "DecryptionError":
      return "密码错误或解密失败，请检查原密码后重试。";
    case "PdfParseError":
      return "PDF 解析失败，文件可能已损坏或不是有效 PDF。";
    case "IoError":
      return err.message || "文件读写失败，请检查磁盘权限。";
    case "EncryptionError":
      return "PDF 加密失败，请重试或换一份文件。";
    case "PermissionDenied":
      return "权限不足，请检查文件 / 目录权限。";
    case "NotSupported":
      return err.message || "当前 FaroPDF 版本不支持该操作。";
    case "Unknown":
    default:
      return err.message || "未知错误。";
  }
}

export function SecurityPanel({ currentPdfPath, onClose, onFeedback }: SecurityPanelProps) {
  const userPwdId = useId();
  const ownerPwdId = useId();
  const originalPwdId = useId();

  const [mode, setMode] = useState<"set" | "remove">("set");
  const [userPwd, setUserPwd] = useState("");
  const [ownerPwd, setOwnerPwd] = useState("");
  const [originalPwd, setOriginalPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < NARROW_BREAKPOINT_PX,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT_PX - 1}px)`);
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function clearAll() {
    setUserPwd("");
    setOwnerPwd("");
    setOriginalPwd("");
    setErrMessage(null);
    setSuccessMessage(null);
  }

  // ISS-064 阶段 2：v0.1 阶段 stub 已激活，lopdf 0.41 + Aes128CryptFilter 真实加密（V4 128-bit AES）。
  async function handleSetPassword() {
    if (!currentPdfPath) {
      setErrMessage("请先打开一个 PDF 文档。");
      return;
    }
    if (!ownerPwd) {
      setErrMessage("请输入拥有者密码。");
      return;
    }
    setLoading(true);
    setErrMessage(null);
    setSuccessMessage(null);
    try {
      const result = await invoke<SecurityFeedback>("set_pdfpassword", {
        request: {
          input_path: currentPdfPath,
          user_password: userPwd,
          owner_password: ownerPwd,
        },
      });
      const message = `已生成受保护副本：${result.path}（${result.size_bytes} 字节）。`;
      setSuccessMessage(message);
      onFeedback(message, false);
    } catch (error) {
      // ISS-071 阶段 3 复用：按 AppError code 走友好文案
      const appErr: AppError = normalizeError(error);
      const message = friendlyMessageForCode(appErr);
      setErrMessage(message);
      onFeedback(message, true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemovePassword() {
    if (!currentPdfPath) {
      setErrMessage("请先打开一个 PDF 文档。");
      return;
    }
    if (!originalPwd) {
      setErrMessage("请输入原密码。");
      return;
    }
    setLoading(true);
    setErrMessage(null);
    setSuccessMessage(null);
    try {
      const result = await invoke<SecurityFeedback>("remove_pdfpassword", {
        request: {
          input_path: currentPdfPath,
          user_password: originalPwd,
        },
      });
      const message = `已生成解锁副本：${result.path}（${result.size_bytes} 字节）。`;
      setSuccessMessage(message);
      onFeedback(message, false);
    } catch (error) {
      // ISS-071 阶段 3：把 invoke 错误用 normalizeError 包成 AppError，按 code 走对应 UI 文案。
      // 旧逻辑直接 display Rust 字符串（不同 path / 错误信息耦合），新逻辑按 code 分支。
      const appErr: AppError = normalizeError(error);
      const message = friendlyMessageForCode(appErr);
      setErrMessage(message);
      onFeedback(message, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      aria-label="文档安全面板"
      className="security-panel"
      data-layout={isNarrow ? "bottom-sheet" : "modal"}
      data-testid="security-panel"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="security-panel__backdrop"
        data-testid="security-panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="security-panel__dialog">
      <header className="security-panel__header">
        <div>
          <h2>文档安全</h2>
          <p>{currentPdfPath ? "当前文档：" + currentPdfPath : "请先打开一个 PDF 文档。"}</p>
        </div>
        <button
          aria-label="关闭安全面板"
          className="compact-button"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>

      {!currentPdfPath ? (
        <p className="security-panel__empty">打开 PDF 后才能设置 / 移除密码。</p>
      ) : null}

      {errMessage ? (
        <div className="security-panel__error" role="alert">
          <span>{errMessage}</span>
          <button className="compact-button" onClick={() => setErrMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}
      {successMessage ? (
        <div className="security-panel__success" role="status">
          <span>{successMessage}</span>
          <button className="compact-button" onClick={() => setSuccessMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}

      {currentPdfPath ? (
        <div className="security-panel__actions">
          <div className="security-panel__mode" role="tablist" aria-label="密码操作">
            <button
              aria-pressed={mode === "set"}
              className={`security-panel__mode-button${mode === "set" ? " security-panel__mode-button--active" : ""}`}
              onClick={() => setMode("set")}
              type="button"
            >
              设置密码
            </button>
            <button
              aria-pressed={mode === "remove"}
              className={`security-panel__mode-button${mode === "remove" ? " security-panel__mode-button--active" : ""}`}
              onClick={() => setMode("remove")}
              type="button"
            >
              移除密码
            </button>
          </div>

          {mode === "set" ? (
            <section aria-label="设置密码表单" className="security-panel__form">
              <p className="security-panel__hint">
                为当前 PDF 副本重加密（lopdf 0.41 + AES-128），输出 <code>&lt;原名&gt;-secured.pdf</code>。
                拥有者密码必填；用户密码可空（留空则副本打开时不需要密码，但仍受 owner 权限限制）。
              </p>
              <label className="security-panel__input-row" htmlFor={userPwdId}>
                <span>用户密码（留空 = 无需密码即可打开副本）</span>
                <input
                  autoComplete="new-password"
                  data-1p-ignore=""
                  id={userPwdId}
                  onChange={(event) => setUserPwd(event.target.value)}
                  spellCheck={false}
                  type="password"
                  value={userPwd}
                />
              </label>
              <label className="security-panel__input-row" htmlFor={ownerPwdId}>
                <span>拥有者密码</span>
                <input
                  autoComplete="new-password"
                  data-1p-ignore=""
                  id={ownerPwdId}
                  onChange={(event) => setOwnerPwd(event.target.value)}
                  spellCheck={false}
                  type="password"
                />
              </label>
              <button
                className="context-tool context-tool--primary"
                disabled={loading || !ownerPwd}
                onClick={handleSetPassword}
                type="button"
              >
                {loading ? "正在加密..." : "设置密码并导出"}
              </button>
            </section>
          ) : (
            <section aria-label="移除密码表单" className="security-panel__form">
              <p className="security-panel__hint">
                输入原密码后另存一份未加密副本 <code>&lt;原名&gt;-unsecured.pdf</code>。
              </p>
              <label className="security-panel__input-row" htmlFor={originalPwdId}>
                <span>原密码</span>
                <input
                  autoComplete="current-password"
                  data-1p-ignore=""
                  id={originalPwdId}
                  onChange={(event) => setOriginalPwd(event.target.value)}
                  spellCheck={false}
                  type="password"
                />
              </label>
              <button
                className="context-tool context-tool--primary"
                disabled={loading || !originalPwd}
                onClick={handleRemovePassword}
                type="button"
              >
                {loading ? "处理中..." : "移除密码并导出"}
              </button>
            </section>
          )}

          <button
            className="compact-button security-panel__reset"
            disabled={loading}
            onClick={clearAll}
            type="button"
          >
            清空输入
          </button>
        </div>
      ) : null}
      </div>
    </div>
  );
}
