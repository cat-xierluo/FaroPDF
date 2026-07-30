/**
 * ISS-NEW-M M5：损坏 PDF fixture 生成脚本。
 *
 * 用途：构造一个 PDF.js 加载时稳定抛 `InvalidPDFException` 的畸形 PDF，
 * 用于实机验证「损坏 PDF 打开 → 中文错误卡片 + 重新选择文件」闭环。
 *
 * 生成策略：先用 pdf-lib 生成一份合法小体积 PDF，再截断尾部（保留 PDF 头与
 * 部分对象，丢弃 xref 表与 trailer）。PDF.js 解析到缺失 trailer/%%EOF 时
 * 抛 InvalidPDFException，可稳定复现 reader 加载失败路径。
 *
 * 运行：`node tests/fixtures/reader/generate-corrupt.mjs`
 * 与现有 fixture 脚本（forms/generate.mjs）约定一致，无 npm 接线。
 * 程序化生成、无敏感数据，产物入仓供 CI / 实机验证使用。
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(fixtureDir, "corrupt.pdf");

const pdf = await PDFDocument.create();
pdf.setTitle("FaroPDF Corrupt Fixture");
pdf.setAuthor("FaroPDF Test Suite");
pdf.setSubject("Intentionally truncated to reproduce InvalidPDFException");

const page = pdf.addPage([595.28, 841.89]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("This fixture is truncated on purpose.", {
  x: 48,
  y: 780,
  size: 14,
  font,
  color: rgb(0.1, 0.15, 0.18),
});

const validBytes = await pdf.save({ useObjectStreams: false });

// 截断尾部：保留约一半字节，丢弃 xref / trailer / %%EOF，PDF.js 无法定位 trailer
// 从而稳定抛 InvalidPDFException。保留前半段足以让 PDF 头识别为 PDF 但解析失败。
const truncated = validBytes.subarray(0, Math.floor(validBytes.length / 2));

await writeFile(outputPath, truncated);

process.stdout.write(`Generated corrupt fixture ${outputPath} (${truncated.length} bytes, truncated)\n`);
