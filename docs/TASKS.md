# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。

## 推进策略

FaroPDF v0.1 先到达一个可并行开发的基础状态，再用多分支、多 worktree 推进完整基础版功能。

基础状态完成前，优先只在 `main` 或单一 foundation 分支推进，避免多个 worker 同时修改脚手架、依赖、Tauri 配置和共享类型。基础状态完成后，各 worker 从最新 `main` 创建独立分支和 worktree，按本文件声明的范围修改文件。

### 基础状态门槛

满足以下条件后，才进入多 worktree 并行：

- Tauri v2 + React + TypeScript + Vite 应用可启动。
- `typecheck`、测试、构建命令可运行。
- PDF 阅读器三栏 shell、工具栏、状态栏和设置入口存在。
- `PdfDocumentState`、`PdfPageViewport`、`PdfAnnotation`、`PdfPageOperation`、`PdfExportJob`、`OcrProviderConfig`、`OcrJob`、`AppSettings` 等共享契约已落盘。
- `src/modules/` 下 reader、search、annotation、pages、export、ocr、forms、settings 模块边界已建立。
- worker 文件范围和验证命令已写入对应任务。

### 并行执行规则

- 分支名使用任务语义，例如 `feat/reader-core`，不要带 `tmux-`、`team-`、`subagent-` 前缀。
- worktree 路径使用本地执行来源前缀，例如 `.claude/worktrees/tmux-reader-core`。
- 每个 worker 默认只修改自己任务的 `范围` 文件；需要改共享契约时先回到 PM 会话确认。
- `package.json`、锁文件、`src-tauri/`、`src/shared/`、`src/App.tsx`、全局样式和路由由 foundation 或 PM 统一收口。
- worker 完成后提交、推送并创建 PR；PM 检查 diff 范围、验证结果和文档同步后再合并。

## 基础状态任务

### ISS-001 初始化 Tauri 应用脚手架

- 优先级：P0
- 类型：工程基础
- 状态：待处理
- 建议分支：`feat/foundation-scaffold`
- 建议 worktree：`.claude/worktrees/tmux-foundation-scaffold`
- 依赖：无
- 范围：`package.json`、锁文件、`src-tauri/`、`src/` 基础入口、测试配置、构建配置、README 开发命令
- 目标：创建 Tauri v2 + React + TypeScript + Vite 应用，并补齐基础测试、类型检查、Lint 和构建脚本。
- 验收：本地可启动空壳应用，`typecheck`、测试和构建命令可运行。

### ISS-011 共享契约与模块边界

- 优先级：P0
- 类型：工程基础
- 状态：待处理
- 建议分支：`feat/shared-contracts`
- 建议 worktree：`.claude/worktrees/tmux-shared-contracts`
- 依赖：ISS-001
- 范围：`src/shared/`、`src/modules/*/README.md`、`docs/ARCHITECTURE.md`
- 目标：建立 PDF 文档、页面视口、批注、页面操作、导出任务、OCR provider、设置项和后台任务的共享类型与模块边界。
- 验收：各功能 worker 可只依赖共享契约开工；类型检查通过；架构文档同步记录核心接口。

### ISS-012 基础应用 Shell 与验证夹具

- 优先级：P0
- 类型：UI / 工程基础
- 状态：待处理
- 建议分支：`feat/app-shell-foundation`
- 建议 worktree：`.claude/worktrees/tmux-app-shell-foundation`
- 依赖：ISS-001、ISS-011
- 范围：`src/App.tsx`、`src/components/layout/`、`src/styles/`、`src/modules/settings/` 入口、`tests/fixtures/`
- 目标：建立三栏阅读布局、顶部工具栏、状态栏、右侧 Inspector、设置入口和测试用 PDF fixture 策略。
- 验收：空壳应用能展示阅读器布局；设置页可打开；测试 fixture 不包含敏感材料；符合 `docs/DESIGN.md` 的清亮阅读器方向。

## 并行功能任务

### ISS-002 PDF.js 快速阅读底座

