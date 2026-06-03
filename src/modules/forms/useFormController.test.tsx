import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useFormController } from "./useFormController";
import type { FormService } from "./formService";
import type { ReaderController } from "../reader";
import type { PdfFormState } from "../../shared/pdf/form";

interface FakeReaderOptions {
  documentId?: string | null;
  fileBytes?: Uint8Array | null;
  fileName?: string | null;
}

function makeFakeReader(options: FakeReaderOptions = {}): ReaderController & {
  getFileBytes: ReturnType<typeof vi.fn>;
  saveUpdatedBytes: ReturnType<typeof vi.fn>;
  getCurrentFileName: ReturnType<typeof vi.fn>;
  setDocumentId: (id: string | null) => void;
} {
  const hasDocument = options.documentId !== null;
  const documentId = hasDocument ? options.documentId ?? "doc-1" : null;
  const fileBytes = options.fileBytes === null ? null : options.fileBytes ?? new Uint8Array([1, 2, 3]);
  const fileName = options.fileName ?? "test.pdf";
  const getFileBytes = vi.fn(async () => fileBytes);
  const saveUpdatedBytes = vi.fn(async () => undefined);
  const getCurrentFileName = vi.fn(() => fileName);

  return {
    state: {
      document: documentId
        ? ({ documentId, pageCount: 1 } as never)
        : null,
    },
    getFileBytes,
    saveUpdatedBytes,
    getCurrentFileName,
    setDocumentId: (id: string | null) => {
      // noop for compatibility
      void id;
    },
  } as unknown as ReaderController & {
    getFileBytes: ReturnType<typeof vi.fn>;
    saveUpdatedBytes: ReturnType<typeof vi.fn>;
    getCurrentFileName: ReturnType<typeof vi.fn>;
    setDocumentId: (id: string | null) => void;
  };
}

function makeFakeService(overrides: Partial<FormService> = {}): FormService & {
  readFormFields: ReturnType<typeof vi.fn>;
  fillFormField: ReturnType<typeof vi.fn>;
  signField: ReturnType<typeof vi.fn>;
  flattenForm: ReturnType<typeof vi.fn>;
  applyFormOperations: ReturnType<typeof vi.fn>;
} {
  return {
    readFormFields: vi.fn(),
    fillFormField: vi.fn(),
    signField: vi.fn(),
    flattenForm: vi.fn(),
    applyFormOperations: vi.fn(),
    ...overrides,
  } as FormService & {
    readFormFields: ReturnType<typeof vi.fn>;
    fillFormField: ReturnType<typeof vi.fn>;
    signField: ReturnType<typeof vi.fn>;
    flattenForm: ReturnType<typeof vi.fn>;
    applyFormOperations: ReturnType<typeof vi.fn>;
  };
}

