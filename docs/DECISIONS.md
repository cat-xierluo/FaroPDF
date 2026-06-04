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

## DEC-005 ISS-018 证据图片 A4 编排第一版采用 plan-only 纯函数底座

- 日期：2026-06-02
- 状态：已采纳
- 关联任务：ISS-018

决定：

- 第一版只交付 `src/shared/pdf/imagePack.ts` 共享契约 + `src/modules/pages/imagePack/imagePackPlanner.ts` 纯函数 planner + 单测，不读取真实图片/PDF、不渲染像素、不引入新依赖、不修改 package 或 lock 文件。
- 输出计划包含 `pages` / `cells` / `summary`（输入条目数、输出页数、itemsPerPage、横竖版条目计数、每页方向计数、`selectedOrientation` / `selectedItemsPerPageOption`），但当前不向导出引擎提交实际 operation。
- `itemsPerPage=auto` 时竖版多数 → 3/页、横版多数 → 1/页（平手回落竖版 3/页）。
- `orientation=auto` 时 `itemsPerPage=1` 按条目方向逐页取方向，`itemsPerPage>=2` 时固定 landscape（与 `img2pdf/scripts/img_to_pdf.py` 的 `pick_page_size` 行为一致）。
- `suggestImagePackOutputPath` 默认生成 `*-evidence-pack.pdf`；输出路径必须为绝对路径、以 `.pdf` 结尾且不能等于任何输入 `sourcePath`（`../` 等等价路径会被归一化后拒绝）。
- 单元格按 aspect-ratio 保持缩放并居中放置在 margin 内：1/页占满 `a4 - 2*margin`；2/3/4/页采用 `cols=perPage` 单行布局，`cell_w = (a4_w - (cols+1)*gap) / cols`，`cell_h = a4_h - 2*margin`。
- `sort=time` 当前保持输入顺序（plan-only 模型未携带 mtime），后续真实文件扫描时再补 `modifiedAt` / 排序时间戳。

不采纳（本期暂缓）：

- 真实目录拾取、image/PDF 页面尺寸读取、PDF 写出执行、UI 编排对话框、多页预览：交由后续 worktree 单独推进，避免在 foundation 收口前修改脚手架和共享导出引擎。
- 行布局（per_page=4 拆成 2×2）：第一版先与 `img2pdf` 脚本的单行算法对齐，必要时再升级到 row-major。

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

## DEC-008 先 Foundation Gate，再多 worktree 并行

- 日期：2026-06-02
- 状态：已采纳

FaroPDF v0.1 采用“两段式”推进：先在主线完成可运行应用脚手架、共享契约、基础 shell、设置入口和测试命令，再从最新 `main` 拆出多个语义分支和 worktree 并行实现功能。

原因：

- 脚手架、锁文件、Tauri 配置、共享类型和全局布局属于高冲突区域，不适合一开始并行修改。
- 阅读、搜索、批注、页面整理、导出、OCR、表单和设置可以在共享契约稳定后按模块隔离。
- 多 Agent worker 需要明确分支名、worktree 路径、文件范围、依赖和验收方式，否则容易互相覆盖或扩大范围。

后续任务源以 `docs/TASKS.md` 为唯一来源。分支命名遵循 `git-workflow`，本地并行执行和 PM 巡检遵循 `multi-agent-orchestration`。Agent 可根据任务源判断哪些素材晋升为正式 ISS，哪些 ISS 可合并到同一 worktree 分支推进。

## DEC-009 v0.1 设置页纳入基础能力

- 日期：2026-06-02
- 状态：已采纳

由于 OCR 需要接入 PaddleOCR、MinerU 等外部 API，v0.1 将设置页纳入基础能力，而不是后置功能。设置页负责：

- 默认保存目录、最近文件、默认缩放和阅读布局。
- 默认 OCR 后端和外部 OCR provider 配置。
- API Key 或密钥引用管理。
- 联网 OCR 的隐私确认策略。

外部 OCR API Key 不写入版本库，不在 UI、日志或错误报告中完整输出。云端 OCR 必须要求用户主动确认。

## DEC-010 吸收 legal-skills PDF 脚本算法，不照搬 Agent 工作流

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 将吸收本机 `legal-skills` 中 `pdf-processor`、`pdf-organizer`、`img2pdf` 的脚本算法能力，但不把这些 skill 的 Agent 工作流原样复制为产品实现。算法素材和任务归属统一记录在 `docs/TASKS.md`，不另建算法任务文档。

采用方式：

- `pdf-processor` 提供扫描清洁校正、OpenCV 倾斜检测、PyMuPDF 压缩、OCR provider 调度和 OCR 质量检查的算法来源。
- `pdf-organizer` 提供文字层检测、页级检查、文书边界 manifest、规范命名和 A4 标准化的算法来源。
- `img2pdf` 提供证据图片/PDF 页面 A4 多图编排的算法来源。

实现原则：

- UI 层只调用 FaroPDF 的统一 job model，不依赖脚本 stdout。
- 纯算法能力逐步拆入产品模块；重依赖能力通过 Tauri 后台 command、sidecar 或 Python bridge 执行。
- 外部 API 和密钥仍由设置页管理；联网 OCR 必须主动确认。
- 所有处理默认输出新 PDF，不覆盖原始材料。

## DEC-011 Foundation Gate 采用共享契约先行

- 日期：2026-06-02
- 状态：已采纳

Foundation 分支先落地可运行工程、共享类型、模块边界、基础 Shell 和设置入口，再开放多 worktree 并行。当前落地方式：

- Tauri v2 + React + TypeScript + Vite 作为桌面应用底座。
- Vitest + Testing Library 覆盖基础 Shell、设置默认值和共享契约。
- `src/shared/pdf/`、`src/shared/ocr/`、`src/shared/settings/` 承载后续 worker 依赖的核心类型。
- `src/shared/foundation/modules.ts` 记录 reader、search、annotation、pages、export、ocr、forms、settings 的 owned paths 和验证命令。
- `src/modules/*/README.md` 只记录模块职责，不把 Agent workflow 塞进 UI 逻辑。

合并 Foundation 后，后续功能分支应从最新 `main` 创建 worktree；如需修改 `package.json`、锁文件、`src-tauri/`、`src/shared/` 或全局布局，应回到 PM 会话统一收口。

## DEC-012 阅读底座与设置配置并行落地

- 日期：2026-06-02
- 状态：已采纳

Foundation Gate 合并后，ISS-002 和 ISS-014 可并行推进，因为阅读底座主要修改 `src/modules/reader/`、`src/shared/pdf/reader.ts` 和少量布局入口，设置/OCR provider 主要修改 `src/modules/settings/`、`src/shared/settings/` 和 `src-tauri` 设置 command。两个任务的共享文件冲突可控，因此采用独立 worktree 并行实现。

阅读底座第一版先完成 PDF.js 加载、worker 配置、元数据读取、文字层初始状态、阅读状态和虚拟化范围计算。真实 canvas 渲染调度、滚动位置同步、缩略图和页级文字层检测继续后移，避免在第一批并行任务中过度扩大范围。

设置第一版实现前端 settings service、Tauri 设置读写 command、PaddleOCR/MinerU provider 配置、联网 OCR 确认和 API Key 脱敏。真实系统 Keychain/凭证读取暂不内置，当前仅保存凭证引用或脱敏占位，避免把明文密钥写入仓库、日志或 UI。

## DEC-013 应用 Shell 采用阅读优先的任务模式信息架构

- 日期：2026-06-02
- 状态：已采纳

用户希望 FaroPDF 的页面逻辑参考 PDF Expert。观察本机 PDF Expert 的新建页、阅读态、文档摘要、批注、编辑、导出、填写签名、扫描 OCR、视图设置和页面管理模式后，FaroPDF 采用以下信息架构：

- 默认阅读态不常驻右侧 Inspector，中央 PDF 页面保持最大可读面积。
- 左侧区域作为按需工具区，承载文档摘要、视图设置和应用设置。
- 批注、OCR、导出、填写和签名使用顶部第二行上下文工具条。
- 页面管理进入独立页面网格工作台，替换阅读区并显示专用工具条。
- 搜索优先放在主工具栏，后续搜索结果使用轻量结果层或临时面板。

这不是复制 PDF Expert 的品牌视觉，而是借鉴其任务编排方式。后续搜索、批注、OCR、页面整理、导出和表单 worker 必须按该 Shell 方向实现，不再把复杂功能堆进常驻右侧面板。

当前 `feat/pdf-expert-shell-ia` 分支只是结构草案，不能视为 UI 已完成。合并前必须继续完成视觉密度、空态、真实缩略图、模式工具条细节、搜索结果层和页面管理交互的可用性检查。

## DEC-014 临时应用图标采用灯塔方案

- 日期：2026-06-02
- 状态：已采纳

FaroPDF 当前临时应用图标采用最初生成的纸页叠层和灯塔方案。此前尝试的极简纸页定位条版本颜色和形态都不够稳定，因此先回退到识别度更高的灯塔图标。

原因：

- 用户明确要求先暂用灯塔版本。
- 灯塔图标更贴合 `Faro` 的“指引”寓意，当前辨识度优于后续尝试的简化版本。
- 临时方案仍符合项目清亮、专业、法律材料友好的大方向。

后续若做正式品牌升级，应继续控制在 2 到 3 个主色内，减少细节，不使用依赖文字识别的方案。

## DEC-015 批注第一版采用 schema 化 sidecar

- 日期：2026-06-02
- 状态：已采纳

ISS-004 第一版采用 schema version 1 的 JSON sidecar 存储可编辑批注状态，路径为原 PDF 所在目录下的 `.faropdf/annotations/<document-key>.annotations.json`。`document-key` 优先来自 PDF fingerprint 的安全化结果；无 fingerprint 时使用源路径哈希兜底。

原因：

- 不覆盖原始 PDF，符合 FaroPDF 对法律材料的可回退边界。
- 批注 UI、PDF 扁平化导出和摘要导出可以共享同一模型。
- sidecar 文件名和摘要导出不包含真实用户文件名，降低把案件材料名称带入交付物或日志的风险。

当前实现只落地模型、仓储服务、序列化校验和 Markdown / HTML 摘要导出。批注工具条、列表渲染和点击跳转不在本分支接入，后续由 UI 工作继续调用 `AnnotationService`。

## DEC-016 扫描预处理第一版采用 job bridge stub

- 日期：2026-06-02
- 状态：已采纳

ISS-016 的第一版不把 `legal-skills` 的 PDF 预处理脚本工作流直接搬进 UI，也不在前端主线程执行 OpenCV、PyMuPDF、pdf2image 或 OCR。当前只建立产品侧 job model、参数校验、Tauri command bridge stub 和安全输出路径。

采用方式：

- 前端共享契约记录增强扫描、90 度方向检测、微倾斜校正、拆分、裁剪、清边、分块和并行参数。
- 默认输出模式为 `preprocess-only`，默认生成 `*-preprocessed.pdf`，不覆盖原始 PDF。
- 默认参数吸收 `pdf-processor` 脚本中的保守值：300 DPI、JPEG 90、旋转置信度 0.5、倾斜阈值 0.3 度、最大微倾斜 5 度、串行处理、不分块。
- 错误展示前脱敏完整本地路径，避免把真实卷宗路径写入 UI 错误或日志。
- Tauri command 当前返回 queued stub，后续再接入后台 Python/Rust bridge、页面级统计和真实输出文件。

## DEC-017 搜索第一版采用按需内存索引

- 日期：2026-06-02
- 状态：已采纳

ISS-003 第一版采用前端内存搜索会话：打开 PDF 时只读取首屏已有文字层状态；用户输入搜索词后，搜索模块通过阅读服务按批次读取页文本并建立内存索引。命中列表、上下一个命中、当前页轻量高亮和 OCR 提示都来自该会话状态。

原因：

