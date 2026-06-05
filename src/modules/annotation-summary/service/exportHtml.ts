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

/** 导出为 HTML 案件材料核查清单（含 <details> 折叠 + 内嵌 CSS） */
export function exportChecklistHtml(
  dimensionResult: SummaryDimensionResult,
  documentLabel: string,
  exportedAt: string,
): string {
  const sections = dimensionResult.groups
    .map(
      (group) => `
    <details>
      <summary>${escapeHtml(group.displayTitle)}（${group.count} 个批注）</summary>
      <ul>
        ${group.samples.map((sample) => `<li><label><input type="checkbox"> ${escapeHtml(formatAnnotationPreview(sample))}</label></li>`).join("\n        ")}
      </ul>
    </details>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>批注摘要</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
      h1 { font-size: 1.5rem; margin-bottom: 8px; }
      details { margin: 8px 0; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 12px; }
      summary { cursor: pointer; font-weight: 500; }
      ul { list-style: none; padding-left: 8px; }
      li { padding: 4px 0; }
      label { cursor: pointer; }
      .meta { color: #666; font-size: 0.875rem; margin: 4px 0; }
    </style>
  </head>
  <body>
    <h1>批注摘要</h1>
    <p class="meta">文档：${escapeHtml(documentLabel)}</p>
    <p class="meta">导出时间：${escapeHtml(exportedAt)}</p>
    <p class="meta">分组维度：${escapeHtml(dimensionResult.dimension)}</p>
    <h2>${escapeHtml(dimensionResult.dimension)}</h2>
${sections}
  </body>
</html>
`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
