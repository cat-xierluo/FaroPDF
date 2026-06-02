# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。

## 推进策略

`docs/TASKS.md` 是 FaroPDF 的唯一任务源。所有待办、缺陷、技术债、算法素材、候选议题和 worktree 分组建议都记录在本文件。其他文档只记录路线图、架构、设计和决策，不另建任务计划文档。

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

- `feat/foundation-scaffold`：ISS-001、ISS-011、ISS-012。
- `feat/pdf-output-tools`：ISS-005、ISS-013，可在导出引擎稳定后合并推进。
- `feat/ocr-pipeline`：ISS-007、ISS-016、ISS-017，可在设置页和文本层完成后合并推进。
- `feat/page-organizer-suite`：ISS-006、ISS-018、ISS-019，可在阅读底座和导出引擎完成后合并推进。

## PDF 算法素材池

以下来自本机 `legal-skills` 的 PDF 脚本。它们不是独立计划文档，也不是必须照搬的实现；agent 可以把它们晋升为正式 ISS、合并进现有 ISS，或保留为后续素材。

| 来源 | 重点脚本 | 可复用能力 | 当前归属 |
| --- | --- | --- | --- |
| `pdf-processor` | `pdf-preprocess-core.py`、`pdf_preprocess_skew.py`、`pdf-preprocess-ocr.py` | 扫描清洁、90 度方向检测、微倾斜校正、裁边、分块/并行预处理 | ISS-016 |
| `pdf-processor` | `pdf-compress.py` | PyMuPDF 图像资源重编码、降采样、保留文字层/批注/书签的压缩统计 | ISS-013 |
| `pdf-processor` | `pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py` | PaddleOCR / MinerU / ocrmypdf provider、双层 PDF 叠层、API fallback | ISS-007、ISS-014 |
| `pdf-processor` | `pdf-ocr-quality-check.py` | 可检索页比例、关键词命中率、体积比、耗时、可选 CER | ISS-017 |
| `pdf-organizer` | `pdf_organizer.py` | 文字层检测、页级检查、文书边界信号、manifest、A4 标准化、拆分/合并/命名 | ISS-006、ISS-019 |
| `img2pdf` | `img_to_pdf.py` | 图片或 PDF 页面按 A4 1/2/3/4 张每页编排 | ISS-018 |

产品化原则：

- 纯算法能力优先拆入 FaroPDF 模块，例如压缩、A4 编排、页码/Bates、水印、文字层检测、页级 manifest。
- 重依赖能力走后台 bridge，例如 OpenCV 预处理、`ocrmypdf`、PaddleOCR API、MinerU API。
- UI 层只调用统一 job model，不直接解析脚本 stdout。
- 外部 API 和密钥由设置页管理；联网 OCR 必须主动确认。
- 所有处理默认输出新 PDF，不覆盖原始材料。

## PDF Expert UI 探索素材池

以下观察只作为信息架构和交互编排参考，不复制 PDF Expert 的品牌、图标、配色或具体视觉资产。探索使用 `/tmp/faropdf-ui-sample.pdf` 临时无敏感样例；不记录用户真实最近文件名和搜索历史。

已观察结论：

