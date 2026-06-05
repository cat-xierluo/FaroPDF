import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormsPanel } from "./FormsPanel";
import type { FormController } from "../useFormController";
import type { PdfFormState } from "../../../shared/pdf/form";
import {
  FORMS_PANEL_NARROW_BREAKPOINT,
  FORMS_PANEL_DRAWER_BREAKPOINT,
  formsPanelNarrowMediaQuery,
  formsPanelDrawerMediaQuery,
} from "../breakpoints";

/**
 * 创建可控的 matchMedia mock：
 * - 初始 matches 由 `initialMatches` 决定；
 * - 调用 setMatches(true|false) 同步触发已注册的 change 监听器。
 * jsdom 不实现 matchMedia，src/test/setup.ts 提供默认 stub；
 * 本测试为窄屏布局验证覆盖 4 个视口档位（360 / 480 / 768 / 1024）。
 */
function createMatchMediaMock(initialMatches: boolean) {
  const listeners = new Set<(event: { matches: boolean; media: string }) => void>();
  const media = formsPanelNarrowMediaQuery();
  const matchMedia = vi.fn((query: string) => ({
    matches: initialMatches,
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: (event: { matches: boolean; media: string }) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: { matches: boolean; media: string }) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: { matches: boolean; media: string }) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: { matches: boolean; media: string }) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  }));
  return {
    matchMedia,
    media,
    setMatches(next: boolean) {
      for (const listener of listeners) {
        listener({ matches: next, media });
      }
    },
  };
}

function makeStubController(overrides: Partial<FormController> = {}): FormController {
  return {
    formState: null,
    loading: false,
    errorMessage: null,
    successMessage: null,
    panelMode: "none",
    selectedFieldId: null,
    draftValue: "",
    signatureImageBytes: null,
    signatureImageType: null,
    refreshFormState: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    selectField: vi.fn(),
    setDraftValue: vi.fn(),
    setSignatureImage: vi.fn(),
    clearSignatureImage: vi.fn(),
    applyFieldEdit: vi.fn(),
    applySignature: vi.fn(),
    applyBatchAndSave: vi.fn(),
    flattenAndSave: vi.fn(),
    setErrorMessage: vi.fn(),
    clearMessages: vi.fn(),
    ...overrides,
  } as FormController;
}

const SAMPLE_FORM_STATE: PdfFormState = {
  fields: [
    {
      id: "name",
      name: "name",
      type: "text",
      pageIndex: 0,
      value: "",
      defaultValue: "",
      required: true,
      readOnly: false,
      choices: [],
      rect: { x: 0, y: 0, width: 100, height: 20 },
    },
    {
      id: "agree",
      name: "agree",
      type: "checkbox",
      pageIndex: 0,
      value: "true",
      defaultValue: "false",
      required: false,
      readOnly: false,
      choices: [],
      rect: { x: 0, y: 0, width: 16, height: 16 },
    },
  ],
  fieldCount: 2,
  fillable: true,
};

