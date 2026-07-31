#!/usr/bin/env node
// scripts/build-icons.mjs
//
// FaroPDF 应用图标重生成脚本。
//
// 输入：源图路径（PNG，建议 1024×1024 或以上）
// 输出：<outDir> 下全套 Tauri / favicon / macOS icns / Windows ico / Windows MSIX Square*Logo / StoreLogo
//
// 用 macOS 原生工具 + ImageMagick 7，**不引入新 npm 依赖**。
//
// 流程：
//   1. 把源图加 RGBA 透明四角 + 18% 圆角矩形 + 主体缩小 ~8%（保留原主体像素）
//   2. 下采样到 icon.png (512×512)
//   3. 渲染到全部 PNG 尺寸（含 Windows MSIX Square*Logo / StoreLogo）
//   4. 合成 macOS .icns（iconset → iconutil -c icns）
//   5. 合成 Windows .ico（magick auto-resize = 16/24/32/48/64/128）
//   6. 写 favicon.png (32×32 RGBA 圆角)
//   7. 导出 docs/icon-design-v1.png (1024×1024 设计稿 + 半径标注 + 网格)
//
// 说明：本脚本只修改源稿的 alpha 通道 + 把画布往外扩透明边距；
//       不重画任何主体像素（灯塔 / 纸叠 / 暖光完全保留）。
//
// 用法：
//   node scripts/build-icons.mjs <src.png> <outDir> [docDir]
// 例：
//   node scripts/build-icons.mjs src-tauri/icons/icon-source.png src-tauri/icons docs

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128];

// 18% 圆角半径（与 Folia 对齐）
const RADIUS_RATIO = 0.18;
// 主体相对源稿的可见 inset（约 8% 安全边，DESIGN §16 收敛愿景留待后续 brand ISS）
const VISIBLE_INSET_RATIO = 0.08;

function run(cmd, args, opts = {}) {
  const result = execFileSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return result;
}

function die(msg) {
  console.error(`\n[build-icons] FATAL: ${msg}\n`);
  process.exit(1);
}

function checkTools() {
  for (const tool of ['sips', 'magick', 'iconutil', 'file']) {
    try {
      run('which', [tool]);
    } catch {
      die(`缺少必要工具 ${tool}。本脚本依赖 macOS + ImageMagick 7。`);
    }
  }
  console.log('[build-icons] 工具检查通过 (sips / magick / iconutil / file)');
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function sipsGet(src) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', src]).trim();
  const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
  const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
  const hasAlpha = /hasAlpha:\s*yes/i.test(out);
  if (!width || !height) die(`sips 无法解析 ${src} 的尺寸。`);
  return { width, height, hasAlpha };
}

function sipsAssert(src, expectW, expectH, label) {
  const got = sipsGet(src);
  if (got.width !== expectW || got.height !== expectH) {
    die(`${label} 尺寸不符：期望 ${expectW}x${expectH}，实测 ${got.width}x${got.height}`);
  }
  if (!got.hasAlpha) die(`${label} 缺 alpha 通道（hasAlpha=no）：${src}`);
  return got;
}

// 给源图加 RGBA 圆角矩形 alpha 蒙版：
//   1. 单独画一张同尺寸的灰度图（黑底 + 白色圆角矩形），作为 alpha mask
//   2. 用 -compose CopyOpacity -composite 把 mask 灰度复制到目的图的 alpha 通道
// 关键：**不要先 -alpha set**（会把源图强制 α=255，再用 CopyOpacity 覆盖时会被 mask 拉回到 0，
// 但实测 -alpha set 后 RGBA 通道压缩导致 mask 灰度的中间值被截断为 0 或 255，4 角 α=1）。
// 不带 -alpha set 时 magick 把源 RGB 当 α=255 隐含处理，CopyOpacity 干净覆盖。
function applyRoundedMask(srcPng, dstPng, radiusRatio, tmpDir) {
  const { width, height } = sipsGet(srcPng);
  const rx = Math.round(Math.min(width, height) * radiusRatio);
  const maskPath = join(tmpDir, `mask-${width}x${height}.png`);
  // 黑底 + 白圆角矩形
  const maskArgs = [
    '-size', `${width}x${height}`,
    'xc:black',
    '-fill', 'white',
    '-draw', `roundRectangle 0,0 ${width - 1},${height - 1} ${rx},${rx}`,
    maskPath,
  ];
  try {
    run('magick', maskArgs);
  } catch (e) {
    die(`magick 生成 mask 失败：${e.stderr ?? e.message}`);
  }
  // CopyOpacity：把 mask 灰度写入目的图 alpha
  const compositeArgs = [
    srcPng,
    maskPath,
    '-compose', 'CopyOpacity',
    '-composite',
    dstPng,
  ];
  try {
    run('magick', compositeArgs);
  } catch (e) {
    die(`magick CopyOpacity 复合失败：${e.stderr ?? e.message}`);
  }
}

