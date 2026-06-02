import type { ScanPreprocessOptions, ScanPreprocessRequest } from "./types";

export interface ScanPreprocessValidationResult {
  valid: boolean;
  errors: string[];
}

export function createDefaultScanPreprocessOptions(): ScanPreprocessOptions {
  return {
    enhanceScans: true,
    detectOrientation: true,
    deskew: true,
    splitPages: false,
    cropPages: false,
    trimBlankEdges: false,
    outputMode: "preprocess-only",
    dpi: 300,
    jpegQuality: 90,
    skewThresholdDegrees: 0.3,
    rotationConfidence: 0.5,
    maxDeskewDegrees: 5,
    blankEdgeMarginPx: 10,
    blankEdgeThreshold: 254,
    parallelJobs: 1,
    chunkPages: 0,
    preserveOriginalPageSize: true,
  };
}

export function normalizeScanPreprocessOptions(input: Partial<ScanPreprocessOptions> | undefined): ScanPreprocessOptions {
  const defaults = createDefaultScanPreprocessOptions();
  if (!input) {
    return defaults;
  }

  return {
    enhanceScans: typeof input.enhanceScans === "boolean" ? input.enhanceScans : defaults.enhanceScans,
    detectOrientation:
      typeof input.detectOrientation === "boolean" ? input.detectOrientation : defaults.detectOrientation,
    deskew: typeof input.deskew === "boolean" ? input.deskew : defaults.deskew,
    splitPages: typeof input.splitPages === "boolean" ? input.splitPages : defaults.splitPages,
    cropPages: typeof input.cropPages === "boolean" ? input.cropPages : defaults.cropPages,
    trimBlankEdges: typeof input.trimBlankEdges === "boolean" ? input.trimBlankEdges : defaults.trimBlankEdges,
    outputMode: input.outputMode === "preprocess-only" ? input.outputMode : defaults.outputMode,
    dpi: typeof input.dpi === "number" ? input.dpi : defaults.dpi,
    jpegQuality: typeof input.jpegQuality === "number" ? input.jpegQuality : defaults.jpegQuality,
    skewThresholdDegrees:
      typeof input.skewThresholdDegrees === "number" ? input.skewThresholdDegrees : defaults.skewThresholdDegrees,
    rotationConfidence:
      typeof input.rotationConfidence === "number" ? input.rotationConfidence : defaults.rotationConfidence,
    maxDeskewDegrees: typeof input.maxDeskewDegrees === "number" ? input.maxDeskewDegrees : defaults.maxDeskewDegrees,
    blankEdgeMarginPx:
      typeof input.blankEdgeMarginPx === "number" ? input.blankEdgeMarginPx : defaults.blankEdgeMarginPx,
    blankEdgeThreshold:
      typeof input.blankEdgeThreshold === "number" ? input.blankEdgeThreshold : defaults.blankEdgeThreshold,
    parallelJobs: typeof input.parallelJobs === "number" ? input.parallelJobs : defaults.parallelJobs,
    chunkPages: typeof input.chunkPages === "number" ? input.chunkPages : defaults.chunkPages,
    preserveOriginalPageSize:
      typeof input.preserveOriginalPageSize === "boolean"
        ? input.preserveOriginalPageSize
        : defaults.preserveOriginalPageSize,
  };
}

export function prepareScanPreprocessRequest(request: ScanPreprocessRequest): ScanPreprocessRequest {
  const options = normalizeScanPreprocessOptions(request.options);
  const outputPath = request.outputPath?.trim() || suggestScanPreprocessOutputPath(request.inputPath);

  return {
    inputPath: request.inputPath,
    outputPath,
    pageRange: request.pageRange,
    options,
  };
}

