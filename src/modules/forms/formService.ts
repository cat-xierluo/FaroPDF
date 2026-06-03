/**
 * 表单填写与签署服务
 *
 * 使用 pdf-lib 读取、填写 AcroForm 字段，嵌入签名图片并把表单扁平化。
 * 依赖 pdfOperationEngine 做底层 PDF 操作，配合 pdf-lib 提供表单专用 API。
 */

import {
  PDFButton,
  PDFCheckBox,
  PDFDict,
  PDFDropdown,
  PDFDocument,
  PDFRadioGroup,
  PDFRef,
  PDFTextField,
  type PDFField,
  type PDFPage,
} from "pdf-lib";
import type { PdfOperationEngine } from "../export/pdfOperationEngine";
import type {
  PdfFormBatchRequest,
  PdfFormBatchResult,
  PdfFormField,
  PdfFormFieldType,
  PdfFormFillingInput,
  PdfFormFlattenSummary,
  PdfFormOperation,
  PdfFormOperationResult,
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

  /** 扁平化表单（执行 pdf-lib `form.flatten()`），返回新 PDF bytes + 摘要 */
  flattenForm(pdfBytes: Uint8Array): Promise<{ bytes: Uint8Array; summary: PdfFormFlattenSummary }>;

  /** 按顺序批量执行 fill/sign/flatten operation 列表 */
  applyFormOperations(request: PdfFormBatchRequest): Promise<PdfFormBatchResult>;
}

// ---------------------------------------------------------------------------
// 创建服务
// ---------------------------------------------------------------------------

interface FormServiceOptions {
  /** pdfOperationEngine 保留依赖（与 `flatten-form` operation 复用同一 PDF 库底座） */
  engine: PdfOperationEngine;
  /** 时间源（用于 PdfFormBatchResult.completedAt） */
  now?: () => string;
}

