import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import { DocumentSummaryPanel, type RenderThumbnailFn } from "./Sidebar";

/** 创建测试用批注 */
function createTestAnnotation(overrides: Partial<PdfAnnotation> & { id: string; pageIndex: number }): PdfAnnotation {
  return {
    type: "highlight",
    rects: [{ x: 0, y: 0, width: 100, height: 20 }],
    color: "#FFFF00",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DocumentSummaryPanel 批注列表", () => {
  test("preferredTab 可让编辑态直接显示大纲", () => {
    render(<DocumentSummaryPanel hasDocument={true} preferredTab="大纲" />);

    expect(screen.getByRole("tab", { name: "大纲" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "大纲" })).toBeInTheDocument();
  });

  test("未打开文档时，批注列表标签显示占位文本", async () => {
    const user = userEvent.setup();
    render(<DocumentSummaryPanel hasDocument={false} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    expect(screen.getByText("打开 PDF 后显示批注列表")).toBeInTheDocument();
  });

  test("有文档但无批注时，显示空态提示", async () => {
    const user = userEvent.setup();
    render(<DocumentSummaryPanel hasDocument={true} annotations={[]} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    expect(screen.getByText("当前文档暂无批注")).toBeInTheDocument();
  });

  test("有批注时按页码分组显示", async () => {
    const user = userEvent.setup();
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 0, type: "highlight", content: "重要段落" }),
      createTestAnnotation({ id: "ann-2", pageIndex: 0, type: "note", content: "需要复核" }),
      createTestAnnotation({ id: "ann-3", pageIndex: 2, type: "underline", quote: "关键证据" }),
    ];

    render(<DocumentSummaryPanel hasDocument={true} annotations={annotations} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    // 显示页码分组标题
    expect(screen.getByText("第 1 页")).toBeInTheDocument();
    expect(screen.getByText("第 3 页")).toBeInTheDocument();

    // 显示批注类型标签
    expect(screen.getByText("高亮")).toBeInTheDocument();
    expect(screen.getByText("备注")).toBeInTheDocument();
    expect(screen.getByText("下划线")).toBeInTheDocument();

    // 显示批注内容摘要
    expect(screen.getByText("重要段落")).toBeInTheDocument();
    expect(screen.getByText("需要复核")).toBeInTheDocument();
    expect(screen.getByText("关键证据")).toBeInTheDocument();
  });

  test("点击批注调用 onSelectPage 跳转到对应页面", async () => {
    const user = userEvent.setup();
    const onSelectPage = vi.fn();
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 3, type: "highlight", content: "要点" }),
    ];

    render(
      <DocumentSummaryPanel
        hasDocument={true}
        annotations={annotations}
        onSelectPage={onSelectPage}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    // 点击批注条目
    const annotationButton = screen.getByRole("button", { name: /高亮 - 第 4 页/ });
    await user.click(annotationButton);

    expect(onSelectPage).toHaveBeenCalledTimes(1);
    expect(onSelectPage).toHaveBeenCalledWith(3);
  });

  test("所有九种批注类型都有对应的中文标签", async () => {
    const user = userEvent.setup();
    const types = ["highlight", "underline", "strikeout", "note", "textbox", "rectangle", "arrow", "ink", "stamp"] as const;
    const expectedLabels = ["高亮", "下划线", "删除线", "备注", "文本框", "矩形", "箭头", "墨迹", "图章"];

    const annotations: PdfAnnotation[] = types.map((type, index) =>
      createTestAnnotation({ id: `ann-${index}`, pageIndex: 0, type }),
    );

    render(<DocumentSummaryPanel hasDocument={true} annotations={annotations} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test("长内容文本会被截断显示", async () => {
    const user = userEvent.setup();
    const longContent = "这是一段非常长的批注内容，总长度超过了四十个字符的限制，因此在列表中应该被截断显示而不是完整展示全部文字";
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 0, type: "note", content: longContent }),
    ];

    render(<DocumentSummaryPanel hasDocument={true} annotations={annotations} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    // 验证截断后文本（40字符 + "…"）
    const truncated = longContent.slice(0, 40) + "…";
    expect(screen.getByText(truncated)).toBeInTheDocument();
    // 原始长文本不应完整显示
    expect(screen.queryByText(longContent)).not.toBeInTheDocument();
  });

  test("没有 content 和 quote 的批注只显示类型标签", async () => {
    const user = userEvent.setup();
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 0, type: "rectangle" }),
    ];

    render(<DocumentSummaryPanel hasDocument={true} annotations={annotations} />);

    await user.click(screen.getByRole("tab", { name: "批注列表" }));

    expect(screen.getByText("矩形")).toBeInTheDocument();
    // 没有内容摘要的 span
    const button = screen.getByRole("button", { name: /矩形 - 第 1 页$/ });
    expect(button).toBeInTheDocument();
  });
});