- 避免打开大卷宗时同步扫描全卷，保持打开和阅读路径轻快。
- 不记录真实搜索词历史，不把搜索索引、文件名或关键词写入本地持久化。
- 第一版先验证状态模型、索引策略和 UI 接入；真实 PDF text-layer 几何高亮留给阅读渲染深化。
- 纯扫描或文字层缺失时直接进入 OCR 提示模型，为后续 OCR bridge 和质量检查保留稳定入口。
- Review 后为每次打开的 PDF 增加 `documentId`，搜索会话按文档实例重置；旧异步搜索请求返回时不得回写新文档 UI。
- PDF.js 文本项拼接采用英文/编号边界补空格、中文边界不强制补空格的保守策略，避免 `UnitedStates` 这类搜索失败。

## DEC-018 导出引擎与 OCR bridge 作为下一批并行主线

- 日期：2026-06-02
- 状态：已采纳

合并 ISS-003、ISS-004 和 ISS-016 后，下一批主线并行推进 ISS-005 与 ISS-007。

原因：

- ISS-005 依赖批注 sidecar，主要写入 `src/modules/export/`、`src/shared/pdf/export*` 和 pdf-lib 相关测试，可作为页面整理和批注扁平化的底座。
- ISS-007 依赖文本搜索和 OCR provider 设置，主要写入 `src/modules/ocr/`、`src/shared/ocr/` 和 `src-tauri/` OCR command，与导出引擎文件范围基本分离。
- ISS-006 页面整理依赖导出引擎，若现在抢跑会在页面操作、导出路径和安全确认上反复返工。

执行方式：从最新 `main` 创建 `feat/pdf-export-engine` 与 `feat/ocr-bridge` 两个 worktree；worker 只修改各自任务范围，文档冲突由 PM 在合并时统一收口。

## DEC-019 PDF 导出第一版采用 bytes-first 引擎和 plan-only 批注策略

- 日期：2026-06-02
- 状态：已采纳

ISS-005 第一版先建立 `pdfOperationEngine` 抽象：输入 PDF bytes，使用 pdf-lib 在内存中加载、复制页面、执行表单扁平化，并返回新的 PDF bytes。路径型导出放在 `pdfExportService`，读取原始路径后只能写入不同的新输出路径，不能覆盖原始 PDF。

采用方式：

- 共享层新增 `PdfExportRequest`、`PdfExportResult`、`PdfExportOperation` 和导出计划摘要类型，由 UI、服务和后续 Tauri bridge 共用。
- 批注 sidecar 扁平化第一版只生成 `plan-only` 摘要并写入 PDF 元数据，生成前校验 sidecar 页数、指纹和批注页码，明确表示“有可导出的 sidecar 批注计划”，不声称已经绘制真实高亮、形状、墨迹或图章外观。
- AcroForm 表单扁平化直接调用 pdf-lib `form.flatten()`，作为第一批真实 PDF 改写能力。
- 页面操作先以 `plan-only` 入口记录操作 id、类型和页码，并在计划生成前校验页码范围，后续页面整理接入后再实现旋转、删除、重排、裁剪、插入等真实改写。
- 路径型导出要求绝对 PDF 输出路径，storage 可提供真实路径解析以拦截 symlink/alias 等价路径；输出写入使用 `writeNewFile` 仅新建语义，`exists`、路径解析和写入错误都必须脱敏。

这样可以先固定导出安全边界和可测试接口，同时避免把尚未完成的批注几何绘制或页面操作误报为已完成。

## DEC-020 OCR bridge 第一版采用安全 command stub

- 日期：2026-06-02
- 状态：已采纳

ISS-007 第一版只建立 OCR bridge 基础，不在本分支执行真实 OCR、生成双层 PDF 或调用 PaddleOCR/MinerU 外部 API。当前采用方式：

- 前端共享契约补齐 `OcrRequest`、输出策略、任务进度和质量抽查入口。
- `ocrBridgeService` 负责 provider 查找、adapter 边界、输入/输出 PDF 校验、默认 `*-ocr.pdf` 输出路径和 bridge 错误脱敏。
- Adapter 覆盖 `local-ocrmypdf`、`legal-skills`、`paddleocr`、`mineru`；云端 provider 必须有本次明确 consent、安全 apiKeyRef 和 HTTPS endpoint，本机调试只允许 `localhost`、真实 127.0.0.0/8 IPv4 和 `::1` loopback HTTP；真实密钥串、远端明文 HTTP、伪装成 `127.*` 的域名和非法 endpoint 一律拒绝。
- Tauri `start_ocr_job` 只返回 queued stub，并在 Rust 侧重复校验参数和同路径输出；错误信息不包含完整敏感本地路径，带逗号或中文标点的 PDF 路径也会脱敏。

原因：

- OCR 涉及案件材料、隐私和外部 API，必须先把不覆盖原件、不误联网、不泄露路径和凭证引用的边界固定下来。
- 本地 `ocrmypdf`、Legal Skills、PaddleOCR、MinerU 和质量检查的执行模型后续可以接入同一 job model，避免 UI 直接绑定脚本 stdout 或 HTTP 实现细节。

## DEC-021 页面整理第一版采用可回退状态和 plan-only 导出

- 日期：2026-06-02
- 状态：已采纳

ISS-006 第一版先建立页面整理工作台底座，不在本分支真实改写 PDF。当前采用方式：

- `PdfPageOrganizerState` 记录页面项的原始页码、当前顺序、旋转角、删除状态、动作记录和撤销栈。
- `pageOrganizer` service 使用纯函数更新状态，支持旋转、删除、重排、恢复和撤销；每次高风险操作都保留上一状态快照。
- 导出入口生成 `PdfPageOperationsExportOperation` / `PdfExportFileRequest`，默认输出 `*-organized.pdf`，并拒绝与原始 PDF 等价的输出路径。
- 页面操作传给导出引擎时仍为 `plan-only`，只描述重排、旋转和删除计划，不声称已经完成真实页面改写。

原因：

- 页面整理直接影响法律材料的页序和完整性，必须先固定可回退状态与另存安全边界。
- ISS-005 的导出引擎当前只支持页面操作计划入口；在没有完整 UI 预览和真实 pdf-lib 页面变换测试前，不应对外宣称页面重排、删除或旋转已经落盘。
- 后续插入、合并、裁剪、拆分双页扫描、A4 标准化和 manifest 可以在同一状态模型上扩展，不必推翻第一版接口。

## DEC-022 联网 OCR 隐私确认采用 notice/consent/audit 三段模型

- 日期：2026-06-02
- 状态：已采纳

ISS-010 第一版不做完整 UI 弹窗，先把联网 OCR 的用户确认和审计边界建成可测试模型/服务：

- `src/shared/security/` 生成联网 OCR notice，明确 provider、页码范围、输出路径、是否联网、不会覆盖原 PDF 和 API key 引用/脱敏占位。
- consent decision 绑定 notice id、一次性 nonce、签发时间、有效期、输入文件指纹、输出路径指纹、provider、页码范围、输出策略和 API key 引用，不保存完整本地 PDF 路径。
- audit record 记录 providerId、后端类型、页码范围、输出策略、联网状态、同意状态、脱敏输入/输出路径摘要和脱敏 apiKeyRef；不保留真实密钥或完整本地路径。
- `ocrPrivacyConsentGuard` 对云端 provider 要求本次 notice 与 consent 同时匹配当前请求，本地 provider 不要求联网 consent；`ocrBridgeService` 把脱敏 `privacyAuditRecord` 附到后端请求，旧布尔 consent 标记不能单独放行云端 OCR。

原因：法律材料可能包含案件隐私、商业秘密和个人信息。先固定 notice/consent/audit 的数据边界，可以让后续 UI 弹窗、设置页和真实 PaddleOCR/MinerU adapter 复用同一安全模型，避免把 UI 文案、日志字段和后端请求各自散落实现。

## DEC-023 交付工具第一版采用 pdf-lib 写入和压缩 plan-only

- 日期：2026-06-02
- 状态：已采纳

ISS-013 第一版把水印、普通页码、Bates 编号和压缩预设纳入导出引擎统一 operation，而不是另建独立文件写入链路：

- `watermark`、`page-number`、`bates-number` 由 `pdfOperationEngine` 使用 pdf-lib 写入新 PDF bytes，并通过 `outputToolPlan` 记录页码、状态和摘要标签。
- `createPdfOutputToolsExportRequest` 生成路径型导出请求，默认输出 `*-delivery.pdf`，拒绝相对路径和等价覆盖原始 PDF。
- `compress` 只记录 plan-only 摘要和警告，不在本阶段执行图像重编码、降采样、对象流优化或 PyMuPDF 压缩。
- 文字绘制暂用 pdf-lib 内置 Helvetica，因此第一版只支持 Latin-1 文本；中文水印、中文页码和更精细的法律交付字体需要后续接入自定义字体或系统字体。

原因：水印、页码和 Bates 编号可以在现有 bytes-first 导出引擎内安全落地；压缩则涉及图像资源重编码、文字层/批注/书签保留和体积质量统计，直接用 pdf-lib 伪装压缩会误导用户，必须留给后续后台 bridge 或更强 PDF 引擎实现。

## DEC-024 OCR 质量检查第一版采用抽象报告服务

- 日期：2026-06-02
- 状态：已采纳

ISS-017 第一版先建立 OCR 质量检查的共享契约和纯逻辑服务，不在本分支接入真实 PDF 解析、真实 OCR provider 或联网请求：

- `src/shared/ocr/quality.ts` 定义质量检查输入、默认阈值、阈值检查项、问题页、关键词命中和报告模型。
- `src/modules/ocr/quality/qualityCheckService.ts` 基于页面文本、关键词、输入/输出体积、耗时和可选参考文本生成质量报告。
- 报告覆盖可检索页比例、关键词命中率、文件体积比、耗时和可选 CER；未达阈值时保留具体检查项和问题页原因。
- 输入校验要求有明确页数、页面文本输入和合法页级阈值，避免把空输入或 OCR provider 脏返回误判为质量通过。

原因：OCR bridge 当前仍是 queued stub，直接在前端或本分支读取真实 PDF 会把 PDF 解析、OCR 后台执行和质量展示耦合在一起。先固定报告模型和服务边界，可以让后续本地 `ocrmypdf`、Legal Skills、PaddleOCR/MinerU 和 UI 工具条复用同一质量结果。

## DEC-025 git-workflow skill 描述部分中文化

- 日期：2026-06-03
- 状态：已采纳
- 关联 Skill：`.claude/skills/git-workflow/`

用户注意到 git-workflow 文档中 PR body 区块标题（`Summary` / `Test plan`）、PR 正文最低要求表（`Agent Attribution` / `Issue/Task` / `Risk`）和命令注释中大量英文，与日常中文协作语境不一致。

决策：保留英文类型前缀（`feat` / `fix` / `docs` / `chore` 等），把描述、表格、注释、PR body 区块标题全部中文化。通用 Git 术语（Rebase merge、Squash merge、Merge commit、cherry-pick、worktree、Monorepo、commit、PR、CI、checks、review 等）保留英文，避免"Rebase 合并"这类生硬翻译。

原因：

- 英文类型前缀是 GitHub 自动标签、Conventional Commit 工具链的硬性要求，中文化会破坏下游集成。
- 描述、注释、表格内容属于"使用语境"，可读性比与工具链兼容更重要。
- 通用技术术语英文更精确，跨项目复用时也更稳定。

影响：

- `.claude/skills/git-workflow/SKILL.md` 升级到 v1.2.0；PR body 模板的 `## Summary` / `## Test plan` 改为 `## 摘要` / `## 测试计划`；PR 正文最低要求表区块改为「摘要」「测试计划」「Agent 归属」「关联任务」「风险」。
- `.claude/skills/git-workflow/references/issue-pr-format.md` 表格中的"Multi-Skill"改为"多 Skill"。
- 同步在 skill 自身的 `CHANGELOG.md`、`DECISIONS.md`、`TASKS.md` 记录。
- 当前不修改根目录 `CHANGELOG.md`：那是产品功能变更日志，skill 维护变更不打断版本号；如后续需要版本对齐，由 PM 在下一次发版时一并处理。

## DEC-026 借鉴 folia 的发布与设置体验

