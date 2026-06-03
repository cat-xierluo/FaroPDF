import type { ReaderByteLoadInput, ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PdfPageViewport, TextLayerStatus } from "../../shared/pdf/types";
import { configurePdfjsWorker } from "./pdfjsWorker";

type PdfJsDist = typeof import("pdfjs-dist");
type PdfDocumentInit = NonNullable<Parameters<PdfJsDist["getDocument"]>[0]>;

interface PdfJsViewportLike {
  width: number;
  height: number;
  rotation?: number;
}

interface PdfJsTextContentLike {
  items?: unknown[];
}

interface PdfJsPageLike {
  rotate: number;
  getViewport(params: { scale: number }): PdfJsViewportLike;
  getTextContent?: () => Promise<PdfJsTextContentLike>;
}

interface PdfJsDocumentLike {
  numPages: number;
  fingerprints?: Array<string | null>;
  getPage(pageNumber: number): Promise<PdfJsPageLike>;
}

interface PdfJsLoadingTaskLike {
  promise: Promise<PdfJsDocumentLike>;
  destroy?: () => Promise<void>;
}

export interface PdfJsReaderAdapter {
  configureWorker: () => string | Promise<string>;
  getDocument: (params: PdfDocumentInit) => PdfJsLoadingTaskLike | Promise<PdfJsLoadingTaskLike>;
}

export interface LoadedPdfDocument {
  metadata: ReaderLoadedMetadata;
  getPageViewport: (pageIndex: number, scale?: number) => Promise<PdfPageViewport>;
  getPageText: (pageIndex: number) => Promise<PdfPageText>;
  /** 将指定页渲染到 canvas 上 */
  renderPageToCanvas: (pageIndex: number, canvas: HTMLCanvasElement, zoom: number) => Promise<void>;
  /** 将指定页以缩略图尺寸渲染到 canvas；maxWidth 约束最长边。失败时抛出错误。 */
  renderThumbnail: (pageIndex: number, canvas: HTMLCanvasElement, maxWidth: number) => Promise<void>;
  destroy: () => Promise<void>;
}

const defaultAdapter: PdfJsReaderAdapter = {
  configureWorker: configurePdfjsWorker,
  getDocument: async (params) => {
    const { getDocument } = await import("pdfjs-dist");
    return getDocument(params) as unknown as PdfJsLoadingTaskLike;
  },
};

function normalizeRotation(rotation: number): PdfPageViewport["rotation"] {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  return 0;
}

async function readTextLayerStatus(page: PdfJsPageLike): Promise<TextLayerStatus> {
  if (!page.getTextContent) {
    return "unknown";
  }

  try {
    const textContent = await page.getTextContent();
    return extractTextItems(textContent).length > 0 ? "available" : "missing";
  } catch {
    return "unknown";
  }
}

async function readPageViewport(document: PdfJsDocumentLike, pageIndex: number, scale = 1): Promise<PdfPageViewport> {
  const page = await document.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    rotation: normalizeRotation(viewport.rotation ?? page.rotate),
    scale,
  };
}

/** 将 PDF 页面渲染到 canvas 元素 */
async function renderPageToCanvas(
  document: PdfJsDocumentLike,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  zoom: number,
): Promise<void> {
  const page = await document.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: zoom });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  // PDF.js 渲染接口：page.render 接受 canvasContext 和 viewport
  const renderContext = { canvasContext: context, viewport };
  // page.render() 返回包含 promise 属性的对象
  const renderResult = (page as unknown as { render(ctx: typeof renderContext): { promise: Promise<void> } }).render(renderContext);
  await renderResult.promise;
}

/** 将指定页以缩略图尺寸渲染到 canvas，maxWidth 约束最长边像素。
 *  scale = maxWidth / pageViewport.width；canvas 的 width/height 同步设置。 */
async function renderThumbnail(
  document: PdfJsDocumentLike,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
): Promise<void> {
  const page = await document.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const safeMaxWidth = Math.max(1, maxWidth);
  const scale = safeMaxWidth / Math.max(1, baseViewport.width);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const renderContext = { canvasContext: context, viewport };
  const renderResult = (page as unknown as { render(ctx: typeof renderContext): { promise: Promise<void> } }).render(renderContext);
  await renderResult.promise;
}

