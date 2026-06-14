import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  LayoutGrid,
  Minus,
  PanelLeft,
  PanelTop,
  Plus,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import { formatZoom, viewModeLabels } from "../../modules/reader/readerLabels";
import type { PdfViewMode } from "../../shared/pdf/types";
import { getToolLauncherSections, type AppCommandId } from "../../shared/app/commands";
import { getModeTools, type ToolbarState } from "./toolbarRegistry";
import type { AppModeId, UtilityPanelId } from "./types";

interface ToolbarProps {
  activeMode: AppModeId;
  onCommand: (commandId: AppCommandId) => void;
  onModeChange: (mode: AppModeId) => void;
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

export function Toolbar({ activeMode, onCommand, onModeChange, onUtilityPanelChange, reader, search, utilityPanel }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const document = reader.state.document;
  const currentPage = document?.currentPage ?? 1;
  const pageCount = document?.pageCount ?? 0;
  const zoom = document?.zoom ?? reader.state.defaults.zoom;
  const viewMode = document?.viewMode ?? reader.state.defaults.viewMode;
  const pageControlLabel = document ? `${currentPage} / ${pageCount}` : "- / -";

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

  function openUtilityPanel(panel: UtilityPanelId) {
    onModeChange("read");
    onUtilityPanelChange(utilityPanel === panel ? "none" : panel);
  }

  return (
    <header className="toolbar">
      <div className="toolbar__group toolbar__group--layout" aria-label="页面布局">
        <button
          aria-label="文档摘要"
          aria-pressed={utilityPanel === "summary" && activeMode !== "pages"}
          className="tool-button tool-button--icon tool-button--compact"
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
          onClick={() => openUtilityPanel("view")}
          title="视图设置"
          type="button"
        >
          <PanelTop size={16} />
        </button>
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
          <span>打开</span>
        </button>
      </div>
      <div className="toolbar__pager" aria-label="阅读控制">
        <button
          aria-label="上一页"
          className="compact-button"
          disabled={!document || currentPage <= 1}
          onClick={() => reader.setCurrentPage(currentPage - 1)}
          type="button"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="page-control">{pageControlLabel}</span>
        <button
          aria-label="下一页"
          className="compact-button"
          disabled={!document || currentPage >= pageCount}
          onClick={() => reader.setCurrentPage(currentPage + 1)}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
        <button
          aria-label="缩小"
          className="compact-button"
          disabled={!document}
          onClick={() => reader.setZoom(Math.max(0.25, zoom - 0.1))}
          type="button"
        >
          <Minus size={14} />
        </button>
        <span className="zoom-control">{formatZoom(zoom)}</span>
        <button
          aria-label="放大"
          className="compact-button"
          disabled={!document}
          onClick={() => reader.setZoom(Math.min(4, zoom + 0.1))}
          type="button"
        >
          <Plus size={14} />
        </button>
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
        <ModeActiveTools
          activeMode={activeMode}
          reader={reader}
          search={search}
        />
      </div>
      <div className="toolbar__group toolbar__group--right" aria-label="搜索和设置">
        <div className="toolbar-search-wrap">
          <label className="toolbar-search">
            <Search size={15} />
            <input
              aria-label="全文搜索"
              disabled={!document}
              onChange={(event) => search.setQuery(event.target.value)}
              placeholder={document ? "搜索" : "打开后搜索"}
              type="search"
              value={search.state.query}
            />
          </label>
          <SearchResultsPopover search={search} />
        </div>
        <div className="tool-launcher-wrap">
          <button
            aria-expanded={toolsMenuOpen}
            aria-haspopup="menu"
            className="tool-button tool-button--icon"
            onClick={() => setToolsMenuOpen((open) => !open)}
            title="工具"
            type="button"
          >
            <Wrench size={16} />
            <span>工具</span>
          </button>
          {toolsMenuOpen ? (
            <ToolLauncherMenu
              hasDocument={document !== null}
              onCommand={(commandId) => {
                onCommand(commandId);
                setToolsMenuOpen(false);
              }}
            />
          ) : null}
        </div>
        <button
          aria-pressed={utilityPanel === "settings"}
          className="tool-button tool-button--icon"
          onClick={() => openUtilityPanel("settings")}
          title="设置"
          type="button"
        >
          <Settings size={16} />
          <span>设置</span>
        </button>
      </div>
    </header>
  );
}

function ToolLauncherMenu({
  hasDocument,
  onCommand,
}: {
  hasDocument: boolean;
  onCommand: (commandId: AppCommandId) => void;
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
    </div>
  );
}

function ModeActiveTools({
  activeMode,
  reader,
  search,
}: {
  activeMode: AppModeId;
  reader: ReaderController;
  search: TextSearchController;
}) {
  const state: ToolbarState = { activeMode, reader, search };
  const hasDocument = reader.state.document !== null;
  const items = getModeTools(activeMode)
    .filter(() => activeMode !== "read" || hasDocument)
    .slice()
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {items.map((item) => (
        <button
          aria-pressed={item.isActive(state)}
          className="tool-button tool-button--icon tool-button--reader"
          disabled={item.isDisabled?.(state) ?? false}
          key={item.id}
          onClick={() => item.onClick(state)}
          title={item.label}
          type="button"
        >
          <item.icon size={16} />
          <span>{item.label}</span>
        </button>
      ))}
    </>
  );
}

