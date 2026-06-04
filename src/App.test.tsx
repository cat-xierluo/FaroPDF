import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import App from "./App";

describe("FaroPDF app shell", () => {
  test("renders a PDF Expert style reading workspace as the first screen", () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "FaroPDF PDF 工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "文档摘要" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "任务面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "全文搜索" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "打开 PDF 文档" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图片转成 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Word 转成 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "最近文件" })).toBeInTheDocument();
    expect(screen.getByText("文字层：未知")).toBeInTheDocument();
  });

  test("uses contextual toolbars and task workspaces instead of a permanent inspector", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "批注" }));

    expect(screen.getByRole("toolbar", { name: "批注工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "高亮" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "任务面板" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "页面管理" }));

    expect(screen.getByRole("main", { name: "页面管理工作台" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "页面管理空态" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "打开 PDF 后管理页面" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "页面管理工具条" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "另存为新 PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();
  });

  test("uses PDF Expert style mode toolbars for export, signing, and OCR", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "导出" }));
    expect(screen.getByRole("toolbar", { name: "导出工具条" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "格式转换" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "转成 Word" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "交付工具" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bates 编号" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "填写和签名" }));
    expect(screen.getByRole("toolbar", { name: "填写和签名工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "日期" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "钩号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出为压平" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OCR" }));
    expect(screen.getByRole("toolbar", { name: "OCR 工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "增强扫描" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拆分页面" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除空白边" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "识别文本" })).toBeInTheDocument();
  });

  test("opens view settings and app settings in the left utility area", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "视图设置" }));

    expect(screen.getByRole("complementary", { name: "视图设置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "连续" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "单页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "单页" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "双页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "双页" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "设置" }));

    // 设置浮层走 Portal 浮层，role="dialog" + aria-modal="true"；不再是侧栏 aside。
    const dialog = screen.getByRole("dialog", { name: "设置对话框" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "设置" })).toBeInTheDocument();

    // 默认进入「常规」section；切到 OCR provider 才能看到 OCR 控件。
    expect(within(dialog).queryByLabelText("默认 OCR 后端")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("tab", { name: "OCR provider" }));
    expect(within(dialog).getByLabelText("默认 OCR 后端")).toHaveValue("local-ocrmypdf");
    expect(within(dialog).getByText("联网 OCR 需要确认")).toBeInTheDocument();
  });
});