describe("DocumentSummaryPanel 缩略图", () => {
  // IntersectionObserver 在 jsdom 中不可用，组件内已做兜底直接显示 canvas 占位
  // 这里只需要关注组件逻辑，无需 mock IO

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("未打开文档时显示占位提示", () => {
    render(<DocumentSummaryPanel hasDocument={false} pageCount={0} />);

    expect(screen.getByText("打开 PDF 后显示缩略图")).toBeInTheDocument();
  });

  test("打开文档后渲染全部页码的缩略图条目", () => {
    render(<DocumentSummaryPanel hasDocument={true} pageCount={3} currentPage={1} />);

    const list = screen.getByTestId("thumbnail-list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("data-page-number", "1");
    expect(items[2]).toHaveAttribute("data-page-number", "3");
  });

  test("当前页的缩略图有 thumbnail-item--current 标记和 aria-current", () => {
    render(<DocumentSummaryPanel hasDocument={true} pageCount={5} currentPage={3} />);

    const currentItem = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="3"]');
    expect(currentItem).not.toBeNull();
    expect(currentItem).toHaveAttribute("aria-current", "page");
    expect(currentItem).toHaveClass("thumbnail-item--current");
  });

  test("点击缩略图调用 onSelectPage 并传入 0-based pageIndex", async () => {
    const user = userEvent.setup();
    const onSelectPage = vi.fn();
    const renderThumbnail = vi.fn<RenderThumbnailFn>(async () => undefined);

    render(
      <DocumentSummaryPanel
        currentPage={1}
        hasDocument={true}
        onSelectPage={onSelectPage}
        pageCount={4}
        renderThumbnail={renderThumbnail}
      />,
    );

    const fourthPageButton = screen.getByRole("button", { name: "第 4 页" });
    await user.click(fourthPageButton);

    expect(onSelectPage).toHaveBeenCalledTimes(1);
    expect(onSelectPage).toHaveBeenCalledWith(3);
  });

  test("提供 renderThumbnail 时为每个页码渲染一个 canvas 元素", () => {
    const renderThumbnail = vi.fn<RenderThumbnailFn>(async () => undefined);

    render(
      <DocumentSummaryPanel
        currentPage={1}
        hasDocument={true}
        pageCount={3}
        renderThumbnail={renderThumbnail}
      />,
    );

    // 三个页码应分别有 canvas 元素
    expect(screen.getByTestId("thumbnail-canvas-1")).toBeInTheDocument();
    expect(screen.getByTestId("thumbnail-canvas-2")).toBeInTheDocument();
    expect(screen.getByTestId("thumbnail-canvas-3")).toBeInTheDocument();
  });

  test("pagesWithHits 中的页码显示可访问的紧凑命中标记", () => {
    render(
      <DocumentSummaryPanel
        currentPage={1}
        hasDocument={true}
        pageCount={4}
        pagesWithHits={new Set([2, 4])}
      />,
    );

    // 第 2 页和第 4 页有命中标记
    const page2 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="2"]') as HTMLElement;
    const page4 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="4"]') as HTMLElement;
    const page1 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="1"]') as HTMLElement;

    expect(within(page2).getByLabelText("本页有搜索命中")).toHaveClass("thumbnail-status-marker--search");
    expect(within(page4).getByLabelText("本页有搜索命中")).toHaveClass("thumbnail-status-marker--search");
    expect(within(page2).queryByText("命中")).not.toBeInTheDocument();
    expect(within(page1).queryByLabelText("本页有搜索命中")).not.toBeInTheDocument();
  });

  test("有批注的页码显示可访问的紧凑批注标记", () => {
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 0, type: "highlight" }),
      createTestAnnotation({ id: "ann-2", pageIndex: 1, type: "note" }),
    ];

    render(
      <DocumentSummaryPanel
        annotations={annotations}
        currentPage={1}
        hasDocument={true}
        pageCount={3}
      />,
    );

    const page1 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="1"]') as HTMLElement;
    const page2 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="2"]') as HTMLElement;
    const page3 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="3"]') as HTMLElement;

    expect(within(page1).getByLabelText("本页有批注")).toHaveClass("thumbnail-status-marker--annotation");
    expect(within(page2).getByLabelText("本页有批注")).toHaveClass("thumbnail-status-marker--annotation");
    expect(within(page1).queryByText("批注")).not.toBeInTheDocument();
    expect(within(page3).queryByLabelText("本页有批注")).not.toBeInTheDocument();
  });

  test("ocrNeeded=true 时所有页码显示可访问的紧凑 OCR 标记", () => {
    render(
      <DocumentSummaryPanel
        currentPage={1}
        hasDocument={true}
        ocrNeeded={true}
        pageCount={3}
      />,
    );

    const ocrMarkers = screen.getAllByLabelText("本页需要 OCR");
    expect(ocrMarkers).toHaveLength(3);
    expect(ocrMarkers[0]).toHaveClass("thumbnail-status-marker--ocr");
    expect(screen.queryByText("OCR")).not.toBeInTheDocument();
  });

  test("ocrNeeded=false 时不显示 OCR 标记", () => {
    render(
      <DocumentSummaryPanel
        currentPage={1}
        hasDocument={true}
        ocrNeeded={false}
        pageCount={3}
      />,
    );

    expect(screen.queryByLabelText("本页需要 OCR")).not.toBeInTheDocument();
  });

  test("同一页多个状态标记并排显示，点击仍跳转到页码", async () => {
    const user = userEvent.setup();
    const onSelectPage = vi.fn();
    const annotations: PdfAnnotation[] = [
      createTestAnnotation({ id: "ann-1", pageIndex: 0, type: "highlight" }),
    ];

    render(
      <DocumentSummaryPanel
        annotations={annotations}
        currentPage={1}
        hasDocument={true}
        ocrNeeded={true}
        onSelectPage={onSelectPage}
        pageCount={2}
        pagesWithHits={new Set([1])}
      />,
    );

    const page1 = screen.getByTestId("thumbnail-list").querySelector('[data-page-number="1"]') as HTMLElement;
    expect(within(page1).getByLabelText("本页有批注")).toBeInTheDocument();
    expect(within(page1).getByLabelText("本页有搜索命中")).toBeInTheDocument();
    expect(within(page1).getByLabelText("本页需要 OCR")).toBeInTheDocument();
    expect(within(page1).queryByText(/批注|命中|OCR/)).not.toBeInTheDocument();

    await user.click(within(page1).getByRole("button", { name: "第 1 页（当前页）" }));
    expect(onSelectPage).toHaveBeenCalledWith(0);
  });
});