- 新建标签页：顶部主工具栏 disabled，中央是打开/拖拽 PDF 区，旁边提供 Word/PDF、图片/PDF 转换入口，下方是最近文件缩略图。
- 阅读态：顶部主工具带 + 中央 PDF 页面 + 左侧按需文档摘要，不常驻右侧 Inspector。
- 文档摘要：左侧抽屉顶部用小图标切换书签、大纲、批注、缩略图；缩略图较大，当前页高亮，页码和纸张尺寸显示在缩略图下方。
- 视图设置：占用左侧工具区，提供单页/双页、无拆分/垂直/水平分屏，不作为右侧面板。
- 页面管理：进入独立页面网格工作台，阅读区被替换；顶部显示插入页、附加文件、旋转、复制、粘贴、摘录、删除等专用工具条。
- 批注模式：主工具栏切换模式，第二行上下文工具条显示高亮、下划线、删除线、笔、橡皮擦、文本、形状、笔记、图章、签名、内容选定和裁剪。
- 编辑 PDF 模式：第二行工具条显示文本、图像、链接、隐藏。v0.1 直接编辑 PDF 原文暂缓，但“隐藏/遮盖”可作为法律材料安全编辑后续议题。
- 导出模式：第二行工具条偏格式转换，包括转 Word、Excel、PowerPoint、文本和图片；这与 FaroPDF 的水印/压缩/Bates 交付工具不是同一层级。
- 填写和签名：第二行工具条包含文本、签名、日期、钩号、叉号、图章、图像，右侧有导出为压平。
- 扫描和文本识别：第二行工具条包含增强扫描、拆分页面、裁剪页面、清除空白边、识别文本、内容选定和裁剪。
- 搜索：顶部搜索框带搜索选项和历史菜单；不应把历史关键词写入日志或任务源。搜索结果后续应以轻量结果层呈现，而不是常驻右栏。

当前差距：

- 当前 `feat/pdf-expert-shell-ia` 只是信息架构草案：顶栏仍过密，图标语义和按钮分组还不够自然，视觉细节没有达到可合并的设计系统质量。
- FaroPDF 当前把导出、水印、压缩、Bates 混在一个模式里；后续需要拆成“格式转换”和“交付工具”两类。
- 空态缺少 PDF Expert 那种打开/拖拽区、转换入口、最近文件缩略图的完整编排。
- 左侧缩略图还是占位，未接入真实 PDF.js 缩略图、当前页同步、批注/搜索/OCR 标记。
- 搜索只有输入框，没有结果层、命中跳转和文字层/OCR 提示。
- 页面管理工作台只有壳层网格，没有拖拽、选择、多选、撤销、导出路径和风险确认。

## 品牌与视觉资产

### ISS-020 临时应用图标

- 优先级：P1
- 类型：品牌 / UI
- 状态：已完成
- 来源：用户要求先暂用最初生成的灯塔图标。
- 范围：`src-tauri/icons/`、`public/favicon.png`、`index.html`、`docs/DESIGN.md`、`CHANGELOG.md`
- 目标：为 FaroPDF 提供当前可用的应用图标，后续正式品牌图标再继续简化。
- 验收：桌面图标和网页 favicon 均使用同一灯塔主图导出；Tauri 图标配置继续复用现有路径；原始生成图已复制到项目内作为当前源图。
- 验证：检查源图和导出图标尺寸、ICO/ICNS 文件类型，并运行前端构建验证图标资源不破坏打包。

## 基础状态任务

### ISS-001 初始化 Tauri 应用脚手架

- 优先级：P0
- 类型：工程基础
- 状态：已完成
- 建议分支：`feat/foundation-scaffold`
- 建议 worktree：`.claude/worktrees/tmux-foundation-scaffold`
- 依赖：无
- 范围：`package.json`、锁文件、`src-tauri/`、`src/` 基础入口、测试配置、构建配置、README 开发命令
- 目标：创建 Tauri v2 + React + TypeScript + Vite 应用，并补齐基础测试、类型检查、Lint 和构建脚本。
- 验收：本地可启动空壳应用，`typecheck`、测试和构建命令可运行。
- 验证：`npm run typecheck`、`npm test`、`npm run lint`、`npm run build`、`cd src-tauri && cargo check`。

### ISS-011 共享契约与模块边界

- 优先级：P0
- 类型：工程基础
- 状态：已完成
- 建议分支：`feat/shared-contracts`
- 建议 worktree：`.claude/worktrees/tmux-shared-contracts`
- 依赖：ISS-001
- 范围：`src/shared/`、`src/modules/*/README.md`、`docs/ARCHITECTURE.md`
- 目标：建立 PDF 文档、页面视口、批注、页面操作、导出任务、OCR provider、设置项和后台任务的共享类型与模块边界。
- 验收：各功能 worker 可只依赖共享契约开工；类型检查通过；架构文档同步记录核心接口。
- 验证：`src/shared/contracts.test.ts` 覆盖核心契约和 `FAROPDF_MODULES` 模块边界。

