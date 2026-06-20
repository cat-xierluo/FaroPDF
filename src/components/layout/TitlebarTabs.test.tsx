import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef, type ReactElement } from "react";
import { TabProvider, useTabStore } from "../../state/tabStore";
import { TitlebarTabs } from "./TitlebarTabs";

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