import type { PdfAnnotation, PdfAnnotationInk, PdfAnnotationLine, PdfPoint, PdfRect } from "../../shared/pdf/annotation";

/**
 * 把任意矩形规整为左、上、宽、高都为非负数的形式。
 * 用于拖拽过程中起点和终点顺序不确定的场景。
 */
export function normalizeRect(input: { x: number; y: number; width: number; height: number }): PdfRect {
  const x = Math.min(input.x, input.x + input.width);
  const y = Math.min(input.y, input.y + input.height);
  const width = Math.abs(input.width);
  const height = Math.abs(input.height);

  return { x, y, width, height };
}

/** 把点的边界求出来用于高亮/箭头预览框 */
export function pointsToRect(start: PdfPoint, end: PdfPoint): PdfRect {
  return normalizeRect({ x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y });
}

/** 由一组点算出最小包围矩形 */
export function inkStrokesToRect(strokes: PdfPoint[][]): PdfRect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let hasPoint = false;

  for (const stroke of strokes) {
    for (const point of stroke) {
      hasPoint = true;
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (!hasPoint) {
    return null;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 把箭头/线段的两点打包为最小包围矩形 */
export function lineToRect(line: PdfAnnotationLine): PdfRect {
  return pointsToRect(line.start, line.end);
}

/** 重新计算 ink 批注的 rects 字段，确保首个 rect 是墨迹的最小包围盒 */
export function recomputeInkRects(ink: PdfAnnotationInk): PdfRect[] {
  const bounds = inkStrokesToRect(ink.strokes);
  return bounds ? [bounds] : [];
}

/** 重新计算箭头/直线批注的 rects 字段 */
export function recomputeLineRects(line: PdfAnnotationLine): PdfRect[] {
  return [lineToRect(line)];
}

/** 移除空矩形并保证矩形参数合法 */
export function sanitizeRects(rects: ReadonlyArray<PdfRect>): PdfRect[] {
  const result: PdfRect[] = [];

  for (const rect of rects) {
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
      continue;
    }

    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    result.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  return result;
}

/** 判断矩形是否完全落在视口边界内（PDF 坐标系，宽高均非负） */
export function isRectWithinBounds(rect: PdfRect, viewport: { width: number; height: number }): boolean {
  if (rect.x < 0 || rect.y < 0) {
    return false;
  }

  if (rect.x + rect.width > viewport.width) {
    return false;
  }

  if (rect.y + rect.height > viewport.height) {
    return false;
  }

  return true;
}

/** 把矩形裁剪到视口范围内，常用于防止用户拖出页外 */
export function clampRectToBounds(rect: PdfRect, viewport: { width: number; height: number }): PdfRect {
  const x = Math.max(0, Math.min(rect.x, viewport.width));
  const y = Math.max(0, Math.min(rect.y, viewport.height));
  const right = Math.max(0, Math.min(rect.x + rect.width, viewport.width));
  const bottom = Math.max(0, Math.min(rect.y + rect.height, viewport.height));

  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** 取一批矩形的外接包围盒，用于批注列表/缩略图标记 */
export function unionRects(rects: ReadonlyArray<PdfRect>): PdfRect | null {
  if (rects.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    if (rect.x < minX) minX = rect.x;
    if (rect.y < minY) minY = rect.y;
    if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
    if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 取一个批注的几何 bbox：优先用 unionRects(rects)，其次用 line/ink 的最外接，最后返回 null */
export function annotationBoundingRect(annotation: PdfAnnotation): PdfRect | null {
  const union = unionRects(annotation.rects);
  if (union) {
    return union;
  }

  if (annotation.line) {
    return lineToRect(annotation.line);
  }

  if (annotation.ink) {
    return inkStrokesToRect(annotation.ink.strokes);
  }

  return null;
}
