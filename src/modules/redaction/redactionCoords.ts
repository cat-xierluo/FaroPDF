/**
 * DEC-114 review P0-1/P0-2：涂黑坐标转换 + 当前页 canvas 选择，提取为可测纯模块。
 *
 * 之前 AppShell.handleApplyRedaction 把这些逻辑内联，且用了虚构的 `.reader-canvas canvas`
 * 选择器（仓库无此类名）导致 querySelector 永远 null、涂黑功能在真实环境完全不可用，
 * 而单元测试全 mock DOM 掩盖了这个 bug。提取出来后选择器正确性有独立回归测试覆盖。
 *
 * 真实 DOM（ReaderCanvas）：`.reader__viewport > .pdf-page[data-page-number=N] > .page-container > canvas`
 */

import type { RedactionRegion } from "./redactionEngine";
import type { RedactionRegionDraft } from "./ui/RedactionOverlay";

/**
 * 选择当前页（1-based pageNumber）的 canvas。
 * 用 ReaderCanvas 给每页 section 加的 `data-page-number` 属性精确命中。
 * 找不到返回 null（调用方反馈「找不到当前页画布」）。
 */
export function selectPageCanvas(currentPageNumber: number): HTMLCanvasElement | null {
  const selector = `.pdf-page[data-page-number="${currentPageNumber}"] canvas`;
  return document.querySelector(selector) as HTMLCanvasElement | null;
}

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 把屏幕坐标（clientX/Y）的 region 列表转换为 PDF 用户空间坐标。
 *
 * - scale = PDF 视口尺寸 / canvas CSS 尺寸（处理 zoom / fit-width 缩放）
 * - x = (screenX - canvasRect.left) * scaleX
 * - y 翻转：PDF 原点左下，屏幕原点左上
 *        = viewport.height - (screenY - canvasRect.top) * scaleY - height * scaleY
 */
export function regionsScreenToPdf(
  regions: ReadonlyArray<RedactionRegionDraft>,
  canvasRect: CanvasRect,
  viewport: { width: number; height: number },
): RedactionRegion[] {
  const scaleX = viewport.width / Math.max(1, canvasRect.width);
  const scaleY = viewport.height / Math.max(1, canvasRect.height);
  return regions.map((r) => ({
    pageIndex: r.pageIndex,
    x: (r.x - canvasRect.left) * scaleX,
    y: viewport.height - (r.y - canvasRect.top) * scaleY - r.height * scaleY,
    width: r.width * scaleX,
    height: r.height * scaleY,
    color: r.color,
  }));
}
