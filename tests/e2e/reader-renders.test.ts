/**
 * ISS-QA-02 回归 + 诊断测试（verification-loop 阶段 5：e2e 功能验证）。
 *
 * 用真 pdfjs + 真 fixture（reference.pdf）驱动 loadPdfFromBytes 完整链路：
 * getDocument → getPage → getViewport → getTextContent。
 *
 * 双重价值：
 * 1. 回归门禁——QA-02 修复后，正常 PDF 加载必成功 + textLayerStatus ≠ unknown。
 * 2. 诊断信号——区分「pdfjs 逻辑 bug」（本测试也失败）vs「Tauri webview 环境问题」
 *    （本测试在 jsdom 下成功，但真机崩 = worker / protocol / scheme 环境特有）。
 *
 * 注：vitest jsdom 环境无真 Worker，用 fakeWorkerAdapter 绕 configureWorker（不设
 * workerPort，pdfjs 走 fake worker 主线程解析）。真机 WKWebView 的 Worker 行为本测试
 * 不覆盖——覆盖层 = 真机验证（verification-loop 阶段 6 / lessons-from-practice 教训 3）。
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import {
  loadPdfFromBytes,
  type PdfJsLoadingTaskLike,
  type PdfJsReaderAdapter,
} from "../../src/modules/reader/pdfReaderService";

const referencePath = resolve(process.cwd(), "tests/fixtures/expert/reference.pdf");
const corruptPath = resolve(process.cwd(), "tests/fixtures/reader/corrupt.pdf");

// jsdom / node 无 DOMMatrix 等浏览器全局，pdfjs 6 非 legacy build 模块顶层即崩
// （ReferenceError: DOMMatrix is not defined）。用 legacy build（node 兼容）。
// 真机 WKWebView 有完整 DOM 全局，product 代码用非 legacy 不受影响——此差异本身是
// verification-loop lessons-from-practice 教训 3 的实例（test 环境 ≠ webview 环境）。
const require = createRequire(import.meta.url);
const legacyWorkerHref = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const fakeWorkerAdapter: PdfJsReaderAdapter = {
  configureWorker: async () => {
    const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // vitest 下 import.meta.url 是 http:（vite serve），node ESM loader 只支持 file:/data:。
    // 用 require.resolve 拿 worker 真路径 + pathToFileURL 转 file: URL，fake worker 才能 import。
    GlobalWorkerOptions.workerSrc = legacyWorkerHref;
  },
  getDocument: async (params) => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    return getDocument(params) as unknown as PdfJsLoadingTaskLike;
  },
};

describe("reader loadPdfFromBytes（ISS-QA-02 回归 + 诊断）", () => {
  test("reference.pdf 加载成功 + 文字层可检测 + 不抛错", async () => {
    const bytes = new Uint8Array(await readFile(referencePath));
    const doc = await loadPdfFromBytes(
      { data: bytes, fileName: "reference.pdf", filePath: referencePath },
      fakeWorkerAdapter,
    );

    // QA-02 核心：正常 PDF 必须加载成功，pageCount 正确。
    expect(doc.metadata.pageCount).toBe(5);
    // QA-02 核心：文字层状态必须可检测（≠ unknown）。unknown = pdfjs 解析 / 探测异常。
    expect(doc.metadata.textLayerStatus).not.toBe("unknown");
    // 正常 fixture（专家版 reference）应含可提取文字。
    const firstPageText = await doc.getPageText(0);
    expect(firstPageText.charCount).toBeGreaterThan(0);

    await doc.destroy();
  });

  test("corrupt.pdf 加载失败抛错（错误路径可识别）", async () => {
    const bytes = new Uint8Array(await readFile(corruptPath));
    await expect(
      loadPdfFromBytes(
        { data: bytes, fileName: "corrupt.pdf", filePath: corruptPath },
        fakeWorkerAdapter,
      ),
    ).rejects.toThrow();
  });
});
