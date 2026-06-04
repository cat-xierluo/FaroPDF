#!/usr/bin/env node
// scripts/create-updater-manifest.mjs
//
// ISS-021：跨平台打包后，从 release artifacts 生成 tauri-plugin-updater v2 所需的
// latest.json 清单。流程：
//   1. 递归扫描 --release-dir 下的产物，匹配 updater 兼容的 bundle：
//        - .app.tar.gz  → darwin-universal
//        - .msi         → windows-x86_64
//        - .AppImage    → linux-x86_64
//        - .deb         → linux-x86_64（deb 是非 updater 路径，仅发布到 release）
//   2. 对每个 updater 兼容的 bundle 调用 `cargo tauri signer sign` 生成 <file>.sig
//   3. 读 .sig 文本，组装 tauri-plugin-updater v2 manifest 的 platforms 子表
//   4. 写出 --output 路径（默认 latest.json）
//
// 用法（GitHub Actions 上下文）：
//   TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD 由 secret 注入
//   node scripts/create-updater-manifest.mjs \
//     --release-dir artifacts \
//     --repo cat-xierluo/FaroPDF \
//     --tag v0.1.0 \
//     --output latest.json
//
// 退出码：0 成功；1 参数错误 / 找不到 updater bundle；2 signing 失败；3 IO 失败。

import { spawn } from "node:child_process";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const UPDATER_PLATFORM_KEYS = {
  "darwin-universal": "darwin-universal",
  "darwin-aarch64": "darwin-aarch64",
  "darwin-x86_64": "darwin-x86_64",
  "windows-x86_64": "windows-x86_64",
  "linux-x86_64": "linux-x86_64",
};

const UPDATER_PATTERNS = [
  { regex: /\.app\.tar\.gz$/i, platform: "darwin-universal" },
  { regex: /_aarch64\.dmg$/i, platform: "darwin-aarch64" },
  { regex: /_x64\.dmg$/i, platform: "darwin-x86_64" },
  { regex: /_aarch64\.app\.tar\.gz$/i, platform: "darwin-aarch64" },
  { regex: /_x64\.app\.tar\.gz$/i, platform: "darwin-x86_64" },
  { regex: /\.msi$/i, platform: "windows-x86_64" },
  { regex: /\.AppImage$/i, platform: "linux-x86_64" },
];

function parseArgs(argv) {
  const args = {
    releaseDir: null,
    repo: null,
    tag: null,
    output: "latest.json",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--release-dir":
        args.releaseDir = value;
        i += 1;
        break;
      case "--repo":
        args.repo = value;
        i += 1;
        break;
      case "--tag":
        args.tag = value;
        i += 1;
        break;
      case "--output":
        args.output = value;
        i += 1;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        if (flag?.startsWith("--")) {
          console.error(`[create-updater-manifest] unknown flag: ${flag}`);
          process.exit(1);
        }
        break;
    }
  }
  if (!args.releaseDir || !args.repo || !args.tag) {
    printHelp();
    process.exit(1);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/create-updater-manifest.mjs [options]

Options:
  --release-dir <dir>   Directory containing release artifacts (recursively scanned).
  --repo <owner/name>   GitHub repo slug, e.g. cat-xierluo/FaroPDF.
  --tag <vX.Y.Z>        Release tag (with v prefix).
  --output <path>       Output file path (default: latest.json).
  -h, --help            Show this help.

Required env (when signing):
  TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD (only if your key has a password)`);
}

async function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await stat(current);
    } catch {
      continue;
    }
    if (entries.isFile()) {
      out.push(current);
      continue;
    }
    if (!entries.isDirectory()) {
      continue;
    }
    const { readdir } = await import("node:fs/promises");
    const children = await readdir(current, { withFileTypes: true });
    for (const child of children) {
      const childPath = join(current, child.name);
      if (child.isDirectory()) {
        stack.push(childPath);
      } else if (child.isFile()) {
        out.push(childPath);
      }
    }
  }
  return out;
}

function matchUpdaterPlatform(filename) {
  const base = filename.split(sep).pop() ?? filename;
  for (const { regex, platform } of UPDATER_PATTERNS) {
    if (regex.test(base)) {
      return platform;
    }
  }
  return null;
}

async function signFile(filePath) {
  const env = { ...process.env, CI: "true" };
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("cargo", ["tauri", "signer", "sign", filePath], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      rejectPromise(new Error(`failed to spawn cargo tauri signer sign: ${error.message}`));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          `cargo tauri signer sign exited with code ${code}: ${stderr.trim() || "no stderr"}`,
        ),
      );
    });
  });
}

async function readSignature(filePath) {
  const sigPath = `${filePath}.sig`;
  const content = await readFile(sigPath, "utf8");
  return content.trim();
}

function buildAssetUrl(repo, tag, relativePath) {
  const tagNoV = tag.replace(/^v/, "");
  return `https://github.com/${repo}/releases/download/${tagNoV}/${relativePath
    .split(sep)
    .join("/")}`;
}

function stripTag(tag) {
  const stripped = tag.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+/.test(stripped)) {
    return "0.0.0";
  }
  const [major, minor, patch] = stripped.split(/[.-]/);
  return `${major}.${minor}.${patch}`;
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
  const args = parseArgs(process.argv.slice(2));
  const releaseDir = resolve(args.releaseDir);
  const outputPath = resolve(args.output);
  const repoRoot = process.cwd();
  const allFiles = await walk(releaseDir);
  if (allFiles.length === 0) {
    console.error(`[create-updater-manifest] no files under ${releaseDir}`);
    process.exit(1);
  }

  const candidates = [];
  for (const file of allFiles) {
    const platform = matchUpdaterPlatform(file);
    if (platform) {
      candidates.push({ file, platform });
    }
  }

  if (candidates.length === 0) {
    console.error(
      `[create-updater-manifest] no updater-compatible bundles found under ${releaseDir} (expected .app.tar.gz / .msi / .AppImage)`,
    );
    process.exit(1);
  }

  // Per platform: pick the first candidate (deterministic, by sorted path).
  candidates.sort((a, b) => a.file.localeCompare(b.file));
  const byPlatform = new Map();
  for (const candidate of candidates) {
    if (!byPlatform.has(candidate.platform)) {
      byPlatform.set(candidate.platform, candidate.file);
    }
  }

  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
    console.error(
      "[create-updater-manifest] TAURI_SIGNING_PRIVATE_KEY env is required for signing",
    );
    process.exit(2);
  }

  const platforms = {};
  for (const [platform, file] of byPlatform) {
    if (!UPDATER_PLATFORM_KEYS[platform]) {
      continue;
    }
    console.log(`[create-updater-manifest] signing ${platform}: ${relative(repoRoot, file)}`);
    try {
      await signFile(file);
    } catch (error) {
      console.error(
        `[create-updater-manifest] signing failed for ${file}: ${error.message}`,
      );
      process.exit(2);
    }
    const signature = await readSignature(file);
    const url = buildAssetUrl(args.repo, args.tag, relative(releaseDir, file));
    platforms[platform] = { signature, url };
  }

  const manifest = buildManifest({
    version: stripTag(args.tag),
    pubDate: new Date().toISOString(),
    platforms,
  });

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[create-updater-manifest] wrote ${outputPath}`);
  console.log(`[create-updater-manifest] platforms: ${Object.keys(platforms).join(", ")}`);
}

main().catch((error) => {
  console.error(`[create-updater-manifest] unexpected error: ${error.message}`);
  process.exit(3);
});
