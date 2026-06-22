import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";
import type { ReaderState } from "../../modules/reader/readerState";

function makeReaderState(overrides: Partial<ReaderState> = {}): ReaderState {
  return {
    status: "ready",
    defaults: { viewMode: "continuous", zoom: 1 },
    document: null,
    pageViewports: [],
    renderRange: { startPage: 0, endPage: 0, pageNumbers: [] },
    errorMessage: undefined,
    ...overrides,
  } as unknown as ReaderState;
}

describe("StatusBar language toggle (ISS-NEW-G)", () => {
  test("默认 language=zh-CN 时「简体中文」按钮 active + 「English」可点", () => {
    render(<StatusBar readerState={makeReaderState()} language="zh-CN" onLanguageChange={() => undefined} />);
    const zh = screen.getByTestId("status-bar-language-zh-CN");
    const en = screen.getByTestId("status-bar-language-en");
    expect(zh).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
    expect(zh).toBeDisabled();
    expect(en).toBeEnabled();
  });

  test("language=en 时「English」active + 「简体中文」可点", () => {
    render(<StatusBar readerState={makeReaderState()} language="en" onLanguageChange={() => undefined} />);
    expect(screen.getByTestId("status-bar-language-en")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("status-bar-language-zh-CN")).toBeEnabled();
  });

  test("点击非当前语言 → 调 onLanguageChange 传对应 id", () => {
    const onLanguageChange = vi.fn();
    render(<StatusBar readerState={makeReaderState()} language="zh-CN" onLanguageChange={onLanguageChange} />);
    fireEvent.click(screen.getByTestId("status-bar-language-en"));
    expect(onLanguageChange).toHaveBeenCalledWith("en");
    expect(onLanguageChange).toHaveBeenCalledTimes(1);
  });

  test("无 onLanguageChange 时两个 toggle 都 disabled（纯展示）", () => {
    render(<StatusBar readerState={makeReaderState()} language="zh-CN" />);
    expect(screen.getByTestId("status-bar-language-zh-CN")).toBeDisabled();
    expect(screen.getByTestId("status-bar-language-en")).toBeDisabled();
  });

  test("未传 language 时默认 zh-CN", () => {
    render(<StatusBar readerState={makeReaderState()} onLanguageChange={() => undefined} />);
    expect(screen.getByTestId("status-bar-language-zh-CN")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("StatusBar OCR 模式状态栏（ISS-NEW-G 2026-06-22 收口）", () => {
  test("activeMode='ocr' 时渲染光标位置 + 状态文字，不渲染 read 模式 5 标签", () => {
    render(
      <StatusBar
        activeMode="ocr"
        ocrState={{ cursorPage: 3, jobStatus: "running" }}
        readerState={makeReaderState()}
      />,
    );
    expect(screen.getByTestId("status-bar")).toHaveAttribute("data-mode", "ocr");
    expect(screen.getByTestId("status-bar-ocr-cursor")).toHaveTextContent(/光标位置：第 3 页/);
    expect(screen.getByTestId("status-bar-ocr-status")).toHaveTextContent(/运行中/);
    // read 模式专属 5 标签不渲染
    expect(screen.queryByText(/^页码：/)).toBeNull();
    expect(screen.queryByText(/^缩放：/)).toBeNull();
    expect(screen.queryByText(/^视图：/)).toBeNull();
  });

  test("ocrState.cursorPage=null 时显示「-」占位", () => {
    render(
      <StatusBar
        activeMode="ocr"
        ocrState={{ cursorPage: null, jobStatus: "idle" }}
        readerState={makeReaderState()}
      />,
    );
    expect(screen.getByTestId("status-bar-ocr-cursor")).toHaveTextContent(/-$/);
  });

  test("ocrState.jobStatus='idle' 时状态文字为「空闲」", () => {
    render(
      <StatusBar
        activeMode="ocr"
        ocrState={{ cursorPage: 1, jobStatus: "idle" }}
        readerState={makeReaderState()}
      />,
    );
    expect(screen.getByTestId("status-bar-ocr-status")).toHaveTextContent(/空闲/);
  });

  test("OCR 状态 6 枚举（queued/running/completed/failed/cancelled）正确查表", () => {
    const cases = [
      { status: "queued" as const, expected: /排队中/ },
      { status: "running" as const, expected: /运行中/ },
      { status: "completed" as const, expected: /已完成/ },
      { status: "failed" as const, expected: /已失败/ },
      { status: "cancelled" as const, expected: /已取消/ },
    ];
    for (const { status, expected } of cases) {
      const { unmount } = render(
        <StatusBar
          activeMode="ocr"
          ocrState={{ cursorPage: 1, jobStatus: status }}
          readerState={makeReaderState()}
        />,
      );
      expect(screen.getByTestId("status-bar-ocr-status")).toHaveTextContent(expected);
      unmount();
    }
  });

  test("activeMode=read 时不渲染 OCR 字段（默认行为保留）", () => {
    render(<StatusBar readerState={makeReaderState()} />);
    expect(screen.queryByTestId("status-bar-ocr-cursor")).toBeNull();
    expect(screen.queryByTestId("status-bar-ocr-status")).toBeNull();
    expect(screen.getByTestId("status-bar")).not.toHaveAttribute("data-mode", "ocr");
  });

  test("activeMode=ocr 但 ocrState 未传时退化为 idle 状态（防御）", () => {
    render(<StatusBar activeMode="ocr" readerState={makeReaderState()} />);
    expect(screen.getByTestId("status-bar-ocr-status")).toHaveTextContent(/空闲/);
    expect(screen.getByTestId("status-bar-ocr-cursor")).toHaveTextContent(/-$/);
  });

  test("OCR 模式仍显示语言 toggle（与 read 模式共享）", () => {
    render(
      <StatusBar
        activeMode="ocr"
        language="en"
        ocrState={{ cursorPage: 2, jobStatus: "running" }}
        readerState={makeReaderState()}
      />,
    );
    expect(screen.getByTestId("status-bar-language-en")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("status-bar-ocr-status")).toHaveTextContent(/Running/);
  });
});
