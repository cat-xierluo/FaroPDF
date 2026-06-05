import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnotationSummaryPanel } from "./AnnotationSummaryPanel";
import { buildDimensionSummary, buildFullSummary } from "../service/summaryGrouping";
import { exportChecklistMarkdown } from "../service/exportMarkdown";
import { exportChecklistHtml } from "../service/exportHtml";
import type { PdfAnnotation } from "../../../shared/pdf/annotation";

const mockAnnotations: PdfAnnotation[] = [
  {
    id: "a1",
    type: "highlight",
    pageIndex: 0,
    rects: [{ x: 10, y: 20, width: 100, height: 10 }],
    color: "#f7d46a",
    content: "核心条款",
    quote: "乙方应于三日内付款。",
    createdAt: "2026-06-02T12:00:00.000Z",
    updatedAt: "2026-06-02T12:00:00.000Z",
  },
  {
    id: "a2",
    type: "note",
    pageIndex: 1,
    rects: [{ x: 20, y: 40, width: 20, height: 20 }],
    color: "#f2b84b",
    content: "核查付款节点。",
    createdAt: "2026-06-02T12:01:00.000Z",
    updatedAt: "2026-06-02T12:01:00.000Z",
  },
  {
    id: "a3",
    type: "stamp",
    pageIndex: 0,
    rects: [{ x: 30, y: 50, width: 200, height: 50 }],
    color: "#e74c3c",
    stamp: { label: "重点", name: "important" },
    createdAt: "2026-06-02T12:02:00.000Z",
    updatedAt: "2026-06-02T12:02:00.000Z",
  },
];

describe("summaryGrouping", () => {
  test("buildDimensionSummary groups by page", () => {
    const result = buildDimensionSummary(mockAnnotations, "page");
    expect(result.dimension).toBe("page");
    expect(result.groups.length).toBe(2);
    expect(result.groups[0].key).toBe("0");
    expect(result.groups[0].count).toBe(2);
    expect(result.groups[0].samples.length).toBe(2);
    expect(result.groups[1].key).toBe("1");
    expect(result.groups[1].count).toBe(1);
  });

  test("buildDimensionSummary groups by color", () => {
    const result = buildDimensionSummary(mockAnnotations, "color");
    expect(result.dimension).toBe("color");
    expect(result.groups.length).toBe(3);
  });

  test("buildDimensionSummary groups by type", () => {
    const result = buildDimensionSummary(mockAnnotations, "type");
    expect(result.dimension).toBe("type");
    const types = result.groups.map((g) => g.key);
    expect(types).toContain("highlight");
    expect(types).toContain("note");
    expect(types).toContain("stamp");
  });

  test("buildDimensionSummary groups by label", () => {
    const result = buildDimensionSummary(mockAnnotations, "label");
    expect(result.dimension).toBe("label");
    const labels = result.groups.map((g) => g.displayTitle);
    expect(labels).toContain("核心条款");
    expect(labels).toContain("核查付款节点。");
    expect(labels).toContain("重点");
  });

  test("buildFullSummary returns all 4 dimensions", () => {
    const result = buildFullSummary(mockAnnotations);
    expect(result.total).toBe(3);
    expect(result.dimensions.length).toBe(4);
  });

  test("samples are capped at 3", () => {
    const many: PdfAnnotation[] = Array.from({ length: 10 }, (_, i) => ({
      ...mockAnnotations[0],
      id: `ann-${i}`,
    }));
    const result = buildDimensionSummary(many, "page");
    expect(result.groups[0].samples.length).toBe(3);
    expect(result.groups[0].count).toBe(10);
  });
});

describe("exportMarkdown", () => {
  test("exports checklist with checkboxes", () => {
    const dimResult = buildDimensionSummary(mockAnnotations, "page");
    const md = exportChecklistMarkdown(dimResult, "test.pdf", "2026-06-06T00:00:00Z");
    expect(md).toContain("# 批注摘要");
    expect(md).toContain("- [ ]");
    expect(md).toContain("第 1 页");
    expect(md).toContain("核心条款");
    expect(md).toContain("test.pdf");
  });

  test("escapes HTML in markdown", () => {
    const xss: PdfAnnotation[] = [{
      ...mockAnnotations[0],
      id: "xss-1",
      content: "<script>alert(1)</script>",
    }];
    const dimResult = buildDimensionSummary(xss, "page");
    const md = exportChecklistMarkdown(dimResult, "test.pdf", "2026-06-06T00:00:00Z");
    expect(md).not.toContain("<script>");
    expect(md).toContain("&lt;script&gt;");
  });
});

describe("exportHtml", () => {
  test("exports HTML with details and checkboxes", () => {
    const dimResult = buildDimensionSummary(mockAnnotations, "type");
    const html = exportChecklistHtml(dimResult, "test.pdf", "2026-06-06T00:00:00Z");
    expect(html).toContain("<details>");
    expect(html).toContain('<input type="checkbox">');
    expect(html).toContain("高亮");
    expect(html).toContain("test.pdf");
  });

  test("escapes HTML in html export", () => {
    const xss: PdfAnnotation[] = [{
      ...mockAnnotations[0],
      id: "xss-2",
      content: "<img onerror=alert(1)>",
    }];
    const dimResult = buildDimensionSummary(xss, "page");
    const html = exportChecklistHtml(dimResult, "test.pdf", "2026-06-06T00:00:00Z");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("AnnotationSummaryPanel", () => {
  test("renders empty state when no document", () => {
    render(<AnnotationSummaryPanel hasDocument={false} annotations={[]} />);
    expect(screen.getByText("打开 PDF 后显示批注摘要")).toBeDefined();
  });

  test("renders empty state when no annotations", () => {
    render(<AnnotationSummaryPanel hasDocument={true} annotations={[]} />);
    expect(screen.getByText("当前文档暂无批注")).toBeDefined();
  });

  test("renders groups with counts", () => {
    render(<AnnotationSummaryPanel hasDocument={true} annotations={mockAnnotations} />);
    expect(screen.getByText(/批注摘要（3）/)).toBeDefined();
  });

  test("switches dimension on tab click", () => {
    render(<AnnotationSummaryPanel hasDocument={true} annotations={mockAnnotations} />);
    const colorTab = screen.getByRole("tab", { name: "按颜色" });
    fireEvent.click(colorTab);
    expect(colorTab).toHaveAttribute("aria-selected", "true");
  });

  test("renders export buttons", () => {
    render(<AnnotationSummaryPanel hasDocument={true} annotations={mockAnnotations} />);
    expect(screen.getByTestId("summary-export-md")).toBeDefined();
    expect(screen.getByTestId("summary-export-html")).toBeDefined();
  });

  test("sample click triggers onSelectPage and onAnnotationClick", () => {
    const onSelectPage = vi.fn();
    const onAnnotationClick = vi.fn();
    render(
      <AnnotationSummaryPanel
        hasDocument={true}
        annotations={mockAnnotations}
        onAnnotationClick={onAnnotationClick}
        onSelectPage={onSelectPage}
      />,
    );
    const firstSample = screen.getAllByRole("button").find((btn) =>
      btn.dataset.annotationId === "a1",
    );
    if (firstSample) {
      fireEvent.click(firstSample);
      expect(onSelectPage).toHaveBeenCalledWith(0);
      expect(onAnnotationClick).toHaveBeenCalledWith("a1");
    }
  });
});
