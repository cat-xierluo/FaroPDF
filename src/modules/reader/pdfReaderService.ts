import { computeTextItemRects, type TextItemRect } from "../search/textSearchService";
import type { OutlineNode, ReaderByteLoadInput, ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PdfPageViewport, TextLayerStatus } from "../../shared/pdf/types";
import { configurePdfjsWorker } from "./pdfjsWorker";

type PdfJsDist = typeof import("pdfjs-dist");
type PdfDocumentInit = NonNullable<Parameters<PdfJsDist["getDocument"]>[0]>;

interface PdfJsViewportLike {
  width: number;
  height: number;
  rotation?: number;
  /** viewport 缩放（getViewport({ scale }) 的入参回显）；ISS-QA-18 文字层用 */
  scale?: number;
}

interface PdfJsTextContentLike {
  items?: unknown[];
}

interface PdfJsPageLike {
  rotate: number;
  getViewport(params: { scale: number }): PdfJsViewportLike;
  getTextContent?: () => Promise<PdfJsTextContentLike>;
}

interface PdfJsRenderTaskLike {
  promise: Promise<void>;
  cancel?: () => void;
}

interface PdfJsDocumentLike {
  numPages: number;
  fingerprints?: Array<string | null>;
  getPage(pageNumber: number): Promise<PdfJsPageLike>;
  // ISS-NEW-M M4：outline 读取 + destination → pageIndex 解析
  getOutline?(): Promise<unknown[] | null>;
  getDestination?(name: string): Promise<unknown[] | null>;
  getPageIndex?(ref: unknown): Promise<number>;
}

/** ISS-069 端到端发现：auto-toc 算法需要 PDF.js 原始 TextContent（带 items 位置/字号）。
 * LoadedPdfDocument.getPageText 返回扁平 string，丢失字号 / 位置，算法无法聚类。
 * 暴露 raw TextContent 给 OCR 路径专用。 */
export interface PdfRawTextContent {
  items: ReadonlyArray<{
    str?: string;
    width?: number;
    height?: number;
    transform?: ReadonlyArray<number>;
    fontName?: string;
    hasEOL?: boolean;
  }>;
}

export interface PdfJsLoadingTaskLike {
  promise: Promise<PdfJsDocumentLike>;
  destroy?: () => Promise<void>;
}

export interface PdfJsReaderAdapter {
  configureWorker: () => void | Promise<void>;
  getDocument: (params: PdfDocumentInit) => PdfJsLoadingTaskLike | Promise<PdfJsLoadingTaskLike>;
}

