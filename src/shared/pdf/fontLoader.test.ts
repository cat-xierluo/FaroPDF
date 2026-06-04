import { PDFDocument, type PDFFont } from "pdf-lib";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../assets/fonts/SourceHanSansSC-Regular.otf?arraybuffer", () => ({
  default: new ArrayBuffer(0),
}));

import {
  containsCjk,
  DEFAULT_CHINESE_FONT_PATH,
  embedChineseFont,
  getFontkit,
  loadChineseFontBytes,
  registerFontkitForDocument,
  resetFontkitCache,
  type FontBytesLoader,
} from "./fontLoader";

afterEach(() => {
  resetFontkitCache();
  vi.restoreAllMocks();
});

function createMockPdfDocument(): PDFDocument & {
  embedFont: ReturnType<typeof vi.fn>;
  registerFontkit: ReturnType<typeof vi.fn>;
} {
  const pdf = PDFDocument.create();
  const embedFont = vi.fn().mockResolvedValue({} as PDFFont);
  const registerFontkit = vi.fn();
  return Object.assign(pdf, { embedFont, registerFontkit });
}

describe("fontLoader", () => {
  test("containsCjk detects CJK characters across the supported ranges", () => {
    expect(containsCjk("机密文档")).toBe(true);
    expect(containsCjk("CONFIDENTIAL 文档 CONFIDENTIAL")).toBe(true);
    expect(containsCjk("ひらがな")).toBe(true);
    expect(containsCjk("カタカナ")).toBe(true);
    expect(containsCjk("，：")).toBe(true);

    expect(containsCjk("")).toBe(false);
    expect(containsCjk("CONFIDENTIAL")).toBe(false);
    expect(containsCjk("café résumé")).toBe(false);
    expect(containsCjk("123 - _ .")).toBe(false);
  });

  test("containsCjk flags full-width ASCII as CJK (treated as Chinese context)", () => {
    expect(containsCjk("ＡＢＣ")).toBe(true);
    expect(containsCjk("０")).toBe(true);
  });

  test("getFontkit resolves the default fontkit instance and caches it", async () => {
    const first = await getFontkit();
    const second = await getFontkit();
    expect(first).toBe(second);
    expect(typeof first.create).toBe("function");
  });

  test("getFontkit returns the same instance after resetFontkitCache (cache rehydrated on next call)", async () => {
    const before = await getFontkit();
    resetFontkitCache();
    const after = await getFontkit();
    expect(after).toBe(before);
  });

  test("registerFontkitForDocument accepts a fontkit instance without throwing", () => {
    const pdf = createMockPdfDocument();
    const fk = {
      create: () => {
        throw new Error("not used");
      },
    };
    registerFontkitForDocument(pdf, fk as never);
    expect(pdf.registerFontkit).toHaveBeenCalledWith(fk);
  });

  test("loadChineseFontBytes delegates to the injected loader", async () => {
    const loadFontBytes = vi.fn(async (_path: string) => new Uint8Array(64));
    const loader: FontBytesLoader = { loadFontBytes };
    const bytes = await loadChineseFontBytes(loader);
    expect(loadFontBytes).toHaveBeenCalledWith(DEFAULT_CHINESE_FONT_PATH);
    expect(bytes.byteLength).toBe(64);
  });

  test("embedChineseFont uses injected loader bytes and calls embedFont on the document", async () => {
    const pdf = createMockPdfDocument();
    const loadFontBytes = vi.fn(async (_path: string) => new Uint8Array(64));
    const loader: FontBytesLoader = { loadFontBytes };

    const font = await embedChineseFont(pdf, { loader });

    expect(loadFontBytes).toHaveBeenCalledWith(DEFAULT_CHINESE_FONT_PATH);
    expect(pdf.embedFont).toHaveBeenCalledTimes(1);
    expect(pdf.registerFontkit).toHaveBeenCalledTimes(1);
    expect(font).toBeDefined();
  });

  test("embedChineseFont accepts explicit bytes override and skips the loader", async () => {
    const pdf = createMockPdfDocument();
    const loadFontBytes = vi.fn(async () => new Uint8Array(0));
    const loader: FontBytesLoader = { loadFontBytes };
    const explicitBytes = new Uint8Array([1, 2, 3, 4]);

    const font = await embedChineseFont(pdf, { loader, bytes: explicitBytes });

    expect(loadFontBytes).not.toHaveBeenCalled();
    expect(pdf.embedFont).toHaveBeenCalledWith(explicitBytes, { subset: true });
    expect(font).toBeDefined();
  });

  test("embedChineseFont falls back to the default loader when none is provided", async () => {
    const pdf = createMockPdfDocument();

    const font = await embedChineseFont(pdf);

    expect(pdf.embedFont).toHaveBeenCalledTimes(1);
    expect(pdf.registerFontkit).toHaveBeenCalledTimes(1);
    expect(font).toBeDefined();
  });
});
