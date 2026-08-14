import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useReaderController } from "./useReaderController";
import { createDefaultAppSettings } from "../../shared/settings/defaults";
import { createMemoryReaderSessionStorage } from "./readerSessionStorage";
import type { LoadedPdfDocument } from "./pdfReaderService";
import type { ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PdfPageViewport } from "../../shared/pdf/types";

vi.mock("./pdfReaderService", () => ({
  loadPdfFromBytes: vi.fn(),
  loadPdfFromFile: vi.fn(),
}));

import { loadPdfFromBytes, loadPdfFromFile } from "./pdfReaderService";

const loadedMetadata: ReaderLoadedMetadata = {
  fileName: "doc.pdf",
  fingerprint: "fp-test",
  pageCount: 10,
  initialViewport: { pageIndex: 0, width: 612, height: 792, rotation: 0, scale: 1 },
  textLayerStatus: "available",
};

function createLoadedDocument(overrides: Partial<ReaderLoadedMetadata> = {}): LoadedPdfDocument {
  const metadata: ReaderLoadedMetadata = { ...loadedMetadata, ...overrides };
  return {
    metadata,
    getPageViewport: vi.fn(async (pageIndex: number, scale: number = 1): Promise<PdfPageViewport> => ({
      pageIndex,
      width: 612 * scale,
      height: 792 * scale,
      rotation: 0,
      scale,
    })),
    getPageText: vi.fn(async (pageIndex: number): Promise<PdfPageText> => ({
      pageIndex,
      text: "",
      status: "unknown",
      itemCount: 0,
      charCount: 0,
    })),
    getRawTextContent: vi.fn(async () => null),
    renderPageToCanvas: vi.fn(async () => undefined),
    renderThumbnail: vi.fn(async () => undefined),
    renderTextLayer: vi.fn(async () => undefined),
    getOutline: vi.fn(async () => []),
    destroy: vi.fn(async () => undefined),
  };
}

interface ControllerRef {
  current: ReturnType<typeof useReaderController> | null;
}

