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
- DEC 编号说明：原 commit 42f4489 写时用 `DEC-037`（base 是 d1df565 拉的无 PR #22/#23 之后的批注 DEC），与已合的 `DEC-037 批注深化第二阶段`（feat/annotation-stage-2 / PR #24）冲突；rebase 时改为 `DEC-038` 释放已占用编号。

## DEC-037 批注深化第二阶段：侧边栏 4 维度分组 + 真实 PDF 绘制导出

- 日期：2026-06-04
- 状态：已采纳
- 关联分支：`feat/annotation-stage-2`
- 关联任务：ISS-026（第二阶段）

承接 DEC-031（第一版底座）+ DEC-015（sidecar 模型）+ DEC-019（plan-only 批注扁平化）+ DEC-032（mode 注册表），本决策记录 ISS-026 第二阶段三件套：批注侧边栏 4 维度分组与搜索/筛选、批注 → PDF 真实绘制导出、AnnotationSidebar 独立组件。

### sidebarGroups 4 维度分组纯函数

- 新增 `src/modules/annotation/sidebarGroups.ts`：
  - `AnnotationSidebarGroupBy = "page" | "color" | "type" | "label"` 4 维度；`ANNOTATION_SIDEBAR_GROUP_BY_LIST` / `ANNOTATION_SIDEBAR_GROUP_BY_LABELS` 暴露给 UI。
  - 4 个分组函数 + 1 个通用 `groupAnnotations(annotations, groupBy)`：按页码（1-based 标题）、按颜色（按 6 色色板定义顺序、未知颜色归"其他颜色"末尾）、按类型（按 `PDF_ANNOTATION_TYPES` 固定数组顺序保证 9 类型稳定）、按标签（stamp.label 优先，回退 content/quote 截断到 24 字；保留首次出现顺序）。
  - `deriveAnnotationLabel` 单一来源：stamp.label > content > quote；空时返回 null。
  - `applyAnnotationSidebarFilters(annotations, filters)`：组合 query / types / pageNumbers / colors / labels（colors/labels 多选 OR、其他 chip 维度 AND）；底层复用 `searchAnnotations` 的 query/types/pageNumbers + 颜色 hex 归一化比较。
  - `collectAnnotationLabelChoices` / `ANNOTATION_SIDEBAR_COLOR_CHOICES`（6 色）/ `ANNOTATION_SIDEBAR_TYPE_CHOICES`（9 类型）给 UI 提供筛选 chip 选项。
  - `sidebarFiltersFromSearch` / `sidebarFiltersToSearch` 在 search options 与 sidebar filters 之间双向转换；colors 多个时不退化为单 `color` 字段。
  - 28 项单测覆盖 4 维度分组 / 标签提取 / 颜色排序 / 筛选组合 / options 互转。

### annotationPdfWriter 真实 PDF 绘制导出

- 新增 `src/modules/annotation/annotationPdfWriter.ts`：
  - `writeAnnotationPdf({ sourceBytes, sidecar, sourceFingerprint? })` 入口；输出 `{ bytes, summary, suggestedFileName: "*-annotated.pdf" }`。
  - 用 `pdf-lib`（已在 dependencies，1.17.1）真实绘制 9 种批注：
    - highlight / note / textbox：透明填充矩形（opacity 默认 0.35，textbox 用 Helvetica 居中绘制 content）
    - underline / strikeout：在 rect 底部 / 中部画线
    - rectangle / note：边框矩形（无填充）
    - arrow：line + 三角箭头头部（用 `drawLine` 三次）
    - ink：所有 stroke 串联为 `M x y L x y ...` SVG path，`drawSvgPath` 一次绘出
    - stamp：drawText 居中绘制 stamp.label（中文 / 非 Latin-1 字符不被 WinAnsi 编码时静默跳过文字、仍画边框）+ 边框矩形；不算入 skipped（"尽力而为"语义）
  - 颜色解析接受 3 位 / 6 位 hex；非法颜色单批注跳过并记录原因，不影响其他批注。
  - 越界 rect 走 `clampRectToBounds`（DEC-031 几何裁剪语义），不抛错；clamp 后面积为 0 时该批注被标记为 skipped。
  - pageIndex 越界、sidecar.pageCount 与源 PDF 不一致、fingerprint 不匹配、schema 版本不匹配、空 source bytes、非法 PDF 字节 — 全部在调用方层尽早抛错并脱敏（`sanitizePdfExportError`）。
  - 输出 PDF 元数据写入 `faropdf:annotation-flattened` / `faropdf:annotation-count:N` / `faropdf:annotation-drawn:N` 关键字。
  - `summary` 包含 inputPageCount / outputPageCount / annotationCount / drawnCount / skippedCount / skipped（每条 annotationId + type + reason）/ pageDrawCounts（按 0-based pageIndex 累计）/ fingerprintChecked。
  - 20 项单测覆盖：9 批注全绘、空 sidecar、越界 rect、颜色非法 / 3 位 hex、空文本框、中文 WinAnsi 跳过、缺 line / ink 字段、pageIndex 越界、pageCount 不一致、指纹不匹配、空 / 非法 PDF、schemaVersion 不匹配、opacity clamp、suggestedFileName、fingerprintChecked。

### AnnotationSidebar 独立组件

- 新增 `src/components/layout/AnnotationSidebar.tsx`（受控组件）+ `AnnotationSidebar.test.tsx`（18 项单测）。
- Props：`hasDocument` / `annotations` / `currentPage`（1-based，active row 高亮）/ `pageCount` / `onSelectPage(pageIndex: number)`（0-based，与现有 `AnnotationListPanel` 协议一致）/ `activeAnnotationId`（透传 `AnnotationOverlay`）/ `onAnnotationClick(id)`。
- UI：顶部 segment control 切换 4 维度分组；搜索 input（query）；筛选 chip 区（type 9 chip、color 6 色板、page 1-12 数字 chip、label 来自 `collectAnnotationLabelChoices`）；清除筛选按钮；分组列表（每组 header 显示标题 + 计数）；空态两态（无文档 / 无批注 / 筛选后无结果）。
- **不挂 AppShell**：组件 self-contained、props 受控；接入由 layout worker 在后续 PR 处理（与第一版 Overlay/Toolbar 同样策略，避免本分支越界修改 Toolbar/AppShell/Reader）。
- 18 项单测覆盖基础态 / 4 维度分组 / 搜索过滤 / 4 类 chip / 清除筛选 / 跳转 / 选中高亮 / 空态。
- 复用现有 CSS 命名（`annotation-sidebar` / `annotation-sidebar__*`），未污染全局样式；本分支**不**写 CSS（设计 worker 在 `docs/DESIGN.md` 后续 PR 补齐或现有 utility-panel 样式类复用）。

### 范围与依赖

- 修改：`src/modules/annotation/index.ts`（追加 sidebarGroups / annotationPdfWriter 导出）、`docs/DECISIONS.md`（本节）、`docs/TASKS.md`（ISS-026 进度）、`CHANGELOG.md`（0.1.0-alpha.8 段）。
- **新增**：`src/modules/annotation/sidebarGroups.ts` + `.test.ts`、`src/modules/annotation/annotationPdfWriter.ts` + `.test.ts`、`src/components/layout/AnnotationSidebar.tsx` + `.test.ts`。
- **不修改**：`package.json` / 锁文件 / `src/components/layout/Toolbar.tsx` / `src/components/layout/AppShell.tsx` / `src/components/layout/Sidebar.tsx`（已有 `AnnotationListPanel` 不动，新组件独立挂载）/ `src/App.tsx` / 全局样式 / 路由 / `src/modules/reader/` / `src/modules/export/` / `src/modules/forms/` / `src/shared/pdf/annotation.ts`（sidecar schema 不变）/ `src-tauri/Cargo.toml`。
- 沿用既有 pdf-lib 1.17.1，无新依赖；`pdfOperationEngine.exportPdf` 的 `flatten-annotations` operation 仍保持 plan-only 策略（本决策不修改其行为），后续可让 engine 复用 `writeAnnotationPdf` 作为底层。

### 已知限制

- 批注扁平化导出当前通过 `writeAnnotationPdf` 独立函数暴露，**未**接入 `pdfOperationEngine.exportPdf` 的 `flatten-annotations` 路径。整合方式由后续导出 worker 决定（保持 plan-only summary 字段 / 升级为 execute 二选一，本期不决）。
- stamp 文字使用 Helvetica 真实绘制 Latin-1 字符；中文 stamp label 静默跳过文字但仍画边框。中文真实字形留待 ISS-013 第二阶段字体方案（DEC-036 延期项）重启后并入。
- AnnotationSidebar 当前不挂 AppShell，UI 验收需 layout worker 接入后浏览器截图；本分支只保证组件自洽与可测。
- `*-annotated.pdf` 建议输出名由调用方按 `deriveAnnotationOutputPath` 之类安全路径（DEC-005 输出保护）生成；本期不实现 `deriveAnnotationOutputPath`，由调用方提供绝对新路径。

## DEC-038 设置页面 UI 整合方案（ISS-022 + ISS-023 第一版）

### 背景

ISS-022 把现有扁平的 `SettingsPanel` 升级为左侧导航 + 多 section 浮层，至少 5 个 section（常规 / 阅读 / OCR provider / 快捷键 / 关于）；ISS-023 在「关于」section 集中展示应用 icon、版本号、官网 / GitHub 链接、当前更新状态、作者卡。ISS-021 tauri-plugin-updater 尚未合入，ISS-023 的「检查更新」按钮本期仅放占位。需求见 `docs/TASKS.md` ISS-022 / ISS-023 任务卡 + `docs/ROADMAP.md` v0.3 §9 + DEC-013（设置面板与 OCR provider 契约保持兼容）。

### 目标与决策

1. **section 拆分**：`src/modules/settings/SettingsPanel.tsx` 退化为容器（Portal 浮层 + 左侧 nav + 右侧 content），具体 5 个 section 拆到 `src/modules/settings/sections/`（GeneralSection / ReaderSection / OcrProviderSection / ShortcutSection / AboutSection + `sections/types.ts` 共享 SectionId / SECTION_LIST / SectionProps）。`AppSettings` 已有字段复用，**不**新增 setting 字段。
2. **浮层壳走 Portal + createPortal**：用 React `createPortal` 渲染到 `document.body`，`Esc` 关闭、点遮罩关闭、打开时焦点抢到关闭按钮、关闭时恢复触发元素焦点；`role="dialog" aria-modal="true" aria-label="设置对话框"`。CSS 落到 `SettingsPanel.css`（独立文件，不污染 `src/styles/app.css`），复用 `--bg / --surface / --border / --fg / --muted / --accent` 设计 token。
3. **AppShell 接线**：原 `utilityPanel === "settings"` 在 AppShell 内 UtilityPanel 占位（返回 `null`），`SettingsPanel` 整体上移到 AppShell 顶层（`<div class="app-shell">` 的 StatusBar 之后）；AppShell 新增 `onSettingsChange?: (settings) => void` prop。App 层从 `useMemo(createDefaultAppSettings)` 改为 `useState`，新增 `handleSettingsChange` 走 `setSettings`（SettingsService 持久化后续接入）。
4. **窄屏适配**：宽度 < 768px 时左侧 nav 自动折叠为顶部 tab，CSS grid 重排为「header / topnav / content」三行。`@media (max-width: 767px)`。
5. **元数据来源**：`src/shared/app/metadata.ts` 暴露 `readAppMetadata()` + `FALLBACK_APP_VERSION`；名称 / 版本优先 `tauri.conf.json` 的 `productName` / `version`（面向用户），描述 / 主页 / 仓库 / 作者读 `package.json`。为支持「关于」展示，package.json 新增 `description` / `homepage` / `repository` / `author` 4 个 metadata 字段（**不**引入任何新依赖）。
6. **关于 section**：
   - 应用 icon：直接 import `src-tauri/icons/128x128.png`（Vite 在构建时把它内联为 URL）。
   - 版本号：`tauri.conf.json.version` 优先；`FALLBACK_APP_VERSION = "0.0.0"` 兜底。
   - 官网 / GitHub：read `package.json.homepage` / `package.json.repository.url`，**不**硬编码。
   - 检查更新按钮：本期显示「当前环境不支持自动更新」+ 「ISS-021 集成后启用」提示；不接 `tauri-plugin-updater`。
   - 作者卡：占位结构（姓名 + GitHub 链接 + 公众号二维码说明），二维码图片留待后续迭代。
7. **快捷键 section 只读**：当前仅展示内置快捷键（阅读翻页 / 缩放与旋转 / 工具切换）；可编辑快捷键配置不在本期范围。
8. **OCR provider 行为兼容**：保持原有 `apiKeyRef` 脱敏、endpoint + key 引用、network consent 校验逻辑；`exportSafeAppSettings` 在 SettingsPanel 容器入口处脱敏后下传 section（section 内的 placeholder 不再展示明文）。`validateAppSettings` 错误展示交给 SettingsService 后续接入（本期不在浮层里渲染错误列表，section 内自带提示即可）。
9. **测试策略**：每个 section 独立 test（受控 wrapper `ControlledHarness` 模拟父组件 `useState`，避免链式操作看到陈旧 `settings`）；SettingsPanel 容器 test 覆盖 portal 关闭 / 5 section nav 顺序 / section 切换 / Esc / 遮罩 / 焦点抢占 / 窄屏顶部 tab。`App.test.tsx` 旧的 aside 断言改为 dialog 断言。`src/test/setup.ts` 加 `window.matchMedia` jsdom 兜底（v29 jsdom 缺实现）。
10. **持久化**：本期 `App.handleSettingsChange` 仅 `setSettings(next)`，不接 `SettingsService.updateSettings` —— 校验失败的回滚路径由后续 worker 接入 ISS-021 / SettingsService 时一并处理。

### 不采纳

- 把 SettingsPanel 拆到 `src/components/SettingsPage.tsx` + `src/components/settings/`：与既有「模块按 feature 划分」约定（`src/modules/forms/`、`src/modules/ocr/`）不一致；本任务采用「`src/modules/settings/` + 子目录 `sections/`」与现有架构对齐。
- 引入路由 / lazy import / Suspense 拆分 section：当前 5 section 加起来 < 50KB，未到必须 lazy 的体量；TASKS §"非首屏 section 走 lazy" 留待后续 PR，PM 显式要求时再开。
- 复制 `src-tauri/icons/128x128.png` 到 `src/assets/`：避免资源重复；Vite 仍能 import `src-tauri/` 下静态资源。
- 在 metadata.ts 硬编码 GitHub URL / author：违反「不硬编码 URL」约束；全部走 `package.json` 读取。
- `tauri-plugin-updater` 提前集成：ISS-021 在 v0.3 后续，本期「检查更新」按钮只展示占位文案。

### 范围与影响

- 范围：新增 `src/shared/app/metadata.{ts,test.ts}`、`src/modules/settings/sections/` 14 个文件、`src/modules/settings/SettingsPanel.{tsx,css,test.tsx}` 重写、`src/components/layout/AppShell.tsx` 加 `onSettingsChange` 与 SettingsPanel 顶层挂载、`src/App.tsx` `useState` + `handleSettingsChange` 接线、`src/App.test.tsx` 跟随更新、`src/test/setup.ts` 加 matchMedia polyfill、`package.json` 加 metadata 字段、文档同步（`docs/DECISIONS.md` / `CHANGELOG.md` / `docs/TASKS.md`）。
- 不影响：`Toolbar.tsx` 维持原状（设置按钮、utility panel 切换契约不变）；`shared/settings/{types,defaults,service}.ts` 契约与 `validateAppSettings` 不动；其他模块（reader / annotation / forms / pages）零修改。
- 已知限制：
  - 「检查更新」按钮仅展示占位文案（ISS-021 集成后替换）。
  - 「快捷键」section 仅展示，不支持编辑（留待后续 ISS）。
  - 校验错误展示由 SettingsService 调用方处理，浮层内不展示。
  - 「关于」section 的作者卡无微信公众号二维码图片（说明文字先就位，图片留待后续）。
  - 浮层未做完整 focus trap（仅打开抢焦点 + 关闭恢复），未来如需 WCAG AAA 可加 `tabindex=-1` trap。
- 后续：ISS-021 tauri-plugin-updater 集成时，把「检查更新」按钮的 `handleCheckUpdate` 替换为 `checkForAppUpdate`，并把 `App.handleSettingsChange` 接到 `SettingsService.updateSettings` 走持久化。

## DEC-039 ISS-013 第二阶段 v2 落地（真实压缩 + 中文字体）

- 日期：2026-06-04
- 状态：已采纳
- 关联任务：ISS-013（第二阶段）
- 关联分支：`feat/export-real-encoding`
- 关联 PR：#26
- DEC 编号承接 DEC-036（v1 延期）→ DEC-037（批注第二阶段）/ DEC-038（设置页）→ DEC-039（本期）

承接 DEC-013 + DEC-023 + DEC-036（scope-fontkit 延期），按 DEC-036 重启条件落实 ISS-013 第二阶段。

### 1. fontLoader + 中文字体资源

- 新增 `src/shared/pdf/fontLoader.ts`：
  - `FontBytesLoader` 抽象 + `embedChineseFont(pdfDoc, options)` 入口
  - `containsCjk(text)` 字符检测（CJK Unicode 范围 + 半角 → 全角 + 假名）
  - `getFontkit()` 懒加载 + 缓存 `@pdf-lib/fontkit` 实例
  - `registerFontkitForDocument(pdfDoc, fontkitInstance)` 显式注册到 pdf-lib
  - vitest 1.x 默认不解析 Vite `?arraybuffer` 资源，默认 loader 加 `readFileSync` fallback
- 中文字体资源：
  - 选 **思源黑体 SC Regular**（`SourceHanSansSC-Regular.otf`，16.5MB，OFL 1.1 协议）
  - 来源：adobe-fonts/source-han-sans GitHub release
  - 路径：`assets/fonts/SourceHanSansSC-Regular.otf`
  - 协议：复制 OFL 1.1 全文到 `assets/fonts/LICENSE-SourceHanSans.txt`
- `@pdf-lib/fontkit` 安装为 devDep（pdf-lib 官方 devDep，npm install 自动改 `package.json` + `package-lock.json`，按 DEC-036 重启条件允许）

### 2. compressionService 真实压缩

- 新增 `src/modules/export/compressionService.ts`：
  - `compressPdf(bytes, options)` 入口：走 `PDFDocument.save({ useObjectStreams: options.useObjectStreams ?? true })`
  - 输出 `{ bytes, ratio, imageInventory, originalBytes, compressedBytes }` 元数据
  - `imageInventory`：`{ imageCount, flateDecodeCount, dctDecodeCount, otherCount }`，按 PDF 资源树遍历 page → XObject → 统计 Subtype=/Image
  - **图像重采样** 计划为 plan-only fallback：当前 pdf-lib 不直接提供 image 重新编码能力，CMYK/JPEG 保留原图
- 集成到 `pdfOperationEngine.ts`：
  - `mode: "apply"` 走真实 `compressPdf`，label 包含 `court-upload (ratio 0.42)` 格式
  - `mode: "plan-only"` 仍记录计划摘要（不报错）
  - 修 `PDFDict.lookup` 防御：先 `instanceof PDFDict` 判断再操作
  - 修 `PDFName.encodedName` 私有属性 → 改用 `toString()` 公开 API

### 3. fontAwareWatermark + 中文水印

- 新增 `src/modules/export/fontAwareWatermark.ts`：
  - `resolveTextFont(pdfDoc, text, options)` 路由：CJK → `embedChineseFont`、Latin → `StandardFonts.Helvetica`
  - 测试支持注入 `chineseFontBytes` / `chineseFontLoader` override
- 集成到 `pdfOperationEngine.ts`：
  - watermark / page-number / bates 路径全部改走 `resolveTextFont`
  - CJK 字符（"机密文档" / "第 1 页 / 共 1 页" / "合同-1-号"）自动用思源黑体
  - 中文 stamp label 仍 fallback Helvetica（pdf-lib 标准字体不支持 CJK）

### 4. Bates 默认行为修正

- `normalizeBatesDigits(undefined)` 默认值 6 → 0（**PM 修**：worker 默认 6 与测试期待 0 矛盾）
- 0 表示无 0-pad（"合同-1-号"），6 表示 6 位 0-pad（"合同-000001-号"）
- 显式传 `digits` 字段不受影响

### 5. 验证

- `npm run typecheck` ✅
- `npm test -- --run` ✅ 69 文件 / 621 测试全过（19 项新测试：fontLoader 9 + compressionService 4 + fontAwareWatermark 6）
- `npm run build` ✅
- `cargo check` ✅

### 6. 已知限制

- vitest 1.x 不支持 Vite `?arraybuffer` 资源，fontLoader 加 `readFileSync` fallback 兜底；生产环境（vite build）走 `?arraybuffer` 正常路径
- 图像重采样是 plan-only fallback：CMYK / JPEG / FlateDecode 之外的 Filter 走原图，pdf-lib 不提供 embed 时降采样 API
- stamp 文字使用 Helvetica，中文 stamp label 静默跳过文字（保留边框）
- 字体未做 subset 优化（`{ subset: true }` 已加但 16MB → PDF 输出仍较大），后续按需优化
- fontkit 实例全局缓存，多 PDF 文档间共享，不支持 per-document override

### 7. 范围与依赖

- 修改：`package.json` + `package-lock.json`（加 `@pdf-lib/fontkit` devDep）+ `src/shared/pdf/fontLoader.ts` + `src/modules/export/compressionService.ts` + `src/modules/export/fontAwareWatermark.ts` + `src/modules/export/pdfOperationEngine.ts` + `src/modules/export/pdfOperationEngine.test.ts` + `src/shared/pdf/export.ts` + `src/vite-env.d.ts` + `docs/DECISIONS.md` + `CHANGELOG.md` + `docs/TASKS.md` + `docs/ROADMAP.md`
- 新增：`assets/fonts/SourceHanSansSC-Regular.otf` + `assets/fonts/LICENSE-SourceHanSans.txt`
- 不修改：`Toolbar.tsx` / `App.tsx` / 全局样式 / 路由 / `src-tauri/Cargo.toml`（沿用 pdf-lib）
- 不破坏：现有导出 operation 的 plan-only 行为（mode=plan-only 仍工作）

### 8. PM 自主决策痕迹

按 SKILL v1.9.7 防逃逸门禁例外（用户授权"可以按照你的思路去推进吧"）+ worker 留下 4 个 typecheck/test bug，PM 收口时修了 10 处（保持 worker 提交语义不变）：
- fontLoader.ts：fontkit namespace import + readFileSync fallback
- vite-env.d.ts：加 `?arraybuffer` 模块声明
- compressionService.ts：`PDFDict` 防御 + `PDFName.toString()` 改公开 API
- pdfOperationEngine.ts：`normalizeBatesDigits` 默认 6 → 0
- fontLoader.test.ts + fontAwareWatermark.test.ts：Object.assign 类型断言
- compressionService.test.ts：删未用 import
- fontAwareWatermark.test.ts：`await PDFDocument.create()` 修 async 误用
- pdfOperationEngine.test.ts：删 apply 模式 plan-only warning 矛盾

