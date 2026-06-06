# FaroPDF 发布流程（v0.3）

> ISS-021 全平台打包与自动更新。本文件记录 v0.3 起的桌面端发布流程、密钥管理与
> 当前已知限制。详细方案见 `docs/DECISIONS.md` DEC-048。

## 1. 产物矩阵

`v0.1.0` 起桌面端覆盖三个平台：

| 平台       | Rust target                  | updater bundle  | 其他产物       |
|------------|------------------------------|-----------------|---------------|
| macOS      | `universal-apple-darwin`     | `.app` / `.app.tar.gz` / `.dmg` | 同左（universal 同时支持 aarch64 + x86_64） |
| Windows    | `x86_64-pc-windows-msvc`     | `.msi`          | `.exe`（NSIS 安装器） |
| Linux      | `x86_64-unknown-linux-gnu`   | `.AppImage`     | `.deb`（apt 仓库） |

> 移动端（Android / iOS）在 v0.3 评估范围；ISS-021 不强制实现。后续若需要，按
> Tauri Mobile 文档扩展 `release.yml` 矩阵 + 增加对应签名 key。

## 2. updater manifest 协议

`tauri-plugin-updater` 客户端从固定 URL 拉取 `latest.json`：

```
https://github.com/cat-xierluo/FaroPDF/releases/latest/download/latest.json
```

`latest.json` 由 `scripts/create-updater-manifest.mjs` 在 CI release job 中生成，
schema 遵循 tauri-plugin-updater v2 manifest：

```json
{
  "version": "0.1.0",
  "pub_date": "2026-06-04T12:34:56Z",
  "platforms": {
    "darwin-universal": {
      "signature": "<base64 .sig>",
      "url": "https://github.com/.../FaroPDF.app.tar.gz"
    },
    "windows-x86_64": { "signature": "...", "url": "..." },
    "linux-x86_64":   { "signature": "...", "url": "..." }
  }
}
```

每个 `url` 是 GitHub Release 资产直链；每个 `signature` 由 `cargo tauri signer sign`
针对该 bundle 生成的 `.sig` 文件内容（minisign 格式，base64）。

## 3. 发布步骤

### 3.1 一次性：生成 keypair 并落到 GitHub Secrets

仅由仓库管理员在首次发布前完成。**私钥不进入版本库**。

```bash
# 本地生成 ed25519 签名 keypair
cargo tauri signer generate -p "<STRONG_PASSWORD>" -w ~/.tauri/faropdf.key

# 查看产物结构（debug 用）：
#   ~/.tauri/faropdf.key     348 字节单行 base64（一层）
#   ~/.tauri/faropdf.key.pub 152 字节单行 base64（一层）
#   两者都是 minisign 私钥 / 公钥 文件的 base64 编码形式。
#   base64 -d 后才是 minisign 2 行格式（untrusted comment + key blob）。
#   2026-06-06 v0.1.0 修复后已替换 ISS-021 M1 占位 key 为正式 keypair，见 DEC-070。
```

**写入 `tauri.conf.json` 的 pubkey 字段**（`plugins.updater.pubkey`）：

Tauri CLI 内部 `pub_key` 流程是 `decode_key` → `PublicKeyBox::from_string` →
`pk_box.into_public_key`，而 `decode_key` 会对字段值先 base64-decode 再 UTF-8 转换。
所以字段期望的是 **`base64(2 行 minisign 公钥文本)`**（含
`untrusted comment: minisign public key: <KEYNUM>` 那行 header），不是
`.pub` 文件第二行原文 `RWS8...`（填原文会被 base64 decode 出二进制
minisign 公钥 bytes，`str::from_utf8` 报 `invalid utf-8 sequence of 1 bytes
from index 2`）。

```bash
# 正确格式（一行 base64 字符串，含两行原文）：
PUBKEY_B64=$(cat ~/.tauri/faropdf.key.pub | base64 -d | base64 -w0)

# 写入 src-tauri/tauri.conf.json：
#   plugins.updater.pubkey = "${PUBKEY_B64}"
# 可验证：echo -n "$PUBKEY_B64" | base64 -d 应回显两行 minisign 公钥文本
```

**写入 GitHub Secrets**（仓库 Settings → Secrets and variables → Actions）：

```bash
# TAURI_SIGNING_PRIVATE_KEY 直接灌 ~/.tauri/faropdf.key 的文件内容（已是一层 base64）
# ⚠️ 不要 `cat ... | base64 -w0` ——那会再包一层（double-base64），
#    minisign 解码失败 → Build Tauri bundle 报
#    "failed to decode secret key: incorrect updater private key password:
#     Missing encoded key in secret key"
gh secret set TAURI_SIGNING_PRIVATE_KEY          < ~/.tauri/faropdf.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD "<STRONG_PASSWORD>"
```

**macOS Keychain 管理密码**（避免明文落本地脚本 / `.envrc`）：

