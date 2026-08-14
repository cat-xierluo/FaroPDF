/* global fetch */
// Real-device verification of QA-02 fix on the built .app (WebKit/WKWebView).
// NOTE(2026-08-05)：当前 wry/macOS 下 WEBKIT_INSPECTOR_SERVER 不生效 + Safari
// 开发菜单列不出 FaroPDF WKWebView target，此脚本暂不可运行；保留作将来
// wry 支持 inspector 时的真机验证参考。可用的受控验证见 qa02-verify.mjs。
// Launches the release .app with WEBKIT_INSPECTOR_SERVER, connects Playwright
// chromium over CDP, emits faropdf://file-drop to open reference.pdf, then
// reads the status-bar text-layer status and screenshots it.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const APP =
  "/Users/maoking/Library/Application Support/maoscripts/FaroPDF/src-tauri/target/release/bundle/macos/FaroPDF.app/Contents/MacOS/faropdf";
const REFERENCE =
  "/Users/maoking/Library/Application Support/maoscripts/FaroPDF/tests/fixtures/expert/reference.pdf";
const INSPECTOR = "127.0.0.1:9222";
const SHOT = "/Users/maoking/Library/Application Support/maoscripts/FaroPDF/qa02-realdevice.png";

const child = spawn(APP, [], {
  env: { ...process.env, WEBKIT_INSPECTOR_SERVER: INSPECTOR },
  stdio: "ignore",
  detached: true,
});

async function getCdpTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://${INSPECTOR}/json/version`);
      if (r.ok) return true;
    } catch {
      /* inspector 未就绪，重试 */
    }
    await sleep(500);
  }
  return false;
}

try {
  const ok = await getCdpTarget();
  if (!ok) throw new Error("inspector server never came up");

  const browser = await chromium.connectOverCDP(`http://${INSPECTOR}`);
  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());
  const pages = context.pages();
  const page = pages[0] || (await context.newPage());

  await page.waitForLoadState("load").catch(() => {});
  await sleep(1500);

  // Open the PDF by emitting the native file-drop event the app listens for.
  await page.evaluate((p) => {
    window.__faropdfTest = window.__faropdfTest || {};
    const w = window;
    // Tauri injects a global to emit; fall back to dispatching via tauri api.
    // We use the documented listener channel by calling the internal emit if present.
    if (w.__TAURI__?.event?.emit) {
      return w.__TAURI__.event.emit("faropdf://file-drop", { path: p });
    }
    // Fallback: many builds expose invoke; try the command path.
    if (w.__TAURI__?.core?.invoke) {
      return w.__TAURI__.core.invoke("open_path", { path: p });
    }
    throw new Error("no tauri emit bridge found");
  }, REFERENCE).catch(async (e) => {
    console.log("emit failed, trying drag-drop DOM path:", e.message);
  });

  await sleep(4000);

  // Read the status bar text-layer status.
  const status = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const m = text.match(/文字层[：:]\s*([^\n]+)/);
    return m ? m[1].trim() : "(not found)";
  });

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log("TEXT_LAYER_STATUS:", status);
  console.log("SCREENSHOT:", SHOT);

  await browser.close();
} finally {
  try { process.kill(-child.pid); } catch { /* 进程可能已退出 */ }
}
