/**
 * 文书整理 manifest 默认值与校验函数。
 */

import {
  BLANK_PAGE_TEXT_THRESHOLD,
  MAX_TEXT_SNIPPET_LENGTH,
  type CreateDocumentManifestInput,
  type DocumentManifest,
  type DocumentManifestPage,
  MANIFEST_ID_PREFIX,
} from "./types";

/** 校验 createDocumentManifest 输入 */
export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifestInput(input: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["manifest 输入必须是对象。"] };
  }

  if (!Array.isArray(input.pageTexts)) {
    errors.push("pageTexts 必须是字符串数组。");
  } else {
    if (input.pageTexts.length === 0) {
      errors.push("pageTexts 不能为空。");
    }
    for (let i = 0; i < input.pageTexts.length; i++) {
      if (typeof input.pageTexts[i] !== "string") {
        errors.push(`pageTexts[${i}] 必须是字符串。`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** 生成文本片段摘要：取前 MAX_TEXT_SNIPPET_LENGTH 个字符，折叠空白 */
export function createTextSnippet(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TEXT_SNIPPET_LENGTH) {
    return collapsed;
  }
  return collapsed.slice(0, MAX_TEXT_SNIPPET_LENGTH) + "...";
}

/** 判断是否为空白页（文本长度低于阈值） */
export function isBlankPage(textLength: number): boolean {
  return textLength < BLANK_PAGE_TEXT_THRESHOLD;
}

/** 创建空 manifest 页级检查项 */
export function createEmptyManifestPage(pageIndex: number): DocumentManifestPage {
  return {
    pageIndex,
    textSnippet: "",
    textLength: 0,
    detectedBoundaries: [],
  };
}

/** 生成 manifest id */
export function createManifestId(createdAt: string): string {
  return `${MANIFEST_ID_PREFIX}${createdAt}`;
}

/** 创建空 manifest（零页） */
export function createEmptyManifest(id: string, createdAt: string): DocumentManifest {
  return {
    id,
    pages: [],
    suggestedBoundaries: [],
    suggestedNames: [],
    createdAt,
  };
}

/** 将 CreateDocumentManifestInput 规范化，填充默认值 */
export function normalizeManifestInput(input: unknown): CreateDocumentManifestInput {
  if (!isRecord(input) || !Array.isArray(input.pageTexts)) {
    return { pageTexts: [] };
  }

  return {
    pageTexts: input.pageTexts.map((text: unknown) => (typeof text === "string" ? text : "")),
    id: typeof input.id === "string" ? input.id : undefined,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