function applySafeInset(srcPng, dstPng, insetRatio) {
  // 在已圆角的图像四周再扩出透明边距（DESIGN §16 安全区）：
  //   1. 创建一个 newW × newH 透明画布
  //   2. 把源图（已带 alpha）居中叠加
  const { width, height } = sipsGet(srcPng);
  const insetPx = Math.round(Math.min(width, height) * insetRatio);
  const newW = width + insetPx * 2;
  const newH = height + insetPx * 2;
  // background none 必须显式声明，确保 -size 画布为透明 RGBA
  const args = [
    '-size', `${newW}x${newH}`,
    'xc:none',
    srcPng,
    '-geometry', `+${insetPx}+${insetPx}`,
    '-compose', 'Over',
    '-composite',
    dstPng,
  ];
  try {
    run('magick', args);
  } catch (e) {
    die(`magick applySafeInset 失败：${e.stderr ?? e.message}`);
  }
}

// src（圆角 RGBA） → 在更小画布上重画，目标尺寸 dstW × dstH
function resamplePng(srcPng, dstPng, dstW, dstH) {
  // sips 不输出 RGBA 透明友好；改用 magick 保证 alpha + 高质量 Lanczos
  const args = [
    srcPng,
    '-resize', `${dstW}x${dstH}`,
    '-filter', 'Lanczos',
    '-define', 'png:preserve-colormap=true',
    dstPng,
  ];
  try {
    run('magick', args);
  } catch (e) {
    die(`magick resample 失败：${e.stderr ?? e.message}`);
  }
}

function buildIco(srcPng, dstIco) {
  const args = [
    srcPng,
    '-define', `icon:auto-resize=${ICO_SIZES.join(',')}`,
    dstIco,
  ];
  try {
    run('magick', args);
  } catch (e) {
    die(`magick buildIco 失败：${e.stderr ?? e.message}`);
  }
}

function buildIcns(srcPng, dstIcns, tmpDir) {
  const iconSetDir = join(tmpDir, 'iconset.iconset');
  rmSync(iconSetDir, { recursive: true, force: true });
  ensureDir(iconSetDir);

  // 生成每个尺寸的 PNG，并按 macOS 命名约定放入 iconset
  const naming = (n) => `icon_${n}x${n}.png`;
  for (const n of ICNS_SIZES) {
    const tmpPng = join(tmpDir, `icns-${n}.png`);
    resamplePng(srcPng, tmpPng, n, n);
    run('cp', [tmpPng, join(iconSetDir, naming(n))]);
  }
  // 512×512 还需一份 512x512@2x 即 1024；Tauri 一般不读这个，但 macOS .icns 期望 512@2x
  const tmp1024 = join(tmpDir, 'icns-1024.png');
  resamplePng(srcPng, tmp1024, 1024, 1024);
  run('cp', [tmp1024, join(iconSetDir, 'icon_512x512@2x.png')]);

  // 用 iconutil 合成 .icns
  try {
    run('iconutil', ['-c', 'icns', iconSetDir, '-o', dstIcns]);
  } catch (e) {
    die(`iconutil 合成 .icns 失败：${e.stderr ?? e.message}`);
  }
}