### ISS-012 基础应用 Shell 与验证夹具

- 优先级：P0
- 类型：UI / 工程基础
- 状态：已完成
- 建议分支：`feat/app-shell-foundation`
- 建议 worktree：`.claude/worktrees/tmux-app-shell-foundation`
- 依赖：ISS-001、ISS-011
- 范围：`src/App.tsx`、`src/components/layout/`、`src/styles/`、`src/modules/settings/` 入口、`tests/fixtures/`
- 目标：建立 PDF Expert 风格信息架构的基础 Shell：主工具栏、按需左侧工具区、上下文工具条、页面管理工作台、状态栏、设置入口和测试用 PDF fixture 策略。
- 验收：空壳应用能展示阅读器布局；默认不常驻右侧 Inspector；设置页可打开；测试 fixture 不包含敏感材料；符合 `docs/DESIGN.md` 的清亮阅读器方向。
- 验证：`src/App.test.tsx` 覆盖阅读器首屏和设置入口；`tests/fixtures/README.md` 记录夹具安全规则。

## 并行功能任务

### ISS-002 PDF.js 快速阅读底座

- 优先级：P0
- 类型：阅读核心
- 状态：已完成
- 建议分支：`feat/reader-core`
- 建议 worktree：`.claude/worktrees/tmux-reader-core`
- 依赖：ISS-001、ISS-011、ISS-012
- 范围：`src/modules/reader/`、`src/shared/pdf/reader*`、阅读相关测试
- 目标：接入 PDF.js，支持打开本地 PDF、worker 渲染、页面虚拟化、缩放、页码跳转、连续阅读、单页和双页视图。
- 验收：几百页 PDF 打开后只渲染可见页附近；滚动和缩放不卡住主界面；阅读状态可被搜索、批注、页面整理模块复用。
- 验证：`npm run typecheck`、`npm test`、`npm run lint`、`npm run build`、`cd src-tauri && cargo check`。当前实现已接入 PDF.js 加载、worker chunk、文件输入、阅读状态、缩放/视图模式和虚拟化范围计算；真实 canvas 渲染调度留给后续阅读深化。

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
- 参考算法：`pdf-organizer/scripts/pdf_organizer.py` 的 manifest、A4 标准化、拆分/合并执行逻辑
- 目标：支持旋转、删除、重排、插入、提取、合并、裁剪、拆分双页扫描、A4 标准化和撤销。
- 验收：页面操作可预览、撤销，并默认另存为新 PDF，不覆盖原始文件。

### ISS-007 OCR bridge

