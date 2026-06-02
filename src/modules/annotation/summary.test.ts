import { describe, expect, test } from "vitest";
import {
  buildAnnotationSummary,
  exportAnnotationSummaryHtml,
  exportAnnotationSummaryMarkdown,
} from "./summary";
import type { AnnotationDocumentRef, PdfAnnotation } from "../../shared/pdf/annotation";

const documentRef: AnnotationDocumentRef = {
  path: "/Users/lawyer/Case Files/真实案卷名称.pdf",
  fingerprint: "summary-fingerprint",
  pageCount: 8,
};

const annotations: PdfAnnotation[] = [
  {
    id: "ann-2",
    type: "note",
    pageIndex: 1,
    rects: [{ x: 24, y: 48, width: 24, height: 24 }],
    color: "#f2b84b",
    content: "核查付款节点。",
    createdAt: "2026-06-02T12:00:00.000Z",
    updatedAt: "2026-06-02T12:00:00.000Z",
  },
  {
    id: "ann-1",
    type: "highlight",
    pageIndex: 0,
    rects: [{ x: 12, y: 24, width: 160, height: 18 }],
    color: "#f7d46a",
    content: "核心条款",
    quote: "乙方应于三日内付款。",
    createdAt: "2026-06-02T12:01:00.000Z",
    updatedAt: "2026-06-02T12:01:00.000Z",
  },
];

describe("annotation summary export", () => {
  test("builds a file-name-free summary model grouped by page", () => {
    const summary = buildAnnotationSummary({
      document: documentRef,
      annotations,
      exportedAt: "2026-06-02T12:30:00.000Z",
    });

    expect(summary.documentLabel).toBe("PDF summary-fingerprint");
    expect(summary.sourceFileName).toBeUndefined();
    expect(summary.groups.map((group) => group.pageNumber)).toEqual([1, 2]);
    expect(summary.groups[0]?.items[0]).toMatchObject({
      id: "ann-1",
      type: "highlight",
      color: "#f7d46a",
      content: "核心条款",
      quote: "乙方应于三日内付款。",
    });
  });

  test("exports Markdown and HTML summaries without the real source file name", () => {
    const summary = buildAnnotationSummary({
      document: documentRef,
      annotations,
      exportedAt: "2026-06-02T12:30:00.000Z",
    });

    const markdown = exportAnnotationSummaryMarkdown(summary);
    const html = exportAnnotationSummaryHtml(summary);

    expect(markdown).toContain("# FaroPDF 批注摘要");
    expect(markdown).toContain("第 1 页");
    expect(markdown).toContain("核心条款");
    expect(html).toContain("<h1>FaroPDF 批注摘要</h1>");
    expect(html).toContain("第 2 页");
    expect(markdown).not.toContain("真实案卷名称");
    expect(html).not.toContain("真实案卷名称");
  });

  test("escapes HTML-capable content in Markdown and HTML summaries", () => {
    const summary = buildAnnotationSummary({
      document: { path: "/tmp/source.pdf", fingerprint: "unsafe<&>" },
      annotations: [
        {
          id: "ann-xss",
          type: "stamp",
          pageIndex: 0,
          rects: [{ x: 1, y: 2, width: 3, height: 4 }],
          color: "#fff\"><img src=x onerror=alert(1)>",
          quote: "<script>alert(1)</script>",
          content: "A&B <img onerror=alert(1)>",
          stamp: { label: "<img onerror=alert(1)>", name: "custom" },
          createdAt: "2026-06-02T12:00:00.000Z",
          updatedAt: "2026-06-02T12:00:00.000Z",
        },
      ],
      exportedAt: "2026-06-02T12:30:00.000Z",
    });

    const markdown = exportAnnotationSummaryMarkdown(summary);
    const html = exportAnnotationSummaryHtml(summary);

    expect(markdown).toContain("PDF unsafe&lt;&amp;&gt;");
    expect(markdown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("<img");
    expect(html).toContain("PDF unsafe&lt;&amp;&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
});
