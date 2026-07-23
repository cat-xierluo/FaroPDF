#!/usr/bin/env node
// @ts-check
/**
 * 生成 PDF Expert 高保真复刻 M1/M2 阶段使用的参考 fixture。
 *
 * 目的：构造一份「带真实 PDF 文字层、多页、内容差异化、未加密、A4」的
 * 受控 PDF，供 docs/reference/pdf-expert/ 采集与视觉比对复用。
 *
 * 为什么不用 tests/fixtures/ocr/scan-only-sample.pdf：
 *  - 该文件刻意无文字层（扫描件，为 ocrmypdf 路径设计），只有 2 页，
 *    且被 .gitignore 排除。M1 要求 read/thumbnails/annotate/edit 四状态
 *    共用同一份 fixture 并复采两次做稳定性 diff；无文字层则搜索/选区/
 *    批注态都无法真实呈现，多页多样性也不足。
 *
 * 设计取舍：
 *  - 使用 pdf-lib 内置 Helvetica（PDF 标准 14 字体之一）。PDF 只存字体
 *    名引用、不嵌入字体字节，零许可风险、任意机器生成结果一致。
 *  - 内容为英文法律样例（合同/卷宗风格），不涉及真实案件或个人信息，
 *    符合 tests/fixtures/README.md 的「不放真实案件材料」规则。
 *  - 5 页内容差异化：封面 / 正文段落 / 编号条款 / 当事人表格 / 签署页，
 *    分别支撑 read（多页翻阅）、thumbnails（5 页各异）、annotate（段落/
 *    条款可标注）、edit（5 页可重排/删除/旋转）四状态采集。
 *  - 已知局限：不含 CJK 文字层（Helvetica 不支持中文）。CJK 排版/搜索的
 *    视觉验证如需，M2 可另建一份中文 fixture；本 fixture 的核心职责是
 *    提供稳定可复采的视觉基线，布局与文字语言无关。
 *  - 脚本可重复运行（覆盖既有文件），不引入随机种子以保证可重复性。
 *
 * 范围（ISS-NEW-M M1 前置）：本脚本只写
 *   tests/fixtures/expert/reference.pdf
 * 该路径不在 .gitignore 排除范围内（仅 tests/fixtures/ocr/*.pdf 被排除），
 * 故 reference.pdf 入仓，保证任意 worker clone 后都能复采到同一基线。
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_COUNT = 5;
const PAGE_WIDTH = 595; // A4 width in points (72 dpi)
const PAGE_HEIGHT = 842; // A4 height in points
const MARGIN_X = 64;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 80;

const INK = rgb(0.07, 0.09, 0.11); // near-black
const MUTED = rgb(0.4, 0.43, 0.48);
const RULE = rgb(0.72, 0.74, 0.78);

/**
 * 法律样例正文段落。纯虚构，用于 read 搜索、annotate 高亮与 text
 * selection 采集。关键词（"Consideration"、"Breach"、"Indemnify"）便于
 * 搜索状态复现。
 */
const BODY_PARAGRAPHS = [
  "1. Parties. This Agreement is entered into between Northbridge Holdings Ltd. (the Disclosing Party) and Calderwell Advisory LLC (the Receiving Party), collectively the Parties.",
  "2. Confidential Information. The Receiving Party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without prior written consent.",
  "3. Permitted Use. The Receiving Party may use the Confidential Information solely for the purpose of evaluating the proposed transaction described in Schedule A.",
  "4. Term. The obligations under this Agreement shall remain in effect for a period of three (3) years from the Effective Date, regardless of whether any transaction is completed.",
  "5. Return of Materials. Upon written request, the Receiving Party shall return or destroy all copies of Confidential Information within ten (10) business days.",
];

/**
 * 编号子条款，用于 annotate 文本高亮、下划线与 text selection 采集。
 */
const NUMBERED_CLAUSES = [
  "6.1 Indemnify. The Receiving Party agrees to indemnify and hold harmless the Disclosing Party from any loss arising out of unauthorized disclosure.",
  "6.2 Breach. Any material Breach of this Agreement shall constitute cause for immediate termination and equitable relief.",
  "6.3 Remedies. The Parties acknowledge that monetary damages alone may be inadequate, and injunctive relief shall be available without the necessity of posting a bond.",
  "6.4 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction stated in Schedule B.",
];