function writeDesignDraft(srcPng, dstPng, radiusRatio) {
  const { width, height } = sipsGet(srcPng);
  const target = 1024;
  const rx = Math.round(Math.min(width, height) * radiusRatio);
  const args = [
    srcPng,
    '-resize', `${target}x${target}`,
    '-filter', 'Lanczos',
    // 画半透明白色网格
    '-fill', 'rgba(0,0,0,0.06)',
    '-draw', `rectangle 0,0 ${target},${target}`,
    // 画边界线 + 圆角圆心十字
    '-fill', 'none',
    '-stroke', 'rgba(255,64,64,0.45)',
    '-strokewidth', '2',
    '-draw', `roundRectangle 1,1 ${target - 2},${target - 2} ${rx},${rx}`,
    '-draw', `line ${target / 2},0 ${target / 2},${target}`,
    '-draw', `line 0,${target / 2} ${target},${target / 2}`,
    // 在左上角画一行文字，半透明白底黑字
    '-fill', 'rgba(255,255,255,0.85)',
    '-stroke', 'none',
    '-draw',
      `rectangle 12,12 ${12 + 600},${12 + 36}`,
    '-fill', 'black',
    '-font', 'Helvetica',
    '-pointsize', '24',
    '-draw',
      `text 24,38 "FaroPDF icon v1 — corner radius ${Math.round(radiusRatio * 100)}%"`,
    dstPng,
  ];
  try {
    run('magick', args);
  } catch (e) {
    die(`magick writeDesignDraft 失败：${e.stderr ?? e.message}`);
  }
}

