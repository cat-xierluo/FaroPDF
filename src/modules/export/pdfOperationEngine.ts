import { degrees, PDFDocument, PDFName, PDFNumber, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  PdfBatesNumberOperation,
  PdfCompressionOperation,
  PdfAnnotationFlattenPlan,
  PdfExportRequest,
  PdfExportResult,
  PdfExportSummary,
  PdfFormFlatteningSummary,
  PdfOutputPlacement,
  PdfOutputToolPlanEntry,
  PdfOutputToolOperationType,
  PdfPageOperationPlan,
  PdfPageNumberOperation,
  PdfWatermarkOperation,
} from "../../shared";
import { isPdfPath, pathsAreSame } from "./pathSafety";

const PAGE_OPERATIONS_PLAN_ONLY_WARNING = "页面操作当前仅生成导出计划，尚未改写页面几何或顺序。";
const COMPRESSION_PLAN_ONLY_WARNING = "PDF 压缩当前仅生成导出计划，尚未执行图像重编码或降采样。";

export interface PdfOperationEngine {
  exportPdf: (request: PdfExportRequest) => Promise<PdfExportResult>;
}

interface PdfOperationEngineOptions {
  now?: () => string;
}

export function createPdfOperationEngine(options: PdfOperationEngineOptions = {}): PdfOperationEngine {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async exportPdf(request) {
      validatePdfExportRequest(request);

      const workingPdf = await PDFDocument.load(copyBytes(request.source.bytes), {
        updateMetadata: false,
      });
      const inputPageCount = workingPdf.getPageCount();
      const summary: PdfExportSummary = {
        inputPageCount,
        outputPageCount: inputPageCount,
        operationCount: request.operations.length,
      };
      const warnings: string[] = [];
      const outputToolEntries: PdfOutputToolPlanEntry[] = [];
      let pageOrder: number[] | null = null;
      let pageRotations: Map<number, number> | null = null;

      for (const operation of request.operations) {
        if (operation.type === "flatten-annotations") {
          summary.annotationPlan = buildAnnotationFlattenPlan(operation, request.source.fingerprint, inputPageCount);
          continue;
        }

        if (operation.type === "flatten-form") {
          summary.formFlattening = flattenFormFields(workingPdf);
          continue;
        }

        if (isOutputToolOperation(operation)) {
          const result = await applyOutputToolOperation(workingPdf, operation, inputPageCount);
          outputToolEntries.push(result.entry);
          warnings.push(...result.warnings);
          continue;
        }

        if (operation.type === "page-operations") {
          if ((operation.mode ?? "plan-only") === "execute") {
            const result = resolvePageOperations(operation, inputPageCount);
            summary.pageOperationPlan = result.plan;
            pageOrder = result.pageOrder;
            pageRotations = result.rotations;
          } else {
            summary.pageOperationPlan = buildPageOperationPlan(operation, inputPageCount);
            warnings.push(PAGE_OPERATIONS_PLAN_ONLY_WARNING);
          }
          continue;
        }
      }

      if (outputToolEntries.length > 0) {
        summary.outputToolPlan = {
          entries: outputToolEntries,
        };
      }

      if (warnings.length > 0) {
        summary.warnings = Array.from(new Set(warnings));
      }

      let outputPdf: PDFDocument;
      if (pageOrder !== null) {
        outputPdf = await buildOutputPdf(workingPdf, pageOrder, pageRotations ?? new Map());
      } else {
        outputPdf = await copyPdfDocument(workingPdf);
      }
      applyExportMetadata(outputPdf, summary);
      summary.outputPageCount = outputPdf.getPageCount();

      return {
        id: request.id,
        bytes: await outputPdf.save(),
        destination: request.destination,
        summary,
        completedAt: now(),
      };
    },
  };
}

function validatePdfExportRequest(request: PdfExportRequest): void {
  if (!request.id.trim()) {
    throw new Error("PDF 导出请求缺少 id");
  }

  if (request.source.bytes.length === 0) {
    throw new Error("PDF 导出请求缺少输入 PDF bytes");
  }

  if (request.destination.type === "file" && !request.destination.outputPath.trim()) {
    throw new Error("PDF 导出请求缺少输出路径");
  }

  if (request.destination.type === "file" && !isPdfPath(request.destination.outputPath)) {
    throw new Error("导出输出路径必须是 PDF。");
  }

  if (
    request.source.path &&
    request.destination.type === "file" &&
    pathsAreSame(request.source.path, request.destination.outputPath)
  ) {
    throw new Error("导出输出路径不能与原始 PDF 相同");
  }
}