- 优先级：P0
- 类型：阅读核心
- 状态：待处理
- 建议分支：`feat/reader-core`
- 建议 worktree：`.claude/worktrees/tmux-reader-core`
- 依赖：ISS-001、ISS-011、ISS-012
- 范围：`src/modules/reader/`、`src/shared/pdf/reader*`、阅读相关测试
- 目标：接入 PDF.js，支持打开本地 PDF、worker 渲染、页面虚拟化、缩放、页码跳转、连续阅读、单页和双页视图。
- 验收：几百页 PDF 打开后只渲染可见页附近；滚动和缩放不卡住主界面；阅读状态可被搜索、批注、页面整理模块复用。

### ISS-003 文本层检测与全文搜索

- 优先级：P0
- 类型：检索
- 状态：待处理
- 建议分支：`feat/text-search`
- 建议 worktree：`.claude/worktrees/tmux-text-search`
- 依赖：ISS-002、ISS-011
- 范围：`src/modules/search/`、`src/shared/pdf/text*`、搜索面板相关测试
- 目标：检测文字层，建立按需搜索索引，支持命中列表、当前页高亮、上下一个命中和扫描件 OCR 提示。
- 验收：可搜索 PDF 能稳定命中关键词；纯扫描 PDF 显示 OCR 提示；搜索索引不在打开文件时同步扫完整卷。

### ISS-004 批注 sidecar 模型

- 优先级：P0
- 类型：批注
- 状态：待处理
- 建议分支：`feat/annotations-sidecar`
- 建议 worktree：`.claude/worktrees/tmux-annotations-sidecar`
- 依赖：ISS-002、ISS-011
- 范围：`src/modules/annotation/`、`src/shared/pdf/annotation*`、批注相关测试
- 目标：建立 `PdfAnnotation` 模型和 sidecar 持久化策略，支持高亮、下划线、删除线、备注、文本框、形状、手写和图章。
- 验收：批注可新增、编辑、删除、列表展示、点击跳转，并能导出 Markdown 或 HTML 摘要。

### ISS-005 PDF 导出与批注扁平化

- 优先级：P0
- 类型：导出
- 状态：待处理
- 建议分支：`feat/pdf-export-engine`
- 建议 worktree：`.claude/worktrees/tmux-pdf-export-engine`
- 依赖：ISS-011、ISS-004
- 范围：`src/modules/export/`、`src/shared/pdf/export*`、pdf-lib 相关测试
- 目标：建立 `pdfOperationEngine` 抽象，用 pdf-lib 起步处理批注扁平化、表单扁平化、页面操作和新 PDF 导出。
- 验收：导出的 PDF 保留阅读批注和页面操作结果；原始 PDF 不变；后续可替换更强 PDF 引擎而不推翻 UI 层。

### ISS-006 页面整理工作台

- 优先级：P0
- 类型：页面管理
- 状态：待处理
- 建议分支：`feat/page-organizer`
- 建议 worktree：`.claude/worktrees/tmux-page-organizer`
- 依赖：ISS-002、ISS-005
- 范围：`src/modules/pages/`、`src/shared/pdf/pageOperation*`、页面整理相关测试
- 目标：支持旋转、删除、重排、插入、提取、合并、裁剪、拆分双页扫描和撤销。
- 验收：页面操作可预览、撤销，并默认另存为新 PDF，不覆盖原始文件。

### ISS-007 OCR bridge

- 优先级：P0
- 类型：OCR
- 状态：待处理
- 建议分支：`feat/ocr-bridge`
- 建议 worktree：`.claude/worktrees/tmux-ocr-bridge`
- 依赖：ISS-003、ISS-014
- 范围：`src/modules/ocr/`、`src/shared/ocr/`、`src-tauri/` OCR command、OCR 相关测试
- 目标：建立 OCR 任务模型，优先连接本地 Legal Skills / `ocrmypdf`，并支持 PaddleOCR、MinerU 等外部 OCR API adapter。
- 验收：纯扫描 PDF 可触发 OCR 任务；任务显示后端、页码范围、进度、输出路径和失败原因；生成双层 PDF 后能做搜索质量抽查。

