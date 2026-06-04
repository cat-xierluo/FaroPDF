import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useReaderKeyboard } from "./useReaderKeyboard";

interface HarnessProps {
  currentPage: number;
  pageCount: number;
  viewMode: "continuous" | "single" | "double" | "fit-width";
  onPageChange: (next: number) => void;
  enabled?: boolean;
}

function Harness(props: HarnessProps) {
  useReaderKeyboard({
    currentPage: props.currentPage,
    enabled: props.enabled,
    onPageChange: props.onPageChange,
    pageCount: props.pageCount,
    viewMode: props.viewMode,
  });
  return null;
}

function dispatchKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("useReaderKeyboard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("PageDown 推进到下一页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("PageDown");
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  test("PageUp 回退到上一页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("PageUp");
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test("ArrowRight / ArrowLeft 等价于翻页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("ArrowRight");
    dispatchKey("ArrowLeft");
    expect(onPageChange).toHaveBeenNthCalledWith(1, 4);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 2);
  });

  test("Space 推进一页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={1} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey(" ");
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test("Home/End 跳到首尾", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("Home");
    dispatchKey("End");
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 10);
  });

  test("double 模式下 ArrowRight 步进 2 页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="double" onPageChange={onPageChange} />);
    dispatchKey("ArrowRight");
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  test("PageDown 在末页被夹紧到最后一页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={10} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("PageDown");
    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  test("PageUp 在首页被夹紧到第一页", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={1} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    dispatchKey("PageUp");
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  test("input/textarea 内的按键不触发翻页", () => {
    const onPageChange = vi.fn();
    render(
      <>
        <input data-testid="search-input" />
        <Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />
      </>,
    );
    const input = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test("Cmd/Ctrl + 任意键不拦截", () => {
    const onPageChange = vi.fn();
    render(<Harness currentPage={3} pageCount={10} viewMode="continuous" onPageChange={onPageChange} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", metaKey: true, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", ctrlKey: true, bubbles: true }));
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test("enabled=false 时不挂载监听", () => {
    const onPageChange = vi.fn();
    render(
      <Harness
        currentPage={3}
        enabled={false}
        onPageChange={onPageChange}
        pageCount={10}
        viewMode="continuous"
      />,
    );
    dispatchKey("PageDown");
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