export interface LoadedPdfDocument {
  metadata: ReaderLoadedMetadata;
  getPageViewport: (pageIndex: number, scale?: number) => Promise<PdfPageViewport>;
  getPageText: (pageIndex: number) => Promise<PdfPageText>;
  /** 暴露 PDF.js 原始 TextContent（含 items / 字号 / transform）。auto-toc 等需要位置感知的算法使用。 */
  getRawTextContent: (pageIndex: number) => Promise<PdfRawTextContent | null>;
  /** 将指定页渲染到 canvas 上 */
  renderPageToCanvas: (
    pageIndex: number,
    canvas: HTMLCanvasElement,
    zoom: number,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
  /** 将指定页以缩略图尺寸渲染到 canvas；maxWidth 约束最长边。失败时抛出错误。 */
  renderThumbnail: (pageIndex: number, canvas: HTMLCanvasElement, maxWidth: number) => Promise<void>;
  /**
   * ISS-QA-18（2026-08-15）：把指定页的 pdfjs TextLayer（透明可选中文字 span）
   * 渲染进 container，与 canvas 的 CSS 尺寸同域对齐（--total-scale-factor =
   * viewport.scale，CSS px；canvas backing store 的 DPR 放大不影响本层）。
   * 页面无文字层（纯扫描）或 pdfjs 页对象不支持 streamTextContent 时抛错，
   * 由调用方 fail-closed 跳过（阅读区仍可看 canvas）。
   */
  renderTextLayer: (
    pageIndex: number,
    container: HTMLDivElement,
    zoom: number,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
  /**
   * 真实搜索高亮矩形（2026-08-15）：在指定页的原始 text items 里匹配 query，
   * 返回 pt 域命中包围盒（页面左上原点）。v1 为 item 级匹配；空 query /
   * 无文字层返回空数组。
   */
  findTextRects: (pageIndex: number, query: string) => Promise<TextItemRect[]>;
  /** ISS-NEW-M M4：读取 PDF outline（书签 destination）并归一化为树。无 outline 时返回空数组。 */
  getOutline: () => Promise<OutlineNode[]>;
  destroy: () => Promise<void>;
}

const defaultAdapter: PdfJsReaderAdapter = {
  configureWorker: configurePdfjsWorker,
  getDocument: async (params) => {
    // ISS-QA-02 第 4 版（2026-08-15）：与 pdfjsWorker.ts 同步切 legacy 构建——
    // 现代构建用 `Map.prototype.getOrInsertComputed`（Safari 26 才有），
    // macOS 15 WKWebView 下 render/getTextContent 直接 TypeError。worker 与
    // 主线程 API 必须同构建版本。
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // ISS-QA-02 真机修复（2026-08-05）：真机 Tauri WKWebView 下
    // `getTextContent()` 抛 "UnknownErrorException: Ensure that the
    // standardFontDataUrl API parameter is provided"——`textLayerStatus`
    // 因此被 `readTextLayerStatus` catch 吞错返回 `unknown`，状态栏「文字层未知」。
    // `/standard_fonts/` 由 vite.config.ts `provideStandardFonts` plugin 提供：
    // dev 用中间件映射 node_modules 真实文件，build 复制到 dist/standard_fonts/。
    //
    // ISS-QA-02 第 3 版补充（2026-08-14，真机复测「文字层未知」）：worker 改为
    // `?worker&inline`（blob: URL）后，pdfjs 在 worker 里 fetch 根相对路径
    // "/standard_fonts/…" 会以 **blob URL** 为 base 解析——`blob:tauri://…` 不是
    // 层级 URL，解析失败 → 字体拿不到 → getTextContent 抛错（http origin 的
    // chromium 下永远复现不了，dev/preview 都过）。必须在主线程（页面 origin）
    // 先解析成**绝对 URL** 再传给 pdfjs：tauri://localhost/standard_fonts/、
    // http://localhost:1420/standard_fonts/ 一致可达。
    const standardFontDataUrl = new URL("/standard_fonts/", document.baseURI).href;
    return getDocument({ ...params, standardFontDataUrl }) as unknown as PdfJsLoadingTaskLike;
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
  } catch (error) {
    // ISS-QA-02 诊断：textLayer 探测失败的真因（如有）打到 console，
    // 替代静默返回 unknown（导致 textLayerStatus 不可解释）。
    const msg = `[FaroPDF] textLayer 状态读取失败，标记 unknown：${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
    console.warn(msg, error);
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
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  throwIfAborted(options.signal);
  const page = await document.getPage(pageIndex + 1);
  throwIfAborted(options.signal);
  const viewport = page.getViewport({ scale: zoom });
  // Retina/HiDPI（ISS-QA-17，2026-08-15 真机反馈「渲染成模糊图片」）：
  // backing store 按 devicePixelRatio 放大 + pdfjs render transform 同步缩放，
  // CSS 尺寸钉在 viewport（CSS px）。否则 1x 位图被浏览器拉伸显示，Retina 真
  // 机上发糊——chromium 门禁默认 DPR=1 不可复现（verify:prod-render 已加 DPR=2 断言）。
  const dpr = typeof globalThis.devicePixelRatio === "number" && globalThis.devicePixelRatio > 0
    ? globalThis.devicePixelRatio
    : 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  // PDF.js 渲染接口：page.render 接受 canvasContext 和 viewport；
  // transform 把 PDF 坐标系映射到放大后的 backing store。
  const renderContext = {
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  };
  // page.render() 返回包含 promise 属性的对象
  const renderResult = (page as unknown as { render(ctx: typeof renderContext): PdfJsRenderTaskLike }).render(renderContext);
  await waitForRenderTask(renderResult, options.signal);
}

/** 将指定页以缩略图尺寸渲染到 canvas，maxWidth 约束最长边像素。
 *  scale = maxWidth / pageViewport.width；canvas 的 width/height 同步设置。
 *  ISS-QA-17 同源修复（2026-08-15）：backing store 按 devicePixelRatio 等比
 *  放大（宽高同乘，比例不变）。三个调用方（Sidebar 缩略图 / 页面管理页卡 /
 *  Welcome 最近文件）都用 CSS 约束显示尺寸（width:100% / 固定 174px +
 *  object-fit），属性等比放大只提升清晰度、不改布局；因此这里**不写
 *  canvas.style**——显示尺寸归调用方所有。 */
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
  const dpr = typeof globalThis.devicePixelRatio === "number" && globalThis.devicePixelRatio > 0
    ? globalThis.devicePixelRatio
    : 1;
  canvas.width = Math.round(viewport.width * dpr);
  canvas.height = Math.round(viewport.height * dpr);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const renderContext = {
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  };
  const renderResult = (page as unknown as { render(ctx: typeof renderContext): { promise: Promise<void> } }).render(renderContext);
  await renderResult.promise;
}

/**
 * ISS-QA-18（2026-08-15）：渲染 pdfjs TextLayer（透明可选中的文字 span 层）。
 *
 * - 几何域：span 定位 / 字号由 `--total-scale-factor`（= viewport.scale，CSS px）
 *   驱动，与 canvas 的 CSS 尺寸同域对齐；Retina backing store 的 DPR 放大不影响
 *   本层（文字是矢量 span，天然清晰）。
 * - textContentSource 用 `page.streamTextContent()`（流式），TextLayer 内部按
 *   viewport.rawDims 计算 transform；无文字页（纯扫描）产出零 span，不抛错。
 * - 页对象不支持 streamTextContent（单测 mock）时抛错，调用方 fail-closed 跳过。
 */
async function renderTextLayer(
  document: PdfJsDocumentLike,
  pageIndex: number,
  container: HTMLDivElement,
  zoom: number,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  throwIfAborted(options.signal);
  const page = await document.getPage(pageIndex + 1);
  throwIfAborted(options.signal);
  const streamTextContent = (page as unknown as {
    streamTextContent?: () => ReadableStream<unknown>;
  }).streamTextContent;
  if (typeof streamTextContent !== "function") {
    throw new Error("pdfjs 页对象不支持 streamTextContent，无法渲染文字层");
  }
  const viewport = page.getViewport({ scale: zoom });
  container.style.setProperty("--total-scale-factor", String(viewport.scale ?? zoom));
  const { TextLayer } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const textLayer = new TextLayer({
    textContentSource: streamTextContent.call(page),
    container,
    viewport: viewport as never,
  });
  await textLayer.render();
}

/** 读取原始 TextContent（auto-toc / 搜索高亮矩形共用）。 */
async function readRawTextContent(
  document: PdfJsDocumentLike,
  pageIndex: number,
): Promise<PdfRawTextContent | null> {
  const page = await document.getPage(pageIndex + 1);
  if (!page.getTextContent) {
    return null;
  }
  return (await page.getTextContent()) as PdfRawTextContent;
}

/**
 * ISS-NEW-M M4：把 PDF.js outline item（含 title / dest / items）递归归一化为 OutlineNode。
 * dest 可能是命名 string（需 getDestination）或 explicit array（[pageRef, ...]）；
 * 解析失败（无 dest / getPageIndex 不可用 / dest 损坏）时 pageNumber 为 undefined。
 */
interface PdfJsOutlineItemLike {
  title?: string;
  dest?: string | unknown[];
  items?: PdfJsOutlineItemLike[];
}

async function resolveDestination(
  document: PdfJsDocumentLike,
  item: PdfJsOutlineItemLike,
): Promise<number | undefined> {
  const dest = item.dest;
  if (dest == null || !document.getPageIndex) {
    return undefined;
  }
  let explicitDest: unknown[] | null = null;
  if (typeof dest === "string") {
    explicitDest = document.getDestination ? await document.getDestination(dest) : null;
  } else if (Array.isArray(dest)) {
    explicitDest = dest;
  }
  const pageRef = Array.isArray(explicitDest) ? explicitDest[0] : undefined;
  if (pageRef == null) {
    return undefined;
  }
  try {
    // getPageIndex 接受 page ref，返回 0-based；+1 转为展示用 1-based 页码。
    const index = await document.getPageIndex(pageRef);
    if (Number.isInteger(index) && index >= 0 && index < document.numPages) {
      return index + 1;
    }
  } catch {
    // 损坏的 destination ref：忽略，保持 undefined。
  }
  return undefined;
}

async function readOutlineTree(
  document: PdfJsDocumentLike,
): Promise<OutlineNode[]> {
  if (!document.getOutline) {
    return [];
  }
  const rawOutline = await document.getOutline();
  if (!Array.isArray(rawOutline) || rawOutline.length === 0) {
    return [];
  }

  async function buildNodes(
    items: PdfJsOutlineItemLike[],
    depth: number,
  ): Promise<OutlineNode[]> {
    const nodes: OutlineNode[] = [];
    for (const item of items) {
      const pageNumber = await resolveDestination(document, item);
      const children = Array.isArray(item.items) && item.items.length > 0
        ? await buildNodes(item.items, depth + 1)
        : [];
      nodes.push({
        title: (item.title ?? "").trim() || "未命名",
        pageNumber,
        depth,
        children,
      });
    }
    return nodes;
  }

  return buildNodes(rawOutline as PdfJsOutlineItemLike[], 0);
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

async function waitForRenderTask(renderTask: PdfJsRenderTaskLike, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await renderTask.promise;
    return;
  }

  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
    };
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => {
      renderTask.cancel?.();
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    renderTask.promise.then(
      () => settle(resolve),
      (error: unknown) => {
        if (signal.aborted) {
          settle(() => reject(createAbortError()));
          return;
        }
        settle(() => reject(error));
      },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError(): DOMException {
  if (typeof DOMException !== "undefined") {
    return new DOMException("PDF 页面渲染已取消。", "AbortError");
  }

  const error = new Error("PDF 页面渲染已取消。") as Error & { name: string };
  error.name = "AbortError";

  return error as unknown as DOMException;
}

export async function loadPdfFromBytes(
  input: ReaderByteLoadInput,
  adapter: PdfJsReaderAdapter = defaultAdapter,
  options?: { password?: string },
): Promise<LoadedPdfDocument> {
  await adapter.configureWorker();
  const loadingTask = await adapter.getDocument({
    data: input.data,
    ...(options?.password ? { password: options.password } : {}),
  });
  let document: PdfJsDocumentLike;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    // ISS-QA-02 诊断：pdfjs 加载失败（worker 死 / 损坏 / 加密）的真因打到 console。
    // 否则 UI 只归一化成「损坏 / 未知」，真机 devtools 看不到根因，陷入盲改循环。
    console.error("[FaroPDF] pdfjs 文档加载失败（loadingTask.promise reject）：", error);
    throw error;
  }
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
    getRawTextContent: (pageIndex) => readRawTextContent(document, pageIndex),
    renderPageToCanvas: (pageIndex, canvas, zoom, options) => renderPageToCanvas(document, pageIndex, canvas, zoom, options),
    renderThumbnail: (pageIndex, canvas, maxWidth) => renderThumbnail(document, pageIndex, canvas, maxWidth),
    renderTextLayer: (pageIndex, container, zoom, options) => renderTextLayer(document, pageIndex, container, zoom, options),
    findTextRects: async (pageIndex, query) => {
      if (!query.trim()) {
        return [];
      }
      const content = await readRawTextContent(document, pageIndex);
      if (!content) {
        return [];
      }
      const viewportPt = await readPageViewport(document, pageIndex, 1);
      return computeTextItemRects(content.items, query, viewportPt.height);
    },
    getOutline: () => readOutlineTree(document),
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
