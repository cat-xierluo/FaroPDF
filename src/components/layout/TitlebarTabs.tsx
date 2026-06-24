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
import { invoke } from "@tauri-apps/api/core";
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

  const handleDragEnd = (event: DragEvent<HTMLDivElement>, index: number): void => {
    setDraggingIndex(null);
    setDropTargetIndex(null);
    // ISS-NEW-F 第 1 步（2026-06-22）：tab 拖离窗口外检测（HTML5 DnD 端）。
    // 当 dragend 时 mouse 位置在窗口边界外（clientX/Y < 0 或 > viewport 宽高），
    // 标记为 detach candidate。真实 detach 由 Tauri WebviewWindow IPC 接入（ISS-NEW-F 第 2 步），
    // 当前 v0.2 仅发占位 feedback。
    const rect = document.documentElement.getBoundingClientRect();
    const isOutsideViewport =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (isOutsideViewport) {
      // ISS-NEW-F 第 3 步（2026-06-24）：把 tab 状态（filePath / fileName / lastPage）写到
      // localStorage（key=`faropdf:pending-detach`），新窗口 frontend mount 时读该 key 恢复。
      // lastPage 由 ActiveTabPageSync 在 reader.currentPage 变化时同步到 tab（步 2 已 ship）。
      const tab = tabs[index];
      if (tab) {
        try {
          window.localStorage.setItem(
            "faropdf:pending-detach",
            JSON.stringify({
              filePath: tab.filePath,
              fileName: tab.title,
              lastPage: tab.lastPage,
            }),
          );
        } catch (error) {
          console.error("[ISS-NEW-F] localStorage write failed:", error);
        }
      }
      // 第 2 步：开空新 WebviewWindow（文档恢复由新窗口 mount 时 PendingDetachRestore 处理）。
      void invoke<string>("create_faropdf_window").catch((error: unknown) => {
        console.error("[ISS-NEW-F] create_faropdf_window invoke failed:", error);
      });
    }
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
            onDragEnd={(event) => handleDragEnd(event, index)}
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