function buildAnnotationFlattenPlan(
  operation: Extract<PdfExportRequest["operations"][number], { type: "flatten-annotations" }>,
  sourceFingerprint: string | undefined,
  inputPageCount: number,
): PdfAnnotationFlattenPlan {
  const sidecar = operation.sidecar;
  if ((operation.strategy ?? "plan-only") !== "plan-only") {
    throw new Error("批注扁平化第一版只支持 plan-only 策略。");
  }
  if (sidecar.document.pageCount !== undefined && sidecar.document.pageCount !== inputPageCount) {
    throw new Error("批注 sidecar 页数与源 PDF 不一致。");
  }
  if (
    sourceFingerprint &&
    sidecar.document.fingerprint &&
    sidecar.document.fingerprint !== sourceFingerprint
  ) {
    throw new Error("批注 sidecar 指纹与源 PDF 不一致。");
  }
  if (sidecar.annotations.some((annotation) => !isPageIndexInRange(annotation.pageIndex, inputPageCount))) {
    throw new Error("批注页码超出源 PDF 页数。");
  }

  return {
    strategy: "plan-only",
    annotationCount: sidecar.annotations.length,
    entries: sidecar.annotations.map((annotation) => ({
      annotationId: annotation.id,
      type: annotation.type,
      pageIndex: annotation.pageIndex,
      rectCount: annotation.rects.length,
      status: "planned",
    })),
  };
}

function flattenFormFields(pdf: PDFDocument): PdfFormFlatteningSummary {
  const form = pdf.getForm();
  const fieldCountBeforeFlatten = form.getFields().length;

  form.flatten();

  return {
    requested: true,
    flattened: true,
    fieldCountBeforeFlatten,
  };
}

function buildPageOperationPlan(
  operation: Extract<PdfExportRequest["operations"][number], { type: "page-operations" }>,
  inputPageCount: number,
): PdfPageOperationPlan {
  if ((operation.mode ?? "plan-only") !== "plan-only") {
    throw new Error("页面操作导出第一版只支持 plan-only 模式。");
  }
  if (
    operation.operations.some((pageOperation) =>
      pageOperation.pageIndexes.some((pageIndex) => !isPageIndexInRange(pageIndex, inputPageCount)),
    )
  ) {
    throw new Error("页面操作页码超出源 PDF 页数。");
  }

  return {
    mode: "plan-only",
    operationCount: operation.operations.length,
    entries: operation.operations.map((pageOperation) => ({
      operationId: pageOperation.id,
      type: pageOperation.type,
      pageIndexes: [...pageOperation.pageIndexes],
      status: "planned",
    })),
  };
}

interface PageOperationExecutionResult {
  plan: PdfPageOperationPlan;
  pageOrder: number[];
  rotations: Map<number, number>;
}

function resolvePageOperations(
  operation: Extract<PdfExportRequest["operations"][number], { type: "page-operations" }>,
  inputPageCount: number,
): PageOperationExecutionResult {
  if (
    operation.operations.some((pageOp) =>
      pageOp.pageIndexes.some((pageIndex) => !isPageIndexInRange(pageIndex, inputPageCount)),
    )
  ) {
    throw new Error("页面操作页码超出源 PDF 页数。");
  }

  const reorderOp = operation.operations.find((op) => op.type === "reorder");
  const deleteOp = operation.operations.find((op) => op.type === "delete");
  const rotateOps = operation.operations.filter((op) => op.type === "rotate");

  let pageOrder: number[];
  if (reorderOp) {
    pageOrder = [...reorderOp.pageIndexes];
  } else {
    pageOrder = Array.from({ length: inputPageCount }, (_, i) => i);
  }

  if (deleteOp) {
    const deletedSet = new Set(deleteOp.pageIndexes);
    pageOrder = pageOrder.filter((pi) => !deletedSet.has(pi));
  }

  const rotations = new Map<number, number>();
  for (const rotateOp of rotateOps) {
    const angle = typeof rotateOp.payload.angle === "number" ? rotateOp.payload.angle : 0;
    if (angle === 0) continue;
    for (const pageIndex of rotateOp.pageIndexes) {
      const prev = rotations.get(pageIndex) ?? 0;
      rotations.set(pageIndex, (prev + angle) % 360);
    }
  }

  const plan: PdfPageOperationPlan = {
    mode: "execute",
    operationCount: operation.operations.length,
    entries: operation.operations.map((pageOp) => ({
      operationId: pageOp.id,
      type: pageOp.type,
      pageIndexes: [...pageOp.pageIndexes],
      status: "applied" as const,
    })),
  };

  return { plan, pageOrder, rotations };
}

