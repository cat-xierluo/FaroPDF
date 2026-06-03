/**
 * 文书整理 manifest 服务。
 *
 * 接收页面文本数组，生成文档 manifest，包含：
 * - 页级检查项（文本长度、摘要）
 * - 文书边界检测（空白页分隔、文本长度剧变）
 * - 规范命名建议（根据文本内容开头生成）
 *
 * 纯逻辑服务，不读取真实文件。
 */

import {
  BLANK_PAGE_BOUNDARY_CONFIDENCE,
  BLANK_PAGE_TEXT_THRESHOLD,
  DEFAULT_DOCUMENT_NAME,
  NAMING_CONFIDENCE_EMPTY,
  NAMING_CONFIDENCE_WITH_CONTENT,
  TEXT_LENGTH_CHANGE_CONFIDENCE,
  TEXT_LENGTH_CHANGE_RATIO,
  type CreateDocumentManifestInput,
  type DocumentBoundary,
  type DocumentManifest,
  type DocumentManifestPage,
  type DocumentNamingSuggestion,
} from "../../shared/organizer/types";
import {
  createManifestId,
  createTextSnippet,
  normalizeManifestInput,
  validateManifestInput,
} from "../../shared/organizer/defaults";

/**
 * 接收页面文本数组，生成文档 manifest。
 *
 * 步骤：
 * 1. 校验原始输入（类型检查）
 * 2. 规范化并再次校验
 * 3. 构建页级检查项
 * 4. 检测文书边界
 * 5. 生成规范命名建议
 */
export function createDocumentManifest(input: CreateDocumentManifestInput): DocumentManifest {
  // 先校验原始输入的元素类型
  if (!Array.isArray(input?.pageTexts)) {
    throw new Error("manifest 输入校验失败：pageTexts 必须是字符串数组。");
  }
  for (let i = 0; i < input.pageTexts.length; i++) {
    if (typeof input.pageTexts[i] !== "string") {
      throw new Error(`manifest 输入校验失败：pageTexts[${i}] 必须是字符串。`);
    }
  }

  const normalized = normalizeManifestInput(input);
  const validation = validateManifestInput(normalized);

  if (!validation.valid) {
    throw new Error(`manifest 输入校验失败：${validation.errors.join("；")}`);
  }

  const createdAt = normalized.createdAt ?? new Date().toISOString();
  const id = normalized.id ?? createManifestId(createdAt);
  const pageTexts = normalized.pageTexts;

  // 步骤 1：构建页级检查项
  const pages = buildPages(pageTexts);

  // 步骤 2：检测文书边界
  const suggestedBoundaries = detectBoundaries(pageTexts);

  // 步骤 3：将边界关联到页级检查项
  associateBoundariesToPages(pages, suggestedBoundaries);

  // 步骤 4：生成规范命名建议
  const suggestedNames = generateNamingSuggestions(pageTexts, suggestedBoundaries);

  return {
    id,
    pages,
    suggestedBoundaries,
    suggestedNames,
    createdAt,
  };
}

/** 构建页级检查项 */
function buildPages(pageTexts: string[]): DocumentManifestPage[] {
  return pageTexts.map((text, pageIndex) => ({
    pageIndex,
    textSnippet: createTextSnippet(text),
    textLength: text.length,
    detectedBoundaries: [],
  }));
}

/**
 * 检测文书边界。
 *
 * 启发式规则：
 * - 空白页或极少文字的页充当分隔符，边界位于该页之前（betweenPageIndex = i-1）
 * - 相邻页文本长度剧烈变化也可能标志着新文书开始
 *
 * boundary.betweenPageIndex 表示边界位于 betweenPageIndex 和 betweenPageIndex+1 之间。
 * 对于同一个 betweenPageIndex，合并所有信号。
 */
function detectBoundaries(pageTexts: string[]): DocumentBoundary[] {
  // 使用 map 收集每个 betweenPageIndex 的信号
  const boundaryMap = new Map<number, { signals: Set<string>; maxConfidence: number }>();

  // 辅助函数：添加信号到指定 betweenIndex
  const addSignal = (betweenIndex: number, signal: string, confidence: number) => {
    if (betweenIndex < 0 || betweenIndex >= pageTexts.length - 1) {
      return;
    }
    let entry = boundaryMap.get(betweenIndex);
    if (!entry) {
      entry = { signals: new Set<string>(), maxConfidence: 0 };
      boundaryMap.set(betweenIndex, entry);
    }
    entry.signals.add(signal);
    entry.maxConfidence = Math.max(entry.maxConfidence, confidence);
  };

  for (let i = 0; i < pageTexts.length; i++) {
    const trimmedLength = pageTexts[i].trim().length;
    const isBlank = trimmedLength < BLANK_PAGE_TEXT_THRESHOLD;

    // 规则 1：当前页是空白页 → 边界在此页之前（即前一页之后）
    if (isBlank && i > 0) {
      addSignal(i - 1, "blank-page", BLANK_PAGE_BOUNDARY_CONFIDENCE);
    }
  }

  // 规则 2：相邻页文本长度剧变
  for (let i = 0; i < pageTexts.length - 1; i++) {
    const currentLength = pageTexts[i].trim().length;
    const nextLength = pageTexts[i + 1].trim().length;

    // 下一页文本长度比当前页剧增（可能开始新文书）
    if (currentLength > 0 && nextLength > currentLength * TEXT_LENGTH_CHANGE_RATIO) {
      addSignal(i, "text-length-increase", TEXT_LENGTH_CHANGE_CONFIDENCE);
    } else if (currentLength === 0 && nextLength >= BLANK_PAGE_TEXT_THRESHOLD * 3) {
      // 从空白页到有实质内容页
      addSignal(i, "text-length-increase", TEXT_LENGTH_CHANGE_CONFIDENCE);
    }

    // 当前页文本长度比下一页剧增（当前页可能是一份文书的结尾）
    if (nextLength > 0 && currentLength > nextLength * TEXT_LENGTH_CHANGE_RATIO) {
      addSignal(i, "text-length-decrease", TEXT_LENGTH_CHANGE_CONFIDENCE);
    } else if (nextLength === 0 && currentLength >= BLANK_PAGE_TEXT_THRESHOLD * 3) {
      addSignal(i, "text-length-decrease", TEXT_LENGTH_CHANGE_CONFIDENCE);
    }
  }

  // 转换为数组并排序
  const boundaries: DocumentBoundary[] = [];
  const sortedIndexes = Array.from(boundaryMap.keys()).sort((a, b) => a - b);

  for (const betweenIndex of sortedIndexes) {
    const entry = boundaryMap.get(betweenIndex)!;
    boundaries.push({
      betweenPageIndex: betweenIndex,
      confidence: entry.maxConfidence,
      signals: Array.from(entry.signals),
    });
  }

  return boundaries;
}

