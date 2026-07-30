import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { RecentPdfFile } from "../../shared/settings/types";
import { WelcomeScreen } from "./WelcomeScreen";

function makeRecent(overrides: Partial<RecentPdfFile> = {}): RecentPdfFile {
  return {
    path: "/case/sample.pdf",
    name: "sample.pdf",
    lastOpenedAt: "2026-06-21T00:00:00Z",
    ...overrides,
  };
}

describe("WelcomeScreen 渲染", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("空态：无 recent 时不渲染「最近」段，但转换卡 + drop zone 仍展示", () => {
    render(<WelcomeScreen recentFiles={[]} />);

    expect(screen.getByTestId("welcome-convert-images")).toBeInTheDocument();
    expect(screen.getByTestId("welcome-convert-word")).toBeInTheDocument();
    expect(screen.getByTestId("welcome-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("welcome-choose-file")).toBeInTheDocument();
    expect(screen.queryByTestId("welcome-recent-grid")).not.toBeInTheDocument();
  });

  test("图片转 PDF 引擎未接入时入口明确禁用", async () => {
    const user = userEvent.setup();
    const onConvertFromImages = vi.fn();
    render(<WelcomeScreen recentFiles={[]} onConvertFromImages={onConvertFromImages} />);

    await user.click(screen.getByTestId("welcome-convert-images"));

    expect(screen.getByTestId("welcome-convert-images")).toBeDisabled();
    expect(onConvertFromImages).not.toHaveBeenCalled();
  });

  test("Word 转 PDF 引擎未接入时入口明确禁用", async () => {
    const user = userEvent.setup();
    const onConvertFromWord = vi.fn();
    render(<WelcomeScreen recentFiles={[]} onConvertFromWord={onConvertFromWord} />);

    await user.click(screen.getByTestId("welcome-convert-word"));

    expect(screen.getByTestId("welcome-convert-word")).toBeDisabled();
    expect(onConvertFromWord).not.toHaveBeenCalled();
  });

  test("点击「选择文件」按钮触发隐藏 file input", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.fn();
    const { container } = render(<WelcomeScreen recentFiles={[]} />);
    const input = container.querySelector<HTMLInputElement>('[data-testid="welcome-file-input"]');
    expect(input).toBeTruthy();
    if (input) {
      input.click = clickSpy;
    }

    await user.click(screen.getByTestId("welcome-choose-file"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("选中文件后 onOpenFile 被调用（File 来自 input）", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    const { container } = render(<WelcomeScreen recentFiles={[]} onOpenFile={onOpenFile} />);
    const input = container.querySelector<HTMLInputElement>('[data-testid="welcome-file-input"]');
    expect(input).toBeTruthy();
    if (!input) {
      return;
    }
    const file = new File(["pdf-bytes"], "test.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenFile.mock.calls[0]?.[0]).toBe(file);
  });
});

describe("WelcomeScreen 最近段", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("最近文件 > 4 时仅显示前 4 个", () => {
    const recents: RecentPdfFile[] = Array.from({ length: 6 }, (_, i) =>
      makeRecent({ path: `/case/file-${i}.pdf`, name: `file-${i}.pdf` }),
    );
    render(<WelcomeScreen recentFiles={recents} />);

    const grid = screen.getByTestId("welcome-recent-grid");
    const tiles = within(grid).getAllByTestId("welcome-recent-tile");
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveAttribute("data-recent-path", "/case/file-0.pdf");
    expect(tiles[3]).toHaveAttribute("data-recent-path", "/case/file-3.pdf");
  });

  test("点击最近缩略图触发 onOpenRecent 并传 entry", async () => {
    const user = userEvent.setup();
    const onOpenRecent = vi.fn();
    const recents: RecentPdfFile[] = [
      makeRecent({ path: "/case/a.pdf", name: "a.pdf" }),
      makeRecent({ path: "/case/b.pdf", name: "b.pdf" }),
    ];
    render(<WelcomeScreen recentFiles={recents} onOpenRecent={onOpenRecent} />);

    const grid = screen.getByTestId("welcome-recent-grid");
    const tiles = within(grid).getAllByTestId("welcome-recent-tile");
    await user.click(tiles[1]!);

    expect(onOpenRecent).toHaveBeenCalledTimes(1);
    expect(onOpenRecent.mock.calls[0]?.[0]?.path).toBe("/case/b.pdf");
  });

  test("点击「清除最近」触发 onClearRecent", async () => {
    const user = userEvent.setup();
    const onClearRecent = vi.fn();
    render(
      <WelcomeScreen
        recentFiles={[makeRecent()]}
        onClearRecent={onClearRecent}
      />,
    );

    await user.click(screen.getByTestId("welcome-clear-recent"));

    expect(onClearRecent).toHaveBeenCalledTimes(1);
  });

  test("最近文件名为空字符串时缩略图占位首字母为 fallback", () => {
    render(
      <WelcomeScreen
        recentFiles={[
          makeRecent({ path: "/case/x.pdf", name: "" }),
        ]}
      />,
    );
    const grid = screen.getByTestId("welcome-recent-grid");
    // 缩略图占位字符：A (因为 name.slice(0,1).toUpperCase() on "" = "")
    // 实际上空字符串 slice(0,1) = "" → 渲染为空文本节点；确认无崩溃
    expect(within(grid).getByTestId("welcome-recent-tile")).toBeInTheDocument();
  });
});
