# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。已完成的 ISS 任务卡归档到 `docs/DECISIONS.md` 的「ISS 任务归档」一节。

## 推进策略

`docs/TASKS.md` 是 FaroPDF 的活跃任务入口：当前正在推进、待开工或暂缓的任务保留详细任务卡；已经完成或第一版已合并的任务迁移到 `docs/DECISIONS.md` 的「ISS 任务归档」，TASKS.md 本身保持精简。

### 基础状态门槛

满足以下条件后，才进入多 worktree 并行：

- Tauri v2 + React + TypeScript + Vite 应用可启动。
- `typecheck`、测试、构建命令可运行。
- PDF 阅读器主工具栏、按需左侧工具区、上下文工具条、页面管理工作台、状态栏和设置入口存在。
- `PdfDocumentState`、`PdfPageViewport`、`PdfAnnotation`、`PdfPageOperation`、`PdfExportJob`、`OcrProviderConfig`、`OcrJob`、`AppSettings` 等共享契约已落盘。
- `src/modules/` 下 reader、search、annotation、pages、export、ocr、forms、settings 模块边界已建立。
- worker 文件范围和验证命令已写入对应任务。

### 并行执行 + Worktree 分组

分支命名、worktree 路径、worker 范围隔离、PM 收口流程、Wave 调度规则等**通用规范全部见 `multi-agent-orchestration` skill**（项目级 `.claude/skills/multi-agent-orchestration/SKILL.md`）的 §3 标准流程 / §3.1 Wave-Based / §4 命名规则 / §8 收口。本文件不再重复表述，避免上下文冗余。

FaroPDF 特定的额外约束（不在 skill 里、必须保留）：

- `package.json`、锁文件、`src-tauri/`、`src/shared/`、`src/App.tsx`、全局样式和路由由 foundation 或 PM 统一收口（不随意散到各 worker）。
- 不得把 Agent skill CLI 流程原样变成 UI 逻辑；脚本只能作为算法来源、后台 bridge 或 sidecar 参考。

历史上已合并的合并组（v0.1 阶段）：

- `feat/foundation-scaffold`：ISS-001、ISS-011、ISS-012（已合并到 main）
- `feat/pdf-output-tools`：ISS-005、ISS-013
- `feat/ocr-pipeline`：ISS-007、ISS-016、ISS-017
- `feat/page-organizer-suite`：ISS-006、ISS-018、ISS-019
- `feat/app-distribution`：ISS-021
- `feat/settings-page`：ISS-022、ISS-023

## 活跃任务

### ISS-028 杨卫薪律师个人主页 + 两产品展示（Folia / FaroPDF）

- 优先级：P1
- 类型：项目卫生（chore / 文档 + 营销）
- 状态：待 PM 启动（brainstorm + design，**本 ISS 任务卡**仅登记框架，**不**绑定实现）
- 建议分支：TBD（启动时由 PM 与 brainstorming 决定）
- 建议 worktree：TBD
- 依赖：无
- 范围：独立仓库（建议 `cat-xierluo/personal-site` 或同 owner 下 monorepo 路径） + Folia / FaroPDF README §"官方仓库" 加主页入口（如 `https://cat-xierluo.github.io/`） + 可选 `description` / `homepage` 字段更新
- 目标：杨卫薪律师个人主页，展示 Folia / FaroPDF 两个产品，作为作者对外的「官方门面」+ 项目入口聚合点。技术方向待定（Astro / Vite + React / 纯静态 HTML / GitHub Pages 自定义域）。
- 验收：TBD（启动 brainstorming 时与 PM 确认）
- 关联：DEC-054 §4「后续路径」登记项；与 Folia 同作者的「个人品牌 + 多个产品」聚合页需求
- 关键决策（待 brainstorm 时确认）：
  - 仓库位置：独立 repo / monorepo 子目录 / GitHub Pages
  - 域名：`https://cat-xierluo.github.io/`（默认）或自定义
  - 框架：Astro（与 Folia `website/` 一致）/ Vite + React（与 Folia / FaroPDF 一致）/ 纯静态
  - 内容板块：bio / 工作领域 / 产品列表 / 联系方式 / 公众号（与 Folia README / AuthorCard 数据打通）/ 中英文切换
  - 与 Folia `website/` 子目录的关系：迁出独立仓库 / 保留子目录但主页独立 / 二者并行
- 2026-06-05：登记 ISS-028 任务卡（DEC-054 §4 后续路径触发）。**当前分支 `chore/add-license-and-author` 不实现本 ISS**；启动时由 PM 开 brainstorming，按 ISS-007 / ISS-026 模式拆 worker 推进。
- 下一步：brainstorming（确认仓库位置 / 域名 / 框架 / 内容板块 / 与现有 Folia website 关系）→ 新分支 → 落地。