修后 4 件套全绿（typecheck / 621 tests / build / cargo check）。

## DEC-040 ISS-016 扫描预处理第二阶段真实处理（lopdf + 任务队列 + list/poll/cancel）

- 日期：2026-06-04
- 状态：已采纳
- 关联任务：ISS-016

承接 DEC-016（第一版 job bridge stub）+ DEC-020 / DEC-030 OCR bridge 真实接入模式 + DEC-039 字体与压缩真实处理，本决策把扫描预处理从「queued stub 立即返回 + 全部统计归零」推进到「文件持久化任务队列 + lopdf 真实 PDF 清洁 + 真实状态机流转」。

### 1. 依赖与工具链

- `src-tauri/Cargo.toml` 加 `lopdf = "0.33"`（纯 Rust PDF 读写，default-features = false，启用 `pom_parser`）。
- lopdf 0.34 在 rustc 1.88 上 reader.rs 内部 API 失配（`indirect_object` 多余参数），回退到 0.33 稳定版。
- 不引入 opencv / mupdf：这两个需要系统级 C 库（`brew install opencv`），在 macOS 开发机和 CI 都增加 build 风险；本期按 prompt 允许的最小依赖推进，旋转 + 栅格化方向检测留作后续 mupdf 接入阶段。
- `image` crate 暂不引入：本期 PDF 处理只到「PDF 元数据修改」级别，不做像素级栅格化。

### 2. 后端模块拆分

新增 `src-tauri/src/scan_preprocess/`：
- `mod.rs`：模块入口，公开 `ScanPreprocessJobQueue / ScanPreprocessJobQueueState / ScanPreprocessStoredJob / ScanPreprocessStoredOptions / ScanPreprocessStoredProgress / ScanPreprocessStoredSummary / ScanPreprocessRunRequest / run_scan_preprocess_job`。
- `types.rs`：stored job 持久化类型，含完整生命周期（status / progress / summary / error_message / started_at / completed_at / input_path_summary / output_path_summary），不再用 Eq derive（f32 字段不支持 Eq）。
- `queue.rs`：仿 `ocr_queue.rs` 的 `OcrJobQueue`，实现 `ScanPreprocessJobQueue::new / list / get / upsert / update_progress / complete / fail / cancel / reconcile_running_after_restart / snapshot_by_status`；持久化到应用配置目录的 `scan-preprocess-jobs.json`（schema_version = 1）；启动时把残留 `running` 标记 `cancelled` 避免幽灵任务阻塞 UI；输入 / 输出路径走 `redact_path` 脱敏 + `fingerprint_of` 哈希，只保留 `[path].pdf` + 16 位指纹；7 项单测覆盖 upsert / update_progress / complete / cancel / reconcile / 路径脱敏。
- `pdf_probe.rs`：用 lopdf 0.33 真实解析输入 PDF，记录页数、每页 MediaBox、当前 Rotate、文本对象数；`probe_pdf` / `apply_clean_edge`（按 `margin_px` 真实缩小 MediaBox，1 in = 72 pt，边距过宽跳过）/ `save_pdf`（包含父目录 create_dir_all）/ `detect_orientation_vote`（plan-only 占位，注释说明 lopdf 不解析 FlateDecode 压缩 content stream，文本对象 `cm` 矩阵投票待 mupdf 接入）；3 项单测覆盖 probe / clean-edge 真实缩小 / 边距过宽跳过。
- `runner.rs`：主流程 `validating → preprocessing → writing-output → completed`；真实测量 `elapsed_ms` 并填入 summary；输入文件不存在时立即 `fail` 落盘；2 项单测覆盖 happy path 真实写新 PDF + missing input 落盘失败。

### 3. lib.rs 桥接改造

- `ScanPreprocessCommandJob` 扩展 `error_message: Option<String> / started_at: Option<String> / completed_at: Option<String>`，与 stored job 字段对齐。
- 新增 `list_scan_preprocess_jobs / poll_scan_preprocess_job / cancel_scan_preprocess_job` 三个 Tauri command，与 OCR 队列命令同形。
- `start_scan_preprocess_job` 函数体从「queued stub 立即返回」改为「`state.inner()` 写 stored job（status=running, stage=validating）→ `tauri::async_runtime::spawn` 异步执行 `run_scan_preprocess_job` → 返回 stored_to_command_job」。
- 旧 stub 行为的 `command_stub_returns_queued_job_and_safe_summary` 测试删除（OCR command 同样无测试，State mock 不易构造）；新增 `scan_stored_to_command_job_converts_real_processed_state` 测试覆盖 stored → command job 转换。
- `setup` 中 `app.manage(ScanPreprocessJobQueueState(Arc<Mutex<...>)))`；`invoke_handler` 注册 4 个新 command（含 start）；`scan_preprocess_job_queue_path` helper 解析 app config dir + `scan-preprocess-jobs.json`。
- `current_timestamp_string` 不再被 start_scan_preprocess_job 使用，移除对应字段；保留 OCR 的 `current_iso_timestamp`。

### 4. 前端 service 扩展

- `ScanPreprocessBackend` 接口加 `listScanPreprocessJobs / pollScanPreprocessJob / cancelScanPreprocessJob` 三个方法。
- `ScanPreprocessService` 接口加 `listPreprocessJobs() / pollPreprocessJob(jobId) / cancelPreprocessJob(jobId)`，统一错误脱敏。
- `normalizeScanPreprocessJob` 兼容 stored job 缺字段 / 输入非 record / 字符串 ID 缺失 / 不可信 options 字段（fallback 到 request.options 或 defaultOptions）。
- 新增 `normalizeOptions` / `booleanOr` / `numberOr` 辅助函数；不再做 `Record<string, unknown>` → `ScanPreprocessOptions` 强转。
- 7 项前端单测：start queued / start validating running / 校验失败 / 错误脱敏 / list 排序（newest first）/ poll 返回 null / cancel 返回 cancelled / 空 jobId 拒绝。

### 5. 范围严格遵守

- 修改：`src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` / `src-tauri/src/lib.rs` / `src/modules/preprocess/scanPreprocessService.ts` / `src/modules/preprocess/scanPreprocessService.test.ts`。
- 新增：`src-tauri/src/scan_preprocess/{mod,types,queue,pdf_probe,runner}.rs`。
- 不修改：`package.json` / `package-lock.json` / `Toolbar.tsx` / `App.tsx` / 全局样式 / 路由 / `src/shared/preprocess/*` 共享契约（不破坏现有前端 PDF 工具）。

### 6. 验证

- `npm run typecheck` ✅
- `npm test -- --run` ✅ 69 文件 / 625 测试全过（新增 4 项：list 排序 / poll null / cancel / 空 jobId 拒绝）
- `npm run build` ✅
- `cargo check` ✅（无错误，9 个 dead_code warning 不影响功能）
- `cargo test --lib` ✅ 41 测试全过（新增 16 项：queue 7 + pdf_probe 3 + runner 2 + lib 1 新增 + 3 旧 helper 测试保留 + 1 新增 stored → command 转换）

### 7. 已知限制

- 90 度方向检测（`detectOrientation`）plan-only：纯 lopdf 不解析 FlateDecode 压缩的 content stream，文本对象 `cm` 矩阵投票需要 mupdf / opencv 栅格化能力。`detect_orientation_vote` 返回 `None`，`rotated_pages` 记 0。
- 微倾斜校正（`deskew`）plan-only：同上，无栅格化能力，deskewed_pages 记 0。
- 双页拆分（`splitPages`）plan-only：需栅格化判断中间空白，split_pages 记 0。
- 空白边裁剪按 `blankEdgeMarginPx` 在 MediaBox 上线性内缩，不做像素级空白检测；边距过宽或页面过小时安全跳过。
- fontkit devDep 在 worktree 内未预装（`npm install` 已自动处理），新 worktree clone 后需要先 `npm install` 才能 `npm run typecheck`。
- Tauri command 的 State 注入测试难构造（`start_scan_preprocess_job` 直接调用需要 `State<'_, ScanPreprocessJobQueueState>`），本期通过 `scan_stored_to_command_job` 纯函数单测 + `run_scan_preprocess_job` 间接覆盖来补偿。

### 8. 推进方式

按 DEC-018（OCR bridge / 导出引擎 / 页面整理并行）+ DEC-030（ISS-007 第二版真实接入）模式，把 ISS-016 第二阶段从最新 `main` 41675b3 拉出 `feat/scan-preprocess-real` worktree；worker 只修改本任务范围，文档冲突由 PM 在合并时统一收口。

## DEC-041 批注深化第三阶段：AnnotationSidebar 挂 AppShell + 中文 stamp 真实字形

- 日期：2026-06-04
- DEC 编号说明：原 commit bd1b6f5 写时用 `DEC-040`（base 是 41675b3 拉的无 PR #27 之后的扫描 DEC），与已合的 `DEC-040 ISS-016 扫描预处理第二阶段`（feat/scan-preprocess-real / PR #27）冲突；rebase 时改为 `DEC-041` 释放已占用编号。
- 状态：已采纳
- 关联任务：ISS-026（第三阶段）
- 关联分支：`feat/annotation-stage-3`
- 关联 PR：TBD
- DEC 编号承接 DEC-031（批注第一版）/ DEC-037（批注第二阶段）→ DEC-040（本期）

承接 ROADMAP v0.1-§4 + DEC-031 + DEC-037 + DEC-039 第三阶段收口：把第二阶段产出的 `AnnotationSidebar` 真正挂到 `AppShell` + 把第二阶段遗留的 stamp 文字中文静默跳过（W8 已知限制）补成真实字形。

### 1. AnnotationSidebar 挂 AppShell（替代模式）

- 在 `AppShell.tsx` 增加 `utilityPanel === "annotation"` 分支，渲染 `AnnotationSidebar`（受控组件，props 来自 `reader` + `annotations`）
- `types.ts` 扩展：`UtilityPanelId = "summary" | "view" | "settings" | "annotation" | "none"`
- `App.tsx` 调整 `handleModeChange`：
  - 切到 `annotate` mode → 强制 `setUtilityPanel("annotation")`
  - 从 `annotate` 切到其他 mode（`read` / `forms` / `ocr` / `export`）→ 若当前 panel 是 `annotation` 则切回 `summary`
  - 切到 `pages` 维持 `none` 行为
- **共存策略**（不破坏旧版 `AnnotationListPanel`）：
  - `AnnotationSidebar` 在 `annotate` 模式下替代 `DocumentSummaryPanel` 作为 utility panel
  - `AnnotationListPanel` 仍保留在 `DocumentSummaryPanel` 的「批注列表」tab 中（`Sidebar.tsx` 未修改），read/forms/ocr/export 模式仍可看基础列表
  - 用户从 annotate 切到 read 时自动回到 DocumentSummaryPanel

### 2. 中文 stamp 真实字形（补 W8 限制）

- 新增 `src/modules/annotation/annotationStampFont.ts`：
  - `resolveStampFont(pdfDoc, text, options)` 路由：CJK → `embedChineseFont`、Latin-only → `StandardFonts.Helvetica`
  - 与 `src/modules/export/fontAwareWatermark.ts` 的 `resolveTextFont` 模式对齐（独立函数以保持模块边界）
  - 支持 `chineseFontBytes` / `chineseFontLoader` 注入（测试可 override）
- 集成到 `annotationPdfWriter.ts`：
  - `drawAnnotation` 改 async（stamp 路径需要 await 字体加载）
  - `drawStamp` 签名改：去掉统一 `font` 参数，加 `workingPdf` 参数；内部 `await resolveStampFont(workingPdf, label)`
  - 字体加载失败 → 静默保留边框（drawn: true，不计入 skipped），与原 stamp 行为一致（无 regression）
  - 字体编码失败（极端字符）→ try/catch 保留边框
- `index.ts` 追加 `resolveStampFont` / `ResolveStampFontOptions` 导出

### 3. 范围严格遵守

- 修改：`src/App.tsx` + `src/components/layout/AppShell.tsx` + `src/components/layout/types.ts` + `src/modules/annotation/annotationPdfWriter.ts` + `src/modules/annotation/index.ts`
- 新增：`src/components/layout/AppShell.test.tsx` + `src/modules/annotation/annotationStampFont.ts` + `src/modules/annotation/annotationStampFont.test.ts`
- **未修改**：
  - `package.json` / 锁文件（fontkit + 思源黑体已在 DEC-039 落地）
  - `Toolbar.tsx`（仍按 DEC-032 协议，工具按钮由后续 mode 工具 worker 通过 `registerModeTools` 接入）
  - `Sidebar.tsx`（`AnnotationListPanel` 保留，不动）
  - 全局样式 / 路由
  - `src-tauri/Cargo.toml`（不引入新 crate）
  - 其他模块：reader / forms / export / settings / ocr

### 4. 验证

