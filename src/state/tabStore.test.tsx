import { describe, expect, test } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { type ReactElement, type ReactNode } from "react";
import { TabProvider, useTabStore } from "./tabStore";

interface WrapperProps {
  children?: ReactNode;
}

function Wrapper({ children }: WrapperProps): ReactNode {
  return <TabProvider>{children}</TabProvider>;
}

// renderHook 调用 wrapper 时传入 { children?: ReactNode }（测试框架定义），用 ReactNode 兼容
function wrapper({ children }: { children?: ReactNode }): ReactElement {
  return (
    <Wrapper>
      <>{children}</>
    </Wrapper>
  );
}

describe("tabStore (ISS-059 Phase 1)", () => {
  test("初始状态为空 tab 列表 + null activeTabId", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    expect(result.current.state.tabs).toEqual([]);
    expect(result.current.state.activeTabId).toBeNull();
  });

  test("openTab → 添加 tab + 设为 active", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.tabs[0].title).toBe("a.pdf");
    expect(result.current.state.tabs[0].filePath).toBe("/case/a.pdf");
    expect(result.current.state.tabs[0].customTitle).toBeNull();
    expect(result.current.state.tabs[0].isDirty).toBe(false);
    expect(result.current.state.tabs[0].lastPage).toBe(1);
    expect(result.current.state.activeTabId).toBe(result.current.state.tabs[0].id);
  });

  test("openTab 同一文件路径开 2 次 → 产生 2 个 tab", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    expect(result.current.state.tabs).toHaveLength(2);
  });

  test("activateTab → 切换 active 不改 tab 列表", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
    });
    const firstId = result.current.state.tabs[0].id;
    const secondId = result.current.state.tabs[1].id;
    expect(result.current.state.activeTabId).toBe(secondId);
    act(() => {
      result.current.activateTab(firstId);
    });
    expect(result.current.state.activeTabId).toBe(firstId);
    expect(result.current.state.tabs).toHaveLength(2);
  });

  test("closeTab 当前 tab → 自动激活左侧 tab", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
      result.current.openTab("/case/c.pdf", "c.pdf");
    });
    const aId = result.current.state.tabs[0].id;
    const bId = result.current.state.tabs[1].id;
    const cId = result.current.state.tabs[2].id;
    expect(result.current.state.activeTabId).toBe(cId);

    act(() => {
      result.current.closeTab(cId);
    });
    expect(result.current.state.tabs).toHaveLength(2);
    expect(result.current.state.activeTabId).toBe(bId);

    act(() => {
      result.current.closeTab(bId);
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.activeTabId).toBe(aId);
  });

  test("closeTab 非当前 tab → 不影响 activeTabId", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
    });
    const aId = result.current.state.tabs[0].id;
    const bId = result.current.state.tabs[1].id;
    expect(result.current.state.activeTabId).toBe(bId);

    act(() => {
      result.current.closeTab(aId);
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.activeTabId).toBe(bId);
  });

  test("closeTab 最后一个 tab → activeTabId 变 null", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    const aId = result.current.state.tabs[0].id;
    act(() => {
      result.current.closeTab(aId);
    });
    expect(result.current.state.activeTabId).toBeNull();
  });

  test("closeOtherTabs → 保留当前 tab + 关闭其他", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
      result.current.openTab("/case/c.pdf", "c.pdf");
    });
    const bId = result.current.state.tabs[1].id;
    act(() => {
      result.current.closeOtherTabs(bId);
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.activeTabId).toBe(bId);
    expect(result.current.state.tabs[0].filePath).toBe("/case/b.pdf");
  });

  test("closeAllTabs → 清空", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
      result.current.closeAllTabs();
    });
    expect(result.current.state.tabs).toEqual([]);
    expect(result.current.state.activeTabId).toBeNull();
  });

  test("renameTab → customTitle 设置 + 空字符串清除回 null", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    const id = result.current.state.tabs[0].id;
    act(() => {
      result.current.renameTab(id, "合同副本");
    });
    expect(result.current.state.tabs[0].customTitle).toBe("合同副本");
    act(() => {
      result.current.renameTab(id, "   ");
    });
    expect(result.current.state.tabs[0].customTitle).toBeNull();
  });

  test("markDirty → 切换 isDirty 标志", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    const id = result.current.state.tabs[0].id;
    act(() => {
      result.current.markDirty(id, true);
    });
    expect(result.current.state.tabs[0].isDirty).toBe(true);
  });

  test("reorderTabs → 拖动重排", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
      result.current.openTab("/case/c.pdf", "c.pdf");
    });
    act(() => {
      result.current.reorderTabs(0, 2);
    });
    expect(result.current.state.tabs.map((t) => t.filePath)).toEqual([
      "/case/b.pdf",
      "/case/c.pdf",
      "/case/a.pdf",
    ]);
  });

  test("reorderTabs 越界 → 不动", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
    });
    const original = result.current.state.tabs.map((t) => t.filePath);
    act(() => {
      result.current.reorderTabs(0, 5);
    });
    expect(result.current.state.tabs.map((t) => t.filePath)).toEqual(original);
  });

  // ISS-NEW-F 第 3 步（2026-06-24）：tab.lastPage 字段，用于跨窗口 detach 恢复。
  test("setLastPage 正整数 → 更新 lastPage", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    const id = result.current.state.tabs[0].id;
    act(() => {
      result.current.setLastPage(id, 7);
    });
    expect(result.current.state.tabs[0].lastPage).toBe(7);
  });

  test("setLastPage 非法输入（非整数 / < 1 / 0） → 不动", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    const id = result.current.state.tabs[0].id;
    act(() => {
      result.current.setLastPage(id, 5); // 设为 5
    });
    expect(result.current.state.tabs[0].lastPage).toBe(5);
    act(() => {
      result.current.setLastPage(id, 0); // 0 → no-op
    });
    expect(result.current.state.tabs[0].lastPage).toBe(5);
    act(() => {
      result.current.setLastPage(id, -1); // -1 → no-op
    });
    expect(result.current.state.tabs[0].lastPage).toBe(5);
    act(() => {
      result.current.setLastPage(id, 1.5); // 浮点 → no-op
    });
    expect(result.current.state.tabs[0].lastPage).toBe(5);
  });

  test("setLastPage 未知 tabId → 不动", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
    });
    act(() => {
      result.current.setLastPage("non-existent-tab-id", 99);
    });
    expect(result.current.state.tabs[0].lastPage).toBe(1);
  });

  test("setLastPage 只影响指定 tab，其他 tab 的 lastPage 不变", () => {
    const { result } = renderHook(() => useTabStore(), { wrapper });
    act(() => {
      result.current.openTab("/case/a.pdf", "a.pdf");
      result.current.openTab("/case/b.pdf", "b.pdf");
    });
    const aId = result.current.state.tabs[0].id;
    const bId = result.current.state.tabs[1].id;
    act(() => {
      result.current.setLastPage(aId, 12);
    });
    expect(result.current.state.tabs[0].lastPage).toBe(12);
    expect(result.current.state.tabs[1].lastPage).toBe(1);
    // 切换 active tab 后 setLastPage(b) 也只影响 b
    act(() => {
      result.current.setLastPage(bId, 3);
    });
    expect(result.current.state.tabs[0].lastPage).toBe(12);
    expect(result.current.state.tabs[1].lastPage).toBe(3);
  });
});