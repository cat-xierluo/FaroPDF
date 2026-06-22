import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { textLayerStatusLabels } from "../../modules/reader/readerLabels";
import { getSearchHighlightsForPage, type TextSearchState } from "../../modules/search";
import type { ReaderState } from "../../modules/reader/readerState";
import { useReaderKeyboard } from "../../modules/reader/useReaderKeyboard";
import { resolveEffectiveZoom } from "../../modules/reader/viewMode";
import type { TextLayerStatus } from "../../shared/pdf/types";
import type { RecentPdfFile } from "../../shared/settings/types";
import { WelcomeScreen } from "./WelcomeScreen";

/** 将 PDF 页面渲染到 canvas 的函数签名 */
export type RenderPageToCanvasFn = (
  pageIndex: number,
  canvas: HTMLCanvasElement,
  zoom: number,
  options?: { signal?: AbortSignal },
) => Promise<void>;

interface ReaderCanvasProps {
  onOpenFile?: (file: File) => void | Promise<void>;
  readerState: ReaderState;
  searchState?: TextSearchState;
  /** 由 reader controller 提供的 canvas 渲染方法 */
  renderPageToCanvas?: RenderPageToCanvasFn;
  /** 滚动时检测当前可见页并同步到 reader state；可选，未提供时不启用滚动同步 */
  onPageVisible?: (pageNumber: number) => void;
  /** 键盘翻页回调；可选，未提供时不启用键盘监听 */
  onPageNavigate?: (nextPage: number) => void;
  /** OCR-needed 状态下点击"前往 OCR 模式"的回调；可选，未提供时按钮禁用 */
  onRequestOcr?: () => void;
  /**
   * ISS-NEW-G（Wave 3 W1）：最近文件列表，传给 WelcomeScreen 渲染缩略图网格。
   * 未传时退化为空数组（不渲染「最近」段）。
   */
  recentFiles?: RecentPdfFile[];
  /**
   * ISS-NEW-G（Wave 3 W1）：用户点击 Welcome 屏「清除最近」时回调。
   * 由 AppShell / App 注入，连接到 settings.onSettingsChange（清空 recentFiles 字段）。
   */
  onClearRecent?: () => void;
  /**
   * ISS-NEW-G（Wave 3 W1）：用户点击 Welcome 屏最近缩略图时回调。
   * 当前 stage 占位 — 真实路径打开（reader.openFile + 路径寻址）由后续 worker 接入。
   */
  onOpenRecent?: (entry: RecentPdfFile) => void;
  /**
   * ISS-NEW-G（2026-06-22 收口）：用户点击 Welcome 屏「图片转 PDF」转换卡时回调。
   * 当前 stage 占位 — 真实转换依赖 OCR pipeline / img2pdf engine，由后续 worker 接入。
   * 未传时按钮仍渲染但点击不触发任何动作（与 onClearRecent 同模式）。
   */
  onConvertFromImages?: () => void;
  /**
   * ISS-NEW-G（2026-06-22 收口）：用户点击 Welcome 屏「Word 转 PDF」转换卡时回调。
   * 当前 stage 占位 — 真实转换依赖 merge engine / Word → PDF 库接入。
   */
  onConvertFromWord?: () => void;
}

export function ReaderCanvas({
  onOpenFile,
  onPageNavigate,
  onPageVisible,
  onRequestOcr,
  readerState,
  searchState,
  renderPageToCanvas,
  recentFiles,
  onClearRecent,
  onOpenRecent,
  onConvertFromImages,
  onConvertFromWord,
}: ReaderCanvasProps) {
  const document = readerState.document;

  useReaderKeyboard({
    currentPage: document?.currentPage ?? 1,
    enabled: !!document && !!onPageNavigate,
    onPageChange: onPageNavigate ?? (() => undefined),
    pageCount: document?.pageCount ?? 0,
    viewMode: document?.viewMode ?? "continuous",
  });

  if (!document) {
    // ISS-NEW-G（Wave 3 W1）：空态用 WelcomeScreen 替换旧 open-dropzone。
    // 3 段：转换卡片 / drop zone + 选择文件 / 最近文件网格。
    return (
      <main className="reader" aria-label="PDF 阅读区">
        <WelcomeScreen
          onClearRecent={onClearRecent}
          onConvertFromImages={onConvertFromImages}
          onConvertFromWord={onConvertFromWord}
          onOpenFile={onOpenFile}
          onOpenRecent={onOpenRecent}
          recentFiles={recentFiles ?? []}
        />
      </main>
    );
  }

  return (
    <DocumentReader
      document={document}
      onOpenFile={onOpenFile}
      onPageNavigate={onPageNavigate}
      onPageVisible={onPageVisible}
      onRequestOcr={onRequestOcr}
      pageViewports={readerState.pageViewports}
      renderPageToCanvas={renderPageToCanvas}
      renderRange={readerState.renderRange}
      searchState={searchState}
    />
  );
}

