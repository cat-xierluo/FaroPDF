import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App, { ActiveTabPageSync, PendingDetachRestore } from "./App";
import type { ReaderController } from "./modules/reader";
import type { NativePdfFile } from "./modules/reader/tauriPdfFileService";
import { TabProvider, useTabStore } from "./state/tabStore";
import type { ReactElement } from "react";

const appMocks = vi.hoisted(() => ({
  nativeMenuHandler: null as null | ((id: string) => void),
  openNativePdfFileDialog: vi.fn(async () => null as NativePdfFile | null),
  readPdfFileFromPath: vi.fn(async (_path: string) => null as NativePdfFile | null),
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
  readPdfFileFromPath: appMocks.readPdfFileFromPath,
}));

async function chooseTool(user: ReturnType<typeof userEvent.setup>, label: string | RegExp) {
  await user.click(screen.getByRole("button", { name: "工具" }));
  const menu = screen.getByRole("menu", { name: "PDF 工具菜单" });
  await user.click(within(menu).getByRole("menuitem", { name: label }));
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await chooseTool(user, "设置");
}

describe("FaroPDF app shell", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    appMocks.nativeMenuHandler = null;
    // mockReset 清掉实现 + 调用记录，置回默认（null 返回值）
    appMocks.openNativePdfFileDialog.mockReset();
    appMocks.openNativePdfFileDialog.mockResolvedValue(null as NativePdfFile | null);
    appMocks.readPdfFileFromPath.mockReset();
    appMocks.readPdfFileFromPath.mockResolvedValue(null as NativePdfFile | null);
    appMocks.subscribeNativeMenuCommands.mockClear();
    window.localStorage.clear();
  });

  test("routes native File > Open to the Tauri PDF picker service", async () => {
    render(<App />);

    await act(async () => {
      appMocks.nativeMenuHandler?.("file-open");
    });

    expect(appMocks.openNativePdfFileDialog).toHaveBeenCalledTimes(1);
  });

  test("renders a reading workspace as the first screen", () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "FaroPDF PDF 工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A 批注" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "填写和签名" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "扫描和文本识别" })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "打开 PDF 后管理页面" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "编辑工具条" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "文档摘要" })).not.toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "T 编辑" });
    expect(editButton).toBeDisabled();
    await user.click(editButton);
    expect(screen.queryByRole("toolbar", { name: "编辑工具条" })).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "页面管理工作台" })).toBeInTheDocument();
  });

  test("uses mode toolbars for export, signing, and OCR", async () => {
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

    await openSettings(user);

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

    await openSettings(user);
    const dialog = screen.getByRole("dialog", { name: "设置对话框" });
    await user.selectOptions(within(dialog).getByLabelText("外观"), "dark");

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.queryByRole("button", { name: "深色模式" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工具" })).toBeInTheDocument();
  });
});