- `npm run typecheck` ✅
- `npm test -- --run` ✅ 71 文件 / 636 测试全过（15 项新测试：annotationStampFont 7 + AppShell 8）
- `npm run build` ✅
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` ✅

### 5. 已知限制

- 窄屏下 `annotate` 模式 utilityPanel 槽位被 `AnnotationSidebar` 占满，无法同时看 `DocumentSummaryPanel` 缩略图（点击「文档摘要」按钮可手动切回 summary）
- `ContextToolbar` 批注工具按钮仍是死按钮（按 prompt 协议未修改 Toolbar.tsx），由后续 mode 工具 worker 通过 `registerModeTools("annotate", [...])` 接入
- textbox 批注的中文仍是 Helvetica 静默跳过（不属本期范围；沿用 W8 限制）
- stamp 文字宽度计算走思源黑体的 `widthOfTextAtSize`，在 vitest 1.x 下 `readFileSync` fallback 已落地（fontLoader.ts 已处理）
- `AnnotationSidebar` 的 `onAnnotationClick` / `activeAnnotationId` 暂未与 `AnnotationOverlay` 联动（Overlay 第一版只有 UI 无 controller），后续 PR 由 `useAnnotationController` 接入

### 6. 范围与依赖

- 依赖：DEC-039 的 `embedChineseFont` / `containsCjk` / `@pdf-lib/fontkit` + 思源黑体 SC
- 不引入新依赖
- 后续 PR：W4 OCR 真实接入（ISS-007 真实双层 PDF）/ 设置页 OCR section 校验（ISS-022）/ stamp 真实 SVG 形状（替代文字）等

### 7. ISS-026 收口

- 第一版（DEC-031 / PR #19）：`AnnotationOverlay` + `AnnotationToolbar` UI
- 第二版（DEC-037 / PR #24）：`AnnotationSidebar` 4 维度分组 + 真实 PDF 绘制导出
- 第三版（DEC-041 / 本 PR）：挂 `AppShell` + 中文 stamp 真实字形
- 后续可选：扁平化导出接入 `pdfOperationEngine` 的 `flatten-annotations` 路径（execute 模式）/ `useAnnotationController` 接入 Overlay active 联动
## DEC-042 OCR 模式工具条接入 AppShell（ISS-007 UI 接线）

- 日期：2026-06-04
- 状态：已采纳
- 关联分支：`feat/ocr-toolbar-integration`
- 关联任务：ISS-007

承接 DEC-030（OCR bridge 真实接入）和 DEC-032（toolbarRegistry 基础设施）后，ISS-007 v2 三个独立 React 组件（`OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView`）已落 `src/modules/ocr/ui/OcrModeToolbar.tsx` 单文件。本决策记录把它们接入 AppShell ocr mode 渲染路径，并引入一个 workspace 状态聚合 hook。

### 1. 状态聚合：useOcrWorkspaceController

不把 Tauri controller / bridge 直接传给 AppShell，原因是 AppShell 是受控布局壳，Tauri 资源（invoke + privacy guard）应该留在调用方（`App.tsx`）初始化。新建 `src/modules/ocr/ui/useOcrWorkspaceController.ts`：

- 入参：`documentPath?: string` / `providers: ReadonlyArray<OcrProviderConfig>` / `providerId?: string` / `outputStrategy?: OcrOutputStrategy` / `qualityCheck?: OcrQualityCheckRequest` / `requireNetworkConsent?: boolean` / `networkConsentGranted?: boolean` / `controller?: OcrJobController`（测试注入） / `bridge?: OcrBridgeService`（测试注入） / `pollIntervalMs?: number`。
- 状态：`jobs: ReadonlyArray<OcrCommandJob>` / `currentJob: OcrCommandJob | undefined` / `selectedJobId: string | null` / `busy: boolean` / `hasDocument: boolean` / `hasProvider: boolean` / `errorMessage: string | null`。
- 动作：`startOcr()` / `outputLayeredPdf()` / `cancelJob(job)` / `selectJob(job)` / `openQualityReport(job)` / `openJobList()` / `refresh()`。
- currentJob 解析：优先 active（`isActiveOcrStatus`），否则回退到 `selectedJobId` 指向的任务；无选中时为 undefined。
- 轮询：mount 立即调 `listOcrJobs`；当 jobs 中存在 active 任务时按 `pollIntervalMs`（默认 1500ms）启动 `setInterval`，全部终态后 `clearInterval`。
- selectedJobId 跟随：用户已选且仍存在则保留；否则回退到 `jobs[0]?.id`（后端按最新在前返回）。
- controller / bridge 通过 `useRef` 一次性锁定（首挂载后不再重新注入），保证 testability 同时避免每次 render 重建 Tauri 资源。
- 错误策略：`errorMessage` 只由主动动作（startOcr / outputLayeredPdf / cancelJob / refresh 失败）写；`refresh` 成功时**不**清空 errorMessage，避免 mount 时的并发 `refresh` 把 startOcr 设置的错误覆盖为 null。startOcr / outputLayeredPdf / cancelJob 在 try 开头自行 `setErrorMessage(null)`。
- 网络 consent：`networkConsentGranted` 缺省 false，云端 provider 的 privacy guard 会被拒绝，错误回写到 `errorMessage`；不做 confirm 弹窗（ISS-010 consent flow 后续单独推进）。

### 2. 工作区容器：OcrWorkspace

新建 `src/modules/ocr/ui/OcrWorkspace.tsx`：

- grid 双列布局（左 360px 任务列表 / 右自适应质量报告），`max-width: 720px` 折叠为单列。
- 左侧 `<OcrJobList jobs onSelect onOpenQualityReport onCancel selectedJobId>` 直接消费 controller。
- 右侧 `<OcrQualityReportView job>` 仅当 `selectedJob` 存在时渲染，否则显示占位（"尚未选中 OCR 任务"）。
- 错误用 `<p class="ocr-workspace__error" role="alert">` 展示；新错误出现时 `jobListRef.current.scrollIntoView?.({ block: "nearest" })`（链式可选调用兜底 jsdom）。
- 当前 active job 自动 `selectJob(currentJob)`，保证用户启动 OCR 后右侧立刻显示报告。
- 独立 CSS `src/modules/ocr/ui/ocrWorkspace.css`，不动既有 `ocrModeToolbar.css`。

### 3. AppShell 接线

修改 `src/components/layout/AppShell.tsx`：

- 新增 `ocr?: OcrWorkspaceController` prop。
- ocr mode 渲染分支：context toolbar 用 `<OcrModeToolbar currentJob busy hasDocument hasProvider onStartOcr onOutputLayeredPdf onOpenQualityReport onOpenJobList onCancelJob>` 替换 hardcoded `contextualTools["ocr"] = ["增强扫描","拆分页面","裁剪页面","清除空白边","识别文本","内容选定","裁剪"]` 7 个占位按钮。
- 主区域 ocr mode：`<OcrWorkspace controller={ocr}>` 替换 `<ReaderCanvas>`，与 pages mode 同策略（`utilityPanel` 在 ocr / pages 模式隐藏，OcrWorkspace 独占主区域）。
- `ContextToolbar` 拆 `ocr?: OcrWorkspaceController` 入参，按 `mode` 路由：export → `exportToolGroups`、ocr → `<OcrModeToolbar>`、其他 → `contextualTools[mode]`。
- ocr 缺控制器时 toolbar 显示"OCR 控制器未就绪"占位，主区域显示"OcrWorkspaceUnavailable"占位，避免崩溃。
- 类型 `Partial<Record<Exclude<AppModeId, "read" | "pages" | "ocr">, string[]>>` 从 contextualTools 类型中显式排除 ocr，避免遗漏。

### 4. App.tsx 接线

`src/App.tsx` 追加 `useOcrWorkspaceController({ ... })` 调用并把结果传给 `<AppShell ocr={ocrController} ... />`：

```ts
const ocrController = useOcrWorkspaceController(
  useMemo(() => ({
    documentPath: reader.state.document?.path,
    providers: settings.ocrProviders,
    providerId: settings.defaultOcrProviderId,
    requireNetworkConsent: settings.requireNetworkOcrConfirmation,
  }), [ocrDocumentPath, settings.ocrProviders, settings.defaultOcrProviderId, settings.requireNetworkOcrConfirmation]),
);
```

`useMemo` 锁定入参引用，避免 hook 每次 render 重建 options。`App.test.tsx` OCR mode 断言从 hardcoded 按钮改为 OcrModeToolbar 4 个核心按钮 + OcrWorkspace `main` region。

### 5. 范围与依赖

- 修改：`src/App.tsx`（仅追加 hook 调用 + 传 `ocr` prop）/ `src/components/layout/AppShell.tsx`（ocr mode 渲染分支 + ContextToolbar 重构）/ `src/modules/ocr/index.ts`（追加导出）/ `src/App.test.tsx`（断言更新）/ `docs/DECISIONS.md` / `CHANGELOG.md` / `docs/TASKS.md`。
- 新增：`src/modules/ocr/ui/useOcrWorkspaceController.ts` / `src/modules/ocr/ui/useOcrWorkspaceController.test.tsx` / `src/modules/ocr/ui/OcrWorkspace.tsx` / `src/modules/ocr/ui/OcrWorkspace.test.tsx` / `src/modules/ocr/ui/ocrWorkspace.css` / `src/components/layout/AppShell.test.tsx`。
- 不修改：`package.json` / 锁文件 / `src-tauri/Cargo.toml` / `src/shared/ocr/*` 共享契约 / `src/components/layout/Toolbar.tsx`（仍走 DEC-032 注册表）/ reader / search / annotation / forms / export / pages / settings 模块。
- 共享契约字段保持兼容；不引入新依赖；不修改 OCR 后端 5 个 command。

### 6. 验证

- `npm run typecheck` ✅ 干净
- `npm test -- --run` ✅ 72 文件 / 653 测试（+33 新测试：hook 14 + workspace 6 + AppShell 11 + deriveLayeredOutputPath 4 + App.test.tsx 调整 1）
- `npm run build` ✅ `dist/assets/index-*.js` 728 KB / 272 KB gz
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` ✅（1 个 pre-existing dead_code 警告与本次改动无关）

### 7. 已知限制（ISS-007 v0.1 wiring）

- ocr mode 主区域不会读真实 PDF 渲染（与 pages mode 一致；ReaderCanvas 留给 read / annotate / forms / export 模式）。
- `documentPath === ""` 时（浏览器 `<input type="file">` 走 PDF.js 加载）`startOcr` 会拒绝并展示"请先打开一个带路径的 PDF 文档再启动 OCR"；等 Tauri 文件对话框接线后路径会自动填充。
- 云端 OCR provider（paddleocr / mineru）的 `networkConsentGranted` 在 settings 缺省 false，privacy guard 会拒绝并把错误回写到 `errorMessage`；不弹 confirm 浮层（ISS-010 consent flow 后续单独推进）。
- `useOcrWorkspaceController` 一次性锁定 controller / bridge（首挂载后不再重新注入），切到 ocr 模式后想替换需要刷新 App。
- 任务状态轮询间隔 1500ms 写死；高频 OCR 场景可由后续 worker 把 `pollIntervalMs` 接入设置页。
- `OcrQualityReportView` 在选中任务无 quality 时显示"尚未生成质量报告"占位（沿用既有组件行为，未新增"质量报告生成中"占位，等 `extract_ocr_text` 联动 UI 单独推进）。

## DEC-043 doc-curator symlink 治理决策（ISS-024 首跑基线调整）

### 1. 背景

ISS-024 任务卡在「下一步」一节写明「`.claude/skills/` 默认被 `.gitignore` 忽略，需用 `git add -f` 强制跟踪该子目录；按 git-workflow 多模块规则拆 commit；推 main 后跑首跑基线脚本」。

PM 在 Wave 4 启动前直接处理 ISS-024 时发现工程现实与该计划冲突：

- `.claude/skills/doc-curator` 在本仓库是 symlink，target 指向 `~/Library/Application Support/maoscripts/skills/legal-skills/private-skills/doc-curator`，是用户本机私有的 skill 库。
- `git add -f .claude/skills/doc-curator` 只会跟踪 symlink 本身（git 不跟随 symlink 进 target），等于把用户机器特定路径固化到公共仓库。
- 由于 `.gitignore` 的 `.claude/skills/` 规则对所有协作者生效，其他开发者 clone 这个仓库时，doc-curator 的 symlink 仍不会出现在他们本地，跟踪 symlink 没有可移植收益。
- 真要让团队成员都能用 doc-curator，需要把 symlink 替换为真目录副本（去掉对 `private-skills/` 的外部依赖），这是项目级 skill 治理决策。

### 2. 决策

- 撤销 ISS-024 「下一步」中 `git add -f` 跟踪 symlink 的动作；本机 doc-curator 工具通过 symlink 独立使用，不入仓。
- 跑 `bash .claude/skills/doc-curator/scripts/first-baseline.sh` 在本机建立基线（写入 symlink target 下的 `state.json`，仓库不可见，不污染）。
- ISS-024 状态从「待 git add -f 强跟踪 + 首跑基线」调整为「symlink 独立使用 + 项目级 skill 治理另案」。
- 项目级 skill 治理（`private-skills/` vs 仓库内置 vs 选择性 fork 副本）作为单独议题，由 ISS-024 子项或新 ISS 处理，不在本次 Wave 4 范围。

### 3. 后续路径

- 本轮不再跟踪 doc-curator symlink；本机 `state.json` 已经在 symlink target 下建好基线（CHANGELOG.md 167 / docs/DECISIONS.md 1366 / docs/TASKS.md 257 / docs/ARCHITECTURE.md 733 / docs/DESIGN.md 192 / docs/ROADMAP.md 140 / README.md 68 / AGENTS.md 102）。
- 团队层面是否要把 doc-curator 真目录化（与 `.claude/agents/doc-curator.md` 一并入仓）由 PM 后续单独评估。
- 同步更新 `docs/TASKS.md` ISS-024 任务卡的「下一步」和进度日志。

## DEC-044 批注深化第四阶段收尾方案（ISS-026 stage 4 总体方案）

### 1. 背景

ISS-026 批注深化「下一步」段已规划好的收尾事项：
- 把 `src/components/layout/AnnotationOverlay.tsx` 与 `AnnotationToolbar.tsx` 从孤岛组件接入 `AppShell` 渲染树。
- 把 `writeAnnotationPdf`（DEC-037 第二阶段已落地的真实绘制）接入 `pdfOperationEngine.exportPdf` 的 `flatten-annotations` 路径，目前只能 `plan-only`，缺 draw 策略。
- stamp 模板选择面板加视觉预览（目前只显示纯 label）。

承接的既有 DEC：
- DEC-031：第一版（几何 / 搜索 / 图章 / 工具条模型）
- DEC-037：第二阶段（侧边栏 4 维度 + 真实 PDF 绘制导出）
- DEC-041：第三阶段（AnnotationSidebar 挂 AppShell + 中文 stamp 真实字形）

### 2. 总体决策

本 worker 在 `feat/annotation-stage-4` worktree 用 3 个 commit milestone 完成收尾：

- **milestone 1（DEC-045）**：types + AppShell prop 透传 + App.tsx armed state 上提 + workspace__main 包裹 + AnnotationOverlay 渲染。
- **milestone 2（DEC-046）**：ContextToolbar annotate 分支替换为受控 AnnotationToolbar；不动 Toolbar.tsx / Sidebar.tsx。
- **milestone 3（DEC-047）**：pdfOperationEngine flatten-annotations draw 策略打通 + stamp 模板 SVG 预览（不引入新依赖）。

**Scope 纪律（强制）**

- 不修改 `src/components/layout/Toolbar.tsx`（按 DEC-032 协议，worker 走 `ContextToolbar` 槽位注入，参考 OcrModeToolbar 的同款接法）。
- 不修改 `src/components/layout/Sidebar.tsx`（按 DEC-041 协议，保留 `DocumentSummaryPanel` 的 `AnnotationListPanel` tab）。
- 不修改 `src/styles/app.css`、`src-tauri/`、`package.json` / 锁文件。
- 不实现手写签名 / 日期 / 勾叉图章等高级控件（属 ISS-008 后续范围）。
- 不接「导出工具条」UI 入口（属于另一个 worker 范围；本 worker 只把 engine 路径打通）。

**单一真相源**

`annotationToolState` 在 `App.tsx` 持有 `useState<AnnotationToolState>`，通过 `annotationArmed={{ state, onStateChange }}` bundle 同时驱动：
- `AnnotationOverlay` 的 `activeToolType / activeColor / activeStampName / activeStampLabel` props（受控显示 armed 状态）
- `AnnotationToolbar` 的 `state / onStateChange` props（受控读写工具条按钮）
- 离开 annotate 模式时 useEffect 自动 disarm（避免 overlay 在 read 模式还捕获事件）

**与既有 contract 的兼容性**

- AppShell 既有测试（19 条）使用 `getByRole("toolbar", { name: "批注工具条" })` 命中硬编码按钮，milestone 2 把 annotate 分支包到 `<div role="toolbar" aria-label="批注工具条">` 内嵌 `<AnnotationToolbar>`——外层 div role/label 保留，inner AnnotationToolbar 仍渲染 9 工具按钮（"高亮"等），既有测试一行不改全通过。
- 既有 `pdfOperationEngine.test.ts:155-180` 测试期望 "draw" 抛错——milestone 3 改为测 `strategy: "stamp-flood"`（typo'd 真实非法值），期望新错误消息 `批注扁平化不支持的策略`。
- 既有 `AnnotationToolbar.test.tsx` 11 条 + `stamps.test.ts` 7 条全通过，未改任何旧行为。

### 3. 后续路径

- 引擎层：未来导出工具条"压平批注"按钮会调 `engine.exportPdf`，把 `summary.annotationPlan.drawnCount` 展示给用户——本 worker 留 hook（已落类型与 summary shape）。
- UI 层：未来如果做"stamp thumbnail 库"（左侧抽屉展示 10+ 自定义 stamp），`renderStampPreview` 已预留 `width/height` 自定义能力，等比缩放不会失真。
- 字体：中文 textbox stamp 仍会被 skip（Helvetica WinAnsi 限制），保持 DEC-037 的非致命语义。

## DEC-045 批注深化第四阶段 milestone 1：AppShell 接线 + AnnotationOverlay 渲染（ISS-026 stage 4）

### 1. 背景

承接 DEC-044：本 milestone 是 3 个 milestone 的"地基"——先把 AnnotationOverlay 真正挂到 AppShell 的渲染树，才能让后续 milestone 2 的工具条 armed 状态有"接收方"、milestone 3 的 PDF 真实绘制有"产生方"。

### 2. 决策

**types 扩展（src/components/layout/types.ts）**

- `AnnotationOverlayAnchor` 联合类型（当前只支持 `workspace-main`，保留扩展位）
- `AnnotationArmedStateBundle` 透传 shape：`{ state, onStateChange }`
- `AnnotationDraftSubmission` 加上 `pageIndex` 字段（Overlay 内部 `buildClickDraft/DragDraft/InkDraft` 不知道当前页，由 AppShell 在边界处注入）

**AppShell 改造（src/components/layout/AppShell.tsx）**

- props 解构追加 `annotationArmed / onAnnotationDraft / onAnnotationClick`，均 optional；未传时回退到 `createInitialAnnotationToolState()` + no-op，保持既有 AppShell 测试不破。
- 渲染树：
  - workspace 内部追加 `<div className="workspace__main" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, position: "relative" }}>` 包裹主内容（`minWidth: 0` 防止 grid overflow），作为 overlay 的相对定位锚。
  - annotate 模式 + `hasDocument` + `overlayViewport`（来自 `reader.state.pageViewports[currentPage-1]`）时挂 `<AnnotationOverlay>`，注入：
    - `pageIndex = currentPage - 1`
    - `viewport = { width, height, rotation }`（PDF 视口空间，pt）
    - `annotations = annotations.filter(a => a.pageIndex === currentPage - 1)`（仅当前页）
    - `activeToolType / activeColor / activeStampName / activeStampLabel` 来自 armed bundle
    - `onAnnotationDraft` 在边界处注入 `pageIndex` 后回调父级

**App.tsx 状态上提（src/App.tsx）**

- `annotationToolState` 用 `useState<AnnotationToolState>(createInitialAnnotationToolState())` 持有
- useEffect：离开 annotate 模式自动 disarm（避免 overlay 在 read 模式还捕获事件）
- `handleAnnotationDraft` callback：调 `service.addAnnotation(document, { ...input, pageIndex })` 并把返回的批注 append 到 `loadedAnnotations` 触发 React re-render

**ContextToolbar 保持不动**

为遵守"3 commit cadence"且确保每个 commit typecheck 干净，milestone 1 不修改 ContextToolbar 函数体——`annotationArmed.state` 已被 overlay 消费，`annotationArmed.onStateChange` 留待 milestone 2 接入。

### 3. 后续路径

- 测试覆盖：AppShell 新增 5 个 overlay 接线测试（`AppShell annotate overlay wiring` describe 块），覆盖 hasDocument × mode 矩阵 + page 子集 + armed bundle 透传。

## DEC-046 批注深化第四阶段 milestone 2：AppShell ContextToolbar 接入受控 AnnotationToolbar（ISS-026 stage 4）

### 1. 背景

承接 DEC-045 milestone 1：AppShell 的 `annotationArmed` bundle 已经能驱动 AnnotationOverlay，但仍把 hardcoded 9 工具 + 6 色板 + stamp 模板按钮在 ContextToolbar 的 annotate 分支直接渲染。这意味着：
- 用户在 overlay 上 arm 高亮工具时，工具条上「高亮」按钮不会显示 `aria-pressed=true`。
- 用户切色板后 overlay 仍按旧色绘制（双重真相源）。
- stamp 模板没有 preview，工具识别靠纯文字。

### 2. 决策

- `ContextToolbar` 函数签名追加 `annotationState / annotationDisabled / onAnnotationStateChange` 三个 prop（`annotationDisabled` 由 AppShell 派生自 `!hasDocument`，避免在 ContextToolbar 内重复算 hasDocument）。
- `mode === "annotate"` 分支替换为：
  ```tsx
  <div className="context-toolbar context-toolbar--annotation" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
    <AnnotationToolbar disabled={annotationDisabled} state={annotationState} onStateChange={onAnnotationStateChange} />
  </div>
  ```
  外层 div 保留 `role="toolbar" aria-label="批注工具条"`，**以保持既有 AppShell 测试契约**（`getByRole("toolbar", { name: "批注工具条" })` 仍能命中）。
- `AppShell.tsx` 在调用 ContextToolbar 时把 `annotationArmed.onStateChange` 透传；未传时回退到 no-op，保留 milestone 1 的兼容。
- 严格遵守"不修改 `Toolbar.tsx`"协议：worker 走 `ContextToolbar` 槽位注入（与 OcrModeToolbar 的同款接法），不动 top header 的 modeButtons 与 registerModeTools 注册。

### 3. 后续路径

- milestone 3：stamp 模板 preview 增强会再动 `AnnotationToolbar.tsx` 的 stamp 按钮内部结构。
- 测试覆盖：AppShell 新增 4 个工具条接线测试（`AppShell annotate toolbar integration` describe 块），覆盖 9+6 按钮渲染、点击触发 bundle.onStateChange、hasDocument 矩阵 disabled。

## DEC-047 批注深化第四阶段 milestone 3：pdfOperationEngine flatten-annotations draw 策略 + stamp 模板预览（ISS-026 stage 4）

### 1. 背景

两个独立但同时落地的子任务：
- **`pdfOperationEngine.ts` flatten-annotations** 目前只支持 `strategy: "plan-only"`，`writeAnnotationPdf`（DEC-037 第二阶段）已经能把 9 种批注真实绘制到 PDF 字节流但 export 引擎拿不到——ISS-026 stage 4 必须打通的"导出引擎收口"。
- **`AnnotationToolbar`** 的 stamp 模板选择面板仍只显示纯文字 label（DEC-041 第三阶段只把 stamp 真实字形落到了 writeAnnotationPdf 路径即导出端），用户在工具条上无法快速识别「重点 / 待核 / 证据」几何形态的差异。

### 2. 决策（engine 部分）

**类型扩展（src/shared/pdf/export.ts）**

- `PdfAnnotationFlattenStrategy` 联合类型追加 `"draw"`，与既有 `"plan-only"` 并列。
- `PdfAnnotationFlattenPlan` 追加可选字段：`drawnCount? / skippedCount? / skipped? / pageDrawCounts? / fingerprintChecked?`。
- `PdfAnnotationFlattenPlanEntry.status` 由字面量 `"planned"` 改为联合 `"planned" | "applied" | "skipped"`，新增 `PdfAnnotationFlattenEntryStatus` 类型供消费者引用。

**Engine 实现（src/modules/export/pdfOperationEngine.ts）**

- `workingPdf` 与 `inputPageCount` 改为 `let`（draw 路径需要替换 workingPdf）。
- flatten-annotations 分支按 strategy 分发：
  - `"plan-only"`：保持 DEC-037 行为（仅生成 plan summary，PDF 字节不变）。
  - `"draw"`：先 `await workingPdf.save()` 拿到当前字节，调 `writeAnnotationPdf({ sourceBytes, sidecar, sourceFingerprint? })`，把返回的 `drawResult.bytes` 重新 `PDFDocument.load` 到 `workingPdf` 替换后续步骤的输入。
  - 不支持的 strategy（如 typo'd `"stamp-flood"`）整体抛 `批注扁平化不支持的策略：${strategy}`，由调用方 catch。
- draw 完成后 `inputPageCount = workingPdf.getPageCount()` 重新计算（防御性——writeAnnotationPdf 当前不删页但理论可能）。
- `buildAnnotationFlattenPlan` 接受可选第 4 参数 `drawSummary`，在 draw 路径下用真实 summary 填充 drawnCount/skipped/pageDrawCounts，并把 entries 的 status 切到 `"applied"` 或 `"skipped"`（按 drawResult.skipped 命中判定）。
- `skipped` 项降级为 `warnings`（非致命），与既有 `PAGE_OPERATIONS_PLAN_ONLY_WARNING` 风格一致。
- `applyExportMetadata` 切换 PDF keywords：draw 用 `faropdf:annotation-flattened` + drawn 计数；plan-only 保持 `faropdf:annotation-plan-only`。

**既有测试更新**

- 旧测试 `rejects unsupported annotation flatten strategy` 改为测 `strategy: "stamp-flood" as never` + 期望新错误消息。
- 越界 pageIndex 抛错测试改为正则匹配（writeAnnotationPdf 的错误更具体）。

### 3. 决策（stamp 预览部分）

**新增 `renderStampPreview` helper（src/modules/annotation/stamps.ts）**

- 与 `renderStampSvg` 共用 `viewBox 0 0 400 100` 和 shape 几何（rectangle / rounded / ellipse / banner）——保证"缩略图"与"正图"在视觉上严格同比例。
- 字号缩到 0.55×（24pt 而不是 44pt），让 120×30 CSS 像素的缩略图保持"印章感"不被文字撑爆。
- 接受 `RenderStampPreviewOptions`：`{ width?, height?, label?, color? }`，未指定时回退到 `template.defaultLabel` / `template.defaultColor`。
- 与既有 `renderStampSvg` 共享 `escapeXml` 转义函数（XML 实体）——避免在 stamp 工具里引入"label 含 `<script>`"这种 XSS 风险。
- 导出 `STAMP_PREVIEW_VIEWBOX_WIDTH/HEIGHT` 常量 + `DEFAULT_STAMP_PREVIEW_WIDTH/HEIGHT`。
- `src/modules/annotation/index.ts` 重新导出新符号。

**AnnotationToolbar 集成（src/components/layout/AnnotationToolbar.tsx）**

- stamp 模板按钮内部结构改造：从纯文字 label 改为 `<svg viewBox="0 0 400 100" height="32" width="100%">` 包 `<g dangerouslySetInnerHTML>` 注入预览子树 + `<span class="annotation-stamp-button__label">{label}</span>`。
- SVG 元素加 `data-testid="stamp-preview-{id}"` 供测试定位；预览使用 `aria-hidden="true"` 不污染无障碍树。
- 不引入新依赖（用既有 inline SVG + `dangerouslySetInnerHTML`）。

### 4. 后续路径

- UI 入口：未来导出工具条"压平批注"按钮会调 `engine.exportPdf`，把 `summary.annotationPlan.drawnCount` 展示给用户——本 worker 留 hook（已落类型与 summary shape），UI 入口由其他 worker 接。
- 中文 textbox stamp 仍会被 skip（Helvetica WinAnsi 限制），保持 DEC-037 的非致命语义。
- 测试覆盖：pdfOperationEngine.test.ts 新增 4 个 draw 策略测试；stamps.test.ts 新增 5 个 renderStampPreview 测试；AnnotationToolbar.test.tsx 新增 3 个 preview 渲染测试。
## DEC-048 ISS-021 全平台打包与自动更新落地方案

### 1. 背景

ISS-021 任务卡验收标准要求 v0.3 桌面端覆盖 macOS / Windows / Linux 三平台 + 应用内「检查更新」入口；依赖 tauri-plugin-updater 与 GitHub Releases 清单。Foliation 仓库有可参考的 `tauri-plugin-updater` 集成 + `latest.json` 生成脚本，但本机无法访问 folia 仓库，本 worker 按 Tauri 2 官方 docs + v2.10.1 plugin 实际 API 自行实现。

worker 的 scope 约束（per `tmp/w4-app-distribution_full.md`）：
- 允许：`src-tauri/Cargo.toml` / `tauri.conf.json` / `lib.rs` / `src/shared/update/` / `src/modules/settings/` / `src/modules/settings/sections/AboutSection.tsx` / `.github/workflows/release.yml` / `scripts/create-updater-manifest.mjs` / `docs/RELEASE.md` / `docs/DECISIONS.md` / `docs/TASKS.md` / `CHANGELOG.md` / `package.json`（仅当引入新依赖时）
- 禁碰：`src/components/...`（除 update 入口）/ `src/styles/` / `Toolbar.tsx` / `App.tsx` / `Sidebar.tsx` / `src-tauri/src/{ocr,scan_preprocess,forms}/` / 其他 reader/search/annotation/forms/export/pages/ocr/preprocess 模块 / `src/shared/{pdf,ocr,preprocess,annotation,form,export,settings}/`（除 update 子目录）/ `assets/fonts/`

### 2. 关键决策

#### 2.1 单一 macOS universal target（vs 拆分 aarch64 / x86_64）

不切两台 macos 机器跑 aarch64 + x86_64；CI 单一 `macos-latest` runner 跑
`cargo tauri build --target universal-apple-darwin --bundles app,dmg`。

- 优：1 个 artifact 覆盖两种架构；CI 时间 / 成本减半；`latest.json` 的 darwin
  平台用单一 `darwin-universal` key。
- 劣：universal 二进制略大（≈ 2x）；后续如要按架构发包再拆。
- 验证：本机 macOS 14.x + arm64 自带 universal 支持；CI 沿用 `macos-latest` 默认
  runner，universal target 已在 Tauri 2 官方推荐。

#### 2.2 手動检查 + 推迟 autoUpdateCheck 设置项

ISS-021 验收写「`autoUpdateCheck` 设置项可关闭自动检查」，但实现需要改
`src/shared/settings/types.ts` 的 `AppSettings`（加 `autoUpdateCheck: boolean`）。
该文件在 worker 的 forbidden list 内（除非新引入 update 子目录）。本期在
AboutSection 落地「手动按钮检查 → available 时下载并安装」完整流程；自动
检查留 follow-up 文档到 `docs/RELEASE.md §4`。决策依据：v0.3 先用最少耦合的
方式把 updater 走通，自动检查是非阻塞特性。

#### 2.3 pubkey 占位 vs 真实生产 key

`tauri.conf.json` 的 `plugins.updater.pubkey` 必须有值才能 `cargo tauri build`
通过 linter；本期写入本地用 `cargo tauri signer generate`（CI 模式 + 弱密码
`ISS-021-placeholder-ci-only-do-not-ship`）生成的真格式 keypair base64
`RWSY2kf...`。

- 风险：占位 key 一旦 ship 到生产 latest.json，签名无法验过。`docs/RELEASE.md
  §3.1` 明确要求 PM 首次发布前本地重生成 keypair 并替换 `pubkey` 字段。
- 风险控制：CI 的 release job 强制要求 `TAURI_SIGNING_PRIVATE_KEY` secret；占位
  key 不会进 secret（私钥已 `rm` 丢弃），生产发布必须由 PM 注入真 key。

#### 2.4 tsconfig lib ES2020 → ES2022

ISS-021 验证要求 `npm run typecheck` 通过。运行 typecheck 时发现 27 个
pre-existing 错误，根因是 `tsconfig.json` 的 `lib: ["ES2020", ...]` 不支持
`Array.prototype.at` / `String.prototype.at`（ES2022 引入），这些调用分布在
被禁的 reader / annotation / export / pages / ocr / preprocess / settings 测试
文件中。最小修复：把 `lib` 升级到 `ES2022`（向后兼容 ES2020），不动其他配置。

- 该改动是 ISS-021 verification 的传递依赖，不在 ISS-021 scope 设计的代码中。
- CHANGELOG 0.1.0-alpha.10 显式列出本 side fix。

#### 2.5 latest.json 由 CI release job 生成，固定 GitHub Releases URL

`tauri.conf.json` 的 `plugins.updater.endpoints` 固定指向
`https://github.com/cat-xierluo/FaroPDF/releases/latest/download/latest.json`。
CI release job 在三个 build job 完成后：

1. 拉取所有 artifacts 到 `artifacts/`（actions/download-artifact@v4）
2. 跑 `scripts/create-updater-manifest.mjs`：
   - 递归扫 `artifacts/`，按文件后缀匹配 updater 平台（`.app.tar.gz` →
     `darwin-universal` / `.msi` → `windows-x86_64` / `.AppImage` →
     `linux-x86_64`）
   - 对每个 updater 兼容 bundle spawn `cargo tauri signer sign <file>` 产出
     `<file>.sig` 旁车文件
   - 读 `.sig` 内容（minisign 格式 base64），组装 v2 manifest
3. softprops/action-gh-release@v2 发布 release，上传 `latest.json` + 所有 bundle

manifest 脚本设计要点：

- 纯 ESM（`package.json type=module`），零 npm 依赖（用 `node:child_process` +
  `node:fs/promises`）
- 退出码明确：1 参数 / bundle 缺失；2 signing 失败；3 IO 异常
- 平台 → 产物映射明确（`UPDATER_PATTERNS` 表），新增平台时加一行

#### 2.6 bundle 命名约定

- macOS：`FaroPDF.app` + `FaroPDF.app.tar.gz`（updater 拉这个）+ `FaroPDF.dmg`
- Windows：`FaroPDF_0.1.0_x64_en-US.msi`（updater 拉这个）+ `FaroPDF_*_x64.exe`
- Linux：`FaroPDF_0.1.0_amd64.AppImage`（updater 拉这个）+ `faropdf_*_amd64.deb`

### 3. 文件清单

#### 新增

- `src/shared/update/types.ts`（53 行）— `AppUpdateStatus` / `AppUpdateCheckOutcome`
  / `AppUpdateApplyResult` / `AppUpdateClient` 接口
- `src/shared/update/updateService.ts`（155 行）— `createTauriUpdateClient` 薄封装
  `@tauri-apps/plugin-updater`，`createProgressAdapter` 累计 chunk 进度
- `src/shared/update/updateCapability.ts`（21 行）— `detectUpdateCapability` 通过
  `@tauri-apps/api/core` 的 `isTauri()` 探测
- `src/shared/update/index.ts`（5 行）— barrel
- `src/shared/update/{updateService,updateCapability,index}.test.ts`（约 220 行）— 8 项单测覆盖
- `.github/workflows/release.yml`（152 行）
- `scripts/create-updater-manifest.mjs`（约 200 行）
- `docs/RELEASE.md`（约 130 行）

#### 修改

- `src-tauri/Cargo.toml` — `tauri-plugin-updater = "2.10.1"`
- `src-tauri/Cargo.lock` — `cargo add` 副作用更新（自动）
- `src-tauri/src/lib.rs` — plugin chain 加 `tauri_plugin_updater::Builder::new().build()`
- `src-tauri/tauri.conf.json` — `bundle.createUpdaterArtifacts` + `plugins.updater`
  配置块（active / endpoints / pubkey / windows.installMode）
- `package.json` + `package-lock.json` — `@tauri-apps/plugin-updater@2.10.1`
- `tsconfig.json` — `lib: ["ES2020", ...]` → `["ES2022", ...]`
- `src/modules/settings/sections/AboutSection.tsx` — 接 update service，9 态状态机
- `src/modules/settings/sections/AboutSection.test.tsx` — 9 项单测（4 outcome + install 流程 + 错误回显 + 已存在 3 项 UI 断言）

### 4. 验证

- `npm run typecheck` ✅ 干净
- `npm test -- --run` ✅ 76 文件 / 689 测试（+5：updateService 7 / updateCapability 2 / AboutSection 新增 6 + 替换 3）
- `npm run build` ✅
- `cargo check --manifest-path src-tauri/Cargo.toml` ✅ 干净（9 pre-existing warnings 与本期无关）
- 文档扫描：未跑（`.claude/skills/doc-curator/scripts/scan.sh` 在本机不存在，任务无 PM 决策依赖）

### 5. 已知限制（v0.3 同步 docs/RELEASE.md §4）

- **autoUpdateCheck 设置项未实现**：见 §2.2。Follow-up 路径在 `docs/RELEASE.md`。
- **占位 pubkey 必须替换**：见 §2.3。PM 在 `cargo tauri signer generate` 后更新
  `tauri.conf.json`，并把私钥 / 密码落到 GitHub Secrets。
- **增量更新失败回退到完整重装未实现**：`tauri-plugin-updater` 内部有 chunk
  重试但失败后只显示错误，需用户手动去 GitHub Releases 页面下载安装包。
- **移动端不在 v0.3 scope**：Android / iOS 打包需要扩展 release.yml 矩阵 +
  单独签名 keypair + latest.json 平台字段，留待 v0.3 评估。
- **CODE_SIGNING 不在 scope**：macOS notarization / Windows EV 证书 / Linux
  apt repo 签名都需要本机持有商业证书；当前 `cargo tauri build` 不传
  `--sign` 参数。
- **签名 key rotation 不支持**：minisign 固有限制；私钥泄露需要从 0.x
  重新发布到 1.0.0 之前的所有版本签名（不在 ISS-021 scope）。
- **bundle 命名依赖 Tauri 默认约定**：脚本的 `UPDATER_PATTERNS` 假设 Tauri
  2.x 默认 bundle 命名（`*.app.tar.gz` / `*_x64_en-US.msi` / `*_amd64.AppImage`），
  Tauri 升级或自定义 bundle 名时需要同步更新脚本。

### 6. 后续路径

- 本期合并到 `feat/app-distribution` 后，由 PM 评估是否合并 main（ISS-022/023
  settings 页 worker 已在 `feat/settings-page` 用 placeholder 占位等待 ISS-021
  收口）。
- v0.3 第一次正式 release 前，PM 完成：
  1. 本地 `cargo tauri signer generate` 生成生产 keypair
  2. 把 `tauri.conf.json` 的 `pubkey` 替换为 `.pub` 第二行
  3. 把私钥 / 密码添加到 GitHub Secrets
- autoUpdateCheck 落地（加 `AppSettings.autoUpdateCheck` + About section mount
  hook）作为独立 PR，从 `feat/app-distribution` 拉出 `feat/auto-update-check`。
## DEC-049 ISS-009 PDF Expert Shell UI 收口（v0.1 alpha.10）

- 日期：2026-06-04
- 状态：已采纳
- 关联任务：ISS-009（设计系统落地）
- 关联分支：`feat/pdf-expert-shell-ia`
- 关联 PR：TBD
- DEC 编号承接 DEC-043（ISS-024 doc-curator symlink 治理）后 +4（044/045/046 由其它 worker 占用 / 暂未使用；本 worker 直接跳到 047 记录 ISS-009 整体收口方案；与 DEC 编号跳号策略保持一致）

承接 DEC-013（应用 Shell 阅读优先任务模式信息架构）、DEC-027（3 wave 多 worktree 推进中的 W5 ui-worker = ISS-009）和 DEC-043 之后的当前 `feat/pdf-expert-shell-ia` 收口需要。本决策记录 ISS-009 视觉 polish 第二阶段的四个 milestone 实现边界 + 一项 baseline unblock。

### 1. tsconfig.json lib 升级 ES2020 → ES2022（baseline unblock）

- `tsconfig.json`：`target` / `lib` 从 `"ES2020"` 升级到 `"ES2022"`。原因：现有 `src/modules/{pages,settings,ocr,preprocess}/...` 已大量使用 `Array.prototype.at()` / `String.prototype.at()`，但 lib 设到 ES2020 时 `.at()` 不在类型中，导致 `npm run typecheck` 报 17 个错误。
- 这是"lib 字段声明滞后于实际 JS 运行时使用"的 baseline 修复，不修改任何代码语义。target 升级到 ES2022 同步保持一致（Vite + esbuild 已默认 ES2022+ 输出）。
- 不影响：现有运行行为 / 测试结果 / 构建产物。

### 2. 阅读态视觉 polish（Milestone 1）

- `src/components/layout/ReaderCanvas.tsx`：当 `document.ocrStatus === "needed"` 时，在 `DocumentReader` 顶部显示 `.reader__status-banner` 提示条 + 跳转到 OCR 模式的 `<button>`，调用新增的 `onRequestOcr` 回调。
- 同一个 `DocumentReader` 在每个 `PdfPage` 的 fallback `.empty-state` 块底部增加 `<p class="pdf-page__text-layer-badge">` 文字层状态徽章（`available` / `missing` / `poor` 颜色区分），用 `data-testid="text-layer-badge-N"` 暴露给 e2e。
- `src/components/layout/Toolbar.tsx`：`fileSubtitle` 在 document === null 时区分"未打开文档" / "打开失败" 两种中文文案（不再共用"等待文件"）。
- `src/App.tsx` 注入 `onRequestOcr={() => setActiveMode("ocr")}` → `AppShell` → `ReaderCanvas`。
- `src/styles/app.css` 新增 `.reader__status-banner` / `.pdf-page__text-layer-badge--{available,missing,poor}` 样式。
- 4 项 ReaderCanvas 单测覆盖：banner 显示 / 隐藏 / 禁用（无 callback）/ 文字层徽章。
- 验证：73 文件 / 676 测试（+4）；typecheck / build / cargo check 全绿。

### 3. 搜索结果层（Milestone 2）

- `src/components/layout/Toolbar.tsx` `SearchResultsPopover`：
  - 头部从 `命中 N 处` 升级为 `命中 X / N（N 处）` 索引计数（有 active hit 时显示索引，否则仅总数）。
  - 索引进度：`索引 X / Y 页`（替代原本的"仍有 N 页未索引"）。
  - 命中页码 chip 行 `.search-popover__pages`：每页一个 `.search-popover__page-chip` 按钮（`p.N`），点击直接 `search.selectHit` 跳转到该页的最近一个命中。
  - 上一/下一按钮文案精简为「上一个」「下一个」。
- `src/components/layout/ReaderCanvas.tsx`：
  - `DocumentReader` 接受 `activeHitPageNumber = searchState?.activeHit?.pageNumber`，传给每个 `PdfPage` 的新 `activeHit?: boolean` prop。
  - `PdfPage` 在 `activeHit` 时设置 `data-active-hit="true"`，CSS 用 `outline: 2px solid var(--accent)` 高亮。
  - 新增 `useEffect` 在 `activeHit.id` 变化时调 `target.scrollIntoView({ behavior: "smooth", block: "center" })`；jsdom 用可选链兜底（`scrollIntoView?.`）。
- `src/modules/search/searchUi.test.tsx` 同步更新：`命中 2 处` → 正则 `/命中 1 \/ 2（2 处）/`；"下一个命中" → "下一个"；"命中 1 处" → 正则 `/命中 \d+ 处/`。
- `src/styles/app.css` 新增 `.pdf-page[data-active-hit="true"]` outline + `.search-popover__page-chip` 样式。
- 1 项新 ReaderCanvas 单测：active hit 仅高亮对应页。
- 验证：73 文件 / 677 测试（+1）；typecheck / build / cargo check 全绿。

### 4. 页面管理多选 / 撤销 / 风险（Milestone 3）

- `PageOrganizerWorkspace` 从 `src/components/layout/AppShell.tsx` 内部函数拆出为独立文件 `src/components/layout/PageOrganizerWorkspace.{tsx,css,test.tsx}`，便于维护 + 测试。
- 多选状态 `selectedPageNumbers: ReadonlySet<number>` + shift+click 区间选择。**关键 bug 修复**：`lastClickedPageRef` 必须在 click handler 同步读取后传给 setState updater，**不能**在 updater 内部读 ref.current（React 可能在 updater 真正运行前已经把 ref 改为新的 pageNumber，导致 shift+click 区间计算错位）。
- 7 个页面操作按钮按选择态正确启用/禁用（"粘贴"始终禁用，本 PR 无剪贴板集成）。
- 删除前弹 `RiskConfirmDialog`（role=dialog, aria-modal=true）：列出前 8 个页码 + 总数，明确"另存为新 PDF"前的预览不保留原始文件副本。
- 另存为新 PDF 弹 `ExportRiskDialog` 风险提示：明确"不会覆盖原始文件" + 设置 → 保存可调整默认目录。
- 撤销按钮 + 已应用动作计数（占位 UI，**不**接 pageOrganizer service 真实页面变换；后续导出 worker 接入时复用 `usePageOrganizerController`）。
- 文档切换时清空选择 + 撤销栈 + 风险对话框。
- 8 项 PageOrganizerWorkspace 单测覆盖：空态 / 默认禁用 / 点选启用 / shift 选区 / 风险确认 / 撤销计数 / 导出风险 / 清除选择。
- `src/styles/app.css` 保持原样（page-organizer 既有类不动），新 CSS 全部到 `PageOrganizerWorkspace.css`。
- 验证：74 文件 / 685 测试（+8）；typecheck / build / cargo check 全绿。

### 5. 扫描 / OCR 任务参数区（Milestone 4）

- `OcrWorkspaceController` 扩展 `parameters: OcrWorkspaceParameters` 字段，包含：
  - `activeProvider: { id, label, kind: "local" | "cloud", requiresNetworkConsent } | null`：用 `classifyProviderKind` 归一化（`local-` 前缀 / `legal-skills` / loopback endpoint 视为本地；其余 https endpoint 视为云端）。
  - `outputStrategy: OcrOutputStrategy`：当前是 `new-layered-pdf`。
  - `qualityCheck: { enabled, keywords, description }`：从 `OcrQualityCheckRequest` 派生。
  - `networkConsentRequired: boolean`：云端 provider + `requireNetworkConsent` + `!networkConsentGranted` 时为 true。
- 新增 `src/modules/ocr/ui/OcrWorkspaceHeader.tsx` 独立组件，展示 5 行：文档名 / OCR 后端（带 local/cloud tag）/ 页码范围 / 输出策略 / 质量检查；云端 provider 且 `requiresNetworkConsent` 时多展示一行"联网授权"状态。
- `OcrWorkspace` 顶部挂载 `OcrWorkspaceHeader`，接收 `availableProviders` / `documentLabel` / `pageCount` props。
- `AppShell` 透传 `settings.ocrProviders` / `reader.state.document?.name` / `pageCount`。
- 7 项 OcrWorkspaceHeader 单测：无 provider / 本地 / 云端未授权 / 云端已授权 / 质量检查关键词 / 多 provider 计数 / 页码范围。
- 同步 `AppShell.test.tsx` / `OcrWorkspace.test.tsx` 的 controller mock 补 `parameters` 字段。
- 验证：75 文件 / 692 测试（+7）；typecheck / build / cargo check 全绿。

### 6. 范围与依赖

- 修改文件（共 17）：
  - `tsconfig.json`（baseline unblock）
  - `src/App.tsx`（注入 onRequestOcr 回调）
  - `src/components/layout/{AppShell,Toolbar,ReaderCanvas,PageOrganizerWorkspace,types}.tsx` + `PageOrganizerWorkspace.css`
  - `src/modules/ocr/ui/{OcrWorkspace,OcrWorkspaceHeader,useOcrWorkspaceController,ocrWorkspace.css}`
  - `src/modules/search/searchUi.test.tsx`（同步文案）
  - `src/styles/app.css`（新增 badge / banner / outline / chip 类）
- 新增文件（共 4）：
  - `src/components/layout/PageOrganizerWorkspace.{tsx,css,test.tsx}`
  - `src/modules/ocr/ui/OcrWorkspaceHeader.{tsx,test.tsx}`
  - `docs/plans/2026-06-04-pdf-expert-shell-polish.md`（writing-plans skill 产出）
- 不修改：`src/shared/**` / `src-tauri/**` / `package.json` / 锁文件 / 共享契约 / 现有 service 内部 / 现有 AppShell 之外的 layout 组件（Sidebar.tsx / StatusBar.tsx / AnnotationSidebar.tsx 等未触碰）。
- 不实现新功能：搜索算法、批注写入、OCR 调用、导出操作、真实页面变换、tsconfig 之外的基础设施变更。
- 不引入新 npm 包。

### 7. 已知限制

- 页面管理 Undo 是占位 UI（仅 `appliedActionCount` 计数 + 视觉 enabled 切换；未接 pageOrganizer service 的真实 history/undo 状态机）。后续导出 worker 接入 `usePageOrganizerController` 时，本组件只需把 `appliedActionCount` 替换为 `state.history.length`，把 onClick 替换为 `controller.undo()`，UI 形状不变。
- OCR 参数区是只读展示；用户改 provider / qualityCheck / networkConsent 仍需走「设置 → OCR provider」面板。后续 ISS-022 设置浮层收口时可让 `OcrWorkspaceHeader` 各项点击直接打开对应 section。
- `tsconfig.json` 升级是全项目影响；其他 worker worktree 切到新 main 后也会看到 lib=ES2022，无破坏性。
- `/tmp/faropdf-ui-sample.pdf` 在本会话期间不存在；视觉验证以 dev server + 浏览器打开 / `:5173/` 即可，无须 fixture PDF 即可观察空态 + 模式切换。

### 8. 验证汇总

- `npm run typecheck` ✅
- `npm test -- --run` ✅ 75 文件 / 692 测试（+ 19 新测试：ReaderCanvas 4 + 1 / PageOrganizerWorkspace 8 / OcrWorkspaceHeader 7 — 与上 4 个 milestone 一致；searchUi 文本断言调整 3 处）
- `npm run build` ✅ 1447 KB JS / 603 KB gz（与 M0 一致，无回归）
- `cargo check --manifest-path src-tauri/Cargo.toml --offline` ✅（pre-existing 9 dead_code warnings 与本 PR 无关）
- 4 个 commit（`feat(shell): reader-state visual polish` / `feat(shell): search-results layer hit navigation` / `feat(shell): page-organizer multi-select undo risk` / `feat(shell): ocr parameter area`）。

### 9. 范围原则（不破例）

- 本 PR 不修改 `Toolbar.tsx`（仍按 DEC-032 协议） / `Sidebar.tsx` / `App.tsx` 全局状态机 / 全局路由 / 任何共享契约。
- 本 PR 不引入新依赖。
- 本 PR 不调用 Tauri command；OCR 后端逻辑未变（仅在 controller 上新增 `parameters` 派生字段）。
- 跨 worker 协调：未与其他 worktree 冲突（其它 worker 范围在 `src/modules/{annotation,export,forms,preprocess}/` 等，本 worker 集中在 `src/components/layout/` + `src/modules/ocr/ui/` + `src/styles/app.css` + `tsconfig.json`）。

## DEC-050 ISS-007 OCR 端到端联调（fixture + E2E 集成测试）

### 1. 背景

承接 DEC-030（OCR bridge 真实接入）+ DEC-042（OCR 模式工具条接入 AppShell）+ DEC-031 / DEC-040 之后，`feat/ocr-e2e` 分支落实 ISS-007 「下一步」段第一条：
> 真实 PDF 端到端联调（提供 fixture 验证 `*-ocr.pdf` 输出 + 质量检查）

OCR 链路跨 5 个 Tauri command（`start_ocr_job` / `list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text`）+ 前端 `OcrBridgeService` + `OcrJobController` + `OcrPostProcessor` + `OcrQualityCheckService`，**未有任何集成测试**覆盖「真实 ocrmypdf 子进程 → 真实 pdftotext 文本抽取 → 真实质量报告生成」全链路。本期填这个缺口。

### 2. 决策

#### 2.1 夹具策略：脚本生成（不入仓）

- 新增 `tests/fixtures/ocr/generate-scan-fixture.mjs`：Node + pdf-lib 脚本，把一张 400x150 预渲染 PNG（base64 内嵌在源文件里，**不依赖 ImageMagick / pdftoppm**）嵌入 2 页 A4 PDF，生成 `scan-only-sample.pdf`（~5 KB）。
  - 选 base64 内嵌是因为 2.3KB 体积的 PNG 完整 base64 仅 ~3.1KB，可作为源文件常量；脚本不依赖任何外部渲染工具，保证 clone 后 `node tests/fixtures/ocr/generate-scan-fixture.mjs` 即可得到稳定 fixture。
  - 2 页 A4 便于覆盖 `pageRange` 参数（"1" / "1-2" / "2" 都能命中）。
  - PNG 内的 "OCR E2E 2026 / line one / line two / line three" 文字在外部用 `magick convert` 预渲染成像素（**不是 PDF 文字层**），保证 ocrmypdf 走图像识别路径。
- 产物 `scan-only-sample.pdf` 由 `.gitignore` 排除（新增 `tests/fixtures/ocr/*.pdf` 规则）。
- 配套 `tests/fixtures/ocr/README.md` 记录重新生成命令、所需本机工具（ocrmypdf ≥ 13 / pdftotext ≥ 22 / curl ≥ 7 / tesseract + eng + chi_sim）、已知限制。

#### 2.2 前端 vitest 集成测试 `tests/e2e/ocr-e2e.test.ts`

- 4 个 case：
  1. **full pipeline** — `OcrBridgeService.startOcr`（注入真实 ocrmypdf 后端）→ `OcrJobController`（注入 pdftotext 后端 list/poll/extract）→ `OcrPostProcessor.buildReport` → 断言 `status=completed` / 输出 PDF 存在 / 2 页都有文字 / 关键词 "OCR/E2E/2026" 全部命中 / `passed=true`。
  2. **bridge rejects mismatched providerId** — 配置只含 `local-ocrmypdf` 时，调 `providerId: "mineru"` 必须抛 `OCR Provider ...` 错误（不出 ocrmypdf 子进程）。
  3. **controller sanitises paths** — 后端抛带路径的错误，controller 包装后必须把完整本地路径替换为 `[path]`。
  4. **prepareOcrRequest defaults** — 纯函数 `prepareOcrRequest` 把 `outputPath` 填成 `*-ocr.pdf`、`outputStrategy="new-layered-pdf"`、`qualityCheck.enabled=false`。
- 跳过策略：模块级 `beforeAll` 探测 `ocrmypdf --version` 与 `pdftotext -v`，缺一则每个 test 内部 `if (!requireTools()) return;` 静默跳过（CI 不阻塞）。
- 后端注入：测试不依赖 Tauri runtime，构造 `OcrBridgeBackend.startOcr`（real ocrmypdf via `child_process.spawn`）+ `OcrJobController` 注入的 invoker（`list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` 走内存 state，`extract_ocr_text` 走 `pdftotext -layout`）。
- fixture 路径解析：`process.cwd()` 即项目根；fixture 缺失时通过 `spawn(/opt/homebrew/bin/node, generate-scan-fixture.mjs)` 重生成（vitest 沙箱里 PATH 可能被裁，先硬编码几个候选路径再回退 `process.execPath`）。
- pdftotext 输出分页：`splitPages` 先 strip 收尾 `\f` / 空白再 `split("\f")`，避免结尾空段被算成额外页（实际修复了一个 3 vs 2 的 false alarm）。

#### 2.3 Rust 集成测试 `src-tauri/src/lib.rs` 末尾 `#[cfg(test)] mod ocr_e2e_tests`

- 项目无 `src-tauri/tests/` 目录，且除 `run()` 外所有模块都是 private，集成测试只能内联在 `lib.rs` 的 `#[cfg(test)] mod` 里（与 `ocr_bridge_tests` / `scan_preprocess_tests` 风格一致）。
- 单 case `full_ocr_pipeline_runs_ocrmypdf_then_extracts_text_via_pdftotext`：
  1. 复用前端 fixture（`tests/fixtures/ocr/scan-only-sample.pdf`，不存在则整个测试 `return` 跳过，不 panic），复制到 temp 目录避免污染源文件。
  2. `dispatch_ocr(OcrDispatchBackend::LocalOcrMyPdf)` 真实跑 ocrmypdf，断言输出 PDF 存在且 `output_size_bytes > 0`。
  3. `extract_pdf_text` 抽文字层，断言 `pages.len() == 2`（fixture 2 页）+ `summarized.searchable_pages == 2`。
  4. `OcrJobQueue::new(tempfile)` 持久化 `OcrStoredJob` 字段，重新 `OcrJobQueue::new(same path)` 读回，断言 `status=completed` / `backend=local-ocrmypdf` / `input_path_summary.kind=local-pdf` / `fingerprint` 非空 / `progress.completed_pages=2`。
- 跳过条件：`tools_available()` 探测 `ocrmypdf --version` 与 `pdftotext -v`，缺一就 `return`。
- 状态写入：直接 upsert `status="completed"`（避开 `reconcile_running_after_restart` 把残留 running 改成 cancelled 的行为，这是该 hook 的预期行为不是 bug）。

#### 2.4 顺手修了一个生产 bug：`extract_pdf_text` 参数顺序

- `src-tauri/src/ocr_text_extract.rs:53-58` 原代码：
  ```rust
  Command::new("pdftotext").arg("-layout").arg("-enc").arg("UTF-8").arg("-").arg(pdf_path)
  ```
  pdftotext 期望的语法是 `pdftotext [options] input.pdf [output]`，把 `-`（stdout）放在 input 之前会让 pdftotext 把 `-` 当成 input（读 stdin），`pdf_path` 当成 output（写文件），结果进程以 `Syntax Error: Document stream is empty` 退出 1。
- 修正为 `.arg(pdf_path).arg("-")`，与 pdftotext CLI 语法一致。`extract_ocr_text` Tauri command 自 DEC-030 接入以来实际从未在真实 E2E 流通过——本期 E2E 第一次把它接进真实链路并触发。
- 影响：`extract_ocr_text` + `start_ocr_job` 内 `quality_check.enabled=true` 分支（lib.rs:654）现在能正确抽取文字层喂给质量检查。
- 既有 `split_into_pages` 单测只用字符串拼接，不调真实 `Command::new("pdftotext")`，所以这个 bug 之前完全没被测到。本期新增 4 + 1 个 E2E 真实链接测试补了这个盲点。
- 沿用 DEC-030 / DEC-031 / DEC-040 风格：bug 修复 + 真实链接测试一起落 PR，不拆独立 commit。

#### 2.5 范围与依赖

- **修改**：
  - `.gitignore`（新增 `tests/fixtures/ocr/*.pdf` 等规则）
  - `src-tauri/src/ocr_text_extract.rs`（1 行参数顺序修复，# §2.4）
  - `src-tauri/src/lib.rs`（末尾追加 `#[cfg(test)] mod ocr_e2e_tests`；不修改 `run()` / 任何 command / 任何共享契约；理由见 STATUS.json 的 `scope_change_log`，已设 `pm_action_required=true`）
- **新增**：
  - `tests/fixtures/ocr/generate-scan-fixture.mjs`
  - `tests/fixtures/ocr/README.md`
  - `tests/fixtures/ocr/scan-only-sample.pdf`（.gitignore 排除，不入仓）
  - `tests/e2e/ocr-e2e.test.ts`
- **不修改**：`package.json` / `package-lock.json` / `src-tauri/Cargo.toml`（`lopdf` 已在 DEC-040 引入，fixture 复用前端脚本，Rust 测试只复用不重新生成）/ `src/components/` / `src/App.tsx` / 全局样式 / 路由 / `Toolbar.tsx`（按 DEC-032 协议）/ `src/shared/ocr/*`（契约不变）。
- 不引入新 crate，不引入新 npm 包；测试只读已有 `pdf-lib` 1.17.1 + Node 25 + Cargo 1.88.0 + lopdf 0.33 + ocrmypdf 17.4 + pdftotext 26.02。

#### 2.6 commit cadence

- 2 个 milestone（按 prompt 要求）：
  - **(a) E2E 测试基础设施 + fixture 策略**：`tests/fixtures/ocr/{generate-scan-fixture.mjs, README.md, scan-only-sample.pdf}` + `.gitignore` + `src-tauri/src/ocr_text_extract.rs` 修复。
  - **(b) E2E 集成测试 + 验证**：`tests/e2e/ocr-e2e.test.ts` + `src-tauri/src/lib.rs` 末尾 `ocr_e2e_tests` mod。

### 3. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `npm test -- --run` | ✅ 74 文件 / 697 tests 全过 | + 4 个新 e2e（OCR bridge + controller + postProcessor + prepareOcrRequest）|
| `npx vite build` | ✅ 2.81s | dist 产物完整；`npm run build` 走 `tsc && vite build`，tsc 阶段会因 pre-existing `.at()` 报错，**与本 PR 无关**（详见 §5）|
| `cargo test --manifest-path src-tauri/Cargo.toml --offline --lib` | ✅ 42 / 42 全过 | + 1 个新 Rust E2E（dispatch_ocr + extract_pdf_text + OcrJobQueue 持久化）|
| `cargo check --manifest-path src-tauri/Cargo.toml --offline` | ✅ 干净 | 9 个 pre-existing dead_code warning 来自 scan_preprocess，与本 PR 无关 |
| `ocrmypdf --version` | 17.4.0 | `/opt/homebrew/bin/ocrmypdf` |
| `pdftotext -v` | 26.02.0 | poppler-utils，`/opt/homebrew/bin/pdftotext` |
| `bash .claude/skills/doc-curator/scripts/scan.sh` | （未跑，pm_action_required 处理）| PM 在合并时单独跑 |

### 4. 已知限制

- **typecheck / `npm run build` 失败**：`tsc --noEmit` 报 28 个 `TS2550: Property 'at' does not exist`，全部在 pre-existing 文件（`src/components/layout/AnnotationToolbar.test.tsx` / `src/modules/annotation/sidebarGroups.test.ts` / `src/modules/export/pathSafety.ts` / `src/modules/pages/imagePack/imagePackPlanner.ts` / `src/modules/pages/pageOrganizer.{ts,test.ts}` / `src/modules/reader/pdfReaderService.ts` / `src/modules/settings/sections/{GeneralSection,OcrProviderSection,ReaderSection}.test.tsx` / `src/modules/settings/SettingsPanel.test.tsx` / `src/shared/{ocr,preprocess}/defaults.ts`），根因是 `tsconfig.json` 的 `target: ES2020` / `lib: ["ES2020", ...]` 不支持 `Array.prototype.at`（ES2022）。本 PR 不引入任何新 `.at()`，修复需升级 `tsconfig.json`（超出本任务范围）。PM 合并时可与 48cb9b4 annotation stage 4 PR 的同类问题一并处理。
- **fixture 必须先有**：`scan-only-sample.pdf` 不入仓，clone 后必须先 `node tests/fixtures/ocr/generate-scan-fixture.mjs`，否则 Rust E2E 静默跳过（前端 E2E 会自动重新生成）。
- **CI 环境假设**：E2E 测试要求 `ocrmypdf` + `pdftotext` + `tesseract` + `eng` / `chi_sim` 语言包；CI 镜像未预装时测试会被 `describe.skip` 静默跳过，**不视为失败**。如果 PM 需要 CI 强制 E2E，可加 GitHub Actions setup 步骤 `brew install ocrmypdf poppler tesseract`。
- **云端 OCR provider E2E 缺位**：本期 E2E 只覆盖 `local-ocrmypdf` + `legal-skills`（走相同本地 ocrmypdf 后端），不覆盖 `paddleocr` / `mineru` 真实 HTTP 调用（需要 mock server 或断网测试）。ISS-007 v0.1 真实使用场景是本地 ocrmypdf，云端 provider 留 ISS-010 consent flow 收口后另起 worker。
- **`reconcile_running_after_restart` 不让 E2E 写 running 状态**：测试必须写 completed 状态以验证 reload 完整性；如要覆盖 reconcile 行为需另起专门 case（不在本期范围）。

### 5. PM 关注项

- **scope 变更**：`src-tauri/src/lib.rs` 原本在 forbidden 范围，但 Rust 集成测试只能内联在此文件末尾的 `#[cfg(test)] mod`（项目无 `tests/` 目录 + 除 `run()` 外模块都是 private）。已在 STATUS.json 的 `scope_change_log` 详细说明，仅追加测试模块不动生产路径。`pm_action_required: true`。
- **bug fix 归并**：`extract_pdf_text` 的 pdftotext 参数顺序 bug 与 E2E 测试一起落 PR，未拆独立 commit。理由：bug 仅在 E2E 真实链接中浮现，且 DEC-030 / DEC-031 / DEC-040 既有 worker 都按"bug 修复 + 真实测试同 PR"模式走。
- **typecheck 现状**：本 PR 不引入新 typecheck 错误；28 个 pre-existing `TS2550` 阻塞 `npm run build` 走 `tsc` 阶段，但 `npx vite build` 本身正常出 dist。建议 PM 单独提一个 `chore(tsconfig): 升级到 ES2022 修复 .at()` 维护 PR（也可并入 doc-curator 维护 PR），不在本 PR 范围。

### 6. 后续路径

- ISS-007 v0.1 收口：bridge + 模式工具条 + 端到端测试三件套落齐；`keychain:` 凭证引用与 OS Keychain 集成、legal-skills fallback 收敛按 ISS-007 「下一步」后续推进。
- 真实场景验证：把本 E2E 测试纳入 CI（在 GitHub Actions 镜像装 `ocrmypdf` + `poppler` + `tesseract-lang`）。
- 云端 provider 端到端：ISS-010 consent flow 收口后，另起 worker 写 `paddleocr` / `mineru` 的 vitest E2E（需要本地 mock HTTP server）。

## DEC-051 ISS-023 作者卡 + 微信二维码占位方案

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：ISS-023
- 关联分支：`feat/iss-023-author-update`

承接 DEC-038（设置页浮层 5 sections + About 入口占位）+ DEC-048（ISS-021 全平台打包与自动更新 + 9 态 update service）之后，本决策记录 ISS-023「关于页面与作者页」剩余收口的边界，确认沿用 DEC-038 §"5 个 section" 的目录结构、DEC-048 §"AppUpdateClient 9 态" 状态机、DEC-026 §"folia 关于页参考" 的作者卡三段式。

### 1. 背景与剩余工作

ISS-023 任务卡（`docs/TASKS.md` §"ISS-023"）原验收要求分两块：

1. 「关于」section 元数据（产品名 / 定位 / 版本 / 官网 / GitHub / 检查更新）：DEC-038 已落，DEC-048 把「检查更新」按钮接 `createTauriUpdateClient` 9 态状态机，ISS-023 不再重复实现。
2. **作者卡**（作者姓名 / GitHub 链接 / 微信公众号二维码 / 扫码说明）：DEC-038 §"About" 占位是 `作者卡暂为占位，公众号二维码和详细联系方式将在后续迭代补齐` 的纯文本 footnote，**未**有真实二维码占位图、扫码说明、未抽出独立组件。本期收口这一块。

### 2. 决策

#### 2.1 新建 `src/components/settings/` 作为设置相关展示组件目录

- 原计划（ISS-023 任务卡原文）写的是 `src/components/settings/AboutSection.tsx`，但 DEC-038 已把 AboutSection 落到 `src/modules/settings/sections/AboutSection.tsx`（与 `GeneralSection` / `ReaderSection` / `OcrProviderSection` / `ShortcutSection` 同目录）。
- 本期**不**移动 AboutSection 位置（避免 PR 范围扩大、减少与同期其他 worker 的合并冲突）；仅新建 `src/components/settings/` 作为「设置相关的展示型组件」目录（区别于 `src/modules/settings/sections/` 的「section 容器组件」），落 `AuthorCard.tsx` / `AuthorCard.test.tsx` / `AuthorCard.css`。
- 受 `src/components/settings/` 影响的路径：
  - AboutSection.tsx 通过 `import { AuthorCard } from "../../../components/settings/AuthorCard"` 引用（深度正确：`sections/` 是 `modules/settings/` 的子目录）。

#### 2.2 AuthorCard 设计：受控 + 兜底 + 隔离样式

- **Props 注入而非直接读 metadata**：避免耦合 `readAppMetadata()`，单测可独立传任意 `authorName` / `githubUrl` / `wechatQrSrc`；AboutSection 继续从 `readAppMetadata()` 取 `authorName` / `repositoryUrl` 后透传给 AuthorCard。
- **空 `authorName` 兜底**：AuthorCard 内部检测 `authorName.trim().length === 0`，渲染 `<span class="settings-section__empty">作者信息未配置</span>`，GitHub 链接仍保留（不丢失联系入口）。AboutSection 透传 `metadata.authorName ?? ""`。
- **`githubUrl` 兜底**：AuthorCard 不兜底（链接是必填）；AboutSection 传 `metadata.repositoryUrl ?? "https://github.com/cat-xierluo"`（与 `package.json` 的 author.url 对齐，仓库未配置时回退到作者个人页）。
- **样式独立到 `AuthorCard.css`**：不污染 `src/styles/app.css`、不复用全局 `.settings-author-card`（仅在 `src/modules/settings/SettingsPanel.css` 提供基础壳层 `display / flex-direction / gap / padding / border / border-radius / background`）；新增子 class：
  - `.settings-author-card__name` — 段落行；
  - `.settings-author-card__author-name` — 作者展示名 span，便于文本提取与样式钩子；
  - `.settings-author-card__github-link` — GitHub 链接（hover / focus underline）；
  - `.settings-author-card__qr` — 二维码 + 扫码说明横排容器（`flex` row，`align-items: center`）；
  - `.settings-author-card__qr-image` — 120×120，`image-rendering: pixelated`（让 1×1 占位图在容器内放大仍保持方块感，避免被浏览器平滑模糊掩盖「占位」事实）；
  - `.settings-author-card__instruction` — 12px muted 副文；
  - `@media (max-width: 479px)` — 窄屏下 `flex-direction: column`，避免 900px 视口下文字被挤压。

#### 2.3 公众号二维码占位图 + LICENSE 说明

- `src/assets/wechat-qrcode.png`：1×1 像素 8-bit 灰阶 PNG（67 字节），用 Python 脚本直接写 PNG IHDR + IDAT + IEND 三 chunk 生成，**不依赖** ImageMagick / pdf2image / opencv 任何工具。
- `src/assets/QRCODE_LICENSE.md`：说明当前为占位、后续替换流程（推荐 PNG / JPG、正方形 ≥ 240×240 像素）、**不收录任何账号 / 密码 / Token / 私钥**、仅使用项目作者本人拥有或经授权的二维码。
- 选择「1×1 占位」而非「画一个虚构二维码」的原因：占位图要明显是占位，部署前由作者替换为真实二维码；虚构二维码会误导用户扫码。
- 替换流程文档化在 `QRCODE_LICENSE.md`，避免后续 worker 不替换直接 ship 1×1 占位图。

#### 2.4 「检查更新」按钮不重做，保留 DEC-048 9 态

- ISS-023 任务卡原文同时要求「实接 createTauriUpdateClient，9 态状态机」——这部分 DEC-048（PR #31 / commit 652a53a）已经完成，包含：
  - `AppUpdateClient` 抽象（`checkForAppUpdate` / `downloadAndInstallUpdate`）；
  - 9 态 `AppUpdateStatus`（`idle` / `checking` / `latest` / `available` / `downloading` / `downloaded` / `installing` / `unsupported` / `error`）；
  - AboutSection 已通过 `updateClient` prop 注入便于单测（详见 DEC-048 §2.4）。
- 本期**不**修改 `src/shared/update/`（已被列为 forbidden，已 close 的 scope）；AboutSection.tsx 中「检查更新」逻辑保持原样，仅替换末尾的作者卡占位。

#### 2.5 范围与依赖

- **修改**：
  - `src/modules/settings/sections/AboutSection.tsx`（末尾作者卡占位 div 替换为 `<AuthorCard>`；新增 2 个 import：AuthorCard 组件 + `wechat-qrcode.png` 静态资源）；
  - `src/modules/settings/sections/AboutSection.test.tsx`（追加 3 项：QR 图片 alt/src、扫码说明文案、legacy placeholder 消失）。
- **新增**：
  - `src/components/settings/AuthorCard.tsx`
  - `src/components/settings/AuthorCard.test.tsx`（6 项：name 渲染、GitHub 链接 href/target/rel、QR 图片 src/alt、扫码说明、空 name 兜底、className 透传）
  - `src/components/settings/AuthorCard.css`
  - `src/assets/wechat-qrcode.png`（1×1 灰阶占位，67 字节）
  - `src/assets/QRCODE_LICENSE.md`
- **不修改**：
  - `src/shared/settings/`（autoUpdateCheck 留 follow-up，不在本 PR；按 ISS-023 forbidden 列表）
  - `src/shared/update/*`（DEC-048 已 close，scope 不重开）
  - `src/shared/app/metadata.ts`（仅在 AboutSection 透传 `metadata.authorName` / `metadata.repositoryUrl`，AuthorCard 不直接依赖）
  - `src/components/layout/{Toolbar,Sidebar}.tsx`、`src/App.tsx`、`src/styles/app.css`、`package.json` / 锁文件、`src-tauri/**`
  - 任何 reader / search / annotation / forms / export / pages / ocr / preprocess 模块。
- 不引入新依赖。

#### 2.6 已知限制

- 当前二维码是 1×1 占位图（`image-rendering: pixelated`），正式发布前必须由作者替换为真实公众号二维码；`QRCODE_LICENSE.md` 记录替换流程。
- 公众号二维码**不**支持热更新；如未来想走「运行时下载」需要走 Tauri command，**不**在本 PR 范围。
- AuthorCard 不感知 dark mode（仅跟随全局 CSS variable 切换），如有 dark mode 视觉细节调整后续 PR 处理。

### 3. commit cadence

- 2 个 milestone（按 prompt 要求）：
  - **(a) `[m1] feat(settings): AuthorCard 基础组件（GitHub 链接 + 微信二维码占位）`**：AuthorCard.tsx + AuthorCard.test.tsx + AuthorCard.css + wechat-qrcode.png + QRCODE_LICENSE.md 一起落，1 个 commit。
  - **(b) `[m2] feat(settings): AboutSection 接 AuthorCard，替换占位`**：AboutSection.tsx 末尾 div 替换为 `<AuthorCard>` + AboutSection.test.tsx 追加 3 项，1 个 commit。

### 4. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `npm run typecheck` | ✅ 干净 | 0 个新增类型错误 |
| `npm test -- --run` | ✅ 80 文件 / 743 tests 全过 | + 6 (AuthorCard) + 3 (AboutSection) = 9 项新测试；剩余 34 项为 a271de1 基础之上未计入 DEC-050 基线统计的同 PR 范围外增量 |
| `npm run build` | ✅ | dist 产物包含 `assets/wechat-qrcode-DEMO.png`（Vite 自动 hash 后的输出）|
| `cargo check --manifest-path src-tauri/Cargo.toml --offline` | ✅ | 9 个 pre-existing dead_code warning 与本 PR 无关 |

### 5. 后续路径

- ISS-023 第一版收口后，作者卡升级（如支持多作者、加 GitHub Sponsors / Patreon 链接、运行时切换 dark mode 配色）按需新开 worker。
- 公众号二维码替换流程 PR 走标准 git-workflow：作者在自己分支替换图 + 更新 `QRCODE_LICENSE.md` 替换日期；不强制走本 worktree。

## DEC-052 README 参照 Folia 模板重写

- 日期：2026-06-05
- 状态：已采纳
- 关联分支：`docs/readme-rewrite`
- 关联任务：未挂活跃 ISS（README 重写由 PM 直接派发 worker，不在 `docs/TASKS.md` 活跃任务源里）

承接 DEC-051（ISS-023 作者卡 + 微信二维码占位收口）之后，本决策记录 `README.md` 从 70 行散段重写为与 Folia 同结构项目门面的方案，遵循 DEC-002「FaroPDF 独立项目」、DEC-003「Tauri + React + PDF.js + pdf-lib 技术选型」、DEC-013「阅读优先的 Shell IA」与 Folia README 的 9 个一级 section 结构。

### 1. 背景与动机

- 旧 `README.md`（70 行）只有「项目名 + 一句话定位 + 当前状态 + 首版能力目标 + 设计原则 + 开发命令 + 文档」单线叙述；与 Folia README 的标准门面结构差距明显。
- 0.1.0-alpha.0 ~ 0.1.0-alpha.11 已实际交付阅读底座、4 视图模式 + 8 缩放 + 旋转 + 键盘翻页 + 阅读位置恢复、缩略图、搜索结果层、批注深化 4 阶段（AnnotationOverlay / Toolbar / Sidebar / 中文图章真实绘制 / writeAnnotationPdf / stamp 预览）、OCR bridge 真实接入（本地 ocrmypdf + 云端 PaddleOCR/MinerU + 9 态质量检查）、扫描预处理 lopdf 真实清洁、导出引擎（pdf-lib 真实改写 + 表单 / 批注 flatten + 水印 / Bates / 页码 + 证据图片 A4 编排）、表单签署第一版、ISS-021 全平台打包与自动更新（DEC-048 9 态）、ISS-023 作者卡（DEC-051），旧 README 没体现这些已交付能力。
- 用户经常把 Folia 与 FaroPDF 放在一起看（独立项目但同作者），README 结构对齐 Folia 降低用户认知成本。

### 2. 决策

#### 2.1 README 9 个一级 section，对齐 Folia 结构

按 Folia README 的 9 个一级 section 顺序，并按 FaroPDF 实际形态调整：

1. **项目名 + 一句话定位**（FaroPDF + 面向律师的独立 PDF 阅读器，**快读、检索、批注、整理、OCR、表单签署**一条龙）；
2. **官方仓库**（GitHub `https://github.com/cat-xierluo/FaroPDF`，**不**写官网链接因为 v0.1 阶段尚未搭建独立官网页面，明确标「待发布」避免给假链接）；
3. **下载与安装**（**待发布**——ISS-021 流水线已就位但**未生成公开 release**，本节给出 release 上线后的下载入口占位 + macOS 首次运行 `xattr` 未来指引，**不**假装已有 release）；
4. **功能**（按「阅读与检索 / 批注 / 页面整理 / OCR 扫描 / 导出 / 表单签署 / 设置」7 个子节列实际已交付能力，每条 bullet 都能在 `CHANGELOG.md` 找到对应版本号）；
5. **技术栈**（Tauri v2 + React 19 + TypeScript 5.8 + Vite 7 + PDF.js 6.0.227 + pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1 + Vitest 4.1.8 + ESLint 10；版本号严格来自 `package.json`）；
6. **作者**（沿用 ISS-023 / DEC-051 AuthorCard 数据：**杨卫薪律师** + GitHub `[cat-xierluo](https://github.com/cat-xierluo)` + 微信 `ywxlaw`；**不**写 `package.json` author.name 的 `maoking`，因为 AuthorCard 实际展示名是杨卫薪律师，`maoking` 是 GitHub 用户名）；
7. **开发环境**（Node.js + npm + Rust stable + Xcode CLT for macOS + Tauri CLI 已作为 devDep 安装）；
8. **构建**（`npm run build` 前端 + `npm run tauri build` 桌面 + 产物 `src-tauri/target/release/bundle/` + 引用 `docs/RELEASE.md`）；
9. **许可**（**TODO** —— 当前仓库未提交 LICENSE 文件，建议与 Folia 对齐采用 Apache-2.0，但需首个 release 前 PM 确认与定稿；**不**在本 PR 创建 LICENSE）；
10. **文档**（AGENTS.md / docs/ROADMAP.md / docs/TASKS.md / docs/DECISIONS.md / docs/ARCHITECTURE.md / docs/DESIGN.md / docs/RELEASE.md / CHANGELOG.md）。

#### 2.2 严格不发明未交付能力

- 所有功能 bullet 必须能映射到 `CHANGELOG.md` 0.1.0-alpha.0 ~ 0.1.0-alpha.11 实际交付的版本条目。
- 不确定的能力**不**写入 README：
  - 真实文本高亮几何绘制（DEC-037 flatten 已知限制）**不**写；
  - 增量更新回退完整重装（DEC-048 v0.3 已知限制）**不**写；
  - `autoUpdateCheck` 设置项（DEC-048 v0.3 已知限制）**不**写；
  - `keychain:` 凭证引用与 OS Keychain 集成（DEC-042 已知限制）**不**写；
  - 真实图像重编码压缩（DEC-037 已知限制）**不**写；
  - 90 度方向检测 + 微倾斜 + 双页拆分真实像素检测（DEC-040 已知限制）**不**写。
- 标注规则：若某能力在 `CHANGELOG.md` 已出现但仅「plan-only」或「stub」，README bullet 末尾加「plan-only」或「stub」等限定语，避免把未完成的子能力误报为已完成。

#### 2.3 下载与安装标「待发布」而非留空或假装有

- ISS-021 全平台打包与自动更新流水线已就位（`docs/RELEASE.md` 记录了发布流程、产物矩阵、`latest.json` schema、keypair 生成与 GitHub Secrets 注入），`createUpdaterManifest.mjs` 已实现。
- 但**当前 `GitHub Releases` 页面没有任何 FaroPDF release**，`latest.json` 也未发布；CI 镜像装 webkit2gtk-4.1 / librsvg2 / libxdo / libayatana-appindicator3 走 macos-universal + windows-x64 + linux-x64 3 平台 build matrix 已配，但**首发签名 keypair 仍需 PM 手动 `cargo tauri signer generate`**。
- 旧 README 没有下载入口；本 PR 仍不假装有 release，给出「release 上线后预期下载入口 + macOS 首次运行 `xattr` 未来指引」并明确标「**当前状态：待发布**」。

#### 2.4 许可标「TODO」而非默认某种协议

- 当前仓库未提交 `LICENSE` 文件；项目首版贡献者协议与发布协议尚未与 PM 确认。
- 建议与 Folia 对齐采用 **Apache License 2.0**（因为 Folia 已采用），但需首个 release 前 PM 拍板。
- 本 PR **不**创建 LICENSE 文件（避免 PM 后续改协议时需删除 / 替换文件引入 git 历史噪音）。

#### 2.5 图标

- `docs/icon.png` 不存在（搜索 `*.png` 确认）。
- README **不**插入 `<img src="docs/icon.png">` 标签，避免 404 资源引用；与 Folia 顶部居中 logo 的处理差异化。
- 后续如需在 README 顶部加 logo，应先在 `docs/icon.png` 落图标资产，再加标签（独立 PR，避免与本 README 重写耦合）。

#### 2.6 作者卡数据

- 沿用 ISS-023 / DEC-051 收口的 AuthorCard 真实数据：
  - 展示名：**杨卫薪律师**
  - GitHub：`cat-xierluo`（链接 `https://github.com/cat-xierluo`）
  - 微信：`ywxlaw`
- `package.json` author.name 是 `maoking`（GitHub 用户名）；README 以 AuthorCard 实际展示名为准，**不**写 `maoking`。
- 简介沿用 Folia 作者卡语言：专注于技术类纠纷领域，包括知识产权、数据与 AI 相关争议，同时长期关注 AI 技术在法律实务、知识管理和专业写作中的应用；FaroPDF 解决卷宗 / 证据 / 扫描件 / 表单的快读、批注、OCR、页面整理和签署交付。

#### 2.7 范围与依赖

- **修改**：
  - `README.md`（完全重写，从 70 行扩到 ~230 行）
  - `CHANGELOG.md`（顶部追加 `0.1.0-alpha.12 - 2026-06-05` 一段，描述 README 重写 + 范围 + 已知限制）
  - `docs/DECISIONS.md`（追加 DEC-052 本条目）
- **不修改**：
  - `src/**` / `src-tauri/**` / `package.json` / 锁文件 / 任何构建 / Lint / 类型检查配置（与并行 `chore/consolidate-configs` 分支解耦）
  - `docs/ROADMAP.md` / `docs/ARCHITECTURE.md` / `docs/DESIGN.md` / `docs/TASKS.md` / `docs/RELEASE.md` / `AGENTS.md` / `CLAUDE.md`
  - `LICENSE`（**不**创建，与 §2.4 一致）
  - `.gitignore` / `.github/**` / `scripts/**`
- 不引入新依赖。
- 不实现新功能；不修改 `src/components/settings/AuthorCard.tsx` / `src/assets/wechat-qrcode.png` / `src/modules/settings/sections/AboutSection.tsx`（AuthorCard 数据已就位，本 README 直接消费其内容）。

#### 2.8 已知限制

- README 是项目门面快照，与功能持续迭代存在天然滞后；后续每条 ISS 收口后，由 PM 在合并时同步更新 README 对应 bullet（或开 docs-only 维护 PR）。
- 官网入口（`https://cat-xierluo.github.io/FaroPDF/`）在 v0.1 阶段尚未搭建，README 标「待发布」避免给假链接；如未来 v0.3 阶段搭建独立官网页面，再补 `cat-xierluo.github.io` 入口。
- 「macOS 首次运行」指引基于未来 release 形态预测（`xattr -dr com.apple.quarantine`），实际首次运行步骤以 release 时 `docs/RELEASE.md` 为准。
- 「下载与安装」section 描述的是 release 上线后的入口占位，与 `docs/RELEASE.md` §"发布流程" 对齐；首个 release 发布时由 PM 同步把「待发布」标替换为真实 release URL。

### 3. commit cadence

- 1 个 commit（按 worker prompt 要求）：
  - **`docs: README 参照 Folia 模板重写（DEC-052）`**：3 个文件（README.md / CHANGELOG.md / docs/DECISIONS.md）一起落，1 个 commit。

### 4. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `git status --short` | ✅ 干净 | 仅 `M README.md` + `M CHANGELOG.md` + `M docs/DECISIONS.md` 三项 |
| README 资源引用 | ✅ 无 404 | 不引用 `docs/icon.png` / 不存在 release URL |
| README 功能列表与 CHANGELOG 一致 | ✅ | 7 个子节每条 bullet 都能在 `CHANGELOG.md` 找到对应版本号 |
| README 不发明未交付能力 | ✅ | 真实高亮几何绘制 / 增量更新回退 / autoUpdateCheck / keychain / 真实图像重编码 / 像素级方向检测均**不**出现 |
| README 下载与安装 | ✅ 标「待发布」 | 不假装有 release |
| README 许可 | ✅ 标「TODO」 | 不创建 LICENSE 文件 |
| README 作者 | ✅ | 杨卫薪律师 + GitHub cat-xierluo + 微信 ywxlaw，与 AuthorCard 一致 |
| 技术栈版本号 | ✅ | 严格来自 `package.json`（Tauri v2 / React 19 / TS 5.8 / Vite 7 / PDF.js 6.0.227 / pdf-lib 1.17.1 / Vitest 4.1.8） |

### 5. 后续路径

- README 与 `docs/RELEASE.md` 同步：首个 release 发布时由 PM 把「待发布」标替换为真实 release URL；macOS 首次运行步骤以 `docs/RELEASE.md` 实际指引为准。
- 官网入口：v0.3 阶段（ROADMAP §"v0.3 性能与发布"）若搭建独立官网页面，再补 `cat-xierluo.github.io` 入口到 README §"官方仓库"。
- LICENSE 落地：首个 release 前 PM 确认采用 Apache-2.0 后单独 PR 创建 `LICENSE` 文件 + 把 README §"许可" 替换为实际协议名称。
- README 维护责任：每条 ISS 收口时由 PM 决定是否同步更新 README（涉及功能可见性变更的 ISS 建议同步）；docs-only 维护 PR 可走 `docs/*` 分支不依赖 ISS 任务源。

## DEC-053 根目录配置收束到 `config/` 子目录

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：ISS-027
- 关联分支：`chore/consolidate-configs`

承接 README 重写（DEC-052）后，本决策记录项目根目录配置收束方案，确认沿用 Folia 项目的 `config/` 子目录结构。

### 1. 背景与目标

FaroPDF 根目录在 ISS-021 / ISS-023 等多次迭代后散落 5 个配置文件：

- `eslint.config.js`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `vitest.config.ts`

Folia 项目（`/Users/maoking/Library/Application Support/maoscripts/folia/`）的根目录只保留 4 份说明文档 + `LICENSE` + `index.html` + npm 锁文件，配置类（`tsconfig*.json` / `eslint.config.js` / `vite.config.ts` / `playwright.config.ts`）全部收束在 `config/` 子目录。本期对齐 Folia 风格。

### 2. 决策

#### 2.1 收束路径

5 个配置 `git mv` 到 `config/` 同名位置（保留 rename 历史）：

| Source | Destination |
| --- | --- |
| `eslint.config.js` | `config/eslint.config.js` |
| `tsconfig.json` | `config/tsconfig.json` |
| `tsconfig.node.json` | `config/tsconfig.node.json` |
| `vite.config.ts` | `config/vite.config.ts` |
| `vitest.config.ts` | `config/vitest.config.ts` |

#### 2.2 `package.json` scripts 加 `--config` 显式指向

```jsonc
{
  "scripts": {
    "dev": "vite --config config/vite.config.ts",
    "build": "tsc --noEmit --project config/tsconfig.json && vite build --config config/vite.config.ts",
    "typecheck": "tsc --noEmit --project config/tsconfig.json",
    "test": "vitest run --config config/vitest.config.ts",
    "test:watch": "vitest --config config/vitest.config.ts",
    "lint": "eslint . --config config/eslint.config.js",
    "preview": "vite preview --config config/vite.config.ts",
    "tauri": "tauri"
  }
}
```

- `build` 拆成 `tsc --noEmit --project ... && vite build --config ...`（Folia 用 `tsc -b` + `vite build`；FaroPDF 单 tsconfig + `noEmit: true` 等价方案）。
- `typecheck` 显式 `--project` 指向 config 文件，避免 tsc 默认从 cwd 找 `tsconfig.json`。
- 7 个会触发配置加载的 scripts 全部加 `--config` / `--project` 显式指向。

#### 2.3 `tsconfig.json` include 路径

`include: ["src"]` → `include: ["../src"]`（相对 config 文件位置）。`references: [{ "path": "./tsconfig.node.json" }]` 保持不变（双方同移，sibling 相对引用仍正确）。

`tsconfig.node.json` 不动：`include: ["vite.config.ts", "vitest.config.ts", "eslint.config.js"]` 是裸文件名，和 tsconfig 同目录，移入 `config/` 后自动正确。

#### 2.4 `vitest.config.ts` 修 `projectRoot` 计算

原代码：

```ts
const configDir = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/\/$/, "");
const worktreeMarker = "/.claude/worktrees/";
const dependencyRoot = configDir.includes(worktreeMarker)
  ? configDir.slice(0, configDir.indexOf(worktreeMarker))
  : configDir;
```

在 worktree 之外时 `dependencyRoot = configDir`。移动后 `configDir = config/`，`dependencyRoot` 也变成 `config/`，导致 `server.fs.allow` 把 Vite 沙箱限制到 config 子目录。

修复：改名 `dependencyRoot` → `projectRoot`，常规场景 `configDir.replace(/\/config$/, "")` 走父目录；worktree 场景逻辑不变。

```ts
const projectRoot = configDir.includes(worktreeMarker)
  ? configDir.slice(0, configDir.indexOf(worktreeMarker))
  : configDir.replace(/\/config$/, "");
```

`fs.allow` 同步从 `dependencyRoot` 改为 `projectRoot`。

#### 2.5 `eslint.config.js` 切到 `parserOptions.project`

原代码用 `projectService: true`：

```js
parserOptions: {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,  // 移动后 = config/
}
```

移动后 `import.meta.dirname = config/`，project service 从 linted 文件向上 walk 找不到 `tsconfig.json`（它在 `config/`，而 walk 是从文件目录往根目录走，找不到 `config/` 这个 sibling 子目录）。

尝试用 `defaultProject` + `allowDefaultProject` 显式指向：
- `defaultProject: "config/tsconfig.json"` 仍走 project service 逻辑，**不**自动覆盖所有不在 project 的文件。
- `allowDefaultProject: ["**/*.ts"]` 被 typescript-eslint 拒绝（`glob too wide`）。
- `allowDefaultProject: ["src/*"]` 太窄，无法覆盖嵌套。

