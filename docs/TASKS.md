# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。已完成的 ISS 任务卡归档到 `docs/DECISIONS.md` 的「ISS 任务归档」一节。

## 推进策略

`docs/TASKS.md` 是 FaroPDF 的活跃任务入口：当前正在推进、待开工或暂缓的任务保留详细任务卡；已经完成或第一版已合并的任务迁移到 `docs/DECISIONS.md` 的「ISS 任务归档」，TASKS.md 本身保持精简。

FaroPDF v0.1 先到达一个可并行开发的基础状态，再用多分支、多 worktree 推进完整基础版功能。

基础状态完成前，优先只在 `main` 或单一 foundation 分支推进，避免多个 worker 同时修改脚手架、依赖、Tauri 配置和共享类型。基础状态完成后，各 worker 从最新 `main` 创建独立分支和 worktree，按本文件声明的范围修改文件。

Agent 可根据本文件自行判断：

- 哪些素材可以晋升为正式 ISS 任务。
- 哪些 ISS 可以合并到同一个 worktree 分支顺序推进。
- 哪些任务必须拆成独立 worktree，避免共享文件冲突。
- 哪些任务仍只是素材或调研，不应立即开工。

### 基础状态门槛

满足以下条件后，才进入多 worktree 并行：

- Tauri v2 + React + TypeScript + Vite 应用可启动。
- `typecheck`、测试、构建命令可运行。
- PDF 阅读器主工具栏、按需左侧工具区、上下文工具条、页面管理工作台、状态栏和设置入口存在。
- `PdfDocumentState`、`PdfPageViewport`、`PdfAnnotation`、`PdfPageOperation`、`PdfExportJob`、`OcrProviderConfig`、`OcrJob`、`AppSettings` 等共享契约已落盘。
- `src/modules/` 下 reader、search、annotation、pages、export、ocr、forms、settings 模块边界已建立。
- worker 文件范围和验证命令已写入对应任务。

### 并行执行规则

- 分支名使用任务语义，例如 `feat/reader-core`，不要带 `tmux-`、`team-`、`subagent-` 前缀。
- worktree 路径使用本地执行来源前缀，例如 `.claude/worktrees/tmux-reader-core`。
- 每个 worker 默认只修改自己任务的 `范围` 文件；需要改共享契约时先回到 PM 会话确认。
- `package.json`、锁文件、`src-tauri/`、`src/shared/`、`src/App.tsx`、全局样式和路由由 foundation 或 PM 统一收口。
- worker 完成后提交、推送并创建 PR；PM 检查 diff 范围、验证结果和文档同步后再合并。
- 不得把 Agent skill CLI 流程原样变成 UI 逻辑；脚本只能作为算法来源、后台 bridge 或 sidecar 参考。

### Worktree 分组原则

同一 worktree 分支可以包含多个 ISS，但必须满足：

- 文件范围高度重合，且不会和其他 worker 争抢 `package.json`、锁文件、`src-tauri/`、`src/shared/` 或全局布局。
- 任务存在明确依赖顺序，放在同一分支能减少重复改动。
- 验收命令一致，且最终 PR 能清楚说明覆盖的 ISS。

建议合并组：

- `feat/foundation-scaffold`：ISS-001、ISS-011、ISS-012（已合并到 main）。
- `feat/pdf-output-tools`：ISS-005、ISS-013，可在导出引擎稳定后合并推进。
- `feat/ocr-pipeline`：ISS-007、ISS-016、ISS-017，可在设置页和文本层完成后合并推进。
- `feat/page-organizer-suite`：ISS-006、ISS-018、ISS-019，可在阅读底座和导出引擎完成后合并推进。

## 活跃任务

### ISS-007 OCR bridge

