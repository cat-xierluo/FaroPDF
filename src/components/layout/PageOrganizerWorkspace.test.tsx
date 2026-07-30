import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
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

interface ReaderOverrides {
  getFileBytes?: () => Promise<Uint8Array | null>;
  saveUpdatedBytes?: (bytes: Uint8Array, name: string) => Promise<void>;
  getCurrentFileName?: () => string | null;
  renderThumbnail?: ReaderController["renderThumbnail"];
}

function makeReader(state: ReaderState, overrides: ReaderOverrides = {}): ReaderController {
  const getFileBytes = overrides.getFileBytes ?? (async () => null);
  const saveUpdatedBytes = overrides.saveUpdatedBytes ?? (async () => undefined);
  const getCurrentFileName = overrides.getCurrentFileName ?? (() => state.document?.name ?? null);
  const renderThumbnail = overrides.renderThumbnail ?? vi.fn(async (_pageIndex, canvas) => {
    canvas.width = 174;
    canvas.height = 247;
  });
  return {
    state,
    getFileBytes,
    getCurrentFileName,
    saveUpdatedBytes,
    renderThumbnail,
  } as unknown as ReaderController;
}

/** 创建一个最小的有效 PDF 字节流 */
async function createPdfBytes(pageCount = 1): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([200, 200]);
  }
  return new Uint8Array(await pdf.save());
}

async function openMorePageTools(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("更多页面工具", { selector: "summary" }));
}

describe("PageOrganizerWorkspace 多选 / 撤销 / 风险", () => {
  test("无文档时显示空态", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState({ document: null }))} />);
    expect(screen.getByText("打开 PDF 后管理页面")).toBeInTheDocument();
  });

  test("默认选中当前页，真实页面动作可用，复制启用（需选中），粘贴禁用（剪贴板空）", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    expect(screen.getByRole("button", { name: "删除" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "旋转" })).toBeEnabled();
    // 复制：有选中页 → 启用（ISS-NEW-M M3 已接入页面剪贴板）
    expect(screen.getByRole("button", { name: "复制" })).toBeEnabled();
    // 粘贴：剪贴板为空 → 禁用
    expect(screen.getByRole("button", { name: "粘贴" })).toBeDisabled();
    expect(screen.getByTestId("page-organizer-save-as")).toBeInTheDocument();
  });

  test("点选页面后启用删除 + 显示选择计数", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    expect(screen.getByText("已选 2 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeEnabled();
  });

  test("shift+click 选区", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    // 默认第 1 页已选；shift+click 第 4 页选中 1-4。
    const page4 = screen.getByRole("button", { name: /第 4 页/ });
    fireEvent(page4, new MouseEvent("click", { bubbles: true, shiftKey: true }));
    expect(screen.getByText((_, el) => el?.textContent === "已选 4 页")).toBeInTheDocument();
  });

  test("点击删除按钮弹出风险确认对话框", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "风险操作确认" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/将删除/)).toBeInTheDocument();
  });

  test("确认风险对话框后撤销按钮出现计数", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: "删除" }));
    const dialog = screen.getByRole("dialog", { name: "风险操作确认" });
    await user.click(within(dialog).getByRole("button", { name: "确认删除" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const undoButton = screen.getByTestId("page-organizer-undo");
    expect(undoButton).toBeEnabled();
    expect(undoButton.textContent).toContain("(1)");
    expect(screen.queryByRole("button", { name: /第 1 页/ })).not.toBeInTheDocument();
    await user.click(undoButton);
    expect(screen.getByRole("button", { name: /第 1 页/ })).toBeInTheDocument();
  });

  test("旋转选中页写入页面整理状态，撤销后恢复", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    const pageOne = screen.getByRole("button", { name: /第 1 页/ });
    expect(pageOne).toHaveAttribute("data-rotation", "0");
    await user.click(screen.getByRole("button", { name: "旋转" }));
    expect(pageOne).toHaveAttribute("data-rotation", "90");
    await user.click(screen.getByTestId("page-organizer-undo"));
    expect(pageOne).toHaveAttribute("data-rotation", "0");
  });

  test("拖拽页面会真实改变页面整理顺序", () => {
    const { container } = render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    const pageOne = screen.getByRole("button", { name: /第 1 页/ });
    const pageThree = screen.getByRole("button", { name: /第 3 页/ });
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      setData: (type: string, value: string) => transfer.set(type, value),
      getData: (type: string) => transfer.get(type) ?? "",
    };
    fireEvent.dragStart(pageOne, { dataTransfer });
    fireEvent.dragOver(pageThree, { dataTransfer });
    fireEvent.drop(pageThree, { dataTransfer });

    const order = Array.from(container.querySelectorAll<HTMLElement>(".page-card")).map(
      (card) => Number(card.dataset.pageNumber),
    );
    expect(order).toEqual([2, 1, 3, 4, 5]);
  });

  test("另存为新 PDF 弹风险提示对话框", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(5);
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(makeState(), { getFileBytes: async () => sourceBytes, saveUpdatedBytes })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "旋转" }));
    await openMorePageTools(user);
    await user.click(screen.getByRole("menuitem", { name: "另存为新 PDF" }));
    const dialog = screen.getByRole("dialog", { name: "导出风险提示" });
    expect(within(dialog).getByText(/不会覆盖原始文件/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "我已了解，继续" }));
    await vi.waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const calls = (saveUpdatedBytes as unknown as { mock: { calls: Array<[Uint8Array, string]> } }).mock.calls;
    const [savedBytes, fileName] = calls[0]!;
    expect(fileName).toBe("y-organized.pdf");
    const output = await PDFDocument.load(savedBytes!);
    expect(output.getPageCount()).toBe(5);
    expect(output.getPage(0).getRotation().angle).toBe(90);
  });

  test("清除选择按钮清空所有已选", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    await user.click(screen.getByRole("button", { name: "清除选择" }));
    expect(screen.queryByText(/已选 \d+ 页/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });
});

