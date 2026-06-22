import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportPreviewPanelView, type ExportPreviewSummary } from "./ExportPreviewPanelView";

function makeSummary(overrides: Partial<ExportPreviewSummary> = {}): ExportPreviewSummary {
  return {
    activeTool: "text-watermark",
    fileName: "卷宗材料.pdf",
    pageCount: 12,
    ...overrides,
  };
}

describe("ExportPreviewPanelView（ISS-NEW-C 阶段 2 后续 2026-06-22 收口）", () => {
  test("无文档（pageCount=null）显示「请先打开 PDF 文档」", () => {
    render(<ExportPreviewPanelView summary={makeSummary({ pageCount: null })} />);
    expect(screen.getByTestId("export-preview-empty")).toBeInTheDocument();
  });

  test("无 activeTool 显示「请选择导出工具」", () => {
    render(<ExportPreviewPanelView summary={makeSummary({ activeTool: null })} />);
    expect(screen.getByTestId("export-preview-no-tool")).toBeInTheDocument();
  });

  test("text-watermark 显示中文 label + 源文件名 + 页数 + 输出文件名（含 -text-watermarked 后缀）", () => {
    render(<ExportPreviewPanelView summary={makeSummary()} />);
    expect(screen.getByTestId("export-preview")).toBeInTheDocument();
    expect(screen.getByText("文字水印")).toBeInTheDocument();
    expect(screen.getByTestId("export-preview-file-name")).toHaveTextContent("卷宗材料.pdf");
    expect(screen.getByTestId("export-preview-page-count")).toHaveTextContent("12 页");
    expect(screen.getByTestId("export-preview-output-name")).toHaveTextContent("卷宗材料-text-watermarked.pdf");
  });

  test("compress 工具显示 -compressed 后缀", () => {
    render(
      <ExportPreviewPanelView
        summary={makeSummary({ activeTool: "compress" })}
      />,
    );
    expect(screen.getByTestId("export-preview-output-name")).toHaveTextContent("卷宗材料-compressed.pdf");
  });

  test("bates 工具显示 -bates 后缀", () => {
    render(
      <ExportPreviewPanelView summary={makeSummary({ activeTool: "bates" })} />,
    );
    expect(screen.getByTestId("export-preview-output-name")).toHaveTextContent("卷宗材料-bates.pdf");
  });
});
