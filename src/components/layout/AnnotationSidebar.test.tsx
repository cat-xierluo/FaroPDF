import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import { AnnotationSidebar } from "./AnnotationSidebar";

function makeAnnotation(overrides: Partial<PdfAnnotation> & { id: string; pageIndex: number }): PdfAnnotation {
  return {
    type: "highlight",
    rects: [{ x: 0, y: 0, width: 100, height: 20 }],
    color: "#f6d66f",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AnnotationSidebar 基础态", () => {
  test("未打开文档时显示占位提示", () => {
    render(<AnnotationSidebar annotations={[]} hasDocument={false} />);
    expect(screen.getByText("打开 PDF 后显示批注列表")).toBeInTheDocument();
  });

  test("有文档但无批注时显示空态", () => {
    render(<AnnotationSidebar annotations={[]} hasDocument={true} />);
    expect(screen.getByText("当前文档暂无批注")).toBeInTheDocument();
  });

  test("有批注时显示总数与筛选后计数", () => {
    const annotations = [
      makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", content: "重要段落" }),
      makeAnnotation({ id: "b", pageIndex: 1, type: "note", content: "需要复核" }),
    ];
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);
    expect(screen.getByText("批注（2 / 2）")).toBeInTheDocument();
  });

  test("有批注时显示扁平化导出动作", () => {
    const annotations = [makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", content: "重要段落" })];
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} onFlattenAnnotations={vi.fn()} />);
    expect(screen.getByRole("button", { name: "扁平化导出" })).toBeInTheDocument();
  });

  test("无批注时不显示可点击的扁平化导出假入口", () => {
    render(<AnnotationSidebar annotations={[]} hasDocument={true} onFlattenAnnotations={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "扁平化导出" })).not.toBeInTheDocument();
  });

  test("点击扁平化导出后显示成功状态", async () => {
    const user = userEvent.setup();
    const annotations = [makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", content: "重要段落" })];
    const onFlattenAnnotations = vi.fn(async () => ({
      annotationCount: 1,
      drawnCount: 1,
      fileName: "case-annotations-flattened.pdf",
      skippedCount: 0,
    }));

    render(
      <AnnotationSidebar
        annotations={annotations}
        hasDocument={true}
        onFlattenAnnotations={onFlattenAnnotations}
      />,
    );

    await user.click(screen.getByRole("button", { name: "扁平化导出" }));
    expect(onFlattenAnnotations).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/已导出 case-annotations-flattened\.pdf/)).toBeInTheDocument();
  });
});

describe("AnnotationSidebar 4 维度分组", () => {
  const stampReviewed = makeAnnotation({
    id: "stamped",
    pageIndex: 1,
    type: "stamp",
    color: "#d14d4d",
    stamp: { name: "reviewed", label: "已阅" },
  });
  const note = makeAnnotation({
    id: "note-1",
    pageIndex: 0,
    type: "note",
    color: "#2f80ed",
    content: "需要复核",
  });
  const highlight = makeAnnotation({
    id: "hl-1",
    pageIndex: 2,
    type: "highlight",
    color: "#f6d66f",
    content: "关键证据",
  });
  const annotations = [stampReviewed, note, highlight];

  test("默认按页码分组", () => {
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} pageCount={3} />);
    expect(screen.getByRole("tab", { name: "按页码", selected: true })).toBeInTheDocument();
    const groupBy = screen.getByRole("tablist", { name: "分组维度" });
    expect(within(groupBy).getByRole("tab", { name: "按类型" })).toBeInTheDocument();
    expect(within(groupBy).getByRole("tab", { name: "按颜色" })).toBeInTheDocument();
    expect(within(groupBy).getByRole("tab", { name: "按标签" })).toBeInTheDocument();
    // 验证 group header 包含 3 个页码
    const list = screen.getByRole("list", { name: "按页码分组的批注" });
    const allItems = within(list).getAllByRole("listitem");
    const groups = allItems.filter((item) => item.hasAttribute("data-group-key"));
    expect(groups.map((g) => g.getAttribute("data-group-key"))).toEqual(["0", "1", "2"]);
    // group 标题（"第 1 页" / "第 2 页" / "第 3 页"）至少各 1 个
    expect(screen.getAllByText("第 1 页").length).toBeGreaterThan(0);
    expect(screen.getAllByText("第 3 页").length).toBeGreaterThan(0);
  });

  test("切换到按类型分组", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("tab", { name: "按类型" }));

    // 9 种类型中实际出现 3 个（高亮/备注/图章）
    const list = screen.getByRole("list", { name: "按类型分组的批注" });
    const allItems = within(list).getAllByRole("listitem");
    const groups = allItems.filter((item) => item.hasAttribute("data-group-key"));
    expect(groups.map((g) => g.getAttribute("data-group-key"))).toEqual(["highlight", "note", "stamp"]);
  });

  test("切换到按颜色分组", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("tab", { name: "按颜色" }));

    expect(screen.getByText("红（d14d4d）")).toBeInTheDocument();
    expect(screen.getByText("蓝（2f80ed）")).toBeInTheDocument();
    expect(screen.getByText("黄（f6d66f）")).toBeInTheDocument();
  });

  test("切换到按标签分组（stamp.label + content 截断）", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("tab", { name: "按标签" }));

    const list = screen.getByRole("list", { name: "按标签分组的批注" });
    const allItems = within(list).getAllByRole("listitem");
    const groups = allItems.filter((item) => item.hasAttribute("data-group-key"));
    // sortAnnotations 内部按 pageIndex 排：note(0) → stamp(1) → highlight(2)
    expect(groups.map((g) => g.getAttribute("data-group-key"))).toEqual(["需要复核", "已阅", "关键证据"]);
  });
});

