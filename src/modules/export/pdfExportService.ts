import type { PdfExportFileRequest, PdfExportResult } from "../../shared";
import { isPdfPath, normalizePathForComparison, pathsAreSame, sanitizePdfExportError } from "./pathSafety";
import { createPdfOperationEngine, type PdfOperationEngine } from "./pdfOperationEngine";

export interface PdfExportStorage {
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
  exists?: (path: string) => Promise<boolean>;
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
      await validateFileRequest(request, options.storage);

      const inputBytes = await readSourceFile(options.storage, request.inputPath);
      const result = await exportWithSanitizedError(engine, request, inputBytes);

      await writeOutputFile(options.storage, request.outputPath, result.bytes);

      return result;
    },
  };
}

export function createMemoryPdfExportStorage(initialFiles: Record<string, Uint8Array> = {}): PdfExportStorage {
  const files = new Map<string, Uint8Array>(
    Object.entries(initialFiles).map(([path, bytes]) => [normalizePathForComparison(path), copyBytes(bytes)]),
  );

  return {
    async readFile(path) {
      const bytes = files.get(normalizePathForComparison(path));

      if (!bytes) {
        throw new Error(`PDF 文件不存在：${path}`);
      }

      return copyBytes(bytes);
    },

    async writeFile(path, bytes) {
      files.set(normalizePathForComparison(path), copyBytes(bytes));
    },

    async exists(path) {
      return files.has(normalizePathForComparison(path));
    },
  };
}

async function validateFileRequest(request: PdfExportFileRequest, storage: PdfExportStorage): Promise<void> {
  if (!request.inputPath.trim()) {
    throw new Error("PDF 导出请求缺少输入路径");
  }

  if (!request.outputPath.trim()) {
    throw new Error("PDF 导出请求缺少输出路径");
  }

  if (!isPdfPath(request.inputPath)) {
    throw new Error("PDF 导出输入路径必须是 PDF。");
  }

  if (!isPdfPath(request.outputPath)) {
    throw new Error("导出输出路径必须是 PDF。");
  }

  if (pathsAreSame(request.inputPath, request.outputPath)) {
    throw new Error("导出输出路径不能与原始 PDF 相同");
  }

  if ((await storage.exists?.(request.outputPath)) === true) {
    throw new Error("导出输出路径已存在，请选择新的 PDF 文件路径。");
  }
}

async function readSourceFile(storage: PdfExportStorage, inputPath: string): Promise<Uint8Array> {
  try {
    return await storage.readFile(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`PDF 导出读取失败：${sanitizedMessage}`), {
      cause: new Error(sanitizedMessage),
    });
  }
}

async function exportWithSanitizedError(
  engine: PdfOperationEngine,
  request: PdfExportFileRequest,
  inputBytes: Uint8Array,
): Promise<PdfExportResult> {
  try {
    return await engine.exportPdf({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`PDF 导出处理失败：${sanitizedMessage}`), {
      cause: new Error(sanitizedMessage),
    });
  }
}

async function writeOutputFile(storage: PdfExportStorage, outputPath: string, bytes: Uint8Array): Promise<void> {
  try {
    await storage.writeFile(outputPath, bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`PDF 导出写入失败：${sanitizedMessage}`), {
      cause: new Error(sanitizedMessage),
    });
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