- 日期：2026-06-03
- 状态：已采纳
- 关联任务：ISS-021、ISS-022、ISS-023

决定：

- v0.3 阶段将 FaroPDF 的发布能力对齐到 folia 同等水平：全平台桌面打包、GitHub release 自动发布、`tauri-plugin-updater` 自动更新签名验证。
- v0.3 阶段将设置页从当前的扁平 `SettingsPanel` 升级为左侧导航 + 右侧多 section 的浮层，与 folia 的 `SettingsPage` 信息架构对齐，至少包含「常规 / 阅读 / OCR provider / 快捷键 / 关于」五个 section。
- 在「关于」section 内增加作者卡，复用 folia 的「作者名 / GitHub / 微信二维码」三段式展示。

参考实现：

- `folia/src-tauri/Cargo.toml` 的 `tauri-plugin-updater` 依赖。
- `folia/src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` + `pubkey` + `bundle.createUpdaterArtifacts = true`。
- `folia/.github/workflows/release.yml` 跨平台矩阵发布流程。
- `folia/src/components/SettingsPage.tsx` 与 `src/components/settings/*Section.tsx` 浮层布局。
- `folia/src/components/settings/AboutSection.tsx` 关于 + 作者卡布局。

不采纳（本期暂缓）：

- 移动端（Android / iOS）打包与自动更新能力：Tauri v2 移动端更新链路与桌面不同，先在 `docs/RELEASE.md` 记录限制和后续计划，本期不进入 ISS-021 验收。
- 关于页内的「贡献者」「第三方协议」子区：等 ISS-022 浮层稳定后再单独评估。

## DEC-029 v0.3 优先基础 PDF / PaddleOCR / 倾斜矫正 / 压缩，agent 集成延后

- 日期：2026-06-03
- 状态：已采纳
- 关联设计：`docs/plans/2026-06-03-agent-integration-design.md`
- 关联任务：ISS-025

决定：

- v0.3 阶段继续按现有 ISS 列表推进基础能力，agent 集成不进入 v0.3 关键路径。
- 优先级明确的初版任务：基础 PDF 功能（阅读、检索、批注、页面整理、导出、表单）、PaddleOCR 双层 PDF（ISS-007 真实调用）、扫描预处理倾斜矫正（ISS-016 真实处理）、压缩（ISS-013 真实压缩）。
- 上述基础能力对应的 ISS（007/013/016/008/005/006 等）的「真实处理 / 真实调用 / UI 接入」待续项是初版收口重点，不开新的 agent 任务。
- agent 集成的设计上下文完整保存在 `docs/plans/2026-06-03-agent-integration-design.md`，不丢；后续回到这个方向时从该文档 §6 / §7 / §8 切入。

不采纳（本期暂缓）：

- agent 能力立即进入 v0.3 实施：会让基础 PDF / OCR / 倾斜矫正 / 压缩的「真实处理」工作被挤压。
- 长期 sidecar、MCP 桥接、per-call consent 弹窗、文档级白名单等更复杂的 agent 接线方案：v0 起步以一次性 spawn + 全局开关为主，避免无谓复杂度。

## DEC-027 清理合并残留分支并启动 3 wave 多 worktree 推进

- 日期：2026-06-03
- 状态：已采纳
- 关联任务：ISS-007、ISS-008、ISS-009、ROADMAP §2 §4

### 清理

合并 `feat/reader-canvas-render-clean`、`feat/annotation-sidebar-list`（PR #12）、`feat/forms-signing`（PR #13）、`feat/reader-thumbnails`（PR #14）和 docs 整理等提交到 `main` 后，4 个本地 feat 分支和 1 个远端 stale 分支残留为合并残留：

- 本地 `feat/forms-signing`、`feat/reader-canvas-and-annotation-sidebar`、`feat/reader-thumbnails`：squash merge 不创建 merge edge，`git branch -d` 拒绝删除（"没有完全合并"）；这些分支上的提交在 `main` 已通过 PR #12/13/14 squash 重新生成 commit hash，功能代码在主线，仅失去分支 ref。
- 远端 `origin/feat/reader-canvas-render`：`git push --delete` 删除，是 PR #12 合并前的旧 head ref，落后 `main` 9 个 commit。

执行：

- `git branch -D` 强制删除 3 个本地 feat 分支（`feat/reader-canvas-render` 用 `-d` 已删）。
- `git push origin --delete feat/reader-canvas-render` 删除远端 stale ref。
- 保留 `git reflog` 一周以上以备恢复：reflog 中的 commit SHA 仍可重建被删分支。

不采纳（本期暂缓）：

- 把"合并残留"做成自动化 git 钩子：现在一个 PM agent 即可手工清理，自动化收益不抵复杂度。

### 3 wave 推进方案

Foundation Gate 已完成（DEC-008），`docs/TASKS.md` 已明确 worker 范围限制和共享契约收口规则。v0.1 完整基础版剩余任务按 3 个 wave 并行推进：

#### Wave 1（首批 2 个 worker，模块完全独立）

- **W1 / ocr-worker**：ISS-007 OCR bridge 真实接入 — `feat/ocr-bridge` / `.claude/worktrees/tmux-ocr-bridge`
  - 范围：`src/modules/ocr/`、`src/shared/ocr/`、`src-tauri/` OCR command、相关测试
  - 内容：本地 `ocrmypdf` / Legal Skills 真实执行、PaddleOCR/MinerU API 凭证读取与调用、双层 PDF 生成、任务队列持久化、OCR 模式工具条
- **W2 / annotation-worker**：批注深化（ROADMAP §4） — `feat/annotation-tools` / `.claude/worktrees/tmux-annotation-tools`
  - 范围：`src/modules/annotation/`、AnnotationSidebar
  - 内容：文本选择高亮/下划线/删除线、矩形/箭头/手写、常用图章（已阅/重点/待核/证据）、批注搜索与跳转

两 worker 范围零冲突（modules/ocr vs modules/annotation，shared/ocr vs annotation 内部），可同时推进。

#### Wave 2（前置：PM 重构 ReaderToolbar 为 mode 注册表）

PM 在主目录 `main` 重构 `src/components/layout/ReaderToolbar`，把当前直接列 mode 改为"各 mode 注册 tool items"模式，让 W3（Forms）和 W4（Reader 模式）能并行不冲突。

- **W3 / forms-worker**：ISS-008 表单签署扩展 — `feat/forms-signing` / `.claude/worktrees/tmux-forms-signing`
  - 范围：`src/modules/forms/`、`src/shared/pdf/form*`
  - 内容：手写签名、签名位置调整、图章、扁平化导出
- **W4 / reader-modes-worker**：阅读模式深化（ROADMAP §2） — `feat/reader-modes` / `.claude/worktrees/tmux-reader-modes`
  - 范围：`src/modules/reader/`（用注册表模式添加新 mode）
  - 内容：连续/单页/双页/适合宽度、缩放/旋转、键盘翻页、恢复上次页码

#### Wave 3（Wave 1+2 完成后）

- **W5 / ui-worker**：ISS-009 设计系统 polish — `feat/pdf-expert-shell-ia` / `.claude/worktrees/tmux-pdf-expert-shell-ia`
  - 范围：`src/components/`、`src/styles/`、各模块视觉整合
  - 等所有 mode 落地后做视觉收口

### 推进约束

- 每个 worker 严格按 `docs/TASKS.md`「并行执行规则」限定修改范围。
- 改共享契约（`src/shared/`、`package.json`、`src-tauri/`、路由、App.tsx、全局样式）前必须先回 PM 确认。
- 每个 worker 在自己的 worktree 内提交、推送、创建 PR；PM 检查 diff 范围、验证结果和文档同步后再合并。
- 不在 `main` 推进未审阅代码。

### 风险点

- W1 和 W3 都在 `src-tauri/` 加 command，需约定命名空间或按 wave 推进避免冲突。
- W4 依赖 PM 重构 ReaderToolbar，Wave 2 不能并发启动。
- 任何 wave 内 worker 发现需要改共享契约，回到 PM 等决策后再继续。

## DEC-028 部署 doc-curator 文档瘦身 subagent（post-action 触发，不依赖 hooks）

- 日期：2026-06-03
- 状态：已采纳
- 关联任务：ISS-024
- 关联 Skill：`.claude/skills/doc-curator/`、`.claude/agents/doc-curator.md`、`.claude/skills/git-workflow/SKILL.md`

### 背景

FaroPDF 的项目级文档（`docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` 等）在多 ISS 并行推进时不断膨胀：进度日志堆叠、归档条目散落、ISS 编号与 DEC 编号容易跳号、活跃任务卡和已完成任务的边界模糊。当前完成 ISS 后的归档、进度日志 trim、归档指针维护全靠人手动，缺乏自动机制。

### 决定

部署一个项目级 doc-curator subagent，覆盖体检、报告、maintenance PR 提交流程。

- **放置位置**：`.claude/skills/doc-curator/`（项目级 skill，强制跟踪到版本库）；`.claude/agents/doc-curator.md`（自定义 Agent 注册）。`codex/skills` 通过 `../.claude/skills` 软链接到本目录，对 Codex 自动可见。
- **运行模式**：报告 + 自动提 PR。Agent 在 `gh pr create` / `gh pr merge` 成功后主动调起 subagent 跑体检；体检发现 hard / adaptive 告警时，若工作区干净则自动跑 `maintenance-pr.sh` 提一个 `chore/doc-curator-<date>` 分支的 maintenance PR。
- **阈值策略**：首跑通过 `first-baseline.sh` 测量各文件大小建基线；后续按 `基线 × 1.5` 作为自适应告警阈值，硬性阈值（进度日志 ≤ 5、ISS 归档条目升序、DEC 编号连续、归档指针指向 DECISIONS.md）单向只检查不缩。
- **触发时机**：PR 创建后 + PR 合并后。**不依赖 hooks**，由 Agent 在 git-workflow 的 `## 4. PR 工作流` 末尾的两个 post-action 小节（`PR 创建后：调起 doc-curator 体检` / `PR 合并后：调起 doc-curator 体检`）主动调起。
- **子模块边界**：doc-curator 只读 + 维护 `docs/`，不改 `src/` / `src-tauri/` / `tests/`；不写 `CHANGELOG.md`（CHANGELOG 由 `release-workflow` 维护）；不直接 push 到 main，所有 PR 走 PR 流程。
- **git 跟踪**：`.claude/skills/` 默认被 `.gitignore` 忽略；doc-curator 目录需用 `git add -f` 强制跟踪；按 git-workflow 多模块规则拆 commit（`chore(skill): 新增 doc-curator` / `chore(agents): 注册 doc-curator subagent` / `docs(skill): git-workflow 集成 doc-curator post-action` 等）。

### 不采纳

- **hooks 触发**：用户明确反对（"我觉得触发不用hooks，可以再提交pr胡总和合并pr后去进行文档清理"），hooks 会让 maintenance 与工作 PR 抢节奏；Agent 主动调起更可控。
- **pre-PR 门禁**：当前不阻断 PR 创建流程；post-action 体检发现问题由 maintenance PR 单独提，不影响当前 PR 进入 review。
- **CHANGELOG 写入**：CHANGELOG 由 `release-workflow` 维护；doc-curator 只对 CHANGELOG 做软提示（最近 release entry 缺失），不修改。
- **OCR / PDF 处理 / API 集成**：doc-curator 严格只做文档级维护，不调用任何 PDF 引擎、OCR 引擎或外部 API；不读取 OCR 脚本或 PDF 处理脚本。

### 风险与回退

- **冲突风险**：maintenance PR 与正在推进的工作 PR 可能并行；缓解：自动提 PR 前检查 `git status` 干净度，不干净则只报告不自动 PR。
- **误改风险**：自适应阈值可能误判；缓解：硬性规则单向只检查不缩；首跑基线在 doc-curator 自己改完文件后重算，避免阈值永远追不上膨胀。
- **rollback**：删除 `.claude/skills/doc-curator/`、`.claude/agents/doc-curator.md`、`.claude/skills/git-workflow/SKILL.md` 中 doc-curator 引用、AGENTS.md Skill 强制调用表对应行；不影响项目其它功能。

