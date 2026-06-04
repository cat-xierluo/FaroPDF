import packageInfo from "../../../package.json" with { type: "json" };
// tauri.conf.json 位于 src-tauri 目录；Vite 的 JSON loader 在构建时把它内联为对象。
import tauriConfig from "../../../src-tauri/tauri.conf.json" with { type: "json" };

/**
 * 回退版本号：当 package.json / tauri.conf.json 的 version 字段缺失或无效时使用。
 * 该常量被 AboutSection / 测试等复用，避免硬编码在多处。
 */
export const FALLBACK_APP_VERSION = "0.0.0";

/**
 * 解析后的 package.json 中 `repository` 字段（支持字符串或 { url, type } 两种形态）。
 */
function readRepositoryUrl(repository: unknown): string | undefined {
  if (typeof repository === "string") {
    return repository.trim() || undefined;
  }
  if (repository && typeof repository === "object" && "url" in repository) {
    const url = (repository as { url: unknown }).url;
    return typeof url === "string" && url.trim().length > 0 ? url : undefined;
  }
  return undefined;
}

/**
 * 解析后的 package.json 中 `author` 字段（支持字符串或 { name, email, url } 两种形态）。
 */
function readAuthorName(author: unknown): string | undefined {
  if (typeof author === "string") {
    const trimmed = author.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (author && typeof author === "object" && "name" in author) {
    const name = (author as { name: unknown }).name;
    return typeof name === "string" && name.trim().length > 0 ? name : undefined;
  }
  return undefined;
}

function readHomepage(homepage: unknown): string | undefined {
  return typeof homepage === "string" && homepage.trim().length > 0 ? homepage : undefined;
}

function readVersion(version: unknown): string {
  if (typeof version !== "string") {
    return FALLBACK_APP_VERSION;
  }
  const trimmed = version.trim();
  if (trimmed.length === 0) {
    return FALLBACK_APP_VERSION;
  }
  return trimmed;
}

/**
 * 解析后的 tauri.conf.json `productName` 字段。
 * 这是面向用户展示的「应用显示名」（如 FaroPDF），区别于 package.json 的 npm 包名。
 */
function readTauriProductName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export interface AppMetadata {
  /** 应用显示名称（优先 tauri.conf.json `productName`，再回退 package.json `name`） */
  name: string;
  /** 应用版本号（优先 tauri.conf.json `version`，再回退 package.json `version`，再回退 FALLBACK_APP_VERSION） */
  version: string;
  /** 应用一句话定位（来自 package.json `description`，可能未配置） */
  description?: string;
  /** 官网链接（来自 package.json `homepage`） */
  homepage?: string;
  /** 代码仓库链接（来自 package.json `repository.url` 或字符串形态） */
  repositoryUrl?: string;
  /** 作者展示名（来自 package.json `author.name` 或字符串形态） */
  authorName?: string;
}

/**
 * 解析包内元数据。
 * 名称与版本优先读 tauri.conf.json（面向用户的发布形态），描述 / 主页 / 仓库 / 作者
 * 读 package.json（项目元数据）。任意字段缺失都返回 undefined 或回退占位，调用方按需降级。
 */
export function readAppMetadata(): AppMetadata {
  const name =
    readTauriProductName(tauriConfig.productName) ??
    (typeof packageInfo.name === "string" && packageInfo.name.trim().length > 0
      ? packageInfo.name
      : "FaroPDF");

  return {
    name,
    version: readVersion(tauriConfig.version) || readVersion(packageInfo.version),
    description:
      typeof packageInfo.description === "string" && packageInfo.description.trim().length > 0
        ? packageInfo.description
        : undefined,
    homepage: readHomepage(packageInfo.homepage),
    repositoryUrl: readRepositoryUrl(packageInfo.repository),
    authorName: readAuthorName(packageInfo.author),
  };
}