describe("PageOrganizerWorkspace ISS-NEW-A 阶段 2：插入 / 合并 / 提取 UI 入口", () => {
  test("工具条渲染 3 个新按钮", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    expect(screen.getByTestId("page-organizer-insert-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("page-organizer-merge-pdfs")).toBeInTheDocument();
    expect(screen.getByTestId("page-organizer-extract-pages")).toBeInTheDocument();
  });

  test("点提取页码范围按钮弹出对话框，预填 1-1 范围与默认输出名", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes: async () => undefined,
          getCurrentFileName: () => "y.pdf",
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-extract-pages"));
    const dialog = screen.getByRole("dialog", { name: "提取页码范围" });
    expect(dialog).toBeInTheDocument();
    const rangeInput = within(dialog).getByTestId("extract-pages-range") as HTMLInputElement;
    const outputInput = within(dialog).getByTestId("extract-pages-output") as HTMLInputElement;
    expect(rangeInput.value).toBe("1-1");
    expect(outputInput.value).toBe("y-extracted.pdf");
  });

  test("提取页码范围确认：调 engine.exportPdf + saveUpdatedBytes，对话框关闭", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
          getCurrentFileName: () => "y.pdf",
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-extract-pages"));
    const dialog = screen.getByRole("dialog", { name: "提取页码范围" });
    const rangeInput = within(dialog).getByTestId("extract-pages-range");
    fireEvent.change(rangeInput, { target: { value: "1-2" } });
    await user.click(within(dialog).getByTestId("extract-pages-confirm"));
    // 等待异步：saveUpdatedBytes 应被调用 1 次，对话框已关
    expect(await vi.waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1))).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "提取页码范围" })).not.toBeInTheDocument();
    const calls = (saveUpdatedBytes as unknown as { mock: { calls: Array<[Uint8Array, string]> } }).mock.calls;
    const [bytesArg, nameArg] = calls[0]!;
    expect(nameArg).toBe("y-extracted.pdf");
    expect(bytesArg.byteLength).toBeGreaterThan(0);
  });

  test("提取页码范围空范围显示错误（不调用 saveUpdatedBytes）", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-extract-pages"));
    const dialog = screen.getByRole("dialog", { name: "提取页码范围" });
    const rangeInput = within(dialog).getByTestId("extract-pages-range");
    fireEvent.change(rangeInput, { target: { value: "" } });
    await user.click(within(dialog).getByTestId("extract-pages-confirm"));
    const errorMessage = await screen.findByTestId("extract-pages-error");
    expect(errorMessage.textContent).toMatch(/页码范围/);
    expect(saveUpdatedBytes).not.toHaveBeenCalled();
  });

  test("插入 PDF 缺文件时显示错误", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-insert-pdf"));
    const dialog = screen.getByRole("dialog", { name: "插入 PDF" });
    await user.click(within(dialog).getByTestId("insert-pdf-confirm"));
    const errorMessage = await screen.findByTestId("insert-pdf-error");
    expect(errorMessage.textContent).toMatch(/选择要插入的 PDF/);
    expect(saveUpdatedBytes).not.toHaveBeenCalled();
  });

  test("插入 PDF 选择文件后确认：调 saveUpdatedBytes", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    // 同步 pageCount 元数据到实际字节：baseDocument 默认 pageCount=5，但 sourceBytes 是 3 页
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-insert-pdf"));
    const dialog = screen.getByRole("dialog", { name: "插入 PDF" });
    const fileBytes = await createPdfBytes(2);
    const fileInput = within(dialog).getByTestId("insert-pdf-file") as HTMLInputElement;
    // jsdom 不实现 DataTransfer；用数组代理 FileList
    const file = new File([fileBytes], "extra.pdf", { type: "application/pdf" });
    const files = [file] as unknown as FileList;
    Object.defineProperty(files, "length", { value: 1 });
    Object.defineProperty(files, "item", { value: (i: number) => files[i] ?? null });
    fireEvent.change(fileInput, { target: { files } });
    await user.click(within(dialog).getByTestId("insert-pdf-confirm"));
    // 等待异步：engine.exportPdf + saveUpdatedBytes 串行
    expect(await vi.waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1))).toBeTruthy();
    const calls = (saveUpdatedBytes as unknown as { mock: { calls: Array<[Uint8Array, string]> } }).mock.calls;
    const [, nameArg] = calls[0]!;
    expect(nameArg).toBe("y-inserted.pdf");
  });

  test("合并多份 PDF 选 0 文件时显示错误", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(makeState(), {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-merge-pdfs"));
    const dialog = screen.getByRole("dialog", { name: "合并多份 PDF" });
    await user.click(within(dialog).getByTestId("merge-pdfs-confirm"));
    const errorMessage = await screen.findByTestId("merge-pdfs-error");
    expect(errorMessage.textContent).toMatch(/至少选择 1 份/);
    expect(saveUpdatedBytes).not.toHaveBeenCalled();
  });

  test("合并 PDF 选 2 文件后确认：调 saveUpdatedBytes 且输出名以 -merged 结尾", async () => {
    const user = userEvent.setup();
    const sourceBytes = await createPdfBytes(3);
    const state = makeState({ document: { ...baseDocument, pageCount: 3 } });
    const saveUpdatedBytes: (bytes: Uint8Array, name: string) => Promise<void> = vi.fn(async () => undefined);
    render(
      <PageOrganizerWorkspace
        reader={makeReader(state, {
          getFileBytes: async () => sourceBytes,
          saveUpdatedBytes,
          getCurrentFileName: () => "y.pdf",
        })}
      />,
    );
    await openMorePageTools(user);
    await user.click(screen.getByTestId("page-organizer-merge-pdfs"));
    const dialog = screen.getByRole("dialog", { name: "合并多份 PDF" });
    const file1Bytes = await createPdfBytes(1);
    const file2Bytes = await createPdfBytes(1);
    const file1 = new File([file1Bytes], "a.pdf", { type: "application/pdf" });
    const file2 = new File([file2Bytes], "b.pdf", { type: "application/pdf" });
    const files = [file1, file2] as unknown as FileList;
    Object.defineProperty(files, "length", { value: 2 });
    Object.defineProperty(files, "item", { value: (i: number) => files[i] ?? null });
    const fileInput = within(dialog).getByTestId("merge-pdfs-files") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files } });
    await user.click(within(dialog).getByTestId("merge-pdfs-confirm"));
    expect(await vi.waitFor(() => expect(saveUpdatedBytes).toHaveBeenCalledTimes(1))).toBeTruthy();
    const calls = (saveUpdatedBytes as unknown as { mock: { calls: Array<[Uint8Array, string]> } }).mock.calls;
    const [, nameArg] = calls[0]!;
    expect(nameArg).toBe("y-merged.pdf");
  });
});