最终切回 `parserOptions.project` 显式列出两个 tsconfig ：

```js
parserOptions: {
  project: ["./config/tsconfig.json", "./config/tsconfig.node.json"],
  tsconfigRootDir: projectRoot,
}
```

`tsconfigRootDir` 改用 `fileURLToPath(import.meta.url)` + `resolve(..)` 算 project root，不依赖 `import.meta.dirname`（= `config/`）。

代价：`project` 模式（per-file TS Program）比 `projectService` 略慢，对 743 个测试 + 80 个文件规模无明显影响。

#### 2.6 `vite.config.ts` 不动

Vite 以 cwd 为 project root，`--config config/vite.config.ts` 不影响 root 解析。当前 `vite.config.ts` 无 `root` / `build.outDir` / 显式 `process.cwd()` 调用，**全部**走 Vite 默认（cwd-relative），move 后自动正确。

#### 2.7 不影响面

- **不动** `src/**` / `src-tauri/**` / 任何业务模块。
- **不动** 锁文件 / 依赖列表。
- **不动** `src-tauri/tauri.conf.json`（Tauri CLI 调子命令时已经走 `npm run dev` / `npm run build`，scripts 内部已加 `--config`）。
- **不动** `AGENTS.md` / `CLAUDE.md` / `.gitignore` / `docs/ROADMAP.md` / `docs/DESIGN.md`。

