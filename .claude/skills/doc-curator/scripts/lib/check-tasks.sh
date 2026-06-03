#!/usr/bin/env bash
# docs/TASKS.md 体检：活跃任务数、进度日志 trim、归档指针

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

TASKS_FILE="$REPO_ROOT/docs/TASKS.md"
if [ ! -f "$TASKS_FILE" ]; then
  print_fail "TASKS_FILE 不存在: $TASKS_FILE"
  exit 1
fi

# 1. 进度日志条数（硬性 ≤ 5）
progress_count=$(grep -cE '^- [0-9]{4}-[0-9]{2}-[0-9]{2}：' "$TASKS_FILE" || true)
if [ "${progress_count:-0}" -gt 5 ]; then
  emit_result "hard" "tasks-progress-log-trim" \
    "进度日志有 $progress_count 条，超过硬性上限 5 条" \
    "将最早的条目迁移到 docs/DECISIONS.md 工作日志"
else
  emit_result "ok" "tasks-progress-log-trim" \
    "进度日志 $progress_count 条，符合 ≤ 5"
fi

# 2. 活跃任务卡数（自适应基线 × 1.5）
active_count=$(grep -cE '^### ISS-[0-9]+' "$TASKS_FILE" || echo 0)
emit_result "adaptive" "tasks-active-count" \
  "活跃任务卡 $active_count 个（基线参考 state.json）" \
  "超过基线 × 1.5 时建议拆分或归档已完成 ISS"

# 3. 归档指针（硬性）：归档任务索引必须指向 DECISIONS.md 归档区
if grep -qE 'DECISIONS\.md' "$TASKS_FILE" && \
   grep -qE '归档任务' "$TASKS_FILE"; then
  emit_result "ok" "tasks-archived-iss-pointer" \
    "归档指针存在"
else
  emit_result "hard" "tasks-archived-iss-pointer" \
    "归档任务索引未指向 DECISIONS.md 归档区" \
    "在「归档任务索引」段补充 DECISIONS.md 链接"
fi

# 4. 总行数（自适应）
line_count=$(wc -l < "$TASKS_FILE" | tr -d ' ')
emit_result "adaptive" "tasks-line-count" \
  "总行数 $line_count"
