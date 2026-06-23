import type { AnnotationDocumentRef, PdfAnnotation, PdfAnnotationType } from "../../shared/pdf/annotation";
import { sortAnnotations } from "./sidecar";

export interface AnnotationSummaryItem {
  id: string;
  type: PdfAnnotationType;
  typeLabel: string;
  color: string;
  content?: string;
  quote?: string;
  stampLabel?: string;
  updatedAt: string;
}

export interface AnnotationSummaryGroup {
  pageNumber: number;
  items: AnnotationSummaryItem[];
}

export interface AnnotationSummary {
  documentLabel: string;
  sourceFileName?: never;
  fingerprint?: string;
  pageCount?: number;
  exportedAt: string;
  totalCount: number;
  groups: AnnotationSummaryGroup[];
}

interface BuildAnnotationSummaryOptions {
  document: AnnotationDocumentRef;
  annotations: PdfAnnotation[];
  exportedAt: string;
}

const TYPE_LABELS: Record<PdfAnnotationType, string> = {
  highlight: "高亮",
  ellipse: "椭圆",
  "double-arrow": "双向箭头",
  line: "直线",
  underline: "下划线",
  strikeout: "删除线",
  note: "备注",
  textbox: "文本框",
  rectangle: "矩形",
  arrow: "箭头",
  ink: "手写",
  stamp: "图章",
};

export function buildAnnotationSummary(options: BuildAnnotationSummaryOptions): AnnotationSummary {
  const groupsByPage = new Map<number, AnnotationSummaryItem[]>();

  for (const annotation of sortAnnotations(options.annotations)) {
    const pageNumber = annotation.pageIndex + 1;
    const items = groupsByPage.get(pageNumber) ?? [];

    items.push({
      id: annotation.id,
      type: annotation.type,
      typeLabel: TYPE_LABELS[annotation.type],
      color: annotation.color,
      ...(annotation.content ? { content: annotation.content } : {}),
      ...(annotation.quote ? { quote: annotation.quote } : {}),
      ...(annotation.stamp?.label ? { stampLabel: annotation.stamp.label } : {}),
      updatedAt: annotation.updatedAt,
    });
    groupsByPage.set(pageNumber, items);
  }

  const fingerprint = options.document.fingerprint;

  return {
    documentLabel: fingerprint ? `PDF ${fingerprint}` : "PDF document",
    ...(fingerprint ? { fingerprint } : {}),
    ...(typeof options.document.pageCount === "number" ? { pageCount: options.document.pageCount } : {}),
    exportedAt: options.exportedAt,
    totalCount: options.annotations.length,
    groups: [...groupsByPage.entries()].map(([pageNumber, items]) => ({
      pageNumber,
      items,
    })),
  };
}

export function exportAnnotationSummaryMarkdown(summary: AnnotationSummary): string {
  const lines = [
    "# FaroPDF 批注摘要",
    "",
    `- 文档：${escapeMarkdownHtml(summary.documentLabel)}`,
    `- 导出时间：${escapeMarkdownHtml(summary.exportedAt)}`,
    `- 批注数量：${summary.totalCount}`,
  ];

  for (const group of summary.groups) {
    lines.push("", `## 第 ${group.pageNumber} 页`);

    for (const item of group.items) {
      lines.push(`- ${escapeMarkdownHtml(item.typeLabel)} · ${escapeMarkdownHtml(item.color)}`);

      if (item.stampLabel) {
        lines.push(`  - 图章：${escapeMarkdownHtml(item.stampLabel)}`);
      }

      if (item.quote) {
        lines.push(`  - 原文：${escapeMarkdownHtml(item.quote)}`);
      }

      if (item.content) {
        lines.push(`  - 内容：${escapeMarkdownHtml(item.content)}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function exportAnnotationSummaryHtml(summary: AnnotationSummary): string {
  const groups = summary.groups
    .map(
      (group) => `
    <section>
      <h2>第 ${group.pageNumber} 页</h2>
      <ul>
        ${group.items.map(renderSummaryItemHtml).join("\n        ")}
      </ul>
    </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>FaroPDF 批注摘要</title>
  </head>
  <body>
    <h1>FaroPDF 批注摘要</h1>
    <p>文档：${escapeHtml(summary.documentLabel)}</p>
    <p>导出时间：${escapeHtml(summary.exportedAt)}</p>
    <p>批注数量：${summary.totalCount}</p>
${groups}
  </body>
</html>
`;
}

function renderSummaryItemHtml(item: AnnotationSummaryItem): string {
  const details = [
    item.stampLabel ? `<div>图章：${escapeHtml(item.stampLabel)}</div>` : "",
    item.quote ? `<blockquote>${escapeHtml(item.quote)}</blockquote>` : "",
    item.content ? `<div>${escapeHtml(item.content)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<li><strong>${escapeHtml(item.typeLabel)}</strong> · <span>${escapeHtml(item.color)}</span>${details}</li>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdownHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