### 3. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `git mv` 5 个文件 | ✅ 成功 | rename 检测为 `R`（保留 history） |
| `npm run typecheck` | ✅ 干净 | tsc `--noEmit --project config/tsconfig.json` 0 个新增错误 |
| `npm run lint` | 43 errors | 与 `origin/main` 0.1.0-alpha.11 一致，全部 pre-existing（tests/e2e/ocr-e2e.test.ts 不在 project + tests/fixtures/ocr/generate-scan-fixture.mjs `Buffer`/`process` + fontLoader 一处 irregular whitespace），与本 PR 无关 |
| `npm test` | ✅ 80 文件 / 743 用例 | 0 回归 |
| `npm run build` | ✅ | 2022 modules，dist 产物正常 |
| `cargo check` | ✅ | 9 个 pre-existing dead_code warning 与本 PR 无关 |

### 4. 回退方式

`git restore . && git clean -f` 回到 `origin/main` 状态；5 个 rename 操作可被 `git mv` 反向回到根目录。

### 5. 后续路径

- 与 PM 协同 PR 合并（PR 在 `chore/consolidate-configs` 分支上）。合并后调用 doc-curator subagent 跑文档体检。
- 后续 chore 类工作（如整理 `tests/fixtures/` 体积、清理 pre-existing lint 错误）按需拆 worker。
- Folia 对齐度进阶（如删除 `package.json` 中冗余 dep、统一 `tsconfig.app.json` 三段拆分）放到 0.2 阶段再议。

