import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { describe, expect, test, vi } from "vitest";
import type { ReaderController } from "../../modules/reader";
import type { ReaderState } from "../../modules/reader/readerState";
import type { PdfDocumentState } from "../../shared/pdf/types";
import { PageOrganizerWorkspace } from "./PageOrganizerWorkspace";

const baseDocument: PdfDocumentState = {
  documentId: "doc-page",
  path: "/case/y.pdf",
  name: "y.pdf",
  fingerprint: "fp-page",
  pageCount: 5,
  currentPage: 1,
  zoom: 1,
  viewMode: "continuous",
  rotation: 0,
  dirty: false,
  textLayerStatus: "available",
  ocrStatus: "not-needed",
};

function makeState(overrides: Partial<ReaderState> & { document?: PdfDocumentState | null } = {}): ReaderState {
  const document = overrides.document === undefined ? baseDocument : overrides.document;
  return {
    defaults: { viewMode: "continuous", zoom: 1 },
    document,
    errorMessage: undefined,
    pageViewports: [{ height: 792, pageIndex: 0, rotation: 0, scale: 1, width: 612 }],
    renderRange: { endPage: document?.pageCount ?? 0, pageNumbers: [], startPage: 1 },
    status: "ready",
    ...overrides,
  } as ReaderState;
}

async function createPdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([200 + index * 10, 240]);
  }
  return pdf.save();
}

