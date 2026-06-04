import { useEffect, useMemo, useRef, useState } from "react";
import { readAppMetadata } from "../../../shared/app/metadata";
import {
  createTauriUpdateClient,
  type AppUpdateClient,
  type AppUpdateProgress,
  type AppUpdateStatus,
} from "../../../shared/update";
import type { SectionProps } from "./types";

// Vite 在构建时把 PNG 资源处理为 URL 字符串；该文件位于 src-tauri 目录，
// 但 vite/client 类型声明覆盖了所有图片导入。
import appIconUrl from "../../../../src-tauri/icons/128x128.png";

export interface AboutSectionProps extends SectionProps {
  /**
   * 可选依赖：让测试可以注入 mock client（参见 AboutSection.test.tsx）。
   * 生产路径不传，组件内部用 `createTauriUpdateClient()` 兜底。
   */
  updateClient?: AppUpdateClient;
}

interface AvailableState {
  availableVersion: string;
  currentVersion: string;
  releaseNotes?: string;
}

const STATUS_LABELS: Record<AppUpdateStatus, string> = {
  idle: "未检查",
  checking: "正在检查更新…",
  latest: "已是最新版本",
  available: "检测到新版本",
  downloading: "正在下载更新…",
  downloaded: "更新已下载",
  installing: "正在安装更新…",
  unsupported: "当前环境不支持自动更新",
  error: "检查更新失败",
};

/**
 * 「关于」section：app icon、版本号、官网 / GitHub 链接、检查更新按钮、作者卡。
 *
 * ISS-021：检查更新按钮接 `tauri-plugin-updater`（via `createTauriUpdateClient`）；
 * 仅在 Tauri WebView 内 + 端点已配置时才允许进入「检查 → 下载 → 安装」流程。
 * 自动检查（`autoUpdateCheck` 设置项）本期不实现，避免触碰被禁的 `src/shared/settings/`。
 */
export function AboutSection({ settings: _settings, onChange: _onChange, updateClient }: AboutSectionProps) {
  // 形参 onChange 被有意忽略：About section 只读，不修改 settings。
  void _settings;
  void _onChange;
  const metadata = readAppMetadata();
  const [status, setStatus] = useState<AppUpdateStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableState | null>(null);
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // 组件内默认 client 用 useMemo 缓存；测试可通过 props 注入 mock 覆盖。
  const client = useMemo<AppUpdateClient>(
    () => updateClient ?? createTauriUpdateClient(),
    [updateClient],
  );

  // 防止组件卸载后 setState（在 user 点击 check 后快速切走 section）。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function setSafeStatus(next: AppUpdateStatus, detail: string | null = null) {
    if (!mountedRef.current) {
      return;
    }
    setStatus(next);
    setStatusDetail(detail);
  }

  async function handleCheckUpdate() {
    if (isWorking) {
      return;
    }
    setIsWorking(true);
    setSafeStatus("checking");
    setProgress(null);
    try {
      const outcome = await client.checkForAppUpdate();
      if (!mountedRef.current) {
        return;
      }
      switch (outcome.kind) {
        case "latest":
          setAvailable(null);
          setSafeStatus("latest", `当前版本 ${outcome.currentVersion}`);
          break;
        case "available":
          setAvailable({
            availableVersion: outcome.availableVersion,
            currentVersion: outcome.currentVersion,
            releaseNotes: outcome.releaseNotes,
          });
          setSafeStatus(
            "available",
            `可从 ${outcome.currentVersion} 升级到 ${outcome.availableVersion}`,
          );
          break;
        case "unsupported":
          setAvailable(null);
          setSafeStatus("unsupported", outcome.reason);
          break;
        case "error":
          setAvailable(null);
          setSafeStatus("error", outcome.message);
          break;
      }
    } catch (error) {
      setSafeStatus("error", error instanceof Error ? error.message : String(error));
    } finally {
      if (mountedRef.current) {
        setIsWorking(false);
      }
    }
  }

  async function handleInstallUpdate() {
    if (isWorking) {
      return;
    }
    setIsWorking(true);
    setSafeStatus("downloading");
    setProgress({ downloadedBytes: 0 });
    try {
      const result = await client.downloadAndInstallUpdate((p) => {
        if (mountedRef.current) {
          setProgress(p);
        }
      });
      if (!mountedRef.current) {
        return;
      }
      switch (result.kind) {
        case "installed":
          setSafeStatus("downloaded", "更新已下载，请按系统提示重启应用。");
          break;
        case "cancelled":
          setSafeStatus("available", "已取消安装。");
          break;
        case "error":
          setSafeStatus("error", result.message);
          break;
      }
    } catch (error) {
      setSafeStatus("error", error instanceof Error ? error.message : String(error));
    } finally {
      if (mountedRef.current) {
        setIsWorking(false);
      }
    }
  }

  const showInstallButton = status === "available" && available !== null;
  const checkButtonDisabled = isWorking || status === "checking" || status === "downloading";
  const progressText = renderProgress(progress);

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
              <dt>更新状态</dt>
              <dd>
                <span data-status={status}>{STATUS_LABELS[status]}</span>
                {statusDetail ? (
                  <small className="settings-about-card__status-detail" role="status">
                    {statusDetail}
                  </small>
                ) : null}
                {progressText ? (
                  <small className="settings-about-card__status-detail" role="status">
                    {progressText}
                  </small>
                ) : null}
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
            <button
              data-testid="about-check-update"
              disabled={checkButtonDisabled}
              onClick={handleCheckUpdate}
              type="button"
            >
              {status === "checking" ? "正在检查更新…" : "检查更新"}
            </button>
            {showInstallButton ? (
              <button
                data-testid="about-install-update"
                disabled={isWorking}
                onClick={handleInstallUpdate}
                type="button"
              >
                下载并安装
              </button>
            ) : null}
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

function renderProgress(progress: AppUpdateProgress | null): string | null {
  if (!progress) {
    return null;
  }
  if (typeof progress.totalBytes === "number" && progress.totalBytes > 0) {
    const percent = Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
    return `${percent}% · ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`;
  }
  return formatBytes(progress.downloadedBytes);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