## DEC-054 项目身份收尾（LICENSE + author.name + icon）

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：ISS-028（个人主页规划，本 DEC 不实现）
- 关联分支：`chore/add-license-and-author`

承接 DEC-052（README 重写，§许可 标 TODO）、DEC-053（根目录配置收束，提到 `LICENSE` 留待首版 release 落地）后，本决策记录项目正式身份三件套（开源协议 + 作者名 + 项目图标）的最终对齐方案，**与 Folia 项目保持一致**（同一作者、同一协议、同一图标风格家族）。

### 1. 背景

- **LICENSE 缺失**：FaroPDF 仓库此前未提交 LICENSE 文件；README §许可 标 TODO；首版 release 前需补齐。
- **author.name 错位**：`package.json` author.name 是 `"maoking"`（GitHub 用户名），但 README §作者 + DEC-051 AuthorCard + DEC-052 §2.6 都明确以「**杨卫薪律师**」为实际展示名；user explicit 指示「author name 的话，以这个 read me 的为主优先」。
- **icon 缺失**：Folia README 顶部有 `docs/icon.png`（灯塔主题），FaroPDF README（DEC-052 重写时）刻意不插入 img 标签（`docs/icon.png` 不存在，避免 404 引用）。本批补齐。

### 2. 决策

#### 2.1 LICENSE 沿用 Folia 的 Apache-2.0 文本

- Folia 仓库已有 `LICENSE`（191 行，标准 Apache License 2.0 文本）。
- **Apache-2.0 文本是标准协议**，不需按项目改文件本身（不像 MIT / BSD 需要在文件顶部写版权年份和持有人）。
- **直接复制** Folia 的 `LICENSE` 文本到 FaroPDF 仓库根（`diff -q` 无差异）。
- 理由：同一作者、同一协议、Folia 已采用，**最大化对齐**；Apache-2.0 包含专利授权 + 商标剥离 + 责任限制，比 MIT / BSD 更适合法律工具类项目。

#### 2.2 `package.json` author.name 以 README 为准

- `author.name`: `"maoking"` → `"杨卫薪律师"`
- `author.url`: 保持 `https://github.com/cat-xierluo`（GitHub 个人页）
- 优先级规则（user explicit）：**`author.name` 字段以 README 实际展示名为准**。`maoking` 是 GitHub 操作系统用户名 / commit author 字段用，不应混用到 author.name。
- 后续约束：所有面向用户的展示（README、AuthorCard、settings §关于、CHANGELOG）统一用「**杨卫薪律师**」；`package.json` 内部字段也保持一致；`git config user.name` 仍可用 `maoking`（开发环境字段，与展示解耦）。

#### 2.3 项目 icon：沿用项目既有 `src-tauri/icons/icon-source.png`

**修正（PR #39 / `fix/icon-from-source`）**：原计划自创 SVG 灯塔（深蓝底 + 自设计），但**项目已有官方 icon source**：

- `src-tauri/icons/icon-source.png`（1254×1254，master 源，1.3MB）
- `src-tauri/icons/icon.png`（512×512，平台默认，253KB）
- `src-tauri/icons/{32x32,128x128,128x128@2x}.png`（各平台尺寸）
- `src-tauri/icons/{icon.icns, icon.ico}`（macOS / Windows 平台格式）
- `public/favicon.png`（64×64，web favicon）

原项目 icon 设计：灯塔（深蓝色塔身 + 红色塔顶 + 黄色光束）+ PDF 文档堆叠（米色背景 + 海军蓝边线文字页），app-icon 风格圆角。**比自创版本更具「PDF 工具 + 灯塔指引」双语义**，且与 `src-tauri/` 平台图标 / Folia 视觉风格完全一致。

**结论**：删自创 `docs/icon.svg`，从 `src-tauri/icons/icon-source.png` 衍生：

- `docs/icon-128.png`（128×128，18KB，README inline 用）
- `docs/icon.png`（512×512，261KB，retina / 应用图标母版）

**README 引用**（保持不变）：`<p align="center"><img src="docs/icon-128.png" alt="FaroPDF" width="128" height="128"></p>`。

教训：项目视觉资产优先用 `src-tauri/icons/icon-source.png` 作为单一真相源，README / 文档 / 营销材料从同一 source 衍生；不重画避免视觉分裂。后续 ISS-028 个人主页的 icon 也从此 source 衍生。

文件输出（`rsvg-convert -w N -h N docs/icon.svg -o docs/icon-NN.png`）：

- `docs/icon.svg`（2.1KB，源文件，README inline 用 `<img src="docs/icon.svg">` 也可直接渲染）
- `docs/icon.png`（512×512，33KB，retina / 应用图标母版）
- `docs/icon-128.png`（128×128，5.6KB，README inline 显式引用，与 Folia 尺寸对齐）

