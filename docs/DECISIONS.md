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
