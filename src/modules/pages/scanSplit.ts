/**
 * ISS-066 阶段 1：扫描清洁校正之拆双页 / 网格切 / 自定义断点切算法。
 *
 * 律师卷宗场景：
 * - A3 横向扫成单页双 A4 拼一起 → splitPagesByGrid(rows=1, cols=2) 拆成 2 个 A4 纵向
 * - A4 多面拼图扫成单页 → splitPagesByGrid(rows=2, cols=2) 切成 4 子页
 * - 自定义断点切（用户在缩略图上拖断点）→ splitPagesByBreakpoints
 *
 * 实现思路：用 pdf-lib `embedPage` 把源 page 嵌入为 embedded page，再用
 * `drawPage` 把它平移到新 page 的负坐标，让"切出来的子矩形"落在新 page
 * (0, 0) ~ (cellW, cellH) 区域内。**真切**，不是只改 cropbox。
 *
 * 后续 ISS-066 阶段 2 接 PageOrganizerWorkspace + commands.ts 入口。
 */

import { PDFDocument } from "pdf-lib";

export interface SplitGridOptions {
  /** 行数 (≥ 1) */
  rows: number;
  /** 列数 (≥ 1) */
  cols: number;
  /** 限定只切指定的 0-based pageIndex；默认所有页。 */
  pageIndexes?: number[];
}

export interface SplitBreakpointsOptions {
  /** 0-based pageIndex */
  pageIndex: number;
  /** 水平断点 y 坐标列表（pt，从下到上），切成 (count+1) 行 */
  horizontalBreaks?: number[];
  /** 垂直断点 x 坐标列表（pt，从左到右），切成 (count+1) 列 */
  verticalBreaks?: number[];
}

/**
 * 按 rows × cols 网格切每页，输出新 PDF。
 *
 * 切页顺序：行优先（从上到下，每行左到右）。
 * 子页大小 = 原页大小 / (cols × rows)。
 */
export async function splitPagesByGrid(
  pdfBytes: Uint8Array,
  options: SplitGridOptions,
): Promise<Uint8Array> {
  if (!Number.isInteger(options.rows) || options.rows < 1) {
    throw new Error(`Invalid grid options: rows must be ≥ 1, got ${options.rows}`);
  }
  if (!Number.isInteger(options.cols) || options.cols < 1) {
    throw new Error(`Invalid grid options: cols must be ≥ 1, got ${options.cols}`);
  }

  const sourcePdf = await PDFDocument.load(pdfBytes);
  const pageCount = sourcePdf.getPageCount();

  // 校验 pageIndexes
  const targetIndexes = new Set<number>(
    options.pageIndexes ?? Array.from({ length: pageCount }, (_, i) => i),
  );
  for (const idx of targetIndexes) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= pageCount) {
      throw new Error(`Invalid grid options: pageIndex ${idx} out of range [0, ${pageCount})`);
    }
  }

  const outputPdf = await PDFDocument.create();
  const { rows, cols } = options;

  for (let srcIdx = 0; srcIdx < pageCount; srcIdx += 1) {
    if (!targetIndexes.has(srcIdx)) {
      // 不切的页直接复制
      const [copied] = await outputPdf.copyPages(sourcePdf, [srcIdx]);
      outputPdf.addPage(copied);
      continue;
    }
    const srcPage = sourcePdf.getPage(srcIdx);
    const { width: srcWidth, height: srcHeight } = srcPage.getSize();
    const cellWidth = srcWidth / cols;
    const cellHeight = srcHeight / rows;
    const embedded = await outputPdf.embedPage(srcPage);

    // 行优先（PDF 坐标 y 向上，所以 row 0 对应顶部 = srcHeight - cellHeight）
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cellPage = outputPdf.addPage([cellWidth, cellHeight]);
        // 子页 (0,0) 应该映射到原页的 (col * cellWidth, srcHeight - (row+1) * cellHeight)
        // drawPage 把 embedded 整体绘制到 cellPage 上，offset 让目标矩形落入可见区
        cellPage.drawPage(embedded, {
          x: -col * cellWidth,
          y: -(rows - 1 - row) * cellHeight,
          width: srcWidth,
          height: srcHeight,
        });
      }
    }
  }

  return outputPdf.save();
}

/**
 * 按用户自定义断点切单页，输出新 PDF（其他页保留原样）。
 *
 * horizontalBreaks 切行（y 方向），verticalBreaks 切列（x 方向）。
 * 例如 horizontalBreaks=[400] verticalBreaks=[300] 切成 4 子页（2 行 × 2 列）。
 * 无断点时该页保持原样。
 */
export async function splitPagesByBreakpoints(
  pdfBytes: Uint8Array,
  options: SplitBreakpointsOptions,
): Promise<Uint8Array> {
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const pageCount = sourcePdf.getPageCount();

  if (!Number.isInteger(options.pageIndex) || options.pageIndex < 0 || options.pageIndex >= pageCount) {
    throw new Error(
      `Invalid breakpoints options: pageIndex ${options.pageIndex} out of range [0, ${pageCount})`,
    );
  }

  const outputPdf = await PDFDocument.create();

  for (let srcIdx = 0; srcIdx < pageCount; srcIdx += 1) {
    if (srcIdx !== options.pageIndex) {
      // 不切的页直接复制
      const [copied] = await outputPdf.copyPages(sourcePdf, [srcIdx]);
      outputPdf.addPage(copied);
      continue;
    }
    const srcPage = sourcePdf.getPage(srcIdx);
    const { width: srcWidth, height: srcHeight } = srcPage.getSize();

    // 计算 y 边界（PDF 坐标 y 向上，从 0 到 srcHeight）：[0, breaks..., srcHeight]
    const ySorted = [...(options.horizontalBreaks ?? [])]
      .filter((y) => Number.isFinite(y) && y > 0 && y < srcHeight)
      .sort((a, b) => a - b);
    const yBoundaries = [0, ...ySorted, srcHeight];

    // 计算 x 边界
    const xSorted = [...(options.verticalBreaks ?? [])]
      .filter((x) => Number.isFinite(x) && x > 0 && x < srcWidth)
      .sort((a, b) => a - b);
    const xBoundaries = [0, ...xSorted, srcWidth];

    if (ySorted.length === 0 && xSorted.length === 0) {
      // 不切，原样复制
      const [copied] = await outputPdf.copyPages(sourcePdf, [srcIdx]);
      outputPdf.addPage(copied);
      continue;
    }

    const embedded = await outputPdf.embedPage(srcPage);

    // 行优先：从顶部（高 y）开始
    for (let yi = yBoundaries.length - 1; yi >= 1; yi -= 1) {
      const yBottom = yBoundaries[yi - 1];
      const yTop = yBoundaries[yi];
      const cellHeight = yTop - yBottom;
      for (let xi = 0; xi < xBoundaries.length - 1; xi += 1) {
        const xLeft = xBoundaries[xi];
        const xRight = xBoundaries[xi + 1];
        const cellWidth = xRight - xLeft;
        const cellPage = outputPdf.addPage([cellWidth, cellHeight]);
        // 子页 (0,0) 映射到原页 (xLeft, yBottom)
        cellPage.drawPage(embedded, {
          x: -xLeft,
          y: -yBottom,
          width: srcWidth,
          height: srcHeight,
        });
      }
    }
  }

  return outputPdf.save();
}