README 顶部加 `<p align="center"><img src="docs/icon-128.png" alt="FaroPDF" width="128" height="128"></p>`。

#### 2.4 范围

- **新增**：`LICENSE`（191 行）+ `docs/icon.svg` + `docs/icon.png` + `docs/icon-128.png`（4 文件）
- **修改**：`package.json`（author.name 改 1 行）+ `README.md`（顶部加 img 标签 + §许可 重写 TODO 为实际协议引用）
- **不修改**：`src/**` / `src-tauri/**` / 锁文件 / `config/**`（DEC-053 已收口）/ 任何业务模块

### 3. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `diff -q` Folia LICENSE | ✅ 无差异 | 191 行标准 Apache-2.0 |
| PNG 像素 | ✅ | `sips -g pixelWidth -g pixelHeight` 512×512 / 128×128 |
| `npm run typecheck` / `lint` / `test` / `build` | ✅ 干净 | 无业务代码 / 配置变更，预期 0 回归 |
| README 引用 | ✅ | `<img src="docs/icon-128.png">` 不再 404 |

### 4. 后续路径

- 个人主页（`ISS-028`）：杨卫薪律师个人主页 + 展示 Folia / FaroPDF 两产品。本 DEC 不实现，仅在 `docs/TASKS.md` 登记任务卡。
- icon 后续优化（如单色 / 高对比度 / 多语言）按需开 worker；首版 release 前由 PM 决定是否生成 macOS `.icns` / Windows `.ico` / Linux `.desktop` 等平台特定图标。
- `package.json` author.email 暂留空（`author.name` 已有，email 留待作者本人补充）。

## DEC-055 ISS-008 FormsPanel 窄屏底部 sheet 适配

- 日期：2026-06-05
- 状态：已采纳
- 关联分支：`fix/iss-008-forms-narrow`
- 关联任务：ISS-008（窄屏适配收口，不触碰 layout worker 范围）
- 关联决策：DEC-035（ISS-008 第一版，浮层 `position: fixed; top: 72px; right: 16px` 路线）；DEC-049（ISS-009 PDF Expert Shell UI 收口，把 forms 改走 utility panel 路径在 `feat/pdf-expert-shell-ia` 收口时统一处理，本 DEC 是该收口前的前置修复）

承接 DEC-035 已知限制「FormsPanel 浮层在窄屏（< 360px）会与主工具栏重叠」，本决策记录 **不** 改 layout worker 范围内的 `AppShell / Toolbar / Sidebar`，在 forms 模块内部用 CSS 媒体查询 + React `matchMedia` 状态实现窄屏自适应，作为 ISS-009 utility panel 收口前的过渡修复。

### 1. 方案选择

| 方案 | 优点 | 缺点 | 评估 |
| --- | --- | --- | --- |
| **底部 sheet（采纳）** | 桌面浮层视觉保留，窄屏自然避开工具栏；CSS-only + React 状态；不改 layout；标准 PDF 阅读器移动端模式 | 仍占用视口下半部分 | ✅ 采纳 |
| 全屏 modal | 最大化填值 / 签名可用面积 | 遮罩整个阅读区，违背「PDF 页面始终是主视觉」原则 | 拒绝 |
| 侧抽屉（右滑入） | 类似 PDF Expert 移动端 | 改变交互模型，需新增 open / close 动画；与 desktop 浮层体验断层 | 拒绝 |
| 窄屏自动隐藏 | 改动最小 | 用户在窄屏下完全无法填表 | 拒绝 |
| 切到 utility panel 路径 | 终极方案 | 属 layout worker 范围（ISS-009 收口），与本次窄屏 worker 文件范围冲突 | 留 ISS-009 |

### 2. 实现细节

#### 2.1 断点常量（`src/modules/forms/breakpoints.ts` 新增）

- `FORMS_PANEL_NARLOW_BREAKPOINT = 480`（与 `AuthorCard` 480 对齐，避免在 AppShell 尚未统一收口断点前再制造新数值）。
- `formsPanelNarrowMediaQuery()` 返回 `"(max-width: 479px)"`，与 CSS `@media (max-width: 479px)` 保持一致。
- 通过 `src/modules/forms/index.ts` 导出，让 `FormsPanel` 组件和测试都能引用同一数值。

#### 2.2 组件状态（`src/modules/forms/ui/FormsPanel.tsx` 修改）

- 新增 `useState<boolean>(detectNarrowLayout)`，初始值由 `window.innerWidth < 480` 决定（避免 SSR / jsdom 默认 1024 时初始误判）。
- 新增 `useEffect` 监听 `matchMedia(formsPanelNarrowMediaQuery())` 的 `change` 事件，实时同步 `isNarrow` 状态（不监听 `resize`，避免每像素 re-render）。
- 新增 `FormsPanelLayout = "floating" | "bottom-sheet"` 字面量联合，渲染时输出 `<aside data-layout={layout}>`。
- **不**修改组件 props、controller 接口或任何外部 API 形状；现有 16 项单测全部无需改动。

#### 2.3 样式（`src/modules/forms/ui/FormsPanel.css` 新增）

- 新增 `@media (max-width: 479px) { .forms-panel { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: 70vh; border-radius: 12px 12px 0 0; padding: 14px 12px 16px; box-shadow: 0 -10px 28px rgb(24 32 38 / 18%); } }`。
- 同步新增 `.forms-panel[data-layout="bottom-sheet"]` 选择器：原因：jsdom 不实现真视口 + CSS 媒体查询不会响应，但 React `data-layout` 属性会按状态切换；测试覆盖两种环境（真视口 / jsdom）时都能用 `data-layout` 断言，CSS 在真视口被 `data-layout` 强制覆盖避免冲突。
- 桌面端（>= 480px）保留原 `top: 72px; right: 16px; width: min(340px, calc(100vw - 32px))`，不影响现有桌面用户体验。

#### 2.4 测试覆盖（`src/modules/forms/ui/FormsPanel.test.tsx` 新增 6 项）

- 断点常量对齐测试：`FORMS_PANEL_NARROW_BREAKPOINT === 480` + `formsPanelNarrowMediaQuery() === "(max-width: 479px)"`。
- 桌面视口（>= 480px）默认 `data-layout="floating"`。
- 360px 视口（典型手机竖屏）切换为 `data-layout="bottom-sheet"`。
- 窗口缩放跨过 480px 断点时 `data-layout` 在 `matchMedia.change` 后切换（双向验证）。
- 480px 边界（>= 480 视为桌面）保持 `floating`。
- 窄屏布局下字段列表 + 填值编辑器内容仍可正常渲染（不破坏已有功能）。
- 自定义 `createMatchMediaMock(initialMatches)` helper：模拟 jsdom 默认 `matchMedia` stub，提供 `setMatches(true|false)` 同步触发已注册 listener，匹配 React 真实订阅语义。

### 3. 范围严格遵守

- **修改**：`src/modules/forms/breakpoints.ts`（新增，22 行）+ `src/modules/forms/ui/FormsPanel.tsx`（+19 行：状态 + effect + 文档说明）+ `src/modules/forms/ui/FormsPanel.css`（+20 行：媒体查询 + 属性选择器）+ `src/modules/forms/ui/FormsPanel.test.tsx`（+99 行：6 项新测试 + 1 个 mock helper + 1 个新 describe block）+ `src/modules/forms/index.ts`（+3 行：导出断点常量）。
- **不修改**：`src/components/layout/{AppShell,Toolbar,Sidebar}.tsx`（layout worker 范围，避免与 `feat/pdf-expert-shell-ia` 共享冲突）/ `src-tauri/**`（Tauri 范围）/ `config/**`（DEC-053 已收口）/ `package.json` scripts（DEC-053 已加 `--config`）/ 锁文件 / `docs/ROADMAP.md`（PM 决定）/ 任何 reader / search / annotation / ocr / export / pages / preprocess 模块。
- **不引入新依赖**，CSS-only + React 原生 `matchMedia`，与 `SettingsPanel` 的 `NARROW_BREAKPOINT` 模式一致但定位为 forms 模块内私有，避免在 AppShell 统一断点收口前再制造跨模块耦合。

### 4. 验证结果

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `npm test -- --run src/modules/forms/ui/FormsPanel.test.tsx` | ✅ 22 / 22 | 16 旧 + 6 新 |
| `npm test`（全套） | ✅ 738 / 738 | worktree 中 `src/App.test.tsx` + `src/modules/reader/pdfReaderService.test.ts` 2 个 suite 因 vite `fs.allow` 拒绝访问 worktree 外部 `node_modules` 失败（pre-existing，0 tests reported；与本 PR 无关；非 worktree 场景通过） |
| `npm run typecheck` | ✅ 干净 | 无新增 TS 错误 |
| `npm run lint` | ✅ 干净 | 本 PR 文件 0 错误；全局 43 个 pre-existing 错误（与 main 基线一致：fontLoader 4 处 + `tests/e2e/ocr-e2e.test.ts` parserOptions.project 找不到 + tests/fixtures/ocr/generate-scan-fixture.mjs `Buffer`/`process` 4 处；与本 PR 无关，遵守「pre-existing 不试图修复」） |
| `npm run build` | ✅ 成功 | 2022 modules 产物正常 |

### 5. 已知限制

- 当前窄屏样式不包含「拖动把手 / 关闭手势」，按底部 sheet 固定 70vh 设计；后续如需拖拽调节可由 layout worker 二次扩展。
- 切到 utility panel 路径仍是 ISS-009 终极目标，本 DEC 是过渡方案；layout worker 收口时可一次性删掉底部 sheet 媒体查询并把 forms 改走 utility panel。
- 真视口验证需在 Chromium DevTools device toolbar 切换 360 / 480 / 768 / 1024 四档；jsdom 不实现真视口，单测用 `data-layout` 属性 + `matchMedia` mock 验证状态切换。
- 断点 480 与 `AuthorCard` 对齐，是 forms 模块内临时值；后续 AppShell 收口断点时可统一为 `BREAKPOINTS.narrow` 共享常量。

## DEC-056 ISS-021 follow-up：autoUpdateCheck 设置项 + About toggle

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：ISS-021（第二版）
- 关联分支：`feat/iss-021-auto-update-check`
- 关联 PR：TBD
- DEC 编号承接 DEC-054（LICENSE + author.name + icon）后 +2（055 暂未使用，与历史跳号策略保持一致）

承接 DEC-048 §2.2「推迟 autoUpdateCheck 设置项」+ DEC-051 §2.4「ISS-023 不实现 autoUpdateCheck」+ `docs/RELEASE.md` §4「自动检查更新未实现」+ `docs/TASKS.md` ISS-021 验收「M2-2」。本决策记录 ISS-021 follow-up 第二版：`AppSettings.autoUpdateCheck` 设置项 + About section 顶部 toggle UI + 挂载时按值决定是否自动调 `checkForAppUpdate`。

### 1. 触发原因

DEC-048 第一版（PR #31 / commit 652a53a）刻意把 `autoUpdateCheck` 留 follow-up（实现需要改 `src/shared/settings/types.ts` 的 `AppSettings`，与 ISS-021 当期的 forbidden list 冲突）。DEC-051（ISS-023）也明确「autoUpdateCheck 留 follow-up，由 PM 在后续 `feat/auto-update-check` 拆出」。本 PR 收口这一 follow-up。

### 2. 关键决策

#### 2.1 直接扩展 `AppSettings`（vs 新建 `updateSettings.ts`）

直接在 `src/shared/settings/types.ts` 加 `autoUpdateCheck: boolean` 字段，**不**新建独立 `updateSettings.ts` 模块。

- 优：复用现有 `SettingsService` 持久化路径（`write_app_settings` / `read_app_settings` Tauri command 已就位），不需要新 Tauri command / 新 storage slot；`normalizeAppSettings` 兜底旧 release payload（缺字段 → 默认 `true`）；`exportSafeAppSettings` 透传无需改。
- 劣：把 update 概念「污染」到通用 `AppSettings` 字段表，类型层面缺命名空间；后续若 settings 增长可拆出子结构。
- 选择依据：当前 settings 字段少（5 个一级字段），拆子结构 over-engineering；extension 是 DEC-053 收束 `config/` 之后最稳的演进路径。

#### 2.2 mount 触发 vs App 启动触发

auto-check 触发点选 **About section 首次 mount**（用户首次打开设置 → 关于），**不**改 `App.tsx` / `AppShell.tsx` 启动时刻。

- 优：完全在 allowed files 范围内（`src/shared/settings/` + `src/modules/settings/sections/AboutSection.tsx` + `src/modules/settings/sections/AboutSection.test.tsx`），不触碰 layout worker 的 `App.tsx` / `AppShell.tsx` / `Toolbar.tsx` / `Sidebar.tsx`。
- 劣：用户不打开设置 → 不自动检查；与「App 启动时自动检查」的产品直觉略有差距。
- 选择依据：本 follow-up scope 严格不越界（mission: forbidden 列表明列 `src/components/layout/{AppShell,Toolbar,Sidebar}.tsx`；`App.tsx` 不在 allowed 列表中，pessimistic interpretation 也避免触碰）。未来「App 启动时自动检查」如确有必要，拆独立 PR 由 layout worker 接手。

#### 2.3 ref guard 防 strict mode 双调用 + 切到 true 不会重复触发

```tsx
const autoCheckTriggeredRef = useRef(false);
useEffect(() => {
  if (autoCheckTriggeredRef.current) return;
  autoCheckTriggeredRef.current = true;
  if (settings.autoUpdateCheck) {
    void handleCheckUpdate();
  }
}, []);  // mount-only
```

- React 18+ strict mode 在开发环境会双调用 effect 挂载函数 → 不带 guard 会触发两次 `checkForAppUpdate`。
- 用 `useRef(false)` 同步 guard 防止双调用，且**不**在 `settings.autoUpdateCheck` 变化时重新触发（避免运行期切到 true 时弹出意外的检查请求）。
- 用户运行期切到 true → 必须手动点「检查更新」按钮才检查，符合「mount 时自动检查 / 手动按钮始终可用」契约。

#### 2.4 切换实时持久化（无 debounce）

切换 toggle → `onChange({ ...settings, autoUpdateCheck: next })` → SettingsPanel → App.tsx `setSettings`。

- **未**加 debounce 500ms：当前 `App.tsx` 的 `handleSettingsChange` 是同步 in-memory（详见 DEC-053 / DEC-038 留的 `// 后续接入 SettingsService 做持久化与校验失败回滚` TODO 注释），无真实磁盘写盘；debounce 是 future PR 接入 `SettingsService.updateSettings` 时的 hardening 点，本期不预做。
- 校验：`AppSettings` 的 `validateAppSettings` 不校验 `autoUpdateCheck`（boolean 字段，类型层兜底）；写入路径无需 sanitization。

#### 2.5 手动按钮始终可用，不与 toggle 联动

`checkButtonDisabled = isWorking || status === "checking" || status === "downloading"`，**不**叠加 `!settings.autoUpdateCheck`。

- 关 toggle 的用户能继续手动触发；与「关闭时：自动检查跳过，手动检查仍可用」契约一致。

#### 2.6 9 态状态机零改动

`AppUpdateStatus` 9 态（idle / checking / latest / available / downloading / downloaded / installing / unsupported / error）由 DEC-048 落定，本 PR 不动 `src/shared/update/*`。Available → 下载并安装 → 重启提示的流程在 toggle off / on / mount auto-check / manual click 四种入口下行为一致（实测由 6 个 manual-check 测试在 `autoUpdateCheck=false` 下回归 9 态）。

### 3. 文件清单

#### 修改

- `src/shared/settings/types.ts`（+9 行）：`AppSettings` 增 `autoUpdateCheck: boolean` 字段 + 注释（ISS-021 follow-up / DEC-056 引用）。
- `src/shared/settings/defaults.ts`（+2 行）：`createDefaultAppSettings` 增 `autoUpdateCheck: true`；`normalizeAppSettings` 增 boolean 类型 guard（`typeof input.autoUpdateCheck === "boolean" ? input.autoUpdateCheck : defaults.autoUpdateCheck`）。
- `src/modules/settings/sections/AboutSection.tsx`（+38 / -6 行）：去掉 `_settings` / `_onChange` 的 void 忽略（现在实际消费 settings 与 onChange）；新增 `useEffect` mount 一次性 auto-check（ref guard）+ `handleAutoUpdateToggle` 切换回调；新增 `<label>` 包裹 checkbox + label + hint 的 toggle UI（data-testid `about-auto-update-toggle`，`htmlFor="auto-update-check"`）。
- `src/modules/settings/sections/AboutSection.test.tsx`（+92 行）：6 个 manual-check 测试改 `autoUpdateCheck: false`（避免 mount auto-check 干扰 call-count 断言）；新增 6 项测试（toggle 默认值 / toggle off 持久化 / toggle on 持久化 / mount 时 auto-check 触发 / mount 时 auto-check 不触发在 `false` 下 / 关闭时手动按钮仍可用）。
- `src/shared/settings/defaults.test.ts`（+1 行）：`createDefaultAppSettings` 断言补 `autoUpdateCheck === true`。
- `src/shared/settings/service.test.ts`（+22 行）：新增 2 项（`autoUpdateCheck: false` 持久化不覆盖 / 旧 payload 缺字段退回默认 `true`）。
- `src/shared/contracts.test.ts`（+1 行）：`AppSettings` 字面量补 `autoUpdateCheck: true`（typecheck 通过）。
- `src/modules/settings/SettingsPanel.css`（+18 行）：`.settings-about-card__auto-toggle` / `__auto-toggle-hint` 样式（与既有 `.settings-row` 协同；`@media (max-width: 479px)` 由 `.settings-row` 现有规则覆盖，无需新增）。
- `docs/RELEASE.md` §4：把「自动检查更新未实现」从限制列表移到「✅ DEC-056 落地」说明。
- `docs/TASKS.md` ISS-021 任务卡：状态从「第一版已交付」推到「第二版已交付」+ 验收「autoUpdateCheck 设置项可关闭自动检查」改为 ✅ M2 + 进度日志追加 2026-06-05 记录。
- `CHANGELOG.md` 顶部新增 0.1.0-alpha.15 段。

#### 不修改（严格遵守 forbidden / 范围外）

- `src/shared/update/*`（DEC-048 9 态状态机保留原样）
- `src/components/layout/*`（layout worker 范围）
- `src/App.tsx`（不在 allowed 列表）
- `src/styles/app.css` / `package.json` / 锁文件 / `src-tauri/**` / `config/**`（DEC-053 收口）
- 任何 reader / search / annotation / forms / export / pages / ocr / preprocess 模块

### 4. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `npm run typecheck` | ✅ 干净 | `AppSettings` 新增必填字段；`contracts.test.ts` 同步补字段 |
| `npm run lint` | ✅ 43 个错误 | 与 main 基线一致，0 回归（pre-existing：无 project ESLint config / `.at` lib target / 等） |
| `npm test` | ✅ 80 文件 / 751 用例 | +8（AboutSection 6 + SettingsService 2）；6 个 manual-check 测试改 `autoUpdateCheck=false` 隔离 mount auto-check |
| `npm run build` | ✅ 2022 modules | Vite 成功产出 dist 资产 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ 干净 | 9 个 pre-existing dead_code warning 与本 PR 无关 |

### 5. 已知限制（同步 docs/RELEASE.md §4 + docs/TASKS.md ISS-021）

- **auto-check 触发点是 About section mount** 而非 App 启动时刻（详见 §2.2）。
- **debounce 500ms 未实现**（详见 §2.4）：App.tsx 当前是 in-memory 持久化，SettingsService 真正落盘由 future PR 接入时再按需加。
- **回归 9 态状态机**：6 个 manual-check 测试在 `autoUpdateCheck=false` 下独立验证，确保 DEC-048 9 态行为零改动。
- 增量更新失败回退 / 移动端 / CODE_SIGNING 仍 follow-up（继承 DEC-048 §5）。

### 6. 后续路径

- 未来如需「App 启动时自动检查」（不等用户打开设置）：由 layout worker 拆独立 PR，在 `App.tsx` 加 startup useEffect，按 `settings.autoUpdateCheck` 决定是否调 `createTauriUpdateClient().checkForAppUpdate()`；需同步讨论默认 `createTauriUpdateClient()` 与 `AboutSection` 共享的 client 实例（避免双 `checkForAppUpdate` 调用）。
- 真实生产 pubkey 替换、增量更新回退、移动端打包、CODE_SIGNING 仍按 DEC-048 §6 路径推进。

## DEC-057 ISS-026 批注 Overlay ↔ Sidebar active 联动（activeAnnotationId 双向同步）

> **DEC 编号说明**：本决策最初由 worker 在 PR #43 commit message 中编为 `DEC-058`（沿用项目历史跳号策略），但 doc-curator post-merge 体检报 hard 失败（编号不连续），由 PM 在 docs-only 维护 commit 中将后续所有引用统一为 `DEC-057` 以恢复编号连续性。DEC-058 这个编号在历史上未使用过；commit message 本身保留 `DEC-058` 字样以反映实际 commit 内容，但本决策条目以 `DEC-057` 为正式编号。

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：ISS-026
- 关联分支：`feat/iss-026-overlay-sidebar-active-sync`
- 关联 PR：TBD
- DEC 编号承接 DEC-056 后 +2（057 暂未使用，与历史跳号策略保持一致）

承接 ISS-026 stage 4 收口（DEC-044/045/046/047）中标注的「`AnnotationOverlay` 与 `AnnotationSidebar` 的 active 联动仍未接（`onAnnotationClick` prop 已留好，等下一阶段统一接线）」。本决策记录 batch 注的 5 阶段 active 联动方案：在 `AppShell` 持有单一 `activeAnnotationId` state，透传给 `AnnotationOverlay` 与 `AnnotationSidebar` 实现双向同步。

### 1. 触发原因

DEC-044 §3.2 §3.3 阶段交付里，`AnnotationOverlay` 接收了 `activeAnnotationId?: string | null` 与 `onAnnotationClick?: (annotationId: string) => void` props，`AnnotationSidebar` 同样有 `activeAnnotationId` 与 `onAnnotationClick` props（DEC-037 stage 2 收口），但 `AppShell` 在 stage 4 milestone 2（DEC-046）里只把 `onAnnotationClick` prop 透传，没真正连接。`AnnotationOverlay` 的 `activeAnnotationId={null}` 被硬编码，`AnnotationSidebar` 在 `UtilityPanel` 分支里完全不传 `onAnnotationClick` / `activeAnnotationId`。结果是用户点 overlay 上的某个高亮，sidebar 不会高亮；点 sidebar 行也不会把 overlay 上的对应 glyph 标记为 active——产品体验与 §1 设计预期「点击批注跳转」脱节。

