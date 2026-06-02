import { useRef, type ChangeEvent, type CSSProperties } from "react";
import { textLayerStatusLabels } from "../../modules/reader/readerLabels";
import type { ReaderState } from "../../modules/reader/readerState";

interface ReaderCanvasProps {
  onOpenFile?: (file: File) => void | Promise<void>;
  readerState: ReaderState;
}

const fileInputStyle: CSSProperties = {
  height: 1,
  opacity: 0,
  position: "absolute",
  width: 1,
};

const recentPlaceholders = ["卷宗材料.pdf", "合同附件.pdf", "扫描件.pdf"];

export function ReaderCanvas({ onOpenFile, readerState }: ReaderCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const document = readerState.document;

  if (!document) {
    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];

      if (file) {
        void onOpenFile?.(file);
        event.target.value = "";
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
          <section className="open-dropzone" aria-label="打开 PDF 文档">
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
