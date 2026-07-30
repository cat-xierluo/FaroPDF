import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PDF Expert 风格浮动文本工具条（ISS-061 起点）。
 *
 * 监控 document 的 selectionchange：选区位于 `rootRef` 容器内且非空时，浮出工具条；
 * 选区消失 / 离开阅读区 / 跨页时，工具条自动隐藏。
 *
 * 5 个可执行动作（高亮 / 下划线 / 删除线 / 便签 / 复制）
 * 2 个 v0.1 占位（翻译 / 朗读，disabled）。
 *
 * 对 Hl/Ul/St/Note：当前实现是「armed tool」模式 — 工具被激活后，
 * 用户在画布上拖拽或点击（既有 AnnotationOverlay 流程）即可完成标注。
 * 这是 v0.1 行为边界；v0.2 会推进为「选区直接转化为标注」。
 */

export interface TextSelectionToolbarProps {
  /** 选区几何中心 + 上下锚点；null 表示当前无选区 */
  bounds: { top: number; left: number; right: number; bottom: number } | null;
  /** 触发某个工具（Hl/Ul/St/Note/Copy） */
  onAction: (action: AnnotationAction | CopyAction) => void;
  /** 工具条主动关闭回调（用户按 Esc 或点击外部） */
  onClose: () => void;
  /** ISS-061 阶段 2：当前批注颜色（hex），dispatch 进 floating-annotation-tool 供 AppShell 落 draft */
  color?: string;
  /** ISS-061 阶段 2：便签预填内容，dispatch 进 content 字段 */
  noteContent?: string;
  /** ISS-061 阶段 2：翻译 / 朗读完成后的 toast 反馈 */
  onToast?: (message: string) => void;
}

export type AnnotationAction =
  | "annotate-highlight"
  | "annotate-underline"
  | "annotate-strikeout"
  | "annotate-note";

export type CopyAction = "copy";

interface ActionDescriptor {
  id: AnnotationAction | CopyAction | string;
  label: string;
  glyph: string;
  enabled: boolean;
  hint: string;
}

const ACTIONS: ActionDescriptor[] = [
  { id: "annotate-highlight", label: "高亮", glyph: "▮", enabled: true, hint: "对选中文本应用高亮批注" },
  { id: "annotate-underline", label: "下划线", glyph: "＿", enabled: true, hint: "对选中文本应用下划线批注" },
  { id: "annotate-strikeout", label: "删除线", glyph: "̶", enabled: true, hint: "对选中文本应用删除线批注" },
  { id: "annotate-note", label: "便签", glyph: "💬", enabled: true, hint: "在选中文本旁添加便签" },
  { id: "copy", label: "复制", glyph: "⧉", enabled: true, hint: "复制选中文本到剪贴板" },
  { id: "annotate-translate", label: "翻译", glyph: "A", enabled: false, hint: "翻译服务尚未接入" },
  { id: "annotate-read-aloud", label: "朗读", glyph: "♪", enabled: true, hint: "朗读选中文本" },
];

