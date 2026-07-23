# FaroPDF 项目协作指南

## 项目定位

FaroPDF 是一个独立 PDF 阅读器，面向律师日常阅读卷宗、证据、判决、合同和扫描材料。项目不并入 Folia，不承担 Markdown 编辑、Word 导出或公众号 HTML 导出的职责。

核心目标：

- 足够快：大 PDF 打开、翻页、缩放、搜索时保持轻快。
- 足够清亮：界面克制，内容优先，减少工具栏和面板干扰。
- 法律材料友好：重视文字层、OCR 状态、批注汇总、页面整理、页码和材料交接。
- 默认安全：不覆盖原始 PDF，所有破坏性操作默认另存、导出或写入可回退 sidecar。

## 基本约定

- 全程使用中文回复与写作。
- 遵循 `docs/ROADMAP.md` 路线图驱动开发。
- `docs/TASKS.md` 是唯一任务源；待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议都记录在这里。
- 重要技术选择和工作摘要记录到 `docs/DECISIONS.md`。
- 用户可见变更写入 `CHANGELOG.md`。
- 涉及 UI、交互和视觉时遵循 `docs/DESIGN.md`。
- 涉及架构、数据流、模块边界时同步更新 `docs/ARCHITECTURE.md`。

## 文件清单

| 文档 | 职责 |
| --- | --- |
| `README.md` | 项目介绍、定位、快速开始和当前状态 |
| `CHANGELOG.md` | 用户可见变更记录 |
| `docs/ROADMAP.md` | 路线图、阶段任务和进度日志 |
| `docs/TASKS.md` | 唯一任务源：待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议 |
| `docs/DECISIONS.md` | 技术决策记录与工作日志 |
| `docs/ARCHITECTURE.md` | 架构、数据流、核心接口和技术边界 |
| `docs/DESIGN.md` | 视觉系统、布局、控件和交互规范 |
| `docs/reference/pdf-expert/` | PDF Expert 复刻证据、状态矩阵、实现映射和验收门禁 |

## PDF 安全边界

- 不直接覆盖用户打开的原始 PDF，除非用户明确选择覆盖并二次确认。
- 保存批注、页面重排、OCR 双层结果、扁平化表单等操作，默认输出为新 PDF。
- 批注第一版允许使用 sidecar 保存可编辑状态；导出时再写入或扁平化到 PDF。
- 删除页、重排页、压缩、OCR 重建文字层、水印去除、解密等都属于高风险操作，必须提供预览或输出文件路径。
- 法律材料可能包含隐私、商业秘密和案件信息；调用 PaddleOCR、MinerU 等联网 OCR 服务前必须让用户明确知情。
- 本地 OCR、页面处理和质量检查优先放在后台任务，不阻塞打开文档和阅读。
- 发现密钥、Token、密码、证件号等敏感信息时，不写入公开仓库，不在日志中完整输出。

## 开发策略

- 第一阶段先搭建可日用的基础版：快读、检索、批注、OCR bridge、页面整理、表单签署。
- 技术实现优先按需加载：首屏只加载应用 shell 和基础阅读能力，缩略图、全文索引、批注列表、OCR 和页面整理按需启动。
- PDF.js 负责阅读渲染和文本层；pdf-lib 负责页面复制、删除、重排、表单和导出保存；OCR 通过 bridge 调用本地工具或用户确认后的云端能力。
- 扫描清洁校正、压缩、OCR provider、证据图片编排和文书整理 manifest 的算法来源记录在 `docs/TASKS.md`。
- 避免把重型 OCR 引擎、批量转换链路或扫描预处理同步塞进前端主线程。
- 面向律师工作流时，优先做“可验证、可回退、可交接”的能力，而不是炫技式编辑。

## 多 Agent 与 worktree 编排