### 验证

- `bash .claude/skills/doc-curator/scripts/first-baseline.sh`：建基线并写入 `state.json`。
- `bash .claude/skills/doc-curator/scripts/scan.sh`：跑体检，输出 JSON 行 + markdown 报告。
- 模拟「进度日志 6 条」：跑 `maintenance-pr.sh` 验证自动 trim + PR 创建。
- `ls -la .codex/skills/doc-curator`：确认 Codex 端可读。
- `git ls-files .claude/skills/doc-curator/`：确认新 skill 已被跟踪。

## DEC-030 ISS-007 OCR bridge 真实接入方案

- 日期：2026-06-03
- 状态：已采纳
- 关联任务：ISS-007、ISS-010、ISS-016、ISS-017

承接 DEC-020 stub 阶段，本决策记录 OCR bridge 从 stub 推进到真实接入的边界，确认沿用第一版的请求/任务模型、provider adapter 边界和云端 consent/apiKeyRef/HTTPS endpoint 安全规则，**不**修改共享契约的类型字段，只在 `src/shared/ocr/` 内增加新 helper 类型和进度/凭证引用工具。

### 执行链路

- `start_ocr_job` command 不再返回 queued stub，而是按 provider 类型分发：
  - `local-ocrmypdf` → 调用本机 `ocrmypdf` 二进制（`std::process::Command`），传入 `--output-type pdf --skip-text` 等参数；如果用户提供的 `pageRange` 非空，附加 `-r` 页码范围参数。
  - `legal-skills` → 解析 `FAROPDF_LEGAL_SKILLS_BIN` 或默认 `pdf-ocr.py`（不强制存在；缺失时回退到与 `local-ocrmypdf` 相同的 ocrmypdf 路径并标记 fallback reason）。
  - `paddleocr` / `mineru` → 通过 `curl` POST 上传 PDF 到 `provider.endpoint`（HttpsEndpoint 或 loopback HTTP），请求头 `Authorization: Bearer <resolved-key>`；返回的 JSON 包含 `text` 或 `pdf` 字段；二进制 PDF 响应写入 `outputPath`，文本响应配合前端 PDF.js 渲染为新 layered PDF。
- Rust 侧把 ocrmypdf 进程 stdout/stderr 收敛到 job 的 `progress.message`，stderr 抛错时归类到 `OcrJobStatus=failed` 并把 `errorMessage` 脱敏后返回。
- OCR job 启动后通过 `tauri::async_runtime::spawn` 派发到后台，命令本身立即返回 `running` 状态的 job；前端用 `poll_ocr_job`/`list_ocr_jobs` 拉取最新进度。

### 任务队列持久化

- 应用配置目录下新增 `ocr-jobs.json`，schema version 1，记录每个 job 的 `id`、`inputPath`、`outputPath`、`backend`、`providerId`、`status`、`progress`、`quality`、`errorMessage`、`createdAt`、`updatedAt`、`completedAt`。
- 启动时 `list_ocr_jobs` 读出 `running` 的 job（崩溃恢复场景）并把残留任务标记为 `cancelled`，避免幽灵任务；`status=completed|failed|cancelled` 的历史 job 完整保留供 UI 展示。
- `cancel_ocr_job` 通过 PID 终止本地子进程，并把 job 状态置为 `cancelled`；PaddleOCR/MinerU 取消依赖 provider 端实现，当前仅做客户端标记。
- 持久化层不记录 `privacyAuditRecord`、API key 引用、真实本地 PDF 路径，仅保留脱敏路径摘要（沿用 `summarizeLocalPathForAudit`）。

### 凭证引用解析

- `apiKeyRef` 严格遵循第一版的安全规则：只接受 `keychain:`, `env:`, `credential:`, `credential-ref:`, `api-key-ref:` 前缀的引用或 `***...***`/`...` 脱敏占位；明文 key 已被 `isSafeApiKeyRef` 拦截。
- Rust 侧 `resolve_api_key_ref` 把 `env:<NAME>` 映射到 `std::env::var`；`keychain:<NAME>` 暂未接入系统 Keychain（不引入 OS 依赖），返回明确错误并提示用户改用 `env:`；其他引用在 OCR job 的 `progress.message` 中显示「凭证引用已就绪，不在日志中展开」。
- 任何凭证解析失败必须让 job 失败而不是继续运行，避免把 `Bearer undefined` 之类的脏请求发到云端。

### 文本提取与质量检查联动

- OCR 完成后通过 Tauri command `extract_ocr_text` 调用本机 `pdftotext -layout`（poppler-utils；缺失时返回明确错误），把 PDF 拆成 `Array<{ pageIndex, text }>` 返回。
- 前端 `ocrPostProcessor` 接收 `OcrJob` + 提取的页面文本 + 关键词，调 `createOcrQualityCheckService` 生成 `OcrQualityReport`；结果保存到 job 的 `quality` 字段供 UI 展示。
- 质量检查是异步可选：job `qualityCheck.enabled=false` 时跳过；开启但 `pdftotext` 不可用时回退为 `quality.skipped=true` 并在 `errorMessage` 写明原因，不让 OCR 整体失败。

### UI 工具条

- 新增 `src/modules/ocr/ui/OcrModeToolbar.tsx` 组件，覆盖"识别文本"、"输出双层 PDF"、"质量检查"按钮；通过 props 接收 `onStartOcr`、`onOpenQualityReport`、`currentJob?`，由后续 worker 在 AppShell context toolbar 接入。
- 本任务**不**修改 `src/App.tsx` 或全局样式，只交付可独立运行的 toolbar 组件和单元测试，避免与 `feat/pdf-expert-shell-ia` 的 UI 收口冲突。
- 工具条配套 `OcrJobList`（任务队列视图）、`OcrQualityReportView`（报告视图）和 `useOcrJobController`（订阅 progress/lifecycle 的 hook），供后续 layout worker 接入。

### 范围与依赖

- 仅修改：`src/modules/ocr/**`、`src/shared/ocr/**`、`src-tauri/**`（含 `Cargo.toml`）和相关测试；不修改 `package.json`、锁文件、`src/shared/` 其他目录、`src/App.tsx`、全局样式、路由。
- 不引入新 crate；HTTP 使用 `curl` 外部命令，PDF 文本提取使用 `pdftotext` 外部命令，OCR 使用 `ocrmypdf` 外部命令，避免污染 `Cargo.toml` 依赖图。
- 共享契约字段保持兼容；新增的 `quality.skipped`、`completedAt`、`cancelledAt` 等可选字段在 Rust 端 serialize 为 `Option<...>`，旧前端可忽略。

### 已知限制

- 用户必须在本机装好 `ocrmypdf`（含 tesseract 数据）和 `pdftotext`（poppler-utils）才能跑通本地 OCR 和质量检查；缺失时 toolbar 会显示明确错误并保留 queued job 状态。
- `keychain:` 引用当前不接受，需要用户改用 `env:<NAME>`；后续若 OS Keychain 集成落地再扩展 `resolve_api_key_ref`。
- PaddleOCR/MinerU 的 provider 端取消协议依赖各自实现，本地只能做客户端标记。

## DEC-031 批注深化第一版采用几何/搜索/图章模板/工具条 model + Overlay/Toolbar UI 组合

- 日期：2026-06-03
- 状态：已采纳
- 关联分支：`feat/annotation-tools`
- 关联任务：ISS-026

承接 DEC-015 批注 sidecar 第一版，本决策记录批注深化第一版的边界，在不破坏现有 `PdfAnnotation` / sidecar schema 的前提下加入几何规整、搜索过滤、SVG 图章模板、工具条 model 和 Overlay/Toolbar UI：

### 几何规整与裁剪

- `src/modules/annotation/geometry.ts` 暴露纯函数 `normalizeRect` / `pointsToRect` / `unionRects` / `inkStrokesToRect` / `lineToRect` / `recomputeLineRects` / `recomputeInkRects` / `sanitizeRects` / `isRectWithinBounds` / `clampRectToBounds` / `annotationBoundingRect`，所有坐标以页面 PDF 用户空间（origin 左下、y 向上）记录；`sanitizeRects` 把 NaN / 负宽高 / 零面积矩形规整为可绘制矩形或丢弃。
- `lineToRect` 把两点直线扩展为 `thickness` 宽的矩形；`inkStrokesToRect` 用所有点的 union 矩形 + 笔画宽 / 2 的边距作为最终矩形。
- 边界裁剪用 `clampRectToBounds` 把矩形限制在 `[0, pageWidth] × [0, pageHeight]`，越界部分截断而非抛错；`isRectWithinBounds` 判定是否完全在页内。

### 搜索过滤

- `search.ts` 暴露 `collectAnnotationSearchHaystack`（按 type/page/color/author 构造搜索索引）+ `matchesQuery` / `matchesPageFilter` / `matchesTypeFilter` / `matchesColorFilter` 四个纯函数 helper；`searchAnnotations` 把这些 helper 组合，按 `query` / `types` / `pageNumbers` / `color` 条件过滤 sidecar 内容。
- `AnnotationService` 暴露 `searchAnnotations`，让 UI 过滤 sidecar 内容而不必重新实现过滤逻辑。
- 搜索是纯函数、无副作用，便于在 Overlay/Toolbar 内联调用。

### 图章 SVG 模板

- `stamps.ts` 内置 5 套模板：`reviewed`（已阅，方形带勾）、`important`（重点，方形带叹号）、`todo`（待核，椭圆带问号）、`evidence`（证据，方形带 E）、`custom`（自定义，圆角矩形占位）。
- 所有模板共用 `4:1` viewBox（宽 400 × 高 100），支持 4 种 shape：rect / rounded-rect / ellipse / banner。
- `renderStampSvg(template, { label, color })` 输出 XML-escaped SVG 字符串，颜色和文字 label 都走 `escapeXml` 防 XSS；hex 颜色字符串本身安全，暂不做非 hex 颜色的额外 escape。

### 工具条 model

- `toolbarModel.ts` 暴露 `ANNOTATION_TOOL_LIST`（9 工具：`highlight` / `underline` / `strikeout` / `note` / `textbox` / `rect` / `arrow` / `ink` / `stamp`）+ `ANNOTATION_TOOL_MAP`（按 id 索引的工具描述）+ `ANNOTATION_COLOR_SWATCHES`（6 色调色板）+ `AnnotationToolState`（受控 state shape）。
- 5 个不可变 reducer：`armTool` / `disarmTool` / `setColor` / `setStampName` / `setStampLabel`，全部返回新 state 不修改入参；stamp 模板切换时回填 `defaultLabel`。
- 工具条组件完全受控：state 由父组件传入，组件内只派发不可变 next state；stamp 子区段仅在 `activeToolType === "stamp"` 时整体渲染。

### Overlay 与 Toolbar UI

- `AnnotationOverlay` 覆盖 9 种批注的点击/拖拽/手写 3 种交互模式；草稿通过 `onAnnotationDraft` 派发不可变 `AnnotationDraftInput`；预览走 `id: "preview"` 占位 annotation 并通过不同 id 避免与现有批注 id 冲突。
- 6 种批注 glyph 渲染：rect（矩形）/underline（高亮）/strikeout（删除线）/ink（手写 stroke）/arrow（箭头）/stamp（图章 SVG 注入）。
- `AnnotationToolbar` 是 9 工具按钮 + 6 色色板 + 5 模板子区段 + 图章文字输入的受控组件；组件只接受 `state` 和 `onStateChange` props。
- 测试用 `ToolbarHarness` 把 `onStateChange` 桥接到 `setState` 模拟父组件持有 state；11 项测试覆盖 9 工具按钮渲染、arm/disarm、工具切换、颜色更新、图章选项可见性、图章文字修改、图章模板切换回填 `defaultLabel` 和 disabled 行为。

### 范围与依赖

