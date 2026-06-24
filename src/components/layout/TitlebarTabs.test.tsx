import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, type ReactElement } from "react";
import { TabProvider, useTabStore } from "../../state/tabStore";
import { TitlebarTabs } from "./TitlebarTabs";

// ISS-NEW-F 第 2 步：拖离触发 Tauri WebviewWindow.create() IPC；mock 掉 invoke 便于断言。
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => "faropdf-window-test"),
}));
import { invoke } from "@tauri-apps/api/core";
const invokeMock = invoke as unknown as ReturnType<typeof vi.fn>;

interface HarnessProps {
  onRequestNewTab: () => void;
  onAllTabsClosed?: () => void;
  initialFile?: { path: string; name: string };
}

/** 单一 Provider 包 OpenTabHarness + TitlebarTabs，共享 tabStore。 */
function Harness({
  onRequestNewTab,
  onAllTabsClosed,
  initialFile,
}: HarnessProps): ReactElement {
  return (
    <TabProvider>
      <>
        {initialFile ? (
          <OpenTabHarness filePath={initialFile.path} fileName={initialFile.name} />
        ) : null}
        <TitlebarTabs
          onRequestNewTab={onRequestNewTab}
          onAllTabsClosed={onAllTabsClosed}
        />
      </>
    </TabProvider>
  );
}

/** 挂载时立刻 openTab；用 ref 跟踪已开过的 filePath，避免关闭后重开。 */
function OpenTabHarness({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}): ReactElement {
  const store = useTabStore();
  const openedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      store.openTab(filePath, fileName);
    }
  }, [store, filePath, fileName]);
  return <></>;
}

const FILE_A = { path: "/case/a.pdf", name: "a.pdf" };