/**
 * 当事人信息表（矢量边框 + 文字），用于 verify 矢量图形渲染与表格布局。
 */
const PARTY_TABLE = [
  ["Role", "Entity", "Jurisdiction"],
  ["Disclosing Party", "Northbridge Holdings Ltd.", "Delaware"],
  ["Receiving Party", "Calderwell Advisory LLC", "California"],
  ["Witness", "Atelier Notary Services Inc.", "New York"],
];

/**
 * 在页脚绘制页码与文档标识，保证 thumbnails 五页可区分、edit 重排后
 * 可凭页码核对顺序。
 */
function drawFooter(page, font, size, pageNo) {
  const label = `Reference Fixture  ·  Page ${pageNo} of ${PAGE_COUNT}`;
  const textWidth = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: MARGIN_BOTTOM / 2,
    size,
    font,
    color: MUTED,
  });
}

function buildCoverPage(pdfDoc, font, bold, pageNo) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const title = "MUTUAL NON-DISCLOSURE AGREEMENT";
  const titleSize = 22;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - MARGIN_TOP - titleSize,
    size: titleSize,
    font: bold,
    color: INK,
  });

  const subtitle = "Reference Fixture for High-Fidelity Capture";
  const subtitleSize = 11;
  const subtitleWidth = font.widthOfTextAtSize(subtitle, subtitleSize);
  page.drawText(subtitle, {
    x: (PAGE_WIDTH - subtitleWidth) / 2,
    y: PAGE_HEIGHT - MARGIN_TOP - titleSize - 28,
    size: subtitleSize,
    font,
    color: MUTED,
  });

  // 分隔线
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_TOP - titleSize - 56,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: RULE,
  });

  const meta = [
    "Document ID:   FX-EXPERT-REF-001",
    "Effective Date: 2026-07-23",
    "Version:       1.0",
    "Classification: Public Sample (no personal data)",
    "",
    "Purpose:",
    "This five-page fixture is generated deterministically to provide",
    "a stable, text-layer PDF baseline for the PDF Expert capture",
    "and visual-diff workflow described in",
    "docs/reference/pdf-expert/.",
  ];
  let y = PAGE_HEIGHT - MARGIN_TOP - titleSize - 96;
  for (const line of meta) {
    page.drawText(line, { x: MARGIN_X, y, size: 11, font, color: INK });
    y -= 18;
  }

  drawFooter(page, font, 9, pageNo);
}

function buildBodyPage(pdfDoc, font, pageNo) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const heading = "RECITALS AND GENERAL PROVISIONS";
  page.drawText(heading, { x: MARGIN_X, y: PAGE_HEIGHT - MARGIN_TOP, size: 13, font, color: INK });
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_TOP - 10,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: RULE,
  });

  let y = PAGE_HEIGHT - MARGIN_TOP - 34;
  for (const para of BODY_PARAGRAPHS) {
    const lines = wrapText(font, para, 11, PAGE_WIDTH - MARGIN_X * 2);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_X, y, size: 11, font, color: INK });
      y -= 16;
    }
    y -= 8;
  }

  drawFooter(page, font, 9, pageNo);
}

function buildClausesPage(pdfDoc, font, bold, pageNo) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const heading = "REPRESENTATIONS AND REMEDIES";
  page.drawText(heading, { x: MARGIN_X, y: PAGE_HEIGHT - MARGIN_TOP, size: 13, font: bold, color: INK });
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_TOP - 10,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: RULE,
  });

  let y = PAGE_HEIGHT - MARGIN_TOP - 34;
  for (const clause of NUMBERED_CLAUSES) {
    const lines = wrapText(font, clause, 11, PAGE_WIDTH - MARGIN_X * 2);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_X, y, size: 11, font, color: INK });
      y -= 16;
    }
    y -= 10;
  }

  drawFooter(page, font, 9, pageNo);
}

