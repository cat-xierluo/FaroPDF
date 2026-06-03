#!/usr/bin/env bash
# 通用文件行数体检：docs/ROADMAP.md, docs/DESIGN.md, docs/ARCHITECTURE.md, CHANGELOG.md, README.md, AGENTS.md

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

check_file_lines() {
  local rel_path="$1"
  local rule_id="$2"
  local file="$REPO_ROOT/$rel_path"
  if [ ! -f "$file" ]; then
    emit_result "soft" "$rule_id" \
      "$rel_path 不存在"
    return
  fi
  local line_count
  line_count=$(wc -l < "$file" | tr -d ' ')
  emit_result "adaptive" "$rule_id" \
    "$rel_path 总行数 $line_count"
}

check_file_lines "docs/ROADMAP.md"     "roadmap-line-count"
check_file_lines "docs/DESIGN.md"      "design-line-count"
check_file_lines "docs/ARCHITECTURE.md" "architecture-line-count"
check_file_lines "AGENTS.md"            "agents-line-count"

# 软提示：CHANGELOG.md 最近 release entry
CHANGELOG="$REPO_ROOT/CHANGELOG.md"
if [ -f "$CHANGELOG" ]; then
  if grep -qE '^##.*[0-9]{4}-[0-9]{2}-[0-9]{2}|^## v[0-9]' "$CHANGELOG"; then
    emit_result "ok" "changelog-recent-release-entry" \
      "CHANGELOG.md 含最近 release entry"
  else
    emit_result "soft" "changelog-recent-release-entry" \
      "CHANGELOG.md 缺少日期或版本号段标题" \
      "在 CHANGELOG.md 顶部补充最近 release 段"
  fi
fi

# 软提示：README.md 当前状态段
README="$REPO_ROOT/README.md"
if [ -f "$README" ]; then
  if grep -qE '当前状态|Current Status' "$README"; then
    emit_result "ok" "readme-current-status" \
      "README.md 含「当前状态」段"
  else
    emit_result "soft" "readme-current-status" \
      "README.md 缺少「当前状态」段" \
      "在 README.md 补充「当前状态」或「Current Status」段"
  fi
fi
