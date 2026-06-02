# FaroPDF 决策记录

## DEC-001 项目命名为 FaroPDF

- 日期：2026-06-02
- 状态：已采纳

项目展示名使用 `FaroPDF`，目录名使用 `faropdf`。`Faro` 有灯塔、指引的含义，符合在厚卷宗和复杂证据材料中快速定位重点的产品寓意。

## DEC-002 单开独立项目，不并入 Folia

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 是独立 PDF 阅读器，不作为 Folia 的内部 PDF 模块。原因：

- PDF 阅读器的交互模型不同于 Markdown 编辑器。
- PDF.js、批注、OCR、页面整理和二进制导出会显著增加 Folia 重量。
- 法律 PDF 工作流需要独立路线图和发布节奏。

Folia 继续聚焦 Markdown 阅读、编辑和 Word/HTML 导出。FaroPDF 后续可共享设计经验，但不共享主应用代码。

## DEC-003 技术选型采用 Tauri + React + PDF.js + pdf-lib

- 日期：2026-06-02
- 状态：已采纳

首版技术方向：

- 桌面壳：Tauri v2。
- 前端：React + TypeScript + Vite。
- PDF 渲染：PDF.js，负责页面渲染、文本层、目录、缩略图和搜索基础。
- PDF 页面操作与导出：pdf-lib，负责页面复制、删除、重排、表单填写、元数据和保存。
- OCR：通过 bridge 调用本地 Legal Skills / `ocrmypdf`，并预留 PaddleOCR / MinerU。

关键约束：

- PDF.js worker 必须独立加载。
- 阅读区采用页面虚拟化，只渲染可见页和邻近页。
- OCR 不进入前端主线程，不阻塞打开文档。

## DEC-004 v0.1 直接做完整基础版

- 日期：2026-06-02
- 状态：已采纳

用户明确希望第一版就包含基础阅读器应有能力，而不是只做快读底座。因此 v0.1 覆盖：

- 快读与检索。
- 批注与批注摘要。
- OCR/扫描件双层 PDF。
- 页面整理、合并、提取和页码/Bates 编号。
- 表单填写与签署。

实现顺序仍按底座优先推进：先阅读和文本层，再批注、导出、OCR、页面整理和表单。

## DEC-005 原始 PDF 默认不可变

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 默认不覆盖用户打开的原始 PDF。批注、页面重排、OCR、压缩、解密、表单扁平化等操作默认输出新文件。需要覆盖时必须提供明确确认。

原因：

- 法律材料通常具有证据属性，原始文件完整性重要。
- 扫描件、判决、合同和证据材料可能需要保留原始版本。
- sidecar + 导出策略能同时保证可编辑和可交付。

## DEC-006 使用 project-init 完成项目上下文初始化

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 按 `/Users/maoking/Library/Application Support/maoscripts/skills/legal-skills/skills/project-init` 进行项目初始化校准。当前目录尚未 scaffold 代码，`project-init` 检测不到 `package.json`、`pyproject.toml` 等工程指示文件，因此使用默认 `development` profile。

本次初始化补齐：

- `CLAUDE.md`：Claude Code 项目上下文。
- `.claude/settings.json`：Claude Code 权限模板。
- `.gitignore`：通用开发项目忽略规则。
- `.claude/skills/`：开发协作 skills 符号链接。

已有的 `README.md`、`AGENTS.md`、`CHANGELOG.md` 和 `docs/` 文档保留，不覆盖。

## DEC-007 GitHub 私有仓库命名为 FaroPDF

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 初始化为 Git 仓库，并推送到 GitHub 私有仓库 `FaroPDF`。仓库名称保持与本地项目文件夹大小写一致，便于后续 worktree、多 Agent 分支和发布流程保持统一命名。

`.claude/skills/` 是本机 `legal-skills` 的绝对路径符号链接，不纳入版本库；项目级协作说明保留在 `AGENTS.md`、`CLAUDE.md` 和 `docs/` 文档中。

## 工作日志

- 2026-06-02：初始化项目上下文，固定名称、独立项目形态、首版范围、技术选型和安全边界。
- 2026-06-02：按 `project-init` skill 校准上下文初始化，补齐 Claude Code 配置和本地开发协作 skills。
- 2026-06-02：初始化 Git 仓库并准备推送到 GitHub 私有仓库 `FaroPDF`，本机 skill 符号链接不纳入版本库。
