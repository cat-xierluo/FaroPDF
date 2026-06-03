import { describe, expect, test } from "vitest";
import {
  isPdfFormFieldType,
  isPdfFormOperation,
  isPdfFormOperationType,
  PDF_FORM_FIELD_TYPES,
  PDF_FORM_OPERATION_TYPES,
  validateFormBatchRequest,
  validateFormFillingInput,
  validateSignatureInput,
} from "./form";
import type {
  PdfFormBatchRequest,
  PdfFormFillingInput,
  PdfFormField,
  PdfFormFlattenOperation,
  PdfFormFillOperation,
  PdfFormOperation,
  PdfFormSignatureOperation,
  PdfFormState,
  PdfSignatureInput,
} from "./form";

describe("表单共享契约", () => {
  test("PDF_FORM_FIELD_TYPES 包含所有字段类型", () => {
    expect(PDF_FORM_FIELD_TYPES).toEqual(["text", "checkbox", "radio", "dropdown", "button"]);
  });

  test("isPdfFormFieldType 识别合法字段类型", () => {
    expect(isPdfFormFieldType("text")).toBe(true);
    expect(isPdfFormFieldType("checkbox")).toBe(true);
    expect(isPdfFormFieldType("radio")).toBe(true);
    expect(isPdfFormFieldType("dropdown")).toBe(true);
    expect(isPdfFormFieldType("button")).toBe(true);
    expect(isPdfFormFieldType("unknown")).toBe(false);
    expect(isPdfFormFieldType(123)).toBe(false);
    expect(isPdfFormFieldType(null)).toBe(false);
  });

  test("PdfFormField 类型可以构造完整字段对象", () => {
    const field: PdfFormField = {
      id: "field-name",
      name: "field-name",
      type: "text",
      pageIndex: 0,
      value: "Alice",
      defaultValue: "",
      required: true,
      readOnly: false,
      choices: [],
      rect: { x: 50, y: 700, width: 200, height: 24 },
    };

    expect(field.type).toBe("text");
    expect(field.value).toBe("Alice");
    expect(field.required).toBe(true);
    expect(field.rect.width).toBe(200);
  });

  test("PdfFormState 可以表示空表单", () => {
    const emptyState: PdfFormState = {
      fields: [],
      fieldCount: 0,
      fillable: false,
    };

    expect(emptyState.fieldCount).toBe(0);
    expect(emptyState.fillable).toBe(false);
  });

  test("PdfFormState 可以表示含字段的表单", () => {
    const state: PdfFormState = {
      fields: [
        {
          id: "name",
          name: "name",
          type: "text",
          pageIndex: 0,
          value: "",
          defaultValue: "",
          required: false,
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
          required: true,
          readOnly: false,
          choices: [],
          rect: { x: 0, y: 0, width: 16, height: 16 },
        },
      ],
      fieldCount: 2,
      fillable: true,
    };

    expect(state.fields).toHaveLength(2);
    expect(state.fieldCount).toBe(2);
    expect(state.fillable).toBe(true);
    expect(state.fields[1].type).toBe("checkbox");
  });

  test("validateFormFillingInput 校验合法输入", () => {
    const valid: PdfFormFillingInput = { fieldId: "name", value: "Bob" };
    expect(validateFormFillingInput(valid)).toBe(true);
  });

  test("validateFormFillingInput 拒绝无效输入", () => {
    expect(validateFormFillingInput(null)).toBe(false);
    expect(validateFormFillingInput(undefined)).toBe(false);
    expect(validateFormFillingInput({})).toBe(false);
    expect(validateFormFillingInput({ fieldId: "", value: "test" })).toBe(false);
    expect(validateFormFillingInput({ fieldId: "name", value: 123 })).toBe(false);
    expect(validateFormFillingInput({ fieldId: "name" })).toBe(false);
  });

  test("validateSignatureInput 校验合法签名输入", () => {
    const valid: PdfSignatureInput = {
      fieldId: "sig-1",
      imageBytes: new Uint8Array([137, 80, 78, 71]),
      imageType: "png",
    };
    expect(validateSignatureInput(valid)).toBe(true);
  });

  test("validateSignatureInput 拒绝无效签名输入", () => {
    expect(validateSignatureInput(null)).toBe(false);
    expect(validateSignatureInput({})).toBe(false);
    expect(validateSignatureInput({ fieldId: "sig", imageBytes: new Uint8Array(0), imageType: "png" })).toBe(false);
    expect(validateSignatureInput({ fieldId: "sig", imageBytes: new Uint8Array([1]), imageType: "bmp" })).toBe(false);
    expect(validateSignatureInput({ fieldId: "", imageBytes: new Uint8Array([1]), imageType: "png" })).toBe(false);
  });

  test("PDF_FORM_OPERATION_TYPES 包含 fill / sign / flatten", () => {
    expect(PDF_FORM_OPERATION_TYPES).toEqual(["fill", "sign", "flatten"]);
  });

  test("isPdfFormOperationType 识别合法 operation 类型", () => {
    expect(isPdfFormOperationType("fill")).toBe(true);
    expect(isPdfFormOperationType("sign")).toBe(true);
    expect(isPdfFormOperationType("flatten")).toBe(true);
    expect(isPdfFormOperationType("watermark")).toBe(false);
    expect(isPdfFormOperationType(0)).toBe(false);
  });

  test("isPdfFormOperation 识别合法的 fill / sign / flatten", () => {
    const fill: PdfFormFillOperation = { id: "op-1", type: "fill", fieldId: "name", value: "Alice" };
    const sign: PdfFormSignatureOperation = {
      id: "op-2",
      type: "sign",
      fieldId: "sig",
      imageBytes: new Uint8Array([1, 2, 3]),
      imageType: "png",
    };
    const flatten: PdfFormFlattenOperation = { id: "op-3", type: "flatten" };

    expect(isPdfFormOperation(fill)).toBe(true);
    expect(isPdfFormOperation(sign)).toBe(true);
    expect(isPdfFormOperation(flatten)).toBe(true);
  });

  test("isPdfFormOperation 拒绝缺少字段的 operation", () => {
    expect(isPdfFormOperation(null)).toBe(false);
    expect(isPdfFormOperation({})).toBe(false);
    expect(isPdfFormOperation({ id: "", type: "fill", fieldId: "x", value: "y" })).toBe(false);
    expect(isPdfFormOperation({ id: "x", type: "fill", fieldId: "", value: "y" })).toBe(false);
    expect(isPdfFormOperation({ id: "x", type: "fill", fieldId: "y", value: 0 })).toBe(false);
    expect(isPdfFormOperation({ id: "x", type: "sign", fieldId: "y", imageBytes: new Uint8Array(0), imageType: "png" })).toBe(
      false,
    );
    expect(isPdfFormOperation({ id: "x", type: "sign", fieldId: "y", imageBytes: new Uint8Array([1]), imageType: "gif" })).toBe(
      false,
    );
    expect(isPdfFormOperation({ id: "x", type: "watermark" })).toBe(false);
  });

  test("validateFormBatchRequest 校验合法批量请求", () => {
    const valid: PdfFormBatchRequest = {
      id: "batch-1",
      pdfBytes: new Uint8Array([1, 2, 3]),
      operations: [
        { id: "op-1", type: "fill", fieldId: "name", value: "Alice" },
        { id: "op-2", type: "flatten" },
      ],
      requestedAt: "2026-06-04T00:00:00.000Z",
    };
    expect(validateFormBatchRequest(valid)).toBe(true);
  });

  test("validateFormBatchRequest 拒绝非法批量请求", () => {
    expect(validateFormBatchRequest(null)).toBe(false);
    expect(validateFormBatchRequest({})).toBe(false);
    expect(
      validateFormBatchRequest({
        id: "x",
        pdfBytes: new Uint8Array(0),
        operations: [{ id: "y", type: "flatten" }],
        requestedAt: "now",
      }),
    ).toBe(false);
    expect(
      validateFormBatchRequest({
        id: "x",
        pdfBytes: new Uint8Array([1]),
        operations: [{ id: "y", type: "watermark" }],
        requestedAt: "now",
      }),
    ).toBe(false);
    expect(
      validateFormBatchRequest({
        id: "x",
        pdfBytes: new Uint8Array([1]),
        operations: [],
        requestedAt: "now",
      }),
    ).toBe(false);
  });

  test("PdfFormOperation 联合类型支持 fill / sign / flatten 三种分支", () => {
    const ops: PdfFormOperation[] = [
      { id: "a", type: "fill", fieldId: "name", value: "Alice" },
      { id: "b", type: "sign", fieldId: "sig", imageBytes: new Uint8Array([1]), imageType: "jpg" },
      { id: "c", type: "flatten" },
    ];
    expect(ops).toHaveLength(3);
    expect(ops[0].type).toBe("fill");
    expect(ops[1].type).toBe("sign");
    expect(ops[2].type).toBe("flatten");
  });
});