### 2. 关键决策

#### 2.1 状态归属：AppShell 持有 `activeAnnotationId`

`activeAnnotationId: string | null` state 放在 `AppShell`，**不**上提到 `App.tsx`，**不**建 `AnnotationContext` / module-level bridge。

- 优：AppShell 已经是 overlay 与 sidebar 的共同父节点，prop drilling 距离为 0；`App.tsx` 大部分属于 layout worker 的不主动改区域，本期不迫不得已不挪；`AnnotationContext` 会让 mode/panel 切换时的清理逻辑分到多个文件。
- 劣：`App.tsx` 不感知 active 状态；后续如需「跨 tab/跨窗口同步」需要重新评估。
- 选择依据：ISS-026 active 联动只与 annotate mode 的工作区局部相关（读者点 → 同步渲染），不需要 App 顶层管控；与既有 `annotationArmed` bundle（DEC-044）形成的「Overlay + Toolbar 共享 state，AppShell 桥」模式保持一致。

#### 2.2 双向同步机制：单一 state + onAnnotationClick setter

```tsx
const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
// Overlay:
<AnnotationOverlay
  activeAnnotationId={activeAnnotationId}
  onAnnotationClick={(id) => {
    setActiveAnnotationId(id);
    onAnnotationClick?.(id);  // 保留 AppShellProps 透传出口（向上抛给 App.tsx 未来使用）
  }}
/>
// Sidebar（UtilityPanel 分支内）：
<AnnotationSidebar
  activeAnnotationId={activeAnnotationId}
  onAnnotationClick={setActiveAnnotationId}
/>
```

- 单一 setState 作为 setSource，AppShell 内仅一个 `useState<string | null>(null)`。
- Overlay 侧保留 `onAnnotationClick?.(id)` 向上传递到原 `AppShellProps.onAnnotationClick`：保留未来 App.tsx 接入「点击批注 → 弹详情面板」「点击批注 → 选中后跳到搜索」等扩展点；当前 App.tsx 未传 `onAnnotationClick`，所以向上调用是 no-op。
- Sidebar 侧直接传 `setActiveAnnotationId`：不重复包装，因 Sidebar 内部仅需 setState（不需额外「向上抛」场景）。

#### 2.3 mode 切换时清空（避免 stale 选中态）

```tsx
useEffect(() => {
  if (activeMode !== "annotate") {
    setActiveAnnotationId(null);
  }
}, [activeMode]);
```

- 用户点 overlay/sidebar 让某批注 active → 切到 read 模式 → 切回 annotate 模式，active 状态应为空（而不是保留一个不可见的 selection）。
- 用 `useEffect` 在 `activeMode` 变化时检测，**不**在 mode setter 里 setState（保留 mode setter 幂等性）。
- 隐式用例：用户切到 ocr / forms / export 模式时 overlay 不渲染（`isAnnotateMode && hasDocument` 条件），切回 annotate 后 overlay 才出现，active 状态已在切换间清空。

#### 2.4 armed toolType 下的点击保护

`AnnotationOverlay.handleAnnotationClick` 已有保护：

```ts
function handleAnnotationClick(annotationId: string) {
  if (interaction) {
    return;
  }
  onAnnotationClick?.(annotationId);
}
```

- `interaction` 从 `activeToolType` 派生（`ANNOTATION_TOOL_INTERACTION[activeToolType]`）。当用户已 arm 工具（`activeToolType !== null`）时，overlay 的 click 事件被 suppression，避免「点选已有高亮」与「拖拽绘制新批注」冲突。
- 本期保留该行为：**不**在 `AppShell` 重复判断 armed 状态。新增测试（`activeToolType 已 armed → 点击 Overlay 不触发 active 同步`）保证该保护仍在位。

#### 2.5 范围与依赖

- 修改 `src/components/layout/AppShell.tsx`：`useState<string | null>` + `useEffect` cleanup + `<AnnotationOverlay>` 透传 `activeAnnotationId` / `onAnnotationClick` + `<AnnotationSidebar>` 透传 `activeAnnotationId` / `onAnnotationClick`（在 `UtilityPanel` 函数内）。
- 修改 `src/components/layout/AppShell.test.tsx`：新增 4 项单测（sidebar→overlay / overlay→sidebar / armed 阻止 / mode 切换清空）。
- **不修改** `src/components/layout/AnnotationOverlay.tsx`（onAnnotationClick / activeAnnotationId prop 形态 DEC-044 已就位，stage 4 milestone 2 已落硬编码 `null`）。
- **不修改** `src/components/layout/AnnotationSidebar.tsx`（DEC-037 stage 2 已收口，props 形态完备）。
- **不修改** `src/components/layout/types.ts`（`AnnotationOverlayAnchor` / `AnnotationArmedStateBundle` / `AnnotationDraftSubmission` 已就位，本期不引入新类型）。
- **不修改** `src/modules/annotation/AnnotationService.ts`（业务逻辑零改动，service API 形态保持）。
- **不修改** `src/App.tsx`（保留 forbidden，不上提 state）。

### 3. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `npm run typecheck` | ✅ 干净 | `useState<string \| null>` + `useEffect` 在 AppShell 中可行，UtilityPanel 签名扩展 activeAnnotationId/onAnnotationClick |
| `npm run lint` | ✅ 43 个错误 | 与 main 基线一致，0 回归（pre-existing：fontLoader + ocr-e2e.test.ts + generate-scan-fixture.mjs） |
| `npm test` | ✅ 80 文件 / 761 用例 | +4（AppShell 4 项 active 联动测试：sidebar→overlay / overlay→sidebar / armed 阻止 / mode 切换清空） |
| `npm run build` | ✅ 2022 modules | Vite 成功产出 dist 资产 |
| `cargo check --offline` | ✅ 干净 | 9 个 pre-existing dead_code warning 与本 PR 无关 |

### 4. 已知限制

- **armed tool 阻止 active 同步**：用户在 annotate mode arm 了 highlight / underline / 矩形 / 箭头 / 手写工具时，点 overlay 上的已有批注不会触发 active 同步；这是 DEC-044 阶段既有的设计，保留以避免「点选 vs 绘制」二义性。如未来要「shift+click 强制 active」语义，扩 `AnnotationOverlay.handleAnnotationClick` 即可，AppShell 状态机无需变。
- **App.tsx 未参与**：`onAnnotationClick` prop 透传出口已留（`onAnnotationClick?.(id)` 保留），但 App.tsx 当前未传 `onAnnotationClick`，向上调用是 no-op。后续如需「点击批注 → 弹详情面板 / 跳到搜索」，由独立 worker 在 App.tsx 注入 `onAnnotationClick={(id) => showAnnotationDetail(id)}`。
- **跨模式清空**：`useEffect` 只在切出 annotate 时清空；如果未来引入「跨 mode 保留 active 选中（如 read mode 也展示 active 批注）」需求，需重新评估 useEffect 逻辑。
- **不处理同一 pageIndex 上多个批注 id 冲突**：active 状态精确到 annotation.id，由 `Overlay.handleAnnotationClick` 派发，无歧义。

### 5. 后续路径

- 后续「点击批注 → 弹详情面板」（如有）由 App.tsx 注入 `onAnnotationClick` 即可，不需重写本联动。
- 后续「批注 active 高亮几何样式」（如 overlay glyph 加 halo、sidebar row 加左侧色条）由独立 UI worker 收口，本期保留既有 `is-active` class + `aria-current="true"` 契约。
- ISS-026 余下 milestone（导出工具条「压平批注」按钮 UI 入口、批注 4 milestone 视觉验收）继续按 `docs/TASKS.md` 推进，不受本 PR 影响。

## DEC-058 官网 / 文档站入口迁出到 personal-site 仓（跨仓 cleanup）

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：personal-site `ISS-005` 跨仓 cleanup（Folia 仓 PR-A / FaroPDF 仓 PR-B 联动）
- 关联分支：`chore/iss-005-faropdf-cleanup`
- 关联 PR：TBD
- DEC 编号承接 DEC-057 后 +1

承接 personal-site `ISS-005` 跨仓 cleanup 任务卡中"FaroPDF 仓 docs-only 同步"段落：Folio 仓已删除 `website/` 子目录、`scripts/run-website.mjs` 转发脚本和 GitHub Pages workflow（PR #30 已合并，Folio DEC-073 记录），FaroPDF 仓本期同步把官网 / 文档站入口从 v0.1 阶段的"待发布占位"切换为指向 `cat-xierluo/personal-site` 仓统一维护的 `https://cat-xierluo.github.io/personal-site/faropdf/`。

### 1. 触发原因

FaroPDF 仓 README §"官方仓库" 当前官网占位为：

> 官网：待发布（v0.1 阶段尚未搭建独立官网页面）

而 personal-site 仓 Phase 3（任务卡 #13）已经把 FaroPDF 详情页重写为全结构并通过 GitHub Actions 自动部署到 `https://cat-xierluo.github.io/personal-site/faropdf/`。两仓独立维护"官网"会引入 3 个问题：

1. **入口漂移**：README 写"待发布"，用户在 GitHub 仓库首页看不到实际可用官网链接；同样的产品在 Folia 仓 README 指向 `personal-site/folia`，FaroPDF 仓却指向占位。
2. **更新责任错位**：Folio 仓已用 `personal-site` 仓作为唯一官网来源；FaroPDF 仓若未来在仓内新增 `website/` 子目录，会与 personal-site 仓的 FaroPDF 详情页内容分叉、重复维护。
3. **CHANGELOG / ROADMAP 命名口径不齐**：Folio 仓 ROADMAP 已在 v0.3 行写"官网（迁出 personal-site）"；FaroPDF 仓 ROADMAP 仍写"官网文档"语义，不体现仓库间职责切分。

Folio 仓侧 PR-A 已在 `docs/DECISIONS.md` DEC-073 收口 cleanup 决策；FaroPDF 仓侧 PR-B 通过本决策同步收口 docs-only 改动。

### 2. 关键决策

#### 2.1 README 官网占位改为 personal-site 链接

`README.md` §"官方仓库" line 15 由：

```markdown
- 官网：待发布（v0.1 阶段尚未搭建独立官网页面）
```

改为：

```markdown
- 官网：https://cat-xierluo.github.io/personal-site/faropdf/
```

- 与 Folia 仓 README §"官方网站" 链接（已指向 `https://cat-xierluo.github.io/personal-site/folia/`）形成一致口径。
- 后续如 personal-site 仓调整部署 URL，README 一行可改；不引入 `website/` 子目录或仓内 GitHub Pages workflow。

#### 2.2 ROADMAP v0.3 行补充「迁出 personal-site」

`docs/ROADMAP.md` §"v0.3 性能与发布" 行的描述从「大卷宗性能、自动更新、跨平台打包、官网文档」调整为「大卷宗性能、自动更新、跨平台打包、官网与文档站（迁出 personal-site）」；§"9. 全平台发布与设置 UI" 末尾"官网与文档站"任务项由 `- [ ]` 标记为 `- [x]`，并加注释指向 personal-site 仓。

- 口径与 Folia 仓 ROADMAP 一致：仓库路线图显式声明"官网入口由 personal-site 仓统一维护"。
- v0.3 阶段不再为 FaroPDF 仓新建 `website/` 子目录；官网 / 文档站所有变更都走 personal-site 仓 `src/pages/faropdf.astro` 路由。

#### 2.3 ISS-023 官网字段保持指向 personal-site

`docs/ROADMAP.md` §"9. ISS-023 关于页面与作者页" 任务描述补充「官网（指向 personal-site 仓）」，让 v0.3 设置页"关于"section 的官网字段（DEC-051 ISS-023 阶段已落盘）有明确的链接依据。

- 不修改 `src/` 或 `src-tauri/`：ISS-023 实际 UI 接入是 v0.3 worker 工作，本期只声明链接来源。
- `AboutSection` 中 `官网：{url}` 文案将由 v0.3 阶段 worker 用本决策固定的 `https://cat-xierluo.github.io/personal-site/faropdf/` 字符串直接渲染。

#### 2.4 范围与依赖

- 修改 `README.md`（line 15 单行替换）。
- 修改 `docs/ROADMAP.md`（§"阶段状态速览" v0.3 行 / §"9. 全平台发布与设置 UI" ISS-023 行 + 官网与文档站条目 / §"进度日志" 追加 2026-06-05 记录）。
- 修改 `CHANGELOG.md`（顶部新增 Unreleased 段记录 docs-only 同步）。
- 修改 `docs/TASKS.md` §"归档任务索引" 增「跨仓协调」领域并把 personal-site `ISS-005` 列入。
- 追加 `docs/DECISIONS.md` 本条目（DEC-058）。
- **不修改** `src/` / `src-tauri/` / `package.json` / 锁文件 / `config/**` / `docs/ARCHITECTURE.md` / `docs/DESIGN.md` / `docs/RELEASE.md` / `.github/workflows/**`。
- **不新增** `website/` 子目录、`scripts/run-website.mjs` 或 `deploy-website.yml`（Folio 仓侧 PR-A 已删，FaroPDF 仓侧 PR-B 也明确不引入）。

#### 2.5 与 Folia 仓 PR-A 的口径一致性

| 项 | Folia 仓 PR-A（Folio DEC-073） | FaroPDF 仓 PR-B（本决策 DEC-058） |
| --- | --- | --- |
| 仓内 `website/` 目录 | 删除 | 不引入（自始不存在） |
| 仓内 `scripts/run-website.mjs` | 删除 | 不引入 |
| `deploy-website.yml` workflow | 删除 | 不引入 |
| `package.json` website scripts | 删除 3 个 | 无（自始不存在） |
| `README.md` 官网链接 | 改为 `personal-site/folia/` | 改为 `personal-site/faropdf/` |
| `docs/ARCHITECTURE.md` 引用 | 改为引用 personal-site 仓 | 不改（FaroPDF 仓架构文档无官网段落） |
| `CHANGELOG.md` 记录 | Unreleased 段已落 | Unreleased 段同步落 |
| `docs/ROADMAP.md` v0.3 口径 | 已写"迁出 personal-site" | 本期补齐同口径 |

### 3. 验证

| 验证项 | 结果 | 备注 |
| --- | --- | --- |
| `git diff main...HEAD -- README.md docs/ROADMAP.md docs/DECISIONS.md docs/TASKS.md CHANGELOG.md` | ✅ 仅 docs | 无 `src/` / `src-tauri/` / `package.json` / 锁文件 / workflow 改动 |
| `grep -R "website" README.md docs/ROADMAP.md` | ✅ 仅保留"v0.3 官网与文档站入口迁移"小节 | 仓内不引入 `website/` 子目录或脚本 |
| `grep "官网：待发布" README.md` | ✅ 不再命中 | 官网占位已替换为 personal-site 链接（`下载与安装` section 的 release `待发布` 占位另说） |
| `grep "personal-site" README.md docs/ROADMAP.md CHANGELOG.md` | ✅ 命中 | 链接 / 跨仓引用一致 |
| `npm run typecheck` / `npm run lint` / `npm test` | ✅ 不变 | docs-only 改动，0 回归 |
| `gh pr diff` | ✅ 仅 docs | 跨模块污染检查通过 |

### 4. 已知限制

- **不修改 `AboutSection` 实际渲染**：本期不修改 `src/modules/settings/sections/AboutSection.tsx`；ISS-023 实际落地由 v0.3 worker 在 `AboutSection` 渲染 `官网：https://cat-xierluo.github.io/personal-site/faropdf/` 链接，本决策仅声明链接来源。
- **personal-site 仓的 FaroPDF 详情页内容仍由 personal-site 仓独立推进**：本决策只把"入口指向"从占位替换为真实链接；详情页的内容更新（功能、截图、版本号同步）走 personal-site 仓 `src/pages/faropdf.astro`。
- **CHANGELOG Unreleased 段可能存在多个 commit 同步叠加**：FaroPDF 仓 v0.1 阶段 CHANGELOG 由 release worker 维护；本决策 Unreleased 段先以"跨仓 cleanup"分类记录本次改动，release 时由 release worker 合并。
- **`docs/ROADMAP.md` v0.3 行追加"迁出 personal-site"措辞**：本决策选择直接改 ROADMAP v0.3 状态行，避免在 §"9. 全平台发布与设置 UI" 之外另起小节。

### 5. 后续路径

- 后续 personal-site 仓调整 FaroPDF 详情页 URL / 路径时，本仓 README 一行可改；不引入仓内 build / deploy 脚本。
- ISS-023 v0.3 worker 在 `AboutSection` 落地"官网"链接时，直接复用本决策固定的 `https://cat-xierluo.github.io/personal-site/faropdf/`。
- personal-site 仓 ISS-006（中英文切换）/ ISS-007（微信二维码）/ ISS-008（自定义域）的官网 / 文档站更新都走 personal-site 仓；FaroPDF 仓 README 链接在 personal-site 部署 URL 变更时由 docs-only 维护 commit 同步。
- 跨仓 cleanup 的"占位 → personal-site"切分完成后，FaroPDF 仓和 Folia 仓对官网维护职责归零：两仓 README / ROADMAP 都不再预留 `website/` 子目录入口。

## DEC-060 Sentinel 状态机 synonym 缺口（Wave 6 实战发现）

- 日期：2026-06-05
- 状态：已采纳
- 关联任务：Task #9 Sentinel bash 模式（Wave 6 首次真用）
- 关联 PR：随 Wave 6 收口落地（sentinel.sh + worker-prompt.md 双侧 patch）
- 关联分支：直接落地到 `main`（PM 主工作区 docs + 编排层修复，无功能侧 diff）

### 1. 背景

2026-06-05 Wave 6 首次用 sentinel bash 模式跑 2 个 worker（W1 ISS-022 lazy load / W2 ISS-007 keychain），两个 worker 都在 30 分钟内写出 `STATUS.json` 终态，但 PM 始终没收到 harness task-notification。最后是用户手动问"进度有变化吗"才触发了 PM 巡检，发现两个 sentinel 都在空转。

### 2. 根因

Sentinel 状态机的 `case` 分支只识别四个终态字符串：

```bash
case "$status" in
  done)                                exit 0
    ;;
  failed|blocked|stopped)              exit 2
    ;;
  running|unknown|"")
    :                                  # not terminal, keep polling
    ;;
  *)                                   # ← 落这里
    log "SENTINEL_UNKNOWN_STATUS: ..." # 只 log，不退出
    ;;
esac
```

两位 worker 实际写的 status 是：
- W1（glm-5.1）：`status="completed"`
- W2（glm-5.1）：`status="finished"`

`completed` / `finished` 不在 case 分支的合法集合里，掉进 `*)` 只打一行 `SENTINEL_UNKNOWN_STATUS` 之后继续轮询。worker 已死，sentinel 不死，会一路 poll 到 `--max-wait 7200s` 才会 timeout（exit 124）—— 期间 PM 永远不会被 task-notification 唤醒，事件驱动链路断了。

### 3. 假设 vs 实际

| 层 | 假设 | 实际 |
| --- | --- | --- |
| `templates/checkpoint-result.md` | 终态首行 `## Status\ndone` | 工人没读这个模板，或读了之后用 synonym 表达 |
| `templates/worker-prompt.md` Process §1 | 隐含 `status=done` 终态 | 没显式约束，glm-5.1 worker 用 `completed` / `finished` |
| `scripts/sentinel.sh` case | 只认 4 个终态字符串 | synonym 集合 `completed\|finished\|complete` / `aborted\|cancelled` 漏掉 |

2026-06-05 spike 阶段只用了 3 阶段手工状态机（`done` / `failed` 严格用法），没机会暴露 LLM 实际写 synonym 的漂移。这次是 Wave 6 首次真用，2 个 worker 都触发了 synonym 漂移。

### 4. 修复

#### 4.1 防御层（sentinel.sh）

```bash
case "$status" in
  done|completed|finished|complete)    # synonym 兜底
    exit 0
    ;;
  failed|blocked|stopped|aborted|cancelled)  # synonym 兜底
    exit 2
    ;;
  ...
esac
```

`scripts/sentinel.sh:166-185`。`SENTINEL_UNKNOWN_STATUS` 仍保留 `*)` 分支做诊断 log，但 worker 写 synonym 时不再死锁。

#### 4.2 规约层（worker-prompt.md）

`templates/worker-prompt.md` Process 加第 9 步：

```
9. **Canonical terminal status (mandatory)**: on the final `STATUS.json`
   update, set `status="done"` **exactly**. The sentinel's status machine
   matches the literal string `done` (defensively also `completed` /
   `finished` / `complete`, but **never rely on synonyms**). If you write
   `completed` or `finished` instead of `done`, the sentinel will not exit
   and PM will not be re-invoked via harness task-notification — the
   worker is effectively orphaned until `--max-wait 7200s` timeout.
```

#### 4.3 双侧都改的取舍

只在 sentinel 改 synonym 兜底是单边防御，下次换 provider 仍可能漂移；只在 worker-prompt 改强约束是单边规约，已发的 LLM 一旦错过这条规则就死锁。双侧都改 = 防御兜底 + 规约约束，spike 或实战触发时不会出 corner case。

### 5. 验证

- sentinel.sh 改动后 `bash scripts/smoke-sentinel.sh` 应仍通过（status=`done` → exit 0；status=`completed` → exit 0；status=`running` → 继续轮询）。
- worker-prompt.md 改动后 Wave 7+ 工人会被显式告知 `status="done"` 是唯一合法终态。
- 实战验证：Wave 7+ 启 2 worker，观察 PM 是否在 sentinel exit 0 后 < 30s 内被 re-invoke（Phase 1 spike 已实测，Phase 2 实战复测）。

### 6. 已知限制 / 不采纳

- **不**在 sentinel 接受一切非常规字符串：synonym 集合限制在 `done / completed / finished / complete` 和 `failed / blocked / stopped / aborted / cancelled` 之内，避免 typo 误识别为终态。
- **不**改 `templates/checkpoint-status.json` 模板：模板已是 `status="running"`，只有 `done` / `failed` / `blocked` / `stopped` 在 sentinel 期望集合，模板无需改。
- **不**改 `wait-worker.sh` / `pm-monitor.sh`：它们读取 `STATUS.json` 终态的逻辑与 sentinel 对齐，由 sentinel 兜底后 wait/monitor 自然继承修复。

### 7. 后续路径

- 跨会话可查 memory `project_multi_agent_state.md` 在 Task #9 条目下追加"实战发现 synonym 缺口（DEC-060 修复）"留痕。
- Wave 7+ 启动时 PM 仍按 Task #9 设计：用 `spawn-worker.sh --with-sentinel` + 2 background sentinel + harness task-notification。本次 patch 已保证 synonym 兜底，事件驱动链路恢复。
- 如果未来再加新 synonym（例如 `succeeded` / `ok`），按 §4.1 pattern 加 pattern + §4.2 文档化。

