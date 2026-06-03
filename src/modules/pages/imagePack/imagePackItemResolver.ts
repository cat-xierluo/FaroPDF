import { PDFDocument } from "pdf-lib";
import type { ImagePackInputItem, ImagePackSourceKind } from "../../../shared";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_SOF_MARKERS = new Set<number>([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImagePackItemResolver {
  resolveImageItem: (input: ResolveImageItemInput) => Promise<ImagePackInputItem>;
  resolvePdfPageItem: (input: ResolvePdfPageItemInput) => Promise<ImagePackInputItem>;
}

export interface ResolveImageItemInput {
  id: string;
  bytes: Uint8Array;
  /** 文件扩展名（含点）或完整文件路径，用于识别 PNG/JPEG；缺省时按字节签名自动识别。 */
  fileName?: string;
  label?: string;
}

export interface ResolvePdfPageItemInput {
  id: string;
  bytes: Uint8Array;
  sourcePath: string;
  sourcePageIndex: number;
  label?: string;
}

export function createImagePackItemResolver(): ImagePackItemResolver {
  return {
    async resolveImageItem(input) {
      if (!(input.bytes instanceof Uint8Array) || input.bytes.length < 24) {
        throw new Error(`证据图片条目 ${input.id} 的字节过短，无法解析尺寸。`);
      }
      const dimensions = readImageDimensions(input.bytes, input.fileName);
      if (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)) {
        throw new Error(`证据图片条目 ${input.id} 的尺寸不是有限数字。`);
      }
      if (dimensions.width <= 0 || dimensions.height <= 0) {
        throw new Error(`证据图片条目 ${input.id} 的尺寸必须大于 0。`);
      }
      return {
        id: input.id,
        source: "image",
        width: dimensions.width,
        height: dimensions.height,
        ...(input.label !== undefined ? { label: input.label } : {}),
      };
    },

    async resolvePdfPageItem(input) {
      if (!(input.bytes instanceof Uint8Array) || input.bytes.length === 0) {
        throw new Error(`PDF 页面条目 ${input.id} 的字节为空，无法读取尺寸。`);
      }
      if (!Number.isInteger(input.sourcePageIndex) || input.sourcePageIndex < 0) {
        throw new Error(`PDF 页面条目 ${input.id} 的 sourcePageIndex 必须是非负整数。`);
      }
      const pdf = await loadPdfSafely(input.bytes, input.id);
      const pageCount = pdf.getPageCount();
      if (input.sourcePageIndex >= pageCount) {
        throw new Error(
          `PDF 页面条目 ${input.id} 的 sourcePageIndex ${input.sourcePageIndex} 超出源 PDF 页数 ${pageCount}。`,
        );
      }
      const { width, height } = pdf.getPage(input.sourcePageIndex).getSize();
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`PDF 页面条目 ${input.id} 的尺寸不是有限数字。`);
      }
      if (width <= 0 || height <= 0) {
        throw new Error(`PDF 页面条目 ${input.id} 的尺寸必须大于 0。`);
      }
      return {
        id: input.id,
        source: "pdf-page",
        sourcePath: input.sourcePath,
        sourcePageIndex: input.sourcePageIndex,
        width,
        height,
        ...(input.label !== undefined ? { label: input.label } : {}),
      };
    },
  };
}

export function readImageDimensions(bytes: Uint8Array, fileName?: string): ImageDimensions {
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) {
      return readPngDimensions(bytes);
    }
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return readJpegDimensions(bytes);
    }
    if (
      lower.endsWith(".webp") ||
      lower.endsWith(".tif") ||
      lower.endsWith(".tiff") ||
      lower.endsWith(".bmp") ||
      lower.endsWith(".heic")
    ) {
      throw new Error(`证据图片首版暂不支持 ${extractExtension(lower)} 格式，仅支持 PNG / JPEG。`);
    }
  }

  if (matchesPngSignature(bytes)) {
    return readPngDimensions(bytes);
  }
  if (matchesJpegSignature(bytes)) {
    return readJpegDimensions(bytes);
  }
  throw new Error("证据图片格式无法识别，仅支持 PNG / JPEG 字节流。");
}

function matchesPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return false;
    }
  }
  return true;
}

function matchesJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === JPEG_MARKER_PREFIX && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions {
  if (!matchesPngSignature(bytes)) {
    throw new Error("PNG 字节签名校验失败。");
  }
  if (bytes.length < 24) {
    throw new Error("PNG 头部字节不完整。");
  }
  const width = readUInt32BigEndian(bytes, 16);
  const height = readUInt32BigEndian(bytes, 20);
  return { width, height };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions {
  if (!matchesJpegSignature(bytes)) {
    throw new Error("JPEG 字节签名校验失败。");
  }
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== JPEG_MARKER_PREFIX) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) {
      throw new Error("JPEG 字节流意外结束。");
    }
    // SOS marker 之后是压缩数据，停止扫描
    if (marker === 0xda) {
      throw new Error("在 JPEG 字节流中未找到 SOF 标记，无法读取尺寸。");
    }
    if (JPEG_SOF_MARKERS.has(marker)) {
      // SOF marker 后面：marker 字节(2) + length(2) + precision(1) + height(2 BE) + width(2 BE)
      if (offset + 9 > bytes.length) {
        throw new Error("JPEG SOF 段长度不足。");
      }
      const height = readUInt16BigEndian(bytes, offset + 5);
      const width = readUInt16BigEndian(bytes, offset + 7);
      return { width, height };
    }
    // 跳过当前段：length(2) + payload
    if (offset + 4 > bytes.length) {
      throw new Error("JPEG 段长度不足。");
    }
    const segmentLength = readUInt16BigEndian(bytes, offset + 2);
    if (segmentLength < 2) {
      throw new Error("JPEG 段长度非法。");
    }
    offset += 2 + segmentLength;
  }
  throw new Error("JPEG 字节流中未找到 SOF 标记。");
}

function readUInt16BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUInt32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) >>> 0) +
    (((bytes[offset + 1] ?? 0) << 16) >>> 0) +
    (((bytes[offset + 2] ?? 0) << 8) >>> 0) +
    (bytes[offset + 3] ?? 0)
  );
}

function extractExtension(lowerFileName: string): string {
  const slash = Math.max(lowerFileName.lastIndexOf("/"), lowerFileName.lastIndexOf("\\"));
  const name = slash >= 0 ? lowerFileName.slice(slash + 1) : lowerFileName;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : name;
}

async function loadPdfSafely(bytes: Uint8Array, itemId: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF 页面条目 ${itemId} 解析失败：${message}`);
  }
}

export interface ResolveImagePackSourcesInput {
  items: Array<
    | { kind: "image"; id: string; bytes: Uint8Array; fileName?: string; label?: string }
    | { kind: "pdf-page"; id: string; bytes: Uint8Array; sourcePath: string; sourcePageIndex: number; label?: string }
  >;
}

export async function resolveImagePackItems(
  input: ResolveImagePackSourcesInput,
  resolver: ImagePackItemResolver = createImagePackItemResolver(),
): Promise<ImagePackInputItem[]> {
  return Promise.all(
    input.items.map((item) => {
      if (item.kind === "image") {
        return resolver.resolveImageItem({
          id: item.id,
          bytes: item.bytes,
          fileName: item.fileName,
          label: item.label,
        });
      }
      return resolver.resolvePdfPageItem({
        id: item.id,
        bytes: item.bytes,
        sourcePath: item.sourcePath,
        sourcePageIndex: item.sourcePageIndex,
        label: item.label,
      });
    }),
  );
}

export function detectImagePackSourceKind(fileName: string): ImagePackSourceKind | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "pdf-page";
  }
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image";
  }
  return undefined;
}
