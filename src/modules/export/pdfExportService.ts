import type { PdfExportFileRequest, PdfExportResult } from "../../shared";
import { createPdfOperationEngine, type PdfOperationEngine } from "./pdfOperationEngine";

export interface PdfExportStorage {
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
}

export interface PdfExportService {
  exportToPath: (request: PdfExportFileRequest) => Promise<PdfExportResult>;
}

interface PdfExportServiceOptions {
  storage: PdfExportStorage;
  engine?: PdfOperationEngine;
}

export function createPdfExportService(options: PdfExportServiceOptions): PdfExportService {
  const engine = options.engine ?? createPdfOperationEngine();

  return {
    async exportToPath(request) {
      validateFileRequest(request);

      const inputBytes = await options.storage.readFile(request.inputPath);
      const result = await engine.exportPdf({
        id: request.id,
        source: {
          bytes: inputBytes,
          path: request.inputPath,
          fingerprint: request.fingerprint,
        },
        destination: {
          type: "file",
          outputPath: request.outputPath,
        },
        operations: request.operations,
        requestedAt: request.requestedAt,
      });

      await options.storage.writeFile(request.outputPath, result.bytes);

      return result;
    },
  };
}

export function createMemoryPdfExportStorage(initialFiles: Record<string, Uint8Array> = {}): PdfExportStorage {
  const files = new Map<string, Uint8Array>(
    Object.entries(initialFiles).map(([path, bytes]) => [normalizePath(path), copyBytes(bytes)]),
  );

  return {
    async readFile(path) {
      const bytes = files.get(normalizePath(path));

      if (!bytes) {
        throw new Error(`PDF 文件不存在：${path}`);
      }

      return copyBytes(bytes);
    },

    async writeFile(path, bytes) {
      files.set(normalizePath(path), copyBytes(bytes));
    },
  };
}

function validateFileRequest(request: PdfExportFileRequest): void {
  if (!request.inputPath.trim()) {
    throw new Error("PDF 导出请求缺少输入路径");
  }

  if (!request.outputPath.trim()) {
    throw new Error("PDF 导出请求缺少输出路径");
  }

  if (normalizePath(request.inputPath) === normalizePath(request.outputPath)) {
    throw new Error("导出输出路径不能与原始 PDF 相同");
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