function Harness({ controllerRef, sessionStorage = createMemoryReaderSessionStorage() }: { controllerRef: ControllerRef; sessionStorage?: ReturnType<typeof createMemoryReaderSessionStorage> }) {
  const settings = createDefaultAppSettings();
  // 默认用 in-memory sessionStorage：避免跨测试 localStorage 污染（比如前面 test
  // 写了 zoom=0.5 会让后续 useReaderController 默认走 createDefaultReaderSessionStorage
  // 的 applySession 把 zoom 还原成 0.5，导致 zoomIn/zoomOut 等 test 失败）。
  const controller = useReaderController(settings, { sessionStorage });
  controllerRef.current = controller;
  return null;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useReaderController 阅读深化", () => {
  beforeEach(() => {
    vi.mocked(loadPdfFromBytes).mockReset();
    vi.mocked(loadPdfFromFile).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("旋转动作正确更新 document.rotation", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    expect(ref.current?.state.document?.rotation).toBe(0);
    act(() => ref.current?.rotateClockwise());
    expect(ref.current?.state.document?.rotation).toBe(90);
    act(() => ref.current?.rotateCounterClockwise());
    expect(ref.current?.state.document?.rotation).toBe(0);
    act(() => ref.current?.setRotation(180));
    expect(ref.current?.state.document?.rotation).toBe(180);
  });

  test("openNativeFile 从 Tauri bytes 加载并保留路径", async () => {
    vi.mocked(loadPdfFromBytes).mockResolvedValue(createLoadedDocument({
      fileName: "native.pdf",
      filePath: "/case/native.pdf",
    }));

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        name: "native.pdf",
        path: "/case/native.pdf",
      });
    });

    expect(loadPdfFromBytes).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
      fileName: "native.pdf",
      filePath: "/case/native.pdf",
    });
    expect(ref.current?.state.document).toMatchObject({
      name: "native.pdf",
      path: "/case/native.pdf",
    });
  });

  test("goToNextPage/goToPreviousPage 触发翻页并夹紧边界", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.goToNextPage());
    expect(ref.current?.state.document?.currentPage).toBe(2);
    act(() => ref.current?.goToPreviousPage());
    expect(ref.current?.state.document?.currentPage).toBe(1);
    act(() => ref.current?.goToPreviousPage());
    expect(ref.current?.state.document?.currentPage).toBe(1); // 已是最小页
    act(() => ref.current?.goToLastPage());
    expect(ref.current?.state.document?.currentPage).toBe(10);
    act(() => ref.current?.goToNextPage());
    expect(ref.current?.state.document?.currentPage).toBe(10); // 已是最大页
  });

  test("goToFirstPage 直接跳到第 1 页", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setCurrentPage(5));
    act(() => ref.current?.goToFirstPage());
    expect(ref.current?.state.document?.currentPage).toBe(1);
  });

  test("setZoomPreset 数字预设直接设置 zoom", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setZoomPreset("1.5"));
    expect(ref.current?.state.document?.zoom).toBe(1.5);
    act(() => ref.current?.setZoomPreset("0.5"));
    expect(ref.current?.state.document?.zoom).toBe(0.5);
  });

  test("setZoomPreset('fit-width') 切换 viewMode 到 fit-width", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setZoomPreset("fit-width"));
    expect(ref.current?.state.document?.viewMode).toBe("fit-width");
  });

  test("setZoomPreset('fit-page') 切换 viewMode 到 single", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setZoomPreset("fit-page"));
    expect(ref.current?.state.document?.viewMode).toBe("single");
  });

  test("zoomIn/zoomOut 按 0.1 步进并夹紧", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    expect(ref.current?.state.document?.zoom).toBe(1);
    act(() => ref.current?.zoomIn());
    expect(ref.current?.state.document?.zoom).toBe(1.1);
    act(() => ref.current?.zoomOut());
    act(() => ref.current?.zoomOut());
    expect(ref.current?.state.document?.zoom).toBe(0.9);
  });

  test("文档加载后从 sessionStorage 恢复 currentPage/zoom/viewMode/rotation", async () => {
    const sessionStorage = createMemoryReaderSessionStorage();
    sessionStorage.save({
      fingerprint: "fp-test",
      currentPage: 6,
      zoom: 1.25,
      viewMode: "double",
      rotation: 90,
      savedAt: "2026-06-04T00:00:00.000Z",
    });
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });

    await waitFor(() => {
      expect(ref.current?.state.document).toMatchObject({
        currentPage: 6,
        zoom: 1.25,
        viewMode: "double",
        rotation: 90,
      });
    });
  });

  test("currentPage/zoom/viewMode/rotation 变化后写回 sessionStorage", async () => {
    const sessionStorage = createMemoryReaderSessionStorage();
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => {
      ref.current?.setCurrentPage(5);
      ref.current?.setZoom(1.5);
      ref.current?.setViewMode("fit-width");
      ref.current?.rotateClockwise();
    });

    await waitFor(() => {
      const saved = sessionStorage.load("fp-test");
      expect(saved).toMatchObject({
        fingerprint: "fp-test",
        currentPage: 5,
        zoom: 1.5,
        viewMode: "fit-width",
        rotation: 90,
      });
    });
  });
});

