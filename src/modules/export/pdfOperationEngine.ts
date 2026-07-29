import { degrees, PDFDocument, PDFName, PDFNumber, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  PdfBatesNumberOperation,
  PdfCompressionOperation,
  PdfAnnotationFlattenPlan,
  PdfExportRequest,
  PdfExportResult,
  PdfExportSummary,
  PdfExtractPagesOperation,
  PdfFormFlatteningSummary,
  PdfInsertPagesOperation,
  PdfMergePdfsOperation,
  PdfOutputPlacement,
  PdfOutputToolPlanEntry,
  PdfOutputToolOperationType,
  PdfPageOperationPlan,
  PdfPageNumberOperation,
  PdfWatermarkOperation,
} from "../../shared";
import { writeAnnotationPdf } from "../annotation/annotationPdfWriter";
import { isPdfPath, pathsAreSame } from "./pathSafety";
import { resolveTextFont } from "./fontAwareWatermark";
import { compressPdf } from "./compressionService";

const PAGE_OPERATIONS_PLAN_ONLY_WARNING = "页面操作当前仅生成导出计划，尚未改写页面几何或顺序。";
const COMPRESSION_PLAN_ONLY_WARNING = "PDF 压缩当前仅生成导出计划，尚未执行图像重编码。";

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

      let workingPdf = await PDFDocument.load(copyBytes(request.source.bytes), {
        updateMetadata: false,
      });
      let inputPageCount = workingPdf.getPageCount();
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
          const strategy = operation.strategy ?? "plan-only";
          if (strategy === "plan-only") {
            summary.annotationPlan = buildAnnotationFlattenPlan(operation, request.source.fingerprint, inputPageCount);
            continue;
          }
          // strategy === "draw"：实际绘制批注到 PDF 字节流，替换 workingPdf。
          // 错误（字体加载、PDF 解析、sidecar 校验）整体抛出并被调用方 catch。
          const drawResult = await writeAnnotationPdf({
            sourceBytes: await workingPdf.save({ useObjectStreams: true }),
            sidecar: operation.sidecar,
            ...(request.source.fingerprint ? { sourceFingerprint: request.source.fingerprint } : {}),
          });
          workingPdf = await PDFDocument.load(drawResult.bytes, { updateMetadata: false });
          // draw 完成后 inputPageCount 可能变化（但当前 writeAnnotationPdf 不删页，仅绘制），保险重新计算
          inputPageCount = workingPdf.getPageCount();
          summary.annotationPlan = buildAnnotationFlattenPlan(
            operation,
            request.source.fingerprint,
            inputPageCount,
            drawResult.summary,
          );
          // 跳过条目（非致命警告）写到 warnings
          for (const skip of drawResult.summary.skipped) {
            warnings.push(`批注 ${skip.annotationId}（${skip.type}）未绘制：${skip.reason}`);
          }
          continue;
        }

        if (operation.type === "flatten-form") {
          summary.formFlattening = flattenFormFields(workingPdf);
          continue;
        }

        if (isOutputToolOperation(operation)) {
          const result = await applyOutputToolOperation(workingPdf, operation, inputPageCount);
          if (result.replacementPdf) {
            workingPdf = result.replacementPdf;
            inputPageCount = workingPdf.getPageCount();
            summary.outputPageCount = inputPageCount;
          }
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

      // ISS-NEW-A: insert-pages / merge-pdfs / extract-pages 改写 workingPdf 后继续后续 operation
      // 互斥: 一次只允许 1 个(取第一个), 多个时报错
      const rewriteOps = request.operations.filter(
        (op) => op.type === "insert-pages" || op.type === "merge-pdfs" || op.type === "extract-pages",
      );
      if (rewriteOps.length > 1) {
        throw new Error(
          `insert-pages / merge-pdfs / extract-pages 互斥, 一次只允许 1 个, 实际 ${rewriteOps.length} 个。`,
        );
      }
      if (rewriteOps.length === 1) {
        const rewriteOp = rewriteOps[0];
        const beforeCount = workingPdf.getPageCount();
        const additionalSources = request.additionalSources ?? [];
        let label: string;
        let rewriteType: "insert-pages" | "merge-pdfs" | "extract-pages";
        if (rewriteOp.type === "insert-pages") {
          workingPdf = await applyInsertPages(workingPdf, rewriteOp);
          label = `插入 ${rewriteOp.insertAtIndex} 位置`;
          summary.insertedPageCount = workingPdf.getPageCount() - beforeCount;
          rewriteType = "insert-pages";
        } else if (rewriteOp.type === "merge-pdfs") {
          workingPdf = await applyMergePdfs(workingPdf, rewriteOp, additionalSources);
          label = `合并 ${additionalSources.length} 份附加 PDF`;
          summary.mergedAdditionalSourceCount = additionalSources.length;
          rewriteType = "merge-pdfs";
        } else {
          workingPdf = await applyExtractPages(workingPdf, rewriteOp);
          label = `提取 ${rewriteOp.pageRange}`;
          summary.extractedPageCount = workingPdf.getPageCount();
          rewriteType = "extract-pages";
        }
        // 不写入 outputToolEntries(其 type 是 6 个原 output tool operation), 改写入新加的 rewritePlan 段
        summary.rewritePlan = {
          operationId: rewriteOp.id,
          type: rewriteType,
          pageIndexes: Array.from({ length: workingPdf.getPageCount() }, (_, i) => i),
          status: "applied",
          label,
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
        bytes: await outputPdf.save({ useObjectStreams: true }),
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
  drawSummary?: {
    drawnCount: number;
    skippedCount: number;
    skipped: Array<{ annotationId: string; type: string; reason: string }>;
    pageDrawCounts: Record<number, number>;
    fingerprintChecked: boolean;
  },
): PdfAnnotationFlattenPlan {
  const sidecar = operation.sidecar;
  const strategy = operation.strategy ?? "plan-only";
  if (strategy !== "plan-only" && strategy !== "draw") {
    throw new Error(`批注扁平化不支持的策略：${strategy}`);
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

  const entries = sidecar.annotations.map((annotation) => {
    const entry: PdfAnnotationFlattenPlan["entries"][number] = {
      annotationId: annotation.id,
      type: annotation.type,
      pageIndex: annotation.pageIndex,
      rectCount: annotation.rects.length,
      status: "planned",
    };
    if (strategy === "draw" && drawSummary) {
      const skip = drawSummary.skipped.find((s) => s.annotationId === annotation.id);
      entry.status = skip ? "skipped" : "applied";
    }
    return entry;
  });

  const plan: PdfAnnotationFlattenPlan = {
    strategy,
    annotationCount: sidecar.annotations.length,
    entries,
  };

  if (strategy === "draw" && drawSummary) {
    plan.drawnCount = drawSummary.drawnCount;
    plan.skippedCount = drawSummary.skippedCount;
    plan.skipped = drawSummary.skipped.map((s) => ({ annotationId: s.annotationId, type: s.type as never, reason: s.reason }));
    plan.pageDrawCounts = { ...drawSummary.pageDrawCounts };
    plan.fingerprintChecked = drawSummary.fingerprintChecked;
  }

  return plan;
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
): Promise<{ entry: PdfOutputToolPlanEntry; replacementPdf?: PDFDocument; warnings: string[] }> {
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

  if ((operation.mode ?? "plan-only") === "apply") {
    const compressionResult = await applyCompression(pdf, operation, pageIndexes);
    return {
      entry: {
        operationId: operation.id,
        type: operation.type,
        pageIndexes,
        status: "applied",
        label: compressionResult.label,
      },
      replacementPdf: compressionResult.pdf,
      warnings: compressionResult.warnings,
    };
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

interface CompressionApplyResult {
  label: string;
  pdf: PDFDocument;
  warnings: string[];
}

async function applyCompression(
  pdf: PDFDocument,
  operation: PdfCompressionOperation,
  pageIndexes: number[],
): Promise<CompressionApplyResult> {
  // engine 已在 outputPdf.save({useObjectStreams:true}) 阶段对所有导出应用基础对象流压缩。
  // 此处调用 compressionService 是为了给用户主动请求的压缩提供：ratio + image inventory
  // 诊断信息（图像重采样本身仍 plan-only，真实像素重采样由 PyMuPDF bridge 提供）。
  const beforeBytes = await pdf.save({ useObjectStreams: true });
  const compressionResult = await compressPdf(beforeBytes, {
    useObjectStreams: true,
    preset: operation.preset,
  });
  const compressedPdf = await PDFDocument.load(compressionResult.bytes, {
    updateMetadata: false,
  });

  const ratio = compressionResult.ratio;
  const imageInfo = compressionResult.imageResampling;
  const imageLabel = imageInfo.requested
    ? `图像 ${imageInfo.imageCount} 张（重编码 ${imageInfo.resampledImages} / 保留 ${imageInfo.skippedImages}）`
    : "无图像处理";
  const label = `${operation.preset} (ratio ${ratio.toFixed(2)}×, ${compressionResult.inputBytes}→${compressionResult.outputBytes} bytes, ${imageLabel})`;

  return {
    label,
    pdf: compressedPdf,
    warnings: [
      ...compressionResult.warnings,
      ...(pageIndexes.length === 0 ? ["PDF 压缩作用于全部页面；当前未指定 pageIndexes 时默认覆盖整份文档。"] : []),
    ],
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

    const font = await resolveTextFont(pdf, text);
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
  const sampleLabel = formatPageNumberLabel(operation, startNumber, 0, inputPageCount);
  const font = await resolveTextFont(pdf, sampleLabel);
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

  const digits = normalizeBatesDigits(operation.digits);
  const sampleLabel = `${operation.prefix ?? ""}${String(operation.startNumber).padStart(digits, "0")}${operation.suffix ?? ""}`;
  const font = await resolveTextFont(pdf, sampleLabel);
  const fontSize = normalizePositiveNumber(operation.fontSize, 10);
  const color = parseHexColor(operation.color ?? "#202020");
  const labels: string[] = [];

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
    return 0;
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
    if (message.includes("cannot encode") || message.includes("WinAnsi")) {
      throw Object.assign(
        new Error(`PDF 交付工具无法编码字符：所选字体不支持「${text}」中的部分字符。请改用支持目标字符集的字体。`),
        { cause: error instanceof Error ? error : new Error(message) },
      );
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
    const plan = summary.annotationPlan;
    if (plan.strategy === "draw") {
      keywords.push(
        "faropdf:annotation-flattened",
        `faropdf:annotation-count:${plan.annotationCount}`,
        `faropdf:annotation-drawn:${plan.drawnCount ?? 0}`,
      );
      pdf.setSubject(`FaroPDF annotation flattened export with ${plan.drawnCount ?? 0}/${plan.annotationCount} drawn`);
    } else {
      keywords.push("faropdf:annotation-plan-only", `faropdf:annotation-count:${plan.annotationCount}`);
      pdf.setSubject(`FaroPDF annotation plan-only export with ${plan.annotationCount} sidecar entries`);
    }
  }

  if (summary.formFlattening?.flattened) {
    keywords.push("faropdf:form-flattened");
  }

  if (summary.pageOperationPlan) {
    keywords.push(
      summary.pageOperationPlan.mode === "execute"
        ? "faropdf:page-operations-applied"
        : "faropdf:page-operations-plan-only",
    );
  }

  if (summary.outputToolPlan) {
    keywords.push("faropdf:output-tools", `faropdf:output-tool-count:${summary.outputToolPlan.entries.length}`);
  }

  pdf.setKeywords(keywords);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

// === ISS-NEW-A: insert-pages / merge-pdfs / extract-pages ===

/**
 * 解析 1-based 页码范围字符串（如 "2-5" / "2, 4, 6" / "1-3, 5, 8-10"）。
 * - 输入字符串可含空白（trim 容忍）
 * - 返回 0-based 升序去重数组
 * - 任一解析失败或超出 [1, max] 范围抛错
 */
function parsePageRangeExpression(range: string, max: number): number[] {
  if (!range || !range.trim()) {
    throw new Error("页码范围不能为空。");
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`页码范围上限无效: max=${max}`);
  }
  const tokens = range.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const result = new Set<number>();
  for (const token of tokens) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!m) {
      throw new Error(`页码范围片段格式无效: '${token}'（期望 N 或 N-M）`);
    }
    const start = Number.parseInt(m[1], 10);
    const end = m[2] ? Number.parseInt(m[2], 10) : start;
    if (start < 1 || end < 1) {
      throw new Error(`页码必须 ≥ 1, 实际 start=${start} end=${end}`);
    }
    if (start > end) {
      throw new Error(`页码范围起始 > 结束: ${start} > ${end}`);
    }
    if (end > max) {
      throw new Error(`页码范围超出文档页数: ${end} > ${max}`);
    }
    for (let i = start; i <= end; i += 1) {
      result.add(i - 1);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

async function applyInsertPages(
  workingPdf: PDFDocument,
  operation: PdfInsertPagesOperation,
): Promise<PDFDocument> {
  if (operation.insertSource.bytes.length === 0) {
    throw new Error("insert-pages 缺少待插入的 PDF 字节流。");
  }
  const totalPages = workingPdf.getPageCount();
  if (operation.insertAtIndex < 0 || operation.insertAtIndex > totalPages) {
    throw new Error(
      `insert-pages 插入位置越界: insertAtIndex=${operation.insertAtIndex}, 总页数=${totalPages}`,
    );
  }
  const insertDoc = await PDFDocument.load(copyBytes(operation.insertSource.bytes), {
    updateMetadata: false,
  });
  const insertPageCount = insertDoc.getPageCount();
  const indexes0 = operation.pageRange
    ? parsePageRangeExpression(operation.pageRange, insertPageCount)
    : Array.from({ length: insertPageCount }, (_, i) => i);
  if (indexes0.length === 0) {
    throw new Error("insert-pages 解析后无可插入页。");
  }
  const copied = await workingPdf.copyPages(insertDoc, indexes0);
  // pdf-lib 的 `insertPage(index, page)` 是单页签名, 多页需用 spread 逐个 addPage 或循环
  // 用 `addPage(page)` 配合 splice 更稳: 在指定 index 处依次插入
  // 简化: 用 pdf-lib 0-based insertPage(index, page) 循环
  for (let i = 0; i < copied.length; i += 1) {
    workingPdf.insertPage(operation.insertAtIndex + i, copied[i]);
  }
  return workingPdf;
}

async function applyMergePdfs(
  workingPdf: PDFDocument,
  operation: PdfMergePdfsOperation,
  additionalSources: NonNullable<PdfExportRequest["additionalSources"]>,
): Promise<PDFDocument> {
  if (additionalSources.length === 0) {
    // 互斥允许 0 个 additionalSources（仅输出主源），但抛错更安全
    throw new Error("merge-pdfs 缺少 additionalSources（至少 1 份附加 PDF）。");
  }
  for (let i = 0; i < additionalSources.length; i += 1) {
    const src = additionalSources[i];
    if (src.bytes.length === 0) {
      throw new Error(`merge-pdfs additionalSources[${i}] 缺少 PDF 字节流。`);
    }
    const appendDoc = await PDFDocument.load(copyBytes(src.bytes), { updateMetadata: false });
    const appendPageCount = appendDoc.getPageCount();
    const indexes0 = operation.pageRange
      ? parsePageRangeExpression(operation.pageRange, appendPageCount)
      : Array.from({ length: appendPageCount }, (_, i) => i);
    if (indexes0.length === 0) {
      throw new Error(`merge-pdfs additionalSources[${i}] 解析后无可追加页。`);
    }
    const copied = await workingPdf.copyPages(appendDoc, indexes0);
    copied.forEach((page) => workingPdf.addPage(page));
  }
  return workingPdf;
}

async function applyExtractPages(
  workingPdf: PDFDocument,
  operation: PdfExtractPagesOperation,
): Promise<PDFDocument> {
  if (!operation.pageRange || !operation.pageRange.trim()) {
    throw new Error("extract-pages 缺少 pageRange。");
  }
  const totalPages = workingPdf.getPageCount();
  const indexes0 = parsePageRangeExpression(operation.pageRange, totalPages);
  if (indexes0.length === 0) {
    throw new Error("extract-pages 解析后无可提取页。");
  }
  // pdf-lib 0-based copyPages: src=workingPdf(foreign), dest=新 doc. 新 doc 直接 addPage copied.
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(workingPdf, indexes0);
  copied.forEach((page) => newDoc.addPage(page));
  return newDoc;
}
