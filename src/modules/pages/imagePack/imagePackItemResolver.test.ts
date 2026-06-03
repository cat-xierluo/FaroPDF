import { PDFDocument } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  createImagePackItemResolver,
  detectImagePackSourceKind,
  readImageDimensions,
  resolveImagePackItems,
} from "./imagePackItemResolver";

function makePng(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = wrapChunk(new TextEncoder().encode("IHDR"), ihdr);
  // raw pixel data: each scanline 1 filter byte + width*3 RGB
  const rowSize = 1 + width * 3;
  const raw = new Uint8Array(rowSize * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * rowSize] = 0; // filter: None
  }
  const compressed = deflateSync(raw);
  const idatChunk = wrapChunk(new TextEncoder().encode("IDAT"), compressed);
  const iendChunk = wrapChunk(new TextEncoder().encode("IEND"), new Uint8Array(0));

  const out = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  out.set(signature, 0);
  out.set(ihdrChunk, signature.length);
  out.set(idatChunk, signature.length + ihdrChunk.length);
  out.set(iendChunk, signature.length + ihdrChunk.length + idatChunk.length);
  return out;
}

function makeJpeg(width: number, height: number): Uint8Array {
  // SOI + SOF0 (precision=8, height, width, 3 components Y/Cb/Cr) + EOI
  const payload: number[] = [];
  payload.push(0x08); // precision
  payload.push((height >>> 8) & 0xff, height & 0xff);
  payload.push((width >>> 8) & 0xff, width & 0xff);
  payload.push(0x03); // 3 components
  payload.push(0x01, 0x22, 0x00); // Y: id=1, h=2/v=2, quant=0
  payload.push(0x02, 0x11, 0x01); // Cb
  payload.push(0x03, 0x11, 0x01); // Cr
  const length = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    (length >>> 8) & 0xff,
    length & 0xff,
    ...payload,
    0xff, 0xd9, // EOI
  ]);
}

function wrapChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out[0] = (data.length >>> 24) & 0xff;
  out[1] = (data.length >>> 16) & 0xff;
  out[2] = (data.length >>> 8) & 0xff;
  out[3] = data.length & 0xff;
  out.set(type, 4);
  out.set(data, 8);
  // CRC over type + data (4 + data.length bytes), offset 4 .. 4 + 4 + data.length
  const crc = crc32(out.subarray(4, 8 + data.length));
  out[8 + data.length] = (crc >>> 24) & 0xff;
  out[9 + data.length] = (crc >>> 16) & 0xff;
  out[10 + data.length] = (crc >>> 8) & 0xff;
  out[11 + data.length] = crc & 0xff;
  return out;
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function makeLabeledPdfBytes(pageSizes: Array<{ width: number; height: number }>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const size of pageSizes) {
    pdf.addPage([size.width, size.height]);
  }
  return pdf.save();
}

describe("imagePackItemResolver - readImageDimensions", () => {
  test("reads PNG dimensions from header without decoding pixels", () => {
    const png = makePng(640, 480);
    expect(readImageDimensions(png, "photo.png")).toEqual({ width: 640, height: 480 });
  });

  test("auto-detects PNG when fileName is omitted", () => {
    const png = makePng(1024, 768);
    expect(readImageDimensions(png)).toEqual({ width: 1024, height: 768 });
  });

  test("reads JPEG dimensions from the first SOF marker", () => {
    const jpeg = makeJpeg(800, 600);
    expect(readImageDimensions(jpeg, "photo.jpg")).toEqual({ width: 800, height: 600 });
  });

  test("rejects unsupported image formats with a clear error", () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(() => readImageDimensions(webpBytes, "photo.webp")).toThrow(/仅支持 PNG \/ JPEG/);
  });

  test("rejects unknown byte signature without a file name", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    expect(() => readImageDimensions(garbage)).toThrow(/格式无法识别/);
  });
});