## 暂缓任务

### ISS-015 直接编辑 PDF 原有文字、图片和链接

- 优先级：P2
- 类型：高级编辑
- 状态：暂缓
- 建议分支：`research/pdf-direct-editing`
- 建议 worktree：`.claude/worktrees/tmux-pdf-direct-editing`
- 依赖：ISS-005
- 范围：`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、技术调研材料
- 目标：调研 PDF Expert 类直接编辑文字、图片、链接和对象的实现成本，以及是否需要商业 SDK、Rust 后端或其他 PDF 引擎。
- 验收：形成技术取舍记录；不在 v0.1 阻塞阅读、批注、OCR、页面整理和导出工具。

### ISS-025 Agent 集成（Q&A 抽屉 + OCR 后处理 + 跨卷宗分析）

- 优先级：P2
- 类型：Agent / 工程
- 状态：暂缓（v0.3 不进入关键路径；设计已归档到 `docs/plans/2026-06-03-agent-integration-design.md`）
- 建议分支：`feat/agent-integration`
- 建议 worktree：`.claude/worktrees/tmux-agent-integration`
- 依赖：ISS-007、ISS-009、ISS-021、ISS-022
- 范围（预留）：`src/modules/agent/`、`src/shared/agent/`、`src-tauri/src/agent/`、`src/components/agent/AgentDrawer.tsx`、设置页 Agent section
- 目标：把本机 Claude Code CLI 作为 sidecar 一次性 spawn，提供 PDF 问答 / 摘要、OCR 后处理 / 文字层修正、跨文档案卷分析 / 证据链整理三类能力；批注在左、agent 抽屉在右，遵循 PDF Expert 风格无常驻 Inspector；走全局开关 consent。
- 回归条件：ISS-007 真实双层 PDF 落地、ISS-013 真实压缩落地、ISS-022 设置浮层合并，或 v0.3 整体收口。
- 不在 v0.3 实施；后续回到这个方向时从设计文档 §6 / §7 / §8 切入。

## 归档任务索引

已合并到 main 或第一版已发布的功能，详细任务卡归档在 `docs/DECISIONS.md` 的「ISS 任务归档」一节。索引按领域分组：

- **工程基础**：ISS-001、ISS-011、ISS-012
- **阅读核心**：ISS-002
- **检索**：ISS-003
- **批注**：ISS-004
- **导出 / 法律材料**：ISS-005、ISS-013
- **页面管理 / 证据材料**：ISS-006、ISS-018
- **OCR / 质量**：ISS-007（含 E2E 联调 worker）、ISS-010、ISS-017
- **扫描预处理**：ISS-016
- **设置 / OCR Provider**：ISS-014、ISS-022、ISS-024（doc-curator 部署）
- **表单 / 签署**：ISS-008
- **设计系统 / UI 整合**：ISS-009、ISS-023
- **批注深化**：ISS-026
- **发布 / 工程**：ISS-021、ISS-027
- **法律材料整理**：ISS-019
- **品牌 / UI**：ISS-020、ISS-029
- **跨仓协调**：personal-site `ISS-005`（Folio 仓 PR-A / FaroPDF 仓 PR-B 联动，FaroPDF 仓侧见 DEC-058 docs-only 同步）

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

- 2026-06-06：ISS-013 法院上传压缩预设 4 档 + 真实 JPEG 图像重编码（DEC-069 / `feat/iss-013-court-compression-presets`）：4 档 court preset（5MB/10MB/20MB/50MB）+ Canvas API JPEG DCTDecode 重编码 + 目标体积验证 + 保守路径（CMYK/FlateDecode/其他 Filter 保留原图）。
- 2026-06-05：ISS-029 落地（fix/iss-029-faropdf-real-qr，资源替换 + AuthorCard 注释 + QRCODE_LICENSE.md 改写 + docs 同步）。
- 2026-06-05：封箱 0.1.0-alpha.18（release/0.1.0-alpha.18，DEC-063）：合并 4 条 Unreleased 条目为 `## 0.1.0-alpha.18 - 2026-06-05` 段 + `package.json` / `src-tauri/tauri.conf.json` 版本号 bump 到 `0.1.0-alpha.18` + ROADMAP v0.1 状态从「待开始」改为「进行中（alpha.0~18 已封箱）」+ release.yml tag pattern 从 `v*.*.*` 扩到 `["v*.*.*", "v*.*.*-*"]` 让 prerelease 也能触发 CI；详见 DEC-063。是否实际打 `v0.1.0-alpha.18` tag 触发 release.yml 由 PM 在 PR 合并后决定（占位 pubkey 不打 tag；PM 重新生成 keypair 替换 + 配 GitHub Secrets 后再打 tag）。