- Agent 以 `docs/TASKS.md` 为唯一任务源，不另建任务计划文档。
- Agent 可根据 `docs/TASKS.md` 自行判断哪些素材应晋升为正式 ISS，哪些 ISS 可放入同一 worktree 分支顺序推进。
- 文件范围重叠、共享依赖多或存在强依赖链的任务可以同组；会争抢脚手架、锁文件、`src-tauri/`、`src/shared/` 或全局布局的任务必须谨慎拆分。
- 分支和 worktree 命名遵循 `git-workflow` 与 `multi-agent-orchestration`：分支名写任务语义，worktree 路径可写本地执行来源前缀。

## PDF Expert 复刻启动门禁

任何涉及 L2–L6、Toolbar、AppShell、Sidebar、RightPanel、EditModeGridView 或模式切换的 Agent，开工前必须按顺序读取：

1. `docs/TASKS.md` 的“当前唯一推进序列”和 ISS-NEW-M；
2. `docs/reference/pdf-expert/README.md`；
3. `docs/reference/pdf-expert/acceptance-contract.md`；
4. `docs/reference/pdf-expert/manifest.json`、目标 capture 和 `state-matrix.md`；
5. `docs/reference/pdf-expert/implementation-map.md`；
6. `docs/DESIGN.md` 与 `docs/ARCHITECTURE.md`。

硬约束：

- `research/pdf-expert/` 是被忽略的历史采集区，不是 worker 可依赖的规范源。
- `captures/raw/` 不是 golden；当前 accepted-golden 数量以 manifest 为准。
- 文件名、历史 TASKS/DEC/CHANGELOG 和截图画面冲突时，以经过观察校准的 manifest 与验收合同为准。
- 固定列数、精确宽度、颜色、字号、间距和交互不得从 raw capture 猜测。
- `skeleton`、`wired`、`behavior-complete`、`visually-verified` 必须分开记录；只有最后一级可以关闭高保真 UI 任务。
- 发现规范冲突时停止业务实现，先更新 `docs/TASKS.md` 并由 PM 决定是否补采或修订规范。

## Skill 强制调用

FaroPDF 的协作依赖 `.claude/skills/` 下的 Skill 统一协议、门禁和工作流规范。下面场景必须先调用对应 Skill 再行动，避免漏掉协议、提交门禁或交接约束：

| 触发场景 | 必须先调用 | 调用的理由 |
| --- | --- | --- |
| git 提交、批量提交、commit message 拆分与归并 | `git-batch-commit` | 拆分粒度、commit 格式、PR 编号后缀由该 Skill 统一 |
| 分支创建、PR、merge、worktree 切换、push 前安全检查 | `git-workflow` | 安全门禁、Monorepo 目录级 checkout、fail-closed 合并条件 |
| 多 Agent / subagent / worktree 并行 / 跨会话交接 | `multi-agent-orchestration`、`cross-agent-coordination` | worker 文件范围边界、PM 派工、跨平台归属与交接 |
| `docs/TASKS.md` 任务领取、状态更新、归档迁移 | `cross-agent-coordination` | 任务状态机、归属和归档入口由该 Skill 管理 |
| 发布与版本变更 | `release-workflow` | 版本号、CHANGELOG 与发版流程 |
| 文档膨胀 / 归档不一致 / PR 创建后 / PR 合并后 | `doc-curator` | 文档瘦身 subagent 跑体检，必要时自动提 maintenance PR；post-action 触发，不阻断 PR |
| PDF Expert 规范化重采、截图状态矩阵、bbox/量测与 S4 反向验证 | `computer-use`、`feature-extract-from-screenshots` | 采集可复现性、证据等级、状态覆盖和独立漏项审计由两项 Skill 共同约束 |

通用原则：

- 凡是「看起来可能要调用某个 Skill」的场景（即使只有 1% 概率），先调用再决定是否沿用。
- Skill 加载后必须按其清单和门禁执行，不允许「看个大概就跳过」。
- 触发表随项目 Skill 增删同步更新；新增 Skill 时必须在本节追加触发场景。

## 多 Agent 并行与 PR 收口纪律

开多 Agent session / worker 并行时，PM 必须按以下硬约束执行。违反任一条都视为协议违反，需 git revert 链或开 maintenance PR 修复，**不能直接 commit 修复**。

### 1. 双层监测（防 silent done）