describe("FormsPanel", () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:stub");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  test("渲染头部标题和初始空态", () => {
    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    expect(screen.getByRole("heading", { name: "填写和签名" })).toBeInTheDocument();
    expect(screen.getByText(/尚未读取表单字段/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "读取表单字段" })).toBeInTheDocument();
  });

  test("关闭按钮调 controller.closePanel", async () => {
    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    await userEvent.click(screen.getByRole("button", { name: "关闭填写和签名面板" }));
    expect(controller.closePanel).toHaveBeenCalledTimes(1);
  });

  test("读取按钮显示 loading 文本", () => {
    const controller = makeStubController({ loading: true });
    render(<FormsPanel controller={controller} />);

    expect(screen.getByRole("button", { name: "处理中..." })).toBeDisabled();
  });

  test("errorMessage 显示在错误条上", () => {
    const controller = makeStubController({ errorMessage: "字段不存在" });
    render(<FormsPanel controller={controller} />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("字段不存在")).toBeInTheDocument();
  });

  test("successMessage 显示在成功条上", () => {
    const controller = makeStubController({ successMessage: "已应用 2 条操作" });
    render(<FormsPanel controller={controller} />);

    const status = screen.getByRole("status");
    expect(within(status).getByText("已应用 2 条操作")).toBeInTheDocument();
  });

  test("知道了按钮调 controller.clearMessages", async () => {
    const controller = makeStubController({ errorMessage: "x" });
    render(<FormsPanel controller={controller} />);

    await userEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(controller.clearMessages).toHaveBeenCalledTimes(1);
  });

  test("读取表单字段按钮调 controller.refreshFormState", async () => {
    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    await userEvent.click(screen.getByRole("button", { name: "读取表单字段" }));
    expect(controller.refreshFormState).toHaveBeenCalledTimes(1);
  });

  test("扁平化导出按钮调 controller.flattenAndSave", async () => {
    const controller = makeStubController({ formState: SAMPLE_FORM_STATE });
    render(<FormsPanel controller={controller} />);

    await userEvent.click(screen.getByRole("button", { name: "扁平化导出" }));
    expect(controller.flattenAndSave).toHaveBeenCalledTimes(1);
  });

  test("无字段时扁平化按钮被禁用", () => {
    const controller = makeStubController({
      formState: { fields: [], fieldCount: 0, fillable: false },
    });
    render(<FormsPanel controller={controller} />);

    expect(screen.getByRole("button", { name: "扁平化导出" })).toBeDisabled();
  });

  test("字段列表按类型分组并显示", () => {
    const controller = makeStubController({ formState: SAMPLE_FORM_STATE });
    render(<FormsPanel controller={controller} />);

    const list = screen.getByRole("list", { name: "表单字段列表" });
    expect(within(list).getByRole("heading", { name: /文本/ })).toBeInTheDocument();
    expect(within(list).getByRole("heading", { name: /复选框/ })).toBeInTheDocument();
    expect(within(list).getByText("name")).toBeInTheDocument();
    expect(within(list).getByText("agree")).toBeInTheDocument();
  });

  test("选中字段高亮并调 controller.selectField", async () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      selectedFieldId: "name",
    });
    render(<FormsPanel controller={controller} />);

    const nameButton = screen.getByRole("button", { name: /name/ });
    expect(nameButton).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /agree/ }));
    expect(controller.selectField).toHaveBeenCalledWith("agree");
  });

  test("fill 模式下显示填值编辑器，applyFieldEdit 调 applyFieldEdit", async () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "fill",
      selectedFieldId: "name",
      draftValue: "Alice",
    });
    render(<FormsPanel controller={controller} />);

    const editor = screen.getByRole("region", { name: "填值编辑器" });
    expect(within(editor).getByRole("heading", { name: /name/ })).toBeInTheDocument();
    const input = within(editor).getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("Alice");

    await userEvent.click(within(editor).getByRole("button", { name: "应用到字段并导出" }));
    expect(controller.applyFieldEdit).toHaveBeenCalledTimes(1);
  });

  test("fill 模式下 input 修改调 controller.setDraftValue", () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "fill",
      selectedFieldId: "name",
      draftValue: "Alice",
    });
    render(<FormsPanel controller={controller} />);

    const editor = screen.getByRole("region", { name: "填值编辑器" });
    const input = within(editor).getByRole("textbox") as HTMLInputElement;
    // 受控 input 模式下用 fireEvent.change 直接派发 change 事件
    fireEvent.change(input, { target: { value: "Bob" } });
    expect(controller.setDraftValue).toHaveBeenCalledWith("Bob");
  });

  test("sign 模式下显示签名编辑器，apply 按钮在无图片时禁用", () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "sign",
      selectedFieldId: "name",
    });
    render(<FormsPanel controller={controller} />);

    const editor = screen.getByRole("region", { name: "签名编辑器" });
    expect(within(editor).getByRole("button", { name: "选择签名图片" })).toBeInTheDocument();
    expect(within(editor).getByText("未选择")).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "嵌入签名并导出" })).toBeDisabled();
  });

  test("sign 模式下选好签名图片后 apply 按钮启用", () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "sign",
      selectedFieldId: "name",
      signatureImageBytes: new Uint8Array([1, 2, 3]),
      signatureImageType: "png",
    });
    render(<FormsPanel controller={controller} />);

    const editor = screen.getByRole("region", { name: "签名编辑器" });
    expect(within(editor).getByText(/PNG · 3 bytes/)).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "嵌入签名并导出" })).not.toBeDisabled();
  });

  test("fill 模式下只读字段应用按钮被禁用且显示提示", () => {
    const readOnlyState: PdfFormState = {
      ...SAMPLE_FORM_STATE,
      fields: [
        {
          ...SAMPLE_FORM_STATE.fields[0]!,
          readOnly: true,
        },
      ],
      fieldCount: 1,
    };
    const controller = makeStubController({
      formState: readOnlyState,
      panelMode: "fill",
      selectedFieldId: "name",
      draftValue: "x",
    });
    render(<FormsPanel controller={controller} />);

    const editor = screen.getByRole("region", { name: "填值编辑器" });
    expect(within(editor).getByRole("button", { name: "应用到字段并导出" })).toBeDisabled();
    expect(within(editor).getByText(/此字段为只读/)).toBeInTheDocument();
  });
});

