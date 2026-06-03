# FaroPDF Agent 集成设计草案

- 日期：2026-06-03
- 状态：草案 / 暂缓
- 关联决策：DEC-027（v0.3 优先基础 PDF / PaddleOCR / 倾斜矫正 / 压缩，agent 集成延后）

> 本文件是 2026-06-03 brainstorming 的产物，仅作为后续回到 agent 方向时的设计上下文。当前 v0.1 / v0.3 不实施。

## 1. 使用场景

已通过 brainstorming 锁定的三个方向：

- **PDF 问答 / 摘要**：用户在阅读中提问，agent 基于当前 PDF（或全卷）回答、总结、抽取要点。
- **OCR 后处理 / 文字层修正**：OCR 后的文字交给 agent 校错、补全、规范化输出；与 ISS-007 OCR bridge 衔接。
- **跨文档案卷分析 / 证据链整理**：跨多个 PDF 抽取关键事实、争议焦点、证据链。

未选：智能批注 / 高亮建议。

## 2. 信任与部署

- **执行位置**：复用本机 Claude Code CLI（`claude`）作为 sidecar 子进程；用户已有的 Claude 凭证和 `~/.claude/skills/` 自动可用。
- **数据传输**：CLI 内部仍走 Anthropic 云端 API，案件材料经用户 Claude 账号发出；本地 spawn 不等于本地推理。

## 3. 接线模式

- 一次性 spawn：每次调用 Tauri 后端 `claude -p --output-format stream-json` 起一个子进程，stdin 写 prompt、stdout 读流式事件，进程退出。
- 多轮聊天由前端 AgentDrawer 维护消息历史，每次把历史拼回 prompt 顶部。
- 不引入长期 sidecar、不引入 MCP 桥接。
- v0 起步只接 `claude -p`，后续如有需要再升级。

## 4. Consent 模型

- 设置页加一个全局开关 `agent.enableAgent`（Settings → 实验性 / Agent section）。
- 开关关闭时所有 agent Tauri command 直接拒答，不 spawn 进程；audit log 仍记录拒绝事件。
- 不做「每次询问」或「文档级白名单」颗粒度的弹窗（v0 简化为全局开关）。

## 5. UI 表面

- **Q&A 聊天**：右侧抽屉 `AgentDrawer`，点击主工具栏按钮滑出，Esc 关闭。批注在左、agent 在右，互不冲突。
- **OCR 后处理**：OCR 模式上下文条新增「用 agent 校 OCR 文本」按钮，结果在 `AgentDrawer` 或独立结果区显示。
- **跨卷宗分析**：独立全屏工作台（独立 mode），v0 只搭命令骨架和占位 UI。
- 抽屉与现有右侧 area 不冲突：批注侧栏在左，agent 抽屉在右，遵循 PDF Expert 风格的无常驻 Inspector 原则。

## 6. 架构

```text
┌─────────────────────────────── FaroPDF Tauri App ───────────────────────────────┐
│ React Frontend                                                                       │
│  ├─ 右侧抽屉 AgentDrawer（Q&A 流式聊天）                                            │
│  ├─ OCR 模式上下文条「用 agent 校 OCR 文本」按钮  →  等 ISS-007 接入                  │
│  ├─ 跨卷宗分析入口（独立全屏工作台，先搭 stub）                                      │
│  └─ Settings → 实验性 / Agent 段：全局开关 + 状态显示                                │
│ Tauri commands (Rust)                                                                │
│  ├─ agent_run_one_shot(prompt, context, on_event)  → spawn `claude -p ...`          │
│  ├─ agent_post_ocr_correct(ocrJobId)              → 复用 one_shot，专门 prompt       │
│  └─ agent_analyze_corpus(corpusId)                → 复用 one_shot，corpusId 接材料   │
│ Settings / Audit                                                                      │
│  └─ agent.enableAgent 全局开关；本地 audit log 记录 timestamp/PDF hash/byte/duration │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                  本机 `claude -p --output-format stream-json` 子进程
                  （复用本机 Claude Code 凭证和 ~/.claude/skills/）
```

关键约束：

- 每次调用独立 spawn 进程，状态在调用之间不保留。
- Agent 永远跑在前端不阻塞的位置：Tauri 用 tokio::task 起 spawn，主线程 emit `agent://event` 事件，前端订阅并流式渲染。
- 开关关闭时所有 Tauri command 直接拒答，不 spawn 进程；audit log 仍记录拒绝事件。
- 跨卷宗分析第一版只搭命令骨架和占位 UI，Q&A 抽屉 + OCR 后处理先行。

## 7. 组件与契约

### 7.1 Tauri command（Rust）

```rust
#[tauri::command]
async fn agent_run_one_shot(
    request: AgentRequest,
    on_event: tauri::State<'_, AppHandle>,
) -> Result<AgentSummary, AgentError>;
```

