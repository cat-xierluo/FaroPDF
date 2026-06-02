import { PDFDocument } from "pdf-lib";
import type {
  PdfAnnotationFlattenPlan,
  PdfExportRequest,
  PdfExportResult,
  PdfExportSummary,
  PdfFormFlatteningSummary,
  PdfPageOperationPlan,
} from "../../shared";
import { isPdfPath, pathsAreSame } from "./pathSafety";

const PAGE_OPERATIONS_PLAN_ONLY_WARNING = "页面操作当前仅生成导出计划，尚未改写页面几何或顺序。";

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

      for (const operation of request.operations) {
        if (operation.type === "flatten-annotations") {
          summary.annotationPlan = buildAnnotationFlattenPlan(operation, request.source.fingerprint, inputPageCount);
          continue;
        }

        if (operation.type === "flatten-form") {
          summary.formFlattening = flattenFormFields(workingPdf);
          continue;
        }

        summary.pageOperationPlan = buildPageOperationPlan(operation, inputPageCount);
        warnings.push(PAGE_OPERATIONS_PLAN_ONLY_WARNING);
      }

      if (warnings.length > 0) {
        summary.warnings = Array.from(new Set(warnings));
      }

      const outputPdf = await copyPdfDocument(workingPdf);
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

  pdf.setKeywords(keywords);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
