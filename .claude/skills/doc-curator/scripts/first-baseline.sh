#!/usr/bin/env bash
# doc-curator 首跑：测量各文件大小并写入 state.json
# 后续 scan.sh 用 state.json 的 baselines × 1.5 作为告警阈值

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/lib/common.sh"

print_header "doc-curator first-baseline"
print_info "REPO_ROOT: $REPO_ROOT"

# 需要基线化的文件
declare -A files=(
  ["docs/TASKS.md"]="docs/TASKS.md"
  ["docs/DECISIONS.md"]="docs/DECISIONS.md"
  ["docs/ROADMAP.md"]="docs/ROADMAP.md"
  ["docs/DESIGN.md"]="docs/DESIGN.md"
  ["docs/ARCHITECTURE.md"]="docs/ARCHITECTURE.md"
  ["CHANGELOG.md"]="CHANGELOG.md"
  ["README.md"]="README.md"
  ["AGENTS.md"]="AGENTS.md"
)

measured_at=$(date +%Y-%m-%d)
baselines_json="{\n"

first=1
for rel in "${!files[@]}"; do
  file="$REPO_ROOT/$rel"
  if [ ! -f "$file" ]; then
    print_warn "$rel 不存在，跳过"
    continue
  fi
  line_count=$(wc -l < "$file" | tr -d ' ')
  active_count=0
  if [ "$rel" = "docs/TASKS.md" ]; then
    active_count=$(grep -cE '^### ISS-[0-9]+' "$file" || echo 0)
  fi
  if [ $first -eq 0 ]; then
    baselines_json+=",\n"
  fi
  first=0
  if [ "$rel" = "docs/TASKS.md" ]; then
    baselines_json+="    \"$rel\": {\"line_count\": $line_count, \"active_task_count\": $active_count, \"measured_at\": \"$measured_at\"}"
  else
    baselines_json+="    \"$rel\": {\"line_count\": $line_count, \"measured_at\": \"$measured_at\"}"
  fi
  print_info "$rel: lines=$line_count"
done
baselines_json+="\n  }"

# 写 state.json
state_tmp=$(mktemp)
cat > "$state_tmp" <<EOF
{
  "version": "1",
  "first_run": false,
  "first_run_at": "$measured_at",
  "last_scan_at": "$measured_at",
  "multiplier": 1.5,
  "baselines": $baselines_json,
  "history": []
}
EOF
mv "$state_tmp" "$STATE_FILE"
print_pass "state.json 已写入: $STATE_FILE"
print_info "下次跑 scan.sh 将按基线 × 1.5 告警"
