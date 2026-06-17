import { PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";
import type { PdfCompressionPreset } from "../../shared/pdf/export";
import { COURT_UPLOAD_PRESETS, isCourtUploadPreset } from "./presets/courtUploadPresets";
import { formatBytes as sharedFormatBytes } from "../../shared/formatBytes";

export interface CompressionOptions {
  useObjectStreams?: boolean;
  imageQuality?: number;
  preset?: PdfCompressionPreset;
  targetSizeBytes?: number;
}

export interface TargetSizeCheck {
  targetBytes: number;
  actualBytes: number;
  exceeded: boolean;
  exceededPercent: number;
}

export interface ImageResamplingDiagnostics {
  requested: boolean;
  imageCount: number;
  resampledImages: number;
  skippedImages: number;
  flateDecodeCount: number;
  dctDecodeCount: number;
  otherCount: number;
}

export interface CompressionResult {
  bytes: Uint8Array;
  inputBytes: number;
  outputBytes: number;
  ratio: number;
  useObjectStreams: boolean;
  imageResampling: ImageResamplingDiagnostics;
  targetSizeCheck?: TargetSizeCheck;
  warnings: string[];
}

function resolveCompressionParams(options: CompressionOptions): {
  imageQuality: number | undefined;
  targetSizeBytes: number | undefined;
} {
  if (options.preset) {
    if (isCourtUploadPreset(options.preset)) {
      const config = COURT_UPLOAD_PRESETS[options.preset];
      return {
        imageQuality: config.imageQuality,
        targetSizeBytes: config.targetSizeBytes,
      };
    }
    const legacyQuality: Record<string, number> = {
      screen: 0.5,
      ebook: 0.7,
      print: 0.9,
      "court-upload": 0.6,
    };
    return {
      imageQuality: legacyQuality[options.preset] ?? options.imageQuality,
      targetSizeBytes: options.targetSizeBytes,
    };
  }
  return {
    imageQuality: options.imageQuality,
    targetSizeBytes: options.targetSizeBytes,
  };
}

export async function compressPdf(
  inputBytes: Uint8Array,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  if (inputBytes.byteLength === 0) {
    throw new Error("PDF 压缩请求缺少输入 bytes");
  }

  const { imageQuality, targetSizeBytes } = resolveCompressionParams(options);

  if (imageQuality !== undefined) {
    if (typeof imageQuality !== "number" || !Number.isFinite(imageQuality)) {
      throw new Error("imageQuality 必须在 0 到 1 之间。");
    }
    if (imageQuality < 0 || imageQuality > 1) {
      throw new Error("imageQuality 必须在 0 到 1 之间。");
    }
  }

  const useObjectStreams = options.useObjectStreams ?? true;
  const warnings: string[] = [];
  const sourceBytes = new Uint8Array(inputBytes);

  const pdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });

  const imageResampling: ImageResamplingDiagnostics =
    imageQuality !== undefined
      ? await reencodeImages(pdf, imageQuality, warnings)
      : emptyImageDiagnostics();

  const outputBytes = await pdf.save({ useObjectStreams });

  let targetSizeCheck: TargetSizeCheck | undefined;
  if (targetSizeBytes !== undefined && targetSizeBytes > 0) {
    const exceededPercent =
      ((outputBytes.byteLength - targetSizeBytes) / targetSizeBytes) * 100;
    const exceeded = outputBytes.byteLength > targetSizeBytes * 1.1;
    targetSizeCheck = {
      targetBytes: targetSizeBytes,
      actualBytes: outputBytes.byteLength,
      exceeded,
      exceededPercent,
    };
    if (exceeded) {
      warnings.push(
        `压缩后体积 ${formatBytes(outputBytes.byteLength)} 超出目标 ${formatBytes(targetSizeBytes)} 超过 10%（实际 ${exceededPercent.toFixed(1)}%），仍输出文件。`,
      );
    }
  }

  return {
    bytes: outputBytes,
    inputBytes: sourceBytes.byteLength,
    outputBytes: outputBytes.byteLength,
    ratio: sourceBytes.byteLength / Math.max(outputBytes.byteLength, 1),
    useObjectStreams,
    imageResampling,
    targetSizeCheck,
    warnings,
  };
}

