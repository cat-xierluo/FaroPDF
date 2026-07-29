import { PDFDocument, type PDFFont } from "pdf-lib";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../assets/fonts/SourceHanSansSC-Regular.otf?url", () => ({
  default: "/assets/SourceHanSansSC-Regular.otf",
}));

import { resolveStampFont, type ResolveStampFontOptions } from "./annotationStampFont";

afterEach(() => {
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

describe("annotationStampFont.resolveStampFont", () => {
  test("uses StandardFonts.Helvetica for Latin-only text", async () => {
    const pdf = createMockPdfDocument();
    const options: ResolveStampFontOptions = {};
    const font = await resolveStampFont(pdf, "CONFIDENTIAL", options);
    expect(font).toBeDefined();
    // Helvetica path 走 embedFont(StandardFonts.Helvetica)，不调 embedChineseFont
    const embedChineseCalls = (pdf.embedFont as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => Array.isArray(call[0]) || call[0] instanceof Uint8Array,
    );
    expect(embedChineseCalls.length).toBe(0);
  });

  test("uses the Chinese font path when text contains CJK characters", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveStampFont(pdf, "已阅");

    expect(embedSpy).toHaveBeenCalledTimes(1);
    expect(embedSpy).toHaveBeenCalledWith(pdf, { loader: undefined, bytes: undefined });
    expect(font).toBeDefined();
  });

  test("uses the Chinese font path for mixed CJK + Latin stamp labels", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    await resolveStampFont(pdf, "Reviewed 2026/已审");

    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  test("accepts custom font overrides for the CJK path", async () => {
    const pdf = createMockPdfDocument();
    const customBytes = new Uint8Array([1, 2, 3, 4]);
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    await resolveStampFont(pdf, "机密", { chineseFontBytes: customBytes });

    expect(embedSpy).toHaveBeenCalledWith(pdf, { loader: undefined, bytes: customBytes });
  });

  test("accepts custom font loader for the CJK path", async () => {
    const pdf = createMockPdfDocument();
    const customLoader = { loadFontBytes: vi.fn() };
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    await resolveStampFont(pdf, "签章", { chineseFontLoader: customLoader });

    expect(embedSpy).toHaveBeenCalledWith(pdf, { loader: customLoader, bytes: undefined });
  });

  test("falls back to Helvetica for empty text", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveStampFont(pdf, "");

    expect(embedSpy).not.toHaveBeenCalled();
    expect(font).toBeDefined();
  });

  test("falls back to Helvetica for whitespace-only text", async () => {
    const pdf = createMockPdfDocument();
    const embedSpy = vi
      .spyOn(await import("../../shared/pdf/fontLoader"), "embedChineseFont")
      .mockResolvedValue({} as PDFFont);

    const font = await resolveStampFont(pdf, "   \t\n  ");

    expect(embedSpy).not.toHaveBeenCalled();
    expect(font).toBeDefined();
  });
});
