import {
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
import type { InspectorPanelId } from "./types";

interface ToolbarProps {
  activePanel: InspectorPanelId;
  onPanelChange: (panel: InspectorPanelId) => void;
}

const panelButtons: Array<{
  id: InspectorPanelId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "search", label: "搜索", icon: Search },
  { id: "annotation", label: "批注", icon: Highlighter },
  { id: "pages", label: "页面", icon: LayoutGrid },
  { id: "ocr", label: "OCR", icon: ScanText },
  { id: "forms", label: "表单", icon: FormInput },
  { id: "settings", label: "设置", icon: Settings },
];

export function Toolbar({ activePanel, onPanelChange }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="brand-mark" aria-hidden="true">
          F
        </span>
        <div>
          <h1>FaroPDF</h1>
          <p>等待文件</p>
        </div>
      </div>
      <div className="toolbar__group" aria-label="文件操作">
        <button className="tool-button tool-button--primary" type="button">
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
      <div className="toolbar__pager" aria-label="阅读控制">
        <button className="compact-button" type="button" aria-label="上一页">
          -
        </button>
        <span className="page-control">1 / 0</span>
        <button className="compact-button" type="button" aria-label="下一页">
          +
        </button>
        <span className="zoom-control">100%</span>
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
