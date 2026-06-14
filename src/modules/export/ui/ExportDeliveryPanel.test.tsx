import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import type { ReaderController } from "../../reader";
import type { PdfExportRequest, PdfExportResult } from "../../../shared";
import { ExportDeliveryPanel } from "./ExportDeliveryPanel";

async function createSourcePdf(pageCount = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([200 + index * 10, 300]);
  }
  return pdf.save();
}

function makeReader(sourceBytes: Uint8Array, overrides: Partial<ReaderController> = {}): ReaderController {
  const pageCount = overrides.state?.document?.pageCount ?? 2;
  return {
    state: {
      status: "ready",
      defaults: { viewMode: "continuous", zoom: 1 },
      document: {
        documentId: "doc-export",
        path: "/case/source.pdf",
        fingerprint: "fp-export",
        name: "source.pdf",
        currentPage: 1,
        pageCount,
        zoom: 1,
        viewMode: "continuous",
        rotation: 0,
        dirty: false,
        textLayerStatus: "available",
        ocrStatus: "not-needed",
      },
      pageViewports: [],
      renderRange: { startPage: 1, endPage: pageCount, pageNumbers: Array.from({ length: pageCount }, (_, index) => index + 1) },
      errorMessage: undefined,
    },
    getCurrentFileName: vi.fn(() => "source.pdf"),
    getFileBytes: vi.fn(async () => new Uint8Array(sourceBytes)),
    saveUpdatedBytes: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as ReaderController;
}

function makeExportResult(bytes: Uint8Array, request: PdfExportRequest): PdfExportResult {
  return {
    id: request.id,
    bytes,
    destination: request.destination,
    summary: {
      inputPageCount: request.source.bytes.length > 0 ? 3 : 0,
      outputPageCount: 3,
      operationCount: request.operations.length,
      outputToolPlan: {
        entries: request.operations.map((operation) => ({
          operationId: operation.id,
          type: operation.type as "watermark",
          pageIndexes: "pageIndexes" in operation && operation.pageIndexes ? operation.pageIndexes : [],
          status: "applied",
          label: operation.type,
        })),
      },
      warnings: [],
    },
    completedAt: "2026-06-09T00:00:00.000Z",
  };
}

describe("ExportDeliveryPanel", () => {
  test("文字水印导出为新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf();
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="text-watermark"
      />,
    );

    fireEvent.change(screen.getByLabelText("内容"), { target: { value: "CONFIDENTIAL" } });
    fireEvent.change(screen.getByLabelText("透明度"), { target: { value: "20" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-text-watermarked.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("已添加文字水印，共 2 页。");
  });

  test("图片水印选择 PNG 后导出为新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf();
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="image-watermark"
      />,
    );

    const pngBytes = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
      0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156,
      99, 248, 15, 4, 0, 9, 251, 3, 253, 167, 111, 129, 45, 0, 0, 0, 0, 73, 69, 78,
      68, 174, 66, 96, 130,
    ]);
    const image = new File([pngBytes], "stamp.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("图片文件"), image);
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-image-watermarked.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("已添加图片水印，共 2 页。");
  });

  test("普通编号导出为新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf();
    const reader = makeReader(sourceBytes);
    const onSelectedToolChange = vi.fn();
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={onSelectedToolChange}
        reader={reader}
        selectedTool="page-number"
      />,
    );

    fireEvent.change(screen.getByLabelText("样式"), { target: { value: "{page}" } });
    fireEvent.change(screen.getByLabelText("起始号"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("位置"), { target: { value: "bottom-right" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-page-numbered.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("已添加页码，共 2 页。");
  });

  test("页眉页脚导出为新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(2);
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "CASE 2026-001" } });
    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "For review only" } });
    fireEvent.change(screen.getByLabelText("透明度"), { target: { value: "75" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-header-footer.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("已添加页眉页脚，共 2 页。");
  });

  test("页眉页脚选择奇数页时只把奇数显示页传给导出引擎", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(3);
    const reader = makeReader(sourceBytes, {
      state: {
        ...makeReader(sourceBytes).state,
        document: {
          ...makeReader(sourceBytes).state.document!,
          pageCount: 3,
        },
      },
    });
    const exportPdf = vi.fn(async (request: PdfExportRequest) => makeExportResult(sourceBytes, request));
    render(
      <ExportDeliveryPanel
        operationEngine={{ exportPdf }}
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "CASE 2026-001" } });
    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "For review only" } });
    fireEvent.change(screen.getByLabelText("应用范围"), { target: { value: "odd" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
    const request = exportPdf.mock.calls[0]?.[0];
    expect(request?.operations).toHaveLength(2);
    expect(request?.operations[0]).toMatchObject({ type: "watermark", pageIndexes: [0, 2] });
    expect(request?.operations[1]).toMatchObject({ type: "watermark", pageIndexes: [0, 2] });
  });

  test("页眉页脚默认全部页面时不向导出引擎传 pageIndexes", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(3);
    const reader = makeReader(sourceBytes, {
      state: {
        ...makeReader(sourceBytes).state,
        document: {
          ...makeReader(sourceBytes).state.document!,
          pageCount: 3,
        },
      },
    });
    const exportPdf = vi.fn(async (request: PdfExportRequest) => makeExportResult(sourceBytes, request));
    render(
      <ExportDeliveryPanel
        operationEngine={{ exportPdf }}
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    expect(screen.getByLabelText("应用范围")).toHaveValue("all");
    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "CASE 2026-001" } });
    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "For review only" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
    const request = exportPdf.mock.calls[0]?.[0];
    expect(request?.operations).toHaveLength(2);
    expect(request?.operations[0]).not.toHaveProperty("pageIndexes");
    expect(request?.operations[1]).not.toHaveProperty("pageIndexes");
    expect(request?.operations[0]).toMatchObject({
      watermark: { placement: "top-center" },
    });
    expect(request?.operations[1]).toMatchObject({
      watermark: { placement: "bottom-center" },
    });
  });

  test("页眉页脚可分别选择视觉位置并传给导出引擎", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(3);
    const reader = makeReader(sourceBytes, {
      state: {
        ...makeReader(sourceBytes).state,
        document: {
          ...makeReader(sourceBytes).state.document!,
          pageCount: 3,
        },
      },
    });
    const exportPdf = vi.fn(async (request: PdfExportRequest) => makeExportResult(sourceBytes, request));
    render(
      <ExportDeliveryPanel
        operationEngine={{ exportPdf }}
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "CASE 2026-001" } });
    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "For review only" } });

    const headerPosition = screen.getByRole("group", { name: "页眉位置" });
    const footerPosition = screen.getByRole("group", { name: "页脚位置" });
    await user.click(within(headerPosition).getByRole("button", { name: "右" }));
    await user.click(within(footerPosition).getByRole("button", { name: "左" }));

    expect(within(headerPosition).getByRole("button", { name: "右" })).toHaveAttribute("aria-pressed", "true");
    expect(within(footerPosition).getByRole("button", { name: "左" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
    const request = exportPdf.mock.calls[0]?.[0];
    expect(request?.operations).toHaveLength(2);
    expect(request?.operations[0]).toMatchObject({
      watermark: { placement: "top-right", text: "CASE 2026-001" },
    });
    expect(request?.operations[1]).toMatchObject({
      watermark: { placement: "bottom-left", text: "For review only" },
    });
  });

  test("页眉页脚位置选择与奇数页范围共存", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(3);
    const reader = makeReader(sourceBytes, {
      state: {
        ...makeReader(sourceBytes).state,
        document: {
          ...makeReader(sourceBytes).state.document!,
          pageCount: 3,
        },
      },
    });
    const exportPdf = vi.fn(async (request: PdfExportRequest) => makeExportResult(sourceBytes, request));
    render(
      <ExportDeliveryPanel
        operationEngine={{ exportPdf }}
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "ODD HEADER" } });
    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "ODD FOOTER" } });
    fireEvent.change(screen.getByLabelText("应用范围"), { target: { value: "odd" } });
    await user.click(within(screen.getByRole("group", { name: "页眉位置" })).getByRole("button", { name: "左" }));
    await user.click(within(screen.getByRole("group", { name: "页脚位置" })).getByRole("button", { name: "右" }));
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
    const request = exportPdf.mock.calls[0]?.[0];
    expect(request?.operations).toHaveLength(2);
    expect(request?.operations[0]).toMatchObject({
      pageIndexes: [0, 2],
      watermark: { placement: "top-left", text: "ODD HEADER" },
    });
    expect(request?.operations[1]).toMatchObject({
      pageIndexes: [0, 2],
      watermark: { placement: "bottom-right", text: "ODD FOOTER" },
    });
  });

  test("单页文档选择偶数页时阻止页眉页脚导出", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(1);
    const reader = makeReader(sourceBytes, {
      state: {
        ...makeReader(sourceBytes).state,
        document: {
          ...makeReader(sourceBytes).state.document!,
          pageCount: 1,
        },
      },
    });
    const exportPdf = vi.fn(async (request: PdfExportRequest) => makeExportResult(sourceBytes, request));
    render(
      <ExportDeliveryPanel
        operationEngine={{ exportPdf }}
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页眉"), { target: { value: "CASE 2026-001" } });
    fireEvent.change(screen.getByLabelText("应用范围"), { target: { value: "even" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    expect(screen.getByRole("alert")).toHaveTextContent("当前文档没有偶数页。");
    expect(exportPdf).not.toHaveBeenCalled();
    expect(reader.saveUpdatedBytes).not.toHaveBeenCalled();
  });

  test("证据编号导出为 Bates 新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(3);
    const reader = makeReader(sourceBytes);
    const onSelectedToolChange = vi.fn();
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={onSelectedToolChange}
        reader={reader}
        selectedTool="bates"
      />,
    );

    fireEvent.change(screen.getByLabelText("前缀"), { target: { value: "EV-" } });
    fireEvent.change(screen.getByLabelText("起始号"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("位数"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("后缀"), { target: { value: "-A" } });
    fireEvent.change(screen.getByLabelText("位置"), { target: { value: "top-right" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-bates.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(3);
    expect(screen.getByRole("status")).toHaveTextContent("已添加 Bates 编号，共 3 页。");
  });

  test("压缩预设导出为新 PDF 副本", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf(2);
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="compress"
      />,
    );

    fireEvent.change(screen.getByLabelText("预设"), { target: { value: "court-5mb" } });
    expect(screen.getByLabelText("影响")).toHaveTextContent("目标 5MB · 高压缩");
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("source-compressed.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent("已压缩 PDF，共 2 页。");
  });

  test("页码起始号无效时显示错误且不保存", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf();
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="page-number"
      />,
    );

    fireEvent.change(screen.getByLabelText("起始号"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    expect(screen.getByRole("alert")).toHaveTextContent("页码起始号必须是正整数。");
    expect(reader.saveUpdatedBytes).not.toHaveBeenCalled();
  });

  test("页眉页脚均为空时显示错误且不保存", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createSourcePdf();
    const reader = makeReader(sourceBytes);
    render(
      <ExportDeliveryPanel
        onSelectedToolChange={vi.fn()}
        reader={reader}
        selectedTool="header-footer"
      />,
    );

    fireEvent.change(screen.getByLabelText("页脚"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "导出副本" }));

    expect(screen.getByRole("alert")).toHaveTextContent("页眉和页脚至少填写一项。");
    expect(reader.saveUpdatedBytes).not.toHaveBeenCalled();
  });
});
