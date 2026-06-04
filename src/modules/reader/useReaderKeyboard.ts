import { useEffect } from "react";
import type { PdfViewMode } from "../../shared/pdf/types";

export interface UseReaderKeyboardOptions {
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  pageCount: number;
  /** 当前视图模式 */
  viewMode: PdfViewMode;
  /** 翻页回调 */
  onPageChange: (next: number) => void;
}

/**
 * 键盘翻页：
 * - PageDown / ArrowRight / ArrowDown / Space：下一页
 * - PageUp / ArrowLeft / ArrowUp：上一页
 * - Home：第一页
 * - End：最后一页
 * - 在输入框（input/textarea/contenteditable）里不拦截
 *
 * 双页模式下 ArrowRight 仍按 +1 推进；调用方按 viewMode 决定具体步进。
 */
export function useReaderKeyboard({
  enabled = true,
  currentPage,
  pageCount,
  viewMode,
  onPageChange,
}: UseReaderKeyboardOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (isEditableTarget(target)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const next = matchKeyToPage(event, currentPage, pageCount, viewMode);
      if (next === null) {
        return;
      }
      event.preventDefault();
      onPageChange(next);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, currentPage, pageCount, viewMode, onPageChange]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

function matchKeyToPage(
  event: KeyboardEvent,
  currentPage: number,
  pageCount: number,
  viewMode: PdfViewMode,
): number | null {
  if (pageCount <= 0) {
    return null;
  }
  const last = pageCount;
  const first = 1;
  const step = viewMode === "double" ? 2 : 1;

  switch (event.key) {
    case "PageDown":
    case " ":
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(currentPage + step, last);
    case "PageUp":
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(currentPage - step, first);
    case "Home":
      return first;
    case "End":
      return last;
    default:
      return null;
  }
}
