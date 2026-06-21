import type { ReactElement } from "react";

/** ISS-NEW-C：右栏「文档摘要」面板输入（截图 61 对齐）。
 *  - fileName: 当前打开 PDF 的文件名
 *  - pageCount: 总页数
 *  - fileSizeBytes: 文件字节数
 *  - metadata: PDF 元数据（Info dict），字段可缺省
 */
export interface DocSummaryMetadata {
  title?: string;
  author?: string;
  producer?: string;
  creator?: string;
  createdAt?: string;
}

export interface DocSummary {
  fileName: string;
  pageCount: number;
  fileSizeBytes: number;
  metadata: DocSummaryMetadata;
}

export interface DocSummaryPanelViewProps {
  summary: DocSummary | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function DocSummaryPanelView({ summary }: DocSummaryPanelViewProps): ReactElement {
  if (summary === null) {
    return (
      <div data-testid="doc-summary-empty" className="doc-summary-empty">
        请先打开 PDF 文档以查看摘要。
      </div>
    );
  }

  const { fileName, pageCount, fileSizeBytes, metadata } = summary;

  return (
    <section className="doc-summary" aria-label="文档摘要" data-testid="doc-summary">
      <h3 className="doc-summary__filename">{fileName}</h3>
      <dl className="doc-summary__stats">
        <div className="doc-summary__stat">
          <dt>页数</dt>
          <dd data-testid="doc-summary-page-count">{pageCount} 页</dd>
        </div>
        <div className="doc-summary__stat">
          <dt>大小</dt>
          <dd data-testid="doc-summary-file-size">{formatBytes(fileSizeBytes)}</dd>
        </div>
      </dl>
      <dl className="doc-summary__metadata" data-testid="doc-summary-metadata">
        {metadata.title !== undefined ? (
          <div className="doc-summary__meta-row">
            <dt>标题</dt>
            <dd>{metadata.title}</dd>
          </div>
        ) : null}
        {metadata.author !== undefined ? (
          <div className="doc-summary__meta-row">
            <dt>作者</dt>
            <dd>{metadata.author}</dd>
          </div>
        ) : null}
        {metadata.producer !== undefined ? (
          <div className="doc-summary__meta-row">
            <dt>Producer</dt>
            <dd>{metadata.producer}</dd>
          </div>
        ) : null}
        {metadata.creator !== undefined ? (
          <div className="doc-summary__meta-row">
            <dt>Creator</dt>
            <dd>{metadata.creator}</dd>
          </div>
        ) : null}
        {metadata.createdAt !== undefined ? (
          <div className="doc-summary__meta-row">
            <dt>创建时间</dt>
            <dd>{formatDate(metadata.createdAt)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