function buildTablePage(pdfDoc, font, bold, pageNo) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const heading = "PARTY REGISTER";
  page.drawText(heading, { x: MARGIN_X, y: PAGE_HEIGHT - MARGIN_TOP, size: 13, font: bold, color: INK });
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_TOP - 10,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: RULE,
  });

  const tableX = MARGIN_X;
  const tableW = PAGE_WIDTH - MARGIN_X * 2;
  const colWidths = [tableW * 0.24, tableW * 0.5, tableW * 0.26];
  const rowH = 30;
  let rowY = PAGE_HEIGHT - MARGIN_TOP - 36;

  PARTY_TABLE.forEach((row, rowIdx) => {
    // 行底边框
    page.drawRectangle({
      x: tableX,
      y: rowY - 4,
      width: tableW,
      height: 1,
      color: RULE,
    });
    let cellX = tableX;
    row.forEach((cell, colIdx) => {
      const isHeader = rowIdx === 0;
      page.drawText(cell, {
        x: cellX + 8,
        y: rowY - 14,
        size: isHeader ? 10 : 10,
        font: isHeader ? bold : font,
        color: isHeader ? MUTED : INK,
      });
      cellX += colWidths[colIdx];
    });
    rowY -= rowH;
  });
  // 表格闭合底线
  page.drawRectangle({ x: tableX, y: rowY, width: tableW, height: 1, color: RULE });

  drawFooter(page, font, 9, pageNo);
}

function buildSignaturePage(pdfDoc, font, bold, pageNo) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const heading = "SIGNATURES";
  page.drawText(heading, { x: MARGIN_X, y: PAGE_HEIGHT - MARGIN_TOP, size: 13, font: bold, color: INK });
  page.drawRectangle({
    x: MARGIN_X,
    y: PAGE_HEIGHT - MARGIN_TOP - 10,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 1,
    color: RULE,
  });

  const blockY = PAGE_HEIGHT - MARGIN_TOP - 80;
  const colW = (PAGE_WIDTH - MARGIN_X * 2 - 40) / 2;
  const cols = [
    { x: MARGIN_X, label: "Disclosing Party" },
    { x: MARGIN_X + colW + 40, label: "Receiving Party" },
  ];

  cols.forEach((col) => {
    // 签字线
    page.drawRectangle({ x: col.x, y: blockY, width: colW, height: 1, color: INK });
    page.drawText(col.label, { x: col.x, y: blockY - 16, size: 10, font, color: INK });

    // 日期线
    page.drawRectangle({ x: col.x, y: blockY - 64, width: colW, height: 1, color: INK });
    page.drawText("Date", { x: col.x, y: blockY - 80, size: 10, font, color: INK });
  });

  const note =
    "By signing above, each Party confirms it has reviewed the full five-page Reference Fixture and accepts the terms recorded herein.";
  const noteLines = wrapText(font, note, 10, PAGE_WIDTH - MARGIN_X * 2);
  let y = blockY - 130;
  for (const line of noteLines) {
    page.drawText(line, { x: MARGIN_X, y, size: 10, font, color: MUTED });
    y -= 15;
  }

  drawFooter(page, font, 9, pageNo);
}

/**
 * 简单的等宽字符换行（Helvetica 的 widthOfTextAtSize 可逐字近似）。
 * 足够 fixture 使用，不追求排版级断行。
 */
function wrapText(font, text, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outputPath = join(scriptDir, "reference.pdf");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("PDF Expert Reference Fixture (M1/M2 capture baseline)");
  pdfDoc.setSubject("Deterministic 5-page A4 text-layer fixture for high-fidelity capture");
  pdfDoc.setProducer("tests/fixtures/expert/generate.mjs");
  pdfDoc.setCreator("faropdf-m1");
  pdfDoc.setCreationDate(new Date("2026-07-23T00:00:00Z"));
  pdfDoc.setModificationDate(new Date("2026-07-23T00:00:00Z"));

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  buildCoverPage(pdfDoc, font, bold, 1);
  buildBodyPage(pdfDoc, font, 2);
  buildClausesPage(pdfDoc, font, bold, 3);
  buildTablePage(pdfDoc, font, bold, 4);
  buildSignaturePage(pdfDoc, font, bold, 5);

  if (pdfDoc.getPageCount() !== PAGE_COUNT) {
    throw new Error(`页数校验失败：期望 ${PAGE_COUNT}，实际 ${pdfDoc.getPageCount()}`);
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  await writeFile(outputPath, bytes);

  process.stdout.write(
    `wrote ${outputPath} (${bytes.byteLength} bytes, ${PAGE_COUNT} pages, A4 ${PAGE_WIDTH}x${PAGE_HEIGHT}pt, text-layer via StandardFonts)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`generate failed: ${error?.stack ?? error}\n`);
  process.exit(1);
});
