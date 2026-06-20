/**
 * ISS-059 Phase 1：顶部 Tab bar 组件
 *
 * 1:1 复刻 PDF Expert `01-full-pdf-open.png`：
 * - 文件 tab 行（X 关闭按钮 + 文件名 + 右侧 +号新建）
 * - 当前 tab 高亮 + 文档名
 * - 双击进入 inline rename（Enter 提交 / Esc 取消）
 * - tab 拖动排序（HTML5 drag-and-drop）
 * - 中键 / X 关闭 tab
 * - 关闭非当前 tab → 自动激活相邻 tab（左侧优先）
 */

import { useState, type ChangeEvent, type DragEvent, type ReactElement } from "react";
import { Plus, X } from "lucide-react";
import { useTabStore, type PdfTab } from "../../state/tabStore";
import "./TitlebarTabs.css";

export interface TitlebarTabsProps {
  /** 当用户点击 + 号或拖入文件时调用（外部负责实际打开文件并 dispatch openTab） */
  onRequestNewTab: () => void;
  /** 用户关闭最后一个 tab 时调用（外部通常清空 reader 状态进入空态） */
  onAllTabsClosed?: () => void;
}

export function TitlebarTabs(props: TitlebarTabsProps): ReactElement | null {
  const { onRequestNewTab, onAllTabsClosed } = props;
  const tabStore = useTabStore();
  const { tabs, activeTabId } = tabStore.state;
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  if (tabs.length === 0) {
    return null;
  }

  const handleTabClick = (tab: PdfTab): void => {
    if (renamingTabId === tab.id) {
      return;
    }
    tabStore.activateTab(tab.id);
  };

  const handleTabDoubleClick = (tab: PdfTab): void => {
    setRenamingTabId(tab.id);
    setRenameDraft(tab.customTitle ?? tab.title);
  };

  const handleClose = (event: React.MouseEvent, tabId: string): void => {
    event.stopPropagation();
    tabStore.closeTab(tabId);
    if (tabStore.state.tabs.length === 1 && tabId === tabStore.state.activeTabId) {
      // 关闭最后一个 tab
      onAllTabsClosed?.();
    }
  };

  const handleRenameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setRenameDraft(event.target.value);
  };

  const handleRenameSubmit = (tabId: string): void => {
    tabStore.renameTab(tabId, renameDraft);
    setRenamingTabId(null);
    setRenameDraft("");
  };

  const handleRenameCancel = (): void => {
    setRenamingTabId(null);
    setRenameDraft("");
  };

  const handleRenameKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    tabId: string,
  ): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameSubmit(tabId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleRenameCancel();
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number): void => {
    if (renamingTabId !== null) {
      event.preventDefault();
      return;
    }
    setDraggingIndex(index);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, index: number): void => {
    event.preventDefault();
    if (draggingIndex === null || draggingIndex === index) {
      return;
    }
    setDropTargetIndex(index);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, index: number): void => {
    event.preventDefault();
    if (draggingIndex !== null && draggingIndex !== index) {
      tabStore.reorderTabs(draggingIndex, index);
    }
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = (): void => {
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="titlebar-tabs" role="tablist" aria-label="打开的文件">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isRenaming = renamingTabId === tab.id;
        const displayTitle = tab.customTitle ?? tab.title;
        const showDirty = tab.isDirty;
        const isDropTarget = dropTargetIndex === index && draggingIndex !== null && draggingIndex !== index;
        return (
          <div
            key={tab.id}
            className={
              "titlebar-tab" +
              (isActive ? " titlebar-tab--active" : "") +
              (isDropTarget ? " titlebar-tab--drop-target" : "") +
              (draggingIndex === index ? " titlebar-tab--dragging" : "")
            }
            data-testid={`titlebar-tab-${tab.id}`}
            data-active={isActive ? "true" : "false"}
            draggable={!isRenaming}
            onDragStart={(event) => handleDragStart(event, index)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={handleDragEnd}
            onClick={() => handleTabClick(tab)}
            onDoubleClick={() => handleTabDoubleClick(tab)}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            title={tab.filePath || tab.title}
          >
            {isRenaming ? (
              <input
                autoFocus
                className="titlebar-tab__rename-input"
                data-testid={`titlebar-tab-rename-${tab.id}`}
                onBlur={() => handleRenameSubmit(tab.id)}
                onChange={handleRenameChange}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => handleRenameKeyDown(event, tab.id)}
                value={renameDraft}
              />
            ) : (
              <span className="titlebar-tab__title">
                {showDirty ? "• " : ""}
                {displayTitle}
              </span>
            )}
            <button
              aria-label={`关闭 ${displayTitle}`}
              className="titlebar-tab__close"
              data-testid={`titlebar-tab-close-${tab.id}`}
              onClick={(event) => handleClose(event, tab.id)}
              type="button"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        aria-label="新建 tab"
        className="titlebar-tabs__add"
        data-testid="titlebar-tabs-add"
        onClick={onRequestNewTab}
        type="button"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}