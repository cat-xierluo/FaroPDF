import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const appMocks = vi.hoisted(() => ({
  nativeMenuHandler: null as null | ((id: string) => void),
  openNativePdfFileDialog: vi.fn(async () => null),
  subscribeNativeMenuCommands: vi.fn(async (handler: (id: string) => void) => {
    appMocks.nativeMenuHandler = handler;
    return () => undefined;
  }),
}));

vi.mock("./shared/app/nativeMenuBridge", () => ({
  subscribeNativeMenuCommands: appMocks.subscribeNativeMenuCommands,
}));

vi.mock("./modules/reader/tauriPdfFileService", () => ({
  openNativePdfFileDialog: appMocks.openNativePdfFileDialog,
}));

async function chooseTool(user: ReturnType<typeof userEvent.setup>, label: string | RegExp) {
  await user.click(screen.getByRole("button", { name: "工具" }));
  const menu = screen.getByRole("menu", { name: "PDF 工具菜单" });
  await user.click(within(menu).getByRole("menuitem", { name: label }));
}

describe("FaroPDF app shell", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    appMocks.nativeMenuHandler = null;
    appMocks.openNativePdfFileDialog.mockClear();
    appMocks.subscribeNativeMenuCommands.mockClear();
  });

  test("routes native File > Open to the Tauri PDF picker service", async () => {
    render(<App />);

    await act(async () => {
      appMocks.nativeMenuHandler?.("file-open");
    });

    expect(appMocks.openNativePdfFileDialog).toHaveBeenCalledTimes(1);
  });

  test("renders a PDF Expert style reading workspace as the first screen", () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "FaroPDF PDF 工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批注" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "填写和签名" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OCR" })).not.toBeInTheDocument();
    // ISS-030：侧边栏默认关闭，未打开 PDF 时不显示空侧边栏
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "任务面板" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "全文搜索" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "打开 PDF 文档" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "图片转成 PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Word 转成 PDF" })).not.toBeInTheDocument();
    // ISS-034：无真实最近文件时"最近"区域不显示
    expect(screen.queryByRole("region", { name: "最近文件" })).not.toBeInTheDocument();
    expect(screen.getByText("文字层：未知")).toBeInTheDocument();
  });

  test("uses contextual toolbars and task workspaces instead of a permanent inspector", async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseTool(user, "批注");

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

    await chooseTool(user, "导出");
    const exportToolbar = screen.getByRole("toolbar", { name: "导出工具条" });
    expect(exportToolbar).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "交付工具" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "交付设置面板" })).toBeInTheDocument();
    expect(within(exportToolbar).getByRole("button", { name: "文字水印" })).toBeInTheDocument();
    expect(within(exportToolbar).getByRole("button", { name: "图片水印" })).toBeInTheDocument();
    expect(within(exportToolbar).queryByRole("button", { name: "Bates 编号" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "格式转换" })).not.toBeInTheDocument();

    await chooseTool(user, "填写和签名");
    const formsToolbar = screen.getByRole("toolbar", { name: "填写和签名工具条" });
    expect(formsToolbar).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("group", { name: "表单工具" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "读取字段" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "填写" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "签名" })).toBeInTheDocument();
    expect(within(formsToolbar).getByRole("button", { name: "扁平化导出" })).toBeInTheDocument();
    expect(within(formsToolbar).queryByRole("button", { name: "日期" })).not.toBeInTheDocument();
    expect(within(formsToolbar).queryByRole("button", { name: "钩号" })).not.toBeInTheDocument();

    await chooseTool(user, "OCR");
    // OCR 模式 context toolbar 挂 OcrModeToolbar 组件：识别文本 / 输出双层 PDF / 质量检查
    expect(screen.getByRole("toolbar", { name: "OCR 工具条" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "识别文本" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "输出双层 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "质量检查" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "任务列表" })).toBeInTheDocument();
    // OCR 工作区主区域：OcrJobList + OcrQualityReportView
    expect(screen.getByRole("main", { name: "OCR 工作区" })).toBeInTheDocument();
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
    expect(await within(dialog).findByLabelText("默认 OCR 后端")).toHaveValue("local-ocrmypdf");
    expect(await within(dialog).findByText("联网 OCR 需要确认")).toBeInTheDocument();
  });

  test("applies theme preference from settings without adding toolbar noise", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.queryByRole("button", { name: "深色模式" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "设置" }));
    const dialog = screen.getByRole("dialog", { name: "设置对话框" });
    await user.selectOptions(within(dialog).getByLabelText("外观"), "dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.queryByRole("button", { name: "深色模式" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
  });
});
