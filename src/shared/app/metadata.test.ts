import { describe, expect, test } from "vitest";
import packageInfo from "../../../package.json" with { type: "json" };
// tauriConfig 在测试中通过 Vite JSON loader 同样可访问。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - 资源在 src 之外，TS 类型无法静态校验。
import tauriConfig from "../../../src-tauri/tauri.conf.json" with { type: "json" };
import { FALLBACK_APP_VERSION, readAppMetadata } from "./metadata";

describe("readAppMetadata", () => {
  test("prefers tauri.conf.json productName and version over package.json", () => {
    const metadata = readAppMetadata();
    expect(metadata.name).toBe(tauriConfig.productName);
    expect(metadata.version).toBe(tauriConfig.version);
  });

  test("falls back to package.json when tauri fields are missing", () => {
    const originalProductName = tauriConfig.productName;
    (tauriConfig as { productName?: string }).productName = undefined;
    try {
      const metadata = readAppMetadata();
      expect(metadata.name).toBe(packageInfo.name);
    } finally {
      (tauriConfig as { productName?: string }).productName = originalProductName;
    }
  });

  test("exposes homepage and repository URL when configured", () => {
    const metadata = readAppMetadata();
    expect(metadata.homepage).toBe(packageInfo.homepage);
    expect(metadata.repositoryUrl).toBe(packageInfo.repository?.url);
  });

  test("exposes description and author name when configured", () => {
    const metadata = readAppMetadata();
    expect(metadata.description).toBe(packageInfo.description);
    const expectedAuthor = typeof packageInfo.author === "object" && packageInfo.author
      ? packageInfo.author.name
      : packageInfo.author;
    expect(metadata.authorName).toBe(expectedAuthor);
  });

  test("FALLBACK_APP_VERSION is a non-empty version-like string", () => {
    expect(FALLBACK_APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
