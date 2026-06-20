# FaroPDF 路线图

> Last updated: 2026-06-09（ISS-055 顶栏任务模式入口收口后更新）

## 项目愿景

FaroPDF 是一个清亮、快速、法律材料友好的 PDF 阅读器。它要成为律师日常阅读卷宗、证据、判决、合同和扫描材料的主工具：打开即读，搜索可靠，批注能整理，扫描件能 OCR，页面整理可回退。

## 阶段状态速览

| 阶段 | 目标摘要 | 状态 |
| --- | --- | --- |
| v0.0 上下文初始化 | 固定项目名、定位、技术选型、文档体系 | 已完成 |
| v0.1 完整基础版 | 快读、检索、批注、OCR/扫描、页面整理、常用导出、表单签署、设置 | 进行中（alpha.0 ~ 0.1.0-alpha.18 已封箱；详细子项审计留 follow-up，下一版起逐节刷新） |
| v0.2 法律增强 | 批注摘要、证据目录、材料拆合并、Bates 编号深化 | 待开始 |
| v0.3 性能与发布 | 大卷宗性能、自动更新、跨平台打包、官网与文档站（迁出 personal-site） | 待开始 |

## v0.1 完整基础版

### 0. Foundation Gate

- [x] 创建可运行应用脚手架和基础阅读器 shell。
- [x] 建立共享类型、模块边界和测试 fixture 策略。
- [x] 建立设置入口、最近文件和默认保存策略基础。
- [x] 明确多 worktree worker 的分支名、文件范围和验收命令。

### 1. 项目脚手架

- [x] 创建 Tauri v2 + React + TypeScript + Vite 应用。
- [x] 配置基础测试、类型检查、Lint 和构建脚本。
- [ ] 接入 macOS/Windows PDF 文件关联。
- [x] 建立应用设置持久化和最近文件模型。
- [ ] 接入透明标题栏、原生窗口拖动和基础自动更新预留。

### 2. 快速阅读

- [x] 使用 PDF.js 打开本地 PDF 二进制文件。
- [x] PDF.js worker 独立加载，不阻塞主线程。
- [x] 实现页面虚拟化，只渲染可见页和邻近页。
- [x] 支持连续滚动、单页、双页和适合宽度阅读（`defaultViewMode: "continuous"` + `"single" | "double" | "fit-width"`）。
- [x] 支持缩放、旋转视图、页码跳转和键盘翻页（`reader/setRotation` action + `useReaderKeyboard` PageUp/PageDown/Arrow）。
- [x] 支持左侧缩略图和文档目录（`Sidebar.thumbnail-list` + `thumbnail-item--current` 标记）。
- [x] 支持恢复上次阅读页码和缩放（`PdfRecentFile.lastPage` + `AppSettings` 持久化）。

### 3. 检索与文字层

- [x] 按需检测已索引页文字层状态，区分可搜索 PDF 和纯扫描 PDF。
- [x] 建立按需全文索引，不在打开文件时同步扫描全卷。
- [x] 支持全文搜索、命中列表、当前页高亮和上下一个命中。
- [x] 搜索结果展示页码、上下文片段和命中数量。
- [x] 无文字层或文字层质量差时提示 OCR。

### 4. 批注

- [x] 支持文本选择高亮、下划线、删除线（`PdfAnnotationType: "highlight" | "underline" | "strikeout"`）。
- [x] 支持备注、文本框、矩形、箭头和自由手写（`PdfAnnotationType: "note" | "textbox" | "rectangle" | "arrow" | "ink"`）。
- [x] 支持常用图章（`"stamp"` + 5 图章模板）。
- [x] 支持批注颜色、作者、时间和页码。
- [x] 支持批注列表、批注搜索和点击跳转（`AnnotationSidebar` + `annotation-sidebar-search` + `listAnnotations`）。
- [x] 支持导出批注摘要为 Markdown 或 HTML。
- [x] 默认先保存可编辑 sidecar 状态，导出时再写入或扁平化到 PDF。

### 5. 页面整理

