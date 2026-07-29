import {
  FileOutput,
  LayoutGrid,
  MessageSquare,
  Minus,
  PanelLeft,
  PanelTop,
  PencilLine,
  Plus,
  ScanLine,
  Search,
  Settings,
  Share2,
  StickyNote,
} from "lucide-react";
import "./Toolbar.css";
import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import { formatZoom } from "../../modules/reader/readerLabels";
import { getToolLauncherSections, type AppCommandId } from "../../shared/app/commands";
import type { AppModeId, RightPanelId, UtilityPanelId } from "./types";

interface ToolbarProps {
  activeMode: AppModeId;
  onCommand: (commandId: AppCommandId) => void;
  onModeChange: (mode: AppModeId) => void;
  onRightPanelChange?: (panel: RightPanelId) => void;
  onUtilityPanelChange: (panel: UtilityPanelId) => void;
  reader: ReaderController;
  search: TextSearchController;
  utilityPanel: UtilityPanelId;
}

const fileInputStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  opacity: 0,
};

export function Toolbar({ activeMode, onCommand, onModeChange, onRightPanelChange, onUtilityPanelChange, reader, search, utilityPanel }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const document = reader.state.document;
  const zoom = document?.zoom ?? reader.state.defaults.zoom;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void reader.openFile(file);
      event.target.value = "";
    }
  }

  function openUtilityPanel(panel: UtilityPanelId) {
    onModeChange("read");
    onUtilityPanelChange(utilityPanel === panel ? "none" : panel);
  }

  function enterMode(mode: AppModeId) {
    // 重复点击同一 mode 回到 read，避免按钮与中央工作台语义脱节。
    // `edit` 与 `pages` 是两个独立状态：T 编辑不再借用页面管理 mode。
    onModeChange(activeMode === mode ? "read" : mode);
  }

  return (
    <header className="toolbar" data-testid="app-toolbar">
      <div
        className="toolbar__section toolbar__section--navigation"
        data-section="navigation"
        role="group"
        aria-label="导航与视图"
      >
        <input
          accept="application/pdf,.pdf"
          aria-label="选择本地 PDF 文件"
          onChange={handleFileChange}
          ref={fileInputRef}
          style={fileInputStyle}
          type="file"
        />
        <button
          aria-label="文档摘要"
          aria-pressed={utilityPanel === "summary" && activeMode !== "pages"}
          className="tool-button tool-button--icon tool-button--compact"
          data-toolbar-section="navigation"
          onClick={() => openUtilityPanel("summary")}
          title="文档摘要"
          type="button"
        >
          <PanelLeft size={16} />
        </button>
        <button
          aria-label="页面管理"
          aria-pressed={activeMode === "pages"}
          className="tool-button tool-button--icon tool-button--compact"
          data-toolbar-section="navigation"
          onClick={() => onModeChange(activeMode === "pages" ? "read" : "pages")}
          title="页面管理"
          type="button"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          aria-label="视图设置"
          aria-pressed={utilityPanel === "view" && activeMode !== "pages"}
          className="tool-button tool-button--icon tool-button--compact"
          data-toolbar-section="navigation"
          onClick={() => openUtilityPanel("view")}
          title="视图设置"
          type="button"
        >
          <PanelTop size={16} />
        </button>
      </div>
      <div
        className="toolbar__section toolbar__section--zoom"
        data-section="zoom"
        role="group"
        aria-label="缩放"
      >
        <span className="zoom-control" data-toolbar-section="zoom">
          {formatZoom(zoom)}
        </span>
        <span className="toolbar-zoom-stepper">
        <button
          aria-label="缩小"
          className="compact-button"
          data-toolbar-section="zoom"
          disabled={!document}
          onClick={() => reader.setZoom(Math.max(0.25, zoom - 0.1))}
          type="button"
        >
          <Minus size={14} />
        </button>
        <button
          aria-label="放大"
          className="compact-button"
          data-toolbar-section="zoom"
          disabled={!document}
          onClick={() => reader.setZoom(Math.min(4, zoom + 0.1))}
          type="button"
        >
          <Plus size={14} />
        </button>
        </span>
      </div>
      <div
        className="toolbar__section toolbar__section--workflows"
        data-section="workflows"
        role="group"
        aria-label="核心工作流"
      >
        <button
          aria-label="A 批注"
          aria-pressed={activeMode === "annotate"}
          className="tool-button tool-button--icon"
          data-toolbar-section="workflows"
          data-mode-shortcut="A"
          disabled={!document}
          onClick={() => enterMode("annotate")}
          title="A 批注"
          type="button"
        >
          <StickyNote size={16} />
          <span>A 批注</span>
        </button>
        <button
          aria-label="T 编辑"
          aria-pressed={activeMode === "edit"}
          className="tool-button tool-button--icon"
          data-toolbar-section="workflows"
          data-mode-shortcut="T"
          disabled={!document}
          onClick={() => enterMode("edit")}
          title="T 编辑"
          type="button"
        >
          <PencilLine size={16} />
          <span>T 编辑</span>
        </button>
        <button aria-label="导出" aria-pressed={activeMode === "export"} className="tool-button tool-button--icon" data-toolbar-section="workflows" disabled={!document} onClick={() => enterMode("export")} type="button">
          <FileOutput size={16} /><span>导出</span>
        </button>
        <button aria-label="填写和签名" aria-pressed={activeMode === "forms"} className="tool-button tool-button--icon" data-toolbar-section="workflows" disabled={!document} onClick={() => enterMode("forms")} type="button">
          <PencilLine size={16} /><span>填写和签名</span>
        </button>
        <button aria-label="扫描和文本识别" aria-pressed={activeMode === "ocr"} className="tool-button tool-button--icon" data-toolbar-section="workflows" disabled={!document} onClick={() => enterMode("ocr")} type="button">
          <ScanLine size={16} /><span>扫描和文本识别</span>
        </button>
        <div className="tool-launcher-wrap" data-toolbar-section="workflows">
          <button aria-expanded={toolsMenuOpen} aria-haspopup="menu" aria-label="工具" className="tool-button tool-button--icon tool-button--more" data-toolbar-section="workflows" onClick={() => setToolsMenuOpen((open) => !open)} title="更多工具" type="button">
            <Plus size={17} />
          </button>
          {toolsMenuOpen ? (
            <ToolLauncherMenu
              hasDocument={document !== null}
              onCommand={(commandId) => { onCommand(commandId); setToolsMenuOpen(false); }}
              onOpenSettings={() => { openUtilityPanel("settings"); setToolsMenuOpen(false); }}
            />
          ) : null}
        </div>
      </div>
      <div
        className="toolbar__section toolbar__section--collaboration"
        data-section="collaboration"
        role="group"
        aria-label="协作与交付"
      >
        <button aria-label="文档助手" aria-pressed={utilityPanel === "summary"} className="tool-button tool-button--assistant" data-toolbar-section="collaboration" onClick={() => openUtilityPanel("summary")} type="button">
          <MessageSquare size={15} /><span>助手</span>
        </button>
        <button aria-label="共享" className="tool-button tool-button--icon tool-button--share" data-toolbar-section="collaboration" disabled={!document} onClick={() => enterMode("export")} type="button">
          <Share2 size={16} />
        </button>
      </div>
      <div className="toolbar__section toolbar__section--search" data-section="search" role="group" aria-label="全文搜索">
        <div className="toolbar-search-wrap" data-toolbar-section="search">
          <label className="toolbar-search">
            <Search size={15} />
            <input
              aria-label="全文搜索"
              disabled={!document}
              onChange={(event) => {
                search.setQuery(event.target.value);
                onRightPanelChange?.("search");
              }}
              onFocus={() => onRightPanelChange?.("search")}
              placeholder={document ? "搜索" : "打开后搜索"}
              type="search"
              value={search.state.query}
            />
          </label>
        </div>
      </div>
    </header>
  );
}

function ToolLauncherMenu({
  hasDocument,
  onCommand,
  onOpenSettings,
}: {
  hasDocument: boolean;
  onCommand: (commandId: AppCommandId) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="tool-launcher-menu" role="menu" aria-label="PDF 工具菜单">
      <div className="tool-launcher-menu__header">
        <strong>PDF 工具</strong>
      </div>
      <div className="tool-launcher-menu__grid">
        {getToolLauncherSections().map((section) => (
          <section className="tool-launcher-section" role="group" aria-label={section.label} key={section.id}>
            <header title={section.summary}>
              <strong>{section.label}</strong>
            </header>
            <div className="tool-launcher-section__commands">
              {section.commands.map((command) => {
                const disabled = command.requiresDocument && !hasDocument;
                return (
                  <button
                    className="tool-launcher-command"
                    disabled={disabled}
                    key={command.id}
                    onClick={() => onCommand(command.id)}
                    role="menuitem"
                    title={command.description}
                    type="button"
                  >
                    <span>{command.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <button className="tool-launcher-menu__settings" onClick={onOpenSettings} role="menuitem" type="button">
        <Settings size={15} />
        <span>设置</span>
      </button>
    </div>
  );
}
