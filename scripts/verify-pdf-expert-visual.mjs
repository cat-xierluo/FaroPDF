#!/usr/bin/env node
/**
 * ISS-NEW-M M2 视觉验证器：PDF Expert reference bbox 几何对齐（DEC-182）。
 *
 * 策略：几何结构 diff（DOM bbox 对比），不做感知像素 diff。
 * 原因：PDF Expert（macOS 原生）与 FaroPDF（web）渲染引擎/字体/chrome 本质不同，
 * 像素级 diff 必然失败。本验证器只断言"布局区域的结构性几何"在容差内对齐——
 * 即 FaroPDF 的 L2/L3/L4 高度与 PDF Expert reference 的 bbox 一致，并对
 * edit / pages / annotate / search 的关键状态语义、G05 左栏与参考态状态栏可见性做 DOM 断言。不同 surface 的面板宽度
 * 不交叉借用；没有目标证据的 panel 不在本脚本里伪验证。
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
const REFERENCE_ZOOM_PERCENT = 48;
// FaroPDF 当前工具栏只能按 10% 步进；50% 是最接近参考 48% 的可复现 UI 状态。
// 页面/画布像素不在本验证器范围内，因此在报告中显式记录 2pt 差异而不伪造精确一致。
const RUNTIME_ZOOM_PERCENT = 50;

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
  await page.locator('.pdf-page[data-page-number="1"]').waitFor();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.getByRole("button", { name: "视图设置", exact: true }).click();
  const singlePage = page.locator('[data-testid="view-mode-grid"] button[data-view-mode="single"]');
  await singlePage.click();
  await page.locator('[data-testid="view-mode-grid"] button[data-view-mode="single"][aria-pressed="true"]').waitFor();
  await page.getByRole("button", { name: "视图设置", exact: true }).click();
  await page.locator(".workspace[data-layout='main-only']").waitFor();
  await page.keyboard.press("Home");
  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "缩小", exact: true }).click();
  }
  await page.locator(".zoom-control").filter({ hasText: `${RUNTIME_ZOOM_PERCENT}%` }).waitFor();
  await page.locator(".reader").evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator('.pdf-page[data-page-number="1"] canvas').waitFor();
  await page.waitForTimeout(250);
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

function assertState(passed, label, actual, expected = true) {
  return { label, actual, expected, passed, kind: "semantic" };
}

async function hiddenStatusBarCheck(page, label) {
  const visible = await page.getByTestId("status-bar").isVisible();
  return assertState(!visible, `${label}: reference surface 不显示额外状态栏`, visible, false);
}

async function sharedLayerChecks(page, surface, contextualLayerName = null) {
  const titlebar = await bbox(page, '[data-testid="titlebar-tabs"]', "L2 titlebar");
  const toolbar = await bbox(page, '[data-testid="app-toolbar"]', "L3 main toolbar");
  const checks = [
    compare(Math.round(titlebar.height), surface.layers.titlebar.height, `${surface.capture_id}: L2 titlebar 高度`),
    compare(Math.round(toolbar.height), surface.layers.main_toolbar.height, `${surface.capture_id}: L3 main toolbar 高度`),
  ];
  if (contextualLayerName) {
    const contextualToolbar = await bbox(page, ".context-toolbar", `${contextualLayerName} toolbar`);
    checks.push(
      compare(
        Math.round(contextualToolbar.height),
        surface.layers[contextualLayerName].height,
        `${surface.capture_id}: L4 ${contextualLayerName} 高度`,
      ),
    );
  }
  if (surface.toolbar_groups) {
    for (const [sectionId, expected] of Object.entries(surface.toolbar_groups)) {
      const section = await bbox(page, `[data-testid="app-toolbar"] [data-section="${sectionId}"]`, `L3 ${sectionId}`);
      checks.push(
        compare(Math.round(section.x), expected.x, `${surface.capture_id}: L3 ${sectionId} x`),
        compare(Math.round(section.width), expected.width, `${surface.capture_id}: L3 ${sectionId} width`),
      );
    }
  }
  return checks;
}

async function pageGeometryChecks(page, surface, label) {
  const pageBox = await bbox(page, '.pdf-page[data-page-number="1"] .page-container', `${label} page 1`);
  const visiblePageCount = await page.locator('.pdf-page[data-page-number]').count();
  return [
    compare(Math.round(pageBox.x), surface.layers.page_1.x, `${label}: page 1 x`),
    compare(Math.round(pageBox.y), surface.layers.page_1.y, `${label}: page 1 y`),
    compare(Math.round(pageBox.width), surface.layers.page_1.width, `${label}: page 1 width`),
    compare(Math.round(pageBox.height), surface.layers.page_1.height, `${label}: page 1 height`),
    assertState(visiblePageCount === 1, `${label}: 单页模式只渲染一页`, visiblePageCount, 1),
  ];
}

async function verifyReadDefault(page, measurements) {
  const surface = findSurface(measurements, "N-CROP-READ-DEFAULT");
  await openFixture(page);
  await page.locator(".workspace[data-layout='main-only']").waitFor();
  const checks = await sharedLayerChecks(page, surface);
  checks.push(...await pageGeometryChecks(page, surface, "read"));
  checks.push(
    assertState((await page.locator(".context-toolbar").count()) === 0, "read: 不应渲染 L4", await page.locator(".context-toolbar").count(), 0),
    assertState((await page.locator(".right-pane").count()) === 0, "read: 默认右栏折叠", await page.locator(".right-pane").count(), 0),
    await hiddenStatusBarCheck(page, "read"),
  );
  return checks;
}

async function verifyAnnotate(page, measurements) {
  const surface = findSurface(measurements, "N-ANNOTATE-TOOLBAR");
  await openFixture(page);
  // G03 的 measured reference 是 annotate + 左侧大纲，不是 collapsed-left 默认态。
  // Toolbar 的侧栏入口会先回到 read，因此必须先打开/选中大纲，再进入 annotate；
  // annotate 会保留已打开的左栏。
  await page.getByRole("button", { name: "文档摘要", exact: true }).click();
  await page.getByRole("tab", { name: "大纲", exact: true }).click();
  await page.getByRole("button", { name: "A 批注", exact: true }).click();
  await page.locator(".app-shell[data-active-mode='annotate']").waitFor();
  await page.locator(".workspace[data-layout='left-main']").waitFor();
  const checks = await sharedLayerChecks(page, surface, "annotation_toolbar");
  const rightPanelCount = await page.locator(".right-pane").count();
  const leftPanel = await bbox(page, ".utility-panel", "annotate outline panel");
  checks.push(
    ...await pageGeometryChecks(page, surface, "annotate"),
    compare(Math.round(leftPanel.width), surface.layers.left_outline_panel.width, "annotate: 左侧大纲宽度"),
    assertState(rightPanelCount === 0, "annotate: G03 大纲态不自动打开右栏", rightPanelCount, 0),
    assertState(
      (await page.getByRole("toolbar", { name: "批注工具条" }).count()) === 1,
      "annotate: 批注 L4 存在",
      await page.getByRole("toolbar", { name: "批注工具条" }).count(),
      1,
    ),
    await hiddenStatusBarCheck(page, "annotate"),
  );
  return checks;
}

async function verifyEditCanvas(page, measurements) {
  const surface = findSurface(measurements, "N-EDIT-CANVAS");
  await openFixture(page);
  await page.getByRole("button", { name: "T 编辑", exact: true }).click();
  await page.locator(".app-shell[data-active-mode='edit']").waitFor();
  await page.locator(".workspace[data-layout='left-main']").waitFor();
  const checks = await sharedLayerChecks(page, surface, "edit_toolbar");
  const leftPanel = await bbox(page, ".utility-panel", "edit outline panel");
  const main = await bbox(page, ".workspace__main", "edit page canvas");
  const editLabels = ["文本", "图像", "链接", "隐藏"];
  const visibleLabels = [];
  for (const label of editLabels) {
    if ((await page.getByRole("button", { name: label, exact: true }).count()) === 1) visibleLabels.push(label);
  }
  checks.push(
    ...await pageGeometryChecks(page, surface, "edit"),
    compare(Math.round(leftPanel.x), surface.layers.left_outline_panel.x, "edit: 左侧大纲 x"),
    compare(Math.round(leftPanel.width), surface.layers.left_outline_panel.width, "edit: 左侧大纲宽度"),
    compare(Math.round(main.x), surface.layers.page_canvas.x, "edit: 中央画布 x"),
    compare(Math.round(main.width), surface.layers.page_canvas.width, "edit: 中央画布宽度"),
    assertState(
      (await page.getByRole("tab", { name: "大纲", exact: true }).getAttribute("aria-selected")) === "true",
      "edit: G05 大纲 tab 保持激活",
      await page.getByRole("tab", { name: "大纲", exact: true }).getAttribute("aria-selected"),
      "true",
    ),
    assertState(visibleLabels.length === editLabels.length, "edit: L4 工具语义", visibleLabels.join("/"), editLabels.join("/")),
    assertState((await page.getByRole("main", { name: "PDF 阅读区" }).count()) === 1, "edit: 保持单页画布", await page.getByRole("main", { name: "PDF 阅读区" }).count(), 1),
    assertState((await page.locator('[data-testid="page-organizer-workspace"]').count()) === 0, "edit: 不得混入页面管理网格", await page.locator('[data-testid="page-organizer-workspace"]').count(), 0),
    assertState((await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed")) === "true", "edit: T 编辑保持激活", await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed"), "true"),
    await hiddenStatusBarCheck(page, "edit"),
  );
  return checks;
}

async function verifyPageManagement(page, measurements) {
  const surface = findSurface(measurements, "N-PAGE-MANAGEMENT-GRID");
  await openFixture(page);
  await page.getByRole("button", { name: "页面管理", exact: true }).click();
  await page.locator(".app-shell[data-active-mode='pages']").waitFor();
  await page.locator('[data-testid="page-organizer-workspace"]').waitFor();
  const firstPageCard = page.locator('.page-card[data-page-number="1"]');
  await page.waitForFunction(() => document.querySelectorAll('.page-card__sheet canvas[data-rendered="true"]').length === 5);
  const checks = await sharedLayerChecks(page, surface);
  const actionToolbar = await bbox(page, ".page-organizer__toolbar", "page action toolbar");
  const firstThumbnail = await bbox(page, '.page-card[data-page-number="1"] .page-card__sheet canvas', "page 1 thumbnail");
  const secondThumbnail = await bbox(page, '.page-card[data-page-number="2"] .page-card__sheet canvas', "page 2 thumbnail");
  const expectedThumbnail = surface.page_cards.thumbnail_canvas_bbox_approx;
  checks.push(
    compare(Math.round(actionToolbar.height), surface.layers.page_action_toolbar.height, "page-management: 页面操作 L4 高度"),
    compare(Math.round(firstThumbnail.x), expectedThumbnail.x, "page-management: 首张缩略图 x"),
    compare(Math.round(firstThumbnail.y), expectedThumbnail.y, "page-management: 首张缩略图 y"),
    compare(Math.round(firstThumbnail.width), expectedThumbnail.width, "page-management: 缩略图宽度"),
    compare(Math.round(firstThumbnail.height), expectedThumbnail.height, "page-management: 缩略图高度"),
    compare(Math.round(secondThumbnail.x), surface.page_cards.thumbnail_canvas_x_positions[1], "page-management: 第二张缩略图 x"),
    assertState((await page.locator('.page-card__sheet canvas[data-rendered="true"]').count()) === 5, "page-management: 5 张真实 canvas 缩略图已渲染", await page.locator('.page-card__sheet canvas[data-rendered="true"]').count(), 5),
    assertState((await page.getByRole("main", { name: "页面管理工作台" }).count()) === 1, "page-management: 独立页面网格存在", await page.getByRole("main", { name: "页面管理工作台" }).count(), 1),
    assertState((await firstPageCard.getAttribute("aria-pressed")) === "true", "page-management: 参考态第 1 页已选中", await firstPageCard.getAttribute("aria-pressed"), "true"),
    assertState((await page.getByRole("toolbar", { name: "编辑工具条" }).count()) === 0, "page-management: 不渲染内容编辑 L4", await page.getByRole("toolbar", { name: "编辑工具条" }).count(), 0),
    assertState((await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed")) === "false", "page-management: T 编辑不应激活", await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed"), "false"),
    await hiddenStatusBarCheck(page, "page-management"),
  );
  return checks;
}

async function verifySearch(page, measurements) {
  const surface = findSurface(measurements, "N-CROP-L3-SEARCH");
  await openFixture(page);
  await page.getByRole("button", { name: "文档摘要", exact: true }).click();
  await page.getByRole("tab", { name: "大纲", exact: true }).click();
  await page.getByRole("searchbox", { name: "全文搜索", exact: true }).fill("Purpose");
  await page.locator(".workspace[data-layout='left-main-right']").waitFor();
  await page.locator('.right-pane[data-panel="search"]').waitFor();

  const checks = await sharedLayerChecks(page, surface);
  const leftPanel = await bbox(page, ".utility-panel", "search left outline panel");
  const main = await bbox(page, ".workspace__main", "search page canvas");
  const rightPanel = await bbox(page, '.right-pane[data-panel="search"]', "search right panel");
  checks.push(
    compare(Math.round(leftPanel.width), surface.layers.left_outline_panel.width, "search: 左侧大纲宽度"),
    compare(Math.round(main.x), surface.layers.page_canvas.x, "search: 中央画布 x"),
    compare(Math.round(main.width), surface.layers.page_canvas.width, "search: 中央画布宽度"),
    compare(Math.round(rightPanel.x), surface.layers.right_search_panel.x, "search: 右栏 x"),
    compare(Math.round(rightPanel.width), surface.layers.right_search_panel.width, "search: 右栏宽度"),
    assertState(
      (await page.getByRole("searchbox", { name: "全文搜索", exact: true }).inputValue()) === "Purpose",
      "search: L3 查询值保持",
      await page.getByRole("searchbox", { name: "全文搜索", exact: true }).inputValue(),
      "Purpose",
    ),
    assertState(
      (await page.getByRole("region", { name: "搜索结果", exact: true }).count()) === 1,
      "search: 使用 L5b 搜索结果面板而不是 L3 浮层",
      await page.getByRole("region", { name: "搜索结果", exact: true }).count(),
      1,
    ),
  );
  return checks;
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

    // page-management
    const ctx4 = await browser.newContext({ viewport: VIEWPORT });
    const page4 = await ctx4.newPage();
    page4.on("console", (message) => {
      if (message.type() === "error") process.stderr.write(`[browser] ${message.text()}\n`);
    });
    try {
      const r = await verifyPageManagement(page4, measurements);
      allResults.push({ surface: "page-management", checks: r });
      await page4.screenshot({ path: resolve(artifactRoot, "page-management-actual.png"), fullPage: false });
    } catch (error) {
      allResults.push({ surface: "page-management", error: error.message });
    }
    await ctx4.close();

    // search（measured 双栏 surface）
    const ctx5 = await browser.newContext({ viewport: VIEWPORT });
    const page5 = await ctx5.newPage();
    try {
      const r = await verifySearch(page5, measurements);
      allResults.push({ surface: "search", checks: r });
      await page5.screenshot({ path: resolve(artifactRoot, "search-actual.png"), fullPage: false });
    } catch (error) {
      allResults.push({ surface: "search", error: error.message });
    }
    await ctx5.close();
  } finally {
    await browser.close();
    if (devServer) devServer.kill("SIGTERM");
  }

  // 汇总
  const report = {
    timestamp: new Date().toISOString(),
    tolerance_pt: TOLERANCE_PT,
    reference: "docs/reference/pdf-expert/measurements.json (measured, not accepted-golden)",
    scope: "L2/L3/L4 geometry, L3 horizontal distribution, page bbox/count, G05 edit outline, thumbnail bbox/render state, search dual-column geometry, status-bar visibility, and surface-specific DOM semantics",
    zoom: {
      reference_percent: REFERENCE_ZOOM_PERCENT,
      runtime_percent: RUNTIME_ZOOM_PERCENT,
      note: "FaroPDF UI uses 10% zoom steps; fixed zoom rendering applies the measured display-density calibration so 50% can be compared to the 48% reference page bbox.",
    },
    viewport: VIEWPORT,
    results: allResults,
  };
  await writeFile(resolve(artifactRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");

  // 控制台摘要
  let failCount = 0;
  process.stdout.write("\n=== PDF Expert 视觉验证器（分层几何 + surface 语义）===\n");
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
      if (c.kind === "semantic") {
        process.stdout.write(`  ${icon} ${c.label}: 实际 ${c.actual} / 期望 ${c.expected}\n`);
      } else {
        process.stdout.write(
          `  ${icon} ${c.label}: 实际 ${c.actual}pt / 期望 ${c.expected}pt / 差 ${c.diff}pt (容差 ${c.tolerance})\n`,
        );
      }
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
