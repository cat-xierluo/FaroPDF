import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileOutput,
  FileUp,
  FormInput,
  Highlighter,
  LayoutGrid,
  ScanText,
  Search,
  Settings,
} from "lucide-react";
import { useRef, type ChangeEvent, type ComponentType, type CSSProperties } from "react";
import type { ReaderController } from "../../modules/reader";
import { formatZoom, viewModeLabels } from "../../modules/reader/readerLabels";
import type { PdfViewMode } from "../../shared/pdf/types";
import type { InspectorPanelId } from "./types";

interface ToolbarProps {
  activePanel: InspectorPanelId;
  onPanelChange: (panel: InspectorPanelId) => void;
  reader: ReaderController;
}

const panelButtons: Array<{
  id: InspectorPanelId;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "search", label: "搜索", icon: Search },
  { id: "annotation", label: "批注", icon: Highlighter },
  { id: "pages", label: "页面", icon: LayoutGrid },
  { id: "ocr", label: "OCR", icon: ScanText },
  { id: "forms", label: "表单", icon: FormInput },
  { id: "settings", label: "设置", icon: Settings },
];

const fileInputStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
};

export function Toolbar({ activePanel, onPanelChange, reader }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const document = reader.state.document;
  const currentPage = document?.currentPage ?? 1;
  const pageCount = document?.pageCount ?? 0;
  const zoom = document?.zoom ?? reader.state.defaults.zoom;
  const viewMode = document?.viewMode ?? reader.state.defaults.viewMode;
  const fileSubtitle =
    reader.state.status === "loading" ? "正在打开" : document?.name ?? reader.state.errorMessage ?? "等待文件";

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void reader.openFile(file);
      event.target.value = "";
    }
  }

  function handleViewModeChange(event: ChangeEvent<HTMLSelectElement>) {
    reader.setViewMode(event.target.value as PdfViewMode);
  }

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="brand-mark" aria-hidden="true">
          F
        </span>
        <div>
          <h1>FaroPDF</h1>
          <p title={fileSubtitle}>{fileSubtitle}</p>
        </div>
      </div>
      <div className="toolbar__group" aria-label="文件操作">
        <input
          accept="application/pdf,.pdf"
          aria-label="选择本地 PDF 文件"
          onChange={handleFileChange}
          ref={fileInputRef}
          style={fileInputStyle}
          type="file"
        />
        <button className="tool-button tool-button--primary" onClick={() => fileInputRef.current?.click()} type="button">
          <FileUp size={16} />
          <span>打开 PDF</span>
        </button>
        <button className="tool-button" type="button">
          <Download size={16} />
          <span>另存</span>
        </button>
        <button className="tool-button" type="button">
          <FileOutput size={16} />
          <span>导出</span>
        </button>
      </div>
      <div className="toolbar__pager" aria-label="阅读控制" style={{ minWidth: 228 }}>
        <button
          aria-label="上一页"
          className="compact-button"
          disabled={!document || currentPage <= 1}
          onClick={() => reader.setCurrentPage(currentPage - 1)}
          type="button"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="page-control">{currentPage} / {pageCount}</span>
        <button
          aria-label="下一页"
          className="compact-button"
          disabled={!document || currentPage >= pageCount}
          onClick={() => reader.setCurrentPage(currentPage + 1)}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
        <span className="zoom-control">{formatZoom(zoom)}</span>
        <select
          aria-label="视图模式"
          className="zoom-control"
          disabled={!document}
          onChange={handleViewModeChange}
          value={viewMode}
        >
          {Object.entries(viewModeLabels).map(([mode, label]) => (
            <option key={mode} value={mode}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="toolbar__group toolbar__group--right" aria-label="任务入口">
        {panelButtons.map(({ id, label, icon: Icon }) => (
          <button
            aria-pressed={activePanel === id}
            className="tool-button tool-button--icon"
            key={id}
            onClick={() => onPanelChange(id)}
            type="button"
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
