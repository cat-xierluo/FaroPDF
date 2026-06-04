import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
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

function makeReader(state: ReaderState): ReaderController {
  return { state } as unknown as ReaderController;
}

describe("PageOrganizerWorkspace 多选 / 撤销 / 风险", () => {
  test("无文档时显示空态", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState({ document: null }))} />);
    expect(screen.getByText("打开 PDF 后管理页面")).toBeInTheDocument();
  });

  test("默认所有动作按钮在未选时禁用（粘贴除外）", () => {
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "旋转" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "粘贴" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "另存为新 PDF" })).toBeInTheDocument();
  });

  test("点选页面后启用删除 + 显示选择计数", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: /第 2 页/ }));
    expect(screen.getByText("已选 1 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeEnabled();
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

  test("确认风险对话框后撤销按钮出现计数", async () => {
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
  });

  test("另存为新 PDF 弹风险提示对话框", async () => {
    const user = userEvent.setup();
    render(<PageOrganizerWorkspace reader={makeReader(makeState())} />);
    await user.click(screen.getByRole("button", { name: "另存为新 PDF" }));
    const dialog = screen.getByRole("dialog", { name: "导出风险提示" });
    expect(within(dialog).getByText(/不会覆盖原始文件/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "我已了解，继续" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
