import type { PdfExportFileRequest, PdfExportOperation } from "../../shared";
import { isAbsolutePath, isPdfPath, pathsAreSame } from "./pathSafety";

export interface CreatePdfOutputToolsExportRequestInput {
  id?: string;
  inputPath: string;
  outputPath?: string;
  fingerprint?: string;
  operations: PdfExportOperation[];
  requestedAt?: string;
}

export function createPdfOutputToolsExportRequest(
  input: CreatePdfOutputToolsExportRequestInput,
): PdfExportFileRequest {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const id = input.id ?? `pdf-output-tools-${requestedAt}`;
  const inputPath = input.inputPath.trim();
  const outputPath = (input.outputPath ?? suggestPdfOutputToolsPath(inputPath)).trim();

  validatePdfOutputToolsPaths(inputPath, outputPath);
  validatePdfOutputToolOperations(input.operations);

  return {
    id,
    inputPath,
    outputPath,
    fingerprint: input.fingerprint,
    operations: input.operations.map(cloneOutputToolOperation),
    requestedAt,
  };
}

export function suggestPdfOutputToolsPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const directory = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex + 1) : "";
  const fileName = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
  const stem = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  const safeStem = stem.length > 0 ? stem : "document";

  return `${directory}${safeStem}-delivery.pdf`;
}

function validatePdfOutputToolsPaths(inputPath: string, outputPath: string): void {
  if (!inputPath) {
    throw new Error("交付工具导出需要原始 PDF 路径。");
  }
  if (!isPdfPath(inputPath)) {
    throw new Error("交付工具输入文件必须是 PDF。");
  }
  if (!outputPath) {
    throw new Error("交付工具输出 PDF 路径不能为空。");
  }
  if (!isPdfPath(outputPath)) {
    throw new Error("交付工具输出文件必须是 PDF。");
  }
  if (!isAbsolutePath(outputPath)) {
    throw new Error("交付工具输出路径必须是绝对路径。");
  }
  if (pathsAreSame(inputPath, outputPath)) {
    throw new Error("交付工具输出 PDF 必须是不同于原始 PDF 的新文件。");
  }
}

function validatePdfOutputToolOperations(operations: PdfExportOperation[]): void {
  if (operations.length === 0) {
    throw new Error("至少需要选择一个 PDF 交付工具。");
  }

  const invalidOperation = operations.find((operation) => !isPdfOutputToolOperation(operation));
  if (invalidOperation) {
    throw new Error(`交付工具导出不支持 ${invalidOperation.type} 操作。`);
  }
}

function isPdfOutputToolOperation(operation: PdfExportOperation): boolean {
  return (
    operation.type === "watermark" ||
    operation.type === "page-number" ||
    operation.type === "bates-number" ||
    operation.type === "compress"
  );
}

function cloneOutputToolOperation(operation: PdfExportOperation): PdfExportOperation {
  if ("pageIndexes" in operation && operation.pageIndexes) {
    return {
      ...operation,
      pageIndexes: operation.pageIndexes.slice(),
    } as PdfExportOperation;
  }

  return { ...operation } as PdfExportOperation;
}