async function main() {
  const [, , srcArg, outArg, docArg] = process.argv;
  if (!srcArg || !outArg) {
    die('用法：node scripts/build-icons.mjs <src.png> <outDir> [docDir]');
  }

  checkTools();

  // repoRoot 用 process.cwd() —— 这样路径有空格也不被 URL encode
  const repoRoot = process.cwd();
  const src = resolve(repoRoot, srcArg);
  const outDir = resolve(repoRoot, outArg);
  const docDir = docArg ? resolve(repoRoot, docArg) : null;
  if (!existsSync(src)) die(`源图不存在：${src}`);
  if (!statSync(src).isFile()) die(`源图不是文件：${src}`);
  ensureDir(outDir);

  const tmpDir = join(tmpdir(), `faropdf-icons-${Date.now()}`);
  ensureDir(tmpDir);

  console.log('[build-icons] 源图 =', src);
  console.log('[build-icons] 输出目录 =', outDir);
  console.log('[build-icons] 临时目录 =', tmpDir);

  // 0. 用 magick 把源图加 alpha 通道（强制 RGBA），避免 sips 的 alpha 丢失
  const step0Path = join(tmpDir, '0-source-rgba.png');
  run('magick', [
    src,
    '-colorspace', 'sRGB',
    '-alpha', 'set',
    step0Path,
  ]);
  sipsAssert(step0Path, sipsGet(step0Path).width, sipsGet(step0Path).height, 'step0');

  // 1. 加圆角矩形 alpha 蒙版 + 18% 圆角
  console.log('[build-icons] step1: 应用 18% 圆角矩形 alpha 蒙版');
  const step1Path = join(tmpDir, '1-rgba-rounded.png');
  applyRoundedMask(step0Path, step1Path, RADIUS_RATIO, tmpDir);
  sipsAssert(step1Path, sipsGet(step0Path).width, sipsGet(step0Path).height, 'step1');

  // 2. 外扩 ~8% 安全边
  console.log(`[build-icons] step2: 外扩 ${(VISIBLE_INSET_RATIO * 100).toFixed(0)}% 透明安全边`);
  const step2Path = join(tmpDir, '2-rgba-rounded-inset.png');
  applySafeInset(step1Path, step2Path, VISIBLE_INSET_RATIO);
  const expSize = sipsGet(step0Path).width + Math.round(sipsGet(step0Path).width * VISIBLE_INSET_RATIO) * 2;
  sipsAssert(step2Path, expSize, expSize, 'step2');

  // 3. 输出最终源稿 = src-tauri/icons/icon-source.png（同位覆盖）
  console.log('[build-icons] step3: 落 icon-source.png 到 src-tauri/icons/');
  run('cp', [step2Path, join(outDir, 'icon-source.png')]);
  sipsAssert(join(outDir, 'icon-source.png'), expSize, expSize, 'icon-source.png');

  // 4. 输出 icon.png (512×512)
  console.log('[build-icons] step4: 下采样到 512×512 → icon.png');
  const iconPng = join(outDir, 'icon.png');
  resamplePng(step2Path, iconPng, 512, 512);
  sipsAssert(iconPng, 512, 512, 'icon.png');

  // 5. 输出 MSIX Square*Logo + StoreLogo + 通用 Tauri PNG
  console.log('[build-icons] step5: 输出 Tauri / MSIX Square*Logo / StoreLogo');
  const sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'Square30x30Logo.png': 30,
    'Square44x44Logo.png': 44,
    'Square71x71Logo.png': 71,
    'Square89x89Logo.png': 89,
    'Square107x107Logo.png': 107,
    'Square142x142Logo.png': 142,
    'Square150x150Logo.png': 150,
    'Square284x284Logo.png': 284,
    'Square310x310Logo.png': 310,
    'StoreLogo.png': 50,
  };
  for (const [name, dim] of Object.entries(sizes)) {
    const dst = join(outDir, name);
    resamplePng(step2Path, dst, dim, dim);
    sipsAssert(dst, dim, dim, name);
  }

  // 6. 合成 macOS .icns
  console.log('[build-icons] step6: 合成 icon.icns（16/32/64/128/256/512/512@2x/1024 八档）');
  const icnsPath = join(outDir, 'icon.icns');
  buildIcns(step2Path, icnsPath, tmpDir);
  if (!existsSync(icnsPath)) die('icon.icns 合成失败');
  const icnsType = run('file', [icnsPath]).trim();
  if (!/(icns archive|Mac OS X icon)/i.test(icnsType)) die(`icon.icns 文件类型不对：${icnsType}`);

  // 7. 合成 Windows .ico
  console.log('[build-icons] step7: 合成 icon.ico（16/24/32/48/64/128 六档）');
  const icoPath = join(outDir, 'icon.ico');
  buildIco(step2Path, icoPath);
  if (!existsSync(icoPath)) die('icon.ico 合成失败');
  const icoType = run('file', [icoPath]).trim();
  if (!/MS Windows icon resource/i.test(icoType)) die(`icon.ico 文件类型不对：${icoType}`);

  // 8. 写 favicon.png (32×32 RGBA 圆角)
  console.log('[build-icons] step8: 写 public/favicon.png（32×32 RGBA 圆角）');
  const publicFavicon = resolve(repoRoot, 'public', 'favicon.png');
  ensureDir(dirname(publicFavicon));
  resamplePng(step2Path, publicFavicon, 32, 32);
  sipsAssert(publicFavicon, 32, 32, 'public/favicon.png');

  // 9. 写 docs/icon-design-v1.png 设计稿（仅在提供 docDir 时）
  if (docDir) {
    ensureDir(docDir);
    console.log('[build-icons] step9: 写 docs/icon-design-v1.png 设计稿（含半径标注）');
    const designPath = join(docDir, 'icon-design-v1.png');
    writeDesignDraft(step2Path, designPath, RADIUS_RATIO);
    sipsAssert(designPath, 1024, 1024, 'icon-design-v1.png');
  }

  // 10. 清理临时
  rmSync(tmpDir, { recursive: true, force: true });

  // 汇总
  console.log('\n[build-icons] 生成完成。汇总：');
  const listOut = readdirSync(outDir).sort();
  for (const f of listOut) {
    const got = sipsGet(join(outDir, f));
    console.log(`  - ${f}  ${got.width}x${got.height}  alpha=${got.hasAlpha ? 'yes' : 'no'}`);
  }
  console.log(`  - public/favicon.png  ${sipsGet(publicFavicon).width}x${sipsGet(publicFavicon).height}  alpha=${sipsGet(publicFavicon).hasAlpha ? 'yes' : 'no'}`);
  if (docDir) {
    console.log(`  - docs/icon-design-v1.png  ${sipsGet(join(docDir, 'icon-design-v1.png')).width}x${sipsGet(join(docDir, 'icon-design-v1.png')).height}  alpha=${sipsGet(join(docDir, 'icon-design-v1.png')).hasAlpha ? 'yes' : 'no'}`);
  }
  console.log('\n[build-icons] OK');
}

main().catch((err) => die(err.stack ?? err.message ?? String(err)));