describe("AnnotationSidebar 搜索", () => {
  const annotations = [
    makeAnnotation({ id: "a", pageIndex: 0, type: "highlight", content: "重要段落" }),
    makeAnnotation({ id: "b", pageIndex: 0, type: "note", content: "需要复核" }),
    makeAnnotation({ id: "c", pageIndex: 1, type: "underline", quote: "关键证据" }),
  ];

  test("搜索框输入后过滤批注", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    const search = screen.getByTestId("annotation-sidebar-search");
    await user.type(search, "复核");

    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();
    // 仅 "b" 批注 row 应在列表中（"a"/"c" 被过滤）
    const rowButtons = Array.from(
      document.querySelectorAll("[data-annotation-row-id]"),
    ) as HTMLElement[];
    const rowIds = rowButtons.map((b) => b.getAttribute("data-annotation-row-id"));
    expect(rowIds).toEqual(["b"]);
    // "需要复核" 至少存在一次（在 row 中）
    expect(screen.getAllByText("需要复核").length).toBeGreaterThan(0);
  });

  test("清空搜索恢复全部", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    const search = screen.getByTestId("annotation-sidebar-search");
    await user.type(search, "复核");
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();

    await user.clear(search);
    expect(screen.getByText("批注（3 / 3）")).toBeInTheDocument();
  });
});

describe("AnnotationSidebar 筛选 chips", () => {
  const annotations = [
    makeAnnotation({ id: "hl", pageIndex: 0, type: "highlight", color: "#f6d66f" }),
    makeAnnotation({ id: "nt", pageIndex: 0, type: "note", color: "#2f80ed", content: "需要复核" }),
    makeAnnotation({ id: "st", pageIndex: 2, type: "stamp", color: "#d14d4d", stamp: { name: "reviewed", label: "已阅" } }),
  ];

  test("类型 chip 多选", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("button", { name: "高亮" }));
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "图章" }));
    expect(screen.getByText("批注（2 / 3）")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高亮" }));
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();
  });

  test("颜色 chip 多选", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByLabelText("颜色 蓝"));
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();
  });

  test("页码 chip 过滤", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} pageCount={3} />);

    await user.click(screen.getByRole("button", { name: "p1" }));
    expect(screen.getByText("批注（2 / 3）")).toBeInTheDocument();
  });

  test("标签 chip 过滤（图章 label）", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("button", { name: "已阅" }));
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();
  });

  test("清除筛选按钮恢复全部", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("button", { name: "高亮" }));
    expect(screen.getByText("批注（1 / 3）")).toBeInTheDocument();

    await user.click(screen.getByTestId("annotation-sidebar-clear"));
    expect(screen.getByText("批注（3 / 3）")).toBeInTheDocument();
  });

  test("筛选后无结果时显示空态和清除按钮", async () => {
    const user = userEvent.setup();
    render(<AnnotationSidebar annotations={annotations} hasDocument={true} />);

    await user.click(screen.getByRole("button", { name: "文本框" }));
    expect(screen.getByText("当前筛选条件下没有批注")).toBeInTheDocument();
    // 清除筛选 button 应该存在（包括 chip 区域的同一个按钮）
    expect(screen.getAllByRole("button", { name: "清除筛选" }).length).toBeGreaterThan(0);
  });
});

describe("AnnotationSidebar 跳转与选中", () => {
  const annotations = [
    makeAnnotation({ id: "hl-1", pageIndex: 0, type: "highlight", content: "要点" }),
    makeAnnotation({ id: "nt-1", pageIndex: 2, type: "note", content: "需要复核" }),
  ];

  test("点击批注调用 onSelectPage 传入 0-based pageIndex", async () => {
    const user = userEvent.setup();
    const onSelectPage = vi.fn();
    render(
      <AnnotationSidebar
        annotations={annotations}
        hasDocument={true}
        onSelectPage={onSelectPage}
      />,
    );

    await user.click(screen.getByRole("button", { name: /高亮 · 第 1 页/ }));
    expect(onSelectPage).toHaveBeenCalledWith(0);
  });

  test("点击批注同时调用 onAnnotationClick", async () => {
    const user = userEvent.setup();
    const onAnnotationClick = vi.fn();
    render(
      <AnnotationSidebar
        annotations={annotations}
        hasDocument={true}
        onAnnotationClick={onAnnotationClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: /备注 · 第 3 页/ }));
    expect(onAnnotationClick).toHaveBeenCalledWith("nt-1");
  });

  test("activeAnnotationId 高亮对应行", () => {
    render(
      <AnnotationSidebar
        activeAnnotationId="nt-1"
        annotations={annotations}
        currentPage={3}
        hasDocument={true}
      />,
    );

    const activeButton = document.querySelector('[data-annotation-row-id="nt-1"]') as HTMLElement;
    expect(activeButton).not.toBeNull();
    expect(activeButton).toHaveAttribute("aria-current", "true");
    expect(activeButton).toHaveClass("annotation-sidebar__row-button--active");
    expect(activeButton).toHaveClass("annotation-sidebar__row-button--current-page");
  });
});
