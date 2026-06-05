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

# 把 pubkey 写入 src-tauri/tauri.conf.json：
#   plugins.updater.pubkey = "<.pub 第二行 base64>"
# （2026-06-05 已替换 ISS-021 M1 占位 key 为正式 keypair，见 DEC-065）

# GitHub Secrets（仓库 Settings → Secrets and variables → Actions）：
#   TAURI_SIGNING_PRIVATE_KEY          = <cat ~/.tauri/faropdf.key | base64 -w0>
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = <STRONG_PASSWORD>
```

**macOS 推荐**：密码不要明文写本地脚本或 `.envrc`，统一通过系统 Keychain 管理。
首次落库（已完成于 2026-06-05）：

```bash
# 用 osascript 弹出 hidden answer 对话框输入密码（避免 shell 历史 / 日志泄露）
FAROPDF_KEYPW=$(osascript -e 'text returned of (display dialog "FaroPDF Tauri Signer Password" default answer "" with hidden answer)')

# 写入 macOS Keychain（service / account 标识便于跨项目区分）
security add-generic-password \
  -a "$USER" \
  -s "FaroPDF Tauri Signer Password" \
  -w "$FAROPDF_KEYPW" \
  -T "/Users/$USER/.cargo/bin/cargo" \
  -U
```

后续在本地需要密码时（如 PM 重签 / 本地调试）从 Keychain 读取：

```bash
FAROPDF_KEYPW=$(security find-generic-password -a "$USER" -s "FaroPDF Tauri Signer Password" -w)
```

详细 SOP（含跨项目 Folia / Funes 的复用方式）见 `docs/DECISIONS.md` DEC-065。

**注意**：`TAURI_SIGNING_PRIVATE_KEY` 推荐以 base64 字符串存进 Secret，CI 中
`cargo tauri signer sign` 接受 `cat <file>` 的原内容。Tauri 文档建议写入文件：
在 workflow 启动时 echo 到临时文件再 `TAURI_SIGNING_PRIVATE_KEY=<path>`。当前
`scripts/create-updater-manifest.mjs` 通过环境变量透传，需配合 job 端的 echo
步骤（如果以后改用文件路径则需调整）。

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