- `AgentRequest { kind, prompt, context, history }`，`kind ∈ { ChatQA, OcrPostCorrect, CorpusAnalyze }`。
- `on_event` 用 `app.emit("agent://event", payload)` 推流式 `stream-json` 事件（`text_delta` / `tool_use` / `result` / `error`）。
- `AgentSummary { ok, byteSent, durationMs, outputPath? }` 在调用结束时一次性回传，用于 audit。
- `enableAgent == false` 时 command 直接 `Err(AgentError::Disabled)`，不 spawn。

### 7.2 前端组件（React）

- `AgentDrawer`：右侧抽屉，受 `AppSettings.agent.enableAgent` 控制可用性；维护本地消息列表 `[AgentMessage]`。
- `useAgentStream` hook：包装 Tauri event 订阅，吐出 `text` 增量 / `done` / `error` 状态。
- `agentPromptBuilder` 纯函数：根据 `kind` + `history` + 当前 PDF 上下文拼出 system + user 段，每次 prompt 重新生成。

### 7.3 Settings 与共享契约

- 在 `AppSettings` 增加 `agent: { enableAgent: boolean; defaultModel?: string }`，放在设置页「实验性 / Agent」section（依赖 ISS-022 设置浮层落地）。
- `src/shared/agent/` 新增 `types.ts`（`AgentRequest` / `AgentMessage` / `AgentEvent` / `AgentSummary`）和 `consent.ts`（consent guard，沿用 ISS-010 的 `sanitize*` 思路）。
- `src-tauri/src/agent/` 新增 `runner.rs`（spawn + 解析 stream-json）、`audit.rs`（写 `audit.log` 到 app data 目录）。

## 8. Prompt 与上下文

- 上下文加载策略（Q&A 场景）：v0 传全文 + 当前页定位（page anchor）；后续如 token 成本高，再考虑 top-K 段落检索。
- OCR 后处理 prompt：固定 system 段（角色 + 修正原则 + 输出格式 JSON 化），user 段附 OCR 文本 + 关键词清单。
- 跨卷宗分析：把 corpus 内的 PDF 文本按文档分块，用一个 `corpusId` 把多份 PDF 路径 / hash / 元数据传给 agent，prompt 模板要求输出结构化分析。

## 9. Audit 与错误处理

- 本地 audit log：写到 app data 目录，schema `{ timestamp, kind, pdfHash, byteSent, durationMs, ok, errorCode? }`，**不记录 prompt / 输出内容**，符合 DEC-005「原始材料默认不可变 / 不外带」原则。
- 错误码：`Disabled` / `SpawnFailed` / `NonZeroExit` / `Timeout` / `ParseError` / `ApiError`（CLI 返回非零且 stderr 含可识别 pattern）。
- 用户视角：失败时 drawer 显示「agent 调用失败，可查看 console 日志」+ 设置页状态显示连续失败次数。

## 10. 落地与测试（暂缓，等回到 agent 方向时启动）

- 依赖：ISS-021（设置浮层 + agent 开关位）、ISS-007（OCR bridge，OCR 后处理接入点）、ISS-009（设计系统落地）。
- 第一版可分四块（实际 ISS 编号在回到本方向时按 `docs/TASKS.md` 当时空位顺序分配，不预先占用）：
  1. **Agent bridge**：Tauri 端 `agent_run_one_shot`、stream-json 解析、audit log 写入。
  2. **Agent Q&A 抽屉**：React 端 `AgentDrawer` + `useAgentStream`，与 ISS-022 设置浮层同 worktree。
  3. **Agent 设置 + OCR 后处理**：开关位 + OCR 后处理 prompt 模板，与 ISS-007 衔接。
  4. **跨卷宗分析模式**：corpus 工作台入口与命令骨架，Q&A 稳定后再做。
- 测试：
  - Tauri command 单测：mock `claude` 子进程输出，验证 stream-json 解析和事件 emit。
  - `agentPromptBuilder` 单测：覆盖 ChatQA / OcrPostCorrect / CorpusAnalyze 三类 prompt 模板。
  - 前端 `AgentDrawer` 单测：消息列表、流式 text 增量拼接、错误态、enableAgent 关闭态。
  - 集成测试：用一个真实 PDF + mock CLI，验证整链路可拉到 answer。

## 11. 暂缓与回归条件

- 暂缓原因：v0.3 优先基础 PDF 功能、PaddleOCR 双层 PDF、倾斜矫正、压缩；agent 集成不是初版关键路径。
- 回归条件（满足任一即重启 agent 方向）：
  - ISS-007 OCR 真实双层 PDF 落地，OCR 后处理有真实输入。
  - ISS-013 真实压缩与水印 / Bates 落地，跨卷宗分析有真实工作流需求。
  - v0.3 设置浮层（ISS-022）合并。
- 重新启动时，从本文档 §6 / §7 / §8 切入；如有 API 变更或 CLI 行为变更，先更新本文档再实施。
