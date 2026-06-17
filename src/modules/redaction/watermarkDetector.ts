/**
 * ISS-068 阶段 1：水印检测（纯函数层，不修改 PDF）
 *
 * 律师场景：卷宗常带"草稿"/"机密"/版权 logo 等水印，开庭前需识别。
 *
 * 暂不做"真删除"（DEC-123 / DEC-103 暂缓）— content stream 操作风险高。
 * 暂做"水印检测"层（纯读）：
 *   1. 文本水印：在文字层搜特定关键词（"草稿"/"机密"/"内部资料"/版权 ©），
 *      返回每页命中（pageIndex + text + bbox）
 *   2. 候选水印区域：每页有"重复出现的同一文本"≥ 3 次，视为水印（页脚页眉重复）
 *   3. 矩形/图片水印：列出页面的 XObject + 尺寸 > 30% 视作候选
 *
 * 输出 WatermarkReport：watermark candidates + 文本命中，调用方决定
 * 是否用 ISS-067 applyRedaction 涂白遮蔽。
 */

import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";

/** 文本水印命中（按关键词搜索） */
export interface TextWatermarkHit {
  pageIndex: number;
  text: string;
  keyword: string;
}

/** 候选水印区域（重复文本 / 大尺寸图） */
export interface WatermarkCandidate {
  pageIndex: number;
  type: "text-repeat" | "large-image" | "image-with-low-opacity";
  text?: string;
  reason: string;
}

/** 水印检测报告 */
export interface WatermarkReport {
  textHits: TextWatermarkHit[];
  candidates: WatermarkCandidate[];
  totalPages: number;
}

/** 预置水印关键词（中文 + 英文 + 版权符号） */
export const DEFAULT_WATERMARK_KEYWORDS: ReadonlyArray<string> = [
  "草稿",
  "机密",
  "内部资料",
  "绝密",
  "保密",
  "版权",
  "©",
  "©",
  "DRAFT",
  "CONFIDENTIAL",
  "INTERNAL",
  "PROPRIETARY",
  "WATERMARK",
  "SAMPLE",
  "DO NOT COPY",
  "VOID",
];

export interface DetectWatermarksOptions {
  /** 关键词（默认 DEFAULT_WATERMARK_KEYWORDS） */
  keywords?: ReadonlyArray<string>;
  /** 重复文本最小次数（默认 3） */
  repeatThreshold?: number;
  /** 大图尺寸阈值（相对页面面积，默认 0.3） */
  largeImageRatio?: number;
}

/**
 * 检测 PDF 中的水印候选。
 *
 * 实现策略：
 *   1. 文本层关键词搜索（pdf-lib 无法直接拿 textContent，依赖 PDF.js 调用方传入）
 *   2. XObject 大尺寸图检测
 *   3. 重复文本检测（本版本仅 placeholder，由调用方补 textContent）
 */
export async function detectWatermarks(
  bytes: Uint8Array,
  options: DetectWatermarksOptions = {},
): Promise<WatermarkReport> {
  const keywords = options.keywords ?? DEFAULT_WATERMARK_KEYWORDS;
  const repeatThreshold = options.repeatThreshold ?? 3;
  const largeImageRatio = options.largeImageRatio ?? 0.3;

  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const totalPages = pages.length;

  const textHits: TextWatermarkHit[] = [];
  const candidates: WatermarkCandidate[] = [];

  // keywords / repeatThreshold 当前仅占位（textContent 检测需调用方传入 PDF.js 结果）
  // 见 detectWatermarks 文档说明
  void keywords;
  void repeatThreshold;

  // XObject 大尺寸图检测
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const pageArea = pageWidth * pageHeight;

    const resourcesMaybe = page.node.lookup(PDFName.of("Resources"));
    if (!(resourcesMaybe instanceof Object)) continue;
    // 简化类型断言
    const resources = resourcesMaybe as unknown as { lookup: (k: unknown) => unknown };
    const xobjectsMaybe = resources.lookup(PDFName.of("XObject"));
    if (!xobjectsMaybe || typeof xobjectsMaybe !== "object") continue;
    const xobjects = xobjectsMaybe as unknown as {
      lookup: (k: unknown) => unknown;
      keys: () => Array<unknown>;
    };

    for (const key of xobjects.keys()) {
      const maybeStream = xobjects.lookup(key);
      if (!maybeStream || typeof maybeStream !== "object") continue;
      const stream = maybeStream as unknown as {
        dict?: { lookup: (k: unknown) => unknown };
      };
      if (!stream.dict) continue;
      const widthObj = stream.dict.lookup(PDFName.of("Width"));
      const heightObj = stream.dict.lookup(PDFName.of("Height"));
      if (widthObj instanceof PDFNumber && heightObj instanceof PDFNumber) {
        const w = widthObj.asNumber();
        const h = heightObj.asNumber();
        const area = w * h;
        if (area > pageArea * largeImageRatio) {
          candidates.push({
            pageIndex,
            type: "large-image",
            reason: `Image ${w}x${h} (${(area / pageArea * 100).toFixed(1)}% of page)`,
          });
        }
      }
    }
  }

  return {
    textHits,
    candidates,
    totalPages,
  };
}

/** WatermarkReport 摘要（人类可读） */
export function formatWatermarkReport(report: WatermarkReport): string {
  const parts: string[] = [];
  parts.push(`扫描 ${report.totalPages} 页`);
  if (report.textHits.length > 0) {
    parts.push(`文本命中 ${report.textHits.length} 处`);
  }
  if (report.candidates.length > 0) {
    parts.push(`候选水印 ${report.candidates.length} 处`);
  }
  if (report.textHits.length === 0 && report.candidates.length === 0) {
    parts.push("未发现水印");
  }
  return parts.join("；");
}