- [ ] 支持页面旋转、删除、重排和撤销。（已建立可测试状态/撤销/plan-only 导出底座；完整 UI 和真实 PDF 页面改写待接入）
- [ ] 支持插入 PDF、插入空白页、提取页码范围（**部分**：PR #62 ISS-NEW-A 阶段 1 已落共享契约 + 引擎 + 单元测试 7 项 / 34 通过；PR #63 阶段 2 UI 入口已落；insert-pages / merge-pdfs / extract-pages 真实改写走 pdf-lib `copyPages` + `insertPage` / `addPage`，互斥一次只允许 1 个）。
- [ ] 支持多个 PDF 合并（**部分**：PR #62 ISS-NEW-A 阶段 1 `merge-pdfs` 通过 `additionalSources` 数组按顺序追加多份 PDF 已落；PR #63 阶段 2 UI 入口已落）。
- [ ] 支持裁剪、拆分双页扫描、添加普通页码和 Bates 编号。
- [ ] 支持证据图片和 PDF 页面按 A4 多图编排。（已建立 plan-only A4 编排计划器；真实目录拾取和像素渲染待接入）
- [ ] 支持页级检查索引、文书边界 manifest 和规范命名建议。
- [ ] 所有页面整理默认另存为新 PDF，不覆盖原始文件。

### 5.1 常用导出工具

- [x] 支持文字水印和图片水印。（ISS-040：导出二级工具条切换右侧交付设置面板，支持文字水印参数和 PNG/JPG 图片水印，默认输出新副本）
- [x] 支持页眉页脚固定说明。（ISS-042：三级 `工具` 入口进入导出模式右侧页眉页脚设置，默认输出 `*-header-footer.pdf` 新副本）
- [x] 支持 Bates 编号的起始号、前后缀和位置选择。（ISS-039：导出模式右侧交付设置面板已接入预览和 bytes 下载）
- [x] 支持常用压缩预设，并明确压缩影响和输出路径。（ISS-041：三级 `工具` 入口进入导出模式右侧压缩设置，默认输出 `*-compressed.pdf` 新副本；DPI 降采样仍保留后续深化）
- [x] 支持批注、表单和页面操作扁平化导出。（ISS-043 / ISS-044 / ISS-045：表单扁平化、页面操作真实另存和批注扁平化入口均已接入对应深层面板，默认输出新副本）

### 6. OCR/扫描

- [x] 检测纯扫描页、低文字量页和疑似 OCR 失败页（`OcrQualityReport` 契约 + `ocrQualityCheckService` 报告服务，DEC-017 / DEC-050）。
- [ ] 支持扫描件清洁校正：粗方向检测、微倾斜校正、可选裁边和分块处理（**部分**：preprocess-only job/bridge 真实清洁已落，ISS-016 / DEC-040；粗方向 / 微倾斜 / 拆分双页仍 plan-only，待后续 worker 接入）。
- [x] 提供 OCR bridge，优先连接本地 Legal Skills / `ocrmypdf`（`start_ocr_job` 按 provider 分发到 `ocrmypdf` 子进程，DEC-030 / PR #18）。
- [x] PaddleOCR / MinerU 等联网 OCR 需用户明确确认（`ocrPrivacyConsentGuard` notice/consent 双匹配 + 桥接 fingerprint/nonce/有效期，DEC-010 / PR #47）。
- [x] OCR 任务后台运行，显示进度、后端、输出路径和失败原因（`createTauriOcrJobController` + `OcrJobList`，DEC-042 / PR #29）。
- [x] OCR 后生成双层 PDF，并执行文字搜索质量抽查（`extract_ocr_text` 调 `pdftotext` 抽取 + `OcrQualityReportView`，DEC-030 / DEC-050 / PR #33）。
- [x] 支持只 OCR 指定页码范围（`startOcrJob` 请求体 `pageRange` 字段）。
- [x] 在设置页配置 PaddleOCR / MinerU 等外部 OCR provider 的 API 参数（`SettingsService` + `OcrProviderSection`，DEC-014 / PR #25）。

### 7. 表单与签署

- [x] 读取 AcroForm 字段并高亮可填写区域（`FormService.readFormFields`）。
- [x] 支持文本框、复选框、单选框和下拉字段填写（`FormService.fillFormField` + `applyFormOperations` 批量）。
- [ ] 支持签名图片、手写签名和签名位置调整（**部分**：签名图片限定 PNG/JPG 已落，ISS-008 / DEC-055，CHANGELOG 0.1.0-alpha.5；手写签名 / 签名位置调整待后续 worker）。
- [x] 支持表单扁平化导出（`FormService.flattenForm`，pdf-lib `form.flatten()`；ISS-043：三级 `表单扁平化` 入口进入填写和签名面板确认导出）。

### 8. 设置与安全

