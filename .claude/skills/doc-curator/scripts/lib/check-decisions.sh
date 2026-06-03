#!/usr/bin/env bash
# docs/DECISIONS.md 体检：ISS 归档条目升序、DEC 编号连续

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

DECISIONS_FILE="$REPO_ROOT/docs/DECISIONS.md"
if [ ! -f "$DECISIONS_FILE" ]; then
  print_fail "DECISIONS_FILE 不存在: $DECISIONS_FILE"
  exit 1
fi

# 1. ISS 归档条目升序（硬性）
# 抓取 "**ISS-XXX ..." 行并提取数字
iss_numbers=$(grep -oE 'ISS-[0-9]+' "$DECISIONS_FILE" | grep -oE '[0-9]+' | sort -n -u || true)
if [ -n "$iss_numbers" ]; then
  # 检查归档区段内的 ISS 顺序
  in_archive=$(awk '
    /^## ISS 任务归档/ { in_arc=1; next }
    /^## / && in_arc { in_arc=0 }
    in_arc && /ISS-[0-9]+/ { print }
  ' "$DECISIONS_FILE" | grep -oE 'ISS-[0-9]+' | grep -oE '[0-9]+' || true)
  if [ -n "$in_archive" ]; then
    sorted=$(printf '%s\n' "$in_archive" | sort -n)
    if [ "$in_archive" = "$sorted" ]; then
      emit_result "ok" "decisions-iss-archive-ascending" \
        "ISS 归档条目按编号升序"
    else
      emit_result "hard" "decisions-iss-archive-ascending" \
        "ISS 归档条目未按升序排列" \
        "按 ISS-XXX 编号重新排序归档区条目"
    fi
  else
    emit_result "ok" "decisions-iss-archive-ascending" \
      "归档区暂无条目，跳过"
  fi
else
  emit_result "ok" "decisions-iss-archive-ascending" \
    "无 ISS 编号"
fi

# 2. DEC 编号连续（硬性）
# 抓取 "DEC-XXX" 编号
dec_numbers=$(grep -oE 'DEC-[0-9]+' "$DECISIONS_FILE" | grep -oE '[0-9]+' | sort -n -u || true)
if [ -n "$dec_numbers" ]; then
  gaps=$(printf '%s\n' "$dec_numbers" | awk '
    NR>1 && $1 != prev+1 { print prev "→" $1 }
    { prev=$1 }
  ')
  if [ -z "$gaps" ]; then
    emit_result "ok" "decisions-dec-numbering-continuous" \
      "DEC 编号连续无跳号"
  else
    emit_result "hard" "decisions-dec-numbering-continuous" \
      "DEC 编号跳号：$gaps" \
      "补齐缺失的 DEC-XXX 条目或修正编号"
  fi
else
  emit_result "ok" "decisions-dec-numbering-continuous" \
    "无 DEC 编号"
fi

# 3. 总行数（自适应）
line_count=$(wc -l < "$DECISIONS_FILE" | tr -d ' ')
emit_result "adaptive" "decisions-line-count" \
  "总行数 $line_count"
