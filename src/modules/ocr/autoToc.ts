/**
 * ISS-069 阶段 1：OCR 后自动生成目录（纯函数算法层）
 *
 * 扫描 PDF 文字层（OCR 后或天生带文字层的 PDF），按字号 + 字体 + 中文章节
 * 模式识别章节标题，构造 PDF outline 树。
 *
 * 纯函数：不依赖 PDF.js / pdf-lib runtime，只接收已抽取的 textItem。
 * 调用方负责：
 *   1) PDF.js `page.getTextContent({ includeMarkedContent: true })` 拉数据
 *   2) `extractTextItems` 统一格式
 *   3) `detectChapterHeadings` 出扁平 heading 列表
 *   4) `buildOutlineTree` 嵌套成 outline 树
 *   5) `writePdfOutline(pdfBytes, tree)` 把 outline 写入新 PDF 副本
 */

/** PDF.js textItem 抽取后的统一格式（与运行时解耦）。 */
export interface TextItemFeature {
  str: string;
  /** 字号（pt），已从 transform 矩阵解出 */
  height: number;
  /** PDF.js 内部字体名（g_font_N 形式；真实字体名由 getOperatorList 解析，本阶段不强制） */
  fontName: string;
  /** 页面 X 坐标（pt，PDF 用户空间） */
  x: number;
  /** 页面 Y 坐标（pt，PDF 用户空间） */
  y: number;
  /** 0-based 页码 */
  pageIndex: number;
}

/** 聚类结果：相同字号 + 字体归一组。 */
export interface TextItemCluster {
  height: number;
  fontName: string;
  count: number;
  itemIndices: number[];
}

/** 章节标题（扁平）。 */
export interface ChapterHeading {
  text: string;
  level: 1 | 2 | 3 | 4;
  pageIndex: number;
  x: number;
  y: number;
}

/** outline 树节点（递归）。 */
export interface ChapterHeadingNode extends ChapterHeading {
  children: ChapterHeadingNode[];
}

/** 抽取入参。 */
export interface ExtractTextItemsOptions {
  pageIndex: number;
}

/** PDF.js textContent 的最小子集（与运行时解耦）。 */
export interface PdfJsTextContentLike {
  items?: ReadonlyArray<Record<string, unknown> | undefined | null>;
}

// ---------------------------------------------------------------------------
// 章节模式识别
// ---------------------------------------------------------------------------

/**
 * 中文章节模式正则集合。
 *
 * - 第X章 / 第X节 / 第X条 / 第X款 / 第X项 / 第X编 — 律法 / 司法解释常用
 * - 阿拉伯数字 X.Y / X.Y.Z / X.Y.Z.W — 通用技术 / 合同文件
 * - 阿拉伯数字 X. / X、 — 简单顺序编号
 * - 证据X / 附件X — 律师卷宗高频
 * - （X） / (X) — 中文章内子级
 */
const CHINESE_NUMERAL = "一二三四五六七八九十百千零〇零壹贰叁肆伍陆柒捌玖拾佰仟";
const ARABIC_NUM = "0-9";

const CHAPTER_PATTERNS: ReadonlyArray<{ regex: RegExp; level: ChapterHeading["level"] }> = [
  // 第X章 / 第一节 / 第一条 / 第一款 / 第一项 / 第一编（H1）
  { regex: new RegExp(`^第[${CHINESE_NUMERAL}${ARABIC_NUM}]+(?:章|编)`), level: 1 },
  // 第X节（H2）
  { regex: new RegExp(`^第[${CHINESE_NUMERAL}${ARABIC_NUM}]+节`), level: 2 },
  // 第X条 / 第X款（H2）
  { regex: new RegExp(`^第[${CHINESE_NUMERAL}${ARABIC_NUM}]+(?:条|款)`), level: 2 },
  // 第X项（H3）
  { regex: new RegExp(`^第[${CHINESE_NUMERAL}${ARABIC_NUM}]+项`), level: 3 },
  // 阿拉伯数字 1.1.1.1 — 4 级（H4）
  { regex: new RegExp(`^\\d+\\.\\d+\\.\\d+\\.\\d+`), level: 4 },
  // 阿拉伯数字 1.1.1 — 3 级（H3）
  { regex: new RegExp(`^\\d+\\.\\d+\\.\\d+(?!\\.)`), level: 3 },
  // 阿拉伯数字 1.1 — 2 级（H2）
  { regex: new RegExp(`^\\d+\\.\\d+(?!\\.)`), level: 2 },
  // 简单 1. / 1、 — 1 级（H1）
  { regex: new RegExp(`^\\d+[、.]`), level: 1 },
  // 证据X / 附件X — 律师卷宗（H2，与节同级）
  { regex: new RegExp(`^(?:证据|附件)[${CHINESE_NUMERAL}${ARABIC_NUM}]+`), level: 2 },
  // （一） / (一) — 中文章内子级（H3）
  { regex: new RegExp(`^[（(][${CHINESE_NUMERAL}${ARABIC_NUM}]+[)）]`), level: 3 },
];