- 修改：`src/modules/annotation/**`（新增 geometry/search/stamps/toolbarModel + 增强 service/index/README）、`src/components/layout/AnnotationOverlay.tsx`、`src/components/layout/AnnotationToolbar.tsx`、`src/components/layout/AnnotationToolbar.test.tsx`。
- 不修改：`src/shared/pdf/annotation.ts`（sidecar schema 不变）、`package.json`、锁文件、`src/App.tsx`、全局样式、路由、其他模块（reader / pages / export / ocr / forms / settings）。
- 已知限制：Overlay/Toolbar 是独立组件，未挂到 `AppShell`；接入时需要批注模式新增 armed state 并把 `activeToolType` / `activeColor` / `activeStampName` / `activeStampLabel` 透传给 Overlay，由后续 layout worker 在 `feat/pdf-expert-shell-ia` 或新建分支实现。

## DEC-032 ReaderToolbar 重构为 mode 注册表（toolbarRegistry）

- 日期：2026-06-03
- 状态：已采纳
- 关联分支：`feat/reader-toolbar-refactor`
- 关联任务：后续 W3 (Forms) / W4 (Reader modes) 接入

承接 DEC-012 基础应用 Shell 与验证夹具中"PDF Expert 风格主工具栏"的硬编码实现，本决策记录把 `src/components/layout/Toolbar.tsx` 的 mode 工具渲染从硬编码列表迁移到注册表驱动模式，为后续各 mode worker（W3 Forms / W4 Reader modes）独立注册 mode 工具铺路。

### 注册表契约

- 新增 `src/components/layout/toolbarRegistry.ts`：
  - `ToolbarState` 类型包含 `activeMode: AppModeId`、`reader: ReaderController`、`search: TextSearchController` 三个字段，是 ToolbarToolItem 闭包拿到的运行时上下文。
  - `ToolbarToolItem` 类型包含 `id` / `modeId` / `order` / `icon`（React `ComponentType<{ size?: number }>`）/ `label` / `isActive(state)` / `onClick(state)` / 可选 `isDisabled(state)`，与 `AnnotationToolbar` 工具条 model 的扁平形状对齐，便于后续工具条组件复用同样的 item schema。
  - `registerModeTools(modeId, items)` 追加 items 到该 mode 的命名空间（多次调用累加），`getModeTools(modeId)` 返回注册顺序的 items 数组（**不**自动排序，调用方负责 `slice().sort()` 后再渲染以避免污染注册表），`_resetToolbarRegistry()` 用于测试清理。
  - 内部用 `Map<AppModeId, ToolbarToolItem[]>` 持有注册表，按 mode 隔离。
- 新增 9 项单元测试覆盖：未注册返回空、追加、同 mode 多次累加、跨 mode 隔离、返回注册顺序（不自动 sort）、`isActive` / `onClick` 收到传入 state、`isDisabled` 可选、reset 清空。

### Toolbar.tsx 接入

- 在 `Toolbar` 函数体末尾新增内部组件 `ModeActiveTools`，构造 `state: ToolbarState = { activeMode, reader, search }`、调 `getModeTools(activeMode).slice().sort((a,b)=>a.order-b.order)`（slice 防原地排序污染注册表），按 `ToolbarToolItem` 渲染一组 `tool-button tool-button--icon`。
- `ModeActiveTools` 挂在 `toolbar__group--modes` 内、4 个 mode 入口按钮**之后**——同 group 内的"模式入口 + 当前 mode 工具"两段式布局。
- 4 个常驻 mode 入口按钮（annotate / export / forms / ocr）保留 Toolbar 内 `modeButtons` 数组硬编码渲染，不走注册表（这是 Toolbar 自己的事；后续各 mode worker 不应重复注册入口）。
- 切换模式按钮的点击语义不变（`onModeChange(activeMode === id ? "read" : id)`），新增的 mode 工具渲染在 activeMode 为 "read" / "pages" / "export" 时全部为空（`getModeTools` 返回 `[]`），UI 与重构前完全一致。

### 范围与依赖

- 修改：`src/components/layout/Toolbar.tsx`（接入注册表 + 新增 ModeActiveTools）、`src/components/layout/types.ts`（已存在，未改）、**新增** `src/components/layout/toolbarRegistry.ts`、`src/components/layout/toolbarRegistry.test.ts`。
- **不**修改各 mode 模块（`src/modules/reader/`、`src/modules/search/`、`src/modules/forms/`、`src/modules/annotation/`、`src/modules/pages/`、`src/modules/ocr/`）——那是各自 worker 的工作。
- 不修改：`package.json`、锁文件、`src/App.tsx`、全局样式、路由、其他模块。

### 后续各 mode worker 接入指南

- W3 Forms：在 `src/modules/forms/` 下新建 `registerFormsToolbarTools.ts`（或类似），在 module 入口或 AppShell 初始化路径中调 `registerModeTools("forms", [addTextField, addSignature, ...])`；各 `ToolbarToolItem.isActive` 读 `state.activeMode === "forms"`、`onClick` 派发对应 reducer / controller 调用。
- W4 Reader modes：类似地注册到 `"read"` / `"pages"` / `"export"` 等 mode 命名空间；如需禁用无文档状态，可选 `isDisabled: (state) => !state.reader.state.document`。
- `isActive` / `onClick` 是闭包，可捕获模块内 state 与 controller；不需要 Toolbar 知道 mode 内部细节。
- 任何 worker 都**不应**重复注册 4 个常驻 mode 入口按钮（annotate / export / forms / ocr），那是 Toolbar 的责任。

### 已知限制

- 当前 activeMode 工具区紧贴 4 个 mode 入口按钮放在同一 group 内，未做视觉分隔（无分隔条/竖线）；如未来工具过多影响排版，再在 group 内加 `::before` 分隔符或拆成独立 group。
- `ToolbarState` 当前只暴露 `activeMode / reader / search`；如未来某 mode 工具需要 `onModeChange` / `onUtilityPanelChange` / annotation controller / ocr controller，再按需扩展（保持最小可用面）。
- `getModeTools` 返回注册表内部引用，调用方应 `slice()` 复制后再排序，避免污染注册表（已写进测试与本决策）。
- 注册表是模块级单例，热重载/HMR 时不会自动 reset；测试用 `_resetToolbarRegistry` 显式清理，运行时注册是单向的"加项"语义。

## ISS 任务归档

`docs/TASKS.md` 收敛为活跃/暂缓任务入口；已完成 ISS 的详细任务卡迁移到本节，保留为单行摘要。后续如需恢复为正式 ISS，先在本节追加"恢复"标注，再回到 `docs/TASKS.md` 新增。

- **ISS-001 初始化 Tauri 应用脚手架**（P0，工程基础，已完成）— `feat/foundation-scaffold`：建立 Tauri v2 + React + TS + Vite 应用，补齐 `typecheck`/测试/构建脚本。
- **ISS-002 PDF.js 快速阅读底座**（P0，阅读核心，已完成底座+canvas 渲染+缩略图+滚动同步）— `feat/reader-core` → `feat/reader-canvas-render-clean` → `feat/reader-thumbnails`：PDF.js 加载、worker chunk、虚拟化、真实 canvas、PDF.js 缩略图懒加载、阅读区滚动同步当前页。连续滚动/键盘翻页/缩放预设/页码恢复待后续。
- **ISS-003 文本层检测与全文搜索**（P0，检索，已完成第一版）— `feat/text-search`：内存搜索会话、按批次页文本索引、命中列表、上下一个命中、当前页轻量高亮、文字层缺失/质量差 OCR 提示。真实几何高亮留阅读渲染深化。
- **ISS-004 批注 sidecar 模型**（P0，批注，已完成 sidecar+侧边栏列表 UI+点击跳转）— `feat/annotations-sidecar`：`PdfAnnotation` 模型、sidecar 持久化（默认 `.faropdf/annotations/*.annotations.json`）、批注列表 UI 和跳转。
- **ISS-005 PDF 导出与批注扁平化**（P0，导出，部分完成）— `feat/pdf-export-engine`：`pdfOperationEngine` 抽象、pdf-lib 复制/扁平化表单、批注与页面操作 plan-only 计划、绝对新 PDF 路径。批注几何绘制和 UI 接入待后续。
- **ISS-006 页面整理工作台**（P0，页面管理，进行中）— `feat/page-organizer`：`PdfPageOrganizerState` 状态机、旋转/删除/重排/恢复/撤销、plan-only 导出请求。完整 UI、插入/合并/裁剪、A4 标准化、页级 manifest、Bates 编号待后续。
- **ISS-010 法律材料隐私与联网 OCR 提示**（P0，安全，已完成第一版）— `feat/privacy-safety`：notice/consent 模型、`ocrPrivacyConsentGuard` 绑定指纹+nonce+有效期、API key 引用脱敏、bridge audit 衔接。真实 PaddleOCR/MinerU 调用和完整 UI 弹窗待后续。
- **ISS-011 共享契约与模块边界**（P0，工程基础，已完成）— `feat/shared-contracts`：`PdfDocumentState`/`PdfPageViewport`/`PdfAnnotation`/`PdfPageOperation`/`PdfExportJob`/`OcrProviderConfig`/`OcrJob`/`AppSettings` 共享契约与 `FAROPDF_MODULES` 模块边界。
- **ISS-012 基础应用 Shell 与验证夹具**（P0，UI/工程基础，已完成）— `feat/app-shell-foundation`：PDF Expert 风格主工具栏/按需左侧工具区/上下文工具条/页面管理工作台/状态栏/设置入口、测试 fixture 规则。
- **ISS-013 水印、页码、Bates 编号与压缩**（P0，导出/法律材料，已完成交付工具导出底座第一版）— `feat/pdf-output-tools`：watermark/page-number/bates-number 导出 operation、`outputToolPlan` 摘要、`*-delivery.pdf` 安全输出请求、内置 Helvetica 文字水印（中文待字体）。压缩当前 plan-only。
- **ISS-014 设置页与外部 OCR Provider 配置**（P0，设置/OCR，已完成）— `feat/settings-ocr-providers`：设置 service、Tauri read/write command、provider 校验、API Key 脱敏、设置页编辑。系统 Keychain 集成待后续。
- **ISS-016 扫描清洁与校正 pipeline**（P0，扫描预处理，已完成 bridge 基础第一版）— `feat/scan-preprocess`：preprocess-only 任务契约、保守默认参数、参数校验、路径脱敏、前端 service、Tauri command bridge stub、queued 进度状态和测试。真实 OpenCV/PyMuPDF 处理和扫描/OCR 工具条接入待后续。
- **ISS-017 OCR 质量检查**（P0，OCR/质量，已完成质量检查报告第一版）— `feat/ocr-quality`：`OcrQualityReport` 契约、默认阈值、输入校验、`ocrQualityCheckService` 纯函数。第一版不解析真实 PDF/不执行真实 OCR/不调用 PaddleOCR/MinerU。
- **ISS-018 证据图片 A4 编排**（P1，页面管理/证据材料，已完成第一版 plan-only 编排计划器）— `feat/evidence-image-pack`：`imagePackPlanner` 纯函数规划器（auto 3/auto 1/平手回落/显式 2/4/逐项方向/固定方向/单元格纵横比/页边距/输出路径安全/空 items/越界/负 margin/零或 NaN 尺寸/`sort=name`/混合 image+pdf-page）。真实目录拾取、像素渲染、image/PDF I/O 待后续。
- **ISS-019 文书整理 manifest 与规范命名**（P1，法律材料整理，已完成第一版 manifest 服务）— `feat/document-organizer-manifest`：页级检查索引、文书边界建议、拆分/合并 manifest、规范命名建议。真实 PDF 解析和 UI 接入待后续。
- **ISS-020 临时应用图标**（P1，品牌/UI，已完成）— 暂用最初生成的灯塔图标，覆盖 `src-tauri/icons/` 和 `public/favicon.png`；后续正式品牌图标再继续简化。

## 工作日志

