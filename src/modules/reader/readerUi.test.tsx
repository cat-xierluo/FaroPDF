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
    expect(screen.getAllByText("1 / 7")).toHaveLength(1);
    expect(screen.getAllByText("100%")).not.toHaveLength(0);
    expect(screen.getAllByText("连续")).not.toHaveLength(0);
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toHaveTextContent("第 1 页");
    expect(screen.getByText("文字层：可用")).toBeInTheDocument();
  });
});
