#!/usr/bin/env node
// 调试 SETUP-1: PDF 上传后 canvas=0
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOT_DIR = join(ROOT, "tmp", "audit-screenshots", "stage-3-debug");

async function buildFixturePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`Audit Fixture Page ${i}`, { x: 50, y: 780, size: 28, font });
    page.drawText("Test PDF for playwright setup debug.", { x: 50, y: 740, size: 12, font });
  }
  return await pdf.save();
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await context.newPage();

  const allLogs = [];
  page.on("console", (msg) => allLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => allLogs.push(`[pageerror] ${err.message}`));
  page.on("requestfailed", (req) => allLogs.push(`[reqfail] ${req.url()} - ${req.failure()?.errorText}`));
  page.on("response", (res) => {
    if (res.url().includes("pdf.worker")) {
      allLogs.push(`[worker-resp] ${res.url()} - ${res.status()}`);
    }
  });

  await page.goto("http://localhost:1420/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 检查 file input 存在
  const fileInput = await page.$('input[type="file"][accept*="pdf"]');
  console.log("file input exists:", !!fileInput);

  if (fileInput) {
    const attrs = await fileInput.evaluate((el) => ({
      type: el.type,
      accept: el.accept,
      style: el.style.cssText,
    }));
    console.log("file input attrs:", JSON.stringify(attrs));

    const pdfBytes = await buildFixturePdf();
    const fixturePath = join(SHOT_DIR, "_fixture.pdf");
    await writeFile(fixturePath, pdfBytes);
    console.log("fixture written:", fixturePath, pdfBytes.length, "bytes");

    await fileInput.setInputFiles(fixturePath);
    console.log("setInputFiles done");

    // 等 5s, 多次看状态
    for (const t of [1, 2, 3, 5, 8, 12]) {
      await page.waitForTimeout(t * 1000 - (t > 1 ? 1000 : 0));
      const canvases = await page.$$eval("canvas", (els) => els.length);
      const statusText = await page.evaluate(() => {
        const sb = document.querySelector(".status-bar, [class*='status']");
        return sb ? sb.textContent : "(no status bar)";
      });
      console.log(`[t=${t}s] canvases=${canvases}, status=${statusText?.slice(0, 120)}`);
      await page.screenshot({ path: join(SHOT_DIR, `debug-t${t}s.png`) });
    }
  }

  console.log("\n=== All logs ===");
  for (const l of allLogs) console.log(l);

  await browser.close();
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
