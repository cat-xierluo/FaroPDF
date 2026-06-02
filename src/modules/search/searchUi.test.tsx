import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "../../App";
import type { PdfPageText } from "../../shared/pdf/text";
import type { TextLayerStatus } from "../../shared/pdf/types";
import { loadPdfFromFile } from "../reader/pdfReaderService";

vi.mock("../reader/pdfReaderService", () => ({
  loadPdfFromFile: vi.fn(),
}));

function pageText(pageIndex: number, text: string, status: PdfPageText["status"] = "available"): PdfPageText {
  return {
    pageIndex,
    text,
    status,
    itemCount: text ? 1 : 0,
    charCount: text.length,
  };
}

function mockLoadedPdf({
  pages,
  textLayerStatus,
}: {
  pages: PdfPageText[];
  textLayerStatus: TextLayerStatus;
}) {
  const getPageText = vi.fn(async (pageIndex: number) => pages[pageIndex]);

  vi.mocked(loadPdfFromFile).mockImplementation(async (file: File) => ({
    metadata: {
      fileName: file.name,
      fingerprint: "search-fixture",
      pageCount: pages.length,
      initialViewport: {
        pageIndex: 0,
        width: 612,
        height: 792,
        rotation: 0,
        scale: 1,
      },
      textLayerStatus,
    },
    getPageViewport: vi.fn(),
    getPageText,
    destroy: vi.fn(async () => undefined),
  }));

  return getPageText;
}

describe("search UI integration", () => {
  beforeEach(() => {
    vi.mocked(loadPdfFromFile).mockReset();
  });

  test("searches a loaded PDF on demand and navigates between hits", async () => {
    const user = userEvent.setup();
    const getPageText = mockLoadedPdf({
      textLayerStatus: "available",
      pages: [
        pageText(0, "合同第一页约定付款义务。"),
        pageText(1, "附件目录没有关键词。"),
        pageText(2, "第三页记录合同履行情况。"),
      ],
    });
    render(<App />);

    const file = new File([new Uint8Array([1, 2, 3])], "search-fixture.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("选择本地 PDF 文件"), file);

    await waitFor(() => expect(loadPdfFromFile).toHaveBeenCalledWith(file));
    expect(getPageText).not.toHaveBeenCalled();

    await user.type(screen.getByRole("searchbox", { name: "全文搜索" }), "合同");

    expect(await screen.findByRole("region", { name: "搜索结果" })).toBeInTheDocument();
    expect(screen.getByText("命中 2 处")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /第 1 页/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /第 3 页/ })).toBeInTheDocument();
    expect(screen.getByText("当前页高亮：合同")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一个命中" }));

    expect(await screen.findByText("页码：3 / 3")).toBeInTheDocument();
  });

  test("shows an OCR hint when searching a scanned PDF without text layer", async () => {
    const user = userEvent.setup();
    mockLoadedPdf({
      textLayerStatus: "missing",
      pages: [pageText(0, "", "missing"), pageText(1, "", "missing")],
    });
    render(<App />);

    const file = new File([new Uint8Array([1, 2, 3])], "scan-fixture.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("选择本地 PDF 文件"), file);
    await user.type(screen.getByRole("searchbox", { name: "全文搜索" }), "案号");

    expect(await screen.findByText("当前 PDF 缺少可搜索文字层，建议先进行 OCR 后再搜索。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "转到 OCR" })).toBeInTheDocument();
  });
});
