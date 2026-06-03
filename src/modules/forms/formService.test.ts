import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createFormService } from "./formService";
import type { FormService } from "./formService";
import { createPdfOperationEngine } from "../export/pdfOperationEngine";

// ---------------------------------------------------------------------------
// 测试辅助：创建含表单的 PDF
// ---------------------------------------------------------------------------

async function createPdfWithTextField(
  fieldName: string,
  defaultValue?: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  const textField = form.createTextField(fieldName);
  textField.addToPage(page, {
    x: 50,
    y: 750,
    width: 200,
    height: 24,
  });
  if (defaultValue !== undefined) {
    textField.setText(defaultValue);
  }
  return pdf.save();
}

async function createPdfWithCheckBox(fieldName: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  const checkBox = form.createCheckBox(fieldName);
  checkBox.addToPage(page, { x: 50, y: 700, width: 16, height: 16 });
  return pdf.save();
}

async function createPdfWithMultipleFields(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();

  const nameField = form.createTextField("name_field");
  nameField.addToPage(page, { x: 50, y: 750, width: 200, height: 24 });

  const agreeBox = form.createCheckBox("agree_checkbox");
  agreeBox.addToPage(page, { x: 50, y: 700, width: 16, height: 16 });

  return pdf.save();
}

async function createEmptyPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  return pdf.save();
}

// ---------------------------------------------------------------------------
// 创建服务实例
// ---------------------------------------------------------------------------

function createTestFormService(): FormService {
  const engine = createPdfOperationEngine();
  return createFormService({ engine });
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("表单服务", () => {
  const service = createTestFormService();

  test("读取含文本字段的 PDF", async () => {
    const pdfBytes = await createPdfWithTextField("name_field", "Zhang");
    const state = await service.readFormFields(pdfBytes);

    expect(state.fieldCount).toBe(1);
    expect(state.fillable).toBe(true);
    expect(state.fields).toHaveLength(1);
    expect(state.fields[0].name).toBe("name_field");
    expect(state.fields[0].type).toBe("text");
  });

  test("读取含复选框的 PDF", async () => {
    const pdfBytes = await createPdfWithCheckBox("agree");
    const state = await service.readFormFields(pdfBytes);

    expect(state.fieldCount).toBe(1);
    expect(state.fields[0].type).toBe("checkbox");
    expect(state.fields[0].name).toBe("agree");
  });

  test("读取含多种字段的 PDF", async () => {
    const pdfBytes = await createPdfWithMultipleFields();
    const state = await service.readFormFields(pdfBytes);

    expect(state.fieldCount).toBe(2);
    expect(state.fields).toHaveLength(2);

    const fieldNames = state.fields.map((f) => f.name);
    expect(fieldNames).toContain("name_field");
    expect(fieldNames).toContain("agree_checkbox");
  });

  test("读取空 PDF（无表单）返回空表单状态", async () => {
    const pdfBytes = await createEmptyPdf();
    const state = await service.readFormFields(pdfBytes);

    expect(state.fieldCount).toBe(0);
    expect(state.fields).toHaveLength(0);
    expect(state.fillable).toBe(false);
  });

  test("填写文本字段成功", async () => {
    const pdfBytes = await createPdfWithTextField("name_field");
    const updatedBytes = await service.fillFormField(pdfBytes, {
      fieldId: "name_field",
      value: "test-value",
    });

    // 验证写入后的 PDF 包含新值
    const state = await service.readFormFields(updatedBytes);
    expect(state.fields).toHaveLength(1);
    expect(state.fields[0].value).toBe("test-value");
  });

  test("填写复选框成功（勾选）", async () => {
    const pdfBytes = await createPdfWithCheckBox("agree");
    const updatedBytes = await service.fillFormField(pdfBytes, {
      fieldId: "agree",
      value: "true",
    });

    const state = await service.readFormFields(updatedBytes);
    expect(state.fields[0].value).toBe("true");
  });

  test("填写复选框成功（取消勾选）", async () => {
    const pdfBytes = await createPdfWithCheckBox("agree");
    // 先勾选
    const checkedBytes = await service.fillFormField(pdfBytes, {
      fieldId: "agree",
      value: "true",
    });
    // 再取消
    const uncheckedBytes = await service.fillFormField(checkedBytes, {
      fieldId: "agree",
      value: "false",
    });

    const state = await service.readFormFields(uncheckedBytes);
    expect(state.fields[0].value).toBe("false");
  });

  test("填写不存在的字段时报错", async () => {
    const pdfBytes = await createPdfWithTextField("name_field");

    await expect(
      service.fillFormField(pdfBytes, { fieldId: "nonexistent", value: "value" }),
    ).rejects.toThrow("表单字段不存在");
  });

  test("空 PDF bytes 时 readFormFields 报错", async () => {
    await expect(service.readFormFields(new Uint8Array(0))).rejects.toThrow("PDF bytes 不能为空");
  });

  test("空 PDF bytes 时 fillFormField 报错", async () => {
    await expect(
      service.fillFormField(new Uint8Array(0), { fieldId: "name", value: "value" }),
    ).rejects.toThrow("PDF bytes 不能为空");
  });

  test("无效填写输入时 fillFormField 报错", async () => {
    const pdfBytes = await createPdfWithTextField("name_field");

    await expect(
      service.fillFormField(pdfBytes, { fieldId: "", value: "test" } as never),
    ).rejects.toThrow("表单填写输入不合法");
  });

  test("签名字段不存在时报错", async () => {
    const pdfBytes = await createPdfWithTextField("name_field");

    await expect(
      service.signField(pdfBytes, {
        fieldId: "nonexistent",
        imageBytes: new Uint8Array([1, 2, 3]),
        imageType: "png",
      }),
    ).rejects.toThrow("签名字段不存在");
  });

  test("空签名输入时 signField 报错", async () => {
    const pdfBytes = await createPdfWithTextField("name_field");

    await expect(
      service.signField(pdfBytes, {
        fieldId: "name_field",
        imageBytes: new Uint8Array(0),
        imageType: "png",
      }),
    ).rejects.toThrow("签名输入不合法");
  });
});
