import { useCallback, useMemo, type ReactElement } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import "./SearchResultsPanel.css";

/** 搜索结果右栏的历史 skeleton。
 *
 * R06 只证明搜索结果面板、命中高亮和结果列表存在；旧 catalog 的固定四段与具体
 * footer 不是现行合同。组件当前只消费 results 并暴露回调，真实层级等待 M1 量测。
 */

export interface SearchHitItem {
  id: string;
  /** 1-based 页码 */
  pageNumber: number;
  /** 行号（1-based，仅展示；非匹配必填） */
  lineNumber: number;
  /** 命中片段（关键词已包含其中） */
  snippet: string;
}

export interface SearchResultsPanelProps {
  query?: string;
  results?: ReadonlyArray<SearchHitItem>;
  activeHitId?: string | null;
  onChangeQuery?: (query: string) => void;
  onSelectHit?: (hitId: string) => void;
  onJumpPrevious?: () => void;
  onJumpNext?: () => void;
  ocrHint?: { visible: boolean; message: string; actionLabel: string };
  onRequestOcr?: () => void;
  /** 点击「回到第 1 项」或关闭按钮 → onClose（v0.2：折叠右栏回到默认派生） */
  onClose?: () => void;
}

function highlightSnippet(snippet: string, query: string): ReactElement {
  const trimmed = query.trim();
  if (!trimmed) {
    return <>{snippet}</>;
  }
  // 当前本地高亮实现；不声称与 PDF Expert 视觉一致。
  const lower = snippet.toLowerCase();
  const needle = trimmed.toLowerCase();
  const segments: Array<{ text: string; matched: boolean }> = [];
  let cursor = 0;
  while (cursor < snippet.length) {
    const found = lower.indexOf(needle, cursor);
    if (found === -1) {
      segments.push({ text: snippet.slice(cursor), matched: false });
      break;
    }
    if (found > cursor) {
      segments.push({ text: snippet.slice(cursor, found), matched: false });
    }
    segments.push({ text: snippet.slice(found, found + needle.length), matched: true });
    cursor = found + needle.length;
  }
  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark key={index} className="search-panel__hit-mark" data-testid="search-hit-mark">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function SearchResultsPanel({
  query = "",
  results = [],
  activeHitId = null,
  onChangeQuery,
  onSelectHit,
  onJumpPrevious,
  onJumpNext,
  ocrHint,
  onRequestOcr,
  onClose,
}: SearchResultsPanelProps): ReactElement {
  const hitCount = results.length;
  const activeIndex = useMemo(
    () => (activeHitId ? results.findIndex((hit) => hit.id === activeHitId) : -1),
    [activeHitId, results],
  );
  const groupedResults = useMemo(() => {
    const groups = new Map<number, SearchHitItem[]>();
    for (const hit of results) {
      const pageHits = groups.get(hit.pageNumber) ?? [];
      pageHits.push(hit);
      groups.set(hit.pageNumber, pageHits);
    }
    return Array.from(groups.entries());
  }, [results]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <section className="search-panel" data-testid="search-results-panel" aria-label="搜索结果">
      {/* 段 1：header */}
      <header className="search-panel__header">
        <div className="search-panel__header-nav" aria-label="搜索命中导航" role="toolbar">
          <button aria-label="上一个命中" disabled={hitCount === 0} onClick={() => onJumpPrevious?.()} type="button">
            <ChevronLeft aria-hidden="true" size={14} />
          </button>
          <button aria-label="下一个命中" disabled={hitCount === 0} onClick={() => onJumpNext?.()} type="button">
            <ChevronRight aria-hidden="true" size={14} />
          </button>
        </div>
        <span>
          已找到 <span className="search-panel__count" data-testid="search-results-count">{hitCount}</span> 项
        </span>
      </header>

      {/* 段 2：输入框 + X 关闭 */}
      <div className="search-panel__query">
        <input
          aria-label="搜索关键词"
          className="search-panel__query-input"
          data-testid="search-results-query"
          onChange={(event) => onChangeQuery?.(event.target.value)}
          placeholder="输入关键词..."
          type="search"
          value={query}
        />
        <button
          aria-label="关闭搜索结果"
          className="search-panel__query-close"
          data-testid="search-results-close"
          onClick={handleClose}
          type="button"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* 段 3：命中列表 */}
      {ocrHint?.visible ? (
        <div className="search-panel__ocr-hint">
          <p>{ocrHint.message}</p>
          <button type="button" onClick={() => onRequestOcr?.()}>{ocrHint.actionLabel}</button>
        </div>
      ) : hitCount === 0 ? (
        <p className="search-panel__empty" data-testid="search-results-empty">
          {query.trim().length === 0 ? "输入关键词开始搜索" : "暂无命中"}
        </p>
      ) : (
        <ol className="search-panel__hits" aria-label="搜索命中列表">
          {groupedResults.map(([pageNumber, pageHits]) => (
            <li className="search-panel__page-group" key={pageNumber}>
              <header className="search-panel__page-header">
                <span>页面 {pageNumber}</span>
                <span>{pageHits.length} 个项目</span>
              </header>
              <ol>
                {pageHits.map((hit) => {
                  const active = hit.id === activeHitId;
                  return (
                    <li key={hit.id}>
                      <button
                        aria-pressed={active}
                        className={"search-panel__hit" + (active ? " search-panel__hit--active" : "")}
                        data-hit-id={hit.id}
                        data-testid="search-results-item"
                        onClick={() => onSelectHit?.(hit.id)}
                        type="button"
                      >
                        <span className="search-panel__hit-line">Line {hit.lineNumber}</span>
                        <span className="search-panel__hit-snippet">{highlightSnippet(hit.snippet, query)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {/* 段 4：footer — 回到第 1 项 + 页码导航 */}
      {hitCount > 0 ? (
        <footer aria-hidden="true" className="search-panel__footer">
          <button
            className="search-panel__footer-button search-panel__footer-button--primary"
            data-testid="search-results-jump-first"
            disabled={hitCount === 0}
            onClick={() => {
              const first = results[0];
              if (first) onSelectHit?.(first.id);
            }}
            type="button"
          >
            回到第 1 项
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              aria-label="上一个命中"
              className="search-panel__footer-button"
              data-testid="search-results-prev"
              disabled={hitCount === 0}
              onClick={() => onJumpPrevious?.()}
              type="button"
            >
              <ChevronLeft size={12} aria-hidden="true" />
            </button>
            <span data-testid="search-results-position">
              {activeIndex >= 0 ? `${activeIndex + 1} / ${hitCount}` : `0 / ${hitCount}`}
            </span>
            <button
              aria-label="下一个命中"
              className="search-panel__footer-button"
              data-testid="search-results-next"
              disabled={hitCount === 0}
              onClick={() => onJumpNext?.()}
              type="button"
            >
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
