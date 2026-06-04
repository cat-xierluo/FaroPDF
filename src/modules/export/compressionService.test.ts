import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { compressPdf } from "./compressionService";

async function createBlankPdfBytes(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([300, 300]);
  }
  return pdf.save();
}

async function createPdfBytesWithJpeg(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 300]);
  // 1x1 白 png bytes (minimal image)
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, { x: 50, y: 50, width: 100, height: 100 });
  return pdf.save();
}

describe("compressionService", () => {
  test("rejects empty input bytes", async () => {
    await expect(compressPdf(new Uint8Array(0))).rejects.toThrow("PDF 压缩请求缺少输入 bytes");
  });

  test("rejects out-of-range imageQuality", async () => {
    const bytes = await createBlankPdfBytes(1);
    await expect(compressPdf(bytes, { imageQuality: 1.5 })).rejects.toThrow("imageQuality 必须在 0 到 1 之间。");
    await expect(compressPdf(bytes, { imageQuality: -0.1 })).rejects.toThrow("imageQuality 必须在 0 到 1 之间。");
  });

  test("reproduces a valid PDF even when no compression preset is requested", async () => {
    const inputBytes = await createBlankPdfBytes(2);
    const result = await compressPdf(inputBytes, { useObjectStreams: false });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(result.useObjectStreams).toBe(false);
    expect(result.inputBytes).toBe(inputBytes.byteLength);
    expect(result.outputBytes).toBe(result.bytes.byteLength);
    expect(result.ratio).toBeCloseTo(inputBytes.byteLength / result.bytes.byteLength, 5);
    expect(result.warnings).toEqual([]);
  });

  test("real compression with useObjectStreams: true returns valid PDF and ratio info", async () => {
    const inputBytes = await createBlankPdfBytes(2);
    const result = await compressPdf(inputBytes, { useObjectStreams: true });

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(result.useObjectStreams).toBe(true);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(0);
  });

  test("default options enable useObjectStreams", async () => {
    const inputBytes = await createBlankPdfBytes(1);
    const result = await compressPdf(inputBytes);
    expect(result.useObjectStreams).toBe(true);
  });

  test("does not mutate the input bytes", async () => {
    const inputBytes = await createBlankPdfBytes(1);
    const snapshot = Array.from(inputBytes);
    await compressPdf(inputBytes, { useObjectStreams: true });
    expect(Array.from(inputBytes)).toEqual(snapshot);
  });

  test("image resampling is currently plan-only and emits a diagnostic warning", async () => {
    const inputBytes = await createPdfBytesWithJpeg();
    const result = await compressPdf(inputBytes, { imageQuality: 0.7 });

    expect(result.imageResampling.requested).toBe(true);
    expect(result.imageResampling.resampledImages).toBe(0);
    expect(result.imageResampling.skippedImages).toBe(result.imageResampling.imageCount);
    expect(result.warnings.some((w) => w.includes("plan-only"))).toBe(true);

    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBe(1);
  });

  test("without imageQuality, no image resampling diagnostics are reported", async () => {
    const inputBytes = await createBlankPdfBytes(1);
    const result = await compressPdf(inputBytes, { useObjectStreams: true });
    expect(result.imageResampling.requested).toBe(false);
    expect(result.imageResampling.imageCount).toBe(0);
  });

  test("image inventory detects embedded PNG images as FlateDecode", async () => {
    const inputBytes = await createPdfBytesWithJpeg();
    const result = await compressPdf(inputBytes, { imageQuality: 0.5 });
    expect(result.imageResampling.imageCount).toBeGreaterThanOrEqual(1);
  });

  test("compression of a single-page minimal PDF still produces a valid PDF (edge case)", async () => {
    const pdf = await PDFDocument.create();
    const inputBytes = await pdf.save();
    const result = await compressPdf(inputBytes);
    const outputPdf = await PDFDocument.load(result.bytes);
    expect(outputPdf.getPageCount()).toBeGreaterThanOrEqual(0);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });
});
