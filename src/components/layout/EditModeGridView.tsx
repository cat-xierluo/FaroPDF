import { useCallback, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { useEffect } from "react";
import type { ReaderController } from "../../modules/reader";
import "./EditModeGridView.css";

/** ISS-NEW-I（W2 worker）：T 编辑模式页面网格视图（PDF Expert 5 列）。
 *
 * 设计参照：
 *  - research/pdf-expert/FEATURE_CATALOG.md §2.1 编辑模式 5 列网格
 *  - 截图 80/81/83（选中页蓝边框 + 尺寸 label + 拖动重排 drop indicator）
 *
 * 行为：
 *  - 复用 PageOrganizerWorkspace 的 grid 渲染思路，但用 5 列固定网格（PDF Expert 风格）。
 *  - 选中页 = 2px 蓝边框 + soft shadow（截图 81 选中态）。
 *  - 拖动重排：HTML5 DnD，给 page card 设 draggable，dragenter 时显示 drop indicator（before / after）。
 *  - 真实 IPC 留后续 worker；本任务只做 UI 结构 + placeholder 回调 `onReorder` / `onSelect`。
 *
 * 注意：本组件只读 `reader.state.document.pageCount` + `reader.renderThumbnail`（可选）。
 *       真实重排由调用方（AppShell）接 `reader.reorderPages` 之类；当前 stage 仅 placeholder。
 */

export interface EditModeGridViewProps {
  reader: ReaderController;
  /** 用户点击某页 → 进入阅读态定位到该页（placeholder） */
  onSelectPage?: (pageNumber: number) => void;
  /** 用户拖动重排完成 → 调用方拿 (from, to) 触发真实重排（placeholder） */
  onReorder?: (from: number, to: number) => void;
}

interface DropIndicator {
  pageNumber: number;
  position: "before" | "after";
}

export function EditModeGridView({ reader, onSelectPage, onReorder }: EditModeGridViewProps) {
  const document = reader.state.document;
  const pageCount = document?.pageCount ?? 0;
  const pageNumbers = useMemo(
    () => Array.from({ length: Math.min(pageCount, 60) }, (_, index) => index + 1),
    [pageCount],
  );

  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [draggingPage, setDraggingPage] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const dragSourceRef = useRef<number | null>(null);

  // 文档切换时清掉本地状态
  useEffect(() => {
    setSelectedPage(null);
    setDraggingPage(null);
    setDropIndicator(null);
    dragSourceRef.current = null;
  }, [reader.state.document?.documentId]);

  const handleCardClick = useCallback(
    (pageNumber: number) => {
      setSelectedPage(pageNumber);
      onSelectPage?.(pageNumber);
    },
    [onSelectPage],
  );

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>, pageNumber: number) => {
    dragSourceRef.current = pageNumber;
    setDraggingPage(pageNumber);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(pageNumber));
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, pageNumber: number) => {
      if (dragSourceRef.current === null || dragSourceRef.current === pageNumber) {
        setDropIndicator(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const position: "before" | "after" = event.clientX < midpoint ? "before" : "after";
      setDropIndicator({ pageNumber, position });
    },
    [],
  );

  const handleDragLeave = useCallback((pageNumber: number) => {
    setDropIndicator((current) => (current?.pageNumber === pageNumber ? null : current));
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetPage: number) => {
      event.preventDefault();
      const source = dragSourceRef.current ?? Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
      const indicator = dropIndicator;
      setDraggingPage(null);
      setDropIndicator(null);
      dragSourceRef.current = null;
      if (!Number.isFinite(source) || source === targetPage) {
        return;
      }
      const before = !indicator || indicator.position === "before";
      let to = before ? targetPage : targetPage + 1;
      // 拖到后面时要抵消 source < target 的索引位移
      if (source < to) {
        to -= 1;
      }
      if (to === source) {
        return;
      }
      onReorder?.(source, to);
    },
    [dropIndicator, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingPage(null);
    setDropIndicator(null);
    dragSourceRef.current = null;
  }, []);

  if (!document) {
    return (
      <main className="edit-mode-grid" aria-label="编辑模式网格">
        <div className="edit-mode-grid__empty" data-testid="edit-mode-grid-empty">
          <h2>打开 PDF 后进入 T 编辑</h2>
          <p>
            T 编辑模式提供 5 列页面网格视图，支持选中页蓝边框、拖动重排、批量操作。
            请打开任意 PDF 进入此模式。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="edit-mode-grid" aria-label="编辑模式网格" data-testid="edit-mode-grid">
      <div className="edit-mode-grid__toolbar" role="toolbar" aria-label="编辑模式工具条">
        <span className="edit-mode-grid__toolbar-title">编辑模式 · 页面网格</span>
        <span className="edit-mode-grid__hint" data-testid="edit-mode-grid-count">
          共 {pageCount} 页 · 显示前 {pageNumbers.length} 页
        </span>
        <span className="edit-mode-grid__toolbar-spacer" />
        {selectedPage !== null ? (
          <span className="edit-mode-grid__hint" data-testid="edit-mode-grid-selected">
            已选第 {selectedPage} 页
          </span>
        ) : null}
      </div>
      <ol className="edit-mode-grid__list">
        {pageNumbers.map((pageNumber) => {
          const isSelected = selectedPage === pageNumber;
          const isDragging = draggingPage === pageNumber;
          const dropBefore = dropIndicator?.pageNumber === pageNumber && dropIndicator.position === "before";
          const dropAfter = dropIndicator?.pageNumber === pageNumber && dropIndicator.position === "after";
          return (
            <li
              key={pageNumber}
              className={
                "edit-mode-grid__item" +
                (dropBefore ? " edit-mode-grid__item--drop-before" : "") +
                (dropAfter ? " edit-mode-grid__item--drop-after" : "")
              }
            >
              <div
                aria-pressed={isSelected}
                className={
                  "edit-mode-grid__card" +
                  (isSelected ? " edit-mode-grid__card--selected" : "") +
                  (isDragging ? " edit-mode-grid__card--dragging" : "")
                }
                data-page-number={pageNumber}
                data-testid="edit-mode-grid-card"
                draggable
                onClick={(event: MouseEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  handleCardClick(pageNumber);
                }}
                onDragEnd={handleDragEnd}
                onDragLeave={() => handleDragLeave(pageNumber)}
                onDragOver={(event) => handleDragOver(event, pageNumber)}
                onDragStart={(event) => handleDragStart(event, pageNumber)}
                onDrop={(event) => handleDrop(event, pageNumber)}
                role="button"
                tabIndex={0}
              >
                <div className="edit-mode-grid__thumbnail" aria-hidden="true">
                  {/* 占位缩略图：真实渲染由后续 worker 接入 reader.renderThumbnail */}
                </div>
                <span className="edit-mode-grid__label">第 {pageNumber} 页</span>
                <span className="edit-mode-grid__size">A4 (210 x 297 毫米)</span>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}