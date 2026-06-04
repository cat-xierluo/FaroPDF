import type { PDFDocument, PDFFont } from "pdf-lib";
import type * as FontkitModule from "@pdf-lib/fontkit";
import shsFontArrayBuffer from "../../../assets/fonts/SourceHanSansSC-Regular.otf?arraybuffer";

export const DEFAULT_CHINESE_FONT_PATH = "SourceHanSansSC-Regular.otf" as const;

export interface FontBytesLoader {
  loadFontBytes: (relativePath: string) => Promise<Uint8Array>;
}

export type FontkitInstance = (typeof FontkitModule)["default"];

const defaultLoader: FontBytesLoader = {
  async loadFontBytes(relativePath) {
    if (relativePath !== DEFAULT_CHINESE_FONT_PATH) {
      throw new Error(`未识别的字体路径：${relativePath}`);
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
  const module = await import("@pdf-lib/fontkit");
  cachedFontkit = module.default;
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

const CJK_PATTERN = /[㐀-䶿一-鿿＀-￯　-〿぀-ゟ゠-ヿ]/;

export function containsCjk(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  return CJK_PATTERN.test(text);
}