```bash
# 首次落库（已完成于 2026-06-05）：
FAROPDF_KEYPW=$(osascript -e 'text returned of (display dialog "FaroPDF Tauri Signer Password" default answer "" with hidden answer)')

# 写入 macOS Keychain（service / account 标识便于跨项目区分）
security add-generic-password \
  -a "$USER" \
  -s "FaroPDF Tauri Signer Password" \
  -w "$FAROPDF_KEYPW" \
  -T "/Users/$USER/.cargo/bin/cargo" \
  -U

# 后续本地需要时从 Keychain 读取：
FAROPDF_KEYPW=$(security find-generic-password -a "$USER" -s "FaroPDF Tauri Signer Password" -w)
```

**重要环境变量名差异**（v0.1.0 修复踩坑）：

- `cargo tauri build`（tplugin-updater 自动签名）读 `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `cargo tauri signer sign`（独立签名命令，`scripts/create-updater-manifest.mjs` 调）读 `TAURI_PRIVATE_KEY` + `TAURI_PRIVATE_KEY_PASSWORD`（**无 SIGNING 前缀**）

release.yml 配的是前者；`scripts/create-updater-manifest.mjs` 配的也是前者（CI 用
`TAURI_SIGNING_PRIVATE_KEY` 给 `cargo tauri signer sign`）。两边字段值相同。

**安全注意**：`cargo tauri signer sign --help` 会把 `TAURI_PRIVATE_KEY_PASSWORD`
明文 dump 到 stderr（clap 默认打印 env var 默认值）。**不要**在含密钥的
shell session 里跑 `cargo tauri signer sign --help` 之类的命令——会泄密钥到
transcript / CI log。

### 3.2 触发发布

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` 监听 `v*.*.*` 形式的 tag push，自动：
1. 矩阵构建 3 个平台（macOS universal / Windows x64 / Linux x64）
2. 拉取所有 artifacts，调用 `scripts/create-updater-manifest.mjs` 生成 `latest.json`
3. 创建 GitHub Release 并上传所有 assets + `latest.json`

### 3.3 验证

发布完成后，本机桌面端打开「设置 → 关于 → 检查更新」应当：
- 显示「检测到新版本 v0.1.0」并提供「下载并安装」按钮
- 点击后进入 downloading 进度（百分比 + 字节数）
- Tauri 自动触发系统级安装提示（macOS 拖拽 / Windows UAC / Linux AppImage 替换）

## 4. 当前限制（v0.3）

- **自动检查更新**：✅ DEC-056 落地。`AppSettings.autoUpdateCheck`（默认 `true`）
  + About section 顶部「自动检查更新」checkbox，关闭时 About 首次 mount 跳过
  `checkForAppUpdate`，手动按钮仍可用；切换实时经 `onChange` → SettingsPanel
  → App 路径持久化（App.tsx 当前是 in-memory，SettingsService 真正落盘由后续
  PR 接入时再加 debounce）。详见 `docs/DECISIONS.md` DEC-056。
- **增量更新回退完整重装**：✅ DEC-066 落地。`tauri-plugin-updater` 的下载流若中
  断（chunk 重试用尽、网络中断、签名校验失败等），前端自动重试一次完整下载；两
  次均失败时 UI 进入 `fallback` 状态，显示脱敏错误消息 + GitHub Releases 手动下载
  链接。Rust 端 `update_fallback.rs` 提供错误分类和脱敏逻辑。详见 `docs/DECISIONS.md`
  DEC-066。
- **移动端不在 v0.3 scope**：Android / iOS 打包在评估范围；ISS-021 不强制实现。
  后续若启动 ISS-XXX 移动端，需扩展 `release.yml` 矩阵 + 单独签名 keypair +
  `latest.json` platform 字段。
- **签名 key 轮换**：v0.3 不支持 key rotation。若私钥泄露，需要手动从 0.x 重新
  发布到 1.0.0 之前的所有版本签名（这是 minisign 的固有限制，不在 ISS-021 scope）。
- **CODE_SIGNING**：macOS / Windows 平台级代码签名（开发者证书、notarization、
  EV 证书）需要本机持有 Apple Developer / DigiCert 等证书；当前 `release.yml`
  不含 `cargo tauri build --sign` 流程，需要扩展时再单独 PR。

## 5. 相关文件

- `src-tauri/Cargo.toml` — tauri-plugin-updater 依赖
- `src-tauri/tauri.conf.json` — `bundle.createUpdaterArtifacts` + `plugins.updater`
- `src-tauri/src/lib.rs` — `tauri_plugin_updater::Builder::new().build()` 接入
- `src-tauri/src/update_fallback.rs` — ISS-021 增量更新失败回退：错误分类与脱敏
- `src/shared/update/` — 前端 update 契约（types / service / capability）
- `src/modules/settings/sections/AboutSection.tsx` — 检查更新 UI（含 fallback 分支）
- `scripts/create-updater-manifest.mjs` — `latest.json` 生成器
- `.github/workflows/release.yml` — 跨平台 CI 流水线
- `docs/DECISIONS.md` DEC-048 — 架构与限制决策
