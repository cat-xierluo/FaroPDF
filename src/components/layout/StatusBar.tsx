import { formatZoom, textLayerStatusLabels, viewModeLabels } from "../../modules/reader/readerLabels";
import type { ReaderState } from "../../modules/reader/readerState";

interface StatusBarProps {
  readerState: ReaderState;
}

export function StatusBar({ readerState }: StatusBarProps) {
  const document = readerState.document;
  const zoom = document?.zoom ?? readerState.defaults.zoom;
  const viewMode = document?.viewMode ?? readerState.defaults.viewMode;
  const textLayerStatus = document?.textLayerStatus ?? "unknown";

  return (
    <footer className="status-bar">
      <span>页码：{document ? `${document.currentPage} / ${document.pageCount}` : "-"}</span>
      <span>缩放：{formatZoom(zoom)}</span>
      <span>视图：{viewModeLabels[viewMode]}</span>
      <span>文字层：{textLayerStatusLabels[textLayerStatus]}</span>
      <span>保存：{document?.dirty ? "有未导出改动" : "原始 PDF 未修改"}</span>
    </footer>
  );
}
