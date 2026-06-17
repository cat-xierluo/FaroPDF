/**
 * ISS-066 阶段 2 后续：扫描件裁边切算法
 *
 * 律师扫描卷宗常见问题：
 * - 扫描仪把 A4 内容放在大页（如 A3）的中心 → 4 周白边
 * - 扫描时未对齐 → 边缘有扫描黑边
 *
 * 用户场景：在页面管理工作台指定上下左右 margin（pt 单位），
 * 输出 PDF 裁掉这些边（每页用 setCropbox）。
 *
 * 实现：
 * - 用 pdf-lib `page.setCropbox(new PDFRect(x, y, width, height))`
 * - 裁剪 box = 原 MediaBox 缩小 margin
 * - 若裁剪后 width/height <= 0 抛错
 *
 * 注意：不做"auto-detect 白边"（需要 pixel 级别扫描，超出 PM 单 session TDD 范围）。
 * 用户传入明确 margin 值是 v0.2 实用版本，auto-detect 留 v0.3 后续。
 */

import { PDFDocument } from "pdf-lib";

export interface TrimMarginsOptions {
  /** 顶 margin (pt, ≥ 0) */
  top: number;
  /** 右 margin (pt, ≥ 0) */
  right: number;
  /** 底 margin (pt, ≥ 0) */
  bottom: number;
  /** 左 margin (pt, ≥ 0) */
  left: number;
  /** 仅裁剪指定页码范围（0-based；不传 = 全部页） */
  pageIndexes?: number[];
}

interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getPageBox(page: { getWidth: () => number; getHeight: () => number }): PageBox {
  return {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  };
}

function isValidTrimValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export async function trimPageMargins(
  bytes: Uint8Array,
  options: TrimMarginsOptions,
): Promise<Uint8Array> {
  const { top, right, bottom, left, pageIndexes } = options;

  // 校验
  for (const [name, value] of [
    ["top", top],
    ["right", right],
    ["bottom", bottom],
    ["left", left],
  ] as Array<[string, number]>) {
    if (!isValidTrimValue(value)) {
      throw new Error(`Invalid margin: ${name} must be a non-negative finite number, got ${value}`);
    }
  }

  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();

  // 决定要裁剪的页码
  const targetIndexes = pageIndexes ?? pages.map((_, i) => i);

  for (const idx of targetIndexes) {
    if (idx < 0 || idx >= pages.length) {
      throw new Error(`Page index out of range: ${idx} (document has ${pages.length} pages)`);
    }
    const page = pages[idx];
    const box = getPageBox(page);
    const newX = box.x + left;
    const newY = box.y + bottom;
    const newWidth = box.width - left - right;
    const newHeight = box.height - top - bottom;

    if (newWidth <= 0) {
      throw new Error(
        `Trimming page ${idx}: left + right margins (${left + right}pt) >= page width (${box.width}pt)`,
      );
    }
    if (newHeight <= 0) {
      throw new Error(
        `Trimming page ${idx}: top + bottom margins (${top + bottom}pt) >= page height (${box.height}pt)`,
      );
    }

    // pdf-lib setCropBox(x, y, width, height) 直接接受 4 个 number
    page.setCropBox(newX, newY, newWidth, newHeight);
    // 同步设置 MediaBox（让某些 reader 显示正确）
    page.setMediaBox(newX, newY, newWidth, newHeight);
  }

  return await pdf.save();
}
