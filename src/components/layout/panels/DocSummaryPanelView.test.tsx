import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocSummaryPanelView, type DocSummary } from "./DocSummaryPanelView";

describe("DocSummaryPanelView (ISS-NEW-C)", () => {
  const sample: DocSummary = {
    fileName: "年报-Q4.pdf",
    pageCount: 42,
    fileSizeBytes: 3_145_728,
    metadata: {
      title: "2025 年报",
      author: "FaroPDF 测试组",
      producer: "FaroPDF",
      creator: "Microsoft Word",
      createdAt: "2025-12-31T10:00:00Z",
    },
  };

  test("渲染文件名（heading 形式）", () => {
    render(<DocSummaryPanelView summary={sample} />);
    expect(screen.getByRole("heading", { name: "年报-Q4.pdf" })).toBeTruthy();
  });

  test("渲染页数与文件大小（人类可读）", () => {
    render(<DocSummaryPanelView summary={sample} />);
    expect(screen.getByTestId("doc-summary-page-count").textContent).toContain("42");
    // 3,145,728 bytes ≈ 3 MB
    expect(screen.getByTestId("doc-summary-file-size").textContent).toMatch(/MB|KB|B/);
    // 显式断言确实包含数字，避免假阳性
    expect(screen.getByTestId("doc-summary-file-size").textContent).toMatch(/\d/);
  });

  test("渲染元数据：标题 / 作者 / Producer / Creator", () => {
    render(<DocSummaryPanelView summary={sample} />);
    const dl = screen.getByTestId("doc-summary-metadata");
    expect(dl.textContent).toContain("2025 年报");
    expect(dl.textContent).toContain("FaroPDF 测试组");
    expect(dl.textContent).toContain("Microsoft Word");
    expect(dl.textContent).toContain("FaroPDF");
  });

  test("缺失 metadata 字段时只展示已有字段，不报错", () => {
    const partial: DocSummary = {
      fileName: "minimal.pdf",
      pageCount: 1,
      fileSizeBytes: 1024,
      metadata: { title: "Mini" },
    };
    render(<DocSummaryPanelView summary={partial} />);
    const dl = screen.getByTestId("doc-summary-metadata");
    expect(dl.textContent).toContain("Mini");
    expect(dl.textContent).not.toContain("undefined");
  });

  test("无文档时（summary=null）显示空态", () => {
    render(<DocSummaryPanelView summary={null} />);
    expect(screen.getByTestId("doc-summary-empty")).toBeTruthy();
    expect(screen.getByTestId("doc-summary-empty").textContent).toMatch(/打开|no document|未打开/);
  });
});