// ISS-NEW-F 第 3 步（2026-06-24）步 2：ActiveTabPageSync 把 reader.currentPage 同步到 active tab.lastPage。
// 用最小 reader mock（只暴露 ActiveTabPageSync 实际读到的 state.document），通过重新
// 渲染驱动 effect 重跑（reader prop 引用变化 → effect 重新执行）。
describe("ActiveTabPageSync (ISS-NEW-F 第 3 步 第 2 块)", () => {
  function makeReader(document: ReaderController["state"]["document"]): ReaderController {
    return { state: { document } } as unknown as ReaderController;
  }

  function makeDoc(path: string, currentPage: number): ReaderController["state"]["document"] {
    return {
      path,
      name: path.split("/").pop() ?? path,
      pageCount: 10,
      currentPage,
      fingerprint: `fp-${path}`,
      documentId: `doc-${path}`,
    } as ReaderController["state"]["document"];
  }

  test("active tab 与 reader.document.path 一致 → currentPage 同步到 lastPage", async () => {
    let storeApi: ReturnType<typeof useTabStore> | null = null;
    function CaptureStore(): ReactElement {
      storeApi = useTabStore();
      return <></>;
    }

    const { rerender } = render(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(null)} />
      </TabProvider>,
    );
    expect(storeApi).not.toBeNull();

    // 开一个 tab，path 匹配后续 document.path
    act(() => {
      storeApi!.openTab("/case/a.pdf", "a.pdf");
    });
    const tabId = storeApi!.state.tabs[0]!.id;
    expect(storeApi!.state.tabs[0]!.lastPage).toBe(1);

    // 模拟 reader 加载文档（currentPage=5）
    rerender(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(makeDoc("/case/a.pdf", 5))} />
      </TabProvider>,
    );
    await waitFor(() => expect(storeApi!.state.tabs[0]!.lastPage).toBe(5));

    // currentPage 跳到 12
    rerender(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(makeDoc("/case/a.pdf", 12))} />
      </TabProvider>,
    );
    await waitFor(() => expect(storeApi!.state.tabs[0]!.lastPage).toBe(12));

    void tabId;
  });

  test("active tab 与 reader.document.path 不一致 → 不动 lastPage（避免 stale 同步）", async () => {
    let storeApi: ReturnType<typeof useTabStore> | null = null;
    function CaptureStore(): ReactElement {
      storeApi = useTabStore();
      return <></>;
    }

    const { rerender } = render(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(null)} />
      </TabProvider>,
    );

    act(() => {
      storeApi!.openTab("/case/a.pdf", "a.pdf");
    });
    expect(storeApi!.state.tabs[0]!.lastPage).toBe(1);

    // reader 加载了 b.pdf，但 active tab 是 a.pdf → 不应同步
    rerender(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(makeDoc("/case/b.pdf", 7))} />
      </TabProvider>,
    );
    // 等一拍确认没动
    await new Promise((r) => setTimeout(r, 50));
    expect(storeApi!.state.tabs[0]!.lastPage).toBe(1);
  });

  test("reader.document 为 null → 不动", async () => {
    let storeApi: ReturnType<typeof useTabStore> | null = null;
    function CaptureStore(): ReactElement {
      storeApi = useTabStore();
      return <></>;
    }

    render(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(null)} />
      </TabProvider>,
    );

    act(() => {
      storeApi!.openTab("/case/a.pdf", "a.pdf");
    });
    expect(storeApi!.state.tabs[0]!.lastPage).toBe(1);
    // 不抛错即可
    expect(storeApi!.state.tabs).toHaveLength(1);
  });

  test("currentPage 跳到与 lastPage 相同 → 不写回（避免循环 dispatch）", async () => {
    // 当前实现：effect 内 if (activeTab.lastPage !== document.currentPage) 才 dispatch。
    // 这里直接验证同步后 lastPage 是 currentPage；后续 reader.currentPage 不变时，
    // 即使 reader prop 引用变化，也不会触发 setLastPage（reducer 内值相同 → state 引用不变）。
    let storeApi: ReturnType<typeof useTabStore> | null = null;
    function CaptureStore(): ReactElement {
      storeApi = useTabStore();
      return <></>;
    }

    const { rerender } = render(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(makeDoc("/case/a.pdf", 7))} />
      </TabProvider>,
    );

    act(() => {
      storeApi!.openTab("/case/a.pdf", "a.pdf");
    });
    await waitFor(() => expect(storeApi!.state.tabs[0]!.lastPage).toBe(7));

    // 再次渲染时 document 引用变化但 currentPage 不变（lastPage 也是 7）
    // effect 重跑，activeTab.lastPage === document.currentPage → 不 dispatch。
    rerender(
      <TabProvider>
        <CaptureStore />
        <ActiveTabPageSync reader={makeReader(makeDoc("/case/a.pdf", 7))} />
      </TabProvider>,
    );
    // 等一拍确认没动（仍为 7）
    await new Promise((r) => setTimeout(r, 50));
    expect(storeApi!.state.tabs[0]!.lastPage).toBe(7);
  });
});

