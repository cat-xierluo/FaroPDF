import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Download, FileCheck2, FormInput, PenLine, RefreshCw } from "lucide-react";
import type { ComponentType } from "react";
import {
  _resetToolbarRegistry,
  getModeTools,
  type ToolbarState,
} from "../../components/layout/toolbarRegistry";
import type { AppModeId } from "../../components/layout/types";
import type { ReaderController } from "../reader";
import type { TextSearchController } from "../search";
import type { FormController } from "./useFormController";
import { setActiveFormController } from "./activeFormController";
import { registerFormsToolbarTools } from "./registerFormsToolbarTools";

const stubReader = {} as ReaderController;
const stubSearch = {} as TextSearchController;

function makeState(overrides: Partial<{ activeMode: AppModeId; hasDocument: boolean }> = {}): ToolbarState {
  return {
    activeMode: overrides.activeMode ?? "forms",
    reader: {
      ...stubReader,
      state: {
        document: overrides.hasDocument === false ? null : { documentId: "doc-1" } as never,
      },
    } as ReaderController,
    search: stubSearch,
  };
}

function makeStubController(overrides: Partial<FormController> = {}): FormController {
  return {
    refreshFormState: vi.fn(),
    openPanel: vi.fn(),
    flattenAndSave: vi.fn(),
    ...overrides,
  } as unknown as FormController;
}

describe("registerFormsToolbarTools", () => {
  beforeEach(() => {
    _resetToolbarRegistry();
    setActiveFormController(null);
  });

  afterEach(() => {
    _resetToolbarRegistry();
    setActiveFormController(null);
  });

  test("注册 4 个 forms mode 工具到 toolbarRegistry", () => {
    const items = registerFormsToolbarTools();
    expect(items).toHaveLength(4);
    const ids = items.map((item) => item.id);
    expect(ids).toEqual(["forms.refresh", "forms.fill", "forms.signature", "forms.flatten"]);

    const registered = getModeTools("forms");
    expect(registered).toHaveLength(4);
  });

  test("所有 items 的 modeId 都是 forms", () => {
    const items = registerFormsToolbarTools();
    for (const item of items) {
      expect(item.modeId).toBe("forms");
    }
  });

  test("所有 items 都依赖 reader.state.document（无文档时禁用）", () => {
    const items = registerFormsToolbarTools();
    for (const item of items) {
      const enabled = !item.isDisabled?.(makeState({ hasDocument: true }));
      const disabled = !item.isDisabled?.(makeState({ hasDocument: false }));
      expect(enabled).toBe(true);
      expect(disabled).toBe(false);
    }
  });

  test("icon 是 lucide 组件", () => {
    const items = registerFormsToolbarTools();
    expect(items[0].icon).toBe(RefreshCw);
    expect(items[1].icon).toBe(FormInput);
    expect(items[2].icon).toBe(PenLine);
    expect(items[3].icon).toBe(FileCheck2);
  });

  test("onClick 通过 activeFormController 桥调对应方法", () => {
    const controller = makeStubController();
    setActiveFormController(controller);

    const items = registerFormsToolbarTools();

    items[0].onClick(makeState());
    items[1].onClick(makeState());
    items[2].onClick(makeState());
    items[3].onClick(makeState());

    expect(controller.refreshFormState).toHaveBeenCalledTimes(1);
    expect(controller.openPanel).toHaveBeenCalledWith("fill");
    expect(controller.openPanel).toHaveBeenCalledWith("sign");
    expect(controller.flattenAndSave).toHaveBeenCalledTimes(1);
  });

  test("无活跃 controller 时 onClick 是 noop（不抛错）", () => {
    const items = registerFormsToolbarTools();
    expect(() => items[0].onClick(makeState())).not.toThrow();
    expect(() => items[3].onClick(makeState())).not.toThrow();
  });

  test("isActive 在 activeMode === 'forms' 时返回 true", () => {
    const items = registerFormsToolbarTools();
    for (const item of items) {
      expect(item.isActive(makeState({ activeMode: "forms" }))).toBe(true);
      expect(item.isActive(makeState({ activeMode: "read" }))).toBe(false);
    }
  });

  test("order 字段递增（渲染顺序）", () => {
    const items = registerFormsToolbarTools();
    const orders = items.map((item) => item.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe("Download icon 引用健在", () => {
  test("lucide-react Download 是 ComponentType", () => {
    // 简单的烟雾测试：防止 lucide-react 升级破坏 icon import
    const component: ComponentType<{ size?: number }> = Download as unknown as ComponentType<{ size?: number }>;
    expect(component).toBeDefined();
  });
});
