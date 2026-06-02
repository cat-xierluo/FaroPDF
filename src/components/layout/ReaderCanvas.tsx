import type { CSSProperties } from "react";
import { textLayerStatusLabels } from "../../modules/reader/readerLabels";
import type { ReaderState } from "../../modules/reader/readerState";

interface ReaderCanvasProps {
  readerState: ReaderState;
}

export function ReaderCanvas({ readerState }: ReaderCanvasProps) {
  const document = readerState.document;

  if (!document) {
    const title = readerState.status === "loading" ? "正在打开 PDF" : readerState.status === "error" ? "无法打开 PDF" : "未打开 PDF";
    const body =
      readerState.status === "loading"
        ? "正在读取页数、页面尺寸和文字层状态"
        : readerState.errorMessage ?? "选择本地 PDF 开始阅读";

    return (
      <main className="reader" aria-label="PDF 阅读区">
        <div className="reader__viewport">
          <section className="pdf-page pdf-page--empty" aria-label="当前 PDF 页面">
            <div className="empty-state">
              <p className="empty-state__title">{title}</p>
              <p className="empty-state__body">{body}</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const baseViewport = readerState.pageViewports[0];
  const pageWidth = Math.round((baseViewport?.width ?? 612) * document.zoom);
  const pageHeight = Math.round((baseViewport?.height ?? 792) * document.zoom);
  const viewportStyle: CSSProperties = {
    alignItems: "center",
    flexDirection: "column",
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
      <div className="reader__viewport" style={viewportStyle}>
        {readerState.renderRange.pageNumbers.map((pageNumber) => (
          <section className="pdf-page" aria-label={`第 ${pageNumber} 页`} key={pageNumber} style={pageStyle}>
            <div className="empty-state">
              <p className="empty-state__title">第 {pageNumber} 页</p>
              <p className="empty-state__body">
                {pageWidth} x {pageHeight} · 文字层{textLayerStatusLabels[document.textLayerStatus]}
              </p>
            </div>
          </section>
        ))}
        <section className="pdf-page pdf-page--empty" aria-label="阅读状态" style={{ ...pageStyle, minHeight: 120 }}>
          <div className="empty-state">
            <p className="empty-state__title">{document.name}</p>
            <p className="empty-state__body">
              当前渲染 {readerState.renderRange.startPage}-{readerState.renderRange.endPage} / {document.pageCount}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
