/**
 * ISS-NEW-M M5：加密 PDF fixture 生成脚本。
 *
 * 用途：构造一个用户密码为 `test123` 的加密 PDF，用于实机验证「打开加密 PDF →
 * 提示输入密码 → 输对密码打开 / 输错重试 / 取消」闭环。pdf-lib 不支持加密，
 * 故先用 pdf-lib 生成明文，再用系统 qpdf 加密（generate-time 工具，不进 runtime 依赖）。
 *
 * 运行：`node tests/fixtures/reader/generate-encrypted.mjs`
 * 前提：本机已 `brew install qpdf`。缺 qpdf 时脚本打印提示并 exit 0（与现有 fixture
 * 脚本「无 npm 接线」约定一致），但建议本机装 qpdf 后重跑以更新产物。
 *
 * 程序化生成、无敏感数据，产物入仓供 CI / 实机验证使用（与 corrupt.pdf 同模式）。
 */
import { writeFile, readFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(fixtureDir, "encrypted.pdf");
const plaintextPath = join(fixtureDir, "_encrypted-plaintext.pdf");

// 测试用固定密码常量；任何引用本 fixture 的测试都应使用此密码。
export const ENCRYPTED_FIXTURE_PASSWORD = "test123";

function ensureQpdf() {
  try {
    execFileSync("qpdf", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 1. pdf-lib 生成明文 PDF
const pdf = await PDFDocument.create();
pdf.setTitle("FaroPDF Encrypted Fixture");
pdf.setAuthor("FaroPDF Test Suite");
pdf.setSubject("User-password encrypted to reproduce PDF.js PasswordException");

const page = pdf.addPage([595.28, 841.89]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("Encrypted fixture. Password is test123.", {
  x: 48,
  y: 780,
  size: 14,
  font,
  color: rgb(0.1, 0.15, 0.18),
});

const plaintextBytes = await pdf.save({ useObjectStreams: false });
await writeFile(plaintextPath, plaintextBytes);

// 2. qpdf 加密（256-bit，用户密码 + 拥有者密码同）
if (!ensureQpdf()) {
  process.stderr.write(
    "⚠️  未检测到 qpdf，跳过加密步骤。请 `brew install qpdf` 后重跑。\n" +
      `明文已写入 ${plaintextPath}（未加密，仅供排查）。\n`,
  );
  process.exit(0);
}

try {
  execFileSync("qpdf", [
    "--encrypt",
    ENCRYPTED_FIXTURE_PASSWORD,
    ENCRYPTED_FIXTURE_PASSWORD,
    "256",
    "--",
    plaintextPath,
    outputPath,
  ]);
  await unlink(plaintextPath);
  const encrypted = await readFile(outputPath);
  process.stdout.write(
    `Generated encrypted fixture ${outputPath} (${encrypted.length} bytes, password="${ENCRYPTED_FIXTURE_PASSWORD}")\n`,
  );
} catch (error) {
  process.stderr.write(`qpdf 加密失败：${error.message}\n`);
  process.exit(1);
}