export function TextSelectionToolbar({ bounds, onAction, onClose, color, noteContent, onToast }: TextSelectionToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ top: number; left: number; placement: "top" | "bottom" }>(
    () => ({ top: 0, left: 0, placement: "top" }),
  );

  // 选区变化 / 窗口滚动时重算位置
  useEffect(() => {
    if (!bounds || !containerRef.current) {
      return;
    }
    const toolbarWidth = containerRef.current.offsetWidth;
    const toolbarHeight = containerRef.current.offsetHeight;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = (bounds.left + bounds.right) / 2 - toolbarWidth / 2;
    let placement: "top" | "bottom" = "top";
    let top = bounds.top - toolbarHeight - margin;

    if (top < 0) {
      top = bounds.bottom + margin;
      placement = "bottom";
    }
    if (left < margin) {
      left = margin;
    } else if (left + toolbarWidth > vw) {
      left = vw - toolbarWidth - margin;
    }
    if (placement === "bottom" && top + toolbarHeight > vh) {
      top = Math.max(margin, bounds.top - toolbarHeight - margin);
    }
    setAdjusted({ top, left, placement });
  }, [bounds]);

  // Esc 关掉
  useEffect(() => {
    if (!bounds) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bounds, onClose]);

  const handleClick = useCallback(
    (action: ActionDescriptor) => (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!action.enabled) {
        return;
      }
      const sel = window.getSelection?.();
      const text = sel?.toString() ?? "";

      // 批注类（高亮 / 下划线 / 删除线 / 便签）：dispatch floating-annotation-tool
      // 携带 toolType + text + color（+ content for note），AppShell 监听后落 draft
      if (
        action.id === "annotate-highlight" ||
        action.id === "annotate-underline" ||
        action.id === "annotate-strikeout" ||
        action.id === "annotate-note"
      ) {
        window.dispatchEvent(
          new CustomEvent("floating-annotation-tool", {
            detail: {
              toolType: action.id as string,
              text,
              ...(color ? { color } : {}),
              ...(action.id === "annotate-note" && noteContent ? { content: noteContent } : {}),
            },
          }),
        );
      }

      // 朗读（Web Speech API speechSynthesis）
      if (action.id === "annotate-read-aloud") {
        const synth = (window as unknown as { speechSynthesis?: { speak: (u: SpeechSynthesisUtterance) => void } }).speechSynthesis;
        const UtteranceCtor = (window as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
        if (synth?.speak && UtteranceCtor) {
          const utterance = new UtteranceCtor(text);
          synth.speak(utterance);
        }
        onToast?.("朗读：已开始播放选中文本");
        onAction(action.id as AnnotationAction | CopyAction);
        return;
      }

      onAction(action.id as AnnotationAction | CopyAction);
    },
    [onAction, color, noteContent, onToast],
  );

  if (!bounds) {
    return null;
  }

  return (
    <div
      aria-label="选区浮动工具条"
      className={`text-selection-toolbar text-selection-toolbar--${adjusted.placement}`}
      data-testid="text-selection-toolbar"
      role="toolbar"
      style={{ left: adjusted.left, position: "fixed", top: adjusted.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        aria-hidden="true"
        className="text-selection-toolbar__spacer"
        data-testid="text-selection-toolbar-spacer"
      />
      <div aria-label="选区操作" className="text-selection-toolbar__actions" role="group">
        {ACTIONS.map((action) => (
          <button
            aria-label={action.hint}
            className={
              "text-selection-toolbar__action" + (action.enabled ? "" : " text-selection-toolbar__action--disabled")
            }
            data-testid={`text-selection-toolbar-action-${action.id}`}
            disabled={!action.enabled}
            key={action.id}
            onClick={handleClick(action)}
            title={action.hint}
            type="button"
          >
            <span aria-hidden="true" className="text-selection-toolbar__icon">
              {action.glyph}
            </span>
            <span className="text-selection-toolbar__label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 观察 `rootRef` 容器内的文本选区。
 *
 * - selectionchange 事件触发即取一次 bounding rect
 * - 选区起点不在 rootRef 内、跨多页、rect 为 0 → 隐藏
 * - 选区落在 rootRef 容器 → 返回 rect（屏幕坐标，给 fixed 定位用）
 */
export function usePdfTextSelection(rootRef: React.RefObject<HTMLElement | null>) {
  const [bounds, setBounds] = useState<{ top: number; left: number; right: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }
    const root = rootRef.current;
    const insideReader = { value: false };

    function update() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        if (insideReader.value) {
          insideReader.value = false;
          setBounds(null);
        }
        return;
      }
      const range = sel.getRangeAt(0);
      // jsdom 环境 Range 没实现 getBoundingClientRect；浏览器 / Tauri webview 内则有。
      if (typeof range.getBoundingClientRect !== "function") {
        return;
      }
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        return;
      }
      // 选区根节点必须落在 root 容器内
      const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
      if (!container || !root.contains(container)) {
        if (insideReader.value) {
          insideReader.value = false;
          setBounds(null);
        }
        return;
      }
      if (!insideReader.value) {
        insideReader.value = true;
      }
      setBounds({
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      });
    }

    function onMouseUp() {
      // 浏览器在 mouseup 之后才把选区写进 Selection，因此延后一拍读
      setTimeout(update, 0);
    }

    document.addEventListener("selectionchange", update);
    root.addEventListener("mouseup", onMouseUp);
    root.addEventListener("keyup", onMouseUp);
    return () => {
      document.removeEventListener("selectionchange", update);
      root.removeEventListener("mouseup", onMouseUp);
      root.removeEventListener("keyup", onMouseUp);
    };
  }, [rootRef]);

  return bounds;
}