interface DocumentReaderProps {
  document: NonNullable<ReaderState["document"]>;
  pageViewports: NonNullable<ReaderState["pageViewports"]>;
  renderRange: ReaderState["renderRange"];
  searchState?: TextSearchState;
  renderPageToCanvas?: RenderPageToCanvasFn;
  onOpenFile?: (file: File) => void | Promise<void>;
  onPageVisible?: (pageNumber: number) => void;
  onPageNavigate?: (nextPage: number) => void;
  onRequestOcr?: () => void;
}

function DocumentReader({ document, pageViewports, renderRange, searchState, renderPageToCanvas, onOpenFile, onPageVisible, onPageNavigate, onRequestOcr }: DocumentReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const activeHitPageNumber = searchState?.activeHit?.pageNumber;
  const lastScrolledHitIdRef = useRef<string | null>(null);

  // active 命中切换时，滚动到对应页（单页 / 双页 / 连续都生效；continuous 模式由浏览器自动决定滚动方向）
  useEffect(() => {
    if (!searchState?.activeHit || !containerRef.current) {
      return;
    }
    if (lastScrolledHitIdRef.current === searchState.activeHit.id) {
      return;
    }
    const target = containerRef.current.querySelector<HTMLElement>(
      `[data-page-number="${searchState.activeHit.pageNumber}"][data-active-hit="true"]`,
    );
    if (target) {
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      lastScrolledHitIdRef.current = searchState.activeHit.id;
    }
  }, [searchState?.activeHit]);

  // 监听容器尺寸变化：fit-width 模式需要实时计算缩放
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const baseViewport = pageViewports[0] ?? { width: 612, height: 792, rotation: 0 as const, scale: 1 };
  const basePageWidth = baseViewport.width;
  const basePageHeight = baseViewport.height;

  // 应用 rotation 后，实际渲染尺寸可能与 viewport 互换（90/270 时宽高对调）
  const isRotatedSideways = document.rotation === 90 || document.rotation === 270;
  const effectivePageWidth = isRotatedSideways ? basePageHeight : basePageWidth;
  const effectivePageHeight = isRotatedSideways ? basePageWidth : basePageHeight;

  const effectiveZoom = useMemo(
    () =>
      resolveEffectiveZoom({
        containerWidth,
        manualZoom: document.zoom,
        pageWidth: effectivePageWidth,
        viewMode: document.viewMode,
      }),
    [containerWidth, document.zoom, document.viewMode, effectivePageWidth],
  );

  const pageWidth = Math.round(effectivePageWidth * effectiveZoom);
  const pageHeight = Math.round(effectivePageHeight * effectiveZoom);

  const viewportStyle: CSSProperties = {
    alignItems: "center",
    flexDirection: document.viewMode === "double" ? "row" : "column",
    gap: 18,
  };

  const pageStyle: CSSProperties = {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: pageHeight,
    width: pageWidth,
  };

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find(
      (droppedFile) => droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith(".pdf"),
    );
    if (file) {
      void onOpenFile?.(file);
    }
  }

  return (
    <main
      aria-label="PDF 阅读区"
      className="reader"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {document.ocrStatus === "needed" ? (
        <div className="reader__status-banner reader__status-banner--ocr-needed" role="status" aria-live="polite">
          <div className="reader__status-banner-body">
            <strong>本文档需要 OCR 后才能搜索和复制文字。</strong>
            <span>请在工具栏切换到 OCR 模式以启动识别任务。</span>
          </div>
          <button
            className="tool-button tool-button--primary"
            disabled={!onRequestOcr}
            onClick={onRequestOcr}
            type="button"
          >
            前往 OCR 模式
          </button>
        </div>
      ) : null}
      <div
        className="reader__viewport"
        data-view-mode={document.viewMode}
        ref={containerRef}
        style={viewportStyle}
      >
        {renderRange.pageNumbers.map((pageNumber) => (
          <PdfPage
            activeHit={activeHitPageNumber === pageNumber}
            key={pageNumber}
            highlights={searchState ? getSearchHighlightsForPage(searchState, pageNumber - 1) : []}
            onPageNavigate={onPageNavigate}
            onVisible={onPageVisible}
            pageHeight={pageHeight}
            pageNumber={pageNumber}
            pageStyle={pageStyle}
            pageWidth={pageWidth}
            renderPageToCanvas={renderPageToCanvas}
            rotation={document.rotation}
            textLayerStatus={document.textLayerStatus}
            viewMode={document.viewMode}
            zoom={effectiveZoom}
          />
        ))}
        <section
          aria-label="阅读状态"
          className="pdf-page pdf-page--empty"
          data-testid="reader-status-footer"
          style={{ ...pageStyle, minHeight: 120 }}
        >
          <div className="empty-state">
            <p className="empty-state__title">{document.name}</p>
            <p className="empty-state__body">
              当前渲染 {renderRange.startPage}-{renderRange.endPage} / {document.pageCount}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** 单页渲染组件：管理 canvas 引用，渲染失败时回退到文本占位符 */
interface PdfPageProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  pageStyle: CSSProperties;
  zoom: number;
  rotation: 0 | 90 | 180 | 270;
  highlights: Array<{ id: string; active: boolean; matchText: string }>;
  textLayerStatus: TextLayerStatus;
  viewMode: ReaderState["document"] extends infer Doc
    ? Doc extends { viewMode: infer V }
      ? V
      : never
    : never;
  renderPageToCanvas?: RenderPageToCanvasFn;
  /** 页面进入视口时通知父组件，用于同步 currentPage */
  onVisible?: (pageNumber: number) => void;
  /** 单页/双页模式下点击页边时翻页 */
  onPageNavigate?: (nextPage: number) => void;
  /** 当前页是否为搜索的 active hit；用于外框高亮 + 自动滚动 */
  activeHit?: boolean;
}

