import type { PdfAnnotation } from "../../../shared/pdf/annotation";
import type { SummaryDimensionResult } from "../types";

const TYPE_LABELS: Record<string, string> = {
  highlight: "高亮",
  underline: "下划线",
  strikeout: "删除线",
  note: "备注",
  textbox: "文本框",
  rectangle: "矩形",
  arrow: "箭头",
  ink: "手写",
  stamp: "图章",
};

/** 导出为 Markdown 案件材料核查清单 */
export function exportChecklistMarkdown(
  dimensionResult: SummaryDimensionResult,
  documentLabel: string,
  exportedAt: string,
): string {
  const lines: string[] = [
    "# 批注摘要",
    "",
    `- 文档：${escapeMd(documentLabel)}`,
    `- 导出时间：${escapeMd(exportedAt)}`,
    `- 分组维度：${escapeMd(dimensionResult.dimension)}`,
    "",
    `## ${dimensionResult.dimension}`,
    "",
  ];

  for (const group of dimensionResult.groups) {
    lines.push(`- ${escapeMd(group.displayTitle)}（${group.count} 个批注）`);
    for (const sample of group.samples) {
      const preview = formatAnnotationPreview(sample);
      lines.push(`  - [ ] ${escapeMd(preview)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatAnnotationPreview(annotation: PdfAnnotation): string {
  const typeLabel = TYPE_LABELS[annotation.type] ?? annotation.type;
  const page = annotation.pageIndex + 1;
  const text = annotation.content?.trim() || annotation.quote?.trim() || "";
  const stampLabel = annotation.stamp?.label?.trim();
  const parts = [`${typeLabel} · 第 ${page} 页`];
  if (stampLabel) parts.push(`图章：${stampLabel}`);
  if (text) parts.push(text.length > 30 ? text.slice(0, 30) + "…" : text);
  return parts.join(" · ");
}

function escapeMd(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
