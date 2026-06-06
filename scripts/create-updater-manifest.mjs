#!/usr/bin/env node
// scripts/create-updater-manifest.mjs
//
// ISS-021：跨平台打包后，从 release artifacts 生成 tauri-plugin-updater v2 所需的
// latest.json 清单（v0.1.1 Folia 对齐版）。
//
// 流程：
//   1. 读 FAROPDF_SIGNATURE_DIR 下的 *.sig 旁车文件（这些 sig 由
//      tauri-apps/tauri-action@v0 在 build job 产出 .tar.gz / .exe 时
//      自动签好，publish job 只需把 sig 内容嵌进 latest.json）
//   2. 用 FAROPDF_REQUIRE_PLATFORMS 校验必填 platform 都有 sig（缺即 fail）
//   3. 拼 tauri-plugin-updater v2 manifest：
//        - darwin-aarch64 / darwin-x86_64 / windows-x86_64
//        - url 用 basename(file)（Folia 对齐：softprops 上传只用 basename，
//          不带 artifact 名子目录，DEC-070 修复）
//   4. 写出 FAROPDF_MANIFEST_OUTPUT / FAROPDF_GITEE_MANIFEST_OUTPUT（后者选填）
//
// 用法（GitHub Actions publish job 上下文）：
//   FAROPDF_SIGNATURE_DIR=sigs \
//   FAROPDF_UPDATE_VERSION=0.1.1 \
//   FAROPDF_UPDATE_TAG=v0.1.1 \
//   FAROPDF_UPDATE_NOTES="FaroPDF 0.1.1" \
//   FAROPDF_UPDATE_REPO=https://github.com/cat-xierluo/FaroPDF \
//   FAROPDF_MANIFEST_OUTPUT=latest.json \
//   FAROPDF_REQUIRE_PLATFORMS=darwin-aarch64,darwin-x86_64,windows-x86_64 \
//   pnpm run updater:manifest
//
// 退出码：0 成功；1 必填 env 缺失 / 找不到 sig / 缺必填 platform；3 IO 失败。

import { readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

const UPDATER_PLATFORM_KEYS = {
  "darwin-aarch64": "darwin-aarch64",
  "darwin-x86_64": "darwin-x86_64",
  "windows-x86_64": "windows-x86_64",
};

// sig 文件名格式：<bundle-name>.sig，比如
//   FaroPDF_aarch64.app.tar.gz.sig
//   FaroPDF_x64.app.tar.gz.sig
//   FaroPDF_0.1.1_x64-setup.exe.sig
const SIG_PATTERNS = [
  { regex: /_aarch64\.app\.tar\.gz\.sig$/i, platform: "darwin-aarch64" },
  { regex: /_x64\.app\.tar\.gz\.sig$/i, platform: "darwin-x86_64" },
  { regex: /_x64-setup\.exe\.sig$/i, platform: "windows-x86_64" },
];

function readEnv(name, { required = true } = {}) {
  const value = process.env[name];
  if (required && !value) {
    console.error(`[updater:manifest] missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function printHelp() {
  console.log(`[updater:manifest] Required env:
  FAROPDF_SIGNATURE_DIR         Directory containing *.sig sidecar files
                                (typically the publish job downloads them to sigs/).
  FAROPDF_UPDATE_VERSION       Version to embed in latest.json (e.g. 0.1.1, no v prefix).
  FAROPDF_UPDATE_TAG            Release tag name (with v prefix, e.g. v0.1.1).
  FAROPDF_UPDATE_REPO           GitHub repo URL for asset download URLs
                                (e.g. https://github.com/cat-xierluo/FaroPDF).
  FAROPDF_MANIFEST_OUTPUT       Output file path for latest.json (default: latest.json).
  FAROPDF_REQUIRE_PLATFORMS     Comma-separated list of required updater platform keys
                                (e.g. darwin-aarch64,darwin-x86_64,windows-x86_64).

Optional env:
  FAROPDF_UPDATE_NOTES          Short release notes line (embedded in latest.json? no, dropped).
  FAROPDF_UPDATE_GITEE_REPO     Gitee repo URL (overrides GitHub for asset URLs in latest-gitee.json).
  FAROPDF_GITEE_MANIFEST_OUTPUT Output file path for the Gitee-specific latest.json
                                (typically latest-gitee.json).`);
}

function parseRequiredPlatforms(raw) {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function matchSigToPlatform(filename) {
  for (const { regex, platform } of SIG_PATTERNS) {
    if (regex.test(filename)) {
      return platform;
    }
  }
  return null;
}

function buildAssetUrl(repo, tag, assetName) {
  const tagNoV = tag.replace(/^v/, "");
  return `${repo.replace(/\/+$/, "")}/releases/download/${tagNoV}/${assetName}`;
}

function buildManifest({ version, pubDate, platforms }) {
  return {
    version,
    pub_date: pubDate,
    platforms: Object.fromEntries(
      Object.entries(platforms).map(([key, value]) => [
        key,
        { signature: value.signature, url: value.url },
      ]),
    ),
  };
}

async function main() {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const signatureDir = readEnv("FAROPDF_SIGNATURE_DIR");
  const version = readEnv("FAROPDF_UPDATE_VERSION");
  const tag = readEnv("FAROPDF_UPDATE_TAG");
  const repo = readEnv("FAROPDF_UPDATE_REPO");
  const outputPath = readEnv("FAROPDF_MANIFEST_OUTPUT");
  const requiredPlatforms = parseRequiredPlatforms(
    readEnv("FAROPDF_REQUIRE_PLATFORMS"),
  );
  if (requiredPlatforms.length === 0) {
    console.error(
      "[updater:manifest] FAROPDF_REQUIRE_PLATFORMS is empty; must list at least one platform",
    );
    process.exit(1);
  }

  const giteeRepo = process.env["FAROPDF_UPDATE_GITEE_REPO"] || null;
  const giteeOutputPath = process.env["FAROPDF_GITEE_MANIFEST_OUTPUT"] || null;

  // 1. 扫 sigs/ 目录，匹配 platform
  const { readdir } = await import("node:fs/promises");
  let entries;
  try {
    entries = await readdir(signatureDir, { withFileTypes: true });
  } catch (error) {
    console.error(
      `[updater:manifest] failed to read signature dir ${signatureDir}: ${error.message}`,
    );
    process.exit(1);
  }

  const sigFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sig"))
    .map((e) => e.name);

  if (sigFiles.length === 0) {
    console.error(
      `[updater:manifest] no *.sig files in ${signatureDir}; tauri-action must sign each updater bundle`,
    );
    process.exit(1);
  }

  // Per platform: pick the first matching sig (deterministic by sort).
  sigFiles.sort();
  const byPlatform = new Map();
  for (const sigName of sigFiles) {
    const platform = matchSigToPlatform(sigName);
    if (!platform || byPlatform.has(platform)) continue;
    byPlatform.set(platform, sigName);
  }

  // 2. 校验必填 platform 都在
  const missing = requiredPlatforms.filter((p) => !byPlatform.has(p));
  if (missing.length > 0) {
    console.error(
      `[updater:manifest] missing .sig for required platforms: ${missing.join(", ")} (have: ${[...byPlatform.keys()].join(", ") || "none"})`,
    );
    process.exit(1);
  }

  // 3. 读每个 sig，拼 manifest
  const assetUrlBase = giteeRepo || repo;
  const platforms = {};
  for (const platform of requiredPlatforms) {
    const sigName = byPlatform.get(platform);
    if (!sigName) continue; // 已经上面 missing 校验过了
    const sigPath = join(signatureDir, sigName);
    const signature = (await readFile(sigPath, "utf8")).trim();
    // 派生 bundle asset 名：去掉 .sig 后缀
    const assetName = basename(sigName, ".sig");
    const url = buildAssetUrl(assetUrlBase, tag, assetName);
    platforms[platform] = { signature, url };
    console.log(`[updater:manifest] ${platform}: ${assetName} (${signature.length} chars)`);
  }

  const manifest = buildManifest({
    version,
    pubDate: new Date().toISOString(),
    platforms,
  });

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[updater:manifest] wrote ${outputPath}`);
  console.log(`[updater:manifest] platforms: ${Object.keys(platforms).join(", ")}`);

  // 4. 可选：再写一份 Gitee 专版 manifest（asset URL 走 gitee.com）
  if (giteeOutputPath) {
    const giteePlatforms = {};
    for (const platform of requiredPlatforms) {
      const sigName = byPlatform.get(platform);
      const assetName = basename(sigName, ".sig");
      const signature = platforms[platform].signature;
      giteePlatforms[platform] = {
        signature,
        url: buildAssetUrl(giteeRepo, tag, assetName),
      };
    }
    const giteeManifest = buildManifest({
      version,
      pubDate: new Date().toISOString(),
      platforms: giteePlatforms,
    });
    await writeFile(giteeOutputPath, `${JSON.stringify(giteeManifest, null, 2)}\n`, "utf8");
    console.log(`[updater:manifest] wrote ${giteeOutputPath}`);
  }
}

main().catch((error) => {
  console.error(`[updater:manifest] unexpected error: ${error.message}`);
  process.exit(3);
});