function SearchResultsPopover({ search }: { search: TextSearchController }) {
  const state = search.state;
  const shouldShow = state.query.trim().length > 0;

  if (!shouldShow) {
    return null;
  }

  const activeIndex = state.activeHit
    ? state.hits.findIndex((hit) => hit.id === state.activeHit?.id)
    : -1;
  const indexedPages = state.indexedPageIndexes.length;
  const totalPages = indexedPages + state.pendingPageCount;
  const hitPages = Array.from(new Set(state.hits.map((hit) => hit.pageNumber))).sort((a, b) => a - b);

  return (
    <div className="search-popover" role="region" aria-label="搜索结果">
      <div className="search-popover__summary">
        <span>
          {state.hits.length > 0
            ? `命中 ${activeIndex + 1} / ${state.hits.length}（${state.hits.length} 处）`
            : `命中 ${state.hits.length} 处`}
        </span>
        {state.pendingPageCount > 0 ? (
          <small>
            索引 {indexedPages} / {totalPages} 页
          </small>
        ) : null}
      </div>
      <div className="search-popover__nav" role="toolbar" aria-label="搜索命中导航">
        <button className="compact-button" disabled={state.hits.length === 0} onClick={search.selectPreviousHit} type="button">
          <ChevronLeft size={15} />
          <span>上一个</span>
        </button>
        <button className="compact-button" disabled={state.hits.length === 0} onClick={search.selectNextHit} type="button">
          <ChevronRight size={15} />
          <span>下一个</span>
        </button>
        {state.pendingPageCount > 0 ? (
          <button className="context-tool" onClick={search.indexMore} type="button">
            继续索引
          </button>
        ) : null}
      </div>
      {hitPages.length > 0 ? (
        <div className="search-popover__pages" aria-label="命中页码">
          {hitPages.map((pageNumber) => (
            <button
              aria-pressed={state.activeHit?.pageNumber === pageNumber}
              className="search-popover__page-chip"
              data-page-number={pageNumber}
              key={pageNumber}
              onClick={() => {
                const hit = state.hits.find((entry) => entry.pageNumber === pageNumber);
                if (hit) {
                  search.selectHit(hit.id);
                }
              }}
              type="button"
            >
              p.{pageNumber}
            </button>
          ))}
        </div>
      ) : null}
      {state.ocrHint?.visible ? (
        <div className="search-ocr-hint">
          <p>{state.ocrHint.message}</p>
          <button className="context-tool context-tool--primary" onClick={search.requestOcr} type="button">
            {state.ocrHint.actionLabel}
          </button>
        </div>
      ) : null}
      {state.status === "indexing" ? <p className="search-popover__empty">正在建立搜索索引...</p> : null}
      {state.status === "empty" ? <p className="search-popover__empty">暂未命中。</p> : null}
      {state.status === "error" ? <p className="search-popover__empty">{state.errorMessage}</p> : null}
      {state.hits.length > 0 ? (
        <ol className="search-results-list">
          {state.hits.map((hit) => (
            <li key={hit.id}>
              <button
                aria-pressed={state.activeHitId === hit.id}
                onClick={() => search.selectHit(hit.id)}
                type="button"
              >
                <span>第 {hit.pageNumber} 页</span>
                <small>{hit.snippet}</small>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
