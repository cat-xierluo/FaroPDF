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
    inputFilePath: "/case/contract.pdf",
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

describe("PropertiesDialog Producer 真覆盖 (ISS-072 阶段 2 后续 / DEC-136)", () => {
  const baseProps = {
    metadata: SAMPLE_METADATA,
    defaultFileName: "contract.pdf",
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  test("inputFilePath 缺失 → 不显示真覆盖按钮（浏览器拖拽场景）", () => {
    const onProducerOverride = vi.fn();
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath={null}
        onProducerOverride={onProducerOverride}
      />,
    );
    expect(screen.queryByTestId("props-producer-override")).toBeNull();
    expect(onProducerOverride).not.toHaveBeenCalled();
  });

  test("inputFilePath 有值 + 提供回调 → 显示按钮，点击调用回调并传入 FaroPDF", () => {
    const onProducerOverride = vi.fn();
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath="/case/contract.pdf"
        onProducerOverride={onProducerOverride}
      />,
    );
    const button = screen.getByTestId("props-producer-override");
    expect(button.textContent).toContain("用 FaroPDF 真覆盖 Producer");
    fireEvent.click(button);
    expect(onProducerOverride).toHaveBeenCalledTimes(1);
    expect(onProducerOverride).toHaveBeenCalledWith("FaroPDF");
  });

  test("producerOverrideInFlight=true → 按钮文本切换为「正在真覆盖...」并禁用", () => {
    const onProducerOverride = vi.fn();
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath="/case/contract.pdf"
        onProducerOverride={onProducerOverride}
        producerOverrideInFlight
      />,
    );
    const button = screen.getByTestId("props-producer-override") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("正在真覆盖");
  });

  test("producerOverrideMessage=error → 显示红色 alert 文本", () => {
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath="/case/contract.pdf"
        onProducerOverride={vi.fn()}
        producerOverrideMessage={{ type: "error", text: "文件不存在: contract.pdf" }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("文件不存在");
  });

  test("producerOverrideMessage=success → 显示 status 文本", () => {
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath="/case/contract.pdf"
        onProducerOverride={vi.fn()}
        producerOverrideMessage={{
          type: "success",
          text: "已真覆盖 Producer 为「FaroPDF」，另存为 /case/contract-metadata.pdf。",
        }}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("已真覆盖");
  });

  test("未提供 onProducerOverride 回调 + inputFilePath 有值 → 不显示按钮", () => {
    render(
      <PropertiesDialog
        {...baseProps}
        inputFilePath="/case/contract.pdf"
      />,
    );
    expect(screen.queryByTestId("props-producer-override")).toBeNull();
  });
});
