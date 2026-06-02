import type {
  OcrOutputStrategy,
  OcrQualityCheckRequest,
  OcrRequest,
  PreparedOcrRequest,
} from "./types";

export interface OcrValidationResult {
  valid: boolean;
  errors: string[];
}

const allowedOutputStrategies = new Set<OcrOutputStrategy>([
  "new-layered-pdf",
  "text-sidecar",
  "quality-check-only",
]);

export function createDefaultOcrQualityCheckRequest(): OcrQualityCheckRequest {
  return {
    enabled: false,
    samplePages: [],
    keywords: [],
  };
}

export function normalizeOcrQualityCheckRequest(input: OcrQualityCheckRequest | undefined): OcrQualityCheckRequest {
  const defaults = createDefaultOcrQualityCheckRequest();
  if (!input) {
    return defaults;
  }

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : defaults.enabled,
    samplePages: Array.isArray(input.samplePages) ? input.samplePages.filter(isPositiveInteger) : defaults.samplePages,
    keywords: Array.isArray(input.keywords)
      ? input.keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0)
      : defaults.keywords,
    minTextPageRatio:
      typeof input.minTextPageRatio === "number" ? input.minTextPageRatio : defaults.minTextPageRatio,
    maxFileSizeRatio:
      typeof input.maxFileSizeRatio === "number" ? input.maxFileSizeRatio : defaults.maxFileSizeRatio,
  };
}

export function prepareOcrRequest(request: OcrRequest): PreparedOcrRequest {
  const outputStrategy = request.outputStrategy ?? "new-layered-pdf";
  const outputPath = request.outputPath?.trim() || suggestOcrOutputPath(request.inputPath);

  return {
    ...request,
    outputPath,
    outputStrategy,
    qualityCheck: normalizeOcrQualityCheckRequest(request.qualityCheck),
  };
}

export function validateOcrRequest(request: OcrRequest): OcrValidationResult {
  const errors: string[] = [];
  const inputPath = request.inputPath.trim();
  const outputPath = request.outputPath?.trim();
  const outputStrategy = request.outputStrategy ?? "new-layered-pdf";
  const qualityCheck = normalizeOcrQualityCheckRequest(request.qualityCheck);

  if (!inputPath) {
    errors.push("输入 PDF 路径不能为空。");
  } else if (!isPdfPath(inputPath)) {
    errors.push("输入文件必须是 PDF。");
  }

  if (!request.providerId.trim()) {
    errors.push("OCR Provider 不能为空。");
  }

  if (!allowedOutputStrategies.has(outputStrategy)) {
    errors.push("OCR 输出策略无效。");
  }
  if (outputStrategy !== "new-layered-pdf") {
    errors.push("OCR bridge 第一版只支持 new-layered-pdf 输出策略。");
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

  if (qualityCheck.samplePages.some((page) => !isPositiveInteger(page))) {
    errors.push("OCR 质量抽查页码必须是正整数。");
  }
  if (
    qualityCheck.minTextPageRatio !== undefined &&
    (!Number.isFinite(qualityCheck.minTextPageRatio) ||
      qualityCheck.minTextPageRatio < 0 ||
      qualityCheck.minTextPageRatio > 1)
  ) {
    errors.push("OCR 质量抽查文字页比例阈值必须在 0 到 1 之间。");
  }
  if (
    qualityCheck.maxFileSizeRatio !== undefined &&
    (!Number.isFinite(qualityCheck.maxFileSizeRatio) || qualityCheck.maxFileSizeRatio <= 0)
  ) {
    errors.push("OCR 质量抽查文件体积比例阈值必须大于 0。");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function suggestOcrOutputPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const directory = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex + 1) : "";
  const fileName = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
  const stem = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  const safeStem = stem.length > 0 ? stem : "document";

  return `${directory}${safeStem}-ocr.pdf`;
}

export function sanitizeOcrError(message: string): string {
  return message
    .replace(/\b[A-Za-z]:[\\/][^，。；;,\n\r]*?\.pdf/gi, "[path]")
    .replace(/\/[^，。；;,\n\r]*?\.pdf/gi, "[path]");
}

function isPdfPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith(".pdf");
}

function samePath(left: string, right: string): boolean {
  return normalizePathForComparison(left) === normalizePathForComparison(right);
}

function normalizePathForComparison(path: string): string {
  const normalizedSeparators = path.trim().replace(/\\/g, "/");
  const driveMatch = /^([A-Za-z]:)(.*)$/.exec(normalizedSeparators);
  const drivePrefix = driveMatch?.[1]?.toLowerCase() ?? "";
  const pathBody = driveMatch ? driveMatch[2] : normalizedSeparators;
  const isAbsolute = pathBody.startsWith("/");
  const parts: string[] = [];

  for (const part of pathBody.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      const lastPart = parts.at(-1);
      if (lastPart && lastPart !== "..") {
        parts.pop();
      } else if (!isAbsolute) {
        parts.push(part);
      }
      continue;
    }

    parts.push(part);
  }

  const prefix = `${drivePrefix}${isAbsolute ? "/" : ""}`;
  return `${prefix}${parts.join("/")}`.replace(/\/+$/, "").toLowerCase();
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
    return isPositiveInteger(start) && isPositiveInteger(end) && end >= start;
  });
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