describe("imagePackItemResolver - resolveImageItem", () => {
  test("resolves a PNG item from raw bytes and a file name", async () => {
    const png = makePng(1200, 1600);
    const resolver = createImagePackItemResolver();

    const item = await resolver.resolveImageItem({
      id: "img-1",
      bytes: png,
      fileName: "/case/evidence/photo-1.png",
    });

    expect(item).toEqual({
      id: "img-1",
      source: "image",
      width: 1200,
      height: 1600,
    });
  });

  test("rejects too-short image bytes", async () => {
    const resolver = createImagePackItemResolver();
    await expect(
      resolver.resolveImageItem({ id: "img-bad", bytes: new Uint8Array(4) }),
    ).rejects.toThrow(/字节过短/);
  });
});

describe("imagePackItemResolver - resolvePdfPageItem", () => {
  test("resolves a PDF page item by reading the page size from the source PDF", async () => {
    const pdfBytes = await makeLabeledPdfBytes([
      { width: 612, height: 792 },
      { width: 842, height: 595 },
    ]);
    const resolver = createImagePackItemResolver();

    const itemA = await resolver.resolvePdfPageItem({
      id: "pdf-1",
      bytes: pdfBytes,
      sourcePath: "/case/source.pdf",
      sourcePageIndex: 0,
    });
    const itemB = await resolver.resolvePdfPageItem({
      id: "pdf-2",
      bytes: pdfBytes,
      sourcePath: "/case/source.pdf",
      sourcePageIndex: 1,
    });

    expect(itemA).toMatchObject({ id: "pdf-1", source: "pdf-page", width: 612, height: 792 });
    expect(itemB).toMatchObject({ id: "pdf-2", source: "pdf-page", width: 842, height: 595 });
  });

  test("rejects out-of-range PDF page index with a clear error", async () => {
    const pdfBytes = await makeLabeledPdfBytes([{ width: 612, height: 792 }]);
    const resolver = createImagePackItemResolver();

    await expect(
      resolver.resolvePdfPageItem({
        id: "pdf-oob",
        bytes: pdfBytes,
        sourcePath: "/case/source.pdf",
        sourcePageIndex: 5,
      }),
    ).rejects.toThrow(/sourcePageIndex 5 超出源 PDF 页数 1/);
  });

  test("rejects corrupted PDF bytes with the underlying parse error", async () => {
    const resolver = createImagePackItemResolver();
    await expect(
      resolver.resolvePdfPageItem({
        id: "pdf-bad",
        bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        sourcePath: "/case/source.pdf",
        sourcePageIndex: 0,
      }),
    ).rejects.toThrow(/PDF 页面条目 pdf-bad 解析失败/);
  });
});

describe("imagePackItemResolver - detectImagePackSourceKind", () => {
  test("detects image and pdf-page sources by extension", () => {
    expect(detectImagePackSourceKind("/case/photo.png")).toBe("image");
    expect(detectImagePackSourceKind("/case/photo.JPG")).toBe("image");
    expect(detectImagePackSourceKind("/case/source.pdf")).toBe("pdf-page");
    expect(detectImagePackSourceKind("/case/note.docx")).toBeUndefined();
  });
});

describe("imagePackItemResolver - resolveImagePackItems", () => {
  test("mixes image and pdf-page items and preserves order", async () => {
    const png = makePng(600, 800);
    const pdfBytes = await makeLabeledPdfBytes([{ width: 612, height: 792 }]);

    const items = await resolveImagePackItems({
      items: [
        { kind: "image", id: "img-1", bytes: png, fileName: "photo.png" },
        { kind: "pdf-page", id: "pdf-1", bytes: pdfBytes, sourcePath: "/case/source.pdf", sourcePageIndex: 0 },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "img-1", source: "image", width: 600, height: 800 });
    expect(items[1]).toMatchObject({ id: "pdf-1", source: "pdf-page", width: 612, height: 792 });
  });
});
