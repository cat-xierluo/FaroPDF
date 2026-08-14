#!/usr/bin/env node
/**
 * etv-faropdf —— FaroPDF 真实 Tauri 桌面验证（end-to-end verification，真机门禁）。
 *
 * 参照 Folia `scripts/etv-folia.mjs`（CDP 直连模式，源自 horseMD etv.mjs）：
 * 连接一个已经在跑的 `tauri dev` 实例（macOS WKWebView 暴露 9222），通过裸
 * WebSocket CDP 协议直接断言真实桌面端行为，绕过 vite dev server 的浏览器路径。
 *
 * 启动方式：
 *   1. `npm run etv:dev`
 *      （= WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222 tauri dev；Linux/Windows
 *       用对应 GTK / WebView2 环境变量。）
 *   2. 另一个终端：`npm run etv:run` → 本脚本。
 *
 * 不进 GitHub Actions：macOS WKWebView 在 Linux/Windows runner 跑不动；
 * 仅供开发者本地复测真实 Tauri WebView 行为（AGENTS.md §验证体系「真实桌面 etv」）。
 *
 * ⚠️ 已知限制（DEC-196，2026-08-05 实测）：`WEBKIT_INSPECTOR_SERVER` 在 wry
 * 当前 macOS 版本可能不生效（Safari 开发菜单列不出 WKWebView target）。此时
 * 本脚本会在 CDP 连接阶段明确失败并给出指引——这本身就是门禁语义：
 * 「真机层无法取证」不允许被静默跳过。降级路径：`npm run tauri build` 产物
 * 实机手测 + `npm run verify:reader-e2e`（chromium 真 Worker）作证据链。
 *
 * ── horseMD 4 个 CDP 踆坑（Folia 沉淀，防止重犯）────────────────────
 * 1. 合成拖拽（Input.dispatchMouseEvent）不驱动 Tauri 选区 / Finder 拖放
 *    → 系统级拖入必须走 Rust DragDrop 事件链（FaroPDF ISS-QA-01），
 *      e2e 用 mock `faropdf://file-drop`；本脚本不模拟 Finder 拖入。
 * 2. `requestAnimationFrame` 在 WKWebView 窗口遮挡时被节流
 *    → 等待用固定 setTimeout + 显式等 DOM 锚点，不用 rAF 计数。
 * 3. `/json/new`（CDP 新建 target）在 Tauri 2 + wry 多数版本被禁
 *    → 不调用 browser.newContext()；从现有 page targets 里挑主窗口复用。
 * 4. CDP 协议版本兼容 → 只走 Runtime / Page 这些稳定 domain。
 */

/* global fetch, setTimeout, WebSocket */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CDP_BASE = process.env.FAROPDF_CDP_URL || "http://127.0.0.1:9222";
const ARTIFACT_DIR = resolve(process.cwd(), ".playwright-mcp");
mkdirSync(ARTIFACT_DIR, { recursive: true });

const REPORT = { meta: { cdp: CDP_BASE, ts: new Date().toISOString() }, scenarios: {} };
let failures = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ──────────────── CDP transport（horseMD 风格裸 WebSocket）──────────────── */
async function connect() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch(`${CDP_BASE}/json/list`)).json();
      const pages = targets.filter((t) => t.type === "page");
      if (pages.length) break;
    } catch {
      /* 端口尚未就绪，继续轮询 */
    }
    await sleep(500);
  }
  const main = targets?.find?.((t) => t.type === "page");
  if (!main) {
    throw new Error(
      `[etv-faropdf] CDP ${CDP_BASE} 没有 page target。\n` +
        "可能原因：\n" +
        "  1. 未启动：先 `npm run etv:dev`（WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222 tauri dev）\n" +
        "  2. wry 当前 macOS 版本 WEBKIT_INSPECTOR_SERVER 不生效（DEC-196 已知限制）→\n" +
        "     降级：`npm run tauri build` 产物实机手测 + `npm run verify:reader-e2e` 证据链\n",
    );
  }
  const ws = new WebSocket(main.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = () => j(new Error(`[etv-faropdf] WebSocket 连接 ${main.webSocketDebuggerUrl} 失败`));
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const cur = ++id;
      pending.set(cur, res);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });
  return { ws, send, targetUrl: main.url };
}

