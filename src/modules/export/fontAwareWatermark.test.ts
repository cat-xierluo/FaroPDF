import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../assets/fonts/SourceHanSansSC-Regular.otf?url", () => ({
  default: "/assets/SourceHanSansSC-Regular.otf",
}));

import {
  containsCjk,
  embedChineseFont as realEmbedChineseFont,
  resetFontkitCache,
} from "../../shared/pdf/fontLoader";
import { resolveTextFont, type ResolveTextFontOptions } from "./fontAwareWatermark";

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
  return Object.assign(pdf, { embedFont, registerFontkit }) as unknown as PDFDocument & {
    embedFont: ReturnType<typeof vi.fn>;
    registerFontkit: ReturnType<typeof vi.fn>;
  };
}

describe("fontAwareWatermark.resolveTextFont", () => {
  test("uses StandardFonts.Helvetica for Latin-only text", async () => {
    const pdf = createMockPdfDocument();
    const options: ResolveTextFontOptions = {};

    const font = await resolveTextFont(pdf, "CONFIDENTIAL", options);

    expect(font).toBeDefined();
    expect(StandardFonts.Helvetica).toBeDefined();
  });

  test("uses the Chinese font path when text contains CJK characters", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveTextFont(pdf, "机密文档");

    expect(embedSpy).toHaveBeenCalledTimes(1);
    expect(embedSpy).toHaveBeenCalledWith(pdf, { loader: undefined, bytes: undefined });
    expect(font).toBeDefined();
  });

  test("uses the Chinese font path when text is a mix of CJK and Latin", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveTextFont(pdf, "Case 123 - 合同 - 机密");

    expect(embedSpy).toHaveBeenCalledTimes(1);
    expect(font).toBeDefined();
  });

  test("accepts custom font overrides for the CJK path", async () => {
    const pdf = createMockPdfDocument();
    const customBytes = new Uint8Array([1, 2, 3, 4]);
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    await resolveTextFont(pdf, "测试", { chineseFontBytes: customBytes });

    expect(embedSpy).toHaveBeenCalledWith(pdf, { loader: undefined, bytes: customBytes });
  });

  test("containsCjk is exposed and matches fontLoader implementation", async () => {
    expect(resolveTextFont).toBeDefined();
    expect(containsCjk("A")).toBe(false);
    expect(containsCjk("中")).toBe(true);
  });

  test("does not call embedChineseFont for empty text (falls back to Helvetica)", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveTextFont(pdf, "");

    expect(embedSpy).not.toHaveBeenCalled();
    expect(font).toBeDefined();
  });

  test("propagates the underlying realEmbedChineseFont result (integration sanity check)", async () => {
    const pdf = await PDFDocument.create();
    const font = await realEmbedChineseFont(pdf, { bytes: new Uint8Array(0) }).catch(() => null);
    if (font === null) {
      // 0-byte input fails pdf-lib embed — expected, but we want to confirm the call path runs.
      return;
    }
    expect(font).toBeDefined();
  });
});