### ISS-008 表单填写与签署

- 优先级：P1
- 类型：表单
- 状态：待处理
- 建议分支：`feat/forms-signing`
- 建议 worktree：`.claude/worktrees/tmux-forms-signing`
- 依赖：ISS-002、ISS-005
- 范围：`src/modules/forms/`、`src/shared/pdf/form*`、表单签署相关测试
- 目标：支持 AcroForm 字段识别、填写、签名图片、手写签名和扁平化导出。
- 验收：常见 PDF 表单可填写并导出为不可编辑提交版。

### ISS-009 设计系统落地

- 优先级：P0
- 类型：UI
- 状态：待处理
- 建议分支：`feat/design-system`
- 建议 worktree：`.claude/worktrees/tmux-design-system`
- 依赖：ISS-012
- 范围：`src/components/`、`src/styles/`、`src/modules/*` 的视觉整合、`docs/DESIGN.md`
- 目标：按 `docs/DESIGN.md` 实现清亮阅读布局、克制工具栏、左侧缩略图/目录、右侧搜索/批注/OCR/页面/表单面板。
- 验收：界面不复用 Folia 的 Markdown 编辑布局，PDF 页面始终是主视觉；桌面和窄屏视口不出现文本重叠。

### ISS-010 法律材料隐私与联网 OCR 提示

- 优先级：P0
- 类型：安全
- 状态：待处理
- 建议分支：`feat/privacy-safety`
- 建议 worktree：`.claude/worktrees/tmux-privacy-safety`
- 依赖：ISS-014、ISS-007
- 范围：`src/modules/settings/`、`src/modules/ocr/`、`src/shared/security/`、隐私提示相关测试
- 目标：联网 OCR 前提供明确提示，记录后端、文件范围、输出路径，不在日志中泄露敏感内容。
- 验收：任何云端 OCR 都需要用户主动确认；API Key 不写入版本库、日志或错误报告。

### ISS-013 水印、页码、Bates 编号与压缩

- 优先级：P0
- 类型：导出 / 法律材料
- 状态：待处理
- 建议分支：`feat/pdf-output-tools`
- 建议 worktree：`.claude/worktrees/tmux-pdf-output-tools`
- 依赖：ISS-005、ISS-006
- 范围：`src/modules/export/`、`src/modules/pages/`、`src/shared/pdf/outputTools*`、导出工具相关测试
- 目标：支持文字水印、图片水印、普通页码、Bates 编号和常用压缩预设。
- 验收：每个操作都提供预览或明确输出路径；默认另存为新 PDF；Bates 编号支持起始号、前后缀和位置选择。

### ISS-014 设置页与外部 OCR Provider 配置

- 优先级：P0
- 类型：设置 / OCR
- 状态：待处理
- 建议分支：`feat/settings-ocr-providers`
- 建议 worktree：`.claude/worktrees/tmux-settings-ocr-providers`
- 依赖：ISS-011、ISS-012
- 范围：`src/modules/settings/`、`src/shared/settings/`、`src-tauri/` 设置持久化 command、设置相关测试
- 目标：建立设置页，管理默认保存策略、最近文件、默认 OCR 后端、PaddleOCR/MinerU API 配置和联网处理确认策略。
- 验收：设置可持久化；API Key 以安全方式存储或留给系统凭证方案；UI 不展示完整密钥；未配置云端 OCR 时不会误触发联网请求。

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

## 进度日志

- 2026-06-02：完成项目上下文初始化，创建协作、路线图、任务、决策、架构和设计文档。
- 2026-06-02：按 `project-init` skill 补齐 `CLAUDE.md`、`.claude/settings.json`、`.gitignore`，并安装开发项目 profile 对应的本地协作 skills。
- 2026-06-02：初始化项目 Git 基线，推送到同名 GitHub private 仓库 `FaroPDF`。
- 2026-06-02：将 v0.1 拆分为 foundation gate 和多 worktree 并行任务包，补充设置页、外部 OCR provider、水印、压缩和直接编辑调研任务。