- 2026-06-02：初始化项目上下文，固定名称、独立项目形态、首版范围、技术选型和安全边界。
- 2026-06-02：按 `project-init` skill 校准上下文初始化，补齐 Claude Code 配置和本地开发协作 skills。
- 2026-06-02：初始化 Git 仓库并准备推送到 GitHub 私有仓库 `FaroPDF`，本机 skill 符号链接不纳入版本库。
- 2026-06-02：确定 v0.1 先完成 Foundation Gate，再按 `docs/TASKS.md` 的任务包进行多 worktree 并行开发；设置页、外部 OCR provider、水印、压缩和直接编辑调研已纳入任务源。
- 2026-06-02：完成 `pdf-processor`、`pdf-organizer`、`img2pdf` 脚本算法梳理，并将算法素材、候选议题和任务归属纳入 `docs/TASKS.md` 唯一任务源。
- 2026-06-02：在 `feat/foundation-scaffold` 落地 Tauri/React 工程、基础阅读器 Shell、设置入口、共享契约、模块 README 和 fixture 规则，并通过基础验证。
- 2026-06-02：并行合并 `feat/reader-core` 与 `feat/settings-ocr-providers`，完成 ISS-002 和 ISS-014 第一版实现，并通过前端、测试和 Tauri/Rust 验证。
- 2026-06-02：观察 PDF Expert 页面编排后，在 `feat/pdf-expert-shell-ia` 建立 FaroPDF Shell 信息架构草案，并将二次探索结论、当前差距和后续 UI 验收要求写入 `docs/TASKS.md`、`docs/DESIGN.md` 和本决策记录。
- 2026-06-02：对 `feat/pdf-expert-shell-ia` 做提交前验证，修正 900px 窄屏顶栏溢出；决定以 Draft PR 形式请求 code/design review，不把 `ISS-009` 误标为已完成。
- 2026-06-02：按用户反馈回退为最初生成的灯塔图标；同步 `src-tauri/icons/`、`public/favicon.png`、设计规范、任务源和变更记录。
- 2026-06-02：处理 Draft PR code review，修正无文档页面管理空态、视图设置真实状态绑定、窄屏搜索入口保留和空态拖拽打开行为。
- 2026-06-02：PR #1 `feat/pdf-expert-shell-ia` 通过本地验证和 code review 后 squash 合并到 `main`；清理已合并分支，并从最新主线启动 `ISS-003`、`ISS-004`、`ISS-016` 三条并行功能分支。
- 2026-06-02：完成 ISS-004 批注 sidecar 模型第一版，新增 `src/shared/pdf/annotation.ts`、批注 sidecar schema、仓储服务、摘要导出模型和测试；未接入 UI。
- 2026-06-02：在 `feat/scan-preprocess` 为 `ISS-016` 落地第一版扫描预处理 job/bridge 基础：共享类型、默认参数、校验、路径脱敏、前端 service、Tauri command stub 和单元测试。
- 2026-06-02：在 `feat/text-search` 完成 `ISS-003` 第一版，新增搜索服务测试、UI 集成测试、按需页文本读取、内存搜索索引、命中结果层、当前页轻量高亮和 OCR 提示。
- 2026-06-02：处理 `feat/text-search` code review，修正文档切换后旧搜索状态泄露、PDF.js 文本项无空格拼接、纯扫描长卷 OCR 提示滞后和空结果测试覆盖不足。
- 2026-06-02：完成 PR #2、#3、#4 code review、冲突解决和合并清理；从最新主线启动 `ISS-005` 导出引擎和 `ISS-007` OCR bridge 两条并行任务。
- 2026-06-02：在 `feat/pdf-export-engine` 完成 `ISS-005` 导出引擎底座第一版：新增共享导出契约、pdf-lib bytes-first 引擎、路径型导出服务、表单 flatten、批注 sidecar plan-only 摘要、页面操作 plan-only 入口和测试覆盖。
- 2026-06-02：处理 `feat/pdf-export-engine` code review，收紧导出安全边界：输出路径必须绝对、支持 storage 真实路径解析、写入改为 `writeNewFile` 仅新建语义，并补齐 exists/写入脱敏、sidecar 指纹/页数/页码和页面操作页码校验。
- 2026-06-02：在 `feat/ocr-bridge` 为 `ISS-007` 落地 OCR bridge/stub 第一版：共享请求与任务模型、provider adapter 边界、云端 consent/apiKeyRef 拦截、默认新 PDF 输出路径、路径脱敏、Tauri command stub 和定向测试；真实 OCR 执行、双层 PDF 生成和质量检查继续保留为后续工作。
- 2026-06-02：处理 `feat/ocr-bridge` code review，收紧云端 provider 安全边界：apiKeyRef 必须是凭证引用或脱敏占位，远端 endpoint 必须使用 HTTPS，本机调试允许 localhost HTTP，并修正质量抽查页码在 normalization 前被静默丢弃的问题。
- 2026-06-02：继续处理 PR #5 OCR bridge review：前端和 Rust 侧 HTTP 本机调试 endpoint 改为只接受 `localhost`、真实 127.0.0.0/8 IPv4 和 `::1` loopback，拒绝 `127.*` 伪装域名；OCR 错误路径脱敏补齐带逗号或中文标点的 PDF 路径；MinerU 云端负向路径补 Rust 回归测试。
- 2026-06-02：在 `feat/page-organizer` 为 `ISS-006` 落地页面整理第一版底座：新增页面整理状态类型、旋转/删除/重排/恢复/撤销服务、默认 `*-organized.pdf` plan-only 导出请求和安全输出路径测试；真实页面改写和完整 UI 后续接入。
- 2026-06-02：在 `feat/privacy-safety` 完成 `ISS-010` 第一版：新增联网 OCR 隐私 notice、consent decision、脱敏 audit record、`ocrPrivacyConsentGuard` 和 bridge audit 衔接；随后按 code review 收紧为本次 notice/consent 双匹配、输入文件指纹、nonce、有效期和 Rust audit 复验，旧布尔 consent 不能单独放行云端 OCR；真实 PaddleOCR/MinerU 调用和完整 UI 弹窗继续留给后续任务。
- 2026-06-02：在 `feat/pdf-output-tools` 完成 `ISS-013` 第一版：新增水印、页码、Bates 和压缩预设导出 operation，支持 `*-delivery.pdf` 安全输出请求；文字/图片水印、页码和 Bates 用 pdf-lib 写入新 PDF，压缩保持 plan-only 并记录后续真实处理边界。
- 2026-06-02：通过 Claude Code tmux worker 启动 `feat/ocr-quality` 推进 ISS-017；PM 接管修正测试和边界后，形成 OCR 质量报告共享契约、纯服务和定向测试。
- 2026-06-03：合并 `feat/ocr-quality`（ISS-017）和 `feat/evidence-image-pack`（ISS-018）到 `main`，27 测试文件、172 测试全部通过。
- 2026-06-03：在 `feat/reader-thumbnails` 推进 ISS-002 阅读深化第三步：`pdfReaderService` 暴露 `renderThumbnail(pageIndex, canvas, maxWidth)` 并按最长边等比缩放，1px 兜底避免 `maxWidth<=0` 时除零；`useReaderController` 透出该方法供 Sidebar 调用；`DocumentSummaryPanel` 用 IntersectionObserver 懒加载每个缩略图，未提供 `renderThumbnail` 时回退占位；`PdfPage` 用 `IntersectionObserver`（阈值 0.5）回调 `onPageVisible` 同步 `currentPage`；AppShell 把 `reader.setCurrentPage` 透传给 `ReaderCanvas`。
- 2026-06-03：`searchUi.test.tsx` 中"第 N 页"按钮名原先只匹配搜索结果列表，新增缩略图按钮后改为通过 `within(searchResults)` 作用域，避免在多个候选上抛 `getMultipleElementsFoundError`。
- 2026-06-03：按用户反馈中文化 git-workflow 描述部分：PR body 模板的 `## Summary` / `## Test plan` 改为 `## 摘要` / `## 测试计划`，PR 正文最低要求表区块改为「摘要」「测试计划」「Agent 归属」「关联任务」「风险」，references 中"Multi-Skill"改为"多 Skill"；保留英文类型前缀和通用 Git 术语。Skill 升级为 v1.2.0，并在 skill 自身和项目级 DECISIONS 同步记录。
- 2026-06-03：部署 doc-curator 项目级文档瘦身 subagent：`.claude/skills/doc-curator/`（SKILL.md / LICENSE.txt / CHANGELOG.md / config/faropdf.yaml / state.json / scripts/scan.sh / first-baseline.sh / maintenance-pr.sh / lib/{common,check-tasks,check-decisions,check-files}.sh）+ `.claude/agents/doc-curator.md`（自定义 Agent 注册，工具 Read/Grep/Glob/Bash/Edit/Write）；`AGENTS.md` Skill 强制调用表新增 doc-curator 行；`docs/TASKS.md` 新增 ISS-024，`docs/DECISIONS.md` 新增 DEC-028，`docs/ARCHITECTURE.md` 补角色说明，`.claude/skills/git-workflow/SKILL.md` 升级 v1.3.0 加 PR 创建后 / 合并后 post-action 触发小节；按用户反馈"再提交pr胡总和合并pr后去进行文档清理"采用 Agent 主动调起，不依赖 hooks。
- 2026-06-03：解耦 `docs/TASKS.md`：把 PDF Expert UI 探索素材池和品牌与视觉资产搬到 `docs/DESIGN.md`，把 PDF 算法素材池搬到 `docs/ARCHITECTURE.md`；完成态 ISS 任务卡缩成单行摘要并归档到 `docs/DECISIONS.md`「ISS 任务归档」；活跃任务和进度日志精简在 TASKS.md。
- 2026-06-03：首次跑 doc-curator first-baseline.sh：把 AGENTS.md / README.md / docs/{ROADMAP,ARCHITECTURE,DESIGN,DECISIONS,TASKS}.md / CHANGELOG.md 的真实行数与 TASKS.md 活跃任务卡数 9 写入 state.json baselines；后续 scan.sh 用基线 × 1.5 作为自适应告警阈值。同步修复 first-baseline.sh bug：原版把 `\n` 字面量写进 JSON 导致 state.json 不是合法 JSON，改用 `printf` 拼装 baselines 与外层结构。
- 2026-06-03：在 `feat/reader-toolbar-refactor` 推进 DEC-032 ReaderToolbar 注册表基础设施：新增 `src/components/layout/toolbarRegistry.ts`（`ToolbarState` / `ToolbarToolItem` 类型 + `registerModeTools` / `getModeTools` / `_resetToolbarRegistry` 函数）和 9 项单元测试；`Toolbar.tsx` 末尾新增 `ModeActiveTools` 组件，挂在 `toolbar__group--modes` 内 4 个 mode 入口按钮之后，按 `getModeTools(activeMode).slice().sort()` 渲染当前 mode 工具；activeMode="read" 时为 `[]`，UI 与重构前一致；typecheck / 332 项测试 / build 三件套全绿。后续 W3 Forms / W4 Reader modes worker 在各自模块内 `registerModeTools("<mode>", [...])` 即可接入 mode 工具，不再改 Toolbar.tsx。
- 2026-06-03：在 `feat/page-organizer-suite` 推进 DEC-033 page-organizer-suite 第二阶段（ISS-006 + ISS-018 真实改写）：原 PR #21 commit 63220eb 写的 DEC-032 段与 PR #20 冲突（PR #20 的 DEC-032 已被 reader-toolbar 占用），PM rebase 时改为 DEC-033。

## DEC-035 ISS-008 表单填写与签署第一版方案

- 日期：2026-06-04
- 状态：已采纳
- 关联分支：`feat/forms-signing`
- 关联任务：ISS-008
- DEC 编号说明：原 commit 53c91dc 写时用 `DEC-034`（base 是 59594d6 拉的无此编号），与已合并的 `DEC-034 阅读模式深化`（feat/reader-modes / PR #22）冲突；PM rebase 时改为 `DEC-035` 释放已占用编号。

承接 ISS-005 PDF 导出引擎和 ISS-002 阅读底座，本决策记录表单填写与签署第一版的边界，按 DEC-032 §"W3 Forms 接入指南"在 forms 模块内 `registerModeTools("forms", [...])` 注册 mode 工具按钮，**不**修改 `src/components/layout/Toolbar.tsx`。

### 契约扩展（`src/shared/pdf/form.ts`）

