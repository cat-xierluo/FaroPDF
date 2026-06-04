#!/usr/bin/env node
// @ts-check
/**
 * 生成 ISS-007 OCR E2E 测试用的扫描型 PDF 夹具。
 *
 * 目的：构造一份「无文字层、只有像素」的 PDF，模拟真实扫描件。
 *  - ocrmypdf 调用 tesseract 处理像素，得到可检索的双层 PDF
 *  - pdftotext 提取 ocr 后的文字层
 *  - 前端 ocrQualityCheckService 据此生成质量报告
 *
 * 设计取舍：
 *  - 嵌入式 PNG（400x150）以 base64 形式硬编码在源文件里，避免脚本
 *    依赖 ImageMagick / pdftoppm 等外部渲染工具，确保任意开发机 clone
 *    后只跑 `node tests/fixtures/ocr/generate-scan-fixture.mjs` 即可得到
 *    同样内容的夹具。
 *  - 源 PNG 内的文字 "OCR E2E 2026" + 三行示例已经预渲染成像素
 *    （非 PDF 文字层），保证 ocrmypdf 走图像识别路径。
 *  - 2 页 A4 夹具（2 份相同图）方便覆盖页码范围参数 `pageRange`。
 *  - 脚本可重复运行（覆盖既有文件），不引入随机种子以保证可重复性。
 *
 * 范围（ISS-007 端到端联调）：本脚本仅写
 *   `tests/fixtures/ocr/scan-only-sample.pdf`
 * 路径，由仓库 `.gitignore` 排除。
 */

import { PDFDocument } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 400x150 白色 PNG，内含预渲染的英文 / 数字文字（"OCR E2E 2026" + 三行
 * 示例）。完全像素化，没有 PDF 文字层。生成命令记录在
 * `tests/fixtures/ocr/README.md`，方便后续按需替换或升级。
 */
const SAMPLE_PNG_BASE64 =

  "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";
;

const PAGE_COUNT = 2;
const PAGE_WIDTH = 595; // A4 width in points (72 dpi)
const PAGE_HEIGHT = 842; // A4 height in points
const IMAGE_TARGET_WIDTH = 400;
const IMAGE_TARGET_HEIGHT = 150;

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outputPath = join(scriptDir, "scan-only-sample.pdf");

  const pngBytes = Buffer.from(SAMPLE_PNG_BASE64, "base64");
  if (pngBytes.length === 0) {
    throw new Error("内嵌 PNG base64 解析后为空。");
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("ISS-007 OCR E2E scan-only fixture");
  pdfDoc.setProducer("tests/fixtures/ocr/generate-scan-fixture.mjs");
  pdfDoc.setCreator("faropdf-e2e");
  pdfDoc.setCreationDate(new Date("2026-06-04T00:00:00Z"));
  pdfDoc.setModificationDate(new Date("2026-06-04T00:00:00Z"));

  const png = await pdfDoc.embedPng(pngBytes);
  if (png.width <= 0 || png.height <= 0) {
    throw new Error(`嵌入 PNG 尺寸异常：${png.width}x${png.height}`);
  }

  for (let i = 0; i < PAGE_COUNT; i++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const scale = Math.min(IMAGE_TARGET_WIDTH / png.width, IMAGE_TARGET_HEIGHT / png.height);
    const drawWidth = png.width * scale;
    const drawHeight = png.height * scale;
    const x = (PAGE_WIDTH - drawWidth) / 2;
    const y = (PAGE_HEIGHT - drawHeight) / 2;
    page.drawImage(png, { x, y, width: drawWidth, height: drawHeight });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  await writeFile(outputPath, bytes);

  process.stdout.write(
    `wrote ${outputPath} (${bytes.byteLength} bytes, ${PAGE_COUNT} pages, ${png.width}x${png.height} px source image)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`generate-scan-fixture failed: ${error?.stack ?? error}\n`);
  process.exit(1);
});

