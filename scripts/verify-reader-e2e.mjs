#!/usr/bin/env node
/**
 * verify:reader-e2e —— Reader 改动的功能 e2e 回归门禁（AGENTS.md §自测纪律）。
 *
 * 自包含：自动起 vite dev server（1420 strictPort）→ 跑 scripts/qa02-verify.mjs
 * （chromium 真 module Worker + 真 standardFontDataUrl fetch：断言 reference.pdf
 * 渲染 + textLayerStatus="available" + corrupt.pdf 正确抛 InvalidPDF）→
 * 关 server → 透传退出码。
 *
 * 与 `npm run test:e2e`（vitest jsdom，legacy fake worker）互补：
 * - test:e2e 抓 pdfjs 逻辑回归（快，约 5s，无需浏览器，CI test job 里跑）；
 * - 本脚本抓真 Worker / 字体 URL / dev server 资产链路回归（QA-02 那类
 *   「jsdom 过、真机崩」问题），CI playwright job 里跑。
 *
 * 覆盖边界：WKWebView 真机行为仍不覆盖——那层用 `npm run etv:run`
 * （scripts/etv-faropdf.mjs，CDP 连 tauri dev 真机）或 `npm run tauri build`
 * 产物实机（AGENTS.md §验证体系「真实桌面 etv」）。
 *
 * 若 1420 已有 dev server 在跑（strictPort 下新起的会自己退出），复用现有
 * server，结束时只清理自己起的进程。
 */
/* global fetch */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEV_URL = process.env.DEV_URL || "http://localhost:1420/";
const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 500;

async function isServerUp() {
  try {
    const res = await fetch(DEV_URL, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isServerUp()) return true;
    await delay(POLL_MS);
  }
  return false;
}

const isWindows = process.platform === "win32";
// detached（非 Windows）建进程组，结束时 kill(-pid) 连带 npm→node→vite 整树。
const dev = spawn("npm", ["run", "dev"], {
  stdio: ["ignore", "ignore", "inherit"],
  detached: !isWindows,
  shell: isWindows,
});

const hadServerBefore = await isServerUp();
let childExit = 1;
try {
  // 注意：try 内不用 process.exit（会跳过 finally，泄漏 dev server）。
  if (hadServerBefore || (await waitForServer())) {
    console.log(`[verify:reader-e2e] dev server ready: ${DEV_URL}`);
    childExit = await new Promise((resolve) => {
      const child = spawn("node", ["scripts/qa02-verify.mjs"], {
        stdio: "inherit",
        env: { ...process.env, DEV_URL },
      });
      child.on("error", (err) => {
        console.error(`[verify:reader-e2e] 无法启动 qa02-verify.mjs: ${err.message}`);
        resolve(1);
      });
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } else {
    console.error(
      `[verify:reader-e2e] dev server ${DEV_URL} 在 ${READY_TIMEOUT_MS / 1000}s 内未就绪`,
    );
  }
} finally {
  if (!hadServerBefore) {
    try {
      if (isWindows) {
        spawn("taskkill", ["/pid", String(dev.pid), "/T", "/F"]);
      } else {
        process.kill(-dev.pid, "SIGTERM");
      }
    } catch {
      // 进程已退出（如 strictPort 冲突自杀）则无需清理。
    }
  }
}

console.log(`[verify:reader-e2e] exit ${childExit}`);
process.exit(childExit);
