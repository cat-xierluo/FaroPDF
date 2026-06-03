import type { ImagePackPlan } from "../../../shared";
import type { ImagePackFileReader, ImagePackRenderer } from "./imagePackRenderer";
import { createImagePackRenderer } from "./imagePackRenderer";
import { isAbsolutePath, isPdfPath, pathsAreSame, sanitizePdfExportError } from "../../export/pathSafety";
import type { PdfExportStorage } from "../../export/pdfExportService";

export interface ImagePackExecutorOptions {
  reader: ImagePackFileReader;
  storage: PdfExportStorage;
  renderer?: ImagePackRenderer;
  now?: () => string;
}

export interface ImagePackExecutor {
  execute: (input: ImagePackExecutionInput) => Promise<ImagePackExecutionResult>;
}

export interface ImagePackExecutionInput {
  plan: ImagePackPlan;
  outputPath: string;
}

export interface ImagePackExecutionResult {
  bytes: Uint8Array;
  outputPath: string;
  inputItemCount: number;
  outputPageCount: number;
  completedAt: string;
}

export function createImagePackExecutor(options: ImagePackExecutorOptions): ImagePackExecutor {
  const renderer = options.renderer ?? createImagePackRenderer();
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async execute(input) {
      validatePlan(input.plan);
      const resolvedOutputPath = await validateAndResolveOutputPath(input.plan, input.outputPath, options.storage);

      const rendered = await renderWithSanitizedError(renderer, input.plan, options.reader);
      await writeOutputWithSanitizedError(options.storage, resolvedOutputPath, rendered.bytes);

      return {
        bytes: rendered.bytes,
        outputPath: resolvedOutputPath,
        inputItemCount: rendered.inputPageCount,
        outputPageCount: rendered.outputPageCount,
        completedAt: now(),
      };
    },
  };
}

function validatePlan(plan: ImagePackPlan): void {
  if (!plan || typeof plan !== "object") {
    throw new Error("证据图片执行器需要有效的渲染计划。");
  }
  if (!Array.isArray(plan.items) || plan.items.length === 0) {
    throw new Error("证据图片渲染计划至少需要一个条目。");
  }
  if (!Array.isArray(plan.pages) || plan.pages.length === 0) {
    throw new Error("证据图片渲染计划必须包含至少一个 A4 页面。");
  }
}

async function validateAndResolveOutputPath(
  plan: ImagePackPlan,
  outputPath: string,
  storage: PdfExportStorage,
): Promise<string> {
  const trimmed = outputPath.trim();
  if (!trimmed) {
    throw new Error("证据图片输出路径不能为空。");
  }
  if (!isPdfPath(trimmed)) {
    throw new Error("证据图片输出文件必须是 PDF。");
  }
  if (!isAbsolutePath(trimmed)) {
    throw new Error("证据图片输出路径必须是绝对路径。");
  }

  const resolvedPath = await resolveStoragePath(storage, trimmed);
  if (await outputPathExists(storage, trimmed)) {
    throw new Error("证据图片输出路径已存在，请选择新的 PDF 文件路径。");
  }

  for (const item of plan.items) {
    if (item.sourcePath && pathsAreSame(item.sourcePath, resolvedPath)) {
      throw new Error("证据图片输出 PDF 必须是不同于输入材料的新文件。");
    }
  }

  return trimmed;
}

async function renderWithSanitizedError(
  renderer: ImagePackRenderer,
  plan: ImagePackPlan,
  reader: ImagePackFileReader,
) {
  try {
    return await renderer.renderPlan({ plan, reader });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`证据图片渲染失败：${sanitizedMessage}`), {
      cause: error instanceof Error ? error : new Error(sanitizedMessage),
    });
  }
}

async function writeOutputWithSanitizedError(
  storage: PdfExportStorage,
  outputPath: string,
  bytes: Uint8Array,
): Promise<void> {
  try {
    await storage.writeNewFile(outputPath, bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`证据图片写入失败：${sanitizedMessage}`), {
      cause: error instanceof Error ? error : new Error(sanitizedMessage),
    });
  }
}

async function resolveStoragePath(storage: PdfExportStorage, path: string): Promise<string> {
  if (!storage.resolvePath) {
    return path;
  }
  try {
    return await storage.resolvePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`证据图片路径检查失败：${sanitizedMessage}`), {
      cause: error instanceof Error ? error : new Error(sanitizedMessage),
    });
  }
}

async function outputPathExists(storage: PdfExportStorage, outputPath: string): Promise<boolean> {
  try {
    return await storage.exists(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = sanitizePdfExportError(message);
    throw Object.assign(new Error(`证据图片路径检查失败：${sanitizedMessage}`), {
      cause: error instanceof Error ? error : new Error(sanitizedMessage),
    });
  }
}