- [x] 支持最近文件、默认缩放、阅读布局、默认保存目录、浅色 / 深色外观和 OCR 后端设置。
- [x] 支持 PaddleOCR / MinerU API 配置，不在 UI、日志和仓库中暴露完整密钥。
- [x] 联网 OCR 必须要求用户主动确认。
- [x] 所有改变 PDF 的操作默认另存为新 PDF（`pdfOperationEngine` 路径型新文件 + `outputToolPlan` 计划摘要 + `writeNewFile` 仅新建语义）。

## v0.2 法律增强

- [x] 批注摘要按页码、颜色、标签和批注类型分组（`AnnotationSummaryPanel` + `AnnotationSidebarGroupBy: "page" | "color" | "type" | "label"`）。
- [x] 批注摘要支持导出为案件材料核查清单（`AnnotationSummaryPanel` Markdown / HTML 导出，DEC-068）。
- [ ] 支持证据材料页码区间管理。
- [ ] 支持根据文字层生成页面索引草稿。
- [ ] 支持文书拆分、合并和规范命名的工作台入口。
- [x] 支持法院上传体积限制下的压缩预设（4 档 preset + 真实 JPEG DCTDecode 重编码 + 目标体积验证，DEC-069）。

## v0.3 性能与发布

### 9. 全平台发布与设置 UI

- [x] ISS-021 全平台打包与自动更新：接入 `tauri-plugin-updater`，建立 GitHub release 跨平台矩阵和 updater manifest 签名。v0.1.0 + v0.1.1 已成功发布（DEC-048 / DEC-056 / DEC-065 / DEC-066 / DEC-067 / DEC-070 / DEC-071）。
- [x] ISS-022 设置页面 UI 整合：扁平 `SettingsPanel` 升级为左侧导航 + 多 section 浮层，含「常规 / 阅读 / OCR provider / 快捷键 / 关于」5 个 section + lazy load 收口（DEC-038 / DEC-059）。
- [x] ISS-023 关于页面与作者页：在设置页「关于」section 展示应用 icon、版本、定位、官网（指向 personal-site 仓） / GitHub 链接、当前更新状态和作者卡（DEC-038 / DEC-051）。
- [ ] 移动端（Android / iOS）打包能力与自动更新在 v0.3 评估范围，记录限制和后续计划。
- [x] 官网与文档站入口迁移：v0.1 阶段的官网占位条目由 `https://cat-xierluo.github.io/personal-site/faropdf/` 承接（详见 DEC-058 跨仓 cleanup）。FaroPDF 仓本身不维护 `website/` 子目录或独立的 GitHub Pages workflow；后续官网 / 文档站的所有更新都在 `cat-xierluo/personal-site` 仓推进。

## 进度日志