- 优先级：P0
- 类型：OCR
- 状态：待处理
- 建议分支：`feat/ocr-bridge`
- 建议 worktree：`.claude/worktrees/tmux-ocr-bridge`
- 依赖：ISS-003、ISS-014
- 范围：`src/modules/ocr/`、`src/shared/ocr/`、`src-tauri/` OCR command、OCR 相关测试
- 参考算法：`pdf-processor/scripts/pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py`
- 目标：建立 OCR 任务模型，优先连接本地 Legal Skills / `ocrmypdf`，并支持 PaddleOCR、MinerU 等外部 OCR API adapter。
- 验收：纯扫描 PDF 可触发 OCR 任务；任务显示后端、页码范围、进度、输出路径和失败原因；生成双层 PDF 后能做搜索质量抽查；OCR 模式工具条至少覆盖识别文本、输出双层 PDF 和质量检查。

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
- 当前进度：已在 `feat/pdf-expert-shell-ia` 做出基础壳层重排，并补上 PDF Expert 风格空态、转换入口、最近文件占位、分组导出工具条、填写签名工具条、扫描/OCR 工具条和页面管理“另存为新 PDF”出口；已用 `/tmp/faropdf-ui-sample.pdf` 检查打开态、页面管理和导出工具条，并修正 900px 窄屏顶栏溢出。code review 后已修正无文档页面管理假页面、视图设置状态硬编码和窄屏搜索入口隐藏问题。但 UI 还未达到最终合并标准，必须继续做视觉密度、真实缩略图、搜索结果层、页面管理交互和真实文件态 polish。
- 下一步：继续推进阅读态真实 PDF 打开后的视觉 polish、搜索结果层、页面管理多选/撤销/风险提示，以及扫描/OCR 任务参数区；先补测试，再实现，最后用浏览器截图检查无重叠。

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
- 参考算法：`pdf-processor/scripts/pdf-compress.py`、`pdf-add-page-numbers.py`、`pdf-merge.py`
- 目标：支持文字水印、图片水印、普通页码、Bates 编号和常用压缩预设。
- 验收：每个操作都提供预览或明确输出路径；默认另存为新 PDF；Bates 编号支持起始号、前后缀和位置选择。
- UI 备注：不要把水印、压缩、Bates 和“转 Word/Excel/图片”等格式转换混成同一层级；FaroPDF 后续应拆成“交付工具”和“格式转换”两个入口或二级分组。

### ISS-014 设置页与外部 OCR Provider 配置

- 优先级：P0
- 类型：设置 / OCR
- 状态：已完成
- 建议分支：`feat/settings-ocr-providers`
- 建议 worktree：`.claude/worktrees/tmux-settings-ocr-providers`
- 依赖：ISS-011、ISS-012
- 范围：`src/modules/settings/`、`src/shared/settings/`、`src-tauri/` 设置持久化 command、设置相关测试
- 目标：建立设置页，管理默认保存策略、最近文件、默认 OCR 后端、PaddleOCR/MinerU API 配置和联网处理确认策略。
- 验收：设置可持久化；API Key 以安全方式存储或留给系统凭证方案；UI 不展示完整密钥；未配置云端 OCR 时不会误触发联网请求。
- 验证：`npm run typecheck`、`npm test`、`npm run lint`、`npm run build`、`cd src-tauri && cargo check`。当前实现已提供设置 service、Tauri read/write command、provider 校验、API Key 脱敏和设置页编辑；系统 Keychain 集成留给后续安全深化。

### ISS-016 扫描清洁与校正 pipeline

- 优先级：P0
- 类型：扫描预处理
- 状态：待处理
- 建议分支：`feat/scan-preprocess`
- 建议 worktree：`.claude/worktrees/tmux-scan-preprocess`
- 依赖：ISS-011、ISS-012、ISS-014
- 范围：`src/modules/preprocess/`、`src/shared/preprocess/`、`src-tauri/` 预处理 command、预处理相关测试
- 参考算法：`pdf-processor/scripts/pdf-preprocess-core.py`、`pdf_preprocess_skew.py`、`pdf-preprocess-ocr.py`
- 目标：支持扫描件增强、90 度粗方向检测、微倾斜校正、拆分页面、裁剪页面、清除空白边、分块处理、并行处理和只预处理输出。
- 验收：用户可在不 OCR 的情况下输出清洁校正后的新 PDF；任务显示旋转页数、倾斜校正页数、拆分页数、裁边页数、清边页数、耗时和输出路径；扫描/OCR 工具条至少覆盖增强扫描、拆分页面、裁剪页面、清除空白边和识别文本。

### ISS-017 OCR 质量检查

