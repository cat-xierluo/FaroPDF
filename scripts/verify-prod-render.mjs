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

async function runScenario(label, { deviceScaleFactor } = {}) {
  const context = await browser.newContext({ deviceScaleFactor });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleMsgs.push(`[${label}-pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await delay(1500);

  const input = page.getByTestId("welcome-file-input");
  await input.setInputFiles(FIXTURE);

  let canvasInfo = null;
  for (let i = 0; i < 40; i++) {
    canvasInfo = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext("2d");
      if (!ctx) return { exists: true, w: c.width, h: c.height, ctx: false };
      const d = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 400)).data;
      let nonZero = 0;
      for (let j = 0; j < d.length; j += 4) {
        if (d[j] || d[j + 1] || d[j + 2]) nonZero += 1;
      }
      return {
        exists: true,
        w: c.width,
        h: c.height,
        cssW: Math.round(rect.width),
        dpr: window.devicePixelRatio,
        ctx: true,
        nonZero,
      };
    });
    if (canvasInfo?.ctx && canvasInfo.nonZero > 100) break;
    await delay(500);
  }
  // ISS-QA-18：文字层（可选中 span）真实 UI 断言——等 span 出现后程序化框选，
  // 断言 window.getSelection() 能取到非空文本（选中/复制的能力基础）。
  let selectionInfo = null;
  for (let i = 0; i < 20; i++) {
    selectionInfo = await page.evaluate(() => {
      const span = document.querySelector(".pdf-text-layer span");
      if (!span) return null;
      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return {
        spanCount: document.querySelectorAll(".pdf-text-layer span").length,
        selectedText: sel?.toString() ?? "",
      };
    });
    if (selectionInfo && selectionInfo.spanCount > 0 && selectionInfo.selectedText.trim().length > 0) break;
    await delay(500);
  }
  canvasInfo = canvasInfo ? { ...canvasInfo, selection: selectionInfo } : canvasInfo;
  console.log(`[${label}] 文字层选区=`, JSON.stringify(selectionInfo));

  // 真实搜索高亮矩形（2026-08-15）：输入搜索词 → 断言页内出现定位矩形
  // （.page-search-rect，pt × zoom 绝对定位）。仅 DPR1 场景跑（DPR2 复用同链路）。
  let searchRectInfo = null;
  if (deviceScaleFactor === undefined || deviceScaleFactor === 1) {
    try {
      const box = page.getByRole("searchbox", { name: "全文搜索" });
      await box.fill("MUTUAL", { timeout: 5_000 });
      await box.press("Enter");
      for (let i = 0; i < 20; i++) {
        searchRectInfo = await page.evaluate(() => {
          const rects = Array.from(document.querySelectorAll(".page-search-rect"));
          if (rects.length === 0) return null;
          const first = rects[0].getBoundingClientRect();
          return {
            count: rects.length,
            firstRect: { w: Math.round(first.width), h: Math.round(first.height) },
          };
        });
        if (searchRectInfo && searchRectInfo.count > 0 && searchRectInfo.firstRect.w > 0) break;
        await delay(500);
      }
    } catch (error) {
      searchRectInfo = { error: String(error).slice(0, 120) };
    }
  }
  canvasInfo = canvasInfo ? { ...canvasInfo, searchRects: searchRectInfo } : canvasInfo;
  console.log(`[${label}] 搜索矩形=`, JSON.stringify(searchRectInfo));
  console.log(`[${label}] canvas=`, JSON.stringify(canvasInfo));
  console.log(`[${label}] console 尾部：`, consoleMsgs.slice(-6).join(" || ") || "(无)");
  await context.close();
  return canvasInfo;
}

const dpr1 = await runScenario("DPR1", {});
const dpr2 = await runScenario("DPR2-Retina", { deviceScaleFactor: 2 });
await browser.close();
try {
  process.kill(-preview.pid, "SIGTERM");
} catch {
  // preview 进程已自行退出则无需清理。
}
const renderOk = (info) => Boolean(info?.ctx && info.nonZero > 100);
const selectionOk = Boolean(
  dpr1?.selection && dpr1.selection.spanCount > 0 && dpr1.selection.selectedText.trim().length > 0,
);
const searchRectsOk = Boolean(
  dpr1?.searchRects && dpr1.searchRects.count > 0 && dpr1.searchRects.firstRect?.w > 0,
);
const retinaOk = Boolean(
  dpr2 && renderOk(dpr2) && Math.abs(dpr2.w - dpr2.cssW * dpr2.dpr) <= 2,
);
const ok = renderOk(dpr1) && selectionOk && searchRectsOk && retinaOk;
console.log(`[判定] DPR1 渲染=${renderOk(dpr1)} 文字层选区=${selectionOk} 搜索矩形=${searchRectsOk} DPR2 渲染=${renderOk(dpr2)} Retina 倍率=${retinaOk}（backing ${dpr2?.w} vs css ${dpr2?.cssW}×${dpr2?.dpr}）`);
console.log(`\n=== ${ok ? "PASS：产物层渲染正常（Retina DPR=2 + 文字层选区 + 搜索矩形）" : "FAIL：产物层复现空白/无 canvas/Retina 倍率不符/无文字层/无搜索矩形"} ===`);
process.exit(ok ? 0 : 1);
