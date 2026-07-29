import type { PDFDocument, PDFFont } from "pdf-lib";
import * as FontkitModule from "@pdf-lib/fontkit";
import shsFontUrl from "../../../assets/fonts/SourceHanSansSC-Regular.otf?url";

export const DEFAULT_CHINESE_FONT_PATH = "SourceHanSansSC-Regular.otf" as const;

export interface FontBytesLoader {
  loadFontBytes: (relativePath: string) => Promise<Uint8Array>;
}

export type FontkitInstance = Parameters<PDFDocument["registerFontkit"]>[0];

interface FontkitInteropModule {
  create?: FontkitInstance["create"];
  default?: {
    create?: FontkitInstance["create"];
  };
}

const defaultLoader: FontBytesLoader = {
  async loadFontBytes(relativePath) {
    if (relativePath !== DEFAULT_CHINESE_FONT_PATH) {
      throw new Error(`未识别的字体路径：${relativePath}`);
    }
    // Vite 不提供 `?arraybuffer` 资源查询；浏览器构建必须先拿 `?url`，再 fetch 真字节。
    const isJsdom = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom");
    if (typeof window !== "undefined" && typeof window.fetch === "function" && !isJsdom) {
      const response = await window.fetch(shsFontUrl);
      if (!response.ok) {
        throw new Error(`中文字体加载失败：HTTP ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    }

    // Vitest/Node 环境没有浏览器资源服务器，直接从仓库字体文件读取。
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const nodePath = await import("node:path");
    const here = nodePath.dirname(fileURLToPath(import.meta.url));
    const filePath = nodePath.resolve(here, "../../../assets/fonts/SourceHanSansSC-Regular.otf");
    const buf = readFileSync(filePath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  },
};

let cachedFontkit: FontkitInstance | null = null;

export function resetFontkitCache(): void {
  cachedFontkit = null;
}

/**
 * `@pdf-lib/fontkit` 在 Vitest/Node 中暴露为具名导出，在 Vite 浏览器构建里则可能
 * 被 CommonJS interop 包成 `{ default: fontkit }`。统一归一化，避免中文水印在
 * 浏览器运行时报 `fontkit.create is not a function`。
 */
export function normalizeFontkitModule(moduleValue: unknown): FontkitInstance {
  const interop = moduleValue as FontkitInteropModule;
  const candidate = typeof interop.create === "function" ? interop : interop.default;
  if (!candidate || typeof candidate.create !== "function") {
    throw new Error("fontkit 模块加载失败：缺少 create()。");
  }
  return candidate as FontkitInstance;
}

export async function getFontkit(_loader?: FontBytesLoader): Promise<FontkitInstance> {
  if (cachedFontkit) {
    return cachedFontkit;
  }
  cachedFontkit = normalizeFontkitModule(FontkitModule);
  return cachedFontkit;
}

export function registerFontkitForDocument(pdfDoc: PDFDocument, fontkitInstance: FontkitInstance): void {
  pdfDoc.registerFontkit(fontkitInstance);
}

export async function loadChineseFontBytes(loader: FontBytesLoader = defaultLoader): Promise<Uint8Array> {
  return loader.loadFontBytes(DEFAULT_CHINESE_FONT_PATH);
}

export interface EmbedChineseFontOptions {
  loader?: FontBytesLoader;
  bytes?: Uint8Array;
}

export async function embedChineseFont(
  pdfDoc: PDFDocument,
  options: EmbedChineseFontOptions = {},
): Promise<PDFFont> {
  const fontkitInstance = await getFontkit(options.loader);
  registerFontkitForDocument(pdfDoc, fontkitInstance);
  const bytes = options.bytes ?? (await loadChineseFontBytes(options.loader));
  return pdfDoc.embedFont(bytes, { subset: true });
}

const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef\u3000-\u303f\u3040-\u309f\u30a0-\u30ff]/;

export function containsCjk(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  return CJK_PATTERN.test(text);
}