/**
 * 窄屏视口适配（ISS-008 / DEC-055）：
 * FormsPanel 浮层在 < FORMS_PANEL_NARROW_BREAKPOINT (480px) 视口下应切到
 * `data-layout="bottom-sheet"`，避免与主工具栏（56px）+ 上下文工具条（42px）重叠；
 * 桌面视口（>= 480px）保持 `data-layout="floating"` 浮层。
 *
 * 测试覆盖 4 个视口档位：
 * - 360px（典型手机竖屏）
 * - 480px（断点；jsdom 不实现真视口，按 media query 命中与否判断）
 * - 768px（平板竖屏）
 * - 1024px（桌面 / 平板横屏）
 *
 * jsdom 不响应 CSS 媒体查询，因此用 matchMedia mock 直接控制 isNarrow 状态；
 * 验证手段是 React 输出侧的 data-layout 属性。
 */
describe("FormsPanel 窄屏适配", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
    // jsdom 视口默认 1024，固定为 1024 让浮层分支为基线
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024, writable: true });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth, writable: true });
  });

  test("breakpoint 常量对齐：FORMS_PANEL_NARROW_BREAKPOINT === 480", () => {
    expect(FORMS_PANEL_NARROW_BREAKPOINT).toBe(480);
    expect(formsPanelNarrowMediaQuery()).toBe("(max-width: 479px)");
  });

  test("桌面视口（>= 480px）默认 data-layout='floating'", () => {
    const mock = createMatchMediaMock(false);
    window.matchMedia = mock.matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    const panel = screen.getByTestId("forms-panel");
    expect(panel).toHaveAttribute("data-layout", "floating");
  });

  test("360px 视口（典型手机）切换为 data-layout='bottom-sheet'", () => {
    const mock = createMatchMediaMock(true);
    window.matchMedia = mock.matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    const panel = screen.getByTestId("forms-panel");
    expect(panel).toHaveAttribute("data-layout", "bottom-sheet");
  });

  test("窗口缩放跨过 480px 断点：data-layout 在 media change 后切换", () => {
    const mock = createMatchMediaMock(false);
    window.matchMedia = mock.matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    const panel = screen.getByTestId("forms-panel");
    expect(panel).toHaveAttribute("data-layout", "floating");

    // 模拟从桌面缩到手机：matchMedia 触发 change
    act(() => {
      mock.setMatches(true);
    });
    expect(panel).toHaveAttribute("data-layout", "bottom-sheet");

    // 模拟从手机放回桌面
    act(() => {
      mock.setMatches(false);
    });
    expect(panel).toHaveAttribute("data-layout", "floating");
  });

  test("480px 视口（断点边界）保持 data-layout='floating'（>= 480 视为桌面）", () => {
    const mock = createMatchMediaMock(false);
    window.matchMedia = mock.matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 480, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} />);

    const panel = screen.getByTestId("forms-panel");
    expect(panel).toHaveAttribute("data-layout", "floating");
  });

  test("窄屏布局下 field 列表与编辑器仍可正常渲染（不破坏内容）", () => {
    const mock = createMatchMediaMock(true);
    window.matchMedia = mock.matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360, writable: true });

    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "fill",
      selectedFieldId: "name",
      draftValue: "Alice",
    });
    render(<FormsPanel controller={controller} />);

    const panel = screen.getByTestId("forms-panel");
    expect(panel).toHaveAttribute("data-layout", "bottom-sheet");
    // 字段列表 + 填值编辑器照常可见
    expect(screen.getByRole("list", { name: "表单字段列表" })).toBeInTheDocument();
    const editor = screen.getByRole("region", { name: "填值编辑器" });
    expect(within(editor).getByRole("textbox")).toHaveValue("Alice");
  });
});

