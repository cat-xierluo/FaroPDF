import { useState } from "react";
import { readAppMetadata } from "../../../shared/app/metadata";
import type { SectionProps } from "./types";

// Vite 在构建时把 PNG 资源处理为 URL 字符串；该文件位于 src-tauri 目录，
// 但 vite/client 类型声明覆盖了所有图片导入。
import appIconUrl from "../../../../src-tauri/icons/128x128.png";

type UpdateStatus = "idle" | "checking" | "latest" | "available" | "unsupported" | "error";

const UPDATE_STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: "未检查",
  checking: "正在检查更新…",
  latest: "已是最新版本",
  available: "检测到新版本",
  unsupported: "当前环境不支持自动更新",
  error: "检查更新失败",
};

/**
 * 「关于」section：app icon、版本号、官网 / GitHub 链接、检查更新按钮
 * （ISS-021 暂未集成，本期用占位提示）、作者卡。所有外部信息均通过 readAppMetadata
 * 从 package.json 读，不硬编码 URL。
 */
export function AboutSection(_props: SectionProps) {
  // 仅展示用，onChange 形参被有意忽略。
  void _props;
  const metadata = readAppMetadata();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleCheckUpdate() {
    // ISS-021 tauri-plugin-updater 集成后改为真实 checkForAppUpdate 调用。
    // 本期保持占位：提示用户更新能力尚未启用。
    setStatus("unsupported");
    setStatusMessage("检查更新功能将于 ISS-021 集成后启用");
  }

  return (
    <section className="settings-section" aria-label="关于">
      <h2 className="settings-section__title">关于</h2>
      <p className="settings-section__hint">应用元数据、版本与作者信息。</p>

      <div className="settings-about-card" data-testid="about-app">
        <img
          alt="FaroPDF 应用图标"
          className="settings-about-card__icon"
          height={64}
          src={appIconUrl}
          width={64}
        />
        <div className="settings-about-card__body">
          <h3 className="settings-about-card__name">{metadata.name}</h3>
          {metadata.description ? (
            <p className="settings-about-card__tagline">{metadata.description}</p>
          ) : null}
          <dl className="settings-about-card__meta">
            <div>
              <dt>版本</dt>
              <dd>
                <code>{metadata.version}</code>
              </dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>
                <span data-status={status}>{UPDATE_STATUS_LABELS[status]}</span>
                {statusMessage ? <small className="settings-about-card__status-detail">{statusMessage}</small> : null}
              </dd>
            </div>
          </dl>
          <div className="settings-about-card__links">
            {metadata.homepage ? (
              <a href={metadata.homepage} rel="noreferrer" target="_blank">
                官网
              </a>
            ) : null}
            {metadata.repositoryUrl ? (
              <a href={metadata.repositoryUrl} rel="noreferrer" target="_blank">
                GitHub 仓库
              </a>
            ) : null}
            <button onClick={handleCheckUpdate} type="button">
              检查更新
            </button>
          </div>
        </div>
      </div>

      <div className="settings-author-card" data-testid="about-author">
        <h3>作者</h3>
        {metadata.authorName ? (
          <p>
            {metadata.authorName}
            {metadata.repositoryUrl ? (
              <>
                {" · "}
                <a href={metadata.repositoryUrl} rel="noreferrer" target="_blank">
                  GitHub
                </a>
              </>
            ) : null}
          </p>
        ) : (
          <p className="settings-section__empty">作者信息未配置</p>
        )}
        <p className="settings-section__footnote">
          作者卡暂为占位，公众号二维码和详细联系方式将在后续迭代补齐。
        </p>
      </div>
    </section>
  );
}
