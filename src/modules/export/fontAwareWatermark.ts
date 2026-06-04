import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";
import { containsCjk, embedChineseFont, type FontBytesLoader } from "../../shared/pdf/fontLoader";

export interface ResolveTextFontOptions {
  /** Override the default Chinese font bytes (used for testing and custom fonts). */
  chineseFontBytes?: Uint8Array;
  /** Override the default font bytes loader (used for testing). */
  chineseFontLoader?: FontBytesLoader;
}

export async function resolveTextFont(
  pdfDoc: PDFDocument,
  text: string,
  options: ResolveTextFontOptions = {},
): Promise<PDFFont> {
  if (containsCjk(text)) {
    return embedChineseFont(pdfDoc, {
      loader: options.chineseFontLoader,
      bytes: options.chineseFontBytes,
    });
  }

  return pdfDoc.embedFont(StandardFonts.Helvetica);
}