- 已有 `PdfFormField` / `PdfFormState` / `PdfFormFillingInput` / `PdfSignatureInput` / `validateXxx` 全部保留，向后兼容。
- 新增 `PDF_FORM_OPERATION_TYPES` 常量 + `PdfFormOperationType` 字面量联合（`"fill" | "sign" | "flatten"`）。
- 新增 `PdfFormOperation` 联合类型：
  - `PdfFormFillOperation { id, type: "fill", fieldId, value }`
  - `PdfFormSignatureOperation { id, type: "sign", fieldId, imageBytes, imageType }`
  - `PdfFormFlattenOperation { id, type: "flatten" }`
- 新增 `PdfFormFlattenSummary { fieldCountBeforeFlatten, fieldCountAfterFlatten, flattened }`。
- 新增 `PdfFormBatchRequest { id, pdfBytes, operations, requestedAt }` + `PdfFormBatchResult { id, bytes, appliedCount, failedCount, results, completedAt }`。
- 新增 `PdfFormOperationResult` 联合（`applied` / `failed` 两种状态 + 各 operation 类型的 success payload）。
- 新增 helper：`isPdfFormOperationType` / `isPdfFormOperation` / `validateFormBatchRequest`；后者要求 operations 非空，避免 `Array.every` 在空数组上 vacuously true。

### `formService` execute 能力升级（`src/modules/forms/formService.ts`）

- 修 `mapFormField` 的 `pageIndex`：之前硬编码 0，现在构造 `PDFDict → pageIndex` 查找表 —— 关键点：`page.node.Annots()` 元素是 `PDFRef`，而 `widget.dict` 是 `PDFDict`，必须 `context.lookup(ref, PDFDict)` 解析后才能比较引用相等。
- `signField` 复用同一 pageIndexMap，避免每次签名都遍历所有 page。
- 新增 `flattenForm(pdfBytes) → { bytes, summary }`：调用 pdf-lib `form.flatten()`，并产出 before / after 字段数。
- 新增 `applyFormOperations(request) → PdfFormBatchResult`：单次 `PDFDocument.load` 后按数组顺序执行每条 operation，**单条失败封装为 `status: "failed"` 结果不中断后续**；最终一次性 `pdf.save()` 输出新 bytes + appliedCount / failedCount + completedAt。

### Reader 扩展（`src/modules/reader/useReaderController.ts`）

- `openFile` 时缓存 `file.arrayBuffer()` Promise 到 `cachedFileRef`，加载失败时清空。
- 新增 `getFileBytes()` / `getCurrentFileName()` / `saveUpdatedBytes(bytes, suggestedFileName)` 三个方法。
- `saveUpdatedBytes` 用浏览器原生 `<a download>` + `URL.createObjectURL`，不依赖 Tauri command；建议文件名由 `forms` 模块用 `<原名>-<操作>.pdf` 模板生成。
- reader 仍是单一实例；多 controller 并存时各自缓存独立的 file bytes 引用。

### Forms mode 工具接入（DEC-032 §"W3 Forms" 指南落地）

- `src/modules/forms/activeFormController.ts` 提供模块级 setActiveFormController / getActiveFormController 桥：因为 `ToolbarState` 只暴露 `{ activeMode, reader, search }`，mode 工具 onClick 闭包拿不到 controller，桥让 worker 不修改 ToolbarState 类型。
- `src/modules/forms/registerFormsToolbarTools.ts` 注册 4 个 mode 工具到 `forms` 命名空间：
  - `forms.refresh`（order=10）→ `controller.refreshFormState()`
  - `forms.fill`（order=20）→ `controller.openPanel("fill")`
  - `forms.signature`（order=30）→ `controller.openPanel("sign")`
  - `forms.flatten`（order=40）→ `controller.flattenAndSave()`
  - 全部 `modeId: "forms"`、`isDisabled: (state) => !state.reader.state.document`、onClick 闭包通过桥调 controller。
- `src/modules/forms/FormProvider.tsx` 是顶层 Provider：
  - useEffect 注册 controller 到模块级桥，卸载时清空；
  - useEffect 在 `activeMode === "forms"` 时调 `registerFormsToolbarTools()`；
  - 渲染 children + 仅在 forms mode 挂载 `FormsPanel`。

### `useFormController` + `FormsPanel`

- `useFormController` 维护 formState / loading / errorMessage / successMessage / panelMode / selectedFieldId / draftValue / signatureImageBytes / signatureImageType；`reader.state.document?.documentId` 变化时 reset 全部状态。
- 提供 `refreshFormState` / `openPanel` / `closePanel` / `selectField` / `setDraftValue` / `setSignatureImage` / `clearSignatureImage` / `applyFieldEdit` / `applySignature` / `flattenAndSave` / `applyBatchAndSave` / `setErrorMessage` / `clearMessages` 13 个动作；`applyFieldEdit` 和 `applySignature` 完成后调 `saveUpdatedBytes` 触发浏览器下载，再重新 `readFormFields` 刷新 state。
- `FormsPanel`（`src/modules/forms/ui/FormsPanel.tsx` + `FormsPanel.css`）是绝对定位浮层（不修改 `src/styles/app.css`），按字段类型分组渲染 + 填值编辑器（text / dropdown / checkbox / radio）+ 签名图片选择（PNG / JPG）；错误 / 成功提示走独立 alert / status 区域。

### 测试

- `src/shared/pdf/form.test.ts`：16 项（新增 isPdfFormOperationType / isPdfFormOperation / validateFormBatchRequest 三组 helper 校验）
- `src/modules/forms/formService.test.ts`：21 项（新增多页 pageIndex 真实值、flattenForm、applyFormOperations 顺序执行 / 失败不中断 / 空 operation / 空 bytes 抛错 6 个用例）
- `src/modules/forms/activeFormController.test.ts`：4 项模块级桥
- `src/modules/forms/registerFormsToolbarTools.test.ts`：9 项注册 / onClick 桥 / 顺序
- `src/modules/forms/useFormController.test.tsx`：16 项 controller 行为（refresh / fill / sign / flatten / batch / 错误 / 成功 / 文档切换重置）
- `src/modules/forms/ui/FormsPanel.test.tsx`：16 项 UI 渲染 / 交互
- 全部 82 项新测试通过；总测试数 419 / 419（typecheck / build / cargo check --offline 全绿）

### 范围与依赖

- 修改：`src/shared/pdf/form.ts` + `src/shared/pdf/form.test.ts` + `src/shared/index.ts` + `src/modules/forms/**`（新增 + 扩展）+ `src/modules/reader/useReaderController.ts` + 对应测试。
- 不修改：`src/components/layout/Toolbar.tsx`（按 DEC-032 §"W3 Forms"指南用 `registerModeTools("forms", [...])` 接入）、`src/App.tsx` / 全局样式 / 路由、`package.json` / 锁文件、`src-tauri/Cargo.toml`、reader 已有公共 API 形状。
- **不**改 `AppShell.tsx` 的 ContextToolbar / UtilityPanel 槽位 —— Toolbar 工具条已通过 `ModeActiveTools` 渲染 4 个 forms mode 工具，FormsPanel 走绝对定位浮层，不依赖 utility panel。
- 不引入新 crate / 新 npm 包（签名图片 / 下载走浏览器原生 API）。

### 已知限制

- 当前 FormsPanel 是绝对定位浮层（fixed top:72 right:16），在窄屏（< 360px）会与主工具栏重叠；后续 layout worker 在 `feat/pdf-expert-shell-ia` 收口时可换 utility panel 路径。
- 签名图片必须 PNG / JPG（pdf-lib embedPng / embedJpg 不支持其他格式）；FormsPanel 在用户选非 PNG / JPG 时通过 setErrorMessage 提示。
- 扁平化后源 PDF 仍保留 `textLayerStatus: "missing"` 不会重新标记；后续如需要扁平化后自动 re-OCR 走 `feat/ocr-bridge` 的统一接口。
- 浏览器 `<a download>` 一次只触发一个文件；如果未来需要批量导出（多份填写版），需要切换到 Tauri save dialog。

## DEC-033 page-organizer-suite 第二阶段（ISS-006 + ISS-018 真实改写）

- 日期：2026-06-03
- 状态：已采纳
- 关联任务：ISS-006、ISS-018
- 分支：`feat/page-organizer-suite`
- DEC 编号说明：原 PR #21 commit 63220eb 写时用 `DEC-032`（base 是 ed39160 拉的无此编号），与 PR #20（DEC-032 ReaderToolbar）冲突；PM rebase 时改为 `DEC-033` 释放已占用编号。

决定：

- ISS-006 页面整理第一版（DEC-005 / 2026-06-02 工作日志）只完成状态机底座，导出请求维持 plan-only。第二阶段把 `pdfOperationEngine.page-operations` 在 `mode=execute` 下用 pdf-lib `copyPages` 真实改写 PDF：先按 `reorder.pageIndexes` 拷贝页面，删去 `delete.pageIndexes`，再对每个 rotate 操作把 `Rotate` 字典项写到 `PDFPage.node`；`pageOperationPlan.mode = "execute"`，`entries.status` 全部 `applied`。
- ISS-018 证据图片 A4 编排从 plan-only 推进到真实拾取 + 像素渲染 + 写入新 PDF。`imagePackItemResolver` 已经在第一版实现 PNG/JPEG 头部和 PDF 页面尺寸读取，仅 JPEG SOF marker 偏移写错（`offset+3` / `offset+5` 应当是 `offset+5` / `offset+7`，因为 marker 后还有 2 字节 length + 1 字节 precision 才到 height/width）；`imagePackRenderer` 在 drawPage 路径上把 `copyPages` 替换为 `embedPdf` —— 前者返回 `PDFPage[]` 不能喂给 `drawPage`，后者返回 `PDFEmbeddedPage[]` 才是正确类型（pdf-lib 1.17.1 在 vitest 4 下 `copyPages` 实际抛 `embeddedPage must be of type PDFEmbeddedPage, but was actually of type NaN`）。
- 新增 `src/modules/pages/imagePack/imagePackExecutor.ts` 作为端到端执行器：plan 校验 + 路径安全（绝对路径、`.pdf`、与 `plan.items[].sourcePath` 不同、storage 不存在 `outputPath`） + `createImagePackRenderer.renderPlan` 渲染 + `PdfExportStorage.writeNewFile` 写入；`src/modules/pages/imagePack/index.ts` 修正原有 `ImagePackFileReader` / `ImagePackRenderer` / `RenderImagePackPlanInput` / `RenderImagePackPlanResult` 误放到 `imagePackItemResolver` 的导出错误。
- 验证：45 个测试文件 / 350 个测试全部通过；`npm run typecheck` / `npm run build` / `cargo check --offline` 全部干净（仅遗留的 `OcrJobQueue::file_path` / `snapshot_by_backend` dead_code warning 与本期无关）。
- 共享 execute 模式：ISS-006 与 ISS-018 都遵循"plan 校验 → 路径安全 → 引擎执行 → storage 写入"四步式，错误统一经 `sanitizePdfExportError` 脱敏。
- 范围：仅 `src/modules/pages/imagePack/` + `src/modules/pages/pageOrganizer.ts` + `src/modules/export/pdfOperationEngine.ts` + 对应单测；**不动** `src/components/layout/Toolbar.tsx` / `src/App.tsx` / 全局样式 / 路由 / `package.json` / 锁文件 / `src-tauri/`（无新 crate 引入）。

不采纳（本期暂缓）：

- ISS-018 行布局（per_page=4 拆成 2×2）按 DEC-005 决定继续保留单行算法。
- 真实目录拾取 / 文件对话框：仍由后续 UI worker 接入 toolbar，本分支只暴露 executor 给前端的 `createImagePackExportRequest`（后续 PR 提）。
- OCR / 扫描模块、Tauri command、PR 推送：本期按 worker 协议不推送，待 PM 合 review 后再发。

## DEC-034 阅读模式深化（连续/单页/双页/适合宽度 + 缩放/旋转/键盘翻页）

- 日期：2026-06-04
- 状态：已采纳
- 关联任务：v0.1-§2 阅读模式深化
- 分支：`feat/reader-modes`

