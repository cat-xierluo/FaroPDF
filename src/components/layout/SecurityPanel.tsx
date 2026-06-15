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
          user_password: userPwd || null,
          owner_password: ownerPwd,
        },
      });
      const message = `已生成受保护副本：${result.path}（${result.size_bytes} 字节）。`;
      setSuccessMessage(message);
      onFeedback(message, false);
    } catch (error) {
      const message = typeof error === "string" ? error : (error as Error).message;
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
      const message = typeof error === "string" ? error : (error as Error).message;
      setErrMessage(message);
      onFeedback(message, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      aria-label="文档安全面板"
      className="security_panel"
      data-layout={isNarrow ? "bottom-sheet" : "panel"}
      data-testid="security-panel"
    >
      <header className="security_panel__header">
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
        <p className="security_panel__empty">打开 PDF 后才能设置 / 移除密码。</p>
      ) : null}

      {errMessage ? (
        <div className="security_panel__error" role="alert">
          <span>{errMessage}</span>
          <button className="compact-button" onClick={() => setErrMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}
      {successMessage ? (
        <div className="security_panel__success" role="status">
          <span>{successMessage}</span>
          <button className="compact-button" onClick={() => setSuccessMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}

      {currentPdfPath ? (
        <div className="security_panel__actions">
          <div className="security_panel__mode" role="tablist" aria-label="密码操作">
            <button
              aria-pressed={mode === "set"}
              className={`security_panel__mode-button${mode === "set" ? " security_panel__mode-button--active" : ""}`}
              onClick={() => setMode("set")}
              type="button"
            >
              设置密码
            </button>
            <button
              aria-pressed={mode === "remove"}
              className={`security_panel__mode-button${mode === "remove" ? " security_panel__mode-button--active" : ""}`}
              onClick={() => setMode("remove")}
              type="button"
            >
              移除密码
            </button>
          </div>

          {mode === "set" ? (
            <section aria-label="设置密码表单" className="security_panel__form">
              <p className="security_panel__hint">
                为当前 PDF 副本重加密，输出 <code>&lt;原名&gt;-secured.pdf</code>。
                v0.1 命令暂未启用——v0.2 升级 lopdf 到 0.34 或引入 qpdf 即可生效。
              </p>
              <label className="security_panel__input-row" htmlFor={userPwdId}>
                <span>用户密码（留空 = 沿用旧用户密码，仅设置 owner）</span>
                <input
                  id={userPwdId}
                  onChange={(event) => setUserPwd(event.target.value)}
                  type="password"
                  value={userPwd}
                />
              </label>
              <label className="security_panel__input-row" htmlFor={ownerPwdId}>
                <span>拥有者密码</span>
                <input
                  id={ownerPwdId}
                  onChange={(event) => setOwnerPwd(event.target.value)}
                  type="password"
                />
              </label>
              <button
                className="context-tool context-tool--primary"
                disabled={loading || !ownerPwd}
                onClick={handleSetPassword}
                type="button"
              >
                {loading ? "处理中..." : "设置密码并导出"}
              </button>
            </section>
          ) : (
            <section aria-label="移除密码表单" className="security_panel__form">
              <p className="security_panel__hint">
                输入原密码后另存一份未加密副本 <code>&lt;原名&gt;-unsecured.pdf</code>。
                v0.1 命令暂未启用（与 ISS-064 同样的依赖），v0.2 落地。
              </p>
              <label className="security_panel__input-row" htmlFor={originalPwdId}>
                <span>原密码</span>
                <input
                  id={originalPwdId}
                  onChange={(event) => setOriginalPwd(event.target.value)}
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
            className="compact-button security_panel__reset"
            disabled={loading}
            onClick={clearAll}
            type="button"
          >
            清空输入
          </button>
        </div>
      ) : null}
    </aside>
  );
}
