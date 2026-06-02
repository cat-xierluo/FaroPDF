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
