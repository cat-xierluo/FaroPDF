import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import App from "../../App";
import { loadPdfFromFile } from "./pdfReaderService";

vi.mock("./pdfReaderService", () => ({
  loadPdfFromFile: vi.fn(async (file: File) => ({
    metadata: {
      fileName: file.name,
      fingerprint: "ui-fixture",
      pageCount: 7,
      initialViewport: {
        pageIndex: 0,
        width: 612,
        height: 792,
        rotation: 0,
        scale: 1,
      },
      textLayerStatus: "available",
    },
    getPageViewport: vi.fn(),
    renderPageToCanvas: vi.fn(async () => undefined),
    renderThumbnail: vi.fn(async () => undefined),
    getRawTextContent: vi.fn(async () => null),
    getOutline: vi.fn(async () => []),
    destroy: vi.fn(async () => undefined),
  })),
}));

describe("reader UI integration", () => {
  test("opens a local PDF and exposes the reader state in the shell", async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File([new Uint8Array([1, 2, 3])], "case-bundle.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("选择本地 PDF 文件"), file);

    await waitFor(() => expect(loadPdfFromFile).toHaveBeenCalledWith(file));

    expect(screen.getAllByText("case-bundle.pdf")).not.toHaveLength(0);
    // 状态栏分页文案随 i18n 字典前缀（zh-CN: "页码：1 / 7"；en: "Page 1 / 7"），
    // 用 regex 锚定 "1 / 7" 同时忽略前缀，避免依赖默认语言。
    expect(screen.getAllByText(/\b1 \/ 7\b/)).toHaveLength(1);
    // statusBar.zoom 文案前缀（zh-CN: "缩放：100%"；en: "Zoom: 100%"），
    // 用 substring 匹配 "100%"：% 不是 \w，\b 在 % 后面不生效，用更宽松的 regex。
    expect(screen.getAllByText(/100%/)).not.toHaveLength(0);
    // statusBar.viewMode 文案（zh-CN: "视图模式：连续"；en: "View mode: 连续"）。
    expect(screen.getAllByText(/连续/)).not.toHaveLength(0);
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toHaveTextContent("第 1 页");
    expect(screen.getByText("文字层：可用")).toBeInTheDocument();
  });
});
