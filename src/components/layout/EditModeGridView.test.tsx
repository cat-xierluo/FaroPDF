import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReaderController } from "../../modules/reader";
import { EditModeGridView } from "./EditModeGridView";

interface MockReaderOptions {
  pageCount?: number;
  documentId?: string;
}

function createMockReader({ pageCount = 0, documentId = "doc-1" }: MockReaderOptions = {}): ReaderController {
  const document = pageCount > 0
    ? {
        documentId,
        name: "test.pdf",
        pageCount,
        currentPage: 1,
        zoom: 1,
        viewMode: "single" as const,
        ocrStatus: "ready" as const,
      }
    : null;
  return {
    state: {
      document,
      pageViewports: [],
      defaults: {
        zoom: 1,
        viewMode: "single" as const,
      },
    },
  } as unknown as ReaderController;
}

describe("EditModeGridView (ISS-NEW-I)", () => {
  test("无文档 → 渲染空态", () => {
    render(<EditModeGridView reader={createMockReader({ pageCount: 0 })} />);
    expect(screen.getByTestId("edit-mode-grid-empty")).toBeTruthy();
    expect(screen.getByText(/打开 PDF 后进入 T 编辑/)).toBeTruthy();
  });

  test("有文档 → 渲染 5 列网格 + 页面卡片", () => {
    render(<EditModeGridView reader={createMockReader({ pageCount: 12 })} />);
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    // 上限 60，pageCount 12 → 渲染 12
    expect(cards.length).toBe(12);
    expect(screen.getByTestId("edit-mode-grid-count").textContent).toContain("共 12 页");
  });

  test("pageCount > 60 → 仅显示前 60 个卡片（截图 80/81 多页文档）", () => {
    render(<EditModeGridView reader={createMockReader({ pageCount: 120 })} />);
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    expect(cards.length).toBe(60);
  });

  test("点击卡片 → 选中态蓝边框 + 触发 onSelectPage", () => {
    const onSelectPage = vi.fn();
    render(
      <EditModeGridView
        reader={createMockReader({ pageCount: 5 })}
        onSelectPage={onSelectPage}
      />,
    );
    const firstCard = screen.getAllByTestId("edit-mode-grid-card")[0];
    fireEvent.click(firstCard);
    expect(firstCard.className).toContain("edit-mode-grid__card--selected");
    expect(onSelectPage).toHaveBeenCalledWith(1);
  });

  test("切换选中 → 仅最新点击的卡片蓝边框", () => {
    render(<EditModeGridView reader={createMockReader({ pageCount: 5 })} />);
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    fireEvent.click(cards[0]);
    expect(cards[0].className).toContain("edit-mode-grid__card--selected");
    fireEvent.click(cards[3]);
    expect(cards[3].className).toContain("edit-mode-grid__card--selected");
    expect(cards[0].className).not.toContain("edit-mode-grid__card--selected");
  });

  test("切换文档 → 选中态清空（防 stale state）", () => {
    const { rerender } = render(<EditModeGridView reader={createMockReader({ pageCount: 5, documentId: "doc-A" })} />);
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    fireEvent.click(cards[0]);
    expect(cards[0].className).toContain("edit-mode-grid__card--selected");
    rerender(<EditModeGridView reader={createMockReader({ pageCount: 5, documentId: "doc-B" })} />);
    const newCards = screen.getAllByTestId("edit-mode-grid-card");
    expect(newCards[0].className).not.toContain("edit-mode-grid__card--selected");
  });

  test("拖动 source → drop target → 触发 onReorder(from, to)", () => {
    const onReorder = vi.fn();
    render(
      <EditModeGridView
        reader={createMockReader({ pageCount: 6 })}
        onReorder={onReorder}
      />,
    );
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    // 第 1 页拖到第 3 页（drop after = to=4 → 校正后 to=3）
    const dataTransfer = createStubDataTransfer();
    fireEvent.dragStart(cards[0], { dataTransfer });
    const targetRect = { left: 100, width: 200, right: 300, top: 0, bottom: 100, height: 100, x: 100, y: 0, toJSON: () => ({}) } as DOMRect;
    cards[2].getBoundingClientRect = () => targetRect;
    fireEvent.dragOver(cards[2], { dataTransfer, clientX: 250 }); // midpoint=200, 250>200 → after
    fireEvent.drop(cards[2], { dataTransfer });
    expect(onReorder).toHaveBeenCalledTimes(1);
    const [from, to] = onReorder.mock.calls[0];
    expect(from).toBe(1);
    expect(to).toBe(3);
  });

  test("无 onReorder 回调 → drop 也不报错", () => {
    render(<EditModeGridView reader={createMockReader({ pageCount: 4 })} />);
    const cards = screen.getAllByTestId("edit-mode-grid-card");
    const dataTransfer = createStubDataTransfer();
    fireEvent.dragStart(cards[0], { dataTransfer });
    fireEvent.drop(cards[2], { dataTransfer });
    // 仅验证不抛错
    expect(cards[2]).toBeTruthy();
  });
});

/** 构造一个最小的 DataTransfer stub —— jsdom 不实现 setData/getData。 */
function createStubDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData() {
      store.clear();
    },
    getData(type: string) {
      return store.get(type) ?? "";
    },
    setData(type: string, value: string) {
      store.set(type, value);
    },
    setDragImage() {
      /* noop */
    },
  } as unknown as DataTransfer;
}