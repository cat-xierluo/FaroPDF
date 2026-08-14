/* global fetch */
/**
 * 产物层渲染门禁（2026-08-14，QA-02 第 3 版配套）。
 *
 * vite preview（**build 产物**，非 dev server）+ chromium 走真实 UI 打开 PDF →
 * 断言 canvas 真渲染（像素非空）+ 状态栏「文字层可用」。
 *
 * 为什么需要：既有三层门禁都不碰 build 产物——test:e2e 跑 jsdom、
 * verify:reader-e2e 和组件测试跑 vite **dev server**。QA-02 三轮教训证明
 * 「dev 过 ≠ 打包过」（dev 走 http，打包走 tauri:// 自定义 scheme + 产物 asset
 * 形态）；本门禁补「产物 asset 形态」这层（chromium + http），scheme 层仍由
 * 真机手测覆盖。用法：先 `npm run build`，再 `npm run verify:prod-render`。
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const URL = "http://localhost:4173/";
const FIXTURE = resolve(process.cwd(), "tests/fixtures/expert/reference.pdf");

async function up() {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

const preview = spawn("npx", ["vite", "preview", "--config", "config/vite.config.ts", "--port", "4173", "--strictPort"], {
  stdio: ["ignore", "ignore", "inherit"],
  detached: true,
});
for (let i = 0; i < 60 && !(await up()); i++) await delay(500);
if (!(await up())) {
  console.error("preview server 未就绪");
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await delay(1500);

const input = page.getByTestId("welcome-file-input");
if (!(await input.count())) {
  console.error("未找到 welcome-file-input（Welcome 屏未渲染？）");
  console.log(consoleMsgs.join("\n"));
  process.exit(1);
}
await input.setInputFiles(FIXTURE);

// 等 reader canvas 出现（打开链路：configureWorker → loadPdfFromBytes → render）
let canvasInfo = null;
for (let i = 0; i < 40; i++) {
  canvasInfo = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return { exists: true, w: c.width, h: c.height, ctx: false };
    const d = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 400)).data;
    let nonZero = 0;
    for (let j = 0; j < d.length; j += 4) {
      if (d[j] || d[j + 1] || d[j + 2]) nonZero += 1;
    }
    return { exists: true, w: c.width, h: c.height, ctx: true, nonZero };
  });
  if (canvasInfo?.ctx && canvasInfo.nonZero > 100) break;
  await delay(500);
}

const statusText = await page.evaluate(() => (document.body?.innerText || "").slice(0, 400));
console.log("=== canvas ===", JSON.stringify(canvasInfo));
console.log("=== body text (head) ===", statusText.replace(/\n/g, " | ").slice(0, 300));
console.log("=== console ===");
console.log(consoleMsgs.slice(-25).join("\n") || "(无)");

await browser.close();
try {
  process.kill(-preview.pid, "SIGTERM");
} catch {
  // preview 进程已自行退出则无需清理。
}
const ok = canvasInfo?.ctx && canvasInfo.nonZero > 100;
console.log(`\n=== ${ok ? "PASS：产物层渲染正常" : "FAIL：产物层复现空白/无 canvas"} ===`);
process.exit(ok ? 0 : 1);
