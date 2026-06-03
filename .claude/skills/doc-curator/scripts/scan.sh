#!/usr/bin/env bash
# doc-curator 体检主入口
# 输出：JSON 行（每行一个检查项） + markdown 报告
# 退出码：0=全部 ok  1=hard 失败  2=adaptive 警告  3=soft 提示

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/lib/common.sh"

print_header "doc-curator scan"
print_info "REPO_ROOT: $REPO_ROOT"
print_info "STATE_FILE: $STATE_FILE"

# 首跑检测：state.json 的 first_run == true 时提示建基线
if [ -f "$STATE_FILE" ]; then
  first_run=$(grep -oE '"first_run":[[:space:]]*(true|false)' "$STATE_FILE" | grep -oE '(true|false)' || echo "true")
else
  first_run="true"
fi
if [ "$first_run" = "true" ]; then
  print_warn "state.json 处于首跑态；建议先跑 first-baseline.sh 建基线"
fi

# 跑各检查脚本
results_jsonl=$(mktemp)
trap 'rm -f "$results_jsonl"' EXIT

# shellcheck source=lib/check-tasks.sh
{
  bash "$SCRIPT_DIR/lib/check-tasks.sh"
  bash "$SCRIPT_DIR/lib/check-decisions.sh"
  bash "$SCRIPT_DIR/lib/check-files.sh"
} > "$results_jsonl" 2>&1 || true

# 输出 JSON 行
cat "$results_jsonl"

# 输出 markdown 报告
print_header "体检报告"
ok_count=$(grep -c '"severity":"ok"' "$results_jsonl" 2>/dev/null || true)
ok_count=${ok_count:-0}
hard_count=$(grep -c '"severity":"hard"' "$results_jsonl" 2>/dev/null || true)
hard_count=${hard_count:-0}
adaptive_count=$(grep -c '"severity":"adaptive"' "$results_jsonl" 2>/dev/null || true)
adaptive_count=${adaptive_count:-0}
soft_count=$(grep -c '"severity":"soft"' "$results_jsonl" 2>/dev/null || true)
soft_count=${soft_count:-0}
printf "ok: %s, hard: %s, adaptive: %s, soft: %s\n" \
  "$ok_count" "$hard_count" "$adaptive_count" "$soft_count"
echo

# 打印 hard/adaptive/soft 详情
if [ "$hard_count" -gt 0 ]; then
  print_header "[HARD] 必须处理"
  grep '"severity":"hard"' "$results_jsonl" | while IFS= read -r line; do
    rule_id=$(printf '%s' "$line" | sed -n 's/.*"rule_id":"\([^"]*\)".*/\1/p')
    message=$(printf '%s' "$line" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
    print_fail "$rule_id: $message"
  done
fi
if [ "$adaptive_count" -gt 0 ]; then
  print_header "[ADAPTIVE] 超过基线 × 1.5"
  grep '"severity":"adaptive"' "$results_jsonl" | while IFS= read -r line; do
    rule_id=$(printf '%s' "$line" | sed -n 's/.*"rule_id":"\([^"]*\)".*/\1/p')
    message=$(printf '%s' "$line" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
    print_warn "$rule_id: $message"
  done
fi
if [ "$soft_count" -gt 0 ]; then
  print_header "[SOFT] 软提示"
  grep '"severity":"soft"' "$results_jsonl" | while IFS= read -r line; do
    rule_id=$(printf '%s' "$line" | sed -n 's/.*"rule_id":"\([^"]*\)".*/\1/p')
    message=$(printf '%s' "$line" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
    print_info "$rule_id: $message"
  done
fi
if [ "$hard_count" -eq 0 ] && [ "$adaptive_count" -eq 0 ] && [ "$soft_count" -eq 0 ]; then
  print_pass "全部检查通过"
fi

# 退出码
[ "${hard_count:-0}" -gt 0 ] && exit 1
[ "${adaptive_count:-0}" -gt 0 ] && exit 2
exit 0
