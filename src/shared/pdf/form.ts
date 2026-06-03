/**
 * 表单填写与签署共享契约
 *
 * 定义 AcroForm 字段类型、表单状态、填写输入、签名字段和批量执行入口，
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

// ---------------------------------------------------------------------------
// 扁平化摘要
// ---------------------------------------------------------------------------

/** 单次表单扁平化执行的结果摘要 */
export interface PdfFormFlattenSummary {
  /** 扁平化前表单字段数（只读，扁平化后 PDF 表单将不再有可编辑字段） */
  fieldCountBeforeFlatten: number;
  /** 扁平化后表单字段数；正常情况下为 0 */
  fieldCountAfterFlatten: number;
  /** 是否执行了真实扁平化（plan-only 时为 false） */
  flattened: boolean;
}

// ---------------------------------------------------------------------------
// 批量执行入口
// ---------------------------------------------------------------------------

export const PDF_FORM_OPERATION_TYPES = ["fill", "sign", "flatten"] as const;
export type PdfFormOperationType = (typeof PDF_FORM_OPERATION_TYPES)[number];

/** 单条表单操作：填写文本/勾选/单选/下拉 + 签名图片 + 扁平化 */
export type PdfFormOperation =
  | PdfFormFillOperation
  | PdfFormSignatureOperation
  | PdfFormFlattenOperation;

export interface PdfFormFillOperation {
  id: string;
  type: "fill";
  fieldId: string;
  value: string;
}

export interface PdfFormSignatureOperation {
  id: string;
  type: "sign";
  fieldId: string;
  imageBytes: Uint8Array;
  imageType: PdfSignatureImageType;
}

export interface PdfFormFlattenOperation {
  id: string;
  type: "flatten";
}

/** 批量表单操作请求 */
export interface PdfFormBatchRequest {
  /** 请求 id */
  id: string;
  /** PDF 字节（输入） */
  pdfBytes: Uint8Array;
  /** 依次执行的操作；按数组顺序消费前一操作的输出作为后一操作的输入 */
  operations: PdfFormOperation[];
  /** 触发时间（ISO 字符串） */
  requestedAt: string;
}

/** 单条操作的执行结果 */
export type PdfFormOperationResult =
  | { id: string; type: "fill"; status: "applied"; fieldId: string; value: string }
  | { id: string; type: "sign"; status: "applied"; fieldId: string; imageType: PdfSignatureImageType }
  | { id: string; type: "flatten"; status: "applied"; summary: PdfFormFlattenSummary }
  | { id: string; type: PdfFormOperationType; status: "failed"; errorMessage: string };

/** 批量表单操作结果 */
export interface PdfFormBatchResult {
  id: string;
  bytes: Uint8Array;
  appliedCount: number;
  failedCount: number;
  /** 单条操作结果列表，长度与请求 operations 一致；失败的 operation 会包含 errorMessage */
  results: PdfFormOperationResult[];
  completedAt: string;
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 判断是否为合法的表单操作类型 */
export function isPdfFormOperationType(value: unknown): value is PdfFormOperationType {
  return typeof value === "string" && (PDF_FORM_OPERATION_TYPES as readonly string[]).includes(value);
}

/** 判断对象是否为合法的 PdfFormOperation */
export function isPdfFormOperation(value: unknown): value is PdfFormOperation {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return false;
  if (record.type === "fill") {
    return typeof record.fieldId === "string" && record.fieldId.length > 0 && typeof record.value === "string";
  }
  if (record.type === "sign") {
    return (
      typeof record.fieldId === "string" &&
      record.fieldId.length > 0 &&
      record.imageBytes instanceof Uint8Array &&
      record.imageBytes.length > 0 &&
      (record.imageType === "png" || record.imageType === "jpg")
    );
  }
  if (record.type === "flatten") {
    return true;
  }
  return false;
}

/** 验证 PdfFormBatchRequest 基本合法性 */
export function validateFormBatchRequest(input: unknown): input is PdfFormBatchRequest {
  if (input === null || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    record.pdfBytes instanceof Uint8Array &&
    record.pdfBytes.length > 0 &&
    Array.isArray(record.operations) &&
    record.operations.length > 0 &&
    record.operations.every(isPdfFormOperation) &&
    typeof record.requestedAt === "string"
  );
}