export function createFormService(options: FormServiceOptions): FormService {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async readFormFields(pdfBytes) {
      validatePdfBytes(pdfBytes);

      const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const rawFields = form.getFields();

      if (rawFields.length === 0) {
        return { fields: [], fieldCount: 0, fillable: false };
      }

      const pageIndexMap = buildPageIndexMap(pdf);
      const fields: PdfFormField[] = [];

      for (const rawField of rawFields) {
        try {
          const mapped = mapFormField(rawField, pageIndexMap);
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

      const widget = targetField.acroField.getWidgets()[0];
      if (!widget) {
        throw new Error(`签名字段 "${input.fieldId}" 没有可视控件，无法嵌入图片。`);
      }

      const pageIndexMap = buildPageIndexMap(pdf);
      const pageIndex = pageIndexMap.get(widget.dict) ?? 0;
      const page = pdf.getPages()[pageIndex];

      const rectObj = widget.getRectangle();
      const image =
        input.imageType === "png"
          ? await pdf.embedPng(input.imageBytes)
          : await pdf.embedJpg(input.imageBytes);

      page.drawImage(image, {
        x: rectObj.x,
        y: rectObj.y,
        width: rectObj.width,
        height: rectObj.height,
      });

      return pdf.save();
    },

    async flattenForm(pdfBytes) {
      validatePdfBytes(pdfBytes);

      const pdf = await PDFDocument.load(pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const fieldCountBeforeFlatten = form.getFields().length;

      form.flatten();

      const bytes = await pdf.save();

      return {
        bytes,
        summary: {
          fieldCountBeforeFlatten,
          fieldCountAfterFlatten: 0,
          flattened: true,
        },
      };
    },

    async applyFormOperations(request) {
      validatePdfBytes(request.pdfBytes);
      if (!Array.isArray(request.operations) || request.operations.length === 0) {
        throw new Error("批量表单操作至少需要一条 operation。");
      }

      const pdf = await PDFDocument.load(request.pdfBytes, { updateMetadata: false });
      const form = pdf.getForm();
      const results: PdfFormOperationResult[] = [];
      let appliedCount = 0;
      let failedCount = 0;

      for (const operation of request.operations) {
        const result = await applySingleOperation(pdf, form, operation);
        results.push(result);

        if (result.status === "applied") {
          appliedCount += 1;
        } else {
          failedCount += 1;
        }
      }

      const bytes = await pdf.save();

      return {
        id: request.id,
        bytes,
        appliedCount,
        failedCount,
        results,
        completedAt: now(),
      };
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

/** 构建 widget PDFDict → pageIndex 的查找表；Annots 数组里是 PDFRef，需要 lookup 成 PDFDict 才能与 widget.dict 比较引用相等 */
function buildPageIndexMap(pdf: PDFDocument): Map<PDFDict, number> {
  const map = new Map<PDFDict, number>();
  const pages = pdf.getPages();

  pages.forEach((page, pageIndex) => {
    const annots = page.node.Annots();
    if (!annots) return;
    for (const entry of annots.asArray()) {
      if (entry instanceof PDFRef) {
        const dict = pdf.context.lookup(entry, PDFDict);
        if (dict) {
          map.set(dict, pageIndex);
        }
      }
    }
  });

  return map;
}

/**
 * 将 pdf-lib 原生字段映射为 PdfFormField。
 * 返回 null 表示无法识别的字段类型。
 * pageIndex 优先取 widget.dict 真实所在页，找不到时回退 0。
 */
function mapFormField(rawField: PDFField, pageIndexMap: Map<PDFDict, number>): PdfFormField | null {
  const name = rawField.getName();
  const fieldType = detectFieldType(rawField);

  if (!fieldType) return null;

  const widget = rawField.acroField.getWidgets()[0];
  const rectObj = widget?.getRectangle();
  const rect = rectObj
    ? { x: rectObj.x, y: rectObj.y, width: rectObj.width, height: rectObj.height }
    : { x: 0, y: 0, width: 0, height: 0 };
  const pageIndex = widget ? pageIndexMap.get(widget.dict) ?? 0 : 0;

  return {
    id: name,
    name,
    type: fieldType,
    pageIndex,
    value: getFieldStringValue(rawField),
    defaultValue: "",
    required: rawField.isRequired(),
    readOnly: rawField.isReadOnly(),
    choices: getFieldChoices(rawField),
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

type ResolvedForm = ReturnType<PDFDocument["getForm"]>;

/** 执行单条 operation 并返回结果；调用方保证不抛错（错误封装为 failed 结果） */
async function applySingleOperation(
  pdf: PDFDocument,
  form: ResolvedForm,
  operation: PdfFormOperation,
): Promise<PdfFormOperationResult> {
  try {
    if (operation.type === "fill") {
      const field = findFieldById(form, operation.fieldId);
      if (!field) {
        return {
          id: operation.id,
          type: "fill",
          status: "failed",
          errorMessage: `表单字段不存在：${operation.fieldId}`,
        };
      }
      const fieldType = detectFieldType(field);
      if (fieldType === "text") {
        form.getTextField(operation.fieldId).setText(operation.value);
      } else if (fieldType === "checkbox") {
        const checkBox = form.getCheckBox(operation.fieldId);
        if (operation.value === "true" || operation.value === "1" || operation.value === "yes") {
          checkBox.check();
        } else {
          checkBox.uncheck();
        }
      } else if (fieldType === "dropdown") {
        form.getDropdown(operation.fieldId).select(operation.value);
      } else if (fieldType === "radio") {
        form.getRadioGroup(operation.fieldId).select(operation.value);
      } else {
        return {
          id: operation.id,
          type: "fill",
          status: "failed",
          errorMessage: `字段类型 "${fieldType}" 不支持程序化填写。`,
        };
      }
      return {
        id: operation.id,
        type: "fill",
        status: "applied",
        fieldId: operation.fieldId,
        value: operation.value,
      };
    }

    if (operation.type === "sign") {
      const field = findFieldById(form, operation.fieldId);
      if (!field) {
        return {
          id: operation.id,
          type: "sign",
          status: "failed",
          errorMessage: `签名字段不存在：${operation.fieldId}`,
        };
      }
      const widget = field.acroField.getWidgets()[0];
      if (!widget) {
        return {
          id: operation.id,
          type: "sign",
          status: "failed",
          errorMessage: `签名字段 "${operation.fieldId}" 没有可视控件，无法嵌入图片。`,
        };
      }
      const pageIndexMap = buildPageIndexMap(pdf);
      const pageIndex = pageIndexMap.get(widget.dict) ?? 0;
      const page: PDFPage = pdf.getPages()[pageIndex];
      const rectObj = widget.getRectangle();
      const image =
        operation.imageType === "png"
          ? await pdf.embedPng(operation.imageBytes)
          : await pdf.embedJpg(operation.imageBytes);

      page.drawImage(image, {
        x: rectObj.x,
        y: rectObj.y,
        width: rectObj.width,
        height: rectObj.height,
      });
      return {
        id: operation.id,
        type: "sign",
        status: "applied",
        fieldId: operation.fieldId,
        imageType: operation.imageType,
      };
    }

    // flatten
    const fieldCountBeforeFlatten = form.getFields().length;
    form.flatten();
    return {
      id: operation.id,
      type: "flatten",
      status: "applied",
      summary: {
        fieldCountBeforeFlatten,
        fieldCountAfterFlatten: 0,
        flattened: true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: operation.id,
      type: operation.type,
      status: "failed",
      errorMessage: message,
    };
  }
}