/** 标题长度上限：超过视为段落（防误匹配长文本）。 */
const HEADING_MAX_LENGTH = 50;

/** 判断一个 textItem 是否像章节标题。 */
function matchChapterPattern(text: string): { matched: boolean; level: ChapterHeading["level"] } {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > HEADING_MAX_LENGTH) {
    return { matched: false, level: 1 };
  }
  for (const { regex, level } of CHAPTER_PATTERNS) {
    if (regex.test(trimmed)) {
      return { matched: true, level };
    }
  }
  return { matched: false, level: 1 };
}

// ---------------------------------------------------------------------------
// 1. extractTextItems
// ---------------------------------------------------------------------------

/**
 * 从 PDF.js textContent 抽取标准化 textItem。
 *
 * PDF.js `transform` 是 6 元素变换矩阵 `[a, b, c, d, e, f]`：
 * - 字号（pt）= `sqrt(a² + b²)`（取 max(sqrt(a²+b²), sqrt(c²+d²))）
 * - 位置：`(e, f)`
 * - 忽略 marked content / 不可见项
 */
export function extractTextItems(
  textContent: PdfJsTextContentLike,
  options: ExtractTextItemsOptions,
): TextItemFeature[] {
  const { pageIndex } = options;
  const items = textContent.items ?? [];
  const result: TextItemFeature[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const str = item["str"];
    if (typeof str !== "string" || str.length === 0) {
      continue;
    }

    const transform = item["transform"];
    const height = item["height"];
    const fontName = item["fontName"];

    let pt: number;
    if (Array.isArray(transform) && transform.length >= 4) {
      const a = Number(transform[0]);
      const b = Number(transform[1]);
      const c = Number(transform[2]);
      const d = Number(transform[3]);
      const e = Number(transform[4]);
      const f = Number(transform[5]);
      const w = Math.hypot(a, b);
      const h = Math.hypot(c, d);
      pt = Math.max(w, h);
      const x = Number.isFinite(e) ? e : 0;
      const y = Number.isFinite(f) ? f : 0;
      const fn = typeof fontName === "string" ? fontName : "g_unknown";
      const reportedHeight = typeof height === "number" && Number.isFinite(height) ? height : pt;
      result.push({ str, height: reportedHeight, fontName: fn, x, y, pageIndex });
      continue;
    }

    if (typeof height === "number" && Number.isFinite(height)) {
      const fn = typeof fontName === "string" ? fontName : "g_unknown";
      result.push({ str, height, fontName: fn, x: 0, y: 0, pageIndex });
      continue;
    }

    // 无 transform 无 height 字段（罕见），fallback 12pt
    const fn = typeof fontName === "string" ? fontName : "g_unknown";
    result.push({ str, height: 12, fontName: fn, x: 0, y: 0, pageIndex });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. clusterBySizeAndFont
// ---------------------------------------------------------------------------

/** 字号归并精度（pt）：2pt 之内归为同一字号（容忍 OCR 扫描件字号浮动）。 */
const HEIGHT_CLUSTER_PRECISION = 2;

/**
 * 按字号 + 字体分组统计。
 * 排序：高字号 + 同字号高频次优先。
 * 律师扫描件字号常浮动 0.3-0.7pt，1pt 精度能容忍这种噪声。
 */
export function clusterBySizeAndFont(items: TextItemFeature[]): TextItemCluster[] {
  const buckets = new Map<string, TextItemCluster>();
  items.forEach((item, idx) => {
    const key = `${Math.round(item.height / HEIGHT_CLUSTER_PRECISION)}:${item.fontName}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.itemIndices.push(idx);
    } else {
      buckets.set(key, {
        height: Math.round(item.height / HEIGHT_CLUSTER_PRECISION) * HEIGHT_CLUSTER_PRECISION,
        fontName: item.fontName,
        count: 1,
        itemIndices: [idx],
      });
    }
  });

  return Array.from(buckets.values()).sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height;
    return b.count - a.count;
  });
}

// ---------------------------------------------------------------------------
// 3. detectChapterHeadings
// ---------------------------------------------------------------------------

/**
 * 从 textItem 列表识别章节标题。
 *
 * 算法：
 *   1) 按 CHINESE_NUMERAL 模式正则逐项匹配
 *   2) 命中项入 ChapterHeading 列表
 *   3) 保留原序（页面内由上至下，跨页按 pageIndex 升序）
 */
export function detectChapterHeadings(items: TextItemFeature[]): ChapterHeading[] {
  const headings: ChapterHeading[] = [];
  for (const item of items) {
    const { matched, level } = matchChapterPattern(item.str);
    if (!matched) {
      continue;
    }
    headings.push({
      text: item.str.trim(),
      level,
      pageIndex: item.pageIndex,
      x: item.x,
      y: item.y,
    });
  }
  return headings;
}

// ---------------------------------------------------------------------------
// 4. buildOutlineTree
// ---------------------------------------------------------------------------

/**
 * 扁平 heading 列表嵌套成 outline 树。
 *
 * 算法：栈式维护各级祖先。
 *   - level 升：入栈（成为上一级 child）
 *   - level 降：弹栈到 level - 1
 *   - level 同：替换栈顶同级，弹到新 level
 *   - level 跳跃（如 1→3）：补齐中间层（2），不丢节点
 */
export function buildOutlineTree(flat: ChapterHeading[]): ChapterHeadingNode[] {
  const roots: ChapterHeadingNode[] = [];
  /** 栈：栈顶 = 当前路径上最近一个更浅的 heading（即下一个 heading 的候选 parent） */
  const stack: ChapterHeadingNode[] = [];

  for (const heading of flat) {
    // 弹掉所有 level >= 当前 heading.level 的栈顶（同级或更深的旧节点）
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const node: ChapterHeadingNode = { ...heading, children: [] };
    const parent = stack[stack.length - 1];

    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

// ---------------------------------------------------------------------------
// 5. 便捷：合并到单页/多页入口
// ---------------------------------------------------------------------------

/** 多页 textContent → outline 树（合并所有页的 heading 后嵌套）。 */
export function buildOutlineTreeFromPages(
  pages: ReadonlyArray<PdfJsTextContentLike>,
): ChapterHeadingNode[] {
  const allItems: TextItemFeature[] = [];
  pages.forEach((content, pageIndex) => {
    allItems.push(...extractTextItems(content, { pageIndex }));
  });
  const flat = detectChapterHeadings(allItems);
  return buildOutlineTree(flat);
}

/** OCR 文本（每页纯文本串）→ outline 树。
 *
 * Rust `extract_ocr_text` 输出的 `OcrTextExtractionPage` 只有 `pageIndex + text`，
 * 无字号 / 字体 / 坐标。本函数按行 split，每行当 textItem（height 默认 12），
 * 章节正则仍可识别（中文章节模式自身有定位能力）。
 *
 * y 坐标不可知 → outline 项跳转 PDF 阅读器会落页首（这是 OCR 流程的固有限制）。
 */
export interface OcrPageLike {
  pageIndex: number;
  text: string;
}

export function buildOutlineTreeFromOcrText(
  pages: ReadonlyArray<OcrPageLike>,
): ChapterHeadingNode[] {
  const allItems: TextItemFeature[] = [];
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      allItems.push({
        str: trimmed,
        height: 12,
        fontName: "g_ocr",
        x: 0,
        y: 0,
        pageIndex: page.pageIndex,
      });
    }
  }
  const flat = detectChapterHeadings(allItems);
  return buildOutlineTree(flat);
}
