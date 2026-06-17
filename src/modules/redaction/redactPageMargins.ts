/**
 * ISS-067 阶段 2 后续：去页眉页脚（涂白 margin 区域）
 *
 * 律师卷宗场景：扫描合同 / 起诉状 / 判决书常带"页眉（页码 / 案件编号）"和
 * "页脚（签字栏 / 备注）"，提交法院前需要清洁。
 *
 * 实现：用 pdf-lib `applyRedaction` 在每页的 4 个 margin 区域绘制不透明
 * 矩形（默认白色 rgb(1,1,1)），覆盖原文。**真不可恢复**（content stream
 * 直接绘制，与 ISS-067 涂黑同套路）。
 *
 * 与 ISS-066 阶段 2 后续 `trimPageMargins` 的区别：
 * - `trimPageMargins` = 缩小 MediaBox / CropBox（页面尺寸改变）
 * - `redactPageMargins` = 涂白 margin 区域（页面尺寸不变，内容流覆盖）
 *
 * 用户按场景选择：保留原尺寸选涂白；缩小页面选 trim。
 */

import { PDFDocument, rgb } from "pdf-lib";
import type { RedactionRegion } from "./redactionEngine";

export interface RedactPageMarginsOptions {
  /** 顶 margin (pt, ≥ 0) */
  top: number;
  /** 底 margin (pt, ≥ 0) */
  bottom: number;
  /** 左 margin (pt, ≥ 0) */
  left: number;
  /** 右 margin (pt, ≥ 0) */
  right: number;
  /** 仅处理指定页码（0-based；不传 = 全部页） */
  pageIndexes?: number[];
  /** 涂白颜色（默认白色 rgb(1,1,1)） */
  color?: { r: number; g: number; b: number };
}

function isValidMargin(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * 构造 4 个 margin 区域（按需：top/bottom/left/right 各自是否 > 0）
 */
function buildMarginRegions(
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  options: Required<Omit<RedactPageMarginsOptions, "pageIndexes" | "color">>,
): RedactionRegion[] {
  const regions: RedactionRegion[] = [];
  const { top, bottom, left, right } = options;

  if (top > 0) {
    regions.push({ pageIndex, x: 0, y: pageHeight - top, width: pageWidth, height: top });
  }
  if (bottom > 0) {
    regions.push({ pageIndex, x: 0, y: 0, width: pageWidth, height: bottom });
  }
  if (left > 0) {
    regions.push({ pageIndex, x: 0, y: 0, width: left, height: pageHeight });
  }
  if (right > 0) {
    regions.push({ pageIndex, x: pageWidth - right, y: 0, width: right, height: pageHeight });
  }
  return regions;
}

/**
 * 涂白每页 4 个 margin 区域。
 * 与 applyRedaction 算法一致（page.drawRectangle），但聚合批量处理。
 */
export async function redactPageMargins(
  bytes: Uint8Array,
  options: RedactPageMarginsOptions,
): Promise<Uint8Array> {
  for (const [name, value] of [
    ["top", options.top],
    ["bottom", options.bottom],
    ["left", options.left],
    ["right", options.right],
  ] as Array<[string, number]>) {
    if (!isValidMargin(value)) {
      throw new Error(`Invalid margin: ${name} must be a non-negative finite number, got ${value}`);
    }
  }

  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const color = options.color ?? { r: 1, g: 1, b: 1 };
  const targetIndexes = options.pageIndexes ?? pages.map((_, i) => i);

  for (const idx of targetIndexes) {
    if (idx < 0 || idx >= pages.length) {
      throw new Error(`Page index out of range: ${idx} (document has ${pages.length} pages)`);
    }
    const page = pages[idx];
    const width = page.getWidth();
    const height = page.getHeight();
    const regions = buildMarginRegions(idx, width, height, {
      top: options.top,
      bottom: options.bottom,
      left: options.left,
      right: options.right,
    });

    const pdfColor = rgb(color.r, color.g, color.b);
    for (const region of regions) {
      page.drawRectangle({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        color: pdfColor,
        opacity: 1,
      });
    }
  }

  return await pdf.save();
}
