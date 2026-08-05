/**
 * 配置 pdfjs worker。
 *
 * ISS-QA-02 修复（W2 报告 §7 方案1）：用 `workerPort`（Worker 实例）代替
 * `workerSrc`（URL 字符串）。
 *
 * 原因：`workerSrc` 字符串在 `tauri://` origin=null 时触发 pdfjs 的
 * `_createCDNWrapper` blob 包装分支（W2 §0.4），worker + fake worker 双失败，
 * 前端只拿到 `Error("Setting up fake worker failed: …")`，归一化为「未知错误」。
 * dev（http://localhost）下也观察到「未知」症状，说明 workerSrc 路径不稳。
 * 改用 `new Worker(new URL(...), {type:"module"})` + `GlobalWorkerOptions.workerPort`，
 * 直接 Worker 实例，绕开 workerSrc URL 解析，dev/prod 一致。
 */
export async function configurePdfjsWorker(): Promise<void> {
  const { GlobalWorkerOptions } = await import("pdfjs-dist");
  if (GlobalWorkerOptions.workerPort) {
    return;
  }
  const worker = new Worker(
    new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url),
    { type: "module" },
  );
  GlobalWorkerOptions.workerPort = worker;
}