- 2026-06-02：初始化 FaroPDF 项目上下文，固定独立项目定位、技术选型、首版功能范围和文档体系。
- 2026-06-02：将 v0.1 推进方式调整为先完成 Foundation Gate，再按任务包使用多分支、多 worktree 并行实现完整基础版。
- 2026-06-02：纳入 `pdf-processor`、`pdf-organizer`、`img2pdf` 的脚本算法来源，新增扫描清洁校正、压缩算法、OCR 质量检查、证据图片编排和文书整理 manifest。
- 2026-06-02：在 foundation 分支完成 Tauri/React 脚手架、基础阅读器 Shell、共享契约、设置入口和验证命令。
- 2026-06-02：并行完成 PDF.js 阅读底座和设置/OCR provider 配置第一版，进入阅读深化、搜索、批注和 OCR bridge 前置状态。
- 2026-06-02：完成 `ISS-016` 第一版扫描预处理基础：preprocess-only job model、参数校验、默认新输出 PDF 路径、Tauri command bridge stub 和测试；真实 OpenCV/PyMuPDF 处理继续后续接入。
- 2026-06-02：参考 PDF Expert 的信息架构，在 `feat/pdf-expert-shell-ia` 分支启动 Shell 重排草案；当前记录为 UI 方向和任务边界，尚未达到最终视觉验收。
- 2026-06-02：完成批注 sidecar 模型第一版，建立 schema version 1、仓储服务和 Markdown / HTML 摘要导出；具体批注 UI 交互后续接入。
- 2026-06-02：完成 `ISS-003` 文本层检测与全文搜索第一版：按需内存索引、结果列表、上下一个命中、当前页轻量高亮和 OCR 提示已落地；真实 PDF text-layer 几何高亮继续随阅读渲染深化。
- 2026-06-02：完成 `ISS-005` 导出引擎底座第一版：bytes-first pdf-lib 复制导出、路径型新文件输出保护、表单 flatten、批注 sidecar plan-only 摘要和页面操作 plan-only 入口已落地；真实批注绘制和页面操作改写继续后续接入。
- 2026-06-02：完成 `ISS-006` 页面整理第一版底座：页面整理状态、旋转/删除/重排/恢复/撤销、默认 `*-organized.pdf` 输出路径和 plan-only 导出请求已落地；真实页面改写、完整页面网格 UI 和高级页面整理能力继续后续接入。
- 2026-06-02：完成 `ISS-010` 法律材料隐私与联网 OCR 提示第一版：notice/consent/audit 模型、脱敏路径摘要、API key 引用脱敏、云端 consent guard 和 bridge 审计衔接已落地；旧布尔确认标记不能单独放行云端 OCR，完整 UI 弹窗和真实云端 OCR 调用后续接入。
- 2026-06-02：完成 `ISS-013` PDF 交付工具底座第一版：文字/图片水印、页码和 Bates 编号导出 operation 与 pdf-lib 写入已落地，默认 `*-delivery.pdf` 新输出路径和压缩 plan-only 摘要已建立；真实压缩和中文字体接入继续后续深化。
- 2026-06-08：完成 ISS-039 工具启动器与导出编号面板：右侧 `工具` 菜单按 `组织页面 / 交付导出 / 标注填写 / 扫描 OCR` 分组；页码 / Bates 继续留在三级入口和导出模式右侧面板，二级导出工具条只保留 `文字水印 / 图片水印`。
- 2026-06-08：补齐 ISS-032 原生菜单桥接：macOS `工具` 菜单项通过 `faropdf://command` 进入前端 command model；`文件 > 打开…` 经 Tauri dialog + 专用 PDF bytes 读取 command 打开文档。
- 2026-06-08：完成 ISS-050 原生菜单系统动作收口：`文件 > 新建窗口` 由 Tauri 直接创建新窗口，`帮助 > 关于 FaroPDF` 打开设置页关于 section；新建窗口 / 全屏 / 关闭窗口不再进入前端 PDF 业务 command catalog。
- 2026-06-08：完成 ISS-041 压缩交付面板：`压缩` 保持三级工具入口并进入导出模式右侧 `压缩设置`，支持法院上传 5MB/10MB/20MB/50MB 等预设，默认输出 `*-compressed.pdf` 新副本；压缩 apply 模式使用压缩服务输出替换导出工作 PDF。
- 2026-06-08：完成 ISS-042 页眉页脚交付面板：`页眉页脚` 保持三级工具入口并进入导出模式右侧 `页眉页脚设置`，支持页眉、页脚、字号和透明度，默认输出 `*-header-footer.pdf` 新副本。
- 2026-06-08：完成 ISS-043 表单扁平化入口收口：`表单扁平化` 保持三级工具 / 原生菜单入口并进入填写和签名面板；填写签名二级工具条只展示 `读取字段 / 填写 / 签名 / 扁平化导出` 四个已接通动作。
- 2026-06-08：完成 ISS-044 页面管理工作台真实状态：页面管理继续留在左上角独立工作台；旋转 / 删除 / 撤销接入 `pageOrganizer` 状态机，另存通过 `pdfOperationEngine` 的 `page-operations execute` 输出 `*-organized.pdf` 新副本。
- 2026-06-08：完成 ISS-046 页面管理重排 UI：页面管理工作台新增 `上移 / 下移`，使用 `reorderOrganizerPages` 更新页面顺序，撤销可恢复，另存继续输出 `*-organized.pdf` 新副本；重排不进入阅读态顶栏或导出二级工具条。
- 2026-06-04：ISS-013 第二阶段（真实压缩 + 中文字体）worker 启动后即触发 scope-fontkit 物理冲突（pdf-lib 嵌入自定义字体需 `@pdf-lib/fontkit`，与 worker prompt 的"不修改 package.json / 不引入 npm 字体包"约束冲突），按 DEC-036 延期到下一波；当前 wave 3 收口 2 个 PR（PR #22 阅读模式深化 / PR #23 表单填写与签署），整体推进度足够。重启条件：重写 worker prompt 明确"@pdf-lib/fontkit 是 pdf-lib 官方 devDep，可装"+ 选开源协议中文字体（OFL / Apache 2.0 / MIT）。
- 2026-06-03：合并 `ISS-017` OCR 质量检查第一版（可检索页比例、关键词命中、CER、体积比、耗时和问题页）和 `ISS-018` 证据图片 A4 编排计划器第一版（auto 布局、方向检测、边距校验、安全输出路径）。
- 2026-06-05：跨仓 cleanup（personal-site `ISS-005` 联动 / DEC-058）：官网 / 文档站入口由 `cat-xierluo/personal-site` 仓统一维护；FaroPDF 仓 README / ROADMAP 同步指向 `https://cat-xierluo.github.io/personal-site/faropdf/`，不引入 `website/` 子目录或独立的 GitHub Pages workflow。
- 2026-06-05：封箱 0.1.0-alpha.18（DEC-063）：把 `## Unreleased`（ISS-022 lazy load）+ `## Unreleased (continued)`（DEC-061 keychain / DEC-058 跨仓 cleanup / DEC-062 ISS-029 真实 QR）四条 Unreleased 条目合并为 `## 0.1.0-alpha.18 - 2026-06-05` 段；`package.json` / `src-tauri/tauri.conf.json` 版本号 `0.1.0` → `0.1.0-alpha.18`；v0.1 阶段状态从「待开始」更正为「进行中（alpha.0 ~ 0.1.0-alpha.18 已封箱）」；本段详细子项审计留 follow-up，alpha.19 起的 CHANGELOG / ROADMAP 同步按已完成能力逐节刷新；`v*.*.*` tag pattern 改 `["v*.*.*", "v*.*.*-*"]` 让 `v0.1.0-alpha.18` 也能触发 release.yml。
- 2026-06-15：撤回 working tree 半做的 0.1.2 updater 启用尝试（DEC-099）：2026-06-14 session 末尾按 `v0.1.2` tag 注释 6 步配方只走 1.5 步就停了（`src-tauri/Cargo.lock` 升 0.1.2 + `tauri.conf.json` 加回旧 placeholder pubkey），`updater.active: false` 和 `createUpdaterArtifacts: false` 没改、没 commit、没生成新 keypair。直接 `git checkout --` 撤回，working tree 回到与 `cce1ce5` / `v0.1.2` tag 完全一致；6 步配方整体后移到 0.1.3 之后，前置条件 ISS-036（仓库私有）+ 新 keypair 一起解。同时落地 `docs/handoffs/2026-06-14-context-handoff.md`（上下文接续文档），把 §3.1 决策点 A 落实为本次撤回；`research/pdf-expert/` 30 张 PDF Expert 参考截图保留，下一阶段补 README §"仍待截" 9 项。
- 2026-06-15：补完 `research/pdf-expert/` §"仍待截" 9 项（详见 `research/pdf-expert/batch-2026-06-15/README.md`）。用 computer-use skill 在 PDF Expert.app 上跑菜单 + 对话框 + 工具激活：35 张核心截图（31-69 编号）+ 4 张辅助 + 1 个 fixture 副本（2nd-pdf.pdf）；9 项中 **7 项完全覆盖**（Item 1 顶栏菜单 10 张、Item 2 签名单列、Item 3 合并/密码/OCR/拆分 4 个对话框、Item 4 multi-tab、Item 5 搜索结果 3 位置、Item 6 缩放 4 档、Item 9 图章 + 5 种形状）+ **2 项 known limitation**（Item 7 浮动高亮菜单 / Item 8 缩略图拖动重排，本机 `brew` 启动失败无法装 `cliclick`，JXA + Quartz 拖拽事件送达但 PDF Expert 沙箱内未识别为有效手势）。父 README 的"仍待截"清单已更新为下一波（cliclick 装好后 retry + PDF Expert 设置改 multi-tab + 主题/表单/导出子菜单等补充项）。
- 2026-06-21：完成 ISS-NEW-A 阶段 1 Toolbar 5 段布局重构 + L2 tab 上移（DEC-144 / commit `5b2b285`）。Wave 1 W1 worker（minimax-1 slot）独立 worktree TDD 完成，6 files / +664 / -36，typecheck pass；W2 worker（ISS-NEW-G Welcome + statusbar）14 min 0 commit，按 memory contingency graceful kill 释放 MiniMax 配额，W2 任务留 PM 单 session 后续推进。Multi-agent 收口：worker 撞 pre-existing vitest 环境问题时 PM 纠偏（停止 debug、commit code、标记 verification known-fail），最终 commit rebase 后 FF merge 到 main。ISS-NEW-A 阶段 2（阅读区瘦身到 4 元素 + 「书签」侧栏按钮）+ ISS-NEW-B（旋转/适合页面下移 L4）待启动。