function PdfPage({
  pageNumber,
  pageWidth,
  pageHeight,
  pageStyle,
  zoom,
  rotation,
  highlights,
  textLayerStatus,
  viewMode,
  renderPageToCanvas,
  onVisible,
  onPageNavigate,
  activeHit = false,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // 渲染失败标记，用于决定是否隐藏 fallback
  const [renderFailed, setRenderFailed] = useState(false);

  // 页码、缩放或旋转变化时重置失败状态，以便重新尝试渲染
  useEffect(() => {
    setRenderFailed(false);
  }, [pageNumber, zoom, rotation]);

  // 在 renderRange 页面变化或 zoom/rotation 变化时触发 canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderPageToCanvas) {
      return;
    }
    const pageIndex = pageNumber - 1; // PDF.js 页码为 1-based
    const abortController = new AbortController();
    renderPageToCanvas(pageIndex, canvas, zoom, { signal: abortController.signal })
      .then(() => {
        if (!abortController.signal.aborted) {
          setRenderFailed(false);
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }
        if (!abortController.signal.aborted) {
          console.error(`[FaroPDF] 渲染第 ${pageNumber} 页失败:`, error);
          setRenderFailed(true);
        }
      });
    return () => {
      abortController.abort();
    };
  }, [pageNumber, zoom, rotation, renderPageToCanvas]);

  // 滚动同步：页面进入视口 50% 以上时通知父组件，用于更新 currentPage
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined" || !onVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            onVisible(pageNumber);
            break;
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [pageNumber, onVisible]);

  const showCanvas = !!renderPageToCanvas && !renderFailed;
  // fallback 始终存在于 DOM 中（保持测试兼容），canvas 成功时通过 CSS 隐藏
  const fallbackHidden = showCanvas;

  // 单页/双页模式下，点击页边空白时翻到下一页（点击左半 → 上一页，右半 → 下一页）
  function handlePageClick(event: React.MouseEvent<HTMLElement>) {
    if (viewMode === "continuous") {
      return;
    }
    if (!onPageNavigate) {
      return;
    }
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const step = viewMode === "double" ? 2 : 1;
    if (x < rect.width / 2) {
      onPageNavigate(Math.max(1, pageNumber - step));
    } else {
      onPageNavigate(pageNumber + step);
    }
  }

  return (
    <section
      aria-label={`第 ${pageNumber} 页`}
      className="pdf-page"
      data-active-hit={activeHit ? "true" : undefined}
      data-page-number={pageNumber}
      data-rotation={rotation}
      onClick={handlePageClick}
      ref={sectionRef}
      style={{ ...pageStyle, transform: rotation ? `rotate(${rotation}deg)` : undefined, transformOrigin: "center center" }}
    >
      <div className="page-container" style={{ width: pageWidth, height: pageHeight, position: "relative" }}>
        {/* 真实 PDF canvas 渲染层 */}
        {showCanvas && (
          <canvas
            ref={canvasRef}
            height={pageHeight}
            style={{ display: "block" }}
            width={pageWidth}
          />
        )}
        {/* 搜索高亮叠加层，绝对定位在 canvas 之上 */}
        {highlights.length > 0 && (
          <div
            aria-label={`第 ${pageNumber} 页搜索高亮`}
            className="page-search-highlights"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", pointerEvents: "none" }}
          >
            {highlights.map((highlight) => (
              <span className={highlight.active ? "page-search-highlight is-active" : "page-search-highlight"} key={highlight.id}>
                {highlight.active ? "当前页高亮" : "搜索命中"}：{highlight.matchText}
              </span>
            ))}
          </div>
        )}
        {/* 文本占位符 fallback：始终保留在 DOM 中以保持测试兼容，canvas 渲染成功时视觉隐藏 */}
        <div
          className="empty-state"
          style={fallbackHidden ? { position: "absolute", opacity: 0, pointerEvents: "none" } : undefined}
        >
          <p className="empty-state__title">第 {pageNumber} 页</p>
          <p className="empty-state__body">
            {pageWidth} x {pageHeight} · 文字层{textLayerStatusLabels[textLayerStatus]}
          </p>
          <p
            aria-label={`第 ${pageNumber} 页文字层状态`}
            className={`pdf-page__text-layer-badge pdf-page__text-layer-badge--${textLayerStatus}`}
            data-testid={`text-layer-badge-${pageNumber}`}
          >
            {textLayerStatusLabels[textLayerStatus]}
          </p>
        </div>
      </div>
    </section>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
