import { PDFDocument } from "pdf-lib";
import type { ImagePackInputItem, ImagePackPlan } from "../../../shared";

export interface ImagePackFileReader {
  readFile: (path: string) => Promise<Uint8Array>;
}

export interface RenderImagePackPlanInput {
  plan: ImagePackPlan;
  reader: ImagePackFileReader;
}

export interface RenderImagePackPlanResult {
  bytes: Uint8Array;
  inputPageCount: number;
  outputPageCount: number;
}

export interface ImagePackRenderer {
  renderPlan: (input: RenderImagePackPlanInput) => Promise<RenderImagePackPlanResult>;
}

export function createImagePackRenderer(): ImagePackRenderer {
  return {
    async renderPlan({ plan, reader }) {
      if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
        throw new Error("证据图片渲染计划至少需要一个条目。");
      }
      if (!Array.isArray(plan.pages) || plan.pages.length === 0) {
        throw new Error("证据图片渲染计划必须包含至少一个 A4 页面。");
      }

      const itemsById = new Map<string, ImagePackInputItem>();
      for (const item of plan.items) {
        itemsById.set(item.id, item);
      }

      const output = await PDFDocument.create();
      const pdfPageCache = new Map<string, PDFDocument>();

      for (let pageIndex = 0; pageIndex < plan.pages.length; pageIndex += 1) {
        const planPage = plan.pages[pageIndex];
        const page = output.addPage([planPage.width, planPage.height]);

        for (const cell of planPage.cells) {
          const item = itemsById.get(cell.itemId);
          if (!item) {
            throw new Error(
              `证据图片渲染发现悬空条目：单元格 ${cell.itemId} 在第 ${pageIndex + 1} 页找不到对应 item。`,
            );
          }
          await drawCell(page, item, cell, reader, pdfPageCache);
        }
      }

      const bytes = await output.save();
      return {
        bytes,
        inputPageCount: plan.summary?.inputItemCount ?? plan.items.length,
        outputPageCount: plan.summary?.outputPageCount ?? plan.pages.length,
      };
    },
  };
}

async function drawCell(
  page: ReturnType<PDFDocument["addPage"]>,
  item: ImagePackInputItem,
  cell: { x: number; y: number; width: number; height: number },
  reader: ImagePackFileReader,
  pdfPageCache: Map<string, PDFDocument>,
): Promise<void> {
  if (item.source === "image") {
    if (!item.sourcePath) {
      throw new Error(`证据图片条目 ${item.id} 缺少 sourcePath，无法读取像素。`);
    }
    const bytes = await readBytesSafely(reader, item.sourcePath, item.id);
    const lower = item.sourcePath.toLowerCase();
    const isPng = lower.endsWith(".png");
    const isJpg = lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    if (!isPng && !isJpg) {
      throw new Error(
        `证据图片条目 ${item.id} 首版仅支持 PNG / JPEG，文件 ${item.sourcePath} 不是受支持格式。`,
      );
    }
    const image = isPng ? await page.doc.embedPng(bytes) : await page.doc.embedJpg(bytes);
    page.drawImage(image, {
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
    });
    return;
  }

  if (!item.sourcePath) {
    throw new Error(`PDF 页面条目 ${item.id} 缺少 sourcePath，无法读取 PDF 页面。`);
  }
  if (item.sourcePageIndex === undefined) {
    throw new Error(`PDF 页面条目 ${item.id} 缺少 sourcePageIndex。`);
  }
  let sourcePdf = pdfPageCache.get(item.sourcePath);
  if (!sourcePdf) {
    const bytes = await readBytesSafely(reader, item.sourcePath, item.id);
    sourcePdf = await loadPdfSafely(bytes, item.id, item.sourcePath);
    pdfPageCache.set(item.sourcePath, sourcePdf);
  }
  const pageCount = sourcePdf.getPageCount();
  if (item.sourcePageIndex < 0 || item.sourcePageIndex >= pageCount) {
    throw new Error(
      `PDF 页面条目 ${item.id} 的 sourcePageIndex ${item.sourcePageIndex} 超出源 PDF ${item.sourcePath} 页数 ${pageCount}。`,
    );
  }
  // `embedPdf` 返回 `PDFEmbeddedPage` 数组（drawPage 所需的类型）；
  // `copyPages` 返回的是 `PDFPage` 实例，不能直接传给 drawPage，否则会抛
  // "embeddedPage must be of type PDFEmbeddedPage, but was actually of type NaN"。
  const [embeddedPage] = await page.doc.embedPdf(sourcePdf, [item.sourcePageIndex]);
  page.drawPage(embeddedPage, {
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
  });
}

async function readBytesSafely(reader: ImagePackFileReader, path: string, itemId: string): Promise<Uint8Array> {
  try {
    return await reader.readFile(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`证据图片条目 ${itemId} 读取 ${path} 失败：${message}`);
  }
}

async function loadPdfSafely(bytes: Uint8Array, itemId: string, path: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`证据图片条目 ${itemId} 解析 PDF ${path} 失败：${message}`);
  }
}
