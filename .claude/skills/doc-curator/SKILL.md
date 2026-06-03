---
name: doc-curator
homepage: https://github.com/cat-xierluo/FaroPDF
author: FaroPDF 项目组
version: "0.1.0"
license: MIT
description: 'FaroPDF 文档瘦身与归档一致性 subagent。监控 docs/TASKS.md、docs/DECISIONS.md 等项目级文档的膨胀与归档一致性，在 PR 创建后和 PR 合并后自动跑体检，发现问题自动提 maintenance PR。当用户提到「docs 膨胀」「归档不一致」「TASKS.md 进度日志太长」「维护 PR」或要求手动跑 `bash .claude/skills/doc-curator/scripts/scan.sh` 时使用。不要用于单文件内容审查、文档改写、CHANGELOG 编写、src/ 代码维护。'
---

# doc-curator 文档瘦身与归档一致性

## 触发场景

- 主动：用户跑 `bash .claude/skills/doc-curator/scripts/scan.sh` 或要求「跑一次文档体检」。
- 自动：Agent 在 git-workflow 完成 `gh pr create` 之后、`gh pr merge` 之后自动调起本 subagent 跑体检。
- 自动：Agent 在「完成 ISS 任务」汇报前，调起本 subagent 检查归档指针是否完整。

## 边界

**本 Skill 只做：**

- 跑体检脚本（`scripts/scan.sh`）。
- 解析体检结果（JSON 行）。
- 必要时调用 `scripts/maintenance-pr.sh` 自动提 maintenance PR。
- 更新 `state.json` 中的 `last_scan_at` 和 `history`。
- 输出 markdown 报告（hard / adaptive / soft 三档）。

**本 Skill 不做：**

- 不修改 `src/`、`src-tauri/`、`tests/` 任何代码或资源文件。
- 不改写文档内容（只 trim 进度日志等机械动作）。
- 不调用任何 OCR、PDF 处理、API 集成。
- 不直接 push 到 `main`（maintenance PR 走 PR 流程，由用户/PM 合并）。
- 不修改 `.claude/skills/` 下其它 skill。
- 不写 `CHANGELOG.md`（CHANGELOG 由 `release-workflow` 维护）。
- 不创建永久脚本：所有逻辑都在 `scripts/` 内，不污染项目根。

## 1. 工作流

### 1.1 体检

```bash
bash .claude/skills/doc-curator/scripts/scan.sh
```

退出码：

- `0` 全部 ok。
- `1` 存在 hard 失败（必须提 maintenance PR）。
- `2` 存在 adaptive 警告（建议提 maintenance PR）。
- `3` 仅 soft 提示（可忽略）。

### 1.2 首跑建基线

```bash
bash .claude/skills/doc-curator/scripts/first-baseline.sh
```

只在新接入项目或重置阈值时跑一次。脚本会测量各文件大小并写入 `state.json`。

### 1.3 自动 maintenance PR

```bash
bash .claude/skills/doc-curator/scripts/maintenance-pr.sh
```

约束：

- 工作区必须干净，否则拒绝执行。
- 仅在存在 hard 或 adaptive 警告时跑。
- 创建分支 `chore/doc-curator-<YYYY-MM-DD>`，push 后 `gh pr create`。
- PR 标签：`automated`、`docs`、`maintenance`。

## 2. 健康检查项

| 文件 | 检查项 | 性质 | 阈值 |
| --- | --- | --- | --- |
| `docs/TASKS.md` | 进度日志条数 | 硬性 | ≤ 5 |
| `docs/TASKS.md` | 活跃任务卡数 | 自适应 | 基线 × 1.5 |
| `docs/TASKS.md` | 归档指针存在 | 硬性 | 必须指向 `DECISIONS.md` |
| `docs/DECISIONS.md` | ISS 归档条目升序 | 硬性 | 必须升序 |
| `docs/DECISIONS.md` | DEC 编号连续 | 硬性 | 无跳号 |
| `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `AGENTS.md` | 总行数 | 自适应 | 基线 × 1.5 |
| `CHANGELOG.md` | 最近 release entry | 软提示 | 提示但不阻断 |
| `README.md` | 「当前状态」段 | 软提示 | 提示但不阻断 |

自适应阈值的基线在 `state.json` 的 `baselines` 字段中维护；首跑由 `first-baseline.sh` 建立。

## 3. 输出格式

体检输出 JSON 行（每行一个检查项）：

```json
{"severity":"hard","rule_id":"tasks-progress-log-trim","message":"...","suggestion":"..."}
{"severity":"adaptive","rule_id":"tasks-line-count","message":"...","suggestion":"..."}
{"severity":"ok","rule_id":"...","message":"...","suggestion":""}
```

`severity` 取值：`ok` / `hard` / `adaptive` / `soft`。

## 4. 安全约束

- 不修改原始 PDF 或 `src-tauri/` 任何资源。
- 不读 OCR/PDF 处理脚本，不调外部 API。
- 不在日志、报告、PR 描述中输出密钥、Token、隐私信息。
- 不在自动 maintenance PR 中包含任何用户最近文件名、搜索历史。
- 不自动合并任何 PR（包括自己提的）。
- 严格遵守 `AGENTS.md` 的「PDF 安全边界」和「完成标准」。

## 5. 相关 Skill

| Skill | 关系 |
| --- | --- |
| `git-workflow` | 在 `gh pr create` 和 `gh pr merge` 完成后由 Agent 主动调起本 subagent。`git-workflow` 不会自动调起，需要 Agent 在协议里执行。 |
| `git-batch-commit` | maintenance PR 的 commit 标题和拆分粒度遵循该 Skill 的「chore」规则。 |
| `cross-agent-coordination` | maintenance PR 的归属、状态记录由该 Skill 协调。 |
| `release-workflow` | `CHANGELOG.md` 由该 Skill 维护；本 Skill 只做软提示，不修改。 |
| `multi-agent-orchestration` | 多个 worker 并行推进时，本 subagent 在 PR 后触发以发现膨胀。 |

## 6. 配置文件

- 监控文件清单与阈值：`config/faropdf.yaml`。
- 基线与历史：`state.json`。
- 修改阈值：编辑 `config/faropdf.yaml`，下次 scan 自动生效。
- 重置基线：删除 `state.json` 的 `baselines` 字段后跑 `first-baseline.sh`。

## 7. 回退

如需禁用本 subagent：

1. 删 `.claude/skills/doc-curator/`。
2. 删 `.claude/agents/doc-curator.md`。
3. 在 `AGENTS.md` 的「Skill 强制调用」表移除 doc-curator 行。
4. 在 `git-workflow` 的 post-PR 步骤移除 doc-curator 调用。

回退不影响项目其它功能。

## 参考

- 项目级文档：见仓库根 `AGENTS.md`。
- 架构位置：见 `docs/ARCHITECTURE.md` 文档与决策记录小节。
- 决策记录：见 `docs/DECISIONS.md` 中 DEC-026。
- 任务卡：见 `docs/TASKS.md` 中 ISS-021。
