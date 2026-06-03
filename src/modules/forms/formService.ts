/**
 * 表单填写与签署服务
 *
 * 使用 pdf-lib 读取、填写 AcroForm 字段，嵌入签名图片。
 * 依赖 pdfOperationEngine 做底层 PDF 操作，配合 pdf-lib 提供表单专用 API。
 */

import {
  PDFButton,
  PDFCheckBox,
  PDFDropdown,
  PDFDocument,
  PDFRadioGroup,
  PDFTextField,
  type PDFField,
} from "pdf-lib";
import type { PdfOperationEngine } from "../export/pdfOperationEngine";
import type {
  PdfFormField,
  PdfFormFieldType,
  PdfFormFillingInput,
  PdfFormState,
  PdfSignatureInput,
} from "../../shared/pdf/form";
import {
  validateFormFillingInput,
  validateSignatureInput,
} from "../../shared/pdf/form";

// ---------------------------------------------------------------------------
// 服务接口
// ---------------------------------------------------------------------------

export interface FormService {
  /** 读取 PDF 中的 AcroForm 字段，返回表单整体状态 */
  readFormFields(pdfBytes: Uint8Array): Promise<PdfFormState>;

  /** 填写指定字段，返回更新后的 PDF bytes */
  fillFormField(pdfBytes: Uint8Array, input: PdfFormFillingInput): Promise<Uint8Array>;

