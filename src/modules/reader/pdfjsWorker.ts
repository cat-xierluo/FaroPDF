/**
 * 配置 pdfjs worker。
 *
 * ISS-QA-02（2026-08-05）：用 `workerPort`（Worker 实例）代替 `workerSrc`（URL 字符串），
 * 绕开 `tauri://` origin=null 时 pdfjs 的 `_createCDNWrapper` blob 包装分支。
 *
 * ISS-QA-02 第 4 版（2026-08-15，真机 console 定案）：pdfjs-dist 6 现代
 * 构建使用 TC39 Map upsert 提案的 `Map.prototype.getOrInsertComputed` 等
 * 新内置——macOS 15 WKWebView（Safari 18 引擎）没有（Safari 26 才有），
 * `getTextContent` / `getOptionalContentConfig`（render 路径）直接
 * `TypeError: getOrInsertComputed is not a function` → 页面空白 + 文字层
 * 未知。chromium（1.60 内核 ≥136 自带该方法）下所有门禁全绿，唯一覆盖不
 * 到的就是 WKWebView 引擎代差。**解法：全线切换 pdfjs legacy 构建**（转译
 * + polyfill，面向旧引擎；jsdom 测试层本就在用 legacy fake worker，行为
 * 一致）。worker 与主线程 API 必须同构建版本，两处一起切。
 */
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?worker&inline";

export async function configurePdfjsWorker(): Promise<void> {
  const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (GlobalWorkerOptions.workerPort) {
    return;
  }
  let worker: Worker;
  try {
    worker = new PdfWorker();
  } catch (error) {
    // 构造同步失败（理论上的 scheme/安全限制）：不设 workerPort，
    // pdfjs 走 fake worker 兜底；真因打到 console 便于真机定位。
    console.error("[FaroPDF] pdfjs Worker 构造失败，降级 fake worker：", error);
    return;
  }
  worker.addEventListener("error", (event) => {
    console.error(
      "[FaroPDF] pdfjs Worker 加载失败，降级 fake worker（下次 getDocument 生效）：",
      event.message,
      event.filename ? `${event.filename}:${event.lineno}` : "",
    );
    // 关键：清掉死 port，否则 pdfjs 把消息发进死 worker，getDocument 永久挂起
    // （2026-08-14 打包真机「页面空白」根因）。
    GlobalWorkerOptions.workerPort = null;
    try {
      worker.terminate();
    } catch {
      // 已退出则忽略。
    }
  });
  GlobalWorkerOptions.workerPort = worker;
}
