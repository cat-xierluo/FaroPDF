#!/usr/bin/env node
/**
 * ISS-QA-02 实机二次验证（chromium Playwright，2026-08-05）。
 *
 * 目标：验证 standardFontDataUrl 修复在「真实浏览器 Worker 模式」下
 * `loadPdfFromBytes` 的 textLayerStatus 不再卡 unknown。
 *
 * 背景：jsdom vitest e2e 用 legacy fake worker（不走字体路径），无法覆盖
 * 真 Worker 的字体解析；Tauri WKWebView 的 inspector 抓取受限（Safari 开发
 * 菜单未列出 WKWebView target）。chromium 有真 module Worker + 真
 * standardFontDataUrl 网络请求，行为与 WKWebView 一致（都是 fetch 字体 URL），
 * 是「真机二次验证」在受控环境下可自动化拿到的最强证据。
 *
 * 用法：先 `npm run dev`（vite dev server 在 1420），再 `node scripts/qa02-verify.mjs`。
 * 依赖 playwright chromium（已装 ~/Library/Caches/ms-playwright/chromium-*）。
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEV_URL = process.env.DEV_URL || "http://localhost:1420/";
const FIXTURE = resolve(process.cwd(), "tests/fixtures/expert/reference.pdf");
const FIXTURE_CORRUPT = resolve(process.cwd(), "tests/fixtures/reader/corrupt.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[QA-02-VERIFY]") || msg.type() === "error") {
    console.log(`[console.${msg.type()}] ${text}`);
  }
});
page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

// 加载应用（vite dev server），不注入到 React 树，直接在页面上下文跑 pdfjs 链路。
await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const bytes = new Uint8Array(await readFile(FIXTURE));
const corruptBytes = new Uint8Array(await readFile(FIXTURE_CORRUPT));

const result = await page.evaluate(async ({ data, corruptData }) => {
  const results = {};
  const { configurePdfjsWorker } = await import("/src/modules/reader/pdfjsWorker.ts");
  const { loadPdfFromBytes } = await import("/src/modules/reader/pdfReaderService.ts");

  // 修复路径（default adapter 带 standardFontDataUrl）
  await configurePdfjsWorker();
  try {
    const doc = await loadPdfFromBytes({
      data,
      fileName: "reference.pdf",
      filePath: "/fixtures/reference.pdf",
    });
    results.fixed = {
      ok: true,
      pageCount: doc.metadata.pageCount,
      textLayerStatus: doc.metadata.textLayerStatus,
      firstPageChars: (await doc.getPageText(0)).charCount,
    };
    await doc.destroy();
  } catch (e) {
    results.fixed = { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }

  // 错误路径：corrupt.pdf 应抛错
  try {
    await loadPdfFromBytes({
      data: corruptData,
      fileName: "corrupt.pdf",
      filePath: "/fixtures/corrupt.pdf",
    });
    results.corrupt = { ok: false, error: "expected throw but succeeded" };
  } catch (e) {
    results.corrupt = { ok: true, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
  return results;
}, { data: bytes, corruptData: corruptBytes });

console.log("\n=== QA-02 VERIFY RESULT ===");
console.log(JSON.stringify(result, null, 2));
await browser.close();

const pass = result.fixed?.ok && result.fixed?.textLayerStatus !== "unknown" && result.corrupt?.ok;
console.log(`\n=== ${pass ? "PASS" : "FAIL"} ===`);
process.exit(pass ? 0 : 1);
