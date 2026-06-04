import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReaderState } from "../../modules/reader/readerState";
import type { PdfDocumentState } from "../../shared/pdf/types";
import { ReaderCanvas, type RenderPageToCanvasFn } from "./ReaderCanvas";

const baseDocument: PdfDocumentState = {
  documentId: "doc-1",
  path: "/case/x.pdf",
  name: "x.pdf",
  fingerprint: "fp-canvas",
  pageCount: 5,
  currentPage: 1,
  zoom: 1,
  viewMode: "continuous",
  rotation: 0,
  dirty: false,
  textLayerStatus: "available",
  ocrStatus: "not-needed",
};

function makeState(overrides: Partial<ReaderState> & { document?: PdfDocumentState | null } = {}): ReaderState {
  const document = overrides.document === undefined ? baseDocument : overrides.document;
  return {
    defaults: { viewMode: "continuous", zoom: 1 },
    document,
    errorMessage: undefined,
    pageViewports: [{ height: 792, pageIndex: 0, rotation: 0, scale: 1, width: 612 }],
    renderRange: {
      endPage: document?.pageCount ?? 0,
      pageNumbers: document ? Array.from({ length: document.pageCount }, (_, i) => i + 1) : [],
      startPage: 1,
    },
    status: "ready",
    ...overrides,
  } as ReaderState;
}

describe("ReaderCanvas 阅读深化", () => {
  let originalResizeObserver: typeof ResizeObserver | undefined;
  beforeEach(() => {
    // jsdom 没有 ResizeObserver；注入一个空实现以满足 useLayoutEffect
    originalResizeObserver = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class {
      observe() {
        return;
      }
      unobserve() {
        return;
      }
      disconnect() {
        return;
      }
    } as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = originalResizeObserver;
  });

  test("fit-width 模式在 data-view-mode 上标记，effective 缩放由容器宽度驱动", () => {
    const state = makeState({ document: { ...baseDocument, viewMode: "fit-width", zoom: 0.5 } });
    render(<ReaderCanvas readerState={state} />);

    const viewport = document.querySelector(".reader__viewport");
    expect(viewport).toHaveAttribute("data-view-mode", "fit-width");
  });

  test("double 模式按 viewMode=double 渲染", () => {
    const state = makeState({
      document: { ...baseDocument, viewMode: "double", currentPage: 3 },
      renderRange: { endPage: 4, pageNumbers: [3, 4], startPage: 3 },
    });
    render(<ReaderCanvas readerState={state} />);

    expect(document.querySelector(".reader__viewport")).toHaveAttribute("data-view-mode", "double");
  });

  test("single 模式只渲染当前页", () => {
    const state = makeState({
      document: { ...baseDocument, viewMode: "single", currentPage: 2 },
      renderRange: { endPage: 2, pageNumbers: [2], startPage: 2 },
    });
    render(<ReaderCanvas readerState={state} />);

    const pages = screen.getAllByLabelText(/^第 \d+ 页$/);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveAttribute("data-page-number", "2");
  });

  test("rotation 通过 data-rotation 暴露，按 90/270 旋转 CSS transform", () => {
    const state = makeState({ document: { ...baseDocument, rotation: 90 } });
    render(<ReaderCanvas readerState={state} />);
    const page1 = screen.getByLabelText("第 1 页");
    expect(page1).toHaveAttribute("data-rotation", "90");
    expect(page1.style.transform).toContain("rotate(90deg)");
  });

  test("键盘 PageDown 调用 onPageNavigate(currentPage + 1)", async () => {
    const onPageNavigate = vi.fn();
    const state = makeState({ document: { ...baseDocument, currentPage: 2 } });
    render(<ReaderCanvas onPageNavigate={onPageNavigate} readerState={state} />);

    await userEvent.keyboard("{PageDown}");
    expect(onPageNavigate).toHaveBeenCalledWith(3);
  });

  test("键盘 PageUp 调用 onPageNavigate(currentPage - 1)", async () => {
    const onPageNavigate = vi.fn();
    const state = makeState({ document: { ...baseDocument, currentPage: 2 } });
    render(<ReaderCanvas onPageNavigate={onPageNavigate} readerState={state} />);

    await userEvent.keyboard("{PageUp}");
    expect(onPageNavigate).toHaveBeenCalledWith(1);
  });

  test("键盘 ArrowRight 在 double 模式下步进 2 页", async () => {
    const onPageNavigate = vi.fn();
    const state = makeState({ document: { ...baseDocument, viewMode: "double", currentPage: 2 } });
    render(<ReaderCanvas onPageNavigate={onPageNavigate} readerState={state} />);

    await userEvent.keyboard("{ArrowRight}");
    expect(onPageNavigate).toHaveBeenCalledWith(4);
  });

  test("renderPageToCanvas 在每个 PdfPage 渲染时被调用", () => {
    const renderPageToCanvas = vi.fn<RenderPageToCanvasFn>(async () => undefined);
    const state = makeState({
      document: { ...baseDocument, viewMode: "single", currentPage: 1, zoom: 1.5 },
      renderRange: { endPage: 1, pageNumbers: [1], startPage: 1 },
    });
    render(<ReaderCanvas renderPageToCanvas={renderPageToCanvas} readerState={state} />);
    // canvas 渲染发生在 useEffect 内；通过 setTimeout 推到下一帧
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(renderPageToCanvas).toHaveBeenCalled();
        expect(renderPageToCanvas.mock.calls[0]?.[2]).toBeCloseTo(1.5);
        resolve();
      }, 0);
    });
  });

  test("ReaderCanvas 暴露 reader-status-footer 区域给状态栏测试", () => {
    const state = makeState();
    render(<ReaderCanvas readerState={state} />);
    const footer = screen.getByTestId("reader-status-footer");
    expect(within(footer).getByText("x.pdf")).toBeInTheDocument();
  });

  test("ocrStatus=needed 时显示 OCR-needed 提示条，onRequestOcr 回调被调用", async () => {
    const onRequestOcr = vi.fn();
    const state = makeState({
      document: { ...baseDocument, ocrStatus: "needed" },
    });
    render(<ReaderCanvas onRequestOcr={onRequestOcr} readerState={state} />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveClass("reader__status-banner--ocr-needed");
    const button = within(banner).getByRole("button", { name: "前往 OCR 模式" });
    await userEvent.click(button);
    expect(onRequestOcr).toHaveBeenCalledTimes(1);
  });

  test("ocrStatus=not-needed 时不显示 OCR-needed 提示条", () => {
    const state = makeState({ document: { ...baseDocument, ocrStatus: "not-needed" } });
    render(<ReaderCanvas readerState={state} />);
    expect(document.querySelector(".reader__status-banner--ocr-needed")).toBeNull();
  });

  test("ocrStatus=needed 但未传 onRequestOcr 时按钮禁用", () => {
    const state = makeState({ document: { ...baseDocument, ocrStatus: "needed" } });
    render(<ReaderCanvas readerState={state} />);
    const button = screen.getByRole("button", { name: "前往 OCR 模式" });
    expect(button).toBeDisabled();
  });

  test("每个 PdfPage 渲染 text-layer-badge 徽章", () => {
    const state = makeState({
      document: { ...baseDocument, viewMode: "single", currentPage: 1 },
      renderRange: { endPage: 1, pageNumbers: [1], startPage: 1 },
    });
    render(<ReaderCanvas readerState={state} />);
    const badge = screen.getByTestId("text-layer-badge-1");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("pdf-page__text-layer-badge--available");
  });
});