worker spawn 后 PM **必须同时挂两层监测**，不能只挂 sentinel：

- **① sentinel**（`multi-agent-orchestration` skill `scripts/sentinel.sh`，`run_in_background=true`）：worker 写 STATUS `done` 时 exit → harness 唤醒 PM。事件驱动的快路径。
- **② 定时巡检**（`scripts/pm-monitor.sh --log-file` 或 PM 主动 `bash` 循环 ~15 min 一次）：检测 **silent done**——判据：tmux pane 回到 `❯` 就绪态 + worktree 已有 commit + 无 STATUS.json（或 STATUS 无 `done`）→ worker 完成了业务但跳过 STATUS / RESULT 协议，PM 主动收口（读 diff + pane 自述 + 验证 + 合并）。

**原因**：worker 进程在不同 provider / 负载下指令遵循会波动——同 prompt 下有的写 STATUS、有的跳过（实测 2026-06-21 W1 ISS-NEW-A 撞 pre-existing vitest 环境问题时 STATUS 延迟更新）。只挂 sentinel 会漏掉 silent done，直到用户来问才发现。

### 2. 收窄 envelope 不默认 lean

worker spawn 默认带完整上下文（AGENTS.md / DESIGN.md / `docs/TASKS.md` 对应 Issue / `docs/DECISIONS.md` 已关闭 DEC 摘要 / 必读素材），不默认 `disableBundledSkills + 空 MCP` 的 lean 配方。lean 仅在 worker 真 autocompact thrash 时临时用，用完恢复完整上下文。

### 3. PR 第一动作（worker 完成后 PM 第一动作 = 建 PR）

worker 提交 commit 后，PM 第一动作是 **`gh pr create`**，**不是** `git merge --ff-only` 到 main、不是直接 commit docs 到 main、不是先推 local main 再 cherry-pick。任何形式的"绕过 PR 收口"都视为协议违反。

PR 正文必须列：

- 覆盖的 Issue ID（`ISS-NEW-A` 等）
- 变更摘要（files / +/- 行数）
- 验证方式（typecheck / test / lint / build / cargo check 实际结果）
- 来源材料（`docs/TASKS.md` 对应章节、`docs/DECISIONS.md` 引用 DEC 编号）
- 已更新的协作文档（CHANGELOG / DECISIONS / TASKS / ROADMAP）
- Agent Attribution（Worker backend + provider slot + commit SHA）
- 仍需人工确认的风险（pre-existing test 失败 / 类型约束变更 / 共享契约 race 等）

PM 跑 `gh pr view --json mergeable,mergeStateStatus,baseRefOid,headRefOid` 做收口检查；merge 由用户 review 后执行。

### 4. 范围控制（worker 不顺手扩大改动）

Worker 只处理分配给自己的 Issue / 分组。执行中发现新缺陷、依赖或技术债时：

- 先记到 `docs/TASKS.md` 新 Issue 卡（不在本 PR 范围）
- 除非阻塞当前任务或用户明确要求，**不**顺手扩大本 PR 改动范围
- 范围扩大判定：commit 修改文件超出 spawn prompt 列出的 allowed files 列表时，PM 应在 commit 后 review 阶段发现并要求 worker 拆 PR

PM 自己也要遵守：本会话内新增文件 / 改 docs / 修 build 脚本等"顺手动作"也要走文档闭环（TASKS / DECISIONS / CHANGELOG），不能游离在 worker PR 之外直接 commit 到 main。

**关联**：本节由 DEC-145 落地，2026-06-21 Wave 1 W1 (ISS-NEW-A 阶段 1) 协议违反后补强。

## 完成标准

1. 功能或文档变更已完整落地。
2. 有明确验证方式，且验证结果写入最终回复。
3. 相关文档已同步更新。
4. 不存在已知阻塞问题。
5. 来源于 `docs/TASKS.md` 的任务已更新状态或归档。
6. 涉及 UI 时已确认符合 `docs/DESIGN.md`。

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run tauri dev
npm run tauri build
cd src-tauri && cargo check
```