- 优先级：P0
- 类型：OCR
- 状态：进行中（bridge/stub 第一版已完成，真实 OCR 待接入）
- 建议分支：`feat/ocr-bridge`
- 建议 worktree：`.claude/worktrees/tmux-ocr-bridge`
- 依赖：ISS-003、ISS-014
- 范围：`src/modules/ocr/`、`src/shared/ocr/`、`src-tauri/` OCR command、OCR 相关测试
- 参考算法：`pdf-processor/scripts/pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py`
- 目标：建立 OCR 任务模型，优先连接本地 Legal Skills / `ocrmypdf`，并支持 PaddleOCR、MinerU 等外部 OCR API adapter。
- 验收：纯扫描 PDF 可触发 OCR 任务；任务显示后端、页码范围、进度、输出路径和失败原因；生成双层 PDF 后能做搜索质量抽查；OCR 模式工具条至少覆盖识别文本、输出双层 PDF 和质量检查。
- 当前进度：已建立 OCR 请求、输出策略、任务进度、质量抽查入口等共享类型；新增 `ocrBridgeService` 和 provider adapter 边界，覆盖 `local-ocrmypdf`、`legal-skills`、`paddleocr`、`mineru`；Tauri `start_ocr_job` command stub 做参数校验、默认 `*-ocr.pdf` 新输出路径和同路径拒绝；云端 provider 未明确 consent、缺少安全 apiKeyRef、使用真实密钥串或远端明文 HTTP endpoint 时拒绝，本机调试只允许 `localhost`、真实 127.0.0.0/8 IPv4 和 `::1` loopback HTTP；OCR 错误脱敏覆盖带逗号或中文标点的 PDF 路径。当前不会执行真实 OCR、不会生成双层 PDF、不会发起联网请求，也不会做真实质量检查。
- 下一步：接入本地 `ocrmypdf` / Legal Skills 后台执行、PaddleOCR/MinerU API 凭证读取与调用、双层 PDF 生成、任务队列持久化、OCR 模式工具条和 ISS-017 质量检查报告。

### ISS-008 表单填写与签署

- 优先级：P1
- 类型：表单
- 状态：待处理
- 建议分支：`feat/forms-signing`
- 建议 worktree：`.claude/worktrees/tmux-forms-signing`
- 依赖：ISS-002、ISS-005
- 范围：`src/modules/forms/`、`src/shared/pdf/form*`、表单签署相关测试
- 目标：支持 AcroForm 字段识别、填写、签名图片、手写签名、日期、勾号、叉号、图章、图片和扁平化导出。
- 验收：常见 PDF 表单可填写并导出为不可编辑提交版；填写和签名模式工具条覆盖文本、签名、日期、勾号、叉号、图章、图片和导出为压平。

### ISS-009 设计系统落地

- 优先级：P0
- 类型：UI
- 状态：进行中（结构草案，未达到 UI 验收）
- 建议分支：`feat/pdf-expert-shell-ia`
- 建议 worktree：当前 checkout 已切到 `feat/pdf-expert-shell-ia`；后续如并行推进，再从最新 `main` 创建 `.claude/worktrees/tmux-pdf-expert-shell-ia`
- 依赖：ISS-012
- 范围：`src/components/`、`src/styles/`、`src/modules/*` 的视觉整合、`docs/DESIGN.md`
- 目标：按 `docs/DESIGN.md` 实现 PDF Expert 风格信息架构：中央阅读优先、左侧按需工具区、顶部搜索、模式上下文工具条和独立页面管理工作台。
- 验收：界面不复用 Folia 的 Markdown 编辑布局，不常驻右侧 Inspector；PDF 页面始终是主视觉；桌面和窄屏视口不出现文本重叠。
- 当前进度：已在 `feat/pdf-expert-shell-ia` 做出基础壳层重排，并补上 PDF Expert 风格空态、转换入口、最近文件占位、分组导出工具条、填写签名工具条、扫描/OCR 工具条和页面管理"另存为新 PDF"出口；已用 `/tmp/faropdf-ui-sample.pdf` 检查打开态、页面管理和导出工具条，并修正 900px 窄屏顶栏溢出。code review 后已修正无文档页面管理假页面、视图设置状态硬编码和窄屏搜索入口隐藏问题。但 UI 还未达到最终合并标准，必须继续做视觉密度、真实缩略图、搜索结果层、页面管理交互和真实文件态 polish。
- 下一步：继续推进阅读态真实 PDF 打开后的视觉 polish、搜索结果层、页面管理多选/撤销/风险提示，以及扫描/OCR 任务参数区；先补测试，再实现，最后用浏览器截图检查无重叠。
- 设计差距速查：见 `docs/DESIGN.md` 「当前设计差距」一节。

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

### ISS-021 批注深化（高亮/手写/图章）

