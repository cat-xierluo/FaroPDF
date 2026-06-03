import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent } from "react";
import { textLayerStatusLabels } from "../../modules/reader/readerLabels";
import { getSearchHighlightsForPage, type TextSearchState } from "../../modules/search";
import type { ReaderState } from "../../modules/reader/readerState";
import { useReaderKeyboard } from "../../modules/reader/useReaderKeyboard";
import { resolveEffectiveZoom } from "../../modules/reader/viewMode";
import type { TextLayerStatus } from "../../shared/pdf/types";

/** 将 PDF 页面渲染到 canvas 的函数签名 */
export type RenderPageToCanvasFn = (
  pageIndex: number,
  canvas: HTMLCanvasElement,
  zoom: number,
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
}

const fileInputStyle: CSSProperties = {
  height: 1,
  opacity: 0,
  position: "absolute",
  width: 1,
};

const recentPlaceholders = ["卷宗材料.pdf", "合同附件.pdf", "扫描件.pdf"];

export function ReaderCanvas({ onOpenFile, onPageNavigate, onPageVisible, readerState, searchState, renderPageToCanvas }: ReaderCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const document = readerState.document;

  useReaderKeyboard({
    currentPage: document?.currentPage ?? 1,
    enabled: !!document && !!onPageNavigate,
    onPageChange: onPageNavigate ?? (() => undefined),
    pageCount: document?.pageCount ?? 0,
    viewMode: document?.viewMode ?? "continuous",
  });

  if (!document) {
    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];

      if (file) {
        void onOpenFile?.(file);
        event.target.value = "";
      }
    }

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
      <main className="reader" aria-label="PDF 阅读区">
        <div className="reader__start">
          <section className="start-conversions" aria-label="转换入口">
            <button className="conversion-button" type="button">
              <span className="conversion-button__icon" aria-hidden="true">IMG</span>
              图片转成 PDF
            </button>
            <button className="conversion-button" type="button">
              <span className="conversion-button__icon" aria-hidden="true">DOC</span>
              Word 转成 PDF
            </button>
          </section>
          <section
            className="open-dropzone"
            aria-label="打开 PDF 文档"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              accept="application/pdf,.pdf"
              aria-label="选择空态 PDF 文件"
              onChange={handleFileChange}
              ref={fileInputRef}
              style={fileInputStyle}
              type="file"
            />
            <div className="open-dropzone__sheet" aria-hidden="true" />
            <h2>{readerState.status === "loading" ? "正在打开 PDF" : "打开 PDF 文档"}</h2>
            <p>{readerState.status === "error" ? readerState.errorMessage : "或将文件拖至此处"}</p>
            <button className="tool-button tool-button--primary" onClick={() => fileInputRef.current?.click()} type="button">
              选择文件
            </button>
          </section>
          <section className="recent-start" aria-label="最近文件">
            <div className="section-heading">
              <h2>最近</h2>
              <button type="button">清除最近</button>
            </div>
            <ol>
              {recentPlaceholders.map((name) => (
                <li key={name}>
                  <div className="recent-card__thumb" aria-hidden="true" />
                  <span>{name}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    );
  }

  return (
    <DocumentReader
      document={document}
      onPageNavigate={onPageNavigate}
      onPageVisible={onPageVisible}
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
  onPageVisible?: (pageNumber: number) => void;
  onPageNavigate?: (nextPage: number) => void;
}

function DocumentReader({ document, pageViewports, renderRange, searchState, renderPageToCanvas, onPageVisible, onPageNavigate }: DocumentReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  return (
    <main className="reader" aria-label="PDF 阅读区">
      <div
        className="reader__viewport"
        data-view-mode={document.viewMode}
        ref={containerRef}
        style={viewportStyle}
      >
        {renderRange.pageNumbers.map((pageNumber) => (
          <PdfPage
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
    let cancelled = false;
    renderPageToCanvas(pageIndex, canvas, zoom)
      .then(() => {
        if (!cancelled) {
          setRenderFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRenderFailed(true);
        }
      });
    return () => {
      cancelled = true;
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
        </div>
      </div>
    </section>
  );
}
