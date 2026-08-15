import { useEffect } from "react";

export interface UseGlobalHotkeysOptions {
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** ⌘F / Ctrl+F：聚焦全文搜索输入框。提供 ref 时调用 .focus()。 */
  onFocusSearch?: () => void;
  /** Esc：关闭搜索面板（仅在搜索面板打开时响应）。 */
  onCloseSearch?: () => void;
  /** 上一个搜索命中（默认 ⌘[ / Ctrl+[） */
  onPreviousHit?: () => void;
  /** 下一个搜索命中（默认 ⌘] / Ctrl+]） */
  onNextHit?: () => void;
}

/**
 * 全局快捷键（2026-08-15）：⌘/Ctrl+F 聚焦搜索、⌘/Ctrl+[ 上一命中、
 * ⌘/Ctrl+] 下一命中、Esc 关闭搜索。输入框 / contenteditable 内不拦截
 * （避免误触编辑路径）。Mac / Win / Linux 跨平台：⌘ = metaKey，
 * 其余平台 = ctrlKey。
 */
export function useGlobalHotkeys({
  enabled = true,
  onFocusSearch,
  onCloseSearch,
  onPreviousHit,
  onNextHit,
}: UseGlobalHotkeysOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
    function handleKeyDown(event: KeyboardEvent) {
      // Esc 在任何上下文都要响应（搜索面板/弹窗/选区都能关）；其它组合在
      // 可编辑元素里不拦截，避免编辑冲突。
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.key === "Escape" && onCloseSearch) {
        event.preventDefault();
        onCloseSearch();
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && key === "f" && onFocusSearch) {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      if (mod && !event.shiftKey && !event.altKey) {
        if (key === "[" && onPreviousHit) {
          event.preventDefault();
          onPreviousHit();
          return;
        }
        if (key === "]" && onNextHit) {
          event.preventDefault();
          onNextHit();
          return;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onFocusSearch, onCloseSearch, onPreviousHit, onNextHit]);
}