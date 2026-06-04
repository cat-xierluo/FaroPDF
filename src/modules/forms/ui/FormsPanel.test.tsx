import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FormsPanel } from "./FormsPanel";
import type { FormController } from "../useFormController";
import type { PdfFormState } from "../../../shared/pdf/form";

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