// ISS-NEW-D 前往浏览历史栈（DEC-171）步 2 端到端测试：goBack + goToHistory API
describe("useReaderController 浏览历史栈", () => {
  let sessionStorage: ReturnType<typeof createMemoryReaderSessionStorage>;

  beforeEach(() => {
    vi.mocked(loadPdfFromFile).mockReset();
    // 用内存 session storage 避免 jsdom localStorage 跨测试污染（其他测试存了 fp-test 7 页）
    sessionStorage = createMemoryReaderSessionStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("setCurrentPage 跳页 → state.history 累计；goBack 弹回", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();
    expect(ref.current?.state.document?.currentPage).toBe(1);

    // 跳 1 → 5 → 7
    act(() => ref.current?.setCurrentPage(5));
    act(() => ref.current?.setCurrentPage(7));
    expect(ref.current?.state.document?.currentPage).toBe(7);
    expect(ref.current?.state.history).toEqual([5, 1]);

    // goBack 弹 history[0] (=5)，不再 push
    act(() => ref.current?.goBack());
    expect(ref.current?.state.document?.currentPage).toBe(5);
    expect(ref.current?.state.history).toEqual([1]);

    // 再 goBack → currentPage=1, history=[]
    act(() => ref.current?.goBack());
    expect(ref.current?.state.document?.currentPage).toBe(1);
    expect(ref.current?.state.history).toEqual([]);

    // 再 goBack (历史空) → no-op
    act(() => ref.current?.goBack());
    expect(ref.current?.state.document?.currentPage).toBe(1);
  });

  test("goToHistory(1) 跳到 history[0] 不 push（避免循环）", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setCurrentPage(5));
    act(() => ref.current?.setCurrentPage(7));
    expect(ref.current?.state.history).toEqual([5, 1]);

    // 跳到 history[0] = 5，跳页不应 push
    act(() => ref.current?.goToHistory(1));
    expect(ref.current?.state.document?.currentPage).toBe(5);
    expect(ref.current?.state.history).toEqual([5, 1]); // 不变
  });

  test("goToHistory(N) 越界 → no-op", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setCurrentPage(5));
    expect(ref.current?.state.history).toEqual([1]);

    // 越界：history 只有 1 项，goToHistory(5) 应 no-op
    act(() => ref.current?.goToHistory(5));
    expect(ref.current?.state.document?.currentPage).toBe(5); // 不变

    // 非整数：no-op
    act(() => ref.current?.goToHistory(1.5));
    expect(ref.current?.state.document?.currentPage).toBe(5);

    // 0 / 负数：no-op
    act(() => ref.current?.goToHistory(0));
    act(() => ref.current?.goToHistory(-1));
    expect(ref.current?.state.document?.currentPage).toBe(5);
  });

  test("goToHistory(2) 跳到 history[1] = 1（跳回最早的访问）", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    await flushEffects();

    act(() => ref.current?.setCurrentPage(5));
    act(() => ref.current?.setCurrentPage(7));
    // history=[5, 1], currentPage=7
    // goToHistory(2) 跳到 history[1] = 1
    act(() => ref.current?.goToHistory(2));
    expect(ref.current?.state.document?.currentPage).toBe(1);
    expect(ref.current?.state.history).toEqual([5, 1]); // 不变
  });

  test("openFile 新文档 → 清空 history（跨文档不串台）", async () => {
    vi.mocked(loadPdfFromFile).mockResolvedValue(createLoadedDocument());
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} sessionStorage={sessionStorage} />);

    const file1 = new File([new Uint8Array([1])], "doc1.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file1);
    });
    await flushEffects();
    act(() => ref.current?.setCurrentPage(5));
    expect(ref.current?.state.history).toEqual([1]);

    // 打开第二个文档（不同 fingerprint）
    vi.mocked(loadPdfFromFile).mockResolvedValueOnce(
      createLoadedDocument({
        fileName: "doc2.pdf",
        fingerprint: "fp-doc2",
      }),
    );
    const file2 = new File([new Uint8Array([2])], "doc2.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file2);
    });
    await flushEffects();
    expect(ref.current?.state.history).toEqual([]);
  });
});

// ISS-NEW-M M5：加载失败归一化闭环。
// 损坏 / 加密 PDF 在 mock 层抛 PDF.js 异常（按 error.name），验证 dispatch loadFailed 后
// errorMessage 走中文友好文案而非 PDF.js 英文原文。
describe("useReaderController 加载失败归一化（ISS-NEW-M M5）", () => {
  beforeEach(() => {
    vi.mocked(loadPdfFromBytes).mockReset();
    vi.mocked(loadPdfFromFile).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("openNativeFile 喂入损坏 PDF（InvalidPDFException）→ status error + 中文损坏文案", async () => {
    const invalidPdf = new Error("Invalid PDF structure.");
    invalidPdf.name = "InvalidPDFException";
    vi.mocked(loadPdfFromBytes).mockRejectedValue(invalidPdf);

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        name: "corrupt.pdf",
        path: "/case/corrupt.pdf",
      });
    });

    expect(ref.current?.state.status).toBe("error");
    expect(ref.current?.state.document).toBeNull();
    expect(ref.current?.state.errorMessage).toBe(
      "PDF 解析失败，文件可能已损坏或不是有效 PDF。",
    );
  });

  test("openFile 抛普通 Error（非 PDF.js 异常）→ status error + 原始 message 兜底", async () => {
    vi.mocked(loadPdfFromFile).mockRejectedValue(new Error("network timeout"));

    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });

    expect(ref.current?.state.status).toBe("error");
    // 非 PDF.js 异常落 Unknown，friendlyMessageForCode 回退到原 message
    expect(ref.current?.state.errorMessage).toBe("network timeout");
  });
});