- 优先级：P0
- 类型：OCR / 质量
- 状态：待处理
- 建议分支：`feat/ocr-quality`
- 建议 worktree：`.claude/worktrees/tmux-ocr-quality`
- 依赖：ISS-003、ISS-007
- 范围：`src/modules/ocr/quality/`、`src/shared/ocr/quality*`、OCR 质量相关测试
- 参考算法：`pdf-processor/scripts/pdf-ocr-quality-check.py`
- 目标：OCR 完成后展示可检索页比例、关键词命中、体积比、耗时和可选 CER。
- 验收：OCR 输出 PDF 可生成质量报告；未达阈值时明确提示问题页和失败原因。

### ISS-018 证据图片 A4 编排

- 优先级：P1
- 类型：页面管理 / 证据材料
- 状态：待处理
- 建议分支：`feat/evidence-image-pack`
- 建议 worktree：`.claude/worktrees/tmux-evidence-image-pack`
- 依赖：ISS-005、ISS-006
- 范围：`src/modules/pages/imagePack/`、`src/shared/pdf/imagePack*`、图片编排相关测试
- 参考算法：`img2pdf/scripts/img_to_pdf.py`
- 目标：支持图片目录、多个图片或已有 PDF 页面按 A4 1/2/3/4 张每页编排为新 PDF。
- 验收：竖版截图可自动 3 张/页，横版截图可自动 1 张/页；支持边距、排序和横竖版选择；原始图片和 PDF 不变。

### ISS-019 文书整理 manifest 与规范命名

- 优先级：P1
- 类型：法律材料整理
- 状态：待处理
- 建议分支：`feat/document-organizer-manifest`
- 建议 worktree：`.claude/worktrees/tmux-document-organizer-manifest`
- 依赖：ISS-003、ISS-006
- 范围：`src/modules/organizer/`、`src/shared/organizer/`、文书整理相关测试
- 参考算法：`pdf-organizer/scripts/pdf_organizer.py`
- 目标：生成页级检查索引、文书边界建议、拆分/合并 manifest 和规范命名建议。
- 验收：系统只给出 manifest 和预览，不自动高风险拆分法律材料；用户确认后才另存输出。

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
- 2026-06-02：分析 `pdf-processor`、`pdf-organizer`、`img2pdf` 的脚本算法，将扫描清洁校正、压缩、OCR 质量检查、证据图片编排和文书整理 manifest 纳入任务源。
- 2026-06-02：在 `feat/foundation-scaffold` 完成 ISS-001、ISS-011、ISS-012，建立可运行 Tauri/React 工程、共享契约、基础阅读器 Shell、设置入口和 fixture 规则。
- 2026-06-02：从最新 `main` 创建 `feat/reader-core` 与 `feat/settings-ocr-providers` worktree，并启动两个并行 worker 推进 ISS-002 与 ISS-014。
- 2026-06-02：合并 `feat/reader-core` 与 `feat/settings-ocr-providers`，完成 PDF.js 阅读底座和设置/OCR provider 配置第一版。
- 2026-06-02：观察 PDF Expert 的阅读态、批注、编辑、导出、填写签名、扫描 OCR、视图设置和页面管理模式后，在 `feat/pdf-expert-shell-ia` 分支启动 FaroPDF Shell 重排草案；当前 UI 尚未达到可合并验收。
- 2026-06-02：清理已合并的 foundation、reader-core、settings-ocr-providers 旧 worktree、本地分支和远端分支；继续推进 `feat/pdf-expert-shell-ia`，补齐空态工作区和导出/填写签名/扫描 OCR/页面管理工具条。
- 2026-06-02：对 `feat/pdf-expert-shell-ia` 做提交前验证，修正 900px 窄屏顶栏溢出；该分支适合作为 Draft PR 进入 code/design review，但 `ISS-009` 仍保持进行中。
- 2026-06-02：完成 `ISS-020` 临时应用图标，按用户要求暂用最初生成的灯塔图标，并同步网页 favicon 与 Tauri 平台图标。
- 2026-06-02：处理 Draft PR code review：页面管理无文档时显示空态而不是假页面；视图设置读取实际阅读模式；920px 窄屏继续保留搜索入口；空态拖拽打开 PDF 行为补齐。
