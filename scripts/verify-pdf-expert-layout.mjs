import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.FAROPDF_E2E_BASE_URL ?? "http://127.0.0.1:1420";
const artifactRoot = resolve(projectRoot, "tmp/verification/pdf-expert-layout");
const fixturePath = resolve(artifactRoot, "layout-fixture.pdf");
const viewports = [
  { width: 1500, height: 900 },
  { width: 1280, height: 800 },
];
const currentRunStates = ["read", "annotate", "left-panel-annotate", "edit", "page-management"];

let devServer = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function near(actual, expected, tolerance = 2) {
  return Math.abs(actual - expected) <= tolerance;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await globalThis.fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolvePromise) => globalThis.setTimeout(resolvePromise, 250));
  }
  throw new Error(`Vite did not become ready at ${baseUrl}`);
}

async function ensureServer() {
  try {
    const response = await globalThis.fetch(baseUrl);
    if (response.ok) return;
  } catch {
    // Start a local server below.
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

async function rect(locator, label) {
  const value = await locator.boundingBox();
  assert(value, `${label} has no bounding box`);
  return value;
}

async function captureState(page, viewportLabel, state) {
  await page.screenshot({
    path: resolve(artifactRoot, `${viewportLabel}-${state}.png`),
    fullPage: true,
  });
}

async function prepareFixture() {
  const pdf = await PDFDocument.create();
  for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`FaroPDF layout fixture page ${pageNumber}`, { x: 72, y: 720, size: 18 });
  }
  await writeFile(fixturePath, await pdf.save());
}

