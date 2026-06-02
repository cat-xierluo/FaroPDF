import type { PdfViewMode, TextLayerStatus } from "../../shared/pdf/types";

export const viewModeLabels: Record<PdfViewMode, string> = {
  continuous: "连续",
  single: "单页",
  double: "双页",
};

export const textLayerStatusLabels: Record<TextLayerStatus, string> = {
  unknown: "未知",
  available: "可用",
  partial: "部分",
  missing: "缺失",
  poor: "较差",
};

export function formatZoom(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}
