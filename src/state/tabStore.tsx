/**
 * ISS-059 Phase 1：多 Tab bar 状态管理
 *
 * PDF Expert 风格：单窗口可开多个 PDF，顶部 tab bar 切换。当前打开/关闭/重命名/排序
 * 不持久化（关闭应用即清空），与 PDF Expert 行为一致。
 *
 * 设计取舍：
 * - 用 React Context + useReducer，不引 zustand 等新依赖（CLAUDE.md 不允许散弹新依赖）
 * - Tab 状态由 TabProvider 提供，AppShell 包在最外层
 * - ReaderController（useReaderController）实例继续 per-PDF 持有（每个 tab 一份），
 *   不与本 store 耦合，避免循环引用
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export interface PdfTab {
  /** 唯一 id（用 filePath 哈希 + 时间戳） */
  id: string;
  /** 文件名（默认 filePath basename） */
  title: string;
  /** 完整文件路径（Tauri 打开时有，浏览器拖拽时为空） */
  filePath: string;
  /** tab 自定义名（用户在 PDF Expert 同款 inline rename 改的） */
  customTitle: string | null;
  /** 自打开后是否被修改（尚未实现 dirty 检测，先预留接口） */
  isDirty: boolean;
  /** ISS-NEW-F 第 3 步（2026-06-24）：上次阅读页码（用于跨窗口 detach 恢复）。默认 1。 */
  lastPage: number;
}

interface TabState {
  tabs: PdfTab[];
  activeTabId: string | null;
}

type TabAction =
  | { type: "OPEN_TAB"; payload: { filePath: string; fileName: string } }
  | { type: "ACTIVATE_TAB"; payload: { tabId: string } }
  | { type: "CLOSE_TAB"; payload: { tabId: string } }
  | { type: "CLOSE_OTHER_TABS"; payload: { tabId: string } }
  | { type: "CLOSE_ALL_TABS" }
  | { type: "RENAME_TAB"; payload: { tabId: string; customTitle: string } }
  | { type: "MARK_DIRTY"; payload: { tabId: string; isDirty: boolean } }
  | { type: "REORDER_TABS"; payload: { fromIndex: number; toIndex: number } }
  | { type: "SET_LAST_PAGE"; payload: { tabId: string; lastPage: number } };

function generateTabId(filePath: string, fileName: string): string {
  // 用 filePath + fileName + 时间戳生成。同一文件重复打开会开多个 tab（与 PDF Expert 一致）
  return `${fileName}::${filePath}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`;
}

function reducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case "OPEN_TAB": {
      const id = generateTabId(action.payload.filePath, action.payload.fileName);
      return {
        tabs: [
          ...state.tabs,
          {
            id,
            title: action.payload.fileName,
            filePath: action.payload.filePath,
            customTitle: null,
            isDirty: false,
            lastPage: 1,
          },
        ],
        activeTabId: id,
      };
    }
    case "ACTIVATE_TAB": {
      if (!state.tabs.some((t) => t.id === action.payload.tabId)) {
        return state;
      }
      return { ...state, activeTabId: action.payload.tabId };
    }
    case "CLOSE_TAB": {
      const index = state.tabs.findIndex((t) => t.id === action.payload.tabId);
      if (index < 0) {
        return state;
      }
      const tabs = state.tabs.filter((t) => t.id !== action.payload.tabId);
      let activeTabId = state.activeTabId;
      if (state.activeTabId === action.payload.tabId) {
        // 关闭当前 tab → 激活相邻 tab（左侧优先，与 PDF Expert 一致）
        if (tabs.length === 0) {
          activeTabId = null;
        } else {
          const nextIndex = Math.min(index, tabs.length - 1);
          activeTabId = tabs[nextIndex].id;
        }
      }
      return { tabs, activeTabId };
    }
    case "CLOSE_OTHER_TABS": {
      const tabs = state.tabs.filter((t) => t.id === action.payload.tabId);
      return { tabs, activeTabId: tabs.length > 0 ? action.payload.tabId : null };
    }
    case "CLOSE_ALL_TABS":
      return { tabs: [], activeTabId: null };
    case "RENAME_TAB": {
      const trimmed = action.payload.customTitle.trim();
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId
            ? { ...t, customTitle: trimmed === "" ? null : trimmed }
            : t,
        ),
      };
    }
    case "MARK_DIRTY":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId ? { ...t, isDirty: action.payload.isDirty } : t,
        ),
      };
    case "REORDER_TABS": {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.tabs.length ||
        toIndex < 0 ||
        toIndex >= state.tabs.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { ...state, tabs };
    }
    case "SET_LAST_PAGE": {
      // ISS-NEW-F 第 3 步：仅接受正整数；非法输入视为 no-op（不抛错，
      // 避免 reader.currentPage 抖动导致 reducer 抛错）。
      const { tabId, lastPage } = action.payload;
      if (!Number.isInteger(lastPage) || lastPage < 1) {
        return state;
      }
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, lastPage } : t)),
      };
    }
    default:
      return state;
  }
}

const initialState: TabState = { tabs: [], activeTabId: null };

export interface TabStore {
  state: TabState;
  openTab: (filePath: string, fileName: string) => string;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  renameTab: (tabId: string, customTitle: string) => void;
  markDirty: (tabId: string, isDirty: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setLastPage: (tabId: string, lastPage: number) => void;
}

const TabStoreContext = createContext<TabStore | null>(null);

export function TabProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openTab = useCallback((filePath: string, fileName: string): string => {
    const id = generateTabId(filePath, fileName);
    dispatch({ type: "OPEN_TAB", payload: { filePath, fileName } });
    return id;
  }, []);
  const activateTab = useCallback((tabId: string) => {
    dispatch({ type: "ACTIVATE_TAB", payload: { tabId } });
  }, []);
  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: "CLOSE_TAB", payload: { tabId } });
  }, []);
  const closeOtherTabs = useCallback((tabId: string) => {
    dispatch({ type: "CLOSE_OTHER_TABS", payload: { tabId } });
  }, []);
  const closeAllTabs = useCallback(() => {
    dispatch({ type: "CLOSE_ALL_TABS" });
  }, []);
  const renameTab = useCallback((tabId: string, customTitle: string) => {
    dispatch({ type: "RENAME_TAB", payload: { tabId, customTitle } });
  }, []);
  const markDirty = useCallback((tabId: string, isDirty: boolean) => {
    dispatch({ type: "MARK_DIRTY", payload: { tabId, isDirty } });
  }, []);
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: "REORDER_TABS", payload: { fromIndex, toIndex } });
  }, []);
  const setLastPage = useCallback((tabId: string, lastPage: number) => {
    dispatch({ type: "SET_LAST_PAGE", payload: { tabId, lastPage } });
  }, []);

  const value = useMemo<TabStore>(
    () => ({
      state,
      openTab,
      activateTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs,
      renameTab,
      markDirty,
      reorderTabs,
      setLastPage,
    }),
    [
      state,
      openTab,
      activateTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs,
      renameTab,
      markDirty,
      reorderTabs,
      setLastPage,
    ],
  );

  return <TabStoreContext.Provider value={value}>{children}</TabStoreContext.Provider>;
}

export function useTabStore(): TabStore {
  const store = useContext(TabStoreContext);
  if (!store) {
    throw new Error("useTabStore must be used inside TabProvider");
  }
  return store;
}