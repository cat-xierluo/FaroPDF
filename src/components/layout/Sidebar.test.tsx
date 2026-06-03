import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import { DocumentSummaryPanel } from "./Sidebar";

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
