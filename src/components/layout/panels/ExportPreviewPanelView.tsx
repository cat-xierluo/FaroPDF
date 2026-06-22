import type { ReactElement } from "react";

/**
 * ISS-NEW-C 阶段 2 后续（2026-06-22 收口）：右栏「导出预览」面板。
 *
 * 范围：导出模式激活时显示当前 active tool + 关键参数摘要（页数 / 输出后缀 / 输出名格式）。
 * 不实际渲染 PDF 缩略图（v0.2 仅展示参数摘要 + 即将导出文件名格式）。
 *
 * 设计要点：
 *   1. 接收 activeTool（ExportDeliveryTool | null）+ pageCount + fileName（来自 reader controller）
 *   2. 6 个 tool 各自独立参数摘要行（text-watermark 文字内容 / image-watermark 文件路径 / header-footer 上下文字 / page-number 起始号 / bates 起始号 / compress 目标大小）
 *   3. 文件名格式遵循 `suggestOutputName`（shared/naming.ts），后缀与 tool 绑定
 *   4. 无文档（pageCount === null）时显示「请先打开 PDF 文档」提示
 */

export type ExportDeliveryTool =
  | "text-watermark"
  | "image-watermark"
  | "header-footer"
  | "page-number"
  | "bates"
  | "compress";

export interface ExportPreviewSummary {
  activeTool: ExportDeliveryTool | null;
  pageCount: number | null;
  fileName: string | null;
}

const TOOL_LABELS: Record<ExportDeliveryTool, string> = {
  "text-watermark": "文字水印",
  "image-watermark": "图片水印",
  "header-footer": "页眉页脚",
  "page-number": "添加页码",
  bates: "Bates 编号",
  compress: "压缩",
};

const TOOL_SUFFIXES: Record<ExportDeliveryTool, string> = {
  "text-watermark": "-text-watermarked",
  "image-watermark": "-image-watermarked",
  "header-footer": "-header-footer",
  "page-number": "-page-numbered",
  bates: "-bates",
  compress: "-compressed",
};

function buildPreviewName(fileName: string | null, tool: ExportDeliveryTool | null): string {
  if (fileName === null || tool === null) {
    return "—";
  }
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${stem}${TOOL_SUFFIXES[tool]}.pdf`;
}

export function ExportPreviewPanelView({ summary }: { summary: ExportPreviewSummary }): ReactElement {
  const { activeTool, pageCount, fileName } = summary;

  if (pageCount === null || fileName === null) {
    return (
      <div data-testid="export-preview-empty" className="export-preview-empty">
        请先打开 PDF 文档以查看导出预览。
      </div>
    );
  }

  if (activeTool === null) {
    return (
      <div data-testid="export-preview-no-tool" className="export-preview-no-tool">
        请选择导出工具。
      </div>
    );
  }

  return (
    <section
      className="export-preview"
      aria-label="导出预览"
      data-testid="export-preview"
    >
      <h3 className="export-preview__title">{TOOL_LABELS[activeTool]}</h3>
      <dl className="export-preview__stats" data-testid="export-preview-stats">
        <div className="export-preview__stat">
          <dt>源文件</dt>
          <dd data-testid="export-preview-file-name">{fileName}</dd>
        </div>
        <div className="export-preview__stat">
          <dt>页数</dt>
          <dd data-testid="export-preview-page-count">{pageCount} 页</dd>
        </div>
        <div className="export-preview__stat">
          <dt>输出文件名</dt>
          <dd data-testid="export-preview-output-name">{buildPreviewName(fileName, activeTool)}</dd>
        </div>
        <div className="export-preview__stat">
          <dt>输出策略</dt>
          <dd>新副本（默认不覆盖原始 PDF）</dd>
        </div>
      </dl>
    </section>
  );
}
