import { PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";

export interface CompressionOptions {
  useObjectStreams?: boolean;
  imageQuality?: number;
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
  warnings: string[];
}

export async function compressPdf(
  inputBytes: Uint8Array,
  options: CompressionOptions = {},
): Promise<CompressionResult> {
  if (inputBytes.byteLength === 0) {
    throw new Error("PDF 压缩请求缺少输入 bytes");
  }

  if (options.imageQuality !== undefined) {
    if (typeof options.imageQuality !== "number" || !Number.isFinite(options.imageQuality)) {
      throw new Error("imageQuality 必须在 0 到 1 之间。");
    }
    if (options.imageQuality < 0 || options.imageQuality > 1) {
      throw new Error("imageQuality 必须在 0 到 1 之间。");
    }
  }

  const useObjectStreams = options.useObjectStreams ?? true;
  const warnings: string[] = [];
  const sourceBytes = new Uint8Array(inputBytes);

  const pdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const outputBytes = await pdf.save({ useObjectStreams });

  const imageResampling: ImageResamplingDiagnostics = options.imageQuality !== undefined
    ? planOnlyImageInventory(pdf)
    : emptyImageDiagnostics();

  if (options.imageQuality !== undefined && imageResampling.imageCount > 0) {
    warnings.push(
      `PDF 图像像素重采样当前 plan-only：检测到 ${imageResampling.imageCount} 张图像（FlateDecode ${imageResampling.flateDecodeCount} / DCTDecode ${imageResampling.dctDecodeCount} / 其他 ${imageResampling.otherCount}），完整降采样由后续 PyMuPDF bridge 提供。`,
    );
  }

  return {
    bytes: outputBytes,
    inputBytes: sourceBytes.byteLength,
    outputBytes: outputBytes.byteLength,
    ratio: sourceBytes.byteLength / Math.max(outputBytes.byteLength, 1),
    useObjectStreams,
    imageResampling,
    warnings,
  };
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

function planOnlyImageInventory(pdf: PDFDocument): ImageResamplingDiagnostics {
  const inventory = {
    imageCount: 0,
    flateDecodeCount: 0,
    dctDecodeCount: 0,
    otherCount: 0,
  };

  for (const page of pdf.getPages()) {
    const resourcesLookup = page.node.lookup(PDFName.of("Resources"), PDFDict);
    if (!resourcesLookup) continue;

    const xobjects = resourcesLookup.lookup(PDFName.of("XObject"), PDFDict);
    if (!xobjects) continue;

    for (const key of xobjects.keys()) {
      const stream = xobjects.lookup(key, PDFStream);
      if (!stream) continue;
      const subtype = stream.dict.lookup(PDFName.of("Subtype"));
      if (!(subtype instanceof PDFName) || subtype.encodedName !== "/Image") {
        continue;
      }

      inventory.imageCount += 1;
      const filter = stream.dict.lookup(PDFName.of("Filter"));
      if (filter instanceof PDFName) {
        if (filter.encodedName === "/FlateDecode") {
          inventory.flateDecodeCount += 1;
        } else if (filter.encodedName === "/DCTDecode") {
          inventory.dctDecodeCount += 1;
        } else {
          inventory.otherCount += 1;
        }
      } else {
        inventory.otherCount += 1;
      }
    }
  }

  return {
    requested: true,
    imageCount: inventory.imageCount,
    resampledImages: 0,
    skippedImages: inventory.imageCount,
    flateDecodeCount: inventory.flateDecodeCount,
    dctDecodeCount: inventory.dctDecodeCount,
    otherCount: inventory.otherCount,
  };
}