- 优先级：P0
- 类型：批注
- 状态：进行中（几何/搜索/图章模板/工具条 model 与 Overlay/Toolbar UI 第一版已落地，导出引擎批注绘制与侧边栏筛选接入待后续）
- 建议分支：`feat/annotation-tools`
- 建议 worktree：`.claude/worktrees/tmux-annotation-tools`
- 依赖：ISS-002、ISS-004
- 范围：`src/modules/annotation/`、`src/components/layout/AnnotationOverlay.tsx`、`src/components/layout/AnnotationToolbar.tsx`、相关测试
- 目标：在批注 sidecar 基础上接入几何坐标、搜索过滤、图章 SVG 模板、工具条状态机和 PDF 页面之上的批注 overlay（点击/拖拽/手写三种交互）。
- 验收：批注模式上下文工具条可选择 9 种工具、6 色色板和 5 套图章模板（含自定义文字），Overlay 支持高亮/下划线/删除线/矩形/箭头拖拽、备注/文本框/图章点击、手写连续绘制；批注几何由 `geometry` 统一规整并允许在 viewport 内钳制；批注搜索按页码/类型/颜色/关键词四类过滤组合；图章 SVG 由模板渲染并按 4:1 viewBox 缩放。
- 当前进度：已在 `feat/annotation-tools` 落地 geometry（normalizeRect、pointsToRect、unionRects、inkStrokesToRect、lineToRect、recomputeLineRects、recomputeInkRects、sanitizeRects、isRectWithinBounds、clampRectToBounds、annotationBoundingRect）、search（collectAnnotationSearchHaystack、matchesQuery/matchesPageFilter/matchesTypeFilter/matchesColorFilter、searchAnnotations 与默认空白选项）、stamps（5 套模板 STAMP_TEMPLATES/STAMP_TEMPLATE_LIST、resolveStampTemplate 兜底、renderStampSvg 输出 4:1 viewBox 矩形/圆角/椭圆/横幅 4 种 shape 的 SVG 子树）、toolbarModel（ANNOTATION_TOOL_LIST/ANNOTATION_TOOL_MAP、ANNOTATION_COLOR_SWATCHES、AnnotationToolState 与 armAnnotationTool/disarmAnnotationTool/setAnnotationColor/setAnnotationStampName/setAnnotationStampLabel reducer）。本次提交新增 AnnotationOverlay（点击/拖拽/手写 3 种交互、6 种批注 glyph 渲染、draft/preview 流）、AnnotationToolbar（9 工具按钮、6 色色板、stamp 子区段）和 11 项 toolbar 单元测试。
- 下一步：在 `AppShell` 把 Overlay 与 Toolbar 接入批注模式上下文；把搜索过滤接入侧边栏；把图章模板预览接入图章子区段；把 geometry/sidecar 串通到导出引擎做真实批注绘制。

## 归档任务索引

已合并到 main 或第一版已发布的功能，详细任务卡归档在 `docs/DECISIONS.md` 的「ISS 任务归档」一节。索引按领域分组：

- **工程基础**：ISS-001、ISS-011、ISS-012
- **阅读核心**：ISS-002
- **检索**：ISS-003
- **批注**：ISS-004、ISS-021
- **导出 / 法律材料**：ISS-005、ISS-013
- **页面管理 / 证据材料**：ISS-006、ISS-018
- **OCR / 质量**：ISS-010、ISS-017
- **扫描预处理**：ISS-016
- **设置 / OCR Provider**：ISS-014
- **法律材料整理**：ISS-019
- **品牌 / UI**：ISS-020

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

只保留最近 5 条；更早的条目在 `docs/DECISIONS.md` 工作日志。

- 2026-06-03：在 `feat/annotation-tools` 推进 ISS-021 批注深化第一版：补齐 AnnotationOverlay（点击/拖拽/手写 3 种交互、6 种批注 glyph 渲染、draft/preview 流）、AnnotationToolbar（9 工具按钮、6 色色板、stamp 子区段）和 11 项 toolbar 单元测试；后续接入 AppShell 与侧边栏筛选。
- 2026-06-03：在 `feat/reader-thumbnails` 推进 ISS-002 阅读深化第三步：`pdfReaderService` 暴露 `renderThumbnail`、Sidebar 接入 PDF.js 真实缩略图、`PdfPage` 用 IntersectionObserver 同步当前页；通过 PR #14 合并到 main。
- 2026-06-03：合并 `feat/ocr-quality`（ISS-017）和 `feat/evidence-image-pack`（ISS-018）到 `main`；ISS-017 质量检查报告和 ISS-018 A4 编排计划器第一版完成。
- 2026-06-03：从前一个到达上下文上限的 session 接手，创建 `docs/HANDOFF.md` 交接文件。
- 2026-06-03：合并 `feat/reader-canvas-render-clean` 和 `feat/annotation-sidebar-list` 的 canvas 渲染 + 批注侧边栏 UI 到 main；创建 PR #12 走正式合并流程；清理重复分支和 worktree。
