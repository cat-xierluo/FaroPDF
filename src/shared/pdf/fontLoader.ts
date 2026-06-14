import type { PDFDocument, PDFFont } from "pdf-lib";
import * as FontkitModule from "@pdf-lib/fontkit";
import shsFontArrayBuffer from "../../../assets/fonts/SourceHanSansSC-Regular.otf?arraybuffer";

export const DEFAULT_CHINESE_FONT_PATH = "SourceHanSansSC-Regular.otf" as const;

export interface FontBytesLoader {
  loadFontBytes: (relativePath: string) => Promise<Uint8Array>;
}

export type FontkitInstance = typeof FontkitModule;

const defaultLoader: FontBytesLoader = {
  async loadFontBytes(relativePath) {
    if (relativePath !== DEFAULT_CHINESE_FONT_PATH) {
      throw new Error(`未识别的字体路径：${relativePath}`);
    }
    // vitest 1.x 默认不解析 Vite `?arraybuffer` 资源，会返回空 ArrayBuffer；
    // 兜底从源文件读真实 OTF。
    if (shsFontArrayBuffer.byteLength < 1_000_000) {
      const { readFileSync } = await import("node:fs");
      const { fileURLToPath } = await import("node:url");
      const nodePath = await import("node:path");
      const here = nodePath.dirname(fileURLToPath(import.meta.url));
      const filePath = nodePath.resolve(here, "../../../assets/fonts/SourceHanSansSC-Regular.otf");
      const buf = readFileSync(filePath);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    return new Uint8Array(shsFontArrayBuffer);
  },
};

let cachedFontkit: FontkitInstance | null = null;

export function resetFontkitCache(): void {
  cachedFontkit = null;
}

export async function getFontkit(_loader?: FontBytesLoader): Promise<FontkitInstance> {
  if (cachedFontkit) {
    return cachedFontkit;
  }
  cachedFontkit = FontkitModule;
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
