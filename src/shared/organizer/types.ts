/**
 * 文书整理 manifest 共享契约。
 *
 * 用于检测 PDF 中多个文书之间的边界，
 * 并为每个检测到的文书提供规范命名建议。
 * 所有类型均为纯数据，不含文件 I/O 逻辑。
 */

/** 页级检查项：记录每页文本的基本统计和检测到的边界信号 */
export interface DocumentManifestPage {
  /** 页码索引（从 0 开始） */
  pageIndex: number;
  /** 页面文本前 N 个字符的摘要（用于预览） */
  textSnippet: string;
  /** 页面文本字符数 */
  textLength: number;
  /** 该页上检测到的边界信号索引列表（指向 DocumentManifest.suggestedBoundaries） */
  detectedBoundaries: number[];
}

/** 文书边界信号：两页之间可能存在文书分界 */
export interface DocumentBoundary {
  /** 边界位于 betweenPageIndex 和 betweenPageIndex+1 之间 */
  betweenPageIndex: number;
  /** 置信度，0-1 之间 */
  confidence: number;
  /** 触发此边界的信号描述列表 */
  signals: string[];
}

/** 规范命名建议：为检测到的文书段落生成建议文件名 */
export interface DocumentNamingSuggestion {
  /** 起始页索引（含） */
  startPage: number;
  /** 结束页索引（含） */
  endPage: number;
  /** 建议的文件名（不含扩展名） */
  suggestedName: string;
  /** 命名置信度，0-1 之间 */
  confidence: number;
}

/** 文档 manifest：一份 PDF 的完整文书整理分析结果 */
export interface DocumentManifest {
  /** manifest 唯一标识 */
  id: string;
  /** 页级检查项列表 */
  pages: DocumentManifestPage[];
  /** 检测到的文书边界列表 */
  suggestedBoundaries: DocumentBoundary[];
  /** 规范命名建议列表 */
  suggestedNames: DocumentNamingSuggestion[];
  /** 创建时间 ISO 字符串 */
  createdAt: string;
}

/** createDocumentManifest 的输入参数 */
export interface CreateDocumentManifestInput {
  /** 每页的文本内容数组，数组索引即为页码索引 */
  pageTexts: string[];
  /** 可选 manifest id */
  id?: string;
  /** 可选创建时间 */
  createdAt?: string;
}

/** 文本片段摘要最大长度 */
export const MAX_TEXT_SNIPPET_LENGTH = 80;

/** 空白页文本字符数阈值：少于此值视为空白页 */
export const BLANK_PAGE_TEXT_THRESHOLD = 5;

/** 文本长度剧烈变化倍率阈值 */
export const TEXT_LENGTH_CHANGE_RATIO = 3;

/** 边界置信度：空白页分隔 */
export const BLANK_PAGE_BOUNDARY_CONFIDENCE = 0.85;

/** 边界置信度：文本长度剧变 */
export const TEXT_LENGTH_CHANGE_CONFIDENCE = 0.6;

/** 命名建议置信度 */
export const NAMING_CONFIDENCE_WITH_CONTENT = 0.7;
export const NAMING_CONFIDENCE_EMPTY = 0.3;

/** manifest id 前缀 */
export const MANIFEST_ID_PREFIX = "doc-manifest-";

/** 默认命名：无法识别内容时的回退名称 */
export const DEFAULT_DOCUMENT_NAME = "未命名文书";