  /** 在签名字段上嵌入签名图片，返回更新后的 PDF bytes */
  signField(pdfBytes: Uint8Array, input: PdfSignatureInput): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// 创建服务
// ---------------------------------------------------------------------------

interface FormServiceOptions {
  /** pdfOperationEngine 用于未来扩展（如 flatten-form），目前保留依赖 */
  engine: PdfOperationEngine;
}

export function createFormService(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: FormServiceOptions,
): FormService {
  return {
    async readFormFields(pdfBytes) {
      validatePdfBytes(pdfBytes);

      const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const rawFields = form.getFields();

      if (rawFields.length === 0) {
        return { fields: [], fieldCount: 0, fillable: false };
      }

      const fields: PdfFormField[] = [];

      for (const rawField of rawFields) {
        try {
          const mapped = mapFormField(rawField);
          if (mapped) {
            fields.push(mapped);
          }
        } catch {
          // 跳过无法识别的字段，保持服务健壮
        }
      }

      return {
        fields,
        fieldCount: fields.length,
        fillable: fields.some((field) => !field.readOnly),
      };
    },

    async fillFormField(pdfBytes, input) {
      validatePdfBytes(pdfBytes);
      if (!validateFormFillingInput(input)) {
        throw new Error("表单填写输入不合法：fieldId 和 value 必须为非空字符串。");
      }

      const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const targetField = findFieldById(form, input.fieldId);

      if (!targetField) {
        throw new Error(`表单字段不存在：${input.fieldId}`);
      }

      const fieldType = detectFieldType(targetField);

      if (fieldType === "text") {
        const textField = form.getTextField(input.fieldId);
        textField.setText(input.value);
      } else if (fieldType === "checkbox") {
        const checkBox = form.getCheckBox(input.fieldId);
        if (input.value === "true" || input.value === "1" || input.value === "yes") {
          checkBox.check();
        } else {
          checkBox.uncheck();
        }
      } else if (fieldType === "dropdown") {
        const dropdown = form.getDropdown(input.fieldId);
        dropdown.select(input.value);
      } else if (fieldType === "radio") {
        const radioGroup = form.getRadioGroup(input.fieldId);
        radioGroup.select(input.value);
      } else {
        throw new Error(`字段类型 "${fieldType}" 不支持程序化填写。`);
      }

      return pdf.save();
    },

    async signField(pdfBytes, input) {
      validatePdfBytes(pdfBytes);
      if (!validateSignatureInput(input)) {
        throw new Error("签名输入不合法：需要 fieldId、imageBytes 和 imageType。");
      }

      const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const targetField = findFieldById(form, input.fieldId);

      if (!targetField) {
        throw new Error(`签名字段不存在：${input.fieldId}`);
      }

      // 获取字段所在页和位置
      const widget = targetField.acroField.getWidgets()[0];
      if (!widget) {
        throw new Error(`签名字段 "${input.fieldId}" 没有可视控件，无法嵌入图片。`);
      }

      const rectObj = widget.getRectangle();
      const fieldRect = {
        x: rectObj.x,
        y: rectObj.y,
        width: rectObj.width,
        height: rectObj.height,
      };

      // 找到字段所在页面
      const pages = pdf.getPages();
      let pageIndex = 0;
      for (let i = 0; i < pages.length; i++) {
        const annots = pages[i].node.Annots();
        if (annots) {
          for (const annot of annots.asArray()) {
            if (annot === widget.dict) {
              pageIndex = i;
              break;
            }
          }
        }
      }

      const page = pages[pageIndex];
      const image =
        input.imageType === "png"
          ? await pdf.embedPng(input.imageBytes)
          : await pdf.embedJpg(input.imageBytes);

      page.drawImage(image, {
        x: fieldRect.x,
        y: fieldRect.y,
        width: fieldRect.width,
        height: fieldRect.height,
      });

      return pdf.save();
    },
  };
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function validatePdfBytes(bytes: Uint8Array): void {
  if (!bytes || bytes.length === 0) {
    throw new Error("PDF bytes 不能为空。");
  }
}

/**
 * 将 pdf-lib 原生字段映射为 PdfFormField。
 * 返回 null 表示无法识别的字段类型。
 */
function mapFormField(rawField: PDFField): PdfFormField | null {
  const name = rawField.getName();
  const fieldType = detectFieldType(rawField);

  if (!fieldType) return null;

  // 获取字段值
  const value = getFieldStringValue(rawField);
  const defaultValue = "";

  // 获取位置
  const widget = rawField.acroField.getWidgets()[0];
  const rectObj = widget?.getRectangle();
  const rect = rectObj
    ? { x: rectObj.x, y: rectObj.y, width: rectObj.width, height: rectObj.height }
    : { x: 0, y: 0, width: 0, height: 0 };

  // 判断只读和必填
  const readOnly = rawField.isReadOnly();
  const required = rawField.isRequired();

  // 获取选项列表
  const choices = getFieldChoices(rawField);

  return {
    id: name,
    name,
    type: fieldType,
    pageIndex: 0,
    value,
    defaultValue,
    required,
    readOnly,
    choices,
    rect,
  };
}

/** 探测 pdf-lib 字段的具体类型 */
function detectFieldType(rawField: PDFField): PdfFormFieldType | null {
  if (rawField instanceof PDFTextField) return "text";
  if (rawField instanceof PDFCheckBox) return "checkbox";
  if (rawField instanceof PDFRadioGroup) return "radio";
  if (rawField instanceof PDFDropdown) return "dropdown";
  if (rawField instanceof PDFButton) return "button";
  return null;
}

/** 读取字段的当前字符串值 */
function getFieldStringValue(rawField: PDFField): string {
  try {
    if (rawField instanceof PDFTextField) {
      return rawField.getText() ?? "";
    }
    if (rawField instanceof PDFCheckBox) {
      return rawField.isChecked() ? "true" : "false";
    }
    if (rawField instanceof PDFDropdown) {
      return rawField.getSelected().join(", ");
    }
    if (rawField instanceof PDFRadioGroup) {
      return rawField.getSelected() ?? "";
    }
  } catch {
    // 读取失败返回空字符串
  }
  return "";
}

/** 读取字段选项列表 */
function getFieldChoices(rawField: PDFField): string[] {
  try {
    if (rawField instanceof PDFDropdown) {
      return rawField.getOptions();
    }
    if (rawField instanceof PDFRadioGroup) {
      return rawField.getOptions();
    }
  } catch {
    // 读取失败返回空列表
  }
  return [];
}

/** 按字段名称查找字段 */
function findFieldById(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldId: string,
): PDFField | null {
  return form.getFields().find((field) => field.getName() === fieldId) ?? null;
}