export function validateScanPreprocessRequest(request: ScanPreprocessRequest): ScanPreprocessValidationResult {
  const errors: string[] = [];
  const options = normalizeScanPreprocessOptions(request.options);
  const inputPath = request.inputPath.trim();
  const outputPath = request.outputPath?.trim();

  if (!inputPath) {
    errors.push("输入 PDF 路径不能为空。");
  } else if (!isPdfPath(inputPath)) {
    errors.push("输入文件必须是 PDF。");
  }

  if (outputPath) {
    if (!isPdfPath(outputPath)) {
      errors.push("输出文件必须是 PDF。");
    }
    if (samePath(inputPath, outputPath)) {
      errors.push("输出 PDF 必须是不同于原始 PDF 的新文件。");
    }
  }

  if (request.pageRange && !isValidPageRange(request.pageRange)) {
    errors.push("页码范围必须使用正整数或正整数区间，例如 1,3-5。");
  }

  if (!hasEnabledOperation(options)) {
    errors.push("至少需要启用一个扫描预处理动作。");
  }
  if (!Number.isFinite(options.dpi) || options.dpi < 72 || options.dpi > 600) {
    errors.push("DPI 必须在 72 到 600 之间。");
  }
  if (!Number.isInteger(options.jpegQuality) || options.jpegQuality < 1 || options.jpegQuality > 100) {
    errors.push("JPEG 质量必须在 1 到 100 之间。");
  }
  if (!Number.isFinite(options.rotationConfidence) || options.rotationConfidence < 0 || options.rotationConfidence > 1) {
    errors.push("旋转置信度必须在 0 到 1 之间。");
  }
  if (
    !Number.isFinite(options.skewThresholdDegrees) ||
    options.skewThresholdDegrees < 0.1 ||
    options.skewThresholdDegrees > 5
  ) {
    errors.push("倾斜阈值必须在 0.1 到 5 度之间。");
  }
  if (!Number.isFinite(options.maxDeskewDegrees) || options.maxDeskewDegrees < 0.3 || options.maxDeskewDegrees > 15) {
    errors.push("最大微倾斜角必须在 0.3 到 15 度之间。");
  }
  if (!Number.isInteger(options.parallelJobs) || options.parallelJobs < 0 || options.parallelJobs > 64) {
    errors.push("并行处理数必须为 0 到 64；0 表示自动。");
  }
  if (!Number.isInteger(options.chunkPages) || options.chunkPages < 0 || options.chunkPages > 500) {
    errors.push("分块页数必须为 0 到 500；0 表示不分块。");
  }
  if (!Number.isInteger(options.blankEdgeMarginPx) || options.blankEdgeMarginPx < 0 || options.blankEdgeMarginPx > 200) {
    errors.push("清边保留边距必须在 0 到 200 像素之间。");
  }
  if (
    !Number.isInteger(options.blankEdgeThreshold) ||
    options.blankEdgeThreshold < 1 ||
    options.blankEdgeThreshold > 255
  ) {
    errors.push("空白边阈值必须在 1 到 255 之间。");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function suggestScanPreprocessOutputPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const directory = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex + 1) : "";
  const fileName = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
  const stem = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  const safeStem = stem.length > 0 ? stem : "document";

  return `${directory}${safeStem}-preprocessed.pdf`;
}

export function sanitizeScanPreprocessError(message: string): string {
  return message
    .replace(/[A-Za-z]:\\[^，。；\s]+?\.pdf/gi, "[path]")
    .replace(/\/[^，。；\s]+?\.pdf/gi, "[path]");
}

function hasEnabledOperation(options: ScanPreprocessOptions): boolean {
  return (
    options.enhanceScans ||
    options.detectOrientation ||
    options.deskew ||
    options.splitPages ||
    options.cropPages ||
    options.trimBlankEdges
  );
}

function isPdfPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith(".pdf");
}

function samePath(left: string, right: string): boolean {
  return normalizePathForComparison(left) === normalizePathForComparison(right);
}

function normalizePathForComparison(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isValidPageRange(raw: string): boolean {
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return false;
  }

  return parts.every((part) => {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) {
      return false;
    }

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    return Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start;
  });
}