/**
 * ISS-008 utility panel 路径测试：
 * - layoutMode="utility-panel" 时强制 utility-panel 布局
 * - layoutMode="drawer" 时强制 drawer 布局
 * - auto 模式下：480-720px 切 drawer，>= 720px 切 floating
 * - utility-panel 模式不阻塞首屏渲染
 */
describe("FormsPanel utility panel 路径", () => {
  test("layoutMode='utility-panel' 强制 data-layout='utility-panel'", () => {
    const controller = makeStubController();
    render(<FormsPanel controller={controller} layoutMode="utility-panel" />);
    expect(screen.getByTestId("forms-panel")).toHaveAttribute("data-layout", "utility-panel");
  });

  test("layoutMode='drawer' 强制 data-layout='drawer'", () => {
    const controller = makeStubController();
    render(<FormsPanel controller={controller} layoutMode="drawer" />);
    expect(screen.getByTestId("forms-panel")).toHaveAttribute("data-layout", "drawer");
  });

  test("layoutMode='utility-panel' 不阻塞首屏（字段列表可渲染）", () => {
    const controller = makeStubController({ formState: SAMPLE_FORM_STATE });
    render(<FormsPanel controller={controller} layoutMode="utility-panel" />);
    expect(screen.getByRole("list", { name: "表单字段列表" })).toBeInTheDocument();
  });

  test("utility-panel 模式下 tab 切换正确（选中字段 + fill 编辑器）", async () => {
    const controller = makeStubController({
      formState: SAMPLE_FORM_STATE,
      panelMode: "fill",
      selectedFieldId: "name",
      draftValue: "Bob",
    });
    render(<FormsPanel controller={controller} layoutMode="utility-panel" />);

    const editor = screen.getByRole("region", { name: "填值编辑器" });
    expect(within(editor).getByRole("textbox")).toHaveValue("Bob");
  });

  test("FORMS_PANEL_DRAWER_BREAKPOINT 常量为 720", () => {
    expect(FORMS_PANEL_DRAWER_BREAKPOINT).toBe(720);
    expect(formsPanelDrawerMediaQuery()).toBe("(max-width: 719px)");
  });

  test("auto 模式：480-720px 视口切 drawer", () => {
    // jsdom 不支持真视口，用 matchMedia mock 模拟 480-720px 区间
    const narrowFalse = { matches: false, media: formsPanelNarrowMediaQuery(), addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
    const drawerTrue = { matches: true, media: formsPanelDrawerMediaQuery(), addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };

    const matchMedia = vi.fn((query: string) => {
      if (query === formsPanelNarrowMediaQuery()) return narrowFalse;
      if (query === formsPanelDrawerMediaQuery()) return drawerTrue;
      return { matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
    });

    const original = window.matchMedia;
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 600, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} layoutMode="auto" />);
    expect(screen.getByTestId("forms-panel")).toHaveAttribute("data-layout", "drawer");

    window.matchMedia = original;
  });

  test("auto 模式：>= 720px 视口切 floating", () => {
    const narrowFalse = { matches: false, media: formsPanelNarrowMediaQuery(), addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
    const drawerFalse = { matches: false, media: formsPanelDrawerMediaQuery(), addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };

    const matchMedia = vi.fn((query: string) => {
      if (query === formsPanelNarrowMediaQuery()) return narrowFalse;
      if (query === formsPanelDrawerMediaQuery()) return drawerFalse;
      return { matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false };
    });

    const original = window.matchMedia;
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024, writable: true });

    const controller = makeStubController();
    render(<FormsPanel controller={controller} layoutMode="auto" />);
    expect(screen.getByTestId("forms-panel")).toHaveAttribute("data-layout", "floating");

    window.matchMedia = original;
  });
});
