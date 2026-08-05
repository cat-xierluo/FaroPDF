/**
 * 配置 pdfjs worker。
 *
 * ISS-QA-02：用 `workerPort`（Worker 实例）代替 `workerSrc`（URL 字符串），
 * 绕开 `tauri://` origin=null 时 pdfjs 的 `_createCDNWrapper` blob 包装分支。
 *
 * ISS-QA-02 诊断增强（可观测性）：Worker 构造 / 异步加载失败不静默——
 * 构造失败 console.error 真因后降级（不设 workerPort，让 pdfjs 走 fake worker 兜底）；
 * 异步加载失败（404 / MIME / scheme 不兼容）经 worker "error" 事件打 console。
 * 真机 devtools 可直接定位「打开 PDF 显示损坏」背后的真 pdfjs error，替代盲改循环。
 */
export async function configurePdfjsWorker(): Promise<void> {
  const { GlobalWorkerOptions } = await import("pdfjs-dist");
  if (GlobalWorkerOptions.workerPort) {
    return;
  }
  try {
    const worker = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener("error", (event) => {
      console.error(
        "[FaroPDF] pdfjs Worker 加载失败：",
        event.message,
        event.filename ? `${event.filename}:${event.lineno}` : "",
      );
    });
    GlobalWorkerOptions.workerPort = worker;
  } catch (error) {
    // 构造同步失败（WKWebView 自定义 scheme / module worker 不兼容）：
    // 不抛，让 pdfjs 走 fake worker 兜底；真因打到 console 便于真机定位。
    console.error("[FaroPDF] pdfjs Worker 构造失败，降级 fake worker：", error);
  }
}