// ISS-NEW-F 第 3 步（2026-06-24）步 3：PendingDetachRestore 在新窗口 mount 时读
// localStorage `faropdf:pending-detach`，调用 readPdfFileFromPath + openNativeFile +
// setCurrentPage，然后清掉 key。
// 直接 mount PendingDetachRestore 而不是 <App />，避免 App 级其它 effect / useEffect 干扰。
describe("PendingDetachRestore (ISS-NEW-F 第 3 步 第 3 块)", () => {
  // 最小 reader mock：只暴露 PendingDetachRestore 实际用到的 setCurrentPage
  // (openNativeFile 走真正 mock 的 readPdfFileFromPath result)。
  function makeReader(): {
    reader: ReaderController;
    setCurrentPageSpy: ReturnType<typeof vi.fn>;
    openNativeFileSpy: ReturnType<typeof vi.fn>;
  } {
    const setCurrentPageSpy = vi.fn();
    const openNativeFileSpy = vi.fn(async () => undefined);
    const reader = {
      state: { document: null },
      setCurrentPage: setCurrentPageSpy,
      openNativeFile: openNativeFileSpy,
    } as unknown as ReaderController;
    return { reader, setCurrentPageSpy, openNativeFileSpy };
  }

  function RestoreHarness({ reader }: { reader: ReaderController }): ReactElement {
    return (
      <TabProvider>
        <PendingDetachRestore reader={reader} />
      </TabProvider>
    );
  }

  test("mount 时 localStorage 有有效 payload → 调 readPdfFileFromPath + setCurrentPage + 清 key", async () => {
    window.localStorage.setItem(
      "faropdf:pending-detach",
      JSON.stringify({
        filePath: "/case/detached.pdf",
        fileName: "detached.pdf",
        lastPage: 7,
      }),
    );
    appMocks.readPdfFileFromPath.mockResolvedValueOnce({
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      name: "detached.pdf",
      path: "/case/detached.pdf",
    });

    const { setCurrentPageSpy, openNativeFileSpy } = makeReader();
    const { reader } = { reader: makeReader().reader };
    void reader;
    const { setCurrentPageSpy: cur, openNativeFileSpy: open } = {
      setCurrentPageSpy,
      openNativeFileSpy,
    };

    // 用第一次创建的 reader 实例（openNativeFile / setCurrentPage 由 spies 拦截）
    const r = makeReader();
    render(<RestoreHarness reader={r.reader} />);

    await waitFor(() =>
      expect(appMocks.readPdfFileFromPath).toHaveBeenCalledWith("/case/detached.pdf"),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem("faropdf:pending-detach")).toBeNull(),
    );
    expect(r.openNativeFileSpy).toHaveBeenCalledTimes(1);
    expect(r.setCurrentPageSpy).toHaveBeenCalledWith(7);
    void cur;
    void open;
  });

  test("mount 时 localStorage 字段缺失或类型错 → 清掉 key，不调 readPdfFileFromPath", async () => {
    window.localStorage.setItem(
      "faropdf:pending-detach",
      JSON.stringify({ filePath: "/case/a.pdf" }), // 缺 fileName / lastPage
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { reader } = makeReader();
    render(<RestoreHarness reader={reader} />);

    await waitFor(() =>
      expect(window.localStorage.getItem("faropdf:pending-detach")).toBeNull(),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("mount 时 localStorage 是非法 JSON → 清掉 key", async () => {
    window.localStorage.setItem("faropdf:pending-detach", "{not-json");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { reader } = makeReader();
    render(<RestoreHarness reader={reader} />);

    await waitFor(() =>
      expect(window.localStorage.getItem("faropdf:pending-detach")).toBeNull(),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("mount 时 localStorage 无 key → 不报错", async () => {
    const { reader } = makeReader();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RestoreHarness reader={reader} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("readPdfFileFromPath 失败 → 仍清掉 key（避免下次启动误恢复）", async () => {
    window.localStorage.setItem(
      "faropdf:pending-detach",
      JSON.stringify({ filePath: "/case/a.pdf", fileName: "a.pdf", lastPage: 3 }),
    );
    appMocks.readPdfFileFromPath.mockRejectedValueOnce(new Error("file not found"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { reader } = makeReader();
    render(<RestoreHarness reader={reader} />);

    await waitFor(() =>
      expect(window.localStorage.getItem("faropdf:pending-detach")).toBeNull(),
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