const evals = (send) => async (fn, ...args) => {
  const body = String(fn);
  const argList = args.map((a) => JSON.stringify(a)).join(", ");
  const expr = argList.length > 0 ? `(${body})(${argList})` : `(${body})()`;
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  const res = r.result;
  if (res?.exceptionDetails) {
    return { __error: res.exceptionDetails.exception?.description || res.exceptionDetails.text };
  }
  return res?.result?.value;
};

function record(name, pass, detail) {
  REPORT.scenarios[name] = { pass, ...(detail ? { detail } : {}) };
  if (!pass) failures += 1;
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ──────────────── 场景 ─────────────────────────────────────────────────── */

/**
 * 场景 1 · app-boots：真实 WKWebView 里应用 shell 真的渲染。
 * 断言（防「白屏 / 空壳」伪启动）：
 *   - document.readyState complete
 *   - L3 Toolbar 5 段 data-section 全部存在（ISS-NEW-A 契约）
 *   - 空文档态显示 WelcomeScreen（或已打开文档的 reader canvas）
 */
async function scenarioAppBoots({ send }) {
  const ev = evals(send);

  const boot = await ev(() => ({
    readyState: document.readyState,
    sections: Array.from(document.querySelectorAll("[data-section]")).map((el) => el.dataset.section),
    hasWelcome: Boolean(document.querySelector(".welcome-screen, [class*='welcome' i]")),
    hasCanvas: Boolean(document.querySelector("canvas")),
    bodyText: (document.body?.innerText || "").slice(0, 120),
  }));

  if (boot.__error) {
    record("app-boots", false, `evaluate 失败: ${boot.__error}`);
    return;
  }
  const required = ["navigation", "zoom", "workflows", "collaboration", "search"];
  const missing = required.filter((s) => !boot.sections?.includes(s));
  const pass = boot.readyState === "complete" && missing.length === 0 && (boot.hasWelcome || boot.hasCanvas);
  record(
    "app-boots",
    pass,
    `readyState=${boot.readyState} sections=[${boot.sections?.join(",")}] welcome=${boot.hasWelcome} canvas=${boot.hasCanvas} text="${boot.bodyText?.slice(0, 40)}"${missing.length ? ` missing=[${missing.join(",")}]` : ""}`,
  );
}

/**
 * 场景 2 · screenshot：真实窗口截图存档（.playwright-mcp/，已 gitignore），
 * 供人工核对；不进库、不做像素 diff（accepted-golden=0，DEC-187 视觉可选）。
 */
async function scenarioScreenshot({ send, targetUrl }) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (!r.result?.data) {
    record("screenshot", false, "Page.captureScreenshot 未返回 data");
    return;
  }
  const file = resolve(ARTIFACT_DIR, `etv-faropdf-${Date.now()}.png`);
  writeFileSync(file, Buffer.from(r.result.data, "base64"));
  record("screenshot", true, `${file} (${targetUrl})`);
}

/* ──────────────── main ─────────────────────────────────────────────────── */
const { ws, send, targetUrl } = await connect();
console.log(`[etv-faropdf] connected: ${targetUrl}`);
await scenarioAppBoots({ send });
await scenarioScreenshot({ send, targetUrl });

writeFileSync(resolve(ARTIFACT_DIR, "etv-faropdf-report.json"), JSON.stringify(REPORT, null, 2));
console.log(`\n[etv-faropdf] report: ${resolve(ARTIFACT_DIR, "etv-faropdf-report.json")}`);
try {
  ws.close();
} catch {
  /* 已断开 */
}
process.exit(failures > 0 ? 1 : 0);