function makeReader(
  state: ReaderState,
  overrides: Partial<ReaderController> & {
    getFileBytes?: ReturnType<typeof vi.fn>;
    getCurrentFileName?: ReturnType<typeof vi.fn>;
    saveUpdatedBytes?: ReturnType<typeof vi.fn>;
  } = {},
): ReaderController {
  return {
    state,
    getFileBytes: vi.fn(async () => createPdf(state.document?.pageCount ?? 1)),
    getCurrentFileName: vi.fn(() => state.document?.name ?? "document.pdf"),
    saveUpdatedBytes: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as ReaderController;
}

function getPageOrder(): number[] {
  const grid = screen.getByRole("list", { name: "页面网格" });

  return within(grid)
    .getAllByRole("button")
    .map((button) => {
      const match = /第\s+(\d+)\s+页/.exec(button.textContent ?? "");

      return match ? Number(match[1]) : Number.NaN;
    });
}

describe("PageOrganizerWorkspace 多选 / 撤销 / 风险", () => {
  test("无文档时显示空态", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState({ document: null }))} />);
    expect(screen.getByText("打开 PDF 后管理页面")).toBeInTheDocument();
  });

  test("默认只展示已接通页面动作，未选时禁用", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    expect(screen.getByRole("button", { name: "上移" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下移" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "旋转" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "插入页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "摘录" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "另存为新 PDF" })).toBeInTheDocument();
  });

  test("点选页面后启用删除 + 显示选择计数", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    expect(screen.getByText("已选 1 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeEnabled();
  });

  test("选中页面后可上移并用撤销恢复顺序", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 3 页/ }));
    await user.click(screen.getByRole("button", { name: "上移" }));
    expect(getPageOrder()).toEqual([1, 3, 2, 4, 5]);
    expect(screen.getByText("已选 1 页")).toBeInTheDocument();
    await user.click(screen.getByTestId("page-organizer-undo"));
    expect(getPageOrder()).toEqual([1, 2, 3, 4, 5]);
  });

  test("选中页面后可下移", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    await user.click(screen.getByRole("button", { name: "下移" }));
    expect(getPageOrder()).toEqual([1, 3, 2, 4, 5]);
  });

  test("边界页禁用无效移动", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 1 页/ }));
    expect(screen.getByRole("button", { name: "上移" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下移" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "清除选择" }));
    await user.click(screen.getByRole("button", { name: /第 5 页/ }));
    expect(screen.getByRole("button", { name: "上移" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下移" })).toBeDisabled();
  });

  test("shift+click 选区", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    // fireEvent.click 直接走 React SyntheticEvent；shiftKey 通过 init 传入
    const page4 = screen.getByRole("button", { name: /第 4 页/ });
    fireEvent(page4, new MouseEvent("click", { bubbles: true, shiftKey: true }));
    expect(screen.getByText((_, el) => el?.textContent === "已选 3 页")).toBeInTheDocument();
  });

  test("点击删除按钮弹出风险确认对话框", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 1 页/ }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "风险操作确认" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/将删除/)).toBeInTheDocument();
  });

  test("旋转已选页面后显示旋转状态，撤销后恢复", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    await user.click(screen.getByRole("button", { name: "旋转" }));
    expect(screen.getByText("已旋转 90 度")).toBeInTheDocument();
    const undoButton = screen.getByTestId("page-organizer-undo");
    expect(undoButton).toBeEnabled();
    expect(undoButton.textContent).toContain("(1)");
    await user.click(undoButton);
    expect(screen.queryByText("已旋转 90 度")).not.toBeInTheDocument();
  });

  test("确认删除后页面从活动网格移除，撤销后恢复", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 1 页/ }));
    await user.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "风险操作确认" });
    await user.click(within(dialog).getByRole("button", { name: "确认删除" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const undoButton = screen.getByTestId("page-organizer-undo");
    expect(undoButton).toBeEnabled();
    expect(undoButton.textContent).toContain("(1)");
    expect(screen.queryByRole("button", { name: /第 1 页/ })).not.toBeInTheDocument();
    expect(screen.getByText("活动 4 / 5 页")).toBeInTheDocument();
    await user.click(undoButton);
    expect(screen.getByRole("button", { name: /第 1 页/ })).toBeInTheDocument();
    expect(screen.getByText("活动 5 / 5 页")).toBeInTheDocument();
  });

  test("另存为新 PDF 执行真实页面操作导出并使用 organized 文件名", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdf(5);
    const reader = makeReader(makeState(), {
      getFileBytes: vi.fn(async () => sourceBytes),
      getCurrentFileName: vi.fn(() => "y.pdf"),
      saveUpdatedBytes: vi.fn(async () => undefined),
    });

    render(<PageOrganizerWorkspace reader={reader} />);
    await user.click(screen.getByRole("button", { name: /第 1 页/ }));
    await user.click(screen.getByRole("button", { name: "旋转" }));
    await user.click(screen.getByRole("button", { name: "另存为新 PDF" }));
    const dialog = screen.getByRole("dialog", { name: "导出风险提示" });
    expect(within(dialog).getByText(/不会覆盖原始文件/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "我已了解，继续" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("y-organized.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(5);
    expect(outputPdf.getPage(0).getRotation().angle).toBe(90);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/已另存为 y-organized\.pdf/)).toBeInTheDocument();
  });

  test("重排后另存为新 PDF 会写入真实页序", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdf(5);
    const reader = makeReader(makeState(), {
      getFileBytes: vi.fn(async () => sourceBytes),
      getCurrentFileName: vi.fn(() => "y.pdf"),
      saveUpdatedBytes: vi.fn(async () => undefined),
    });

    render(<PageOrganizerWorkspace reader={reader} />);
    await user.click(screen.getByRole("button", { name: /第 3 页/ }));
    await user.click(screen.getByRole("button", { name: "上移" }));
    await user.click(screen.getByRole("button", { name: "另存为新 PDF" }));
    await user.click(within(screen.getByRole("dialog", { name: "导出风险提示" })).getByRole("button", { name: "我已了解，继续" }));

    await waitFor(() => expect(reader.saveUpdatedBytes).toHaveBeenCalledTimes(1));
    const [savedBytes, fileName] = vi.mocked(reader.saveUpdatedBytes).mock.calls[0] ?? [];
    expect(fileName).toBe("y-organized.pdf");
    const outputPdf = await PDFDocument.load(savedBytes as Uint8Array);
    expect(outputPdf.getPageCount()).toBe(5);
    expect(outputPdf.getPage(0).getWidth()).toBe(200);
    expect(outputPdf.getPage(1).getWidth()).toBe(220);
    expect(outputPdf.getPage(2).getWidth()).toBe(210);
    expect(outputPdf.getPage(3).getWidth()).toBe(230);
    expect(outputPdf.getPage(4).getWidth()).toBe(240);
  });

  test("清除选择按钮清空所有已选", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 1 页/ }));
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    await user.click(screen.getByRole("button", { name: "清除选择" }));
    expect(screen.queryByText(/已选 \d+ 页/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });
});