async function verifyViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const viewportLabel = `${viewport.width}x${viewport.height}`;

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('input[type="file"][aria-label="选择本地 PDF 文件"]').setInputFiles(fixturePath);
  await page.locator('.pdf-page[data-page-number="1"]').waitFor();
  await page.getByRole("button", { name: "视图设置", exact: true }).click();
  await page.locator('[data-testid="view-mode-grid"] button[data-view-mode="single"]').click();
  await page.getByRole("button", { name: "视图设置", exact: true }).click();
  await page.keyboard.press("Home");
  await page.locator(".workspace[data-layout='main-only']").waitFor();

  const workspace = page.locator(".workspace");
  const main = page.locator(".workspace__main");
  const toolbarSections = page.locator('[data-testid="app-toolbar"] [data-section]');
  assert((await toolbarSections.count()) === 5, `${viewportLabel} L3 must contain five sections`);
  const toolbar = page.locator('[data-testid="app-toolbar"]');
  const toolbarRect = await rect(toolbar, "L3 toolbar");
  const toolbarColumnCount = await toolbar.evaluate((element) =>
    globalThis.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  assert(toolbarColumnCount === 5, `${viewportLabel} computed L3 grid must contain five columns`);
  assert(toolbarRect.height <= 52, `${viewportLabel} L3 must remain one row, got ${toolbarRect.height}px`);
  const toolbarSectionIds = await toolbarSections.evaluateAll((sections) => sections.map((section) => section.getAttribute("data-section")));
  assert(
    toolbarSectionIds.join("|") === "navigation|zoom|workflows|collaboration|search",
    `${viewportLabel} L3 semantic order mismatch: ${toolbarSectionIds.join("|")}`,
  );
  assert((await page.locator('.pdf-page[data-page-number]').count()) === 1, `${viewportLabel} single mode must render exactly one PDF page`);
  assert((await page.locator(".context-toolbar").count()) === 0, `${viewportLabel} read must not render L4`);
  assert((await page.locator(".right-pane").count()) === 0, `${viewportLabel} read must not render L5b`);

  const readWorkspaceRect = await rect(workspace, "read workspace");
  const readMainRect = await rect(main, "read main");
  assert(near(readMainRect.x, readWorkspaceRect.x), `${viewportLabel} read main x mismatch`);
  assert(near(readMainRect.width, readWorkspaceRect.width), `${viewportLabel} read main width mismatch`);
  await captureState(page, viewportLabel, "read");

  await page.getByRole("button", { name: "A 批注", exact: true }).click();
  await page.locator(".workspace[data-layout='main-only']").waitFor();
  const annotateMainRect = await rect(main, "annotate main");
  assert(near(annotateMainRect.x, readWorkspaceRect.x), `${viewportLabel} annotate main must start at workspace left`);
  assert(near(annotateMainRect.width, readMainRect.width), `${viewportLabel} annotate default must not reserve an unproven right panel`);
  assert((await page.locator(".right-pane").count()) === 0, `${viewportLabel} annotate default L5b must be collapsed`);
  assert((await page.getByRole("toolbar", { name: "批注工具条" }).count()) === 1, `${viewportLabel} annotate L4 missing`);
  await captureState(page, viewportLabel, "annotate");

  await page.getByRole("button", { name: "文档摘要", exact: true }).click();
  await page.getByRole("button", { name: "A 批注", exact: true }).click();
  await page.locator(".workspace[data-layout='left-main']").waitFor();
  const leftRect = await rect(page.locator(".utility-panel"), "left panel");
  const bothMainRect = await rect(main, "both main");
  assert(near(leftRect.x + leftRect.width, bothMainRect.x), `${viewportLabel} L5c must follow L5a`);
  const childClasses = await workspace.locator(":scope > *").evaluateAll((children) =>
    children.map((child) => child.className),
  );
  assert(
    childClasses[0].includes("utility-panel") &&
      childClasses[1].includes("workspace__main") &&
      childClasses.length === 2,
    `${viewportLabel} DOM order must be L5a → L5c with collapsed L5b, got ${childClasses.join(" | ")}`,
  );
  await captureState(page, viewportLabel, "left-panel-annotate");

  await page.getByRole("button", { name: "T 编辑", exact: true }).click();
  await page.locator(".workspace[data-layout='left-main']").waitFor();
  await page.locator('[role="tab"][aria-label="大纲"][aria-selected="true"]').waitFor();
  assert(
    (await page.getByRole("main", { name: "PDF 阅读区" }).count()) === 1,
    `${viewportLabel} T 编辑 must keep the single-page reader canvas`,
  );
  assert((await page.getByRole("toolbar", { name: "编辑工具条" }).count()) === 1, `${viewportLabel} edit L4 missing`);
  assert(
    (await page.getByRole("tab", { name: "大纲", exact: true }).getAttribute("aria-selected")) === "true",
    `${viewportLabel} edit must preserve the measured G05 outline sidebar`,
  );
  assert((await page.locator('[data-testid="page-organizer-workspace"]').count()) === 0, `${viewportLabel} edit must not render page management`);
  assert(
    (await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed")) === "true",
    `${viewportLabel} T 编辑 must be pressed in edit mode`,
  );
  await captureState(page, viewportLabel, "edit");

  await page.getByRole("button", { name: "页面管理", exact: true }).click();
  await page.locator('[data-testid="page-organizer-workspace"]').waitFor();
  assert((await page.getByRole("main", { name: "页面管理工作台" }).count()) === 1, `${viewportLabel} page management workspace missing`);
  assert((await page.getByRole("toolbar", { name: "编辑工具条" }).count()) === 0, `${viewportLabel} pages must not render edit L4`);
  assert(
    (await page.getByRole("button", { name: "T 编辑", exact: true }).getAttribute("aria-pressed")) === "false",
    `${viewportLabel} T 编辑 must not be pressed in pages mode`,
  );
  await captureState(page, viewportLabel, "page-management");

  await context.close();
  return {
    viewport: viewportLabel,
    readMainWidth: Math.round(readMainRect.width),
    annotateMainWidth: Math.round(annotateMainRect.width),
    leftPanelMainWidth: Math.round(bothMainRect.width),
  };
}

await mkdir(artifactRoot, { recursive: true });
await prepareFixture();
await ensureServer();
const browser = await chromium.launch({ headless: true });

try {
  const results = [];
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  const report = {
    ok: true,
    timestamp: new Date().toISOString(),
    scope: "Two-viewport L3 structure, L5 DOM order, annotate default/left-panel behavior, G05 edit outline, and edit/pages route separation",
    artifacts: currentRunStates.flatMap((state) =>
      viewports.map((viewport) => `${viewport.width}x${viewport.height}-${state}.png`),
    ),
    ignored_existing_files: "Files not listed in artifacts belong to earlier runs and are not current evidence.",
    results,
  };
  await writeFile(resolve(artifactRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(`${JSON.stringify({ ...report, report: resolve(artifactRoot, "report.json") }, null, 2)}\n`);
} finally {
  await browser.close();
  if (devServer) {
    devServer.kill("SIGTERM");
  }
}
