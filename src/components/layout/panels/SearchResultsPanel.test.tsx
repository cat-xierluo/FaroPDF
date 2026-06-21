import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchResultsPanel, type SearchHitItem } from "./SearchResultsPanel";

const HITS: ReadonlyArray<SearchHitItem> = [
  { id: "h1", pageNumber: 1, lineNumber: 3, snippet: "PDF Expert 风格搜索测试 PDF" },
  { id: "h2", pageNumber: 4, lineNumber: 12, snippet: "PDF 编辑模式 T 编辑视图" },
  { id: "h3", pageNumber: 7, lineNumber: 28, snippet: "更多 PDF 搜索命中条目" },
];

describe("SearchResultsPanel (ISS-NEW-I 段 1-4)", () => {
  test("空 query + 空 results → 空态提示", () => {
    render(<SearchResultsPanel />);
    expect(screen.getByTestId("search-results-panel")).toBeTruthy();
    expect(screen.getByTestId("search-results-count").textContent).toBe("0");
    expect(screen.getByTestId("search-results-empty").textContent).toContain("输入关键词");
  });

  test("有 results → 渲染全部命中 + Line N label + 关键词高亮", () => {
    render(<SearchResultsPanel query="PDF" results={HITS} />);
    expect(screen.getByTestId("search-results-count").textContent).toBe("3");
    const items = screen.getAllByTestId("search-results-item");
    expect(items.length).toBe(3);
    expect(screen.getByText(/Line 3/)).toBeTruthy();
    expect(screen.getByText(/Line 12/)).toBeTruthy();
    // 关键词高亮：每个 hit 含 "PDF" 至少一处 → 3 个 mark
    const marks = screen.getAllByTestId("search-hit-mark");
    expect(marks.length).toBeGreaterThanOrEqual(3);
  });

  test("输入框受控 → value 跟随 props", () => {
    render(<SearchResultsPanel query="PDF Expert" results={HITS} />);
    const input = screen.getByTestId("search-results-query") as HTMLInputElement;
    expect(input.value).toBe("PDF Expert");
  });

  test("输入框 onChange → 触发 onChangeQuery", () => {
    const onChangeQuery = vi.fn();
    render(<SearchResultsPanel onChangeQuery={onChangeQuery} query="" results={HITS} />);
    fireEvent.change(screen.getByTestId("search-results-query"), {
      target: { value: "新关键词" },
    });
    expect(onChangeQuery).toHaveBeenCalledWith("新关键词");
  });

  test("点击命中项 → 触发 onSelectHit(hitId)", () => {
    const onSelectHit = vi.fn();
    render(<SearchResultsPanel onSelectHit={onSelectHit} query="PDF" results={HITS} />);
    const items = screen.getAllByTestId("search-results-item");
    fireEvent.click(items[1]); // h2
    expect(onSelectHit).toHaveBeenCalledWith("h2");
  });

  test("activeHitId 命中 → 高亮 + footer 显示 2/3", () => {
    render(<SearchResultsPanel query="PDF" results={HITS} activeHitId="h2" />);
    const items = screen.getAllByTestId("search-results-item");
    expect(items[1].className).toContain("search-panel__hit--active");
    expect(screen.getByTestId("search-results-position").textContent).toBe("2 / 3");
  });

  test("无 activeHitId → footer 显示 0/3", () => {
    render(<SearchResultsPanel query="PDF" results={HITS} />);
    expect(screen.getByTestId("search-results-position").textContent).toBe("0 / 3");
  });

  test("footer：回到第 1 项 → 触发 onSelectHit(h1)", () => {
    const onSelectHit = vi.fn();
    render(<SearchResultsPanel onSelectHit={onSelectHit} query="PDF" results={HITS} activeHitId="h3" />);
    fireEvent.click(screen.getByTestId("search-results-jump-first"));
    expect(onSelectHit).toHaveBeenCalledWith("h1");
  });

  test("footer：上一个/下一个 → 触发 onJumpPrevious / onJumpNext", () => {
    const onJumpPrevious = vi.fn();
    const onJumpNext = vi.fn();
    render(
      <SearchResultsPanel
        onJumpNext={onJumpNext}
        onJumpPrevious={onJumpPrevious}
        query="PDF"
        results={HITS}
      />,
    );
    fireEvent.click(screen.getByTestId("search-results-prev"));
    fireEvent.click(screen.getByTestId("search-results-next"));
    expect(onJumpPrevious).toHaveBeenCalledTimes(1);
    expect(onJumpNext).toHaveBeenCalledTimes(1);
  });

  test("关闭按钮 → 触发 onClose", () => {
    const onClose = vi.fn();
    render(<SearchResultsPanel onClose={onClose} query="PDF" results={HITS} />);
    fireEvent.click(screen.getByTestId("search-results-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("空 query + 有 results → 显示「暂无命中」", () => {
    // 即使 query 非空但 results 空，显示「暂无命中」（提示用户还没命中）
    render(<SearchResultsPanel query="关键词" results={[]} />);
    expect(screen.getByTestId("search-results-empty").textContent).toContain("暂无命中");
  });
});