决定：

- **数据模型扩展**：`PdfViewMode` 从 `continuous | single | double` 扩展为 `continuous | single | double | fit-width`；`PdfDocumentState` 增加 `rotation: 0 | 90 | 180 | 270` 字段；新增 `ZOOM_PRESETS` 清单（50/75/100/125/150/200% + 适合宽度/适合页面 8 项）和 `ReaderSession` 持久化类型（fingerprint + currentPage + zoom + viewMode + rotation + savedAt）。
- **viewMode 分层**：`calculateReaderRenderRange` 已经在 "double" 模式包含 2 页，新 `fit-width` 模式复用单页路径（1 页 + overscan），无需修改虚拟化层。
- **缩放计算与 viewMode 关注点分离**：`viewMode = "fit-width"` 时 `document.zoom` 仍记录用户手动值，渲染层通过 `resolveEffectiveZoom({ viewMode, manualZoom, pageWidth, containerWidth })` 按 `ResizeObserver` 测得的容器宽度实时计算；其它 viewMode 直接使用 `manualZoom`。`applyZoomPresetId` 把 8 个预设 id 转换为 viewMode + zoom：
  - 数字预设（0.5/0.75/1/1.25/1.5/2）：直接设置 zoom；若当前 viewMode 是 fit-width 则回退到 continuous；
  - 适合宽度：切换 viewMode = fit-width，zoom 由渲染层覆盖；
  - 适合页面：切换 viewMode = single。
- **适合宽度 / 适合页面计算**：`calculateFitWidthZoom(pageWidth, containerWidth)` = `(containerWidth - 16) / pageWidth`（16px padding 避免水平滚动条抖动）；`calculateFitPageZoom` 取宽高两个限制的较小值。两者都把结果夹紧到 [0.25, 4]，并在容器尺寸 ≤ 0 时回退到 1 兜底。
- **持久化**：`readerSessionStorage` 抽象为 `ReaderSessionStorage` 接口，提供 `createLocalStorageReaderSessionStorage`（生产）和 `createMemoryReaderSessionStorage`（测试）两个实现；key 命名空间 `faropdf:reader-session:<fingerprint>`；`normalizeReaderSession` 在读取时对全字段做类型校验。`useReaderController` 通过 `useEffect` 在文档加载时（fingerprint 匹配）恢复 session，在 currentPage/zoom/viewMode/rotation 任意变化时写回；首次加载完成前不写回，避免把默认值覆盖到 storage。
- **键盘翻页**：新增 `useReaderKeyboard` hook，绑定 `keydown` 全局监听：PageDown/Space/ArrowDown/ArrowRight 推进，PageUp/ArrowUp/ArrowLeft 回退，Home/End 跳首尾；double 模式下 Arrow 步进 2 页；input/textarea/contenteditable 元素内和 Cmd/Ctrl/Alt 组合键不拦截。
- **UI 渲染**：`ReaderCanvas` 抽出 `DocumentReader` 子组件，通过 `ResizeObserver` 监听容器宽度，fit-width 实时计算 effectiveZoom；rotation 90/270 时交换宽高参与计算；double 模式用 `flexDirection: row` 并排，其它模式 `column` 纵向；`PdfPage` 在单/双页模式下点击页边空白翻页（左半上一页、右半下一页）。`Sidebar.tsx` 的 `ViewSettingsPanel` 扩展为 4 视图按钮 + 8 缩放预设 + 顺/逆时针 90° 旋转按钮；`AppShell` 接入 `reader.rotateClockwise / rotateCounterClockwise / setZoomPreset` 并按 0.01 容差推断 `activeZoomPresetId`。
- **mode 工具注册**：新增 `registerReadModeTools()` 通过 `registerModeTools("read", [...])` 注册 3 个工具：顺时针 / 逆时针 / 适合页面；自动出现在 `Toolbar.tsx` 的 `ModeActiveTools` 区域；`App.tsx` 启动时一次性调用。**未直接修改 `Toolbar.tsx`**（PR #20 DEC-032 注册表已就位）。
- **范围**：`src/modules/reader/{readerState,useReaderController,viewMode,readerSessionStorage,useReaderKeyboard,readerModeTools,readerLabels,index}` + `src/components/layout/{ReaderCanvas,Sidebar,AppShell}` + `src/shared/pdf/types` + `src/shared/settings/defaults` + 对应单测；**不动** `src/components/layout/Toolbar.tsx`（PR #20 约束）/ `src/App.tsx` 主结构（仅追加 `registerReadModeTools()`）/ `package.json` / 锁文件 / `src-tauri/` / 全局样式。
- **验证**：53 个测试文件 / 435 个测试全部通过；`npm run typecheck` 干净；`npm run build` 成功（261.71 kB → 81.88 kB gzip）。

不采纳（本期暂缓）：

- fit-width 模式下当前缩放值不写回 `document.zoom`，避免与用户手动缩放相互覆盖；后续如需"记住上次的适合宽度缩放"可单独提一个 PR。
- 双页模式是否需要 spread 起始页在奇数页（书籍样式）vs 偶数页（演示样式）暂不区分，按当前页号直接渲染；后续阅读体验 worker 提。
- rotation 通过 CSS `transform: rotate()` 旋转 section，未在 PDF.js 渲染阶段（`getViewport({ scale, rotation })`）传 rotation — 这样会让 canvas 像素本身正确旋转；本期保留 CSS 旋转，理由是 pdf-lib 不参与 canvas 渲染、PDF.js 渲染已能正确处理内嵌 rotation；后续若发现宽高 swap 不准确再切到 PDF.js 原生 rotation 参数。
- 缩放预设的「适合页面」目前用 `viewMode = "single"` + 保留当前 zoom，由渲染层在 `ResizeObserver` 触发时把 effectiveZoom 算到 container size 上后写回 `document.zoom`；本期先实现 UI 入口 + 缩放计算函数，写回动作由下一批 UI worker 接入。

## DEC-036 ISS-013 第二阶段（真实压缩 + 中文字体）延期与 scope-fontkit 决策

- 日期：2026-06-04
- 状态：已采纳（延期）
- 关联任务：ISS-013（导出真实图像重编码 + 中文字体）
- 关联分支：`feat/export-real-encoding`（Wave 3 W5 / 2026-06-04 启）

### 背景

ISS-013 第一版已在 main（PR 合并见 DEC-013 段 2026-06-02 进度日志 + DEC-005 / DEC-013），文字/图片水印、页码和 Bates 编号导出 operation 走 pdf-lib 真实写入，压缩维持 plan-only，水印字体仅 Latin-1。Wave 3 W5 worker 在 `feat/export-real-encoding` 启动后第一动作验证完 worker isolation gate 即触发 scope-fontkit 物理冲突，停在 `status: "blocked" / phase: "scope-conflict"`，未进入实现阶段。

### 物理冲突

- 目标：导出引擎真实图像重编码 + 中文字体支持（中文水印 / 中文页码 / 中文 Bates）。
- pdf-lib 1.17.1 嵌入自定义字体必须安装 `@pdf-lib/fontkit`（pdf-lib 官方 devDep，README §645 明确：`pdf-lib relies on @pdf-lib/fontkit ... You must add the @pdf-lib/fontkit module to your project and register it using pdfDoc.registerFontkit(...) before embedding custom fonts.`）。
- 当前 `package.json` / `package-lock.json` 没有 `@pdf-lib/fontkit` 传递依赖，`node_modules/@pdf-lib/` 目录下仅有 `standard-fonts` / `upng`，缺 fontkit。
- Wave 3 W5 worker prompt 写有"不修改 `package.json` / 不引入 npm 字体包 / 用纯 pdf-lib + 系统字体路径"约束，与"中文水印 / 中文页码 / 中文 Bates"目标物理冲突：纯 pdf-lib + 系统字体路径仍需 fontkit 解析 OTF/TTF 表，绕不开。
- 三种选项及决策：
  1. **添加 `@pdf-lib/fontkit` 作为 devDep**（推荐方向，技术上唯一可行）：npm install + 改 package.json + package-lock.json + 1 个新依赖（~50KB），可直接走标准 pdf-lib embedFont 路径支持 OTF/TTF。
  2. **放弃中文字体，只做真实压缩**（窄范围收口）：完成 ISS-013 第二阶段 = 真实压缩（pdf-lib `PDFDocument.save({ useObjectStreams: true })` + 图像重采样），中文字体延后到后续 task。
  3. **走 macOS 系统字体路径**（`/System/Library/Fonts/`）：需为每个平台写字体解析器（macOS TTC collection / Windows TT / Linux TTF），且无 fontkit 仍无法 parse 字体表，不实用。

### 决定

- **延期**ISS-013 第二阶段到下一波 worker（有 PM 兜底时再启），原因：
  1. Wave 3 W5 worker 在 bootstrap 阶段即停，未产出实现，无可收口产物；当前 wave 3 已收口 2 个 PR（#22 阅读模式深化 / #23 表单填写与签署），整体推进度足够。
  2. 选项 1（添加 `@pdf-lib/fontkit`）需要在 worktree 内 `npm install` + 改 `package.json` / `package-lock.json`，超出"不修改 `package.json`"原约束；应由 PM 在重启 worker 时显式放开约束并明确 fontkit 是 pdf-lib 官方 devDep，不算"npm 字体包"——下一波 worker 启前必须重写 prompt。
  3. 选项 2 拆分会破坏任务完整性（中文字体与真实压缩都需要 fontkit 路径，拆开后两半都做不深）；不如整段延后。
  4. 选项 3 工程上不实用。
- **当前状态保留**：`feat/export-real-encoding` worktree 在 `59594d6`（base 落后 main 2 commit），无业务 commit；STATUS.json `status: "blocked"`，issue 列表保留 scope-fontkit 三选项备查。
- **关闭 worktree / tmux session / 分支**：`git worktree remove` + `git branch -D feat/export-real-encoding`（本地不推送）。
- **下一波重启条件**：有人值守 + 重写 worker prompt 明确"@pdf-lib/fontkit 是 pdf-lib 官方 devDep，可装；选开源协议中文字体（OFL / Apache 2.0 / MIT）下载到 `assets/fonts/`"+ 选思源黑体 / 思源宋体 / 霞鹜文楷之一。
- **ISS-013 状态**：维持"已完成交付工具导出底座第一版"，第二阶段从"延期"标签继续；ROADMAP §138 进度行 + DEC-013 段保留底座说明。
- **CHANGELOG / TASKS 同步**：在 0.1.0-alpha.7 段末尾追加延期说明 + docs/TASKS.md ISS-013 任务卡加延期原因（"待引入 @pdf-lib/fontkit 重启 worker"）。

### 不采纳（本期暂缓）

- 走 `pdf-lib` 自带的 14 个 StandardFont 中任一中文兼容字体（不存在：StandardFont 全部 Latin-1 / 中欧字符集）。
- 把中文字体图章化（即把中文字符栅格化为 PNG 后 `embedPng`）—— 仍需嵌入图片路径并通过 fontkit 等价物把字形拆解，本质与 embedFont 等价，复杂度更高。
- 在 `src-tauri/` 加 `rustybuzz` / `ttf-parser` 解析 OTF/TTF 表后由 Tauri command 输出 font bytes 给前端——超出 ISS-013 scope，需 Tauri 桥接链路改造。

### 范围与影响

- 范围：仅本文档 + `docs/ROADMAP.md` §138 状态行 + `docs/TASKS.md` ISS-013 任务卡 + `CHANGELOG.md` 0.1.0-alpha.7 段 + worktree 清理。
- 不影响：PR #22 / PR #23 已合并的 reader-modes / forms-signing 不变；现有导出 operation 不变；压缩仍维持 plan-only 摘要。
- 后续：若用户要求立即推进，第二阶段 worker prompt 必须显式写"@pdf-lib/fontkit 是 pdf-lib 官方 devDep，可装"，并指明字体协议（OFL / Apache 2.0 / MIT），且 PM 必须提供 `npm install` 后的版本指纹给 user 复核。

