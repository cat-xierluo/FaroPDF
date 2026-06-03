#!/usr/bin/env bash
# 共享工具：颜色、路径、JSON 输出
# 供 doc-curator 其他脚本 source 使用。

set -euo pipefail

# 颜色（仅 TTY 启用）
if [ -t 1 ]; then
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""; C_RESET=""
fi

# 路径解析
# BASH_SOURCE[0] = .../scripts/lib/common.sh
# DOC_CURATOR_DIR = .../scripts/lib
# SKILL_ROOT      = .../doc-curator  (= DOC_CURATOR_DIR/../..)
# REPO_ROOT       = <project root>  (= SKILL_ROOT/../..)
DOC_CURATOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$DOC_CURATOR_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$SKILL_ROOT/../../.." && pwd)"

CONFIG_FILE="${SKILL_ROOT}/config/faropdf.yaml"
STATE_FILE="${SKILL_ROOT}/state.json"

# 结构化结果输出（一行一个 JSON）
emit_result() {
  local severity="$1"
  local rule_id="$2"
  local message="$3"
  local suggestion="${4:-}"
  printf '{"severity":"%s","rule_id":"%s","message":"%s","suggestion":"%s"}\n' \
    "$severity" "$rule_id" "$message" "$suggestion"
}

# 报告打印
print_header() { printf "${C_BOLD}== %s ==${C_RESET}\n" "$1"; }
print_pass()   { printf "${C_GREEN}✓${C_RESET} %s\n" "$1"; }
print_warn()   { printf "${C_YELLOW}!${C_RESET} %s\n" "$1"; }
print_fail()   { printf "${C_RED}✗${C_RESET} %s\n" "$1"; }
print_info()   { printf "${C_BLUE}·${C_RESET} %s\n" "$1"; }

# 报告小结：返回 0=全部通过 1=有 hard 失败 2=有 adaptive 警告
summarize() {
  local hard_fail=0
  local adaptive_warn=0
  local soft_warn=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    severity=$(printf '%s' "$line" | sed -n 's/.*"severity":"\([^"]*\)".*/\1/p')
    case "$severity" in
      hard)   hard_fail=$((hard_fail + 1)) ;;
      adaptive) adaptive_warn=$((adaptive_warn + 1)) ;;
      soft)   soft_warn=$((soft_warn + 1)) ;;
    esac
  done
  echo "---"
  echo "hard_failures: $hard_fail"
  echo "adaptive_warnings: $adaptive_warn"
  echo "soft_hints: $soft_warn"
  [ "$hard_fail" -gt 0 ] && return 1
  [ "$adaptive_warn" -gt 0 ] && return 2
  return 0
}