async function readPageText(document: PdfJsDocumentLike, pageIndex: number): Promise<PdfPageText> {
  const page = await document.getPage(pageIndex + 1);

  if (!page.getTextContent) {
    return {
      pageIndex,
      text: "",
      status: "unknown",
      itemCount: 0,
      charCount: 0,
    };
  }

  try {
    const textItems = extractTextItems(await page.getTextContent());
    const text = joinTextItemsForSearch(textItems);

    return {
      pageIndex,
      text,
      status: textItems.length > 0 && text.length > 0 ? "available" : "missing",
      itemCount: textItems.length,
      charCount: text.length,
    };
  } catch {
    return {
      pageIndex,
      text: "",
      status: "unknown",
      itemCount: 0,
      charCount: 0,
    };
  }
}

function extractTextItems(textContent: PdfJsTextContentLike) {
  return (textContent.items ?? [])
    .map((item) => {
      if (typeof item === "object" && item !== null && "str" in item && typeof item.str === "string") {
        return item.str;
      }

      return "";
    })
    .filter((text) => text.length > 0);
}

function joinTextItemsForSearch(textItems: string[]) {
  return textItems.reduce((text, item) => {
    if (!text) {
      return item;
    }

    if (hasVisibleBoundaryWhitespace(text, item) || !shouldSeparateTextItems(text, item)) {
      return `${text}${item}`;
    }

    return `${text} ${item}`;
  }, "");
}

function hasVisibleBoundaryWhitespace(left: string, right: string) {
  return /\s$/.test(left) || /^\s/.test(right);
}

function shouldSeparateTextItems(left: string, right: string) {
  const leftChar = left.trimEnd().at(-1) ?? "";
  const rightChar = right.trimStart().at(0) ?? "";

  if (!leftChar || !rightChar) {
    return false;
  }

  if (!isAsciiWordChar(leftChar) || !isAsciiWordChar(rightChar)) {
    return false;
  }

  return (
    /\d/.test(leftChar) ||
    /\d/.test(rightChar) ||
    (/[a-z]/.test(leftChar) && /[A-Z]/.test(rightChar)) ||
    (/[A-Z]/.test(leftChar) && /[A-Z]/.test(rightChar))
  );
}

function isAsciiWordChar(character: string) {
  return /^[A-Za-z0-9]$/.test(character);
}

export async function loadPdfFromBytes(
  input: ReaderByteLoadInput,
  adapter: PdfJsReaderAdapter = defaultAdapter,
): Promise<LoadedPdfDocument> {
  await adapter.configureWorker();
  const loadingTask = await adapter.getDocument({ data: input.data });
  const document = await loadingTask.promise;
  const firstPage = await document.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const initialViewport: PdfPageViewport = {
    pageIndex: 0,
    width: firstViewport.width,
    height: firstViewport.height,
    rotation: normalizeRotation(firstViewport.rotation ?? firstPage.rotate),
    scale: 1,
  };
  const textLayerStatus = await readTextLayerStatus(firstPage);

  return {
    metadata: {
      fileName: input.fileName,
      filePath: input.filePath,
      fingerprint: document.fingerprints?.[0] ?? undefined,
      pageCount: document.numPages,
      initialViewport,
      textLayerStatus,
    },
    getPageViewport: (pageIndex, scale = 1) => readPageViewport(document, pageIndex, scale),
    getPageText: (pageIndex) => readPageText(document, pageIndex),
    renderPageToCanvas: (pageIndex, canvas, zoom) => renderPageToCanvas(document, pageIndex, canvas, zoom),
    renderThumbnail: (pageIndex, canvas, maxWidth) => renderThumbnail(document, pageIndex, canvas, maxWidth),
    destroy: () => loadingTask.destroy?.() ?? Promise.resolve(),
  };
}

export async function loadPdfFromFile(
  file: File,
  adapter: PdfJsReaderAdapter = defaultAdapter,
): Promise<LoadedPdfDocument> {
  const data = new Uint8Array(await file.arrayBuffer());

  return loadPdfFromBytes(
    {
      data,
      fileName: file.name,
    },
    adapter,
  );
}
