import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";
import {
  containsCjk,
  embedChineseFont,
  type FontBytesLoader,
} from "../../shared/pdf/fontLoader";

/**
 * Stamp 文字字体路由：CJK → 思源黑体 SC；Latin-only → StandardFonts.Helvetica。
 *
 * 与 `src/modules/export/fontAwareWatermark.ts` 的 `resolveTextFont` 模式一致；
 * 独立函数以保持模块边界（批注 vs 导出），且允许在 stamp 路径上做更窄的策略扩展。
 */
export interface ResolveStampFontOptions {
  /** Override the default Chinese font bytes (used for testing and custom fonts). */
  chineseFontBytes?: Uint8Array;
  /** Override the default font bytes loader (used for testing). */
  chineseFontLoader?: FontBytesLoader;
}

export async function resolveStampFont(
  pdfDoc: PDFDocument,
  text: string,
  options: ResolveStampFontOptions = {},
): Promise<PDFFont> {
  if (containsCjk(text)) {
    return embedChineseFont(pdfDoc, {
      loader: options.chineseFontLoader,
      bytes: options.chineseFontBytes,
    });
  }
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}
