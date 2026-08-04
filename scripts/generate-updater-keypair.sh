#!/usr/bin/env bash
# scripts/generate-updater-keypair.sh
#
# Tauri updater keypair 一键生成 + GitHub Secret 灌注 + pubkey 输出。
#
# 用法：
#   pnpm updater:keygen                      # 交互模式（密码用 read -s，不落 shell 历史）
#   pnpm updater:keygen --skip-secret        # 跳过 gh secret set，只生成 keypair + 打印 pubkey
#
# 流程（对齐 docs/RELEASE.md「Keypair 一次配置」+ DEC-070 踩坑修复）：
#   1. 检查 tauri CLI 可用
#   2. 交互读密码（-s 不回显，不落 history）
#   3. tauri signer generate 生成 keypair 到 ~/.tauri/faropdf.key[.pub]
#   4. chmod 600 收紧权限
#   5. 打印 pubkey（1 行 base64，粘进 src-tauri/tauri.conf.json 的 plugins.updater.pubkey）
#   6. gh secret set TAURI_SIGNING_PRIVATE_KEY（私钥文件原文 stdin，不经过 shell 变量）
#   7. gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#   8. 提醒备份 ~/.tauri/faropdf.key 到密码管理器
#
# 安全边界：
#   - 私钥只在 ~/.tauri/faropdf.key 落盘（已被 .gitignore 排除），从不进 git / 从不打印
#   - 密码用 read -s 读，不落 shell history
#   - gh secret set 用 stdin 重定向，私钥内容不经过 bash 变量
#
# 关联：DEC-070（double-base64 踩坑）/ DEC-071（Folia 对齐）/ docs/RELEASE.md

set -euo pipefail

KEY_PATH="${TAURI_KEY_PATH:-$HOME/.tauri/faropdf.key}"
REPO="${TAURI_REPO:-cat-xierluo/FaroPDF}"
SKIP_SECRET="0"

for arg in "$@"; do
  case "$arg" in
    --skip-secret) SKIP_SECRET="1" ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

# 1. 检查 tauri CLI
TAURI_BIN=""
if [ -x "./node_modules/.bin/tauri" ]; then
  TAURI_BIN="./node_modules/.bin/tauri"
elif command -v tauri >/dev/null 2>&1; then
  TAURI_BIN="tauri"
elif command -v pnpm >/dev/null 2>&1 && pnpm exec tauri --version >/dev/null 2>&1; then
  TAURI_BIN="pnpm exec tauri"
else
  echo "❌ 未找到 tauri CLI。先 pnpm install @tauri-apps/cli，或装 cargo install tauri-cli。"
  exit 1
fi
echo "✓ tauri CLI: $TAURI_BIN ($($TAURI_BIN --version))"

# 2. 检查 gh（如果要灌 secret）
if [ "$SKIP_SECRET" != "1" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "⚠️  gh CLI 未安装，跳过 secret 灌注（--skip-secret 模式）"
    SKIP_SECRET="1"
  elif ! gh auth status >/dev/null 2>&1; then
    echo "⚠️  gh 未登录，跳过 secret 灌注（--skip-secret 模式）"
    SKIP_SECRET="1"
  fi
fi

# 3. 已存在的 keypair 提示覆盖
if [ -f "$KEY_PATH" ]; then
  echo ""
  echo "⚠️  $KEY_PATH 已存在（$(stat -f "%Sm" "$KEY_PATH" 2>/dev/null || stat -c "%y" "$KEY_PATH" 2>/dev/null)）"
  echo "   覆盖会让历史 release 的 .sig 无法再签名（已发布版本将收不到 updater 更新）。"
  printf "   确认覆盖？输入 yes 继续: "
  read -r CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "已取消，保留旧 keypair。"
    exit 0
  fi
  FORCE_FLAG="--force"
  # 顺手备份旧 keypair
  cp "$KEY_PATH" "$KEY_PATH.$(date +%Y-%m-%d).bak" 2>/dev/null || true
  cp "$KEY_PATH.pub" "$KEY_PATH.pub.$(date +%Y-%m-%d).bak" 2>/dev/null || true
  echo "   旧 keypair 已备份到 $KEY_PATH.*.bak"
else
  FORCE_FLAG=""
fi

# 4. 读密码（不回显）
echo ""
printf "输入私钥密码（不可找回，请同时存进密码管理器）: "
read -rs KEY_PASSWORD
echo ""
if [ -z "$KEY_PASSWORD" ]; then
  echo "❌ 密码不能为空"
  exit 1
fi

# 5. 生成 keypair
mkdir -p "$(dirname "$KEY_PATH")"
$TAURI_BIN signer generate $FORCE_FLAG -p "$KEY_PASSWORD" -w "$KEY_PATH"
chmod 600 "$KEY_PATH" "$KEY_PATH.pub"
echo "✓ keypair 已生成: $KEY_PATH[.pub]（chmod 600）"

# 6. 打印 pubkey（粘进 tauri.conf.json）
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  pubkey（粘进 src-tauri/tauri.conf.json 的 plugins.updater.pubkey）:"
echo "════════════════════════════════════════════════════════════════"
cat "$KEY_PATH.pub"
echo "════════════════════════════════════════════════════════════════"

# 7. 灌 GitHub Secret
if [ "$SKIP_SECRET" = "1" ]; then
  echo ""
  echo "⏭️  跳过 gh secret set（--skip-secret）。手动灌注命令："
  echo "    gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $REPO < $KEY_PATH"
  echo "    gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $REPO --body '<your-password>'"
else
  echo ""
  printf "确认把私钥 + 密码灌到 GitHub Secret（repo: %s）? [y/N] " "$REPO"
  read -r CONFIRM_SECRET
  if [ "$CONFIRM_SECRET" = "y" ] || [ "$CONFIRM_SECRET" = "Y" ]; then
    gh secret set TAURI_SIGNING_PRIVATE_KEY --repo "$REPO" < "$KEY_PATH"
    gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo "$REPO" --body "$KEY_PASSWORD"
    echo "✓ GitHub Secret 已更新（TAURI_SIGNING_PRIVATE_KEY + _PASSWORD）"
  else
    echo "⏭️  已跳过。手动灌注命令见上。"
  fi
fi

# 8. 备份提醒
echo ""
echo "🔒 最后一步：把 $KEY_PATH 内容备份到密码管理器（1Password / Bitwarden / Keychain）。"
echo "   私钥丢失 = 永远无法发布新版本更新（用户装好的 app 卡在当前版本）。"
echo ""
echo "✅ 完成。下一步：把上面的 pubkey 粘进 tauri.conf.json，打 tag 触发 release.yml 验证闭环。"