function setPageRotation(page: PDFPage, rotationDegrees: number): void {
  page.node.set(PDFName.of("Rotate"), PDFNumber.of(rotationDegrees));
}

async function buildOutputPdf(
  sourcePdf: PDFDocument,
  pageOrder: number[],
  rotations: Map<number, number>,
): Promise<PDFDocument> {
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, pageOrder);

  copiedPages.forEach((page, newPageIndex) => {
    outputPdf.addPage(page);
    const originalIndex = pageOrder[newPageIndex];
    const rotation = rotations.get(originalIndex);
    if (rotation) {
      setPageRotation(page, rotation);
    }
  });

  return outputPdf;
}

async function applyOutputToolOperation(
  pdf: PDFDocument,
  operation: PdfWatermarkOperation | PdfPageNumberOperation | PdfBatesNumberOperation | PdfCompressionOperation,
  inputPageCount: number,
): Promise<{ entry: PdfOutputToolPlanEntry; warnings: string[] }> {
  const pageIndexes = resolveOutputToolPageIndexes(operation.pageIndexes, inputPageCount);

  if (operation.type === "watermark") {
    const label = await applyWatermark(pdf, operation, pageIndexes);
    return {
      entry: {
        operationId: operation.id,
        type: operation.type,
        pageIndexes,
        status: "applied",
        label,
      },
      warnings: [],
    };
  }

  if (operation.type === "page-number") {
    const labels = await applyPageNumbers(pdf, operation, pageIndexes, inputPageCount);
    return {
      entry: {
        operationId: operation.id,
        type: operation.type,
        pageIndexes,
        status: "applied",
        label: labels.join(", "),
      },
      warnings: [],
    };
  }

  if (operation.type === "bates-number") {
    const labels = await applyBatesNumbers(pdf, operation, pageIndexes);
    return {
      entry: {
        operationId: operation.id,
        type: operation.type,
        pageIndexes,
        status: "applied",
        label: labels.join(", "),
      },
      warnings: [],
    };
  }

  if ((operation.mode ?? "plan-only") !== "plan-only") {
    throw new Error("PDF 压缩第一版只支持 plan-only 模式。");
  }

  return {
    entry: {
      operationId: operation.id,
      type: operation.type,
      pageIndexes,
      status: "planned",
      label: operation.preset,
    },
    warnings: [COMPRESSION_PLAN_ONLY_WARNING],
  };
}

