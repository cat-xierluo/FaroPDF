/**
 * 表单填写与签署共享契约
 *
 * 定义 AcroForm 字段类型、表单状态、填写输入和签名字段，
 * 供 forms 模块和未来 UI 层使用。
 */

// ---------------------------------------------------------------------------
// 字段类型
// ---------------------------------------------------------------------------

/** PDF AcroForm 字段类型 */
export const PDF_FORM_FIELD_TYPES = [
  "text",
  "checkbox",
  "radio",
  "dropdown",
  "button",
] as const;

export type PdfFormFieldType = (typeof PDF_FORM_FIELD_TYPES)[number];

// ---------------------------------------------------------------------------
// 字段定义
// ---------------------------------------------------------------------------

export interface PdfFormField {
  /** 字段唯一标识（pdf-lib 部分名称） */
  id: string;
  /** 字段名称 */
  name: string;
  /** 字段类型 */
  type: PdfFormFieldType;
  /** 字段所在页面（0 起始） */
  pageIndex: number;
  /** 当前值 */
  value: string;
  /** 默认值 */
  defaultValue: string;
  /** 是否必填 */
  required: boolean;
  /** 是否只读 */
  readOnly: boolean;
  /** 选项列表（用于复选框、单选框、下拉框） */
  choices: string[];
  /** 字段在页面上的位置和尺寸（pt） */
  rect: { x: number; y: number; width: number; height: number };
}

// ---------------------------------------------------------------------------
// 表单整体状态
// ---------------------------------------------------------------------------

export interface PdfFormState {
  /** 所有字段 */
  fields: PdfFormField[];
  /** 字段总数 */
  fieldCount: number;
  /** 是否存在可填写字段 */
  fillable: boolean;
}

// ---------------------------------------------------------------------------
// 填写输入
// ---------------------------------------------------------------------------

export interface PdfFormFillingInput {
  /** 目标字段 ID */
  fieldId: string;
  /** 要填入的值 */
  value: string;
}

// ---------------------------------------------------------------------------
// 签名字段
// ---------------------------------------------------------------------------

export type PdfSignatureImageType = "png" | "jpg";

export interface PdfSignatureField {
  /** 签名字段 ID */
  fieldId: string;
  /** 签名所在页（0 起始） */
  pageIndex: number;
  /** 签名字段在页面上的位置和尺寸（pt） */
  rect: { x: number; y: number; width: number; height: number };
  /** 签名图片类型 */
  imageType: PdfSignatureImageType;
}

// ---------------------------------------------------------------------------
// 辅助类型
// ---------------------------------------------------------------------------

/** 签名输入：指定字段 + 图片字节 */
export interface PdfSignatureInput {
  /** 目标签名字段 ID */
  fieldId: string;
  /** 签名图片字节 */
  imageBytes: Uint8Array;
  /** 签名图片类型 */
  imageType: PdfSignatureImageType;
}

// ---------------------------------------------------------------------------
// 验证函数
// ---------------------------------------------------------------------------

/** 检查是否为合法的表单字段类型 */
export function isPdfFormFieldType(value: unknown): value is PdfFormFieldType {
  return typeof value === "string" && (PDF_FORM_FIELD_TYPES as readonly string[]).includes(value);
}

/** 验证 PdfFormFillingInput 基本合法性 */
export function validateFormFillingInput(input: unknown): input is PdfFormFillingInput {
  if (input === null || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return typeof record.fieldId === "string" && record.fieldId.length > 0 && typeof record.value === "string";
}

/** 验证 PdfSignatureInput 基本合法性 */
export function validateSignatureInput(input: unknown): input is PdfSignatureInput {
  if (input === null || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return (
    typeof record.fieldId === "string" &&
    record.fieldId.length > 0 &&
    record.imageBytes instanceof Uint8Array &&
    record.imageBytes.length > 0 &&
    (record.imageType === "png" || record.imageType === "jpg")
  );
}
