#!/usr/bin/env node
/**
 * ISS-NEW-M M2 视觉验证器：PDF Expert reference bbox 几何对齐（DEC-182）。
 *
 * 策略：几何结构 diff（DOM bbox 对比），不做感知像素 diff。
 * 原因：PDF Expert（macOS 原生）与 FaroPDF（web）渲染引擎/字体/chrome 本质不同，
 * 像素级 diff 必然失败。本验证器只断言"布局区域的结构性几何"在容差内对齐——
 * 即 FaroPDF 的工具栏高度、左右栏宽度等与 PDF Expert reference 的 bbox 一致。
 *
 * reference 来源：docs/reference/pdf-expert/measurements.json（measured，非 accepted-golden）。
 * 门禁张力：M2 卡要求 accepted-golden，但当前为 0。本验证器用 measured reference，
 * 把"升级到 accepted-golden"作为可替换 reference 输入；M1 完成后换 reference 目录即可。
 *
 * 退出码：
 *   0 = 全部 surface 在容差内
 *   1 = 至少一个 surface 超容差（报告说明哪个、差多少）
 *   2 = 环境错误（vite 没起、Playwright 没装、measurements.json 缺失）
 *
 * 与 verify:ui-layout 的分工：
 *   verify:ui-layout → 结构/几何回归（L3 五段、DOM 顺序、模式路由）
 *   verify:pdf-expert-visual → PDF Expert reference bbox 对齐（本脚本）
 *   两者不重叠，不互相替代。
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.FAROPDF_E2E_BASE_URL ?? "http://127.0.0.1:1420";
const artifactRoot = resolve(projectRoot, "tmp/verification/pdf-expert-visual");
const fixturePath = resolve(projectRoot, "tests/fixtures/expert/reference.pdf");
const measurementsPath = resolve(projectRoot, "docs/reference/pdf-expert/measurements.json");

// 容差：measurements uncertainty ±4pt × 3 倍安全系数 = ±12pt。
// M1 产出 accepted-golden 后可收紧到 ±6pt。
const TOLERANCE_PT = 12;

// FaroPDF 视口：与 measurements.json 的 window.logical 一致（1280×832）。
const VIEWPORT = { width: 1280, height: 832 };

let devServer = null;

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await globalThis.fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite still starting.
    }
    await new Promise((r) => globalThis.setTimeout(r, 250));
  }
  throw new Error(`Vite did not become ready at ${baseUrl}`);
}

async function ensureServer() {
  try {
    const response = await globalThis.fetch(baseUrl);
    if (response.ok) return;
  } catch {
    // Start below.
  }
  devServer = spawn(
    resolve(projectRoot, "node_modules/.bin/vite"),
    ["--config", "config/vite.config.ts", "--host", "127.0.0.1"],
    { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  devServer.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  devServer.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  await waitForServer();
}

async function loadMeasurements() {
  try {
    const raw = await readFile(measurementsPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    process.stderr.write(`无法读取 measurements.json: ${error.message}\n`);
    process.exit(2);
  }
}

function findSurface(measurements, captureId) {
  const surface = measurements.surfaces.find((s) => s.capture_id === captureId);
  if (!surface) {
    process.stderr.write(`measurements.json 缺少 surface: ${captureId}\n`);
    process.exit(2);
  }
  return surface;
}

async function openFixture(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('input[type="file"][aria-label="选择本地 PDF 文件"]').setInputFiles(fixturePath);
  await page.locator(".page-control").filter({ hasText: "1 / 5" }).waitFor();
}

async function bbox(page, selector, label) {
  const locator = page.locator(selector).first();
  const value = await locator.boundingBox();
  if (!value) {
    throw new Error(`${label}: selector "${selector}" 无 boundingBox（元素可能不存在）`);
  }
  return value;
}

function compare(actual, expected, label) {
  const diff = Math.round(Math.abs(actual - expected));
  const passed = diff <= TOLERANCE_PT;
  return { label, actual, expected, diff, passed, tolerance: TOLERANCE_PT };
}

async function verifyReadDefault(page, measurements) {
  const surface = findSurface(measurements, "N-CROP-READ-DEFAULT");
  await openFixture(page);
  await page.locator(".workspace[data-layout='main-only']").waitFor();

  // reference: titlebar(29) + main_toolbar(32) = 61pt 合计高度。
  // FaroPDF 无独立 titlebar，app-toolbar 整体高度对齐这个合计值。
  const refToolbarHeight = surface.layers.titlebar.height + surface.layers.main_toolbar.height;
  const actualToolbar = await bbox(page, '[data-testid="app-toolbar"]', "read toolbar");

  return [
    compare(Math.round(actualToolbar.height), refToolbarHeight, "read: toolbar 合计高度"),
  ];
}

async function verifyAnnotate(page, measurements) {
  const surface = findSurface(measurements, "N-ANNOTATE-TOOLBAR");
  await openFixture(page);
  await page.getByRole("button", { name: "A 批注", exact: true }).click();
  await page.locator(".workspace[data-layout='main-right']").waitFor();

  // reference 的 annotate surface layers 含 main_toolbar(29) + annotation_toolbar(65)。
  // titlebar 在 N-ANNOTATE-TOOLBAR 里没有独立 layer，用 main_toolbar 的高度近似 titlebar。
  const titlebarH = surface.layers.titlebar?.height ?? surface.layers.main_toolbar?.height ?? 0;
  const toolbarH = surface.layers.annotation_toolbar?.height ?? 0;
  const refToolbarHeight = titlebarH + toolbarH;
  const actualToolbar = await bbox(page, '[data-testid="app-toolbar"]', "annotate toolbar");

  // 右栏宽度：annotate 模式默认显示右栏（stamps/signatures）。
  // reference 用 N-CROP-L3-SEARCH 的 right_search_panel.width(480)——注意 PDF Expert
  // 该宽度是搜索面板测得的，签名/图章面板精确宽度仍待补 measured，此处数值对齐仅供参考。
  const searchSurface = findSurface(measurements, "N-CROP-L3-SEARCH");
  const refRightWidth = searchSurface.layers.right_search_panel?.width ?? 480;
  const actualRight = await bbox(page, ".right-pane", "annotate right panel");

  return [
    compare(Math.round(actualToolbar.height), refToolbarHeight, "annotate: toolbar+L4 合计高度"),
    compare(Math.round(actualRight.width), refRightWidth, "annotate: 右栏宽度"),
  ];
}

async function verifyEditCanvas(page, measurements) {
  const surface = findSurface(measurements, "N-EDIT-CANVAS");
  await openFixture(page);
  await page.getByRole("button", { name: "T 编辑", exact: true }).click();
  await page.locator(".workspace[data-layout='main-only']").waitFor();

  const titlebarH = surface.layers.titlebar?.height ?? surface.layers.main_toolbar?.height ?? 0;
  const toolbarH = surface.layers.edit_toolbar?.height ?? 0;
  const refToolbarHeight = titlebarH + toolbarH;
  const actualToolbar = await bbox(page, '[data-testid="app-toolbar"]', "edit toolbar");

  return [
    compare(Math.round(actualToolbar.height), refToolbarHeight, "edit: toolbar+L4 合计高度"),
  ];
}

async function main() {
  const { chromium } = await import("playwright").catch(() => {
    process.stderr.write("playwright 未安装。运行 npm install 后重试。\n");
    process.exit(2);
  });

  await mkdir(artifactRoot, { recursive: true });
  const measurements = await loadMeasurements();
  await ensureServer();

  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    // read-default
    try {
      const r = await verifyReadDefault(page, measurements);
      allResults.push({ surface: "read-default", checks: r });
      await page.screenshot({ path: resolve(artifactRoot, "read-default-actual.png"), fullPage: false });
    } catch (error) {
      allResults.push({ surface: "read-default", error: error.message });
    }

    // annotate（新 context 避免状态残留）
    await context.close();
    const ctx2 = await browser.newContext({ viewport: VIEWPORT });
    const page2 = await ctx2.newPage();
    try {
      const r = await verifyAnnotate(page2, measurements);
      allResults.push({ surface: "annotate", checks: r });
      await page2.screenshot({ path: resolve(artifactRoot, "annotate-actual.png"), fullPage: false });
    } catch (error) {
      allResults.push({ surface: "annotate", error: error.message });
    }
    await ctx2.close();

    // edit-canvas
    const ctx3 = await browser.newContext({ viewport: VIEWPORT });
    const page3 = await ctx3.newPage();
    try {
      const r = await verifyEditCanvas(page3, measurements);
      allResults.push({ surface: "edit-canvas", checks: r });
      await page3.screenshot({ path: resolve(artifactRoot, "edit-canvas-actual.png"), fullPage: false });
    } catch (error) {
      allResults.push({ surface: "edit-canvas", error: error.message });
    }
    await ctx3.close();
  } finally {
    await browser.close();
    if (devServer) devServer.kill("SIGTERM");
  }

  // 汇总
  const report = {
    timestamp: new Date().toISOString(),
    tolerance_pt: TOLERANCE_PT,
    reference: "docs/reference/pdf-expert/measurements.json (measured, not accepted-golden)",
    viewport: VIEWPORT,
    results: allResults,
  };
  await writeFile(resolve(artifactRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");

  // 控制台摘要
  let failCount = 0;
  process.stdout.write("\n=== PDF Expert 视觉验证器（几何 diff）===\n");
  process.stdout.write(`reference: measured (非 accepted-golden) | 容差: ±${TOLERANCE_PT}pt\n\n`);
  for (const r of allResults) {
    if (r.error) {
      failCount += 1;
      process.stdout.write(`  ✗ ${r.surface}: ERROR ${r.error}\n`);
      continue;
    }
    for (const c of r.checks) {
      const icon = c.passed ? "✓" : "✗";
      if (!c.passed) failCount += 1;
      process.stdout.write(
        `  ${icon} ${c.label}: 实际 ${c.actual}pt / 期望 ${c.expected}pt / 差 ${c.diff}pt (容差 ${c.tolerance})\n`,
      );
    }
  }

  process.stdout.write(`\n${failCount === 0 ? "PASS" : `FAIL (${failCount} 项超容差)`}\n`);
  process.stdout.write(`报告: ${resolve(artifactRoot, "report.json")}\n`);

  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`验证器崩溃: ${error?.stack ?? error}\n`);
  if (devServer) devServer.kill("SIGTERM");
  process.exit(2);
});