async function applyWatermark(
  pdf: PDFDocument,
  operation: PdfWatermarkOperation,
  pageIndexes: number[],
): Promise<string> {
  const watermark = operation.watermark;

  if (watermark.kind === "text") {
    const text = watermark.text.trim();
    if (!text) {
      throw new Error("文字水印内容不能为空。");
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSize = normalizePositiveNumber(watermark.fontSize, 32);
    const color = parseHexColor(watermark.color ?? "#404040");
    const opacity = normalizeOpacity(watermark.opacity, 0.18);
    const rotationDegrees = normalizeFiniteNumber(watermark.rotationDegrees, -35);

    for (const pageIndex of pageIndexes) {
      const page = pdf.getPage(pageIndex);
      const width = measureTextWidth(font, text, fontSize);
      const height = font.heightAtSize(fontSize);
      const position = getPlacementPosition(page, {
        width,
        height,
        placement: watermark.placement ?? "center",
        margin: normalizePositiveNumber(watermark.margin, 36),
      });

      page.drawText(text, {
        x: position.x,
        y: position.y,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(rotationDegrees),
      });
    }

    return text;
  }

  const image =
    watermark.imageType === "png"
      ? await pdf.embedPng(watermark.imageBytes)
      : await pdf.embedJpg(watermark.imageBytes);
  const opacity = normalizeOpacity(watermark.opacity, 0.25);
  const rotationDegrees = normalizeFiniteNumber(watermark.rotationDegrees, 0);

  for (const pageIndex of pageIndexes) {
    const page = pdf.getPage(pageIndex);
    const pageSize = page.getSize();
    const requestedWidth = watermark.width;
    const requestedHeight = watermark.height;
    const width = normalizePositiveNumber(requestedWidth, Math.min(pageSize.width * 0.4, image.width));
    const height = normalizePositiveNumber(requestedHeight, width * (image.height / image.width));
    const position = getPlacementPosition(page, {
      width,
      height,
      placement: watermark.placement ?? "center",
      margin: normalizePositiveNumber(watermark.margin, 36),
    });

    page.drawImage(image, {
      x: position.x,
      y: position.y,
      width,
      height,
      opacity,
      rotate: degrees(rotationDegrees),
    });
  }

  return "image watermark";
}

async function applyPageNumbers(
  pdf: PDFDocument,
  operation: PdfPageNumberOperation,
  pageIndexes: number[],
  inputPageCount: number,
): Promise<string[]> {
  const startNumber = normalizePageNumberStart(operation.startNumber);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = normalizePositiveNumber(operation.fontSize, 10);
  const color = parseHexColor(operation.color ?? "#202020");
  const labels: string[] = [];

  pageIndexes.forEach((pageIndex, sequenceIndex) => {
    const label = formatPageNumberLabel(operation, startNumber, sequenceIndex, inputPageCount);
    drawFooterLabel(pdf.getPage(pageIndex), label, font, {
      placement: operation.placement ?? "bottom-center",
      fontSize,
      color,
      margin: normalizePositiveNumber(operation.margin, 28),
    });
    labels.push(label);
  });

  return labels;
}

async function applyBatesNumbers(
  pdf: PDFDocument,
  operation: PdfBatesNumberOperation,
  pageIndexes: number[],
): Promise<string[]> {
  if (!Number.isInteger(operation.startNumber) || operation.startNumber < 0) {
    throw new Error("Bates 起始号必须是非负整数。");
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = normalizePositiveNumber(operation.fontSize, 10);
  const color = parseHexColor(operation.color ?? "#202020");
  const labels: string[] = [];
  const digits = normalizeBatesDigits(operation.digits);

  pageIndexes.forEach((pageIndex, sequenceIndex) => {
    const number = operation.startNumber + sequenceIndex;
    const label = `${operation.prefix ?? ""}${String(number).padStart(digits, "0")}${operation.suffix ?? ""}`;
    drawFooterLabel(pdf.getPage(pageIndex), label, font, {
      placement: operation.placement ?? "bottom-right",
      fontSize,
      color,
      margin: normalizePositiveNumber(operation.margin, 28),
    });
    labels.push(label);
  });

  return labels;
}

function drawFooterLabel(
  page: PDFPage,
  label: string,
  font: PDFFont,
  options: {
    placement: PdfOutputPlacement;
    fontSize: number;
    color: ReturnType<typeof rgb>;
    margin: number;
  },
): void {
  const width = measureTextWidth(font, label, options.fontSize);
  const height = font.heightAtSize(options.fontSize);
  const position = getPlacementPosition(page, {
    width,
    height,
    placement: options.placement,
    margin: options.margin,
  });

  page.drawText(label, {
    x: position.x,
    y: position.y,
    size: options.fontSize,
    font,
    color: options.color,
  });
}

function formatPageNumberLabel(
  operation: PdfPageNumberOperation,
  startNumber: number,
  sequenceIndex: number,
  inputPageCount: number,
): string {
  const pageNumber = startNumber + sequenceIndex;
  const format = operation.format ?? "{page}";

  return format.replace(/\{page\}/g, String(pageNumber)).replace(/\{total\}/g, String(inputPageCount));
}

function normalizePageNumberStart(value: number | undefined): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("页码起始号必须是正整数。");
  }

  return value;
}

function normalizeBatesDigits(value: number | undefined): number {
  if (value === undefined) {
    return 6;
  }
  if (!Number.isInteger(value) || value < 0 || value > 12) {
    throw new Error("Bates 编号位数必须是 0 到 12 的整数。");
  }

  return value;
}

