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
