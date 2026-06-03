import { describe, expect, test } from "vitest";
import {
  isPdfFormFieldType,
  PDF_FORM_FIELD_TYPES,
  validateFormFillingInput,
  validateSignatureInput,
} from "./form";
import type {
  PdfFormFillingInput,
  PdfFormField,
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
      value: "张三",
      defaultValue: "",
      required: true,
      readOnly: false,
      choices: [],
      rect: { x: 50, y: 700, width: 200, height: 24 },
    };

    expect(field.type).toBe("text");
    expect(field.value).toBe("张三");
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
    const valid: PdfFormFillingInput = { fieldId: "name", value: "李四" };
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
});
