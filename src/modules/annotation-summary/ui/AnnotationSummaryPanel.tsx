import { useMemo, useState, useCallback } from "react";
import type { PdfAnnotation } from "../../../shared/pdf/annotation";
import { useAnnotationSummary } from "../hooks/useAnnotationSummary";
import { exportChecklistMarkdown } from "../service/exportMarkdown";
import { exportChecklistHtml } from "../service/exportHtml";
import {
  SUMMARY_DIMENSIONS,
  SUMMARY_DIMENSION_LABELS,
  type SummaryDimension,
} from "../types";
import "./AnnotationSummaryPanel.css";

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

export interface AnnotationSummaryPanelProps {
  hasDocument: boolean;
  annotations: ReadonlyArray<PdfAnnotation>;
  documentLabel?: string;
  onSelectPage?: (pageIndex: number) => void;
  onAnnotationClick?: (annotationId: string) => void;
}

export function AnnotationSummaryPanel({
  annotations,
  documentLabel = "PDF document",
  hasDocument,
  onAnnotationClick,
  onSelectPage,
}: AnnotationSummaryPanelProps) {
  const [activeDimension, setActiveDimension] = useState<SummaryDimension>("page");
  const { total, dimensionResult } = useAnnotationSummary(annotations, activeDimension);

  const handleExportMarkdown = useCallback(() => {
    const content = exportChecklistMarkdown(
      dimensionResult,
      documentLabel,
      new Date().toISOString(),
    );
    downloadTextFile(content, "annotation-summary.md", "text/markdown");
  }, [dimensionResult, documentLabel]);

  const handleExportHtml = useCallback(() => {
    const content = exportChecklistHtml(
      dimensionResult,
      documentLabel,
      new Date().toISOString(),
    );
    downloadTextFile(content, "annotation-summary.html", "text/html");
  }, [dimensionResult, documentLabel]);

  if (!hasDocument) {
    return (
      <aside className="annotation-summary" aria-label="批注摘要">
        <div className="annotation-summary__empty" role="status">
          <p>打开 PDF 后显示批注摘要</p>
        </div>
      </aside>
    );
  }

  if (annotations.length === 0) {
    return (
      <aside className="annotation-summary" aria-label="批注摘要">
        <header className="annotation-summary__header">
          <h2>批注摘要</h2>
        </header>
        <div className="annotation-summary__empty" role="status">
          <p>当前文档暂无批注</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="annotation-summary" aria-label="批注摘要">
      <header className="annotation-summary__header">
        <h2>批注摘要（{total}）</h2>
      </header>

      <div aria-label="分组维度" className="annotation-summary__dims" role="tablist">
        {SUMMARY_DIMENSIONS.map((dim) => (
          <button
            aria-selected={activeDimension === dim}
            className={
              "annotation-summary__dim-button" +
              (activeDimension === dim ? " annotation-summary__dim-button--active" : "")
            }
            data-dimension={dim}
            key={dim}
            onClick={() => setActiveDimension(dim)}
            role="tab"
            type="button"
          >
            {SUMMARY_DIMENSION_LABELS[dim]}
          </button>
        ))}
      </div>

      <ol aria-label={`${SUMMARY_DIMENSION_LABELS[activeDimension]} 分组`} className="annotation-summary__list">
        {dimensionResult.groups.map((group) => (
          <li className="annotation-summary__group" data-group-key={group.key} key={group.key}>
            <header className="annotation-summary__group-header">
              <span className="annotation-summary__group-title">{group.displayTitle}</span>
              <span className="annotation-summary__group-count">{group.count}</span>
            </header>
            <ul className="annotation-summary__samples">
              {group.samples.map((sample) => (
                <SampleRow
                  annotation={sample}
                  key={sample.id}
                  onAnnotationClick={onAnnotationClick}
                  onSelectPage={onSelectPage}
                />
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="annotation-summary__actions">
        <button
          className="annotation-summary__export-btn"
          data-testid="summary-export-md"
          onClick={handleExportMarkdown}
          type="button"
        >
          导出 Markdown
        </button>
        <button
          className="annotation-summary__export-btn"
          data-testid="summary-export-html"
          onClick={handleExportHtml}
          type="button"
        >
          导出 HTML
        </button>
      </div>
    </aside>
  );
}

interface SampleRowProps {
  annotation: PdfAnnotation;
  onAnnotationClick?: (annotationId: string) => void;
  onSelectPage?: (pageIndex: number) => void;
}

function SampleRow({ annotation, onAnnotationClick, onSelectPage }: SampleRowProps) {
  const typeLabel = TYPE_LABELS[annotation.type] ?? annotation.type;
  const textPreview = annotation.content?.trim() || annotation.quote?.trim() || "";
  const stampLabel = annotation.stamp?.label?.trim();

  function handleClick() {
    onSelectPage?.(annotation.pageIndex);
    onAnnotationClick?.(annotation.id);
  }

  return (
    <li className="annotation-summary__sample">
      <button
        aria-label={`${typeLabel} · 第 ${annotation.pageIndex + 1} 页`}
        className="annotation-summary__sample-btn"
        data-annotation-id={annotation.id}
        onClick={handleClick}
        type="button"
      >
        <span
          aria-hidden="true"
          className="annotation-summary__sample-color"
          style={{ backgroundColor: annotation.color }}
        />
        <span className="annotation-summary__sample-body">
          <span className="annotation-summary__sample-type">
            {typeLabel} · 第 {annotation.pageIndex + 1} 页
          </span>
          {stampLabel ? (
            <span className="annotation-summary__sample-stamp">图章：{stampLabel}</span>
          ) : null}
          {textPreview ? (
            <span className="annotation-summary__sample-text">
              {textPreview.length > 30 ? textPreview.slice(0, 30) + "…" : textPreview}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