/** 将边界索引关联到页级检查项 */
function associateBoundariesToPages(pages: DocumentManifestPage[], boundaries: DocumentBoundary[]): void {
  for (let boundaryIndex = 0; boundaryIndex < boundaries.length; boundaryIndex++) {
    const boundary = boundaries[boundaryIndex];
    // 边界关联到左右两页
    const leftPage = pages[boundary.betweenPageIndex];
    const rightPage = pages[boundary.betweenPageIndex + 1];
    if (leftPage) {
      leftPage.detectedBoundaries.push(boundaryIndex);
    }
    if (rightPage) {
      rightPage.detectedBoundaries.push(boundaryIndex);
    }
  }
}

/**
 * 生成规范命名建议。
 *
 * 根据检测到的边界将页面分段，为每段生成建议文件名。
 * 命名规则：提取段落第一页文本的前若干字符作为摘要，
 * 清理后生成建议名称。
 */
function generateNamingSuggestions(
  pageTexts: string[],
  boundaries: DocumentBoundary[],
): DocumentNamingSuggestion[] {
  if (pageTexts.length === 0) {
    return [];
  }

  // 根据边界计算分段
  const segments = computeSegments(pageTexts.length, boundaries);

  return segments.map(({ startPage, endPage }) => {
    // 取该段落第一页的非空文本
    const firstNonEmptyText = findFirstNonEmptyText(pageTexts, startPage, endPage);
    const suggestedName = generateDocumentName(firstNonEmptyText);
    const hasContent = firstNonEmptyText.length > 0;

    return {
      startPage,
      endPage,
      suggestedName,
      confidence: hasContent ? NAMING_CONFIDENCE_WITH_CONTENT : NAMING_CONFIDENCE_EMPTY,
    };
  });
}

/** 根据边界计算页面分段 */
function computeSegments(
  totalPages: number,
  boundaries: DocumentBoundary[],
): Array<{ startPage: number; endPage: number }> {
  if (totalPages === 0) {
    return [];
  }

  // 边界切割点：boundary.betweenPageIndex 之后切割
  const cutPoints = boundaries
    .map((b) => b.betweenPageIndex)
    .sort((a, b) => a - b);

  const segments: Array<{ startPage: number; endPage: number }> = [];
  let currentStart = 0;

  for (const cutPoint of cutPoints) {
    // 切割点 cutPoint 之后分段，即 [currentStart, cutPoint] 为一段
    if (cutPoint >= currentStart) {
      segments.push({ startPage: currentStart, endPage: cutPoint });
      currentStart = cutPoint + 1;
    }
  }

  // 最后一段
  if (currentStart < totalPages) {
    segments.push({ startPage: currentStart, endPage: totalPages - 1 });
  }

  return segments;
}

/** 找到分段内第一页非空文本 */
function findFirstNonEmptyText(pageTexts: string[], startPage: number, endPage: number): string {
  for (let i = startPage; i <= endPage; i++) {
    const trimmed = pageTexts[i]?.trim() ?? "";
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

/**
 * 根据文本内容生成文书名称。
 *
 * 规则：
 * - 取文本前若干字符
 * - 去除换行和多余空白
 * - 截断到合理长度
 */
function generateDocumentName(text: string): string {
  if (text.length === 0) {
    return DEFAULT_DOCUMENT_NAME;
  }

  // 折叠空白，取第一行或前 N 个字符
  const collapsed = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  const maxNameLength = 40;

  if (collapsed.length <= maxNameLength) {
    return collapsed;
  }

  // 尝试在最近的标点处截断
  const truncated = collapsed.slice(0, maxNameLength);
  const lastPunctuation = Math.max(
    truncated.lastIndexOf("。"),
    truncated.lastIndexOf("，"),
    truncated.lastIndexOf("、"),
    truncated.lastIndexOf("；"),
    truncated.lastIndexOf("："),
    truncated.lastIndexOf(" "),
    truncated.lastIndexOf("."),
    truncated.lastIndexOf(","),
  );

  if (lastPunctuation > maxNameLength * 0.5) {
    return truncated.slice(0, lastPunctuation);
  }

  return truncated + "...";
}