describe("TitlebarTabs (ISS-059 Phase 1)", () => {
  test("无 tab 时不渲染", () => {
    const { container } = render(<Harness onRequestNewTab={vi.fn()} />);
    expect(container.querySelector(".titlebar-tabs")).toBeNull();
  });

  test("有 tab 时渲染 tab 行 + 新建按钮", async () => {
    render(
      <Harness
        initialFile={FILE_A}
        onRequestNewTab={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText("a.pdf")).toBeTruthy());
    expect(screen.getByTestId("titlebar-tabs-add")).toBeTruthy();
  });

  test("点击 tab → 激活", async () => {
    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    await waitFor(() => screen.getByText("a.pdf"));
    const tab = screen.getByRole("tab");
    fireEvent.click(tab);
    expect(tab.getAttribute("data-active")).toBe("true");
  });

  test("点击 X 关闭按钮 → 移除 tab + 触发 onAllTabsClosed", async () => {
    const onAllTabsClosed = vi.fn();
    render(
      <Harness
        initialFile={FILE_A}
        onRequestNewTab={vi.fn()}
        onAllTabsClosed={onAllTabsClosed}
      />,
    );
    await waitFor(() => screen.getByText("a.pdf"));
    const tab = screen.getByRole("tab");
    const tabId = tab.getAttribute("data-testid")?.replace("titlebar-tab-", "");
    expect(tabId).toBeTruthy();
    const closeBtn = screen.getByTestId(`titlebar-tab-close-${tabId}`);
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    // 由于 TitlebarTabs 在 tabs.length === 0 时返回 null，waitFor 直接验证容器消失即可
    await waitFor(() => {
      expect(screen.queryByText("a.pdf")).toBeNull();
    });
    expect(onAllTabsClosed).toHaveBeenCalledTimes(1);
  });

  test("双击 tab → 进入 rename 模式 (input 出现)", async () => {
    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    await waitFor(() => screen.getByText("a.pdf"));
    const tab = screen.getByRole("tab");
    const tabId = tab.getAttribute("data-testid")?.replace("titlebar-tab-", "");
    fireEvent.doubleClick(tab);
    await waitFor(() =>
      expect(screen.getByTestId(`titlebar-tab-rename-${tabId}`)).toBeTruthy(),
    );
  });

  test("rename 输入 + Enter → 自定义标题生效", async () => {
    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    await waitFor(() => screen.getByText("a.pdf"));
    const tab = screen.getByRole("tab");
    const tabId = tab.getAttribute("data-testid")?.replace("titlebar-tab-", "");
    fireEvent.doubleClick(tab);
    const input = await waitFor(() =>
      screen.getByTestId(`titlebar-tab-rename-${tabId}`),
    );
    fireEvent.change(input, { target: { value: "合同副本" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("合同副本")).toBeTruthy());
  });

  test("rename 输入 + Esc → 取消不改标题", async () => {
    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    await waitFor(() => screen.getByText("a.pdf"));
    const tab = screen.getByRole("tab");
    const tabId = tab.getAttribute("data-testid")?.replace("titlebar-tab-", "");
    fireEvent.doubleClick(tab);
    const input = await waitFor(() =>
      screen.getByTestId(`titlebar-tab-rename-${tabId}`),
    );
    fireEvent.change(input, { target: { value: "草稿" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("a.pdf")).toBeTruthy();
    expect(screen.queryByText("草稿")).toBeNull();
  });
});

// ISS-NEW-F 第 3 步（2026-06-24）：dragend 拖到窗口外时把 tab.filePath / fileName / lastPage
// 写到 localStorage `faropdf:pending-detach`，并 invoke Rust `create_faropdf_window` 开新窗口。
describe("TitlebarTabs (ISS-NEW-F 第 3 步 dragend detach)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    invokeMock.mockClear();
    // 让 documentElement.getBoundingClientRect 返回 0..1280 x 0..720；
    // 同时 tab.getBoundingClientRect 返回 jsdom 默认 0,0,0,0。
    // 关键：dragend 的 clientX 落在 tab 自己的 rect.right + 100 = 100，
    // documentElement.rect.right = 1280 → isOutsideViewport = false（clientX 100 < 1280）。
    // 所以本测试改用「视口边缘 = 0」 + tab 拖到 clientX = -100（左侧外）模拟真实拖离。
    document.documentElement.getBoundingClientRect = vi.fn(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  test("dragend 拖到窗口外（左/右/上/下）→ 写 localStorage pending-detach + invoke 新窗口", async () => {
    render(
      <Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />,
    );
    const tab = await waitFor(() => screen.getByText("a.pdf"));

    // jsdom 的 DragEvent 合成时不一定传递 clientX/Y；用 createEvent.dragEnd 直接构造。
    const dragEnd = new Event("dragend", { bubbles: true }) as DragEvent;
    Object.defineProperty(dragEnd, "clientX", { value: -50 });
    Object.defineProperty(dragEnd, "clientY", { value: 0 });
    tab.dispatchEvent(dragEnd);

    await waitFor(() => {
      expect(window.localStorage.getItem("faropdf:pending-detach")).not.toBeNull();
    });
    const payload = JSON.parse(
      window.localStorage.getItem("faropdf:pending-detach") ?? "{}",
    );
    expect(payload.filePath).toBe(FILE_A.path);
    expect(payload.fileName).toBe(FILE_A.name);
    expect(typeof payload.lastPage).toBe("number");
    expect(payload.lastPage).toBe(1);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_faropdf_window"));
  });

  test("dragend 在窗口内 → 不写 localStorage 也不调 invoke", async () => {
    // 视口设为 0..1280
    document.documentElement.getBoundingClientRect = vi.fn(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 1280,
          bottom: 720,
          width: 1280,
          height: 720,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    const tab = await waitFor(() => screen.getByText("a.pdf"));

    const dragEnd = new Event("dragend", { bubbles: true }) as DragEvent;
    Object.defineProperty(dragEnd, "clientX", { value: 100 });
    Object.defineProperty(dragEnd, "clientY", { value: 100 });
    tab.dispatchEvent(dragEnd);
    await new Promise((r) => setTimeout(r, 30));
    expect(window.localStorage.getItem("faropdf:pending-detach")).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("dragend 外 + localStorage 写入抛错 → 不影响 invoke 调用", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Harness initialFile={FILE_A} onRequestNewTab={vi.fn()} />);
    const tab = await waitFor(() => screen.getByText("a.pdf"));

    const dragEnd = new Event("dragend", { bubbles: true }) as DragEvent;
    Object.defineProperty(dragEnd, "clientX", { value: -100 });
    Object.defineProperty(dragEnd, "clientY", { value: 0 });
    tab.dispatchEvent(dragEnd);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_faropdf_window"));
    expect(errorSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
    errorSpy.mockRestore();
  });
});