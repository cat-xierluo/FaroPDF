import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ChapterHeadingNode } from "../autoToc";
import { AutoTocDialog } from "./AutoTocDialog";

const sampleTree: ChapterHeadingNode[] = [
  {
    text: "第一章 总则",
    level: 1,
    pageIndex: 0,
    x: 0,
    y: 0,
    children: [
      { text: "第一节 立法目的", level: 2, pageIndex: 0, x: 0, y: 0, children: [] },
      { text: "第二节 适用范围", level: 2, pageIndex: 0, x: 0, y: 0, children: [] },
    ],
  },
  { text: "第二章 义务", level: 1, pageIndex: 1, x: 0, y: 0, children: [] },
  { text: "证据一 借条", level: 2, pageIndex: 2, x: 0, y: 0, children: [] },
];

describe("AutoTocDialog", () => {
  test("初始渲染：显示所有章节 + 已选计数", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("第一章 总则")).toBeInTheDocument();
    expect(screen.getByText("第一节 立法目的")).toBeInTheDocument();
    expect(screen.getByText("证据一 借条")).toBeInTheDocument();
    const hint = screen.getByTestId("auto-toc-hint");
    expect(hint.textContent).toMatch(/已识别\s*5\s*个章节/);
    expect(hint.textContent).toMatch(/已选\s*5\s*个/);
  });

  test("默认输出文件名 = -auto-toc.pdf", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="借款合同.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const input = screen.getByLabelText("输出文件名") as HTMLInputElement;
    expect(input.value).toBe("借款合同-auto-toc.pdf");
  });

  test("勾选切换：从 5 减到 4", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const checkbox = screen.getByLabelText("选择 第二节 适用范围");
    fireEvent.click(checkbox);
    const hint = screen.getByTestId("auto-toc-hint");
    expect(hint.textContent).toMatch(/已选\s*4\s*个/);
  });

  test("全部取消：确认按钮 disabled", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const labels = ["第一章 总则", "第一节 立法目的", "第二节 适用范围", "第二章 义务", "证据一 借条"];
    for (const label of labels) {
      const cb = screen.getByLabelText(`选择 ${label}`);
      fireEvent.click(cb);
    }
    const confirmBtn = screen.getByTestId("auto-toc-confirm");
    expect(confirmBtn).toBeDisabled();
  });

  test("删除单条：从 4 减到 3", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const deleteBtn = screen.getByLabelText("删除 证据一 借条");
    fireEvent.click(deleteBtn);
    expect(screen.queryByText("证据一 借条")).not.toBeInTheDocument();
    const hint = screen.getByTestId("auto-toc-hint");
    expect(hint.textContent).toMatch(/已识别\s*4\s*个章节/);
  });

  test("删除父节点连带删除后代", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const deleteBtn = screen.getByLabelText("删除 第一章 总则");
    fireEvent.click(deleteBtn);
    expect(screen.queryByText("第一章 总则")).not.toBeInTheDocument();
    expect(screen.queryByText("第一节 立法目的")).not.toBeInTheDocument();
    expect(screen.queryByText("第二节 适用范围")).not.toBeInTheDocument();
    expect(screen.getByText("第二章 义务")).toBeInTheDocument();
    expect(screen.getByText("证据一 借条")).toBeInTheDocument();
  });

  test("新增章节：追加到列表", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const addBtn = screen.getByText("+ 新增章节");
    fireEvent.click(addBtn);
    expect(screen.getByText("新章节")).toBeInTheDocument();
    const hint = screen.getByTestId("auto-toc-hint");
    expect(hint.textContent).toMatch(/已识别\s*6\s*个章节/);
  });

  test("确认：传递正确 tree（仅含 selected）+ outputName", () => {
    const onConfirm = vi.fn();
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    // 取消"证据一"
    fireEvent.click(screen.getByLabelText("选择 证据一 借条"));
    const confirmBtn = screen.getByTestId("auto-toc-confirm");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0][0];
    expect(arg.outputName).toBe("doc-auto-toc.pdf");
    // 取消"证据一"后剩 2 个根节点（第一章带 2 子 + 第二章）
    expect(arg.tree).toHaveLength(2);
    expect(arg.tree[0].text).toBe("第一章 总则");
    expect(arg.tree[0].children).toHaveLength(2);
    expect(arg.tree[1].text).toBe("第二章 义务");
  });

  test("取消：触发 onClose", () => {
    const onClose = vi.fn();
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("取消"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("空输出文件名：阻止确认 + 错误提示", () => {
    const onConfirm = vi.fn();
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const input = screen.getByLabelText("输出文件名") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByTestId("auto-toc-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/输出文件名不能为空/);
  });

  test("非 .pdf 后缀：阻止确认", () => {
    const onConfirm = vi.fn();
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const input = screen.getByLabelText("输出文件名") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "foo.txt" } });
    fireEvent.click(screen.getByTestId("auto-toc-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/必须以 .pdf 结尾/);
  });

  test("isLoading 状态：显示 loading 文案，不显示列表", () => {
    render(
      <AutoTocDialog
        initialHeadings={[]}
        isLoading={true}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/正在扫描 PDF 文字层/)).toBeInTheDocument();
    expect(screen.queryByTestId("auto-toc-confirm")).not.toBeInTheDocument();
  });

  test("error 状态：显示错误 + 关闭按钮", () => {
    const onClose = vi.fn();
    render(
      <AutoTocDialog
        initialHeadings={[]}
        isLoading={false}
        error="扫描文字层失败：未找到 PDF bytes"
        defaultFileName="doc.pdf"
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/扫描文字层失败/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("关闭"));
    expect(onClose).toHaveBeenCalled();
  });

  test("空 tree + 非 loading：显示空态 + 新增按钮仍可用", () => {
    render(
      <AutoTocDialog
        initialHeadings={[]}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/未识别到章节/)).toBeInTheDocument();
    expect(screen.getByText("+ 新增章节")).toBeInTheDocument();
  });

  test("点击文本进入重命名模式 + blur 提交", () => {
    render(
      <AutoTocDialog
        initialHeadings={sampleTree}
        isLoading={false}
        error={null}
        defaultFileName="doc.pdf"
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    const text = screen.getByText("第一章 总则");
    fireEvent.click(text);
    const input = screen.getByDisplayValue("第一章 总则") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "第一章 概述（重命名）" } });
    fireEvent.blur(input);
    expect(screen.getByText("第一章 概述（重命名）")).toBeInTheDocument();
  });
});