describe("PageOrganizerWorkspace 页面剪贴板（ISS-NEW-M M3）", () => {
  test("点击复制后粘贴按钮启用", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    // 初始：有选中页，复制启用，粘贴禁用
    expect(screen.getByRole("button", { name: "复制" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "粘贴" })).toBeDisabled();
    // 点击复制 → 剪贴板写入 → 粘贴启用
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(screen.getByRole("button", { name: "粘贴" })).toBeEnabled();
  });

  test("点击粘贴后页数 +1（页面卡片增加）", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    // 默认 5 页
    expect(screen.getAllByRole("button", { name: /第 \d+ 页/ })).toHaveLength(5);
    // 复制当前页 → 粘贴
    await user.click(screen.getByRole("button", { name: "复制" }));
    await user.click(screen.getByRole("button", { name: "粘贴" }));
    // 页数 +1 = 6
    expect(screen.getAllByRole("button", { name: /第 \d+ 页/ })).toHaveLength(6);
  });

  test("粘贴后撤销可恢复原页数", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: "复制" }));
    await user.click(screen.getByRole("button", { name: "粘贴" }));
    expect(screen.getAllByRole("button", { name: /第 \d+ 页/ })).toHaveLength(6);
    await user.click(screen.getByRole("menuitem", { name: /撤销/ }));
    expect(screen.getAllByRole("button", { name: /第 \d+ 页/ })).toHaveLength(5);
  });
});
