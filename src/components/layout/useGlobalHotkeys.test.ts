/**
 * useGlobalHotkeys 单元测试（2026-08-15）：⌘/Ctrl+F 聚焦、Esc 关闭、
 * ⌘/Ctrl+[ ] 切命中、可编辑元素内不拦截。
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useGlobalHotkeys } from "./useGlobalHotkeys";

function fire(key: string, init: KeyboardEventInit = {}): void {
  const event = new KeyboardEvent("keydown", { key, ...init });
  document.dispatchEvent(event);
}

describe("useGlobalHotkeys", () => {
  let onFocusSearch: ReturnType<typeof vi.fn<() => void>>;
  let onCloseSearch: ReturnType<typeof vi.fn<() => void>>;
  let onPreviousHit: ReturnType<typeof vi.fn<() => void>>;
  let onNextHit: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onFocusSearch = vi.fn();
    onCloseSearch = vi.fn();
    onPreviousHit = vi.fn();
    onNextHit = vi.fn();
    renderHook(() =>
      useGlobalHotkeys({ onFocusSearch, onCloseSearch, onPreviousHit, onNextHit }),
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("⌘F 在 body 上聚焦搜索；Ctrl+F 同样生效", () => {
    fire("F", { metaKey: true });
    expect(onFocusSearch).toHaveBeenCalledOnce();
    fire("f", { ctrlKey: true });
    expect(onFocusSearch).toHaveBeenCalledTimes(2);
  });

  test("Esc 在任何上下文都触发关闭（含可编辑元素）", () => {
    fire("Escape");
    expect(onCloseSearch).toHaveBeenCalledOnce();
  });

  test("⌘[ / ⌘] 切命中（Ctrl 也生效）", () => {
    fire("[", { metaKey: true });
    fire("]", { ctrlKey: true });
    expect(onPreviousHit).toHaveBeenCalledOnce();
    expect(onNextHit).toHaveBeenCalledOnce();
  });

  test("输入框内不拦截 ⌘F（事件必须在 input 上 dispatch 才让 event.target=input）", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "F", metaKey: true, bubbles: true });
    input.dispatchEvent(event);
    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  test("仅修饰键组合（无其它修饰）才触发；⌘⇧F 不触发聚焦", () => {
    fire("F", { metaKey: true, shiftKey: true });
    expect(onFocusSearch).not.toHaveBeenCalled();
  });
});