async function reencodeImages(
  pdf: PDFDocument,
  quality: number,
  warnings: string[],
): Promise<ImageResamplingDiagnostics> {
  const inventory = {
    imageCount: 0,
    resampledImages: 0,
    flateDecodeCount: 0,
    dctDecodeCount: 0,
    otherCount: 0,
  };

  let skippedImages = 0;

  for (const page of pdf.getPages()) {
    const resourcesMaybe = page.node.lookup(PDFName.of("Resources"));
    if (!(resourcesMaybe instanceof PDFDict)) continue;
    const resourcesLookup = resourcesMaybe;

    const xobjectsMaybe = resourcesLookup.lookup(PDFName.of("XObject"));
    if (!(xobjectsMaybe instanceof PDFDict)) continue;
    const xobjects = xobjectsMaybe;

    for (const key of xobjects.keys()) {
      const maybeStream = xobjects.lookup(key);
      if (!(maybeStream instanceof PDFStream)) continue;
      const stream = maybeStream;
      const subtype = stream.dict.lookup(PDFName.of("Subtype"));
      if (!(subtype instanceof PDFName) || subtype.toString() !== "/Image") {
        continue;
      }

      inventory.imageCount += 1;
      const filter = stream.dict.lookup(PDFName.of("Filter"));

      if (filter instanceof PDFName && filter.toString() === "/DCTDecode") {
        inventory.dctDecodeCount += 1;
        const reencoded = await reencodeDctDecodeImage(pdf, xobjects, key, stream, quality);
        if (reencoded) {
          inventory.resampledImages += 1;
        } else {
          skippedImages += 1;
        }
      } else if (filter instanceof PDFName && filter.toString() === "/FlateDecode") {
        inventory.flateDecodeCount += 1;
        skippedImages += 1;
      } else {
        inventory.otherCount += 1;
        skippedImages += 1;
      }
    }
  }

  const canReencode = typeof OffscreenCanvas !== "undefined" || typeof HTMLCanvasElement !== "undefined";
  if (inventory.imageCount > 0 && !canReencode) {
    warnings.push(
      `当前环境不支持 Canvas API，${inventory.dctDecodeCount} 张 JPEG 图像无法重编码，保留原图。`,
    );
  }

  return {
    requested: true,
    imageCount: inventory.imageCount,
    resampledImages: inventory.resampledImages,
    skippedImages,
    flateDecodeCount: inventory.flateDecodeCount,
    dctDecodeCount: inventory.dctDecodeCount,
    otherCount: inventory.otherCount,
  };
}

async function reencodeDctDecodeImage(
  pdf: PDFDocument,
  xobjects: PDFDict,
  key: PDFName,
  stream: PDFStream,
  quality: number,
): Promise<boolean> {
  const jpegBytes = stream.getContents();
  if (!jpegBytes || jpegBytes.length === 0) return false;

  const colorSpace = stream.dict.lookup(PDFName.of("ColorSpace"));
  if (colorSpace instanceof PDFName && colorSpace.toString() === "/DeviceCMYK") {
    return false;
  }

  try {
    const reencoded = await reencodeJpegWithCanvas(jpegBytes, quality);
    if (!reencoded || reencoded.length >= jpegBytes.length) return false;

    const width = stream.dict.lookup(PDFName.of("Width"));
    const height = stream.dict.lookup(PDFName.of("Height"));
    const bitsPerComponent = stream.dict.lookup(PDFName.of("BitsPerComponent"));

    const newStream = pdf.context.stream(reencoded);
    newStream.dict.set(PDFName.of("Subtype"), PDFName.of("Image"));
    newStream.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
    if (width) newStream.dict.set(PDFName.of("Width"), width);
    if (height) newStream.dict.set(PDFName.of("Height"), height);
    if (colorSpace) newStream.dict.set(PDFName.of("ColorSpace"), colorSpace);
    if (bitsPerComponent) newStream.dict.set(PDFName.of("BitsPerComponent"), bitsPerComponent);

    xobjects.set(key, newStream);
    return true;
  } catch {
    return false;
  }
}

async function reencodeJpegWithCanvas(
  jpegBytes: Uint8Array,
  quality: number,
): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    const blob = new Blob([jpegBytes], { type: "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const outputBlob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    const buffer = await outputBlob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (typeof HTMLCanvasElement !== "undefined" && typeof Image !== "undefined") {
    return await reencodeJpegWithHtmlCanvas(jpegBytes, quality);
  }

  return null;
}

async function reencodeJpegWithHtmlCanvas(
  jpegBytes: Uint8Array,
  quality: number,
): Promise<Uint8Array | null> {
  const blob = new Blob([jpegBytes], { type: "image/jpeg" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image load failed"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyImageDiagnostics(): ImageResamplingDiagnostics {
  return {
    requested: false,
    imageCount: 0,
    resampledImages: 0,
    skippedImages: 0,
    flateDecodeCount: 0,
    dctDecodeCount: 0,
    otherCount: 0,
  };
}

// ISS-071 阶段 2：本地 formatBytes 已迁移到 shared/formatBytes.ts。
// 共享版本已 import 在文件顶部，本地 wrapper 保留以备向后兼容。
function formatBytes(bytes: number): string {
  // 委托共享实现
  return sharedFormatBytes(bytes);
}