const SAMPLE_FORM_STATE: PdfFormState = {
  fields: [
    {
      id: "name_field",
      name: "name_field",
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
      value: "false",
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

describe("useFormController", () => {
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

  test("初始状态 formState=null, panelMode='none'", () => {
    const reader = makeFakeReader();
    const service = makeFakeService();
    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    expect(result.current.formState).toBeNull();
    expect(result.current.panelMode).toBe("none");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });

  test("refreshFormState 调 service.readFormFields 并写入 formState", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });

    expect(service.readFormFields).toHaveBeenCalledTimes(1);
    expect(result.current.formState).toEqual(SAMPLE_FORM_STATE);
    expect(result.current.successMessage).toMatch(/已读取 2 个字段/);
    expect(result.current.loading).toBe(false);
  });

  test("refreshFormState 无文档时写入错误", async () => {
    const reader = makeFakeReader({ fileBytes: null, documentId: null });
    const service = makeFakeService();
    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });

    expect(result.current.errorMessage).toMatch(/尚未打开 PDF/);
    expect(result.current.formState).toBeNull();
  });

  test("refreshFormState service 抛错时写入 errorMessage", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });

    expect(result.current.errorMessage).toBe("boom");
    expect(result.current.successMessage).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test("openPanel('fill') 选第一个非只读字段并写入 draftValue", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("fill");
    });

    expect(result.current.panelMode).toBe("fill");
    expect(result.current.selectedFieldId).toBe("name_field");
    expect(result.current.draftValue).toBe("");
  });

  test("openPanel('sign') 不重置 draftValue", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("sign");
    });

    expect(result.current.panelMode).toBe("sign");
    expect(result.current.selectedFieldId).toBe("name_field");
  });

  test("closePanel 清空面板状态和草稿", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("fill");
      result.current.setDraftValue("test");
    });
    act(() => {
      result.current.closePanel();
    });

    expect(result.current.panelMode).toBe("none");
    expect(result.current.selectedFieldId).toBeNull();
    expect(result.current.draftValue).toBe("");
  });

  test("applyFieldEdit 调 fillFormField + saveUpdatedBytes 并写成功消息", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
      fillFormField: vi.fn(async (bytes, input) => new Uint8Array([9, 9, 9])),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("fill");
      result.current.setDraftValue("Alice");
    });

    await act(async () => {
      await result.current.applyFieldEdit();
    });

    expect(service.fillFormField).toHaveBeenCalledWith(expect.any(Uint8Array), {
      fieldId: "name_field",
      value: "Alice",
    });
    expect(reader.saveUpdatedBytes).toHaveBeenCalledWith(expect.any(Uint8Array), "test-filled.pdf");
    expect(result.current.successMessage).toMatch(/name_field/);
  });

  test("applySignature 调 signField + saveUpdatedBytes", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
      signField: vi.fn(async () => new Uint8Array([8, 8, 8])),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("sign");
      result.current.selectField("name_field");
      result.current.setSignatureImage(new Uint8Array([1, 2, 3]), "png");
    });

    await act(async () => {
      await result.current.applySignature();
    });

    expect(service.signField).toHaveBeenCalledTimes(1);
    expect(reader.saveUpdatedBytes).toHaveBeenCalledWith(expect.any(Uint8Array), "test-signed.pdf");
    expect(result.current.successMessage).toMatch(/name_field/);
  });

  test("applySignature 无签名图片时写错误", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.openPanel("sign");
    });

    await act(async () => {
      await result.current.applySignature();
    });

    expect(result.current.errorMessage).toMatch(/签名图片/);
  });

  test("flattenAndSave 调 service.flattenForm + saveUpdatedBytes", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      flattenForm: vi.fn(async () => ({
        bytes: new Uint8Array([7, 7]),
        summary: { fieldCountBeforeFlatten: 2, fieldCountAfterFlatten: 0, flattened: true },
      })),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.flattenAndSave();
    });

    expect(service.flattenForm).toHaveBeenCalledTimes(1);
    expect(reader.saveUpdatedBytes).toHaveBeenCalledWith(expect.any(Uint8Array), "test-flattened.pdf");
    expect(result.current.formState).toEqual({ fields: [], fieldCount: 0, fillable: false });
    expect(result.current.successMessage).toMatch(/2 个字段/);
  });

  test("applyBatchAndSave 调 applyFormOperations + saveUpdatedBytes", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      applyFormOperations: vi.fn(async () => ({
        id: "batch",
        bytes: new Uint8Array([6, 6]),
        appliedCount: 2,
        failedCount: 0,
        results: [
          { id: "op-1", type: "fill", status: "applied", fieldId: "name_field", value: "x" },
          { id: "op-2", type: "flatten", status: "applied", summary: { fieldCountBeforeFlatten: 1, fieldCountAfterFlatten: 0, flattened: true } },
        ],
        completedAt: "2026-06-04T00:00:00.000Z",
      })),
      readFormFields: vi.fn(async () => ({ fields: [], fieldCount: 0, fillable: false })),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.applyBatchAndSave(
        [
          { id: "op-1", type: "fill", fieldId: "name_field", value: "x" },
          { id: "op-2", type: "flatten" },
        ],
        "submitted",
      );
    });

    expect(service.applyFormOperations).toHaveBeenCalledTimes(1);
    expect(reader.saveUpdatedBytes).toHaveBeenCalledWith(expect.any(Uint8Array), "test-submitted.pdf");
    expect(result.current.successMessage).toMatch(/已应用 2 条/);
  });

  test("applyBatchAndSave 部分失败时写 errorMessage 包含失败原因", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      applyFormOperations: vi.fn(async () => ({
        id: "batch",
        bytes: new Uint8Array([6, 6]),
        appliedCount: 1,
        failedCount: 1,
        results: [
          { id: "op-1", type: "fill", status: "applied", fieldId: "x", value: "y" },
          { id: "op-2", type: "fill", status: "failed", errorMessage: "field missing" },
        ],
        completedAt: "2026-06-04T00:00:00.000Z",
      })),
      readFormFields: vi.fn(async () => ({ fields: [], fieldCount: 0, fillable: false })),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.applyBatchAndSave(
        [
          { id: "op-1", type: "fill", fieldId: "x", value: "y" },
          { id: "op-2", type: "fill", fieldId: "missing", value: "z" },
        ],
        "submitted",
      );
    });

    expect(result.current.errorMessage).toMatch(/field missing/);
  });

  test("setErrorMessage 设置错误并清除成功提示", () => {
    const reader = makeFakeReader();
    const service = makeFakeService();
    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    act(() => {
      result.current.setErrorMessage("validation error");
    });
    expect(result.current.errorMessage).toBe("validation error");
  });

  test("clearMessages 清空错误和成功提示", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result } = renderHook(() => useFormController(reader as ReaderController, { service }));

    await act(async () => {
      await result.current.refreshFormState();
    });
    act(() => {
      result.current.setErrorMessage("manual error");
    });
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });

  test("document 切换时重置全部状态", async () => {
    const reader = makeFakeReader();
    const service = makeFakeService({
      readFormFields: vi.fn(async () => SAMPLE_FORM_STATE),
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => {
        (reader.state as { document: { documentId: string } | null }).document = id ? { documentId: id } : null;
        return useFormController(reader as ReaderController, { service });
      },
      { initialProps: { id: "doc-1" } },
    );

    await act(async () => {
      await result.current.refreshFormState();
    });
    expect(result.current.formState).toEqual(SAMPLE_FORM_STATE);

    rerender({ id: "doc-2" });

    expect(result.current.formState).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.panelMode).toBe("none");
  });
});
