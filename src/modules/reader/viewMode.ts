import type { PdfViewMode, ZoomPresetId } from "../../shared/pdf/types";

/** 适合宽度：按页面宽度匹配容器宽度。预留 16px 边距防止水平滚动条抖动。 */
const FIT_WIDTH_PADDING_PX = 16;

/** 计算"适合宽度"模式下的缩放：保证页面宽度不超过容器宽度。
 *  容器宽度无效（≤ 0）时返回 1 兜底，避免渲染出极小图。 */
export function calculateFitWidthZoom(pageWidth: number, containerWidth: number): number {
  if (containerWidth <= 0 || pageWidth <= 0) {
    return 1;
  }
  const safeContainer = containerWidth - FIT_WIDTH_PADDING_PX;
  return Math.max(0.25, Math.min(4, safeContainer / pageWidth));
}

/** 计算"适合页面"模式下的缩放：保证页面整体（宽和高）都不超过容器。
 *  容器尺寸或页面尺寸无效时返回 1 兜底。 */
export function calculateFitPageZoom(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (pageWidth <= 0 || pageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return 1;
  }
  const safeContainerWidth = containerWidth - FIT_WIDTH_PADDING_PX;
  const safeContainerHeight = containerHeight - FIT_WIDTH_PADDING_PX;
  const zoom = Math.min(safeContainerWidth / pageWidth, safeContainerHeight / pageHeight);
  return Math.max(0.25, Math.min(4, zoom));
}

/** 将预设值归一化到有效范围 [0.25, 4] */
export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, 0.25), 4);
}

/** 根据视图模式和容器尺寸，返回实际渲染使用的缩放。 */
export function resolveEffectiveZoom({
  viewMode,
  manualZoom,
  pageWidth,
  containerWidth,
}: {
  viewMode: PdfViewMode;
  manualZoom: number;
  pageWidth: number;
  containerWidth: number;
}): number {
  if (viewMode === "fit-width") {
    if (containerWidth <= 0) {
      return clampZoom(manualZoom);
    }
    return clampZoom(calculateFitWidthZoom(pageWidth, containerWidth));
  }
  return clampZoom(manualZoom);
}

/** 将 preset id 转成应用后的视图模式 + 缩放值（用于 setZoomPreset）。
 *  - 固定预设：保持当前 viewMode，设置 zoom
 *  - 适合宽度：viewMode 切换到 fit-width，zoom 设为当前手动值（UI 层用 effective zoom 覆盖）
 *  - 适合页面：viewMode 切换到 single，zoom 保持不变（由 ReaderCanvas 在 onZoomComputed 时回写）
 */
export function applyZoomPresetId(
  presetId: ZoomPresetId,
  currentViewMode: PdfViewMode,
  currentZoom: number,
): { viewMode: PdfViewMode; zoom: number; needsRecompute: boolean } {
  if (presetId === "fit-width") {
    return { viewMode: "fit-width", zoom: currentZoom, needsRecompute: true };
  }
  if (presetId === "fit-page") {
    return { viewMode: "single", zoom: currentZoom, needsRecompute: true };
  }
  const value = Number(presetId);
  if (Number.isFinite(value) && value > 0) {
    return { viewMode: currentViewMode === "fit-width" ? "continuous" : currentViewMode, zoom: clampZoom(value), needsRecompute: false };
  }
  return { viewMode: currentViewMode, zoom: currentZoom, needsRecompute: false };
}
