import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PropertiesDialog } from "./PropertiesDialog";
import type { PdfMetadata } from "../properties";

const SAMPLE_METADATA: PdfMetadata = {
  title: "张三诉李四案",
  author: "王律师",
  subject: "民事诉讼",
  keywords: ["合同", "2026"],
  producer: "FaroPDF",
  creator: "FaroPDF",
  creationDate: "2026-01-15T08:00:00.000Z",
  modDate: "2026-06-15T10:30:00.000Z",
  pageCount: 12,
  isEncrypted: false,
};

describe("PropertiesDialog (ISS-072 阶段 2)", () => {
  const baseProps = {
    metadata: SAMPLE_METADATA,
    defaultFileName: "contract.pdf",
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  test("渲染文档属性对话框，所有字段用 metadata 初值预填", () => {
    render(<PropertiesDialog {...baseProps} />);
    expect(screen.getByRole("heading", { name: /文档属性/ })).toBeTruthy();
    expect((screen.getByLabelText(/标题/) as HTMLInputElement).value).toBe("张三诉李四案");
    expect((screen.getByLabelText(/作者/) as HTMLInputElement).value).toBe("王律师");
    expect((screen.getByLabelText(/主题/) as HTMLInputElement).value).toBe("民事诉讼");
    expect((screen.getByLabelText(/关键词/) as HTMLInputElement).value).toBe("合同, 2026");
    expect((screen.getByLabelText(/创建日期/) as HTMLInputElement).value).toBe("2026-01-15T08:00:00.000Z");
  });

  test("只读字段：Producer / Creator / 页数 / 加密状态", () => {
    render(<PropertiesDialog {...baseProps} />);
    expect((screen.getByLabelText(/生产者/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/创建者/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/页数/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/未加密/)).toBeTruthy();
  });

  test("isEncrypted=true → 显示「已加密」标签", () => {
    render(<PropertiesDialog {...baseProps} metadata={{ ...SAMPLE_METADATA, isEncrypted: true }} />);
    expect(screen.getByText(/已加密/)).toBeTruthy();
  });

  test("编辑标题 + 点击确认 → onConfirm 传入 updates.title", () => {
    const onConfirm = vi.fn();
    render(<PropertiesDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/标题/), { target: { value: "新标题" } });
    fireEvent.click(screen.getByRole("button", { name: /保存元数据/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const call = onConfirm.mock.calls[0][0];
    expect(call.updates.title).toBe("新标题");
    expect(call.updates.author).toBe("王律师");
    expect(call.outputName).toBe("contract-metadata.pdf");
  });

  test("关键词支持逗号分隔输入 → updates.keywords 数组", () => {
    const onConfirm = vi.fn();
    render(<PropertiesDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/关键词/), {
      target: { value: "新关键词1, 新关键词2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存元数据/ }));
    const call = onConfirm.mock.calls[0][0];
    expect(call.updates.keywords).toEqual(["新关键词1", "新关键词2"]);
  });

  test("点击取消 → onClose 不传 updates", () => {
    const onClose = vi.fn();
    render(<PropertiesDialog {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("输出名为空 → 阻止提交", () => {
    const onConfirm = vi.fn();
    render(<PropertiesDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/输出文件名/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /保存元数据/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/输出文件名不能为空/)).toBeTruthy();
  });

  test("metadata.creationDate 缺失 → 创建日期输入框为空字符串", () => {
    render(
      <PropertiesDialog
        {...baseProps}
        metadata={{ ...SAMPLE_METADATA, creationDate: undefined }}
      />,
    );
    expect((screen.getByLabelText(/创建日期/) as HTMLInputElement).value).toBe("");
  });
});