// ISS-NEW-M M5：加密 PDF 密码输入闭环。
// 模拟 PDF.js PasswordException（name + code），验证 passwordPrompt 态、submitPassword
// 重试循环（错密码再 prompt / 对密码 loadSucceeded）与 cancelPassword 回 error。
describe("useReaderController 加密 PDF 密码闭环（ISS-NEW-M M5）", () => {
  beforeEach(() => {
    vi.mocked(loadPdfFromBytes).mockReset();
    vi.mocked(loadPdfFromFile).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makePasswordException(code: number, message: string): Error {
    const err = new Error(message);
    err.name = "PasswordException";
    (err as Error & { code?: number }).code = code;
    return err;
  }

  test("openNativeFile 加载加密 PDF（code=1）→ 进入 passwordPrompt 态，不清除 cachedFileRef", async () => {
    vi.mocked(loadPdfFromBytes).mockRejectedValueOnce(makePasswordException(1, "No password given"));
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        name: "encrypted.pdf",
        path: "/case/encrypted.pdf",
      });
    });

    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 1 });
    // 未进 error 态，document 仍 null
    expect(ref.current?.state.status).not.toBe("error");
    expect(ref.current?.state.document).toBeNull();
  });

  test("openFile 加密 PDF（code=1）→ passwordPrompt（openFile 链路同样识别）", async () => {
    vi.mocked(loadPdfFromFile).mockRejectedValueOnce(makePasswordException(1, "No password given"));
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);
    const file = new File([new Uint8Array([1])], "enc.pdf", { type: "application/pdf" });
    await act(async () => {
      await ref.current?.openFile(file);
    });
    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 1 });
  });

  test("submitPassword 正确密码 → loadSucceeded，清除 passwordChallenge", async () => {
    // 第一次（openNativeFile）抛 NEED_PASSWORD，第二次（submitPassword 带密码）成功
    vi.mocked(loadPdfFromBytes)
      .mockRejectedValueOnce(makePasswordException(1, "No password given"))
      .mockResolvedValueOnce(createLoadedDocument({ fileName: "encrypted.pdf", filePath: "/case/encrypted.pdf" }));
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({ bytes: new Uint8Array([1]), name: "encrypted.pdf", path: "/case/encrypted.pdf" });
    });
    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 1 });

    await act(async () => {
      await ref.current?.submitPassword("test123");
    });

    expect(ref.current?.state.passwordChallenge).toBeUndefined();
    expect(ref.current?.state.status).toBe("ready");
    expect(ref.current?.state.document?.name).toBe("encrypted.pdf");
    // 第二次调用带 password
    const lastCall = vi.mocked(loadPdfFromBytes).mock.calls.at(-1);
    expect(lastCall?.[2]).toEqual({ password: "test123" });
  });

  test("submitPassword 错误密码（code=2）→ 再次 passwordPrompt，可继续重试", async () => {
    vi.mocked(loadPdfFromBytes)
      .mockRejectedValueOnce(makePasswordException(1, "No password given"))
      .mockRejectedValueOnce(makePasswordException(2, "Incorrect Password"))
      .mockResolvedValueOnce(createLoadedDocument({ fileName: "encrypted.pdf" }));
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({ bytes: new Uint8Array([1]), name: "encrypted.pdf", path: "/e.pdf" });
    });
    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 1 });

    // 错密码 → reason 变 2
    await act(async () => {
      await ref.current?.submitPassword("wrong");
    });
    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 2 });

    // 对密码 → 成功
    await act(async () => {
      await ref.current?.submitPassword("test123");
    });
    expect(ref.current?.state.status).toBe("ready");
    expect(ref.current?.state.passwordChallenge).toBeUndefined();
  });

  test("cancelPassword → 回到 error 态，清除 passwordChallenge", async () => {
    vi.mocked(loadPdfFromBytes).mockRejectedValueOnce(makePasswordException(1, "No password given"));
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);

    await act(async () => {
      await ref.current?.openNativeFile({ bytes: new Uint8Array([1]), name: "encrypted.pdf", path: "/e.pdf" });
    });
    expect(ref.current?.state.passwordChallenge).toEqual({ reason: 1 });

    act(() => ref.current?.cancelPassword());
    expect(ref.current?.state.passwordChallenge).toBeUndefined();
    expect(ref.current?.state.status).toBe("error");
    expect(ref.current?.state.errorMessage).toContain("取消");
  });

  test("submitPassword 未处于密码态（无 cachedFileRef）→ no-op", async () => {
    const ref: ControllerRef = { current: null };
    render(<Harness controllerRef={ref} />);
    await act(async () => {
      await ref.current?.submitPassword("test123");
    });
    // 无异常、无状态变化
    expect(ref.current?.state.passwordChallenge).toBeUndefined();
    expect(loadPdfFromBytes).not.toHaveBeenCalled();
  });
});