function measureTextWidth(font: PDFFont, text: string, fontSize: number): number {
  try {
    return font.widthOfTextAtSize(text, fontSize);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("WinAnsi cannot encode")) {
      throw Object.assign(new Error("PDF 交付工具第一版暂不支持非 Latin-1 文本。"), {
        cause: error instanceof Error ? error : new Error(message),
      });
    }

    throw error;
  }
}

function getPlacementPosition(
  page: PDFPage,
  input: {
    width: number;
    height: number;
    placement: PdfOutputPlacement;
    margin: number;
  },
): { x: number; y: number } {
  const pageSize = page.getSize();
  const centerX = (pageSize.width - input.width) / 2;
  const centerY = (pageSize.height - input.height) / 2;
  const left = input.margin;
  const right = pageSize.width - input.margin - input.width;
  const bottom = input.margin;
  const top = pageSize.height - input.margin - input.height;

  switch (input.placement) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: centerX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: centerX, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    case "center":
    default:
      return { x: centerX, y: centerY };
  }
}

function resolveOutputToolPageIndexes(pageIndexes: number[] | undefined, inputPageCount: number): number[] {
  const resolvedPageIndexes =
    pageIndexes && pageIndexes.length > 0
      ? Array.from(new Set(pageIndexes))
      : Array.from({ length: inputPageCount }, (_, pageIndex) => pageIndex);

  if (resolvedPageIndexes.some((pageIndex) => !isPageIndexInRange(pageIndex, inputPageCount))) {
    throw new Error("交付工具页码超出源 PDF 页数。");
  }

  return resolvedPageIndexes;
}

function isOutputToolOperation(
  operation: PdfExportRequest["operations"][number],
): operation is PdfWatermarkOperation | PdfPageNumberOperation | PdfBatesNumberOperation | PdfCompressionOperation {
  return isOutputToolOperationType(operation.type);
}

function isOutputToolOperationType(type: string): type is PdfOutputToolOperationType {
  return type === "watermark" || type === "page-number" || type === "bates-number" || type === "compress";
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOpacity(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

function parseHexColor(value: string): ReturnType<typeof rgb> {
  const trimmed = value.trim();
  const sixDigitMatch = /^#?([a-fA-F0-9]{6})$/.exec(trimmed);
  if (sixDigitMatch) {
    const hex = sixDigitMatch[1];
    return rgb(
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
    );
  }

  const threeDigitMatch = /^#?([a-fA-F0-9]{3})$/.exec(trimmed);
  if (threeDigitMatch) {
    const hex = threeDigitMatch[1];
    return rgb(
      Number.parseInt(hex[0] + hex[0], 16) / 255,
      Number.parseInt(hex[1] + hex[1], 16) / 255,
      Number.parseInt(hex[2] + hex[2], 16) / 255,
    );
  }

  throw new Error("PDF 交付工具颜色必须是十六进制颜色。");
}

function isPageIndexInRange(pageIndex: number, pageCount: number): boolean {
  return Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < pageCount;
}

async function copyPdfDocument(sourcePdf: PDFDocument): Promise<PDFDocument> {
  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

  copiedPages.forEach((page) => outputPdf.addPage(page));

  return outputPdf;
}

function applyExportMetadata(pdf: PDFDocument, summary: PdfExportSummary): void {
  const keywords = ["faropdf:export-copy"];

  pdf.setCreator("FaroPDF");
  pdf.setProducer("FaroPDF pdf-lib export engine");

  if (summary.annotationPlan) {
    keywords.push("faropdf:annotation-plan-only", `faropdf:annotation-count:${summary.annotationPlan.annotationCount}`);
    pdf.setSubject(`FaroPDF annotation plan-only export with ${summary.annotationPlan.annotationCount} sidecar entries`);
  }

  if (summary.formFlattening?.flattened) {
    keywords.push("faropdf:form-flattened");
  }

  if (summary.pageOperationPlan) {
    keywords.push("faropdf:page-operations-plan-only");
  }

  if (summary.outputToolPlan) {
    keywords.push("faropdf:output-tools", `faropdf:output-tool-count:${summary.outputToolPlan.entries.length}`);
  }

  pdf.setKeywords(keywords);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
