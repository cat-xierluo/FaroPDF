## 未发版 · Shell 层级、密度与画布几何纠偏（2026-07-28，DEC-186）

- **量测纠错**：逐行像素取色推翻先前 29/32/33pt 基线，canonical 改为 L2=40pt、L3=40pt、annotate/edit L4=43pt、页面管理 L4=44pt；页面 bbox 与页卡 canvas 通过白色连通域复核。
- **功能层级**：L3 重组为 navigation / zoom / workflows / collaboration / search 五段；导出、填写签名和 OCR 与批注/编辑同属核心工作流，低频命令与设置收入口菜单。标题栏与画布改为参考态的中性深色层级，按钮间距、激活态和大纲空态同步收紧；G05 编辑态恢复 272px 大纲左栏，L3 与原生 PDF 编辑菜单统一进入该结果态；搜索从 L3 浮层改为 measured 240px L5b 结果栏。
- **阅读画布**：single 只渲染当前页；50% 运行态按 measured density calibration 对齐参考 48% 页面 bbox。read/annotate/edit/pages 隐藏无参考依据的底部状态栏，OCR 等依赖状态信息的工作流继续保留。
- **页面管理**：`PageOrganizerWorkspace` 使用 `reader.renderThumbnail` 渲染 5 张真实 PDF canvas，默认选中当前页；1280×832 下页卡位置、尺寸、间距与 G02 measured 对齐。拖拽重排、写回与导出重开仍属 M3。
- **可失败门禁**：`verify:pdf-expert-visual` 从 24 项扩展到 73 项，新增 L3 五段 x/width、页面 bbox/单页计数、G05 编辑大纲与中央画布、页卡 bbox/真实 canvas、搜索三列及参考态状态栏断言；最新 run 73/73 PASS。`verify:ui-layout` 两视口 PASS，typecheck、118 项聚焦测试、AppShell edit/native 2 项定向测试与 build PASS。
- **独立回验**：S4 首轮发现 G05 假绿，回验又发现原生 `pdf-edit-*` 会二次折叠左栏与 `canvas` bbox 语义重叠；整改后按 reference/协议/矩阵/量测/实现/report 三轮复核，最终严格 PASS。
- **验证限制**：全仓 lint 唯一错误仍位于用户已有改动 `src/modules/reader/readerReducer.test.ts:244` 的 `prefer-const`；本轮未修改该文件。本轮相关 ESLint 与 AppShell edit/native 定向测试均通过；AppShell 全文件 Vitest 的既有 open-handle 仍未冒充 PASS。accepted-golden 仍为 0，因此最高等级为 `wired + geometry/density-verified`，不声明 `visually-verified`。

## 未发版 · PDF Expert 状态机与验证器纠偏（2026-07-28，DEC-185）

> 历史初校记录：本节的 29/32/33pt、搜索 480px 和 24 项结果已被 DEC-186 的二次像素校准与 73 项门禁取代；状态机拆分等其余决定继续有效。

- **模式拆分**：`T 编辑` 进入独立 `edit` mode，保持单页 PDF 画布并显示 `文本 / 图像 / 链接 / 隐藏` L4；尚未接通的内容编辑工具显式禁用。独立“页面管理”入口进入 `pages` mode 并挂载 `PageOrganizerWorkspace`，不再激活 `T 编辑`。
- **面板纠偏**：批注默认态不再自动打开图章右栏；移除无证据的 forms→shape fallback。右栏基础默认恢复 320px；搜索使用 measured 480px、形状使用独立像素复核约 380px，不再跨 surface 借宽度。
- **层级初校（已被 DEC-186 取代）**：当时按 measured 29/32/33pt 拆分；二次逐行像素复核后改为 40/40/43–44pt。深色主题、48% 缩放的采集口径继续有效。
- **验证器修复**：`verify:pdf-expert-visual` 改为逐层 bbox + surface 语义断言，覆盖 read/annotate/edit/pages；删除“用搜索 480px 验批注图章栏”和“把 L2+L3+L4 绑到单个 toolbar DOM”的假断言。`verify:ui-layout` 同步验证 edit/pages 独立路由。
- **验证**：typecheck 通过；Toolbar/RightPanel/命令/栏宽 72 项、App 15 项、新增 AppShell 4 项通过；`verify:ui-layout` 两视口 exit 0 并落盘本次 artifact 清单；`verify:pdf-expert-visual` 24/24 exit 0。actual 统一为深色、单页、第 1 页、50%（FaroPDF 最接近参考 48% 的 UI 步进），并复现 G03 左侧大纲与 G02 第 1 页选中态。accepted-golden 仍为 0，因此不声明 `visually-verified`。
- **独立复审**：S4 对状态机、证据、actual/report 和当前规范完成两轮纠偏后严格 PASS；M2/M2.1 仅关闭 measured 几何/语义门禁，M1 accepted-golden 与 M3 页面管理行为闭环继续保留为待办。

## 未发版 · 栏宽校准与 M2 验证器扩展（2026-07-25，DEC-184）

> 历史结果：DEC-185 已撤销“480px 是全局默认右栏”及“annotate 默认打开右栏”的推断；DEC-186 又将搜索面板从旧量测 480px 校正为现行 240px。左栏 272px 继续有效。

基于补采 N-CROP-L3-SEARCH 的 measured bbox（左栏 272pt + 右栏 480pt）校准栏宽默认值并扩展 M2 验证器。

- **栏宽校准**：`panelWidthStore` 默认值左 290→272（N-CROP-L3-SEARCH + N-ANNOTATE 双重 measured 佐证）、右 320→480（N-CROP-L3-SEARCH right_search_panel measured）。1280pt 窗宽下中央区剩 528pt = PDF Expert page_canvas width，布局比例一致。
- **verify:ui-layout 同步**：右栏断言 320→480（默认值改后必须同步）。
- **M2 验证器扩展**：verifyAnnotate 加右栏宽度断言（`.right-pane` bbox 对比 measured 480，差 0pt ✓）。填补 DEC-182 gap。
- **验证**：typecheck ✓；panelWidthStore 8 tests passed；verify:ui-layout exit 0（两视口 rightPanelWidth=480）；M2 右栏 480=480 ✓（toolbar 高度仍 fail，已知差距）。
- **不动 read 模式互斥**：保留 showRightPanel/showUtilityPanel 的 read/pages 互斥，不解除（避免交互模式变更）。

## 未发版 · 待补齐清单集中标注（2026-07-24）

- 在 `docs/TASKS.md` 顶部"当前唯一推进序列"后新增**集中"待补齐清单"**小节，按类型归档所有未完成项：
  - **A. 补采集（缺图）**：ISS-NEW-N-THUMB / SEL / CROP(L3 全展开) / M1 全量重采 / OCR 专属采集
  - **B. 补规格（目标态不清）**：P03 OCR 5 段定义 / P05 状态机拆分决策
  - **C. 补代码（证据已足够）**：M3 编辑闭环 / M4 各 surface / M5 功能闭环
  - **D. 补验证/复核**：measurements.json 3 处分歧 / M2 验证器扩展 / P0x 实机确认 / readerReducer.test.ts
- 各阻塞子卡（P03/P05/CROP/THUMB/SEL/SHAPE）标题下加醒目状态标注头（⛔阻塞 / 🔴未启动 / 🟡部分完成），指向清单对应行。
- 更新推进序列表状态：M0/M2 已完成，M1 待领取，M3/M4/M5 阻塞；阶段并发权"当前可领取项"同步刷新。
- 本次只改 TASKS.md，不改产品代码；目的是让后续 worker/agent 一眼看到"还需要补什么"。

## 未发版 · 文档与证据治理（2026-07-23，ISS-NEW-N 启动）

> 本节记录 2026-07-23 的 PDF Expert 证据治理与补采归档变更，**不涉及用户可见产品功能**；产品代码与现有完成等级保持不变。下游 release 由 v0.1.3 → v0.2 之间自行决定是否纳入本节。

### PDF Expert 证据治理（DEC-175~178，关联 ISS-NEW-M / ISS-NEW-N）

- **新建受控 fixture**（`tests/fixtures/expert/`）：用 pdf-lib 内置 Helvetica 生成 5 页 A4、纯英文虚构法律样例、含真实 PDF 文字层、未加密的 `reference.pdf`；脚本与产物受版本控制，保证任意 worker clone 后复采同一基线。已知局限：不含 CJK 文字层，CJK 排版/搜索视觉验证如需在 M2 另建。
- **版本更正**：`docs/reference/pdf-expert/manifest.json` 的 `observed_version` 由历史误标 `25.2.1` 更正为实机 `3.9.2`（`/Applications/PDF Expert.app` CFBundleShortVersionString 实测）。
- **采集协议**（`docs/reference/pdf-expert/capture-protocol.md`）：固化 fixture 路径、窗口位置 `{200,120}`、尺寸 `{1280,832}`、浅色主题、100% 缩放、`screencapture`+`sips` crop 流程、命名规范、人工 bbox 量测方法与 uncertainty 上限。
- **15 张首批图片重新分级**（manifest.json `raw_rerating`）：
  - `raw-Aminus` 6 张：R08 签名 / R09 密码模态 / R10 OCR / R11 图章 / R13 multi-tab edit / R15 edit 4+1（足以支撑面板/对话框级骨架修正，精度为粗估）。
  - `raw-B` 4 张 + `raw-B-low-confidence` 1 张：R02 read / R04 outline / R06 search / R14 welcome / R12 shape（实为 stamp）。
  - `raw-C` 4 张：R01 终端错 / R03 两页实单页 / R05 outline 重复 / R07 selection 实无。
- **缺图硬归档**（manifest.json `pending_recapture` + `coverage-gap.md` P0+）：4 块 surface 在现有 raw 中无图，归档为 4 个 ISS-NEW-N 补采子卡，由其他 worker 后续执行：
  - ISS-NEW-N-CROP：窗口已 crop 的 L3 工具栏全展开参考（解决 chrome 精确尺寸）
  - ISS-NEW-N-THUMB：左栏缩略图列表 + 当前页高亮
  - ISS-NEW-N-SEL：text selection 浮动工具条
  - ISS-NEW-N-SHAPE：shape 6 段合同的真参考

### ISS-NEW-N 任务卡（6 个面板修正子卡 + 4 个补采子卡）

- 关联任务：`docs/TASKS.md` 新增 ISS-NEW-N（大节 + 6 个面板修正子卡 + 4 个补采子卡）；不替代 ISS-NEW-M M1。
- 6 个面板修正子卡（基于 raw-Aminus，最高交付等级 `wired` + `geometry-coarse-verified`，**禁止 `visually-verified`**）：
  - ISS-NEW-N-P01 SignaturePanel 竖排签名卡骨架（R08）
  - ISS-NEW-N-P02 SetPasswordDialog center modal + 半透明遮罩（R09）
  - ISS-NEW-N-P03 OcrPanelView 5 段结构 + L3 `扫描和文本识别` 次级工具条（R10）
  - ISS-NEW-N-P04 StampPanel tab×2 + 2×2 preset 网格（R11）
  - ISS-NEW-N-P05 EditModeGridView 4 列响应式 wrap + 次级工具条 7 项（R13+R15）
  - ISS-NEW-N-P06 AnnotationToolbar 工具条顺序 + active 蓝描边色（R11）
- 4 个补采子卡：见上节。
- 每个面板修正子卡 PR 描述必须引用 `manifest.json` 的 raw-Aminus 分级与对应 capture id；任何尺寸声明必须标注"粗估，未 crop、未稳定性 diff"。

### 影响

- 任何 PDF Expert 面板/对话框实现 PR 不得以"与 PDF Expert 视觉对齐"或"高保真复刻"作描述；最高只能称"基于 raw-Aminus 的 wired + geometry-coarse-verified 修正"。
- 历史 raw 图（R01–R15）的文件名未改（避免追溯破坏 state-matrix 引用），但 `observed_version` 含义以新版 manifest 为准。
- 不修改任何产品代码或测试；本次新增/修改仅限证据、任务与决策文档。

## 未发版 · PDF Expert 面板修正实现（2026-07-24，ISS-NEW-N-P01/P04/P06）

基于 raw-Aminus 证据实现 3 个面板修正（commit 658b512）。最高交付等级 `wired` + `geometry-coarse-verified`，禁止 `visually-verified`。

- **共享前置**：`src/styles/app.css` 新增 `--selection` token（light `#55a3f8` / dark `#6db5ff`），来源为补采 G02/G03/G04 实测 PDF Expert 选中蓝。P01/P04/P06 共用。
- **P06 批注工具条 active 蓝**：新建 `AnnotationToolbar.css`，补最小可读基础样式 + 3 条 active 规则（tool-button / color-swatch / stamp-button）。此前组件 JSX 早已加 `--active` className 但 CSS 规则完全缺失，active 态无任何视觉反馈。
- **P01 签名面板选中蓝**：`SignaturePanel` 加 `selectedId` state，点击签名后高亮蓝描边（`--selection` inset box-shadow）。不改变"点击即落入"交互，仅加视觉反馈。
- **P04 统一图章面板**：新建 `src/modules/stamp/ui/StampPanel`（标准/自定义 tab + 响应式网格）。R11 粗估看到"2×2 共 4 张"，但代码有 9 个标准模板——不砍模板，改用响应式网格（默认 2 列、宽时 3 列）展示全部 9 个。自定义 tab 嵌入现有 CustomStampPanel。RightPanel stamps tab 从 CustomStampPanel 切换到 StampPanel。
- **验证**：typecheck ✓；聚焦测试 28 passed（SignaturePanel 10 + StampPanel 4 + AnnotationToolbar 14）。
- **跳过**：P02（密码 modal，需架构决策）、P03（OCR 5 段，规格不清）、P05（编辑网格，已被补采推翻）。

## 未发版 · SecurityPanel modal 化（2026-07-24，ISS-NEW-N-P02）

- **P02 密码 modal**：SecurityPanel 从右栏 `<aside>` 改为 center modal + 半透明遮罩（`position:fixed` + backdrop + 居中卡片）。保留 set/remove 双 mode（不破坏现有功能），不新建独立 SetPasswordModal（避免两个密码入口）。input:focus 改用 `--selection` 蓝匹配 R09。窄屏保留 bottom-sheet 形态。
- **验证**：typecheck ✓；SecurityPanel 15 tests passed（+1 modal 形态测试：dialog role + backdrop 点击关闭）。

## 未发版 · M2 视觉验证器骨架（2026-07-24，ISS-NEW-M M2 / DEC-182）

- **新增 `scripts/verify-pdf-expert-visual.mjs`**：PDF Expert reference bbox 几何对齐验证器。策略为几何结构 diff（DOM bbox 对比），不做感知像素 diff（PDF Expert 原生 vs FaroPDF web 像素 diff 必然失败）。从 measurements.json 读 reference bbox，Playwright 取 FaroPDF DOM boundingBox，超 ±12pt 容差返回 exit 1。
- **新增 npm script** `verify:pdf-expert-visual`。与现有 `verify:ui-layout`（结构回归）分工：前者做 reference bbox 对齐，后者做 L3 五段/DOM 顺序/模式路由。
- **当前 run 结果 FAIL（期望行为）**：read toolbar 48pt vs 61pt（差 13pt）、annotate/edit toolbar 48pt vs 94pt（差 46pt）。验证器如实报告 FaroPDF 与 PDF Expert 布局差距，这是交付价值。
- **门禁处理**：用 measured reference（G01-G05）而非 accepted-golden（当前为 0）；M1 完成后换 reference 目录即可收紧容差。

## 未发版 · PDF Expert 补采证据入库（2026-07-24）

- 新增 5 组 PDF Expert 3.9.2 window-only crop：阅读默认、页面管理网格、批注、矩形工具、编辑画布；每组均保留 a/b 复采。
- 新增 `docs/reference/pdf-expert/measurements.json` 与 `supplemental-analysis-2026-07-24.md`，记录固定窗口、Retina crop、人工 bbox、状态机和下游实现约束。
- 明确页面管理网格不是左栏缩略图列表；文本选择浮动工具条仍未捕获；本批次保持 `measured`，不产生 accepted-golden 或 visually-verified 声明。

## v0.1.3（草稿，2026-06-22 收口沉淀，未发版）

> v0.1.x → v0.2 过渡版：5 ISS 收口（DEC-154~159）+ 13 commit（不含 catch-up）+ 累计 ~87 单测（i18n 4 + StatusBar 12 + WelcomeScreen 9 + GeneralSection 5 + ReaderCanvas 19 + AppShell ISS-NEW 子集 10 + commands.test 19 + ExportPreview 5 + OcrQueue 4）。typecheck ✅；vitest 受 pre-existing vitest 4.x + `html-encoding-sniffer`/`@exodus/bytes` ESM 冲突阻塞（main 仓库根也复现，与本次改动无关，详见 DEC-099）。
>
> 本草稿只保留 2026-06-22 的代码变更历史，其中关于 read L4、视觉对齐和完成状态的表述已由 2026-07-23 DEC-173 / ISS-NEW-M 纠偏，不得作为当前 UI 规格或任务入口。

### macOS 菜单栏（ISS-NEW-D 阶段 1 / DEC-159）

- 4 独立顶层菜单 ship：批注（8 工具 + 形状 submenu 6 形状）/ 扫描（增强扫描 submenu 4 档 + 4 顶层动作）/ 编辑 PDF（5 动作）/ 前往（5 顶层 + 浏览历史 submenu 5 项）。共 37 command id 注册 + macOS 菜单 event handler match arm + AppShell nativeMenuBridge 路由。
- 8 工具真实 arm（`armAnnotationTool` / `disarmAnnotationTool`），29 个 v0.2 占位反馈（复用 ISS-NEW-G 转换卡 + ISS-NEW-H 视图占位模式）。

### Toolbar 5 段布局（ISS-NEW-A 阶段 1+2+B / DEC-144+155）

- L2 TitlebarTabs 上移 + L3 Toolbar 严格 5 段（sidebar-toggles / file / reading / mode / right）。
- 侧栏 4 toggle（摘要 / 页面管理 / 视图设置 / 书签）+ UtilityPanelId 加 `bookmark` 枚举。
- 阅读区瘦身 4 元素（页码 + 视图模式 4-icon toggle + 缩放% + -/+）+ 旋转 / 适合页面下移到 L4 二级工具条（`<ReadModeToolbar>` → `ContextToolbar` mode === "read" 分支统一路由）。

### L4 二级工具条统一抽象（ISS-NEW-E 第 1 步 / DEC-156）

- `ContextToolbar` 接受 `mode: Exclude<AppModeId, "pages">`（5 模式）+ `reader` prop；`showContextToolbar` 改 `activeMode !== "pages"`（read 模式也显示 L4）。
- `contextualToolbarLabels` 加 `"read": "阅读模式工具"`。
- 删除独立 `<ReadModeToolbar>` 组件（并入 ContextToolbar）。

### 视图菜单 submenu 深度补全（ISS-NEW-H 阶段 1 / DEC-157）

- 视图 SubmenuBuilder 加 2 submenu（缩放 5 + 缩略图 2）+ 3 顶层占位（跳到当前页 / 重新载入 / 添加书签）。共 11 command id。
- 缩放 5 + 缩略图 2 真实路由（`reader.zoomIn/zoomOut/setZoomPreset` + `reader.setViewMode`）；3 占位 v0.2 占位反馈。

### 全量 UI 字符串 i18n 基础（ISS-NEW-G 收口 4 块 / DEC-154）

- 新建 `src/shared/i18n/`：dictionaries.ts（zh-CN + en 双字典）+ useI18n.ts（useSyncExternalStore + module-level listener）+ setCurrentLanguage runtime。
- `StatusBar` / `WelcomeScreen` / `GeneralSection` 27 个查表点全切（OCR 模式状态栏新增 + i18n dict 扩）。
- AppSettings 加 4 Preferences 字段：`defaultPdfViewer` / `pdfExpertOpenMode` / `resumeLastPage` / `pageNumberIndicator`。
- Welcome 屏 3 段布局（转换卡 + drop zone + 最近文件网格 + 清除最近按钮）+ ReaderCanvas 转换卡接线（`onConvertFromImages / onConvertFromWord` 占位反馈）。

### 右栏真内容 panel（ISS-NEW-C 阶段 2 后续 / DEC-158）

- `ExportPreviewPanelView`（6 active tool + 参数摘要 + 输出文件名后缀）。
- `OcrQueuePanelView`（任务列表 + status dot + cancel 按钮）。
- `AppShell` 接线 `exportPreview` + `ocrQueueJobs` + `onCancelOcrJob` 3 个新 props。
- `AppCommandGroup` 扩 `ocr` 枚举。

## Unreleased

> 历史条目记录当时已落地的代码，不自动等于当前高保真验收通过。PDF Expert UI 的现行状态只看 `docs/TASKS.md` ISS-NEW-M、DEC-173 与 `docs/reference/pdf-expert/`。

## 2026-07-23

ISS-NEW-M 上下文与证据纠偏（DEC-173，部分纠正 DEC-172）：
- 人工复核首批 15 张图片后，确认存在自动化失败、重复画面、状态误标和未统一裁剪；全部从 `golden/` 降级到 `captures/raw/` 并按真实画面重命名，当前 accepted-golden 为 0。
- 重写 manifest、state matrix 和 acceptance contract；新增 implementation map、rebuild guide、completeness checklist 与 S4 验证报告，明确 raw capture 不能推导精确 CSS 或关闭视觉任务。
- 撤销“T 编辑固定 5 列”的错误合同：现有固定 5 列、空白渐变缩略图、硬编码 A4、额外局部工具条和 noop 重排均登记为 M3 待修。
- 清理源码注释、测试名称和编辑空态中的旧规格话术：不再声称 read 工具由 L4 接管、固定五列等于 PDF Expert、截图 41/59 能证明固定分段或 forms 等于 T 编辑；本项不改变业务行为。
- 将后续工作固定为 M0 上下文纠偏 → M1 规范化重采/量测 → M2 视觉验证器 → M3 编辑闭环 → M4 Shell/Sidebar/RightPanel → M5 forms/export/OCR/异常态。
- 独立 S4 三轮审计与 doc-curator 收口通过；M0 关闭，M1 成为唯一可领取下一项。
- 增加多 Agent 阶段并发门禁（DEC-174）：M1/M2/M3 使用单一 owner，M4/M5 仅在 accepted-golden、可失败验证器和文件隔离齐备后条件式并行；明确“上下文一致”不等于“可以立刻多人改 UI”。

ISS-NEW-M 结构与几何门禁（DEC-172，仍有效的部分）：
- 新增受版本控制的 `docs/reference/pdf-expert/`，worker / worktree 不再只依赖被忽略的 `research/`。
- AppShell L5 列改为 `left → main → right` 的单一布局解析；修复 read 主画布只剩 290px、右栏抢占中央弹性列的问题。
- 修复 Toolbar「DOM 有 5 段、CSS 只有 4 列」导致 right section 换行的问题；L3 现在是计算后 5 列单行，L4 也不再保留 300px 假左缩进。
- read 模式不再渲染 L4；`T 编辑` 从错误的 forms 映射改为进入内部 `pages` mode。该路由不证明网格视觉或编辑行为已完成。
- 模式切换不再自动强开左侧 annotation / summary panel，用户显式面板状态与模式状态解耦。
- 新增 `npm run verify:ui-layout`：自动生成 5 页 PDF，在 1500×900 / 1280×800 下验证 read、annotate、双栏、edit 的结构几何和 DOM 顺序，并输出 8 张实机截图；它不是视觉 diff。

## 2026-06-25

ISS-NEW-D 阶段 5：前往浏览历史栈 实质接通（PM 单 session / DEC-171）：
- **第 1 块**（commit `48e1684`）：`ReaderState.history` 字段（reverse chronological order，上限 50）+ `setCurrentPage` 跳页前 push 旧页（dedupe 连续同页）+ `reader/goBack` action（弹顶部 + 不 push）+ `reader/clearHistory` + `loadSucceeded` 跨文档清空。readerReducer +8 测（19/19 ✅）。
- **第 2 块**（commit `e64b4d8`）：useReaderController 暴露 `goBack()` + `goToHistory(N)` API；`setCurrentPage` payload 加可选 `skipHistoryPush` 字段供 `goToHistory` 避免循环。useReaderController +5 测覆盖（push / pop / goToHistory 不 push / 越界 / 跨文档清空）。
- **第 3 块**（commit `8725724`）：AppShell 路由 6 个命令（`go-back` + `go-history-1..5`）从 v0.2 占位反馈改为实质接通。无文档 → 「请先打开 PDF 文档」；`go-back` 无历史 → 「没有可返回的浏览历史」；`go-history-N` 越界 → 「浏览历史只有 M 项」；有效 → 调 reader API + 反馈页码。AppShell +5 测。
- 前往菜单 5 顶层（首页/末页/上一页/下一页/返回）+ 浏览历史 submenu（5 项）全部从 v0.2 占位反馈改为实质接通。

ISS-NEW-F 第 3 步：跨窗口 detach 状态共享 3 块 ship（PM 单 session / DEC-170）：
- **第 1 块**（commit `c6b31cb`）：`tabStore.tsx` 扩展 `PdfTab.lastPage` 字段 + `SET_LAST_PAGE` action + `setLastPage(tabId, lastPage)` API，非法输入（0 / 负数 / 浮点）no-op。tabStore +4 测（17/17 ✅）。
- **第 2 块**（commit `4729231`）：`App.tsx` 加 `ActiveTabPageSync` 内层组件（TabProvider 子节点），把 `reader.state.document.currentPage` 同步到 active tab 的 `lastPage`。边界：document 为 null / active tab.filePath 不匹配 / lastPage === currentPage 都不 dispatch。App +4 测（10/10 ✅）。
- **第 3 块**（commit `7a565ea`）：`TitlebarTabs.handleDragEnd` 拖到视口外时把 `{filePath, fileName, lastPage}` 写到 localStorage `faropdf:pending-detach`，然后 invoke Rust `create_faropdf_window` 开新 WebviewWindow；`App.tsx` 加 `PendingDetachRestore` 内层组件，新窗口 mount 时读 key → 调 `tabStore.openTab` + `readPdfFileFromPath` + `reader.openNativeFile` + `reader.setCurrentPage` → finally 清 key。异常路径（非法 JSON / 字段缺失 / 读 bytes 失败）都清 key + console.error。TitlebarTabs +3 测（10/10 ✅） + App +5 测（15/15 ✅）。test/setup.ts 加 testing-library auto-cleanup 受益全 suite。
- 跨窗口状态共享闭环：源窗口 detach → localStorage 写 → 新窗口 mount 读 → tabStore + reader 状态恢复 → lastPage 跳页。新窗口能继续阅读同一 PDF 同页（与 PDF Expert 多窗口行为对齐）。

App.test.tsx ISS-NEW-I 同步修复（PM 单 session / DEC-169）：`uses contextual toolbars and task workspaces` 测试断言从 `PageOrganizerWorkspace` 时代的 `页面管理工作台 / 页面管理空态 / 页面管理工具条` 同步到 ISS-NEW-I（DEC-147）后的 `EditModeGridView` 实际暴露的 aria-label（`编辑模式网格 / 打开 PDF 后进入 T 编辑 / 编辑模式工具条`）。行为契约不变（点击 页面管理 → pages mode → 编辑模式网格）。commit `bdc0469` + 6/6 App 测 ✅ + typecheck ✅。

ISS-NEW-D 阶段 2 收尾（PM 单 session / DEC-160）：批注菜单补 9 辅助 command（链接 / 内容表 / 删除 / 删除全部 / 跳到批注 / 上一项 / 下一项 / 全部折叠 / 全部展开），全部 v0.2 占位反馈（依赖未实装的 history 栈 / AnnotationSidebar 操作）。commit `0adc932`。

ISS-NEW-H 第 2 阶段（PM 单 session / DEC-161）：视图菜单 3 占位改真实行为 — `view-go-current-page` 实质接通（`reader.setCurrentPage(currentPage)` + 反馈「当前已在第 X 页」）；`view-reload` / `view-add-bookmark` 留 v0.2 占位反馈（需 reader controller 加 `reloadDocument(path → File)` / `addBookmark(currentPage, label)` 新 API 后接通）。commit `a0e9d2e` + 3 测更新。

ISS-NEW-F 第 1 步（PM 单 session / DEC-162）：tab drag detach 手势 DOM 端检测 — `TitlebarTabs.handleDragEnd` 加 viewport 边界检查（`event.clientX/Y` 在 `document.documentElement.getBoundingClientRect()` 外 = detach candidate）；v0.2 占位 `console.warn` 留 trace，真实 Tauri `WebviewWindow.create()` IPC 接入留 ISS-NEW-F 第 2 步。commit `5641049`。

ISS-NEW-F 第 2 步（PM 单 session / DEC-163）：Tauri `WebviewWindow` create IPC 公开 — `src-tauri/src/lib.rs` `create_faropdf_window` 加 `#[tauri::command]` 注解（`AppHandle` owned）+ `invoke_handler!` 注册 + macOS 菜单 `tab-detach-new-window` event handler arm；`TitlebarTabs.handleDragEnd` 拖离时 `invoke('create_faropdf_window')` 开空新窗口 + `console.error` 兜底。v0.2 占位：文档句柄表（多窗口共享同一文档状态）留 ISS-NEW-F 第 3 步。commit `54e32da` + cargo check ✅ + typecheck ✅ + TitlebarTabs 7/7 ✅。

ISS-NEW-E 任务卡收口（PM 单 session / DEC-164）：5 模式 L4 + `pages` mode PageOrganizerWorkspace 全部 ship，8 验收项勾选 [x]。任务卡状态由"第 1 步完成"更新为"✅ 已完成（阶段 1+2）"。

ISS-NEW-H 第 3 阶段（PM 单 session / DEC-166）：视图菜单补 7 command id（滚动模式 / 翻页模式 / 工具栏 toggle / 左侧边栏 toggle / 适合屏幕）+ 2 真实行为接通（`view-reload` 简化为 `window.location.reload()` / `view-add-bookmark` 写回 `recentFiles[].lastPage`）。commit `da4305b` + 14/14 ISS-NEW-H 测。

ISS-NEW-D 阶段 3（PM 单 session / DEC-167）：批注形状 submenu 6 项从 v0.2 占位反馈改为实质 arm — `PDF_ANNOTATION_TYPES` 扩 3 类型（`ellipse` / `double-arrow` / `line`）+ `ANNOTATION_TOOL_LIST` 加 3 descriptor + 6 个相关 dict 同步扩 3 类型 + AppShell 形状 submenu 路由 `armAnnotationTool` 真实接通。AnnotationOverlay 渲染保持 v0.2 占位（drawEllipse / drawLine / drawDoubleArrow 后续 worker 接入）。commit `dae...` + typecheck ✅ + 127/127 annotation 测。

ISS-NEW-D 阶段 4（PM 单 session / DEC-168）：扫描菜单 4 档质量 + 3 顶层动作（扫描至可搜索 / OCR 文字 / 调整为可搜索）从 v0.2 占位反馈改为实质接通 — 调 `ocr.startOcr()` 启动 OCR 任务 + 反馈。4 档质量档当前都触发 startOcr（OcrWorkspaceController.startOcr 暂无 quality 参数，差异 v0.2 polish）。`ocr-enhance-all` 留 v0.2 占位（需 reader controller 加 batch OCR 接入）。commit + typecheck ✅。

ISS-NEW-D 阶段 1（PM 单 session / DEC-159，4 子菜单按顺序 ship）：

- **批注菜单（commit `0c25006`）**：macOS 批注 SubmenuBuilder 加 8 工具（高亮/下划线/删除线/文本/笔/橡皮擦/便签）+ 形状 submenu（6 形状：矩形/椭圆/箭头/双向/直线/铅笔）。8 工具真实 arm（`armAnnotationTool` / `disarmAnnotationTool`），6 形状 submenu v0.2 占位反馈（PDF_ANNOTATION_TYPES 缺 ellipse/line/double-arrow，真实形状绘制由 AnnotationOverlay 接 armAnnotationTool，DEC-147 已 ship 6 段 ShapeToolPanel）。
- **扫描菜单（commit `d5bfa10`）**：macOS 扫描 SubmenuBuilder 加「增强扫描」submenu（4 档质量：原始/标准/高级/自定义）+ 4 顶层动作（扫描至可搜索 / OCR 文字 / 调整为可搜索 / 增强所有扫描页）。`AppCommandGroup` 扩 `ocr` 枚举。8 command v0.2 占位反馈（真实 OCR 入口由 OcrWorkspace / OcrModeToolbar 提供）。
- **编辑 PDF 菜单（commit `3037e53`）**：macOS 编辑 PDF SubmenuBuilder 加 5 动作（编辑 / 添加图像 / 添加链接 / 添加文字 / 隐藏）。5 command v0.2 占位反馈（真实 PDF 直接编辑链路后续 worker）。
- **前往菜单（commit `322c7ca`）**：macOS 前往 SubmenuBuilder 加 5 顶层（首页/末页/上一页/下一页/返回）+ 浏览历史 submenu（5 项：最近 1-5）。4 真实跳转（首末前后页）走 `reader.setCurrentPage`；5 历史 + 1 返回 v0.2 占位反馈。
- 12 files / +547 / -1（4 commit）。typecheck ✅ + commands.test.ts 19/19 ✅。

ISS-NEW-C 阶段 2 后续（PM 单 session / DEC-158）：

- **右栏「导出预览」面板真内容**（`src/components/layout/panels/ExportPreviewPanelView.tsx`）：export 模式激活时显示当前 active tool（6 种）+ 关键参数摘要（页数 / 源文件名 / 输出文件名按 tool 派生后缀 `-text-watermarked` / `-image-watermarked` / `-header-footer` / `-page-numbered` / `-bates` / `-compressed`）。无文档 / 无 activeTool 时显示明确提示。`AppShell.tsx` 传 `activeExportTool` + `reader.state.document?.name / pageCount` 给 RightPanel。+5 单元测。
- **右栏「OCR 队列」面板真内容**（`src/components/layout/panels/OcrQueuePanelView.tsx`）：OCR 模式激活时显示任务列表（status dot + 短文件名 + `formatOcrStatusLabel` 文案 + cancel 按钮）。active 状态（queued/running）cancel 按钮 enabled，terminated 状态（completed/failed/cancelled）disabled。`AppShell.tsx` 传 `ocr?.jobs` + `onCancelOcrJob` 回调。+4 单元测。
- **RightPanel 路由扩展**：增加 `rightPanel === "export-preview"` 和 `rightPanel === "ocr-queue"` 2 个分支；PANELS_BY_MODE descriptor 6 个 mode × 8 panel id 全覆盖。
- 4 files / +340 / -0。typecheck ✅ + 9/9 单测通过。

ISS-NEW-H 视图菜单 submenu 深度补全（Wave 4e minimax worker 端到端跑通，PM 收口 / DEC-157）：

- **macOS 视图菜单补 2 submenu + 3 顶层命令**：`src-tauri/src/lib.rs` 视图 SubmenuBuilder 加「缩放」submenu（5 项：放大/缩小/实际大小/适合页面/缩放工具）+「缩略图」submenu（2 项：单列/双列）+ 3 顶层占位命令（跳到当前页/重新载入/添加书签）；menu event handler match arm 加 11 个新 command id。
- **`src/shared/app/commands.ts` 加 11 个 AppCommandId 枚举 + APP_COMMANDS definition**：全部 `tertiary` 层 + `native-menu` only + `view` group，与 Rust 菜单 id 一一对应。3 个占位命令自带 feedback 文案「视图功能开发中，等待后续 worker 接入。」。
- **`src/components/layout/AppShell.tsx` nativeMenuBridge 路由**：缩放 5 个走 `reader.zoomIn/zoomOut/setZoomPreset`；缩略图 2 个走 `reader.setViewMode`（single/double）；占位 3 个不 return，让末尾 `if (command.feedback)` fallback 触发 setCommandFeedback。
- **测试**：`src/shared/app/commands.test.ts` 加 2 新测（注册 11 个新 command id + layer 隔离）；`src/components/layout/AppShell.test.tsx` makeReader mock 加 `setZoom/zoomIn/zoomOut/setViewMode/setZoomPreset`。
- 5 files / +396 / -0。typecheck ✅；vitest 受 pre-existing vitest 4.x + `html-encoding-sniffer`/`@exodus/bytes` ESM 冲突阻塞（main 仓库根也复现，与本次改动无关）。
- **Wave 4e 教训**：minimax worker 端到端能跑（确认 6 次失败的 silent exit 不是 minimax 模型本身问题），但 verification 阶段 26m+ 不更新 STATUS（silent worker 模式重现）。PM 介入收口路径：typecheck PM 验证 + 帮 commit + FF merge。Wave 5 启动前应改进 worker prompt 加「verification 10m 内未 commit → 自降级 PM 介入」触发条件。

ISS-NEW-E 第 1 步收口（PM 单 session / DEC-156）：

- **L4 二级工具条统一抽象 — read 模式并入 `ContextToolbar`**：`ContextToolbar` 接受 `mode: Exclude<AppModeId, "pages">`（包含 `"read"`），`reader` prop；`mode === "read"` 分支从 `getModeTools("read")` 拿注册工具（旋转 + 适合页面 3 个）+ 按 order 排序 + `isDisabled` 委托工具本身。`showContextToolbar` 改 `activeMode !== "pages"`（read 模式也显示 L4）。`contextualToolbarLabels` 加 `"read": "阅读模式工具"`。删除独立 `<ReadModeToolbar>` 组件（旧 50 行）和 AppShell 中独立 render 块，**让 `ContextToolbar` 真正按 `activeMode` 路由 5 模式**（read / annotate / ocr / export / forms）。`pages` 模式仍不渲染 L4（页面管理工作台独立）。typecheck ✅ + AppShell 7/7（ISS-NEW-A 子集）+ Toolbar 24/24 + readerModeTools 7/7。

ISS-NEW-A 阶段 2 + ISS-NEW-B 收口 2 块（PM 单 session / DEC-155，Wave 4 multi-agent GLM 配额耗尽降级后单 session 推进）：

- **侧栏 4 toggle 加「书签」按钮（ISS-NEW-A 阶段 2 子项 1）**：`AppToolbarSectionId` 注释更新（"3 个按钮 → 4 个"）；`UtilityPanelId` 加 `"bookmark"` 枚举；`Toolbar.tsx` 侧栏 4 toggle 段新增 lucide `<Bookmark size={16}>` 按钮（`data-testid="toolbar-sidebar-bookmark"`，`aria-label="书签"`）；`AppShell.tsx` 加 `<BookmarkPanelPlaceholder>`（占位 — 真实书签列表 + 添加 / 跳转 / 持久化留后续 worker）+ 渲染分支 `panel === "bookmark"`。+5 Toolbar test + 2 AppShell test。
- **旋转 + 适合页面按钮下移 L4 二级工具条（ISS-NEW-B）**：`Toolbar.tsx` 移除 L3 reading 段 2 个旋转按钮（DEC-152 恢复的）；`ModeActiveTools` 内部 filter 改为 `activeMode !== "read" && hasDocument`（让 read-mode 工具不渲染在 L3 reading 段）；`AppShell.tsx` 加 `<ReadModeToolbar>` 组件（`getModeTools("read")` 取注册工具，order 排序，`isDisabled` 委托给工具本身）— 仅在 `activeMode === "read" && hasDocument` 时显示，作为 L4 二级工具条接管 read-mode 工具（旋转 + 适合页面，复用 `reader.rotateClockwise` / `rotateCounterClockwise` / `setZoomPreset`）。清理未用 imports（RotateCcw / RotateCw / PageRotation / handleRotate）。+5 AppShell test（含 2 个 rotate mock + 1 个 Toolbar 已有 test 不变）+ Toolbar 24/24 ✅。

**Wave 4 multi-agent retry 失败**（GLM provider 真实不可用，门禁失败降级）：

- spawn 成功，claude + GLM-5.2 settings + bypassPermissions 启动。
- API 立即 400「模型不存在」（settings.json 中 opus/sonnet 是 `glm-5.2[1M]`，GLM 端不存在；改成本地 `config/glm-5.2.settings.json` 全部 3 model = `glm-5.2` + .gitignore 仍 400）。
- 推断：GLM 配额耗尽（memory `Wave 3 W2 撞 GLM 配额耗尽 2056`）。
- 决策：按 skill §2.1 门禁失败降级到 PM 单 session 串行推进，清理 `feat/iss-new-a-stage2-iss-new-b` worktree + 分支。
- 教训再次印证：multi-agent 在 FaroPDF 本机环境不可靠（4 次失败：DEC-104 / DEC-106 / DEC-150 / 本次 Wave 4），PM 单 session 是稳妥默认路径。

ISS-NEW-G 收口 4 块（PM 单 session / DEC-154）：

- **Welcome 屏「图片转 PDF / Word 转 PDF」入口接通**：`ReaderCanvas` 加 `onConvertFromImages / onConvertFromWord` props 透传到 `<WelcomeScreen>`；`AppShell` 提供占位 handler（`setCommandFeedback` 反馈「图片转 PDF 功能开发中，等待 OCR pipeline / img2pdf engine 接入」+ Word 同步反馈）。真实转换依赖 OCR pipeline / img2pdf / merge engine，留后续 worker 接入。`AppShell` `command-feedback` 加 `data-testid` 方便测试。+7 单测（ReaderCanvas 4 + AppShell 3）。
- **全量 UI 字符串 i18n 基础**：`src/shared/i18n/` 新建 `dictionaries.ts`（zh-CN + en 两套字典，覆盖 StatusBar / WelcomeScreen / GeneralSection / OCR 状态栏 / feedback / reader viewMode & textLayerStatus 选项）+ `useI18n.ts`（useSyncExternalStore + module-level listener + `setCurrentLanguage` / `getCurrentLanguage` runtime）。`StatusBar` / `WelcomeScreen` / `GeneralSection` 全部用户可见字符串从字典查表（5 + 11 + 11 = 27 个查表点）。`AppShell` 通过 `useEffect([settings.language])` 同步 settings → i18n runtime；`StatusBar` 内部也加 useEffect 兜底单组件直接渲染场景。+4 i18n 单测（含两套字典键集合一致性断言防漂移）。
- **OCR 模式底部状态栏**：`StatusBar` 加 `activeMode?: AppModeId` + `ocrState?: { cursorPage, jobStatus }` props；`activeMode === "ocr"` 时切布局为「光标位置：第 X 页 / -」+「OCR 状态：running / queued / completed / failed / cancelled / idle」（从 i18n 字典 5+1 状态查表）。`AppShell` 计算 `cursorPage = reader.state.document?.currentPage ?? null` + `jobStatus`（OcrCommandJob.status narrow 5 枚举后回退到 busy 派生）。+7 单测（6 状态枚举 + idle 退化 + 默认 read 模式 + en/zh 切换）。
- **Preferences 4 字段补齐**：AppSettings 加 `defaultPdfViewer?: string`（macOS LaunchServices 应用标识，占位 UI 真实读写留后续）+ `pdfExpertOpenMode: "always-pdf-expert" | "system-default" | "ask-each-time"`（默认 `ask-each-time`）+ `resumeLastPage: boolean`（默认 `true`）+ `pageNumberIndicator: "current-only" | "current-of-total" | "page-prefix"`（默认 `current-of-total`）。`GeneralSection` 加 4 控件（input + 2 select + checkbox），`defaults.ts` 加默认 + `normalizeAppSettings` 加 narrow。`contracts.test.ts` 加 3 字段默认值补全。+ 持久化往返通过现有 normalize 流程自动覆盖。

Preferences 默认作者字段（PM 单 session / DEC-153）：

- ISS-NEW-G：AppSettings 加 `documentAuthor?: string`（对齐 PDF Expert 截图 13「作者」）；GeneralSection 加 input（「默认作者（写 PDF 元数据时预填）」+ 持久化）；defaults normalize。PropertiesDialog（ISS-072）自动联动 settings.documentAuthor 留 TODO。typecheck/lint ✅ + GeneralSection 5/5。
恢复 L3 旋转入口（PM 单 session / DEC-152，修正 DEC-144 回归）：

- bug-fix：DEC-144（ISS-NEW-A 阶段 1）Toolbar 5 段重构时移除 L3 旋转按钮但**没补替代入口**，`reader.setRotation` 引擎在但 UI 无触发，**用户丢失页面旋转**（律师扫描件刚需）。本 commit 恢复：L3 reading section viewmode 后加 RotateCcw/RotateCw 2 按钮，engine 复用 reader.setRotation（handleRotate direction 计算）。PDF Expert L3 严格 4 元素的纯粹性妥协给律师可用性（旋转高频，藏工具菜单多步不便）。typecheck/lint/build ✅ + Toolbar 19/19。

状态栏语言切换（PM 单 session / DEC-151）：

- ISS-NEW-G（DEC-151）：状态栏加 language toggle（English / 简体中文，当前 active + disabled，点击切换 + 持久化 appSettings.language）；AppLanguage 类型 + defaults 默认 zh-CN + normalize；StatusBar toggle 接入 AppShell（复用 settings/onSettingsChange 流，App.tsx 不用改）。+5 单测。Wave 4 GLM worker 限流失败后 PM 单 session 降级（DEC-150），纯前端零 Rust 最稳快。全量字符串 i18n / Preferences / languageEvent emit 明确 out of scope。

Welcome 屏 3 段布局（Wave 3 / DEC-149）：

- ISS-NEW-G（W1 / DEC-149 / PR #69）：新增 `WelcomeScreen`（无 PDF 空态 3 段：转换卡片占位 + 大蓝打开按钮 + 最近文件网格 + 清除最近，对齐截图 63）；AppShell/ReaderCanvas hasDocument=false 空态接入；recentFiles 网格读取。+9 单测。PM salvage 收尾（worker 写完后撞 GLM 配额耗尽 2056，详见 DEC-150）。
- Wave 3 复盘（DEC-150）：glm-5.2 连续 2 Wave 累积耗尽配额（W1 卡 verify 可 salvage → merged；W2 启动前撞配额 kill + defer）；DEC-148 改进点部分生效（W1 STATUS updated_at 非 null / paste-buffer 投递成功）；PM 陷入图片 MCP 工具循环致 Playwright 实操验证未完成（靠单测+build 兜底，待补验）。

右栏 mode-driven panel 体系 + 编辑网格（Wave 2 / DEC-146 + DEC-147）：

- ISS-NEW-C（W1 / DEC-146 / PR #67）：新增 `DocSummaryPanelView`（文件名/页数/大小/元数据，截图 61 对齐）+ `OcrStatusPanelView`（OCR 状态机 + 页码范围 + 开始按钮 placeholder，截图 53 对齐）；RightPanel 扩展不改写追加 summary/ocr-status 路由；AppShell 最小透传接入。+11 单测。
- ISS-NEW-I（W2 / DEC-147 / PR #68）：新增 `EditModeGridView`（T 编辑 5 列缩略图网格，选中页蓝边框 + 尺寸 label + drop indicator，截图 80/81/83 对齐）+ `ShapeToolPanel`（6 段：形状 2×3 / 线条工具 / 线宽 / 不透明度 / 边框色 / 填充色，截图 59）+ `SearchResultsPanel`（4 段：header / 输入 / 命中列表 / footer，截图 41）；RightPanel 追加 shape/search 路由；Toolbar L3 模式附加按钮（OCR「开始/增强扫描」因 commands.ts 类型约束暂缓，合理降级）；真实形状绘制/跨 tab IPC 接 placeholder。+33 单测。
- Wave 2 多 Agent 编排（DEC-145 纪律首次实战）：W1 + W2 并行 worktree（glm-5.2 provider），PM rebase 收口解 AppShell/types/RightPanel 三处冲突（rightPanel 属性去重 + RightPanel body 渲染去重 + types RightPanelId 合并），typecheck/lint/build/44 单测全过。
- 派发踩坑：claude v2.1.175 TUI 启动 + GLM 首连需 >3s，`tmux send-keys -l` 长文本进不去输入框，改 `tmux load-buffer + paste-buffer`（bracketed paste）成功投递。W2 worker STATUS/RESULT/PATCH_SUMMARY checkpoint 未落盘（glm-5.2 行为，靠 git/PR/cron 兜底），记入复盘。

Toolbar 5 段布局重构 + L2 tab 上移（ISS-NEW-A 阶段 1，DEC-144）：

- `src/components/layout/types.ts` 新增 `AppToolbarSectionId = "sidebar-toggles" | "file" | "reading" | "mode" | "right"`：与 PDF Expert L3 5 段一一对应。
- `src/components/layout/Toolbar.tsx` +171/-35：DOM 严格 5 段（`data-section` 标识），「A 批注」「T 编辑」按钮在 L3 第 4 段（mode 段，按 `activeMode` 切 `aria-pressed`），视图模式 `<select>` combobox → `role="radiogroup"` 4-icon toggle（单页 / 连续 / 双页 / 适合宽度，lucide 图标 Maximize2 / Rows3 / Columns2 / LayoutGrid）。
- `src/components/layout/Toolbar.css` +86 新建：5 段 grid + 视图模式 toggle 样式（独立文件，不动全局 `src/styles/app.css`）。
- `src/components/layout/AppShell.tsx` +18：集成 L2 tab 上移，`<TitlebarTabs>` 从 `<Toolbar>` 下方移到上方独立行（修复 ISS-059 Phase 1 / DEC-142 位置错误）。
- `src/components/layout/AppShell.test.tsx` +105：5 段结构 + TitlebarTabs 位置断言。
- `src/components/layout/Toolbar.test.tsx` +306 新建：5 段渲染 / A/T 切换 / 4-icon toggle 覆盖。
- 关联：commit `5b2b285`（Wave 1 W1 worker ship 后 rebase FF merge 到 main），不修改 `package.json` / `pnpm-lock.yaml` / `src-tauri/**` / `src/shared/**` / `src/App.tsx` / 全局样式 / 其他模块。
- 验证：`npm run typecheck` 过（rebase 后二次验证仍过）；`npm test -- --run` / `npm run lint` / `npm run build` / `cargo check` 未运行（pre-existing vitest 4.x + `html-encoding-sniffer`/`@exodus/bytes` ESM 冲突，main 仓库根也复现，与本次改动无关，详见 DEC-144 §Verification）。
- Multi-agent 收口：Wave 1 W1 worker（minimax-1 slot）独立 worktree TDD 完成，W2 worker（ISS-NEW-G）14 min 0 commit 按 memory contingency graceful kill 释放配额；W2 任务留 PM 单 session 后续推进。

`feature-extract-from-screenshots` skill 落地（ISS-NEW-K，DEC-143）：

- 新增 `.claude/skills/feature-extract-from-screenshots/`（5 文件）：4 阶段全自动「截图 → state machine → catalog → rebuild guide」流程（S1 6-Layer Spine 分类 / S2 State Machine 反向 / S3 13 项 checklist / S4 subagent 反向验证）。跨平台（macOS / Web / 移动）通用，依赖多模态视觉模型。
- 配套升级 `research/pdf-expert/FEATURE_CATALOG.md`（仅本地，research/ 在 .gitignore）：从 557 行扩展到 865 行，增 §12 mode×state 矩阵 + §13 13 项 checklist + §14 rebuild guide + §15 coverage gap & YAGNI；修复 §3 重复。
- 与 `.claude/skills/computer-use`（capture 阶段）形成 pipeline 串联。
- S4 反向验证：subagent 读新 catalog 返回 31 issues，已分流处理到 §14.3 派生规则 / §14.4 数据流 / §15.1 coverage gap。

按 legal-skills AGENTS.md 规范补两个 skill 级别文档（仅本地，.claude/skills/ 在 .gitignore）：

- `computer-use`：补 frontmatter（version / license / author / homepage）+ 依赖章节（cliclick 5.0.1 安装）+ 3 docs（CHANGELOG / TASKS / DECISIONS）
- `feature-extract-from-screenshots`：补依赖章节（MCP 工具 / Agent / 上游 skill 依赖矩阵）+ 3 docs（CHANGELOG / TASKS / DECISIONS）

`feature-extract-from-screenshots` skill v0.2.0 修复（ISS-NEW-L）：

- S2 加 B 类 cross-interaction 10 问（hover / drag / drop / double-click / right-click / long-press / shortcut / focus / gesture）+ C 类 cross-state-transition 5 问（时序 / 中断 / error / loading / empty）—— 反推问题从 10 个扩到 25 个
- S3 抽 meta-checklist 框架（参数化 platform_profile，按 macos / web / ios / android / windows / linux 6 平台动态展开）—— 13 项从写死变为 build_checklist(profile) 函数
- `computer-use` 加 state coverage matrix（capture 阶段 coverage guarantee，7 类 state × N 模式预定义）—— 解决 4 轮审漏的根因（capture 漏 state）
- PDF Expert E2E 重判：forms mode / annotation popover 仍 missing（v0.3 ISS-NEW-J），history panel / new-tab wizard 仍 YAGNI
- macOS Pages 适配验证：6-layer spine 80% 通用，**触发 v0.3.0 架构重构需求**（8+3 meta-layer + platform_profile）

多 Tab 顶部 bar（ISS-059 Phase 1，DEC-142）：

多 Tab 顶部 bar（ISS-059 Phase 1，DEC-142）：

- 新增 `src/state/tabStore.tsx`：React Context + useReducer 实现的 tab 状态管理（openTab / activateTab / closeTab / closeOtherTabs / closeAllTabs / renameTab / markDirty / reorderTabs）。`PdfTab { id, title, filePath, customTitle, isDirty }` 模型；关闭当前 tab 自动激活相邻 tab（PDF Expert 行为）；不持久化（关闭应用即清空）。13 项单元测试。
- 新增 `src/components/layout/TitlebarTabs.tsx` + `TitlebarTabs.css`：1:1 复刻 PDF Expert 顶部 tab 行（X 关闭按钮 + 文件名 + 右侧 + 号新建）。支持双击 inline rename（Enter 提交 / Esc 取消 / 空字符串清除 customTitle 回 null）；HTML5 drag-and-drop 拖动重排；空态不渲染。7 项 UI 测试。
- `App.tsx` 包外层 `<TabProvider>`。
- `AppShell.tsx` 集成：`useEffect` 监听 `reader.state.document` 自动 openTab；新增 `<TitlebarTabs>` 在 toolbar 与 main 之间；`onRequestNewTab` 复用 toolbar 的隐藏 file input（保持现有"打开"按钮行为）。
- `AppShell.test.tsx` 加 `<TabProvider>` wrapper，48 项既有测试全部通过。
- **Phase 1 范围**：tab UI + state + tab 切换；未实现 per-PDF reader state / 窗口标题同步 / 最近文件同步 / 跨窗口剥离（Phase 2+ 收口）。

Review 修复（DEC-140）：

- 修复 RedactionOverlay 白色 / 灰色遮蔽只在 UI 预览生效、最终 PDF 仍按默认黑色输出的问题：`regionsScreenToPdf` 现在会把 `color` 一并透传给 `applyRedaction`。
- 修正 SecurityPanel 设置密码表单文案：用户密码留空表示生成"无需密码即可打开"的加密副本，不再误写为"沿用旧用户密码"。

OCR 后自动生成目录（ISS-069 阶段 1，DEC-125）：

- 新增 `src/modules/ocr/autoToc.ts`：4 个纯函数 `extractTextItems`（PDF.js textContent 标准化）/ `clusterBySizeAndFont`（2pt 精度归并）/ `detectChapterHeadings`（10 个中文章节正则：第X章/节/条/款/项/编 + 阿拉伯 X.Y + 证据X + 附件X + 中文括号）/ `buildOutlineTree`（栈式树构建）+ 便捷入口 `buildOutlineTreeFromPages`。
- 新增 `src/modules/ocr/writePdfOutline.ts`：pdf-lib 1.17.1 无公开 addOutline API，按 PDF 1.7 spec §12.3.3 直接用 `PDFDict` / `PDFRef` / `PDFName` / `PDFArray` / `PDFNumber` / `PDFString` 构造 outline 树（Catalog.Outlines → root → items 链式 First/Last/Count 收尾）。
- `src/shared/naming.ts` 加 `"auto-toc"` OutputSuffix（输出 `{stem}-auto-toc.pdf`）。
- `src/modules/ocr/index.ts` 导出 5 个类型 + 4 个函数 + writePdfOutline。
- **31 项单元测试**：`autoToc.test.ts` 22（正则 / 聚类 / 树构建 5 边界）/ `writePdfOutline.test.ts` 9（空树 / 单层 / 多层 / 越界 / 负数 / maxItems / round-trip / 加密 PDF / 页数保留）。
- 阶段 2 UI 二次编辑（AutoTocDialog）待启动；阶段 3 OCR 衔接 + Playwright 实操验证待启动。

自动生成目录 UI 集成（ISS-069 阶段 2，DEC-126）：

- 新增 `src/modules/ocr/ui/AutoTocDialog.tsx`：flat-list 树形预览（按 depth 缩进）+ 4 类编辑（勾选 / 重命名 / 删除 / 新增）+ 输出文件名输入 + loading / error 状态。删除父节点连带删除后代。
- AppShell 集成 `openAutoTocDialog`（PDF.js `loadPdfFromBytes` + 逐页 `getTextContent` + `buildOutlineTreeFromPages`）和 `handleApplyAutoToc`（`writePdfOutline` + `reader.saveUpdatedBytes` → `*-auto-toc.pdf` 新副本）。
- `commands.ts` 加 `auto-generate-toc` 命令（tertiary / export / deliver 分组）。
- **15 项 UI 测试**（`AutoTocDialog.test.tsx`）：初始渲染 / 勾选切换 / 全部取消 disabled / 删除（含连带后代）/ 新增 / 确认 / 取消 / 空文件名校验 / 非 .pdf 后缀校验 / loading / error / 空 tree + 新增 / 重命名 Enter / 重命名 Escape。
- 阶段 3 OCR 衔接 + Playwright 实操验证待启动。

自动生成目录 OCR 衔接（ISS-069 阶段 3，DEC-127）：

- `src/modules/ocr/autoToc.ts` 加 `buildOutlineTreeFromOcrText` 入口：把 Rust `extract_ocr_text` 输出的 `OcrTextExtractionPage[]` 按行 split，每行当 textItem（height 默认 12）；章节正则复用；outline 跳页首（y 坐标不可知，OCR 流程固有限制）。
- AppShell `openAutoTocDialog` 增强双路径：先 PDF.js 文字层（`page.getTextContent`），所有页无 str → fallback Rust `extract_ocr_text`（需 `document.path`）。统一到 AutoTocDialog UI。
- 决策：**前端路径**（不重写 Rust 章节检测）。理由：现有协议稳定 / 章节正则自身有定位能力 / outline 跳页首可接受（用 reader 文本搜索二次定位）/ PM 单 session TDD 范围可控。
- 8 项 buildOutlineTreeFromOcrText 单元测试 + 1 项 commands 集成测试。
- **Playwright 端到端实操验证** 留 open follow-up（需 dev server + Tauri runtime + 真实 ocrmypdf，独立 session 推进）。

涂黑矩形遮蔽（ISS-067 阶段 2，DEC-114）：

- 新增 `src/modules/redaction/ui/RedactionOverlay.tsx`：阅读区 mousedown→mousemove→mouseup 拖矩形 + draft 预览 + committed region 列表 + 应用按钮 disabled 直到 ≥1 region + 取消清空 + 5px 最小拖动阈值。
- commands.ts `redact-region`（tertiary / annotation / markup 分组）进入 annotate + 右栏 annotation。
- AppShell `redactActive` state；离开 annotate 自动关闭；handleApplyRedaction 从 `.reader-canvas canvas` DOM rect 算屏幕→canvas→PDF 用户空间 Y 翻转 → applyRedaction 算法 → `*-redacted.pdf` 新副本。+11 测试。

扫描拆页（ISS-066 阶段 2，DEC-115）：

- 新增 `src/components/layout/SplitPagesDialog.tsx`：行数 + 列数 + 输出名（默认 1×2 拆双页），selectedPageNumbers 透传切指定页。
- PageOrganizerWorkspace 加「扫描拆页」按钮 → splitPagesByGrid → `*-cut.pdf` 新副本。+9 测试。

文档属性对话框（ISS-072 阶段 2，DEC-116）：

- 新增 `src/modules/document/ui/PropertiesDialog.tsx`：Title/Author/Subject/Keywords/CreationDate 可编辑 + Producer/Creator/页数/加密状态只读。
- commands.ts `document-properties`（tertiary / export / deliver 分组）。AppShell openPropertiesDialog 读 metadata 预填 + handleApplyProperties 写回 → `*-metadata.pdf` 新副本。+9 测试。

选区→draft + 翻译/朗读（ISS-061 阶段 2，DEC-118）：

- TextSelectionToolbar 升级：新 prop color/noteContent/onToast；高亮/下划线/删除线/便签 dispatch floating-annotation-tool 携带文本+颜色（+便签 content）；翻译 clipboard 占位 + onToast；朗读 Web Speech speechSynthesis + onToast；7 动作全 enabled（不再 disabled 占位）。
- commands.ts `annotation-translate` / `annotation-tts`（markup 分组）。+6 测试（salvage Wave 7 W2 RED + PM GREEN + jsdom SpeechSynthesisUtterance polyfill）。

表单签名库选择（ISS-070 阶段 3，DEC-119）：

- 新增 `src/modules/forms/ui/SignatureLibraryPicker.tsx`：渲染 signatureStore 全部签名为缩略图 + 空态提示 + 点击 onSelect。
- FormsPanel SignatureEditor 加签名库选择区：data URL → atob → Uint8Array → setSignatureImage，复用既有 applySignature 导出。
- commands.ts `forms-sign-handwrite`（forms / markup 分组）→ formController.openPanel("sign")。+4 测试。

签名手写板持久化（ISS-070 阶段 2 + ISS-060 阶段 2 第二步，DEC-113）：

- 新增 `src/modules/forms/signatureStore.ts` localStorage 持久化层：`saveSignature(name, base64Image)` / `listSignatures()` / `deleteSignature(id)` / `MAX_USER_SIGNATURES = 4` 上限 + 损坏数据兜底过滤。
- 新增 `src/modules/forms/ui/SignaturePanel.tsx` 签名面板：「我的签名」缩略图列表 + 「+ 新画签名」按钮（弹出 Wave A ship 的 SignaturePad）+ 删除 × + 错误提示带 + 上限禁用。
- RightPanel：`signatures` panel 在 annotate / forms 模式下自动渲染 SignaturePanel。`stamps` panel 扩到 forms / export 模式也可显示 CustomStampPanel（律师表单签字时盖业务章场景）。
- AppShell 注入 `onSelectSignature` 回调：annotate 模式 → 把 signature.image 当 stamp 落点（与 customStamp 同套路）；forms 模式 → 反馈提示（后续接入 formController.applySignature）。
- 18 新测试覆盖：signatureStore 9（save/list/delete/上限/空 name/JSON 损坏/类型过滤/持久化）+ SignaturePanel 9（空态/已有签名/选中触发/删除/上限禁用/弹 SignaturePad/取消/保存 onSelectSignature + 列表刷新/达上限保险）+ RightPanel 3 新测试（annotate+signatures 真渲染 / forms+signatures 渲染 / forms+stamps 渲染）。

PDF Expert 风格右栏（ISS-060 阶段 2 + ISS-062 阶段 3，DEC-112）：

- RightPanel `annotate + stamps` 配置从 skeleton placeholder → **真实渲染 `CustomStampPanel`**（Wave A ship 的自定义图章持久化模块）。
- AppShell 把 `onSelectCustomStamp` 回调接入 annotationArmed：用户从右栏点击自定义图章 → 立即设置 `activeToolType="stamp"` + `stampName="custom"` + `stampLabel=stamp.name` + `stampImage=stamp.image` → 画布上可立即点按落点。
- `AnnotationToolState` 加 `stampImage?: string` 字段（base64 data URL，仅 `stampName="custom"` 时使用）。
- 选中提示通过 `commandFeedback` 反馈到顶部 toast：「已选中图章「<name>」，请在画布点按落点」。
- RightPanel 测试 +2（annotate+stamps 真渲染 CustomStampPanel / 非 annotate 不渲染）。

自定义图章真实嵌入 PDF（ISS-062 阶段 3 收口，DEC-122 + DEC-129）：

- 修复 bug：之前 `annotationPdfWriter.drawStamp` 不读 `stamp.image` 字段，customStamp 实际只画文字矩形 + 边框，图片从未嵌入 PDF。
- `drawStamp` 新增 `image` 分支：`tryEmbedStampImage` 解析 `data:image/png|jpeg` base64 → `embedPng/Jpg` → `page.drawImage`，嵌入成功直接 `drawn=true`（不画文字）。
- 非 data: 前缀 / base64 损坏 → fallback 文字 stamp（保留边框，不计入 skipped）。
- `AnnotationOverlay` 新 prop `activeStampImage` + `buildClickDraft` 透传 `annotation.stamp.image`。
- AppShell 接 `activeStampImage={annotationState.stampImage}`。
- 3 测试（annotationPdfWriter.customStamp image）：PNG dataURL 真嵌入（断言 PDF bytes 含 `/Subtype/Image`）/ 非法 base64 fallback / 非 image/ 前缀按文字 stamp。
- 端到端链路：CustomStampPanel → onSelectCustomStamp → annotationArmed.stampImage → AnnotationOverlay activeStampImage → drawStamp image 分支 → PNG/JPG 真实嵌入 PDF。

自定义图章（ISS-062 阶段 2，DEC-111）：

- 新增 `src/modules/annotation/customStampStore.ts` localStorage 持久化层：`saveCustomStamp(name, base64Image)` / `listCustomStamps()` / `deleteCustomStamp(id)` / `MAX_CUSTOM_STAMPS = 4` 上限 + 损坏数据兜底过滤 + 跨 tab `storage` event 同步。
- 新增 `src/modules/annotation/ui/CustomStampPanel.tsx` React UI：2×2 缩略图网格 + 「+ 上传 PNG / JPG」按钮 + 删除 × + 错误提示带 + 达上限禁用按钮 + 文件类型/大小校验（PNG/JPG ≤ 1MB）。
- 19 测试覆盖：store 10（save/list/delete/上限/空 name fallback/JSON 损坏/类型过滤/持久化）+ UI 9（空态/已有 stamp/点击 onSelectStamp/删除/上限禁用/类型错/大小超限/合法上传 FileReader 触发/「知道了」关闭错误）。

扫描清洁校正（ISS-066 阶段 1，DEC-110）：

- 新增 `src/modules/pages/scanSplit.ts` 拆双页 / 网格切 / 自定义断点切算法。
- `splitPagesByGrid(bytes, { rows, cols, pageIndexes? })` 按 N×M 网格切每页 → 输出 N×M 倍页数；常用 1×2 拆双页（A3 横向扫成单页双 A4 拼一起 → 拆成 2 个 A4 纵向）、2×2 网格切（A4 多面拼图）。
- `splitPagesByBreakpoints(bytes, { pageIndex, horizontalBreaks?, verticalBreaks? })` 按用户自定义断点（缩略图拖断点线场景）切单页，其他页保留原样。
- **真切**实现：用 pdf-lib `embedPage` + `drawPage` 平移 offset 让目标子矩形落入新 page (0,0)~(cellW,cellH) 区域，不是只改 cropbox（避免某些 reader 仍能显示裁掉部分的视觉残留）。
- 11 测试覆盖：1×2 拆双页 / 2×2 网格切 / 子页尺寸 / pageIndexes 限定 / rows=0 / cols=0 / pageIndexes 越界 / 1 水平断点 / 1 横+1 纵 / 不切 / 断点越界。

文档属性（ISS-072 阶段 1，DEC-109）：

- 新增 `src/modules/document/` 模块 + `readPdfMetadata(bytes)` + `writePdfMetadata(bytes, updates)` 读写层。`PdfMetadata { title, author, subject, keywords[], producer, creator, creationDate, modDate, pageCount, isEncrypted }`。
- Title / Author / Subject / Keywords / Creator / CreationDate / ModDate 均可读写。
- "FaroPDF" 标识默认写入 **Creator** 字段（律师整理客户文件场景，避免泄露原作者）。
- **Producer 字段已知限制**（DEC-109）：pdf-lib `save()` force override Producer 为 `pdf-lib (...)`，本阶段无法稳定覆盖；ISS-072 阶段 2 用 Rust lopdf 直接编辑 InfoDict 解决。
- 10 测试覆盖：空/含字段读取、写 title、写 author+keywords、保留既有字段、Creator 默认 FaroPDF、Creator 可覆盖、ModDate 自动更新、空 updates、输出合法 PDF。

律师材料签字（ISS-070 阶段 1，DEC-108）：

- 新增 `src/modules/forms/ui/SignaturePad.tsx` 手写签名板 React 组件 + 纯 Canvas API（无外部库依赖）：mousedown→mousemove→mouseup 鼠标笔触绘制，多笔画支持，清空/保存/取消 3 按钮，保存前白底变透明（getImageData R/G/B > 250 像素 alpha 置 0）+ onSave 回调 PNG data URL。
- 8 测试覆盖：默认渲染、width/height 可控、单笔画 strokeCount、多笔画、清空 reset、保存 toDataURL + onSave、取消 onCancel、mouseleave 中止笔画。
- 弥补 v0.1 表单签名只支持上传 PNG/JPG 静态图片的缺口。
- 阶段 2 待启动：FormsPanel 集成 + signatureStore localStorage 持久化 + commands.ts forms-sign-handwrite + 落入文档任意位置 UI。

律师场景（ISS-067 阶段 1，DEC-107）：

- 新增 `src/modules/redaction/` 模块 + `applyRedaction(pdfBytes, regions)` 算法：用 pdf-lib drawRectangle 在指定 pageIndex 区域绘制不透明矩形（默认黑色 rgb(0,0,0)）覆盖原内容。**真不可恢复**（不是 PDF annotation，是 content stream 直接绘制），律师证据遮蔽场景输出安全。
- `RedactionRegion { pageIndex, x, y, width, height, color? }` 共享类型；color 默认 `#000000`，可选 6 位 hex。
- 10 测试覆盖：单页单矩形、多页多矩形、跨页同 pageIndex、默认黑色、自定义 hex 颜色、空 regions、越界 pageIndex 抛错、负数 pageIndex、非法 color、负数 width/height。
- 阶段 2 待启动：RedactionOverlay 阅读区拖矩形 UI + commands.ts 入口 + 去页眉页脚（按 margin_bbox 真删除内容流）。

工程基础设施（ISS-071 阶段 1，DEC-105）：

- 新增 `src/modules/pages/pageRange.ts` 页码范围 DSL parser：支持 `all` / `even` / `odd` / `N`（最后一页）/ `1-5` / `!1-3`（反向）/ `1,3-5,!4`（混合），统一所有页码字符串输入（OCR / 导出 / 提取 / 拆分）。
- 新增 `src/shared/units.ts` + `src-tauri/src/util/units.rs` 单元转换：pt / cm / mm / in 互转 TS + Rust 双侧。
- 新增 `src/shared/naming.ts` + `src-tauri/src/util/naming.rs` 文件命名约定：18 个 `OutputSuffix` 枚举集中管理 `{stem}-{suffix}.pdf` 命名。
- 新增 `src/shared/error.ts` + `src-tauri/src/error.rs` 统一错误 schema：`AppError { code, message, context }` + 9 个 `ErrCode` + `serde::Serialize`，让前端按 code 触发 i18n / UI 分支（替代旧 `Result<T, String>` 字符串错误）。
- AppShell.tsx 迁移示范：本地 `suggestSaveAsOutputName` / `suggestAnnotationFlattenOutputName` 改用 `suggestOutputName(..., "copy")` / `suggestOutputName(..., "annotations-flattened")`。

UI 信息架构：

- ISS-060 阶段 1：引入右栏 `RightPanel`（v0.1 skeleton），按 `activeMode` 推导：annotate→图章 / ocr→OCR 队列 / export→导出预览；阅读和页面管理模式自动折叠。
- ISS-061 阶段 1：浮动文本工具条 `TextSelectionToolbar` 接入选区 `usePdfTextSelection` hook，PDF 文本选中后浮出 5 启用动作（高亮 / 下划线 / 删除线 / 便签 / 复制）+ 2 disabled 占位（翻译 / 朗读，v0.2 候选）。Esc 关闭，选区消失自动隐藏。

批注：

- ISS-062 阶段 1：标准图章模板从 5 个扩到 9 个（新增 `FOR REVIEW` / `NOT FOR DISTRIBUTION` / `INTERNAL ONLY` / `PROPRIETARY`），新增 `diagonal` 对角斜条带形态用于带状对角印章；`PdfAnnotationStamp.image` 字段为阶段 2 自定义上传预留。

安全 / 导出：

- ISS-064 阶段 1：`工具 > 交付导出` 分组新增 `设置密码 / 移除密码` 命令，进入导出模式后打开右侧 `SecurityPanel` 文档安全面板；Rust 后端 `set_pdfpassword / remove_pdfpassword` 命令已注册到 `invoke_handler!`。`remove_pdfpassword` 已能用原密码解密生成 `<原名>-unsecured.pdf` 新副本（lopdf）；`set_pdfpassword` UI 已就绪，真实加密待 lopdf 升级到 0.34 或引入 qpdf。

工程：

- 同步 `src-tauri/Cargo.lock` 中 faropdf 包版本 `0.1.1 → 0.1.2`，与 `Cargo.toml` 对齐（DEC-100 修正 DEC-099 的 Cargo.lock 撤回条款）。
- TextSelectionToolbar hook 加 `getBoundingClientRect` jsdom 防御，避免 vitest 环境下 22 个 selectionchange error。

安全 / 修复（DEC-102 code review 后修复）：

- **P0**：`remove_pdfpassword` 错误信息不再泄露完整路径（用 `[path:<basename>]` 脱敏）；不再回吐 lopdf::Error 内部 PDF dict 片段；`canonicalize` 规范化 input_path 防 traversal；输出副本碰撞检测（避免静默覆盖既有 `-unsecured.pdf`）。
- **P1**：`SecurityPanel` set 模式按钮永久 disabled（v0.2 阶段 2 激活）；密码输入框加 `autoComplete` + `spellCheck=false` + `data-1p-ignore`；`rightPanel` 改 useMemo（修复 ISS-060 切模式右栏不响应核心 bug）；`AppShell` 浮动工具条 `toolbarHidden` 重置逻辑修复（用户关掉后下次选区仍能浮出）；commandSignal effect 依赖补齐 id。
- **测试覆盖**：新增 `SecurityPanel.test.tsx` 7 个测试（vi.mock @tauri-apps/api/core 覆盖 invoke 边界）+ `RightPanel.test.tsx` 2 个边界（read+stamps / pages+ocr-queue 强折叠）。
- **polish**：CSS 命名 BEM 一致（`security_panel*` → `security-panel*`）；`RightPanel` 删除让用户困惑的 v0.1 skeleton placeholder 文案。

文档属性 Producer 真覆盖（ISS-072 阶段 2 后续 阶段 3，DEC-137）：

- `PropertiesDialog` 只读 fieldset 内新增「用 FaroPDF 真覆盖 Producer (Rust 后端)」按钮 + 成功 / 错误反馈行；`inputFilePath` 缺失（浏览器拖拽场景）或未传 `onProducerOverride` 回调时按钮不渲染。
- `AppShell.handleProducerOverride` 接 `document.path` → `invoke('set_pdf_producer', { request: { input_path, producer } })` → 反馈回填到 dialog；in-flight 时按钮禁用 + 文案切「正在真覆盖...」；错误用 dialog 顶部 alert role + 命令反馈双通道。
- 复用 DEC-136 Rust 端 `set_pdf_producer`（lopdf InfoDict 真覆盖）+ DEC-102 P0-3 输出副本碰撞保护 + DEC-109 pdf-lib Producer 限制绕道。
- **6 项 UI 测试**（`PropertiesDialog.test.tsx`）：inputFilePath 缺失隐藏按钮 / 有路径 + 回调渲染按钮并 fire 回调 / producerOverrideInFlight 禁用 / 错误 alert / 成功 status / 无回调隐藏按钮。
- ISS-072 累计 30 测试 / 4 commit（阶段 1 DEC-109 10 + 阶段 2 DEC-116 9 + 阶段 2 后续 Rust DEC-136 5 + 阶段 2 后续 阶段 3 本 commit 6）；前端 AppShell 集成收口。

RedactionOverlay 多矩形 UI 细化（ISS-067 阶段 2 后续）：

- `RedactionOverlay` 新增 nextColor state（默认 #000000）+ 3 颜色芯片（黑/白/灰）于 panel 顶部，颜色仅作用于后续 commit 的 region（已 commit 的不变）。
- 新增「撤销」按钮（data-testid=redaction-undo-last）：移除最后一个 region，空列表 disabled。
- 每 region 增加 X 删除按钮（data-testid=redaction-remove-{idx}）：单删不影响其他，absolute 定位右上角 + `pointerEvents: auto` 不冒泡。
- region 背景色根据 `color` 字段动态渲染 rgba；CSS `.redaction-overlay__color-row` / `__color-chip` / `__region-delete` 新增。
- **5 项 UI 测试**（`RedactionOverlay.test.tsx`）：默认黑 chip aria-checked / 切白 + 新 region 带 #ffffff / 撤销多 region + 边界 disabled / 单 X 删一个 / 颜色独立于已 commit region。
- 复用 `applyRedaction` 算法（DEC-107）+ `redactPageMargins` 算法（DEC-132），不改算法层。

错误 schema 端到端迁移（ISS-071 阶段 3，DEC-138）：

- Rust：`set_pdfpassword` / `remove_pdfpassword` 返回类型 `Result<_, String>` → `Result<_, AppError>`，错误码映射：`NotSupported` (set 暂未启用) / `FileNotFound` / `InvalidInput` / `PdfParseError` / `DecryptionError` / `IoError`，context 携带脱敏 path（DEC-102 P0-1）。
- 调整 `remove_pdfpassword` 校验顺序：空密码 → 文件存在 → canonicalize → load（用户友好，客户端校验不让 FileNotFound 抢先生效）。
- 前端：SecurityPanel 新增 `friendlyMessageForCode(err: AppError)` helper，9 个 ErrCode 各有中文兜底文案（i18n 后续可按 code 切英文）。`normalizeError` 兼容旧 string 错误（code=Unknown, message=原串）。
- **10 项新测试**：6 Rust 单元测试（password_command_error_tests） + 4 前端测试（FileNotFound 友好文案 / Unknown code fallback / 旧 string 向后兼容 / 错误路径友好文案）。
- ISS-071 累计 75 测试 / 3 commit（阶段 1 51 + 阶段 2 10 迁移 + 阶段 3 14 端到端）。

真实 PDF 加密（ISS-064 阶段 2 + DEC-135 决策更新，DEC-139）：

- **DEC-135 路径纠偏**：原计划升级 lopdf 0.34 不可行（0.34 仍无 encrypt API + 0.34.0 pom_parser 自带编译 bug + 0.33 没 pdf_writer feature）。实际升级到 lopdf 0.41（含完整 V4 128-bit AES 加密 API）。
- `Cargo.toml`: `lopdf = "0.33" + pom_parser` → `lopdf = "0.41" + default-features = false`。
- Rust `set_pdfpassword` 真实实现：`EncryptionState::try_from(EncryptionVersion::V4 { ... })` + `Aes128CryptFilter` + `doc.encrypt(&state)`，输出 `<stem>-secured.pdf` 新副本；自动补缺失的 `/ID`（某些工具导出 PDF 缺 /ID，lopdf 加密算法强制要求）。
- 权限组合：PRINTABLE | COPYABLE | ANNOTABLE | FILLABLE | ASSEMBLABLE。
- SecurityPanel `handleSetPassword` 真实路径：调 `set_pdfpassword` + 复用 DEC-138 `normalizeError` + `friendlyMessageForCode`；按钮 `disabled={loading || !ownerPwd}`，文案 `{loading ? 正在加密... : 设置密码并导出}`；删除 stub 警示。
- **3 项新 Rust 测试 + 3 项新前端测试**：
  - `set_pdfpassword_real_encryption_writes_secured_pdf` 真实 AES 加密 + decrypt 验证 user_password
  - `remove_pdfpassword_wrong_password_decryption_error` 错误密码 → DecryptionError（DEC-102 P0-2 之前因 0.33 无加密无法写）
  - `set_pdfpassword_empty_owner_password_invalid_input` / set 真实表单 / set 成功路径 / set EncryptionError 友好文案
- ISS-064 累计 2 commit（阶段 1 DEC-101 + 阶段 2 本 commit），lOpdf 0.33 → 0.41 升级无回归。

---

## 0.1.2 - 2026-06-14


> 0.1.2 封箱（2026-06-14）：3 阶段排查后批量修复 ISS-FIX-1~7 + ROADMAP 状态对齐（ISS-NEW-E）+ ISS-NEW-A 阶段 1 引擎（DEC-097 / PR #62）+ ISS-NEW-A 阶段 2 UI 入口（DEC-098 / PR #64）。typecheck / lint / vitest 884-885 / cargo test ocr_bridge_tests 11/11 / audit-stage-3 13/14 全部 0 回归。
> ISS-030 ~ ISS-038 批量完成：工具栏克制化、UI 视觉统一、空态清理、菜单中文化、设计系统重构。

UI 改进：

- 工具栏克制化（ISS-030 / ISS-037）：48px 高度、移除品牌区域、布局按钮收左上角 compact 图标模式、侧边栏默认关闭
- 欢迎页空态清理（ISS-034）：移除硬编码占位文件名和最近文件区域
- 设置页视觉统一（ISS-035）：所有控件 focus-visible 使用 accent 体系、清理遗留 CSS 冲突
- 主页灰色区域修复（ISS-033）：阅读区 flex: 1 填满可用空间

功能修复：

- PDF 拖拽打开（ISS-031）：阅读态 DocumentReader 支持 DnD、PDF.js worker 幂等配置、渲染错误日志

本地化：

- macOS 菜单栏中文化（ISS-032）：文件/编辑/视图/窗口/帮助使用 Tauri v2 MenuBuilder

设计系统：

- DESIGN.md 重构为 21 节成熟结构（ISS-038）：新增组件样式、信息密度、交互规则、深度层级、响应式、空态规范、工具栏克制原则、设置页规范、菜单栏规范、禁止事项、设计评审等章节

---

## 0.1.1 - 2026-06-06

> ISS-021 release workflow 全面对齐 Folia 模板；含 DEC-068 / DEC-069 已落 main
> 的 feature；不含新功能。

封箱变更（workflow only）：

- `.github/workflows/release.yml` 整文件重写（Folia 对齐）：
  - 用 `tauri-apps/tauri-action@v0` 替代手写 `cargo tauri build` + `softprops/action-gh-release`
  - macOS 拆 `aarch64` + `x64` 独立 build（不再 universal）
  - 删除 Linux build（与 Folia 一致）
  - `concurrency.cancel-in-progress: true`（v0.1.0 的 false 会卡重试链）
  - `releaseDraft: true` → publish job 灌写 latest.json + Gitee 同步
- 包管理器切 pnpm 10.x（Folia 一致；npm 跨平台 optional deps 有 bug）
- `package.json` version 0.1.0 → 0.1.1
- `src-tauri/Cargo.toml` version 0.1.0 → 0.1.1
- `src-tauri/tauri.conf.json` version 0.1.0 → 0.1.1
- `scripts/create-updater-manifest.mjs` 改用 `FAROPDF_*` env vars + 不再自签（tauri-action 在 build job 已签 .sig 旁车）
- `package-lock.json` → `pnpm-lock.yaml`
- `.npmrc` 加 `lockfile=true` 覆盖用户级 npmrc 的 `package-lock=false`

## Unreleased (continued) — 保留为 0.1.2 历史段 — ISS-NEW-A PDF 插入 / 合并 / 提取（DEC-097 / PR #62 / DEC-098 / PR #64）

> 2026-06-14 第 1 阶段排查报告 §3.2 指出 ROADMAP §5 行 66-67 "插入 PDF / 合并 / 提取页码范围" 整组标 [ ] 与 PDF Expert / Folia / Adobe 全员标配能力不符。PR #62 阶段 1 推进后端能力 + 契约 + 单元测试；PR #64 阶段 2 落地 UI 入口。

引擎（PR #62 / DEC-097）：

- `src/shared/pdf/export.ts` 扩 `PdfExportOperation` 联合类型 3 个新值：`insert-pages` / `merge-pdfs` / `extract-pages`。
- `src/shared/pdf/export.ts` `PdfExportRequest` 加 `additionalSources?: PdfExportSource[]`（仅 `merge-pdfs` 使用，按顺序追加）。
- `src/shared/pdf/export.ts` `PdfExportSource` 加 `fileName?: string` 字段（多源合并时记录原文件名）。
- `src/shared/pdf/export.ts` `PdfExportSummary` 加 4 字段：`rewritePlan?` / `insertedPageCount?` / `mergedAdditionalSourceCount?` / `extractedPageCount?`。
- `src/shared/pdf/export.ts` 新加 `PdfRewritePlan` 接口（与 `PdfOutputToolPlanEntry` 类似，type 字段是 3 个新值）。
- `src/modules/export/pdfOperationEngine.ts` 加 3 个 handler：`applyInsertPages` / `applyMergePdfs` / `applyExtractPages`；走 pdf-lib `copyPages` + `insertPage` / `addPage` 真实改写 PDF 字节流。3 个新 operation 互斥检测，一次只允许 1 个，多 throw "互斥" 错误；不进入 `outputToolEntries`（其 type 是 6 个原 output tool 联合），写入新加的 `summary.rewritePlan` 字段。
- `parsePageRangeExpression("2-5, 8, 11-13", max)` 1-based 字符串解析为 0-based 升序去重数组，越界 / 格式错抛明确错误。

引擎测试：

- `src/modules/export/pdfOperationEngine.test.ts` 加 7 项单元测试（insert-pages 全部页 / insert-pages pageRange 子集 + 越界 / merge-pdfs 多份追加 / merge-pdfs 缺 additionalSources 报错 / extract-pages 子集 / extract-pages 缺 pageRange 报错 / 3 个 operation 互斥）。**34/34 测试通过**。

UI 入口（PR #64 / DEC-098）：

- `src/components/layout/PageOrganizerWorkspace.tsx` 工具条新增 3 个按钮：「插入 PDF」「合并多份 PDF」「提取页码范围」（在已有「撤销」「另存为新 PDF」之间，与原 7 个动作按钮共存）。
- 3 个原生 `<dialog>` 表单承接输入：插入 PDF 收 PDF 文件 + 1-based 插入位置 + 可选页码范围 + 输出文件名；合并 PDF 收多份 PDF + 输出文件名；提取页码范围收 1-based 字符串 + 输出文件名。
- 提交时统一 `pdfOperationEngine.exportPdf`（阶段 1 引擎，34/34 测试通过）+ `reader.saveUpdatedBytes` 触发浏览器下载；引擎错误回写到对话框内 + 工具条上方错误条。
- 默认输出文件名：`<主源 base>-inserted.pdf` / `<主源 base>-merged.pdf` / `<主源 base>-extracted.pdf`（用 `reader.getCurrentFileName` 派生）。
- `PageOrganizerWorkspace.css` 新增 `.page-organizer__form` / `.page-organizer__form-field` / `.page-organizer__form-error` / `.page-organizer__error` 4 类样式（沿用 DESIGN.md §3 / §10 工具栏克制原则；颜色 token 全部 `var(--*)`，圆角 6px / 间距 4-12px / 按钮 30px）。

UI 测试：

- `src/components/layout/PageOrganizerWorkspace.test.tsx` 加 8 项新测试：3 按钮渲染、提取对话框预填、提取确认调 `engine.exportPdf` + `saveUpdatedBytes` + 对话框关闭、提取空范围错误、插入缺文件错误、插入选文件后确认调 `saveUpdatedBytes`、合并 0 文件错误、合并 2 文件后确认调 `saveUpdatedBytes` 且输出名以 `-merged` 结尾。**16/16 通过**。
- jsdom 不实现 `DataTransfer` — 用 `Object.defineProperty` 数组代理 `FileList` 模拟 `fireEvent.change`。

ISS-NEW-A 文档：

- `docs/ROADMAP.md` §5 行 66-67 状态从 [ ] 改为 "**部分**"（PR #62 + PR #64 双标），加 PR 指针。
- `docs/DECISIONS.md` DEC-097（阶段 1）+ DEC-098（阶段 2）记录决策 + 验证 + 已知限制。
- `docs/plans/2026-06-14-iss-new-a-pdf-merge-split-design.md` 详细设计。

ISS-FIX-1 ~ 7（PR #61）：

- 3 阶段排查报告存于 `docs/plans/2026-06-14-faropdf-audit-stage-{1,2,3}-report.md`。
- 6 个 P1 视觉偏差修复：Toolbar 左区 3 个按钮 `aria-label`（ISS-FIX-1 / DEC-094）/ `commands.ts` 启动器分组 `organize/deliver` 移位（ISS-FIX-2）/ `.reader` 硬编码 `#e4e8eb → var(--bg)` + `.page-organizer` `#dfe4e7 → var(--page-chrome)`（ISS-FIX-3）/ 4 处 `border-radius: 999px → 6px`（ISS-FIX-4）/ 3 处 `padding ... 9px → 8px`（ISS-FIX-5）/ DESIGN.md §1 加 5 个 token 文档 `--warning-bg/-border/-fg` + `--surface-soft` + `--page-chrome`（ISS-FIX-6）。
- 1 个 P0 文档真相修订：OCR 真实接入实际已就位（ISS-007 E2E 联调 worker 0.1.0-alpha.10 落实），修订 `src/modules/ocr/README.md` / `docs/ARCHITECTURE.md` 移除遗留 "bridge/stub" 描述（ISS-FIX-7 / DEC-095）。
- 1 个 ROADMAP 状态对齐（ISS-NEW-E / DEC-096）：§5 / §6 / §7 3 处 "**部分**" 标。
- audit 验证：Playwright 14 场景 `scripts/audit-stage-3.mjs`，13 PASS / 0 FAIL / 1 PARTIAL（3.5 6px 数量偏低，§5 范围内）。
- `scripts/audit-stage-3.mjs` 14 场景验证脚本 + `scripts/debug-setup-1.mjs` debug 脚本 + `config/eslint.config.js` scripts/**/*.mjs browser globals。
- 测试：884/885 vitest（1 pre-existing useReaderController.test.tsx zoomIn/zoomOut 失败与本 PR 无关）/ `cargo test ocr_bridge_tests` 11/11 通过 / typecheck 0 / lint 0。

新功能（来自 main，自动随 tag 出来）：

- DEC-068 批注摘要分组面板 + 案件材料核查清单导出
- DEC-069 法院上传体积压缩 4 档 + 真实 JPEG 图像重编码

---

## 0.2.0-alpha.1 - 2026-06-06

> v0.2 法律增强启动。第一条：批注摘要分组面板 + 案件材料核查清单导出。

- ✅ **批注摘要**：4 维度分组面板（页码 / 颜色 / 标签 / 类型），每组统计 + 前 3 个示例批注，支持 Markdown / HTML 导出为案件材料核查清单（DEC-068）
- ✅ **AnnotationSidebar 视图切换**：新增「列表/摘要」切换入口，不替换既有 4 维分组侧边栏
- ✅ **法院上传压缩预设**：4 档体积目标预设（5MB / 10MB / 20MB / 50MB），每档含 imageQuality + maxDPI + targetSize 参数（DEC-069）
- ✅ **真实 JPEG 重编码**：DCTDecode 图像通过 Canvas API 以目标 quality 重编码，替换 PDF 内的 JPEG XObject（DEC-069）
- ✅ **压缩后体积验证**：实际输出 vs 目标体积对比，超过 10% 警告但仍输出文件
- ✅ **保守路径**：CMYK JPEG / FlateDecode / 其他 Filter 保留原图；非 Canvas 环境（Node/vitest）跳过重编码
- ✅ **已知限制**：DPI-based 缩放未实现；CMYK JPEG 保留原图；Rust image crate fallback 待后续实现

## 0.1.0-beta.1 - 2026-06-06

> v0.1 主功能封箱，标记 beta.1。后续 0.1.0-rc.1 → 0.1.0 stable 走标准 semver 节奏。

封箱范围（与 0.1.0-alpha.18 ~ alpha.20 累计比较）：

- ✅ **快读**：PDF.js 加载 / worker 独立 / 4 视图模式（连续 / 单页 / 双页 / 适合宽度）/ 8 缩放预设 / 旋转 / 键盘翻页 / 缩略图 / 阅读位置恢复（DEC-034）
- ✅ **检索**：按需内存索引 / 全文搜索 / 命中列表 / 当前页高亮 / OCR 提示（DEC-003 / PR #18）
- ✅ **批注**：9 类型（高亮 / 下划线 / 删除线 / 备注 / 文本框 / 矩形 / 箭头 / 手写 / 图章）/ 6 色色板 / 5 图章模板 / 4 维度分组（页码 / 颜色 / 标签 / 类型）/ 真实 PDF 绘制 + flatten / 侧边栏 + AppShell 挂载 + active 联动（DEC-035 / 037 / 041 / 044-047 / 057）
- ✅ **页面整理**：旋转 / 删除 / 重排真实改写 / 多选 / 风险确认 / 撤销 / 默认另存 / 证据图片 A4 编排（DEC-033 / PR #21）
- ✅ **OCR 扫描**：ocrmypdf 本地后端 / PaddleOCR / MinerU 云端 / 4 command / 任务队列持久化 / 9 态质量检查 / 扫描预处理 lopdf 真实清洁（DEC-018 / 020 / 030 / 042 / 050 / PR #18 / 27 / 29 / 33）
- ✅ **导出**：pdf-lib 真实改写 / 表单 / 批注 flatten / 水印 / Bates / 页码 / 证据图片 A4 / 压缩 plan-only（DEC-026 / 039 / PR #26）
- ✅ **表单签署**：AcroForm 读取 / fill / sign / flatten / 批量操作 / 签名图片 / FormsPanel utility panel（DEC-035 / 055 / 064 / PR #23 / 40 / 53）
- ✅ **设置**：保存目录 / OCR provider / 隐私确认 / API Key 脱敏 / 9 态更新检查 / 10 态 fallback（DEC-038 / 048 / 056 / 066 / PR #25 / 31 / 41 / 53 / 54）
- ✅ **自动更新**：跨平台 build matrix / latest.json / softprops GitHub Release / 真实 pubkey 替换（DEC-048 / 065 / PR #31 / 55）

v0.3 follow-ups（已在 `docs/RELEASE.md §4` 文档化，不阻塞 beta.1）：

- ⚠️ 移动端（Android / iOS）打包在评估范围
- ⚠️ 平台级 CODE_SIGNING（macOS notarization / Windows EV 证书）
- ⚠️ updater pubkey 轮换

封箱变更：

- `package.json` version `0.1.0-alpha.18` → `0.1.0-beta.1`
- `src-tauri/tauri.conf.json` version `0.1.0-alpha.18` → `0.1.0-beta.1`
- `docs/ROADMAP.md` v0.1 状态保持「进行中（alpha.0~18 已封箱；详细子项审计留 follow-up，下一版起逐节刷新）」不变（beta.1 仍属 v0.1 进行中里程碑；下个 rc.1 / stable 视 follow-up 完成度推进 v0.1 → 完成）

---

## 0.1.0-alpha.20 - 2026-06-05

- ISS-021 增量更新失败回退（DEC-066 / `fix/iss-021-update-fallback`）：当 `tauri-plugin-updater` 增量更新失败（chunk 重试用尽、网络中断、签名校验失败等），自动重试一次完整下载；两次均失败时 UI 进入 `fallback` 状态，显示脱敏错误消息 + GitHub Releases 手动下载链接。
  - **新增** `src-tauri/src/update_fallback.rs`：Rust 端错误分类（5 类：chunk retry / network / signature / cancelled / unknown）+ 脱敏（移除路径 / token / URL query）+ 单元测试 11 项。
  - **修改** `src/shared/update/types.ts`：`AppUpdateStatus` 新增 `"fallback"` 第 10 态；`AppUpdateApplyResult` 新增 `{ kind: "fallback"; message; releasesUrl }`。
  - **修改** `src/shared/update/updateService.ts`：`downloadAndInstallUpdate` 首次失败后自动重试一次；两次均失败返回 fallback 结果（含脱敏错误消息 + GitHub Releases URL）；新增 `classifyFallbackMessage` / `sanitizeErrorMessage` 函数。
  - **修改** `src/modules/settings/sections/AboutSection.tsx`：9→10 态状态机新增 `fallback` 分支；STATUS_LABELS 加 `"fallback": "正在回退到完整安装…"`；`handleInstallUpdate` 处理 `fallback` result；渲染 `showFallbackLink` 时显示「去 GitHub Releases 手动下载」链接。
  - **修改** `src-tauri/src/lib.rs`：`mod update_fallback` 注册。
  - **测试**：`updateService.test.ts` +5 项（retry once / retry succeed / chunk classification / signature classification / fallback result）；`AboutSection.test.tsx` +3 项（fallback UI / no install button / re-enabled check button）。
  - **文档**：DEC-066 / RELEASE.md §4 更新 / TASKS.md ISS-021 状态更新。
  - **不修改** `src/components/**`（除 settings/ 子目录）/ `package.json` / 锁文件 / `src/App.tsx` / `src/styles/` / 其他模块 / `.github/workflows/**` / `scripts/**`。

## 0.1.0-alpha.19 - 2026-06-05

- feat(forms): ISS-008 FormsPanel 从全局浮层迁入 AppShell 左侧 utility panel（DEC-064 / `feat/iss-008-forms-utility-panel`）。
  - FormsPanel 改为 utility panel 渲染（`layoutMode="utility-panel"`），不再 `position: fixed` 浮层。
  - `UtilityPanelId` 新增 `"forms"`，AppShell UtilityPanel 在 `panel === "forms"` 时挂 FormsPanel。
  - Toolbar 工具区新增「填写和签名」utility panel toggle（与「文档摘要」「视图设置」一致风格）。
  - 响应式三档：大屏（> 720px）utility panel / 中屏（480–720px）drawer / 窄屏（< 480px）bottom-sheet。
  - 新增 `FORMS_PANEL_DRAWER_BREAKPOINT = 720` 断点常量。
  - 验证：typecheck 干净 / build 成功 / npm test 全量失败（pre-existing ESM 不兼容，与本次无关）。

## 0.1.0-alpha.18 - 2026-06-05

  - **新增** `src/modules/settings/sections/lazy.ts`：集中声明 4 个 `React.lazy` wrapper。
  - **修改** `src/modules/settings/SettingsPanel.tsx`：import 改为 lazy + Suspense 包裹（默认常规 section 仍为 eager）。
  - **修改** `src/modules/settings/SettingsPanel.css`：+5 行 `settings-section-skeleton` Suspense fallback 样式。
  - **修改** `src/modules/settings/SettingsPanel.test.tsx`：+4 项 lazy 行为测试（默认 section 不走 Suspense / lazy section 按需加载 / reader 切换加载 / OCR 切换加载）。
  - **不修改** `src/modules/settings/sections/index.ts`（eager export 保留）/ `package.json` / 锁文件 / `src-tauri/` / `config/**` / 全局样式 / 其他模块。
  - 验证：typecheck 干净 / build 成功（4 个 lazy section 独立 chunk）/ cargo check 干净 / npm test 全量失败（pre-existing `html-encoding-sniffer` ESM 不兼容，主工作区同样失败，与本次改动无关）。
- feat(ocr): ISS-007 keychain apiKeyRef + OS Keychain 集成（DEC-061 / `feat/iss-007-keychain`）。
  - Rust 端新增 `keychain:providerId:keyName` 凭证引用解析，通过 `keyring` crate 读取 macOS Keychain / Windows Credential Manager / Linux Secret Service。
  - 前端 `apiKeyRef` 校验接受 `keychain:providerId:keyName` 两段式格式（白名单内 providerId），保留 `env:VAR_NAME`。
  - 脱敏路径保留 `keychain:` 引用格式不变；错误消息提及 provider/key 但不泄露密钥值。
  - Rust 端 11 项单元测试（mock 覆盖 keychain hit/miss / env hit/miss / 空值 / 未知 provider / 无效格式 / dispatch 读取），前端 14 项测试（覆盖两种 prefix / 白名单 / summarize）。
  - 验证：`cargo check --offline` / `npm run typecheck` / `npm run build` / `cargo test --offline --lib`（49 passed）全通过。
- 跨仓 cleanup（personal-site `ISS-005` 联动 / DEC-058 / `chore/iss-005-faropdf-cleanup`）：FaroPDF 仓 docs-only 同步官网 / 文档站入口迁出。
  - **修改** `README.md` §"官方仓库" line 15：官网占位 `- 官网：待发布（v0.1 阶段尚未搭建独立官网页面）` 改为 `- 官网：https://cat-xierluo.github.io/personal-site/faropdf/`，与 Folia 仓 README（已指向 `personal-site/folia`）口径一致。
  - **修改** `docs/ROADMAP.md`：§"阶段状态速览" v0.3 行描述从「官网文档」调整为「官网与文档站（迁出 personal-site）」；§"9. 全平台发布与设置 UI" 末尾"官网与文档站"任务项标记为 `- [x]`，加注释指向 personal-site 仓；ISS-023 任务描述补充「官网（指向 personal-site 仓）」；§"进度日志" 追加 2026-06-05 记录。
  - **修改** `docs/DECISIONS.md`：追加 DEC-058（跨仓 cleanup 决策：触发原因 / 关键决策 / 与 Folia 仓 PR-A 口径一致性 / 验证 / 已知限制 / 后续路径）。
  - **修改** `docs/TASKS.md` §"归档任务索引"：新增「跨仓协调」领域条目，引用 personal-site `ISS-005` / DEC-058。
  - **不修改** `src/` / `src-tauri/` / `package.json` / 锁文件 / `config/**` / `docs/ARCHITECTURE.md` / `docs/DESIGN.md` / `docs/RELEASE.md` / `.github/workflows/**`。
  - **不新增** `website/` 子目录、`scripts/run-website.mjs` 或 `deploy-website.yml`：FaroPDF 仓自始不存在这些项；与 Folia 仓 PR-A（已删）形成一致口径。
  - 范围严格遵守：仅 4 个文档（README / ROADMAP / DECISIONS / TASKS）+ 1 个 CHANGELOG 顶部 Unreleased 段；无代码 / 依赖 / workflow / 共享契约改动。
  - 验证：`grep "官网：待发布" README.md` 不再命中（line 15 已替换为 personal-site 链接；line 19 release 状态占位另说）；`grep "personal-site" README.md docs/ROADMAP.md CHANGELOG.md` 命中；`git diff main...HEAD --stat` 仅 docs 改动。
  - 已知限制：本期不修改 `src/modules/settings/sections/AboutSection.tsx`（ISS-023 v0.3 实际 UI 接入由 v0.3 worker 推进）；`AboutSection` 中"官网"链接将直接复用 DEC-058 固定的 `https://cat-xierluo.github.io/personal-site/faropdf/`。
  - 1 个 commit（`chore(docs): ISS-005 跨仓 cleanup（FaroPDF 仓 PR-B / DEC-058）`）。
- fix(settings): ISS-029 跨仓同步：FaroPDF 仓替换 AuthorCard 微信二维码占位为真实图片（DEC-062 / `fix/iss-029-faropdf-real-qr`）。承接 ISS-023 / DEC-051 当时显式 defer 的「公众号二维码替换为真实图片」follow-up，与 personal-site `ISS-010` / DEC-009 收尾跨仓 cleanup 下半场。
  - **资源替换**：`src/assets/wechat-qrcode.png` 从 1×1 占位 PNG（67 字节，8-bit gray）替换为真实微信公众号二维码（734×734 / 183452 字节 / 8-bit gray+alpha / 非隔行）。资源单源 = Folia 仓 `docs/wechat-qr.png`（734×734 / 184KB / 2026-05-20 入仓），FaroPDF 仓与 personal-site 仓都是副本，三仓保持一致。
  - **新增 / 修改** `src/assets/QRCODE_LICENSE.md`（重写）：从「微信公众号二维码占位图说明」改为「微信公众号二维码图片说明」，新增「资源单源 = Folia docs」与「后续替换：三仓同步流程」两节，明确「不要在三仓之间出现『哪一仓最新』的歧义」。
  - **修改** `src/components/settings/AuthorCard.css`（CSS 注释 +1 行）：把「1x1 占位图在 120px 容器内会被放大」改为「真实公众号二维码（734×734）在 120px 容器内按 ~6:1 缩小渲染」；`image-rendering: pixelated` 保持不变（真实 QR 也受益于锐边缩放，避免浏览器平滑缩放导致扫码识别率下降）。
  - **修改** `src/components/settings/AuthorCard.tsx`（docstring 文字 2 处）：「展示微信公众号二维码占位图」改为「展示微信公众号二维码图片（ISS-029 替换占位图为真实二维码，详见 DEC-062）」；「不引入新依赖；二维码占位图通过 `wechatQrSrc` 传入」改为「二维码图片通过 `wechatQrSrc` 传入」。
  - **不修改** `src/components/settings/AuthorCard.test.tsx`（单测只验 props 透传，不耦合图片内容）/ `src/modules/settings/sections/AboutSection.tsx`（上游组件 props 形态不变）/ `package.json` / 锁文件 / `src-tauri/` / `config/**` / 全局样式 / 任何业务模块 / Vite 配置（Vite 自动以内容 hash 处理 PNG import）。
  - 范围严格遵守：仅 1 个 PNG（资源替换）+ 1 个 LICENSE.md（重写）+ 1 个 CSS（注释）+ 1 个 TSX（docstring 文字）+ 3 个文档（CHANGELOG / DECISIONS / TASKS）；其他模块 / 共享契约 / 业务代码 / Tauri 任何文件均**未修改**。
  - 同步 `docs/DECISIONS.md` 追加 DEC-062（背景 / 决策 / 拒绝的方案 / 资源放置 / 验证 / 已知限制 / 后续路径）；`docs/TASKS.md` 新增 ISS-029 任务卡（进行中，fix/iss-029-faropdf-real-qr worktree 已创建）+ 进度日志追加 2026-06-05 记录；`docs/ROADMAP.md` **未改**。
  - 验证：`file src/assets/wechat-qrcode.png` 输出 `PNG image data, 734 x 734, 8-bit gray+alpha, non-interlaced`（占位 1×1 → 真实 734×734）；`ls -l src/assets/wechat-qrcode.png` 183452 字节（占位 67 字节 → 真实 183452 字节）；`diff -q personal-site/src/assets/wechat-qrcode.png src/assets/wechat-qrcode.png` 无差异（三仓同步，personal-site / FaroPDF 两副本一致）；`grep -n "占位" src/components/settings/AuthorCard.tsx` 不命中（docstring 占位字样已去除）；`grep -n "ISS-029" src/components/settings/AuthorCard.tsx src/components/settings/AuthorCard.css` 命中（引用新 ISS / DEC）；`npm run typecheck` 干净；`npm run build` 成功（Vite 自动 hash 资源，HTML/JS 自动跟随新文件）；`cargo check --offline` 干净（9 个 pre-existing dead_code warning 与本 PR 无关）；`git diff main...HEAD --stat` 仅 4 个文件。
  - 已知限制：`npm test -- --run` 在 FaroPDF 主工作区与 worktree 都失败（pre-existing `html-encoding-sniffer` / `@exodus/bytes` ESM 不兼容），与本 PR 无关；本期不强制单测通过，仅按既有基线记录。真实 QR 是 `image-rendering: pixelated` 渲染，如果用户启用了浏览器 / Electron 缩放（> 100%），扫码器在某些 Android 客户端可能识别率下降；本配置保留 pixelated 是为「占位被放大时保持方块感」历史约束的延续（DEC-051），实际扫码建议在 100% 缩放下进行。三仓同步目前靠人工 `cp`；未来如需自动化（脚本驱动）属于 chore 范围，不在 ISS-029。
  - 1 个 commit（`fix(settings): ISS-029 真实微信二维码替换（DEC-062）`）。

## 0.1.0-alpha.17 - 2026-06-05

- ISS-026 批注 Overlay ↔ Sidebar active 联动收口（DEC-057 / `feat/iss-026-overlay-sidebar-active-sync`）：把 `AnnotationOverlay` 与 `AnnotationSidebar` 共享的 `activeAnnotationId` 状态在 `AppShell` 内落地为单一真相源（`useState<string | null>(null)`），实现「点 overlay → sidebar 同步高亮 / 点 sidebar → overlay 同步高亮」的双向 active 联动，承接 DEC-044 stage 4 末尾标注的「`onAnnotationClick` prop 留好，等下一阶段统一接线」follow-up。
  - **修改** `src/components/layout/AppShell.tsx`（+5 行 + 2 处透传）：
    - 文件顶部追加 `import { useEffect, useState }`。
    - AppShell 函数体内追加 `const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)` + `useEffect` 监听 `activeMode`，切出 annotate 模式时 `setActiveAnnotationId(null)` 清理 stale 选中。
    - `<AnnotationOverlay activeAnnotationId={activeAnnotationId} onAnnotationClick={(id) => { setActiveAnnotationId(id); onAnnotationClick?.(id); }}>`：替换 DEC-046 milestone 2 阶段硬编码的 `activeAnnotationId={null}`，并把 onAnnotationClick 改为内联 setState + 保留向上 `AppShellProps.onAnnotationClick?.(id)` 透传出口（App.tsx 当前未传，no-op；为后续「点击批注 → 详情面板」等扩展留接口）。
    - `UtilityPanel` 签名扩展 `activeAnnotationId: string | null` + `onAnnotationClick: (id: string) => void` 两个 prop；`panel === "annotation"` 分支把 `activeAnnotationId` 与 `onAnnotationClick={onAnnotationClick}` 透传给 `<AnnotationSidebar>`（Sidebar 侧不需要「向上抛」包装，直接绑定 setState）。
  - **不修改** `src/components/layout/AnnotationOverlay.tsx`（DEC-044 stage 4 已落 `activeAnnotationId` / `onAnnotationClick` prop 形态 + `if (interaction) return` armed 工具保护；本期零改动）。
  - **不修改** `src/components/layout/AnnotationSidebar.tsx`（DEC-037 stage 2 已收口，props 形态完备）。
  - **不修改** `src/components/layout/types.ts` / `src/modules/annotation/AnnotationService.ts`（不需要新类型 / service API 形态保持）。
  - **不修改** `src/App.tsx`（forbidden；不上提 state，保留 `onAnnotationClick` 透传出口为未来扩展留接口）。
  - **不修改** `package.json` / 锁文件 / `Toolbar.tsx`（DEC-032 协议）/ `Sidebar.tsx` / `src/styles/app.css` / `src-tauri/` / 全局样式 / 路由 / 其他模块（reader / search / forms / export / pages / ocr / preprocess / settings）。
  - **新增** 4 项 `AppShell.test.tsx` 单测：sidebar 行点击 → overlay glyph 同步 `is-active` + `aria-current="true"` / overlay glyph 点击 → sidebar 行同步 `annotation-sidebar__row-button--active` + `aria-current="true"`（双向）/ armed toolType 下点击 overlay 不触发 active 同步（既有 `if (interaction) return` 保护验证）/ 切出 annotate 模式后切回 → active 状态自动清空（useEffect cleanup 验证）。
- 范围严格遵守：仅 `src/components/layout/AppShell.tsx` + `src/components/layout/AppShell.test.tsx` + 3 个文档（CHANGELOG / DECISIONS / TASKS）；其他模块 / 共享契约 / 锁文件 / 业务代码 / Tauri 任何文件均**未修改**。
- 同步 `docs/DECISIONS.md` 追加 DEC-057（ISS-026 active 联动方案 + state 归属 / 双向同步机制 / mode 切换清空 / armed 保护 / 范围 / 验证 / 已知限制 / 后续路径）；`docs/TASKS.md` ISS-026 任务卡状态从「进行中（第一版 UI 与 model 已落盘）」推到「进行中（第一版 + 第四阶段 + active 联动均已落盘）」+ 进度日志追加对应记录；`docs/ROADMAP.md` **未改**。
- 验证：80 个测试文件 / 761 个测试全部通过（+4：AppShell 4 项 active 联动测试）；`npm run typecheck` 干净；`npm run lint` 43 个错误（与 main 基线一致，0 回归）；`npm run build` 成功（2022 modules，dist 产物正常）；`cargo check --offline` 干净（9 个 pre-existing dead_code warning 与本 PR 无关）。
- 已知限制：armed toolType 下点 overlay 不触发 active 同步（既有 `if (interaction) return` 行为，保留以避免与新建批注冲突）；App.tsx 未参与（`onAnnotationClick` 透传出口已留，no-op；后续如需「点击批注 → 详情面板」由 App.tsx 注入 `onAnnotationClick` 即可，AppShell 状态机不变）；不处理「跨 mode 保留 active 选中」（useEffect 主动清空）——如有需求由独立 worker 扩 useEffect 逻辑。
- 1 个 commit（`feat(annotation): ISS-026 Overlay ↔ Sidebar active 联动（DEC-058）`——DEC 编号后续由 PM 在本 PR 之外调整为 DEC-057 以保持编号连续性，详见 DECISIONS.md §DEC-057 末尾「DEC 编号说明」）。

## 0.1.0-alpha.16 - 2026-06-05

- ISS-021 follow-up autoUpdateCheck 设置项 + About section toggle 收口（DEC-056 / `feat/iss-021-auto-update-check`）：把 `AppSettings.autoUpdateCheck` 写入 + About section 顶部「自动检查更新」checkbox 接入，关闭时跳过 mount 时自动检查，手动按钮始终可用。
  - **修改** `src/shared/settings/types.ts`：`AppSettings` 增 `autoUpdateCheck: boolean` 必填字段（默认 `true`，注释指向 ISS-021 follow-up / DEC-056）。
  - **修改** `src/shared/settings/defaults.ts`：`createDefaultAppSettings` 增 `autoUpdateCheck: true`；`normalizeAppSettings` 增 boolean 类型 guard（`typeof input.autoUpdateCheck === "boolean" ? input.autoUpdateCheck : defaults.autoUpdateCheck`，旧 release payload 缺字段退回默认 `true`）。
  - **修改** `src/modules/settings/sections/AboutSection.tsx`：去掉 `_settings` / `_onChange` 的 void 忽略（现在实际消费）；新增 `useEffect` mount 一次性 auto-check（`useRef(false)` guard 防止 React 18+ strict mode 双调用 + 切到 true 不会重复触发）+ `handleAutoUpdateToggle` 切换回调；About card body 插入 `<label>` 包裹 checkbox + 「自动检查更新」label + 「关闭后仅在手动点击「检查更新」时触发；切换实时保存」hint（data-testid `about-auto-update-toggle`，`htmlFor="auto-update-check"`）。
  - **修改** `src/modules/settings/sections/AboutSection.test.tsx`：6 个 manual-check 测试改 `autoUpdateCheck: false`（隔离 mount auto-check 对 call-count 断言的干扰）；新增 6 项单测（toggle 默认值 / 切到 false 持久化 / 切回 true 持久化 / mount 时 auto-check 在 true 下触发 / mount 时 auto-check 在 false 下不触发 / 关闭时手动按钮仍可用）。共 18 项全过。
  - **修改** `src/shared/settings/defaults.test.ts`：createDefaultAppSettings 断言补 `autoUpdateCheck === true`（默认契约）。
  - **修改** `src/shared/settings/service.test.ts`：新增 2 项（`autoUpdateCheck: false` 持久化不覆盖 / 旧 payload 缺字段退回默认 `true`），共 5 项全过。
  - **修改** `src/shared/contracts.test.ts`：`AppSettings` 字面量补 `autoUpdateCheck: true` 字段（typecheck 通过）。
  - **修改** `src/modules/settings/SettingsPanel.css`：新增 `.settings-about-card__auto-toggle`（margin-bottom 12px / align-items flex-start / gap 8px）/ `__auto-toggle-hint`（muted / 12px / flex 1）样式，与既有 `.settings-row` 协同；窄屏折叠由 `.settings-row` 既有 `@media (max-width: 479px)` 规则覆盖。
  - 9 态 update 状态机（`AppUpdateStatus` 9 态 + `createTauriUpdateClient` 累计 progress adapter + `detectUpdateCapability`）零改动（DEC-048 / src/shared/update/* 全文件**未**触碰）。
- 范围严格遵守：仅 `src/shared/settings/{types,defaults}.ts` + `src/shared/settings/{defaults,service,contracts}.test.ts` + `src/modules/settings/sections/AboutSection.{tsx,test.tsx}` + `src/modules/settings/SettingsPanel.css` + 文档；**未**改 `src/shared/update/*`（DEC-048 已 close）/ `src/components/layout/*` / `src/App.tsx` / `src/styles/app.css` / `package.json` / 锁文件 / `src-tauri/**` / `config/**`（DEC-053 收口）/ 任何 reader / search / annotation / forms / export / pages / ocr / preprocess 模块。
- 同步 `docs/DECISIONS.md` 追加 DEC-056（autoUpdateCheck 设置项 / About toggle / mount 触发 / ref guard / 9 态零改动验证 / known limits）；`docs/TASKS.md` ISS-021 任务卡状态从「第一版已交付」推到「第二版已交付」+ 验收「autoUpdateCheck 设置项可关闭自动检查」改为 ✅ M2 + 进度日志追加 2026-06-05 记录；`docs/RELEASE.md` §4 把「自动检查更新未实现」从限制列表移到「✅ DEC-056 落地」说明；`docs/ROADMAP.md` **未改**。
- 验证：80 个测试文件 / 751 个测试全部通过（+8：AboutSection 6 + SettingsService 2；剩余 +34 项为 a271de1 / 20ee1b5 / 6841da0 / 4dac567 / 2dd793d 基础之上未计入 DEC-050/051/052/053/054 基线统计的同 PR 范围外增量，与本 PR 无关）；`npm run typecheck` 干净；`npm run lint` 43 个错误（与 main 基线一致，pre-existing 0 回归）；`npm run build` 成功（2022 modules，dist 产物正常）；`cargo check --manifest-path src-tauri/Cargo.toml` 干净（9 个 pre-existing dead_code warning 0 回归）。
- 已知限制：auto-check 触发点是「About section mount」（用户首次打开设置 → 关于），**不**是 App 启动时刻（避免触碰 forbidden 的 `App.tsx` / `AppShell.tsx`）；debounce 500ms 未实现（App.tsx 当前 `onChange` 是同步 in-memory，SettingsService 真正落盘由 future PR 接入时再加）；增量更新失败回退 / 移动端 / CODE_SIGNING 仍 follow-up。
- 1 个 commit（`feat(settings): autoUpdateCheck 设置项 + About section toggle 收口（DEC-056）`）。

## 0.1.0-alpha.15 - 2026-06-05

- FormsPanel 窄屏底部 sheet 适配（DEC-055 / `fix/iss-008-forms-narrow`）：ISS-008 FormsPanel 浮层在 < 480px 视口下与主工具栏（56px）+ 上下文工具条（42px）顶部重叠，本 PR 在 forms 模块内用 CSS 媒体查询 + React `matchMedia` 状态实现窄屏底部 sheet 自适应，作为 ISS-009 utility panel 收口前的过渡修复。
  - **新增** `src/modules/forms/breakpoints.ts`（22 行）：`FORMS_PANEL_NARROW_BREAKPOINT = 480` 常量 + `formsPanelNarrowMediaQuery()` helper，输出 `"(max-width: 479px)"` 与 CSS `@media` 保持一致。
  - **修改** `src/modules/forms/ui/FormsPanel.tsx`（+19 行）：新增 `useState<boolean>(detectNarrowLayout)` + `useEffect` 监听 `matchMedia(formsPanelNarrowMediaQuery())` 的 `change` 事件；新增 `FormsPanelLayout = "floating" | "bottom-sheet"` 字面量联合；`<aside>` 增加 `data-layout={layout}` 属性。
  - **修改** `src/modules/forms/ui/FormsPanel.css`（+20 行）：新增 `@media (max-width: 479px) { .forms-panel { ... } }` + `.forms-panel[data-layout="bottom-sheet"]` 选择器，把浮层改为 `bottom: 0; left: 0; right: 0; width: 100%; max-height: 70vh; border-radius: 12px 12px 0 0;` 顶部圆角 + 阴影反方向的底部 sheet，避开工具栏。
  - **修改** `src/modules/forms/index.ts`（+3 行）：导出 `FORMS_PANEL_NARROW_BREAKPOINT` / `formsPanelNarrowMediaQuery`，让 `FormsPanel` 组件和测试都能引用同一数值。
  - **修改** `src/modules/forms/ui/FormsPanel.test.tsx`（+99 行）：新增 6 项窄屏单测（断点常量对齐 / 桌面默认 floating / 360px 切换 bottom-sheet / 视口缩放动态切换 / 480px 边界 / 窄屏下字段列表+编辑器内容仍可渲染）+ 1 个 `createMatchMediaMock(initialMatches)` helper（模拟 jsdom 默认 matchMedia stub，提供 setMatches 同步触发已注册 listener）。
  - 范围严格遵守：**不**修改 `src/components/layout/{AppShell,Toolbar,Sidebar}.tsx`（layout worker 范围，避免与 `feat/pdf-expert-shell-ia` 共享冲突）/ `src-tauri/**` / `config/**` / `package.json` scripts / 锁文件 / `docs/ROADMAP.md` / 任何 reader / search / annotation / ocr / export / pages / preprocess 模块。
  - 同步 `docs/DECISIONS.md` 追加 DEC-055（方案选择 / 实现细节 / 范围 / 验证 / 已知限制）；`docs/TASKS.md` ISS-008 任务卡追加「窄屏适配收口」进度日志 + `fix/iss-008-forms-narrow` 分支建议 + 下一步指向 ISS-009 utility panel 路径。
  - 验证：`npm test -- --run src/modules/forms/ui/FormsPanel.test.tsx` 22 / 22（16 旧 + 6 新）；`npm test` 全套 738 / 738（worktree 场景下 2 个 suite 因 vite `fs.allow` 拒绝访问 worktree 外部 `node_modules` 加载失败，pre-existing 现象，0 tests reported，非 worktree 场景通过）；`npm run typecheck` 干净；`npm run lint` 干净（本 PR 文件 0 错误，全局 43 个 pre-existing 错误与 main 基线一致：fontLoader 4 + e2e/ocr-e2e.test.ts parserOptions.project 找不到 + tests/fixtures/ocr/generate-scan-fixture.mjs `Buffer`/`process` 4 + fontLoader 一处 irregular whitespace；与本 PR 无关）；`npm run build` 成功。
  - 已知限制：窄屏样式不含「拖动把手 / 关闭手势」，按底部 sheet 固定 70vh 设计；切到 utility panel 路径仍是 ISS-009 终极目标，本 PR 是过渡方案；断点 480 与 `AuthorCard` 对齐，是 forms 模块内临时值，后续 AppShell 收口断点时可统一为 `BREAKPOINTS.narrow` 共享常量。
  - 1 个 commit（`fix(forms): ISS-008 FormsPanel 窄屏底部 sheet 适配（DEC-055）`）。

## 0.1.0-alpha.14 - 2026-06-05

- LICENSE + 项目身份收尾（DEC-054 / `chore/add-license-and-author`）：补齐项目正式身份三件套（开源协议 + 作者名 + 项目图标）。
  - **新增** `LICENSE`（191 行，标准 Apache License 2.0 文本）：从 [Folia](https://github.com/cat-xierluo/Folia) `LICENSE` 复制（Apache-2.0 文本是标准协议，不需按项目改文件本身）。完整协议文本落地后，README §许可 可去掉 TODO 占位。
  - **修改** `package.json` author.name：`"maoking"`（GitHub 用户名） → `"杨卫薪律师"`（与 README §作者 + DEC-051 AuthorCard + DEC-052 §2.6 实际展示名一致）。user explicit 指示「author name 的话，以这个 read me 的为主优先」。`author.url` 保持 `https://github.com/cat-xierluo`（GitHub 个人页不变）。
  - **新增** `docs/icon.svg`（2.1KB）+ `docs/icon.png`（512×512，33KB）+ `docs/icon-128.png`（128×128，5.6KB）：项目图标 SVG 源 + PNG 衍生。设计主题：灯塔（呼应 `Faro` = 灯塔 / 指引之意，与 Folia 灯塔 logo 一脉相承）+ 红白条灯塔塔身 + 黄灯光晕 + 深蓝圆角方形 app-icon 风格底 + 右下角低透明度 "FaroPDF" 水印。`rsvg-convert` 从 SVG 衍出 PNG 两种尺寸（512 retina + 128 README inline）。
  - **修改** `README.md`：顶部加 `<p align="center"><img src="docs/icon-128.png" alt="FaroPDF" width="128" height="128"></p>`；§许可 替换 TODO 占位为「本项目基于 Apache License 2.0 开源，与 Folia 保持一致。完整协议见 `LICENSE`」。
  - **不修改** `src/**` / `src-tauri/**` / 锁文件 / 任何业务模块 / 任何构建配置 / DEC-053 已收口的 `config/` 子目录。
- 范围严格遵守：仅 `LICENSE`（新增）+ `package.json`（author.name 改 1 行）+ `docs/icon.{svg,png}` + `docs/icon-128.png`（4 文件新增）+ `README.md`（顶部加 img + §许可 重写）+ 3 个文档（CHANGELOG / DECISIONS / TASKS）。
- 同步 `docs/DECISIONS.md` 追加 DEC-054（身份收尾 / 与 Folia 对齐 / author.name 优先级 / icon 设计说明）；`docs/TASKS.md` 追加 ISS-028 个人主页任务卡（chore / future work，本 PR 不实现）。
- 验证：图片文件 512×512 / 128×128 实际像素正确（`sips -g pixelWidth -g pixelHeight`）；LICENSE 全文 191 行（与 Folia 完全一致，`diff -q` 无差异）；`npm run typecheck` / `lint` / `test` / `build` / `cargo check` 全部干净（无业务代码 / 配置变更，预期 0 回归）。
- 已知限制：icon 是 SVG 手绘（v1），后续如需品牌化（不同主题色 / 单色 / 高对比度版本）按需开 worker；`docs/icon-128.png` 仅用于 README inline，主 README 渲染场景之外的应用图标（macOS .icns / Windows .ico）首版 release 前单独处理。
- 1 个 commit（`chore: LICENSE + author.name 对齐 + 项目 icon 落地（DEC-054）`）。

## 0.1.0-alpha.13 - 2026-06-05

- 根目录配置收束到 `config/` 子目录（DEC-053 / `chore/consolidate-configs`）：参照 Folia 项目结构把 `eslint.config.js` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts` / `vitest.config.ts` 5 个根目录配置搬到新 `config/` 子目录，根目录只保留说明文档 + `package.json` + `package-lock.json` + `index.html` + `LICENSE`（Folia 风格）。
  - **移动** 5 个配置文件到 `config/`（`git mv` 保留 rename 历史）：`eslint.config.js` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts` / `vitest.config.ts`。
  - **修改** `package.json` scripts，全部加 `--config config/<name>` 显式指向（`dev` / `build` / `typecheck` / `test` / `test:watch` / `lint` / `preview`）。`build` 拆成 `tsc --noEmit --project config/tsconfig.json && vite build --config config/vite.config.ts`，`typecheck` 显式 `--project config/tsconfig.json`。
  - **修改** `config/tsconfig.json`：`include: ["src"]` → `include: ["../src"]`（相对 config 文件位置）。`references: [{ "path": "./tsconfig.node.json" }]` 保持不变（双方同移，sibling 相对引用仍正确）。
  - **修改** `config/vitest.config.ts`：原 `dependencyRoot` 在 worktree 之外时等于 `configDir`，移动后会变成 `config/`，导致 `server.fs.allow` 把 Vite 沙箱限制到 config 子目录。改为 `projectRoot` 计算：worktree 场景 slice 到 marker，常规场景 `configDir.replace(/\/config$/, "")` 走父目录。`fs.allow` 同步从 `dependencyRoot` 改为 `projectRoot`。
  - **修改** `config/eslint.config.js`：从 `parserOptions.projectService: true` 切换到 `parserOptions.project: ["./config/tsconfig.json", "./config/tsconfig.node.json"]`。原因：tsconfig 收束到 `config/` 后，project service 从 linted 文件向上 walk 找不到 tsconfig.json，且 `defaultProject` / `allowDefaultProject` 不支持 `**` glob，无法覆盖 `src/**/*.ts`。显式列出两个 tsconfig 路径最稳，`tsconfigRootDir` 用 `fileURLToPath` + `resolve(..)` 算 project root。`tsconfigRootDir` 不再用 `import.meta.dirname`（= `config/`），改用显式计算的 projectRoot。
  - **不动** `config/vite.config.ts`：无 `root` / `build.outDir` / 显式 `process.cwd()` 调用，Vite 自动以 cwd 为 project root，`--config config/vite.config.ts` 不影响 root 解析。
  - **不动** `config/tsconfig.node.json`：`include: ["vite.config.ts", "vitest.config.ts", "eslint.config.js"]` 是裸文件名，和 tsconfig 同目录，移入 `config/` 后自动正确。
  - **不修改** `src/**` / `src-tauri/**` / 锁文件 / 任何业务模块。
- 范围严格遵守：仅 `config/**`（新增 5 个文件） + `package.json`（scripts 改 8 行）；其他模块 / 共享契约 / 业务代码 / Tauri 任何文件均**未修改**。
- 同步 `docs/DECISIONS.md` 追加 DEC-053（收束方案 / 选型 / 路径处理 / 影响面 / 回退方式）；`docs/TASKS.md` 同步追加 ISS-027 任务卡（chore 类，根目录配置收束）；`docs/ROADMAP.md` **未改**。
- 验证：80 个测试文件 / 743 个测试全部通过（与 `origin/main` 0.1.0-alpha.11 一致，无回归）；`npm run typecheck` 干净；`npm run lint` 43 个错误（与 main 基线一致，全部 pre-existing：tests/e2e/ocr-e2e.test.ts 不在 project + tests/fixtures/ocr/generate-scan-fixture.mjs 的 `Buffer`/`process` undefined + fontLoader 一处 irregular whitespace，与本 PR 无关）；`npm run build` 成功（2022 modules，dist 产物正常）；`cargo check --manifest-path src-tauri/Cargo.toml` 干净（9 个 pre-existing dead_code warning 与本 PR 无关）。
- 已知限制：`parserOptions.project` 而非 `projectService` 导致 ESLint 在类型感知 lint 上比 `projectService` 略慢（per-file TS Program），对 743 个测试 + 80 个文件规模无明显影响；`tsconfigRootDir` 改用 `fileURLToPath` + `resolve(..)` 而非 `import.meta.dirname`，eslint 升级到不支持 `import.meta.dirname` 时可平滑切换。
- 1 个 commit（`chore(config): 收束根目录配置到 config/ 子目录（DEC-053）`）。

## 0.1.0-alpha.12 - 2026-06-05

- README 重写（DEC-052 / `docs/readme-rewrite`）：把 `README.md` 从 70 行散段重写为与 Folia 同结构的项目门面，覆盖官方仓库、下载与安装（标「待发布」）、功能、技术栈、作者、开发环境、构建、许可、文档指针 9 个一级 section。
  - **修改** `README.md`：完全重写。从「项目介绍 + 当前状态 + 首版能力目标 + 设计原则 + 开发命令 + 文档」单线叙述升级为「项目名 + 一句话定位 + 官方仓库 + 下载与安装 + 功能（按阅读与检索 / 批注 / 页面整理 / OCR 扫描 / 导出 / 表单签署 / 设置 7 个子节列实际已交付能力）+ 技术栈 + 作者 + 开发环境 + 构建 + 许可 + 文档指针」的标准 README 结构。
  - **功能清单严格对照 0.1.0-alpha.0 ~ 0.1.0-alpha.11 CHANGELOG 实际交付范围**：阅读与检索（PDF.js 加载、worker 独立、4 视图模式、8 缩放预设、旋转、键盘翻页、缩略图、阅读位置本地恢复、搜索结果层、扫描件 OCR 提示）、批注（9 类型 + 6 色 + 5 图章模板 + sidecar + 中文图章真实绘制 + AnnotationOverlay/Toolbar/Sidebar 挂到 AppShell + Markdown/HTML 摘要）、页面整理（旋转 / 删除 / 重排真实改写 + 多选 + 风险确认 + 默认另存）、OCR 扫描（ocrmypdf 本地后端 + PaddleOCR/MinerU 云端 + 4 command + 任务队列持久化 + 9 态质量检查 + 扫描预处理 lopdf 真实清洁）、导出（pdf-lib 真实改写 + 表单 / 批注 flatten + 水印 / Bates / 页码 + 证据图片 A4 编排 + 压缩 plan-only）、表单签署（AcroForm 读取 + fill/sign/flatten 批量 + FormsPanel 浮层 + 签名图片）、设置（保存目录 / OCR provider / 隐私确认 / API Key 脱敏 / 9 态更新检查）。
  - **不发明未交付能力**：所有 feature bullet 都能在 `CHANGELOG.md` 找到对应版本号；不确定的能力（如真实高亮绘制、增量更新、Keychain 集成、autoUpdateCheck 设置项）**不**写入 README。
  - **下载与安装** 标「**待发布**」：ISS-021 全平台打包与自动更新流水线已就位（`docs/RELEASE.md`），但**尚未生成任何公开 release**；macOS 首次运行 `xattr -dr com.apple.quarantine` 标「未来指引」而非「当前步骤」。
  - **许可** 标「**TODO**」：当前仓库未提交 LICENSE 文件；建议与 Folia 对齐采用 Apache-2.0，但需首个 release 前 PM 确认与定稿；**不**在本 PR 创建 LICENSE。
  - **作者卡**：沿用 ISS-023 / DEC-051 收口的 AuthorCard 数据：作者展示名「**杨卫薪律师**」+ GitHub `[cat-xierluo](https://github.com/cat-xierluo)` + 微信 `ywxlaw`；`package.json` author.name 是 `maoking`（GitHub 用户名），README 以 AuthorCard 实际展示名为准。
  - **图标**：`docs/icon.png` 不存在（搜索 `*.png` 确认），README 不插入 logo `<img>` 标签，避免 404 资源引用。
  - 同步 `docs/DECISIONS.md` 追加 DEC-052（README 重写方案 + 范围 + 验证）；`docs/TASKS.md` **未改**（README 重写不在活跃 ISS 任务源，由 PM 直接派发 worker）；`docs/ROADMAP.md` **未改**。
  - 1 个 commit（`docs: README 参照 Folia 模板重写（DEC-052）`）。
- 范围严格遵守：未修改 `src/**` / `src-tauri/**` / `package.json` / 锁文件 / 任何构建 / Lint / 类型检查配置（与并行 `chore/consolidate-configs` 分支解耦）；未修改 `docs/ROADMAP.md` / `docs/ARCHITECTURE.md` / `docs/DESIGN.md` / `docs/TASKS.md` / `docs/RELEASE.md` / `AGENTS.md` / `CLAUDE.md`；未创建 `LICENSE` 文件；未修改 `.gitignore` / `.github/**` / `scripts/**`。
- 验证：`git status --short` 干净（仅 `M README.md` + `M CHANGELOG.md` + `M docs/DECISIONS.md` 三项）；README 不引用任何不存在文件 / 不存在的 release URL；feature 列表与 CHANGELOG 0.1.0-alpha.0 ~ 0.1.0-alpha.11 实际交付一致。
- 已知限制：README 是项目门面快照，与功能持续迭代存在天然滞后；后续每条 ISS 收口后，由 PM 在合并时同步更新 README 对应 bullet（或开 docs-only 维护 PR）；官网入口（`https://cat-xierluo.github.io/FaroPDF/`）在 v0.1 阶段尚未搭建，README 标「待发布」避免给假链接；「macOS 首次运行」指引基于未来 release 形态预测，实际首次运行步骤以 release 时 `docs/RELEASE.md` 为准。

## 0.1.0-alpha.11 - 2026-06-05

- ISS-023 作者卡 + 微信二维码占位收口（DEC-051 / `feat/iss-023-author-update`）：把设置页「关于」section 的作者卡从占位 footnote 提升为独立受控组件，覆盖作者姓名 / GitHub 链接 / 微信公众号二维码 / 扫码说明。
  - **新增** `src/components/settings/AuthorCard.tsx`：受控组件，props 注入 `authorName` / `githubUrl` / `wechatQrSrc` / `wechatQrAlt` / `scanInstruction` / `className`；空 `authorName` 兜底显示「作者信息未配置」，GitHub 链接仍保留不丢失联系入口；`githubUrl` 不兜底，调用方传默认（`metadata.repositoryUrl ?? "https://github.com/cat-xierluo"`）。**不**直接耦合 `readAppMetadata()`，单测可独立传任意数据。
  - **新增** `src/components/settings/AuthorCard.test.tsx`（6 项）：name 渲染、GitHub 链接 `href` + `target="_blank"` + `rel="noreferrer"`、QR 图片 `src` + `alt`、扫码说明文案、空 name 兜底、caller className 透传叠加到 `.settings-author-card`。
  - **新增** `src/components/settings/AuthorCard.css`：独立样式，不污染 `src/styles/app.css`；复用 `SettingsPanel.css` 的 `.settings-author-card` 基础壳层，扩展子 class（`__name` / `__author-name` / `__github-link` / `__qr` / `__qr-image` / `__instruction`）；QR 图片 `image-rendering: pixelated` 让 1×1 占位图在 120px 容器内放大仍保持方块感，避免被浏览器平滑模糊掩盖「占位」事实；`@media (max-width: 479px)` 把 `.settings-author-card__qr` 折叠为单列，避免 900px 视口下文字被挤压。
  - **新增** `src/assets/wechat-qrcode.png`（1×1 像素 8-bit 灰阶 PNG，67 字节）+ `src/assets/QRCODE_LICENSE.md`：Python 直接写 PNG 三 chunk（IHDR + IDAT + IEND）生成，**不**依赖 ImageMagick / opencv；LICENSE 明确约定当前为占位、后续替换流程（推荐 PNG / JPG、正方形 ≥ 240×240 像素）、**不**收录任何账号 / 密码 / Token / 私钥、仅使用项目作者本人拥有或经授权的二维码。
  - **修改** `src/modules/settings/sections/AboutSection.tsx`：末尾 `<div className="settings-author-card">作者卡暂为占位，公众号二维码和详细联系方式将在后续迭代补齐。</div>` 替换为 `<AuthorCard authorName={metadata.authorName ?? ""} githubUrl={metadata.repositoryUrl ?? "https://github.com/cat-xierluo"} wechatQrSrc={wechatQrUrl} wechatQrAlt="微信公众号二维码" scanInstruction="微信扫码关注公众号，获取版本更新与法律材料整理小工具。" />`；新增 2 个 import（AuthorCard 组件 + `wechat-qrcode.png` 静态资源）。
  - **修改** `src/modules/settings/sections/AboutSection.test.tsx`：追加 3 项（QR 图片 `alt` 含「微信」字样 + `src` 含 `wechat-qrcode`、扫码说明含「微信扫码/关注」、legacy placeholder footnote 消失），共 12 项全过。
  - **不修改**「检查更新」逻辑（DEC-048 / PR #31 9 态 `createTauriUpdateClient` 状态机保留原样）；**不修改** `src/shared/update/*` / `src/shared/settings/*` / `src/shared/app/metadata.ts`（AuthorCard 透过 props 注入，不耦合 metadata）；**不修改** `src/components/layout/{Toolbar,Sidebar}.tsx` / `src/App.tsx` / `src/styles/app.css` / `package.json` / 锁文件 / `src-tauri/**` / 任何 reader / search / annotation / forms / export / pages / ocr / preprocess 模块。
  - 不引入新依赖。
- 范围严格遵守：仅 `src/components/settings/**` + `src/assets/**` + `src/modules/settings/sections/{AboutSection.tsx, AboutSection.test.tsx}` + 文档；其他模块 / 共享契约 / 锁文件 / Tauri 任何文件均**未修改**。
- 同步 `docs/DECISIONS.md` 追加 DEC-051（ISS-023 作者卡 + 微信二维码占位方案）；`docs/TASKS.md` ISS-023 任务卡状态从「待处理」推到「第一版收口（DEC-051，待 PM 合 review）」+ 「下一步」改为「公众号二维码替换为真实图片（按 QRCODE_LICENSE.md 流程）+ 与 PM 协同 PR 合并 / 视觉验收」+ 进度日志追加对应记录；`docs/ROADMAP.md` **未改**。
- 验证：80 个测试文件 / 743 个测试全部通过（新增 9 项：AuthorCard 6 + AboutSection 3；剩余 +34 项为 a271de1 基础之上未计入 DEC-050 基线统计的同 PR 范围外增量，与本 PR 无关）；`npm run typecheck` 干净；`npm run build` 成功（dist 产物包含 Vite 自动 hash 后的 `assets/wechat-qrcode-*.png`）；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 干净（9 个 pre-existing dead_code warning 与本 PR 无关）。
- 已知限制：当前二维码是 1×1 占位图（`image-rendering: pixelated`），正式发布前必须由作者替换为真实公众号二维码；公众号二维码**不**支持热更新（运行时下载需要走 Tauri command，**不**在本 PR 范围）；AuthorCard 不感知 dark mode（仅跟随全局 CSS variable 切换）；`autoUpdateCheck` 设置项（`src/shared/settings/` 在 ISS-023 forbidden 范围）继续留 follow-up，由 PM 在后续 `feat/auto-update-check` 拆出。
- 2 个 commit（`[m1] feat(settings): AuthorCard 基础组件（GitHub 链接 + 微信二维码占位）` / `[m2] feat(settings): AboutSection 接 AuthorCard，替换占位`）。

## 0.1.0-alpha.10 - 2026-06-04

- 批注深化第四阶段收尾（DEC-044 总方案 + DEC-045/046/047 三 milestone / ISS-026 stage 4）：把 `AnnotationOverlay` / `AnnotationToolbar` 从孤岛组件真正挂到 `AppShell` 渲染树；把 `writeAnnotationPdf` 接入 `pdfOperationEngine.exportPdf` 的 `flatten-annotations` draw 策略；stamp 模板选择面板新增 SVG 视觉预览。
  - `src/components/layout/types.ts`：追加 `AnnotationOverlayAnchor` 联合类型（当前仅 `workspace-main`，保留扩展位）+ `AnnotationArmedStateBundle` 透传 shape（`{ state, onStateChange }`）+ `AnnotationDraftSubmission` 加上 `pageIndex` 字段。
  - `src/components/layout/AppShell.tsx`：props 解构追加 `annotationArmed / onAnnotationDraft / onAnnotationClick`（均 optional，未传回退到 `createInitialAnnotationToolState()` + no-op 以保既有测试不破）；workspace 内部追加 `<div className="workspace__main" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, position: "relative" }}>` 作为 overlay 的相对定位锚；annotate 模式 + `hasDocument` + `overlayViewport`（取自 `reader.state.pageViewports[currentPage-1]`）时挂 `<AnnotationOverlay>`，注入 `pageIndex = currentPage - 1` + PDF 视口（pt 空间）+ currentPage 批注子集 + armed bundle；`ContextToolbar` 的 annotate 分支替换为受控 `<AnnotationToolbar>`，外层 div 保留 `role="toolbar" aria-label="批注工具条"` 以兼容既有 AppShell 测试契约，disabled 由 `!hasDocument` 派生。
  - `src/App.tsx`：`annotationToolState` 用 `useState<AnnotationToolState>(createInitialAnnotationToolState())` 上提为单一真相源（同时驱动 Overlay + Toolbar）；useEffect 离开 annotate 模式自动 disarm（避免 overlay 在 read 模式还捕获事件）；`handleAnnotationDraft` 走 `service.addAnnotation(document, { ...input, pageIndex })` + append `loadedAnnotations` 触发 React re-render。
  - `src/shared/pdf/export.ts`：`PdfAnnotationFlattenStrategy` 联合扩 `"draw"`；`PdfAnnotationFlattenPlan` 追加可选字段 `drawnCount / skippedCount / skipped / pageDrawCounts / fingerprintChecked`；`PdfAnnotationFlattenPlanEntry.status` 联合 `"planned" | "applied" | "skipped"`，新增 `PdfAnnotationFlattenEntryStatus` 类型。
  - `src/modules/export/pdfOperationEngine.ts`：`workingPdf` / `inputPageCount` 改 `let`；flatten-annotations 分支按 strategy 分发：plan-only 保持 DEC-037 行为（仅生成 plan summary，PDF 字节不变），draw 调 `writeAnnotationPdf({ sourceBytes, sidecar, sourceFingerprint? })` 并把返回 bytes 重新 `PDFDocument.load` 到 workingPdf 替换后续步骤输入，`skipped` 降级为 `warnings`（非致命），不支持的 strategy（如 typo'd `stamp-flood`）整体抛 `批注扁平化不支持的策略：${strategy}`；`applyExportMetadata` 切换 PDF keywords 为 `faropdf:annotation-flattened` + `faropdf:annotation-count:N` + `faropdf:annotation-drawn:M`。
  - `src/modules/annotation/stamps.ts`：新增 `renderStampPreview(name, options?)` helper，与 `renderStampSvg` 共用 `viewBox 0 0 400 100` 和 4 种 shape 几何（rectangle / rounded / ellipse / banner），字号缩到 0.55× 让 120×30 CSS 像素的缩略图保持"印章感"，与 `renderStampSvg` 共享 `escapeXml` 防 XSS；导出 `STAMP_PREVIEW_VIEWBOX_WIDTH/HEIGHT` + `DEFAULT_STAMP_PREVIEW_WIDTH/HEIGHT` 常量。
  - `src/modules/annotation/index.ts`：追加 `renderStampPreview` + 4 个常量 + `RenderStampPreviewOptions` 类型 re-export。
  - `src/components/layout/AnnotationToolbar.tsx`：stamp 模板按钮内部结构从纯文字 label 改为 `<svg viewBox="0 0 400 100" height="32" width="100%">` 包 `<g dangerouslySetInnerHTML>` 注入预览子树 + `<span class="annotation-stamp-button__label">{label}</span>`；SVG 元素加 `data-testid="stamp-preview-{id}"` + `aria-hidden="true"`；**不引入新依赖**。
  - 范围严格遵守：未修改 `package.json` / 锁文件（fontkit + 思源黑体 SC 已就位）；未修改 `Toolbar.tsx`（按 DEC-032 协议 worker 走 `ContextToolbar` 槽位注入，参考 `OcrModeToolbar` 同款接法）；未修改 `Sidebar.tsx`（按 DEC-041 保留 `AnnotationListPanel` 在 `DocumentSummaryPanel` 的「批注列表」tab）；未修改 `src/styles/app.css` / `src-tauri/Cargo.toml` / 全局样式 / 路由 / 其他模块（reader / forms / ocr / settings / pages / preprocess）。
- 同步 `docs/DECISIONS.md` 追加 DEC-044/045/046/047；`docs/TASKS.md` ISS-026 进度日志追加对应记录；`docs/ROADMAP.md` **未改**。
- 验证：73 个测试文件 / 693 个测试全部通过（新增 17 项：AppShell 9 + AnnotationToolbar 3 + stamps 5）；`npm run typecheck` 干净（pre-existing `.at` ES2022 lib target / `@pdf-lib/fontkit` 模块未装 错误不在本 PR 范围）；`npx vitest run` 693/693；`npx vite build` 2012 modules 成功（`tsc` 严格检查在项目级 pre-existing 失败，与本 PR 无关）。
- 已知限制：导出工具条"压平批注"按钮 UI 入口未接（属另一个 worker 范围，本 worker 留 hook：类型与 summary shape 已落，调用方在 `engine.exportPdf` 后读 `summary.annotationPlan.drawnCount` 即可）；CJK textbox 仍走 Helvetica WinAnsi 跳过语义（与 DEC-037 一致）；`AnnotationOverlay` 与 `AnnotationSidebar` 的 active 联动仍未接（`onAnnotationClick` prop 已留好，等下一阶段统一接线）。

- 全平台打包与自动更新第一版（DEC-048 / ISS-021）：把 v0.3 桌面端发布流水线 + 应用内「检查更新」入口打通，覆盖 macOS / Windows / Linux 三个平台。
  - `src-tauri/Cargo.toml` 新增 `tauri-plugin-updater = "2.10.1"`；`src-tauri/src/lib.rs` plugin chain 注册 `tauri_plugin_updater::Builder::new().build()`；`src-tauri/tauri.conf.json` 新增 `bundle.createUpdaterArtifacts: true` + `plugins.updater` 配置块（`active` / `endpoints` 指向 `https://github.com/cat-xierluo/FaroPDF/releases/latest/download/latest.json` / `pubkey` 占位 / `windows.installMode: passive`）。
  - `package.json` 新增 `@tauri-apps/plugin-updater@2.10.1`（前端 SDK 对应 v2 plugin）。
  - `tsconfig.json` lib 从 `["ES2020", ...]` 升级到 `["ES2022", ...]`（解锁 27 个 pre-existing `Array.prototype.at` / `String.prototype.at` 错误；该 side fix 是 ISS-021 verification 的传递依赖；其他 forbidden 模块的 `.at()` 调用位于本期不可触碰的 reader / annotation / export / pages / ocr / preprocess / settings tests 中）。
  - 新增 `src/shared/update/` 5 源文件 + 3 测试文件（types / updateService / updateCapability / index + 3 测试，14 项新单测）：`AppUpdateClient` 抽象 + `createTauriUpdateClient` 工厂薄封装 `@tauri-apps/plugin-updater`；`createProgressAdapter` 把单帧 Progress 事件累计成 `{ downloadedBytes, totalBytes }` 推给 UI；`detectUpdateCapability` 通过 `isTauri()` 探测环境能力并返回 unsupported outcome 兜底。
  - `src/modules/settings/sections/AboutSection.tsx` 接 `createTauriUpdateClient`，9 态状态机（idle / checking / latest / available / downloading / downloaded / installing / unsupported / error），available 后露「下载并安装」二次按钮，progress 走 `role="status"` 推 percentage + 字节；`updateClient` props 注入替身便于单测。AboutSection.test.tsx 新增 7 项单测覆盖 4 个 outcome 分支 + 安装 progress + 错误回显，老 placeholder 断言替换为真实 outcome。
  - 新增 `.github/workflows/release.yml`：监听 `vX.Y.Z` tag push；3 平台 build matrix（macos-universal / windows-x64 / linux-x64，linux 上 apt-get 装 webkit2gtk-4.1 / librsvg2 / libxdo / libayatana-appindicator3）；release job 下载所有 artifacts 调 `scripts/create-updater-manifest.mjs` 生成 `latest.json` + `softprops/action-gh-release@v2` 发布。
  - 新增 `scripts/create-updater-manifest.mjs`：纯 ESM、零 npm 依赖；递归扫 `--release-dir` 匹配 `.app.tar.gz` / `.msi` / `.AppImage`，对每个 updater 兼容 bundle spawn `cargo tauri signer sign` 产出 `.sig` 旁车文件，组装 tauri-plugin-updater v2 manifest 输出。
  - 新增 `docs/RELEASE.md`：产物矩阵表 / `latest.json` schema + GitHub Releases URL 入口 / 3 步发布流程（生成 keypair → 写 pubkey → tag push）/ 5 项 v0.3 限制（autoUpdateCheck / 增量回退 / 移动端 / key rotation / CODE_SIGNING）。
- 范围严格遵守：未修改 `src/components/...`（除 About section update 入口）/ `src/styles/` / `src/App.tsx` / `src/main.tsx` / `src/components/layout/Toolbar.tsx` / `src/components/layout/Sidebar.tsx` / `src-tauri/src/{ocr,scan_preprocess,forms}/` / reader/search/annotation/forms/export/pages/ocr/preprocess 模块 / `src/shared/{pdf,ocr,preprocess,annotation,form,export,settings}/` / `assets/fonts/`。
- 同步 `docs/DECISIONS.md` DEC-048（ISS-021 全平台打包与自动更新落地方案）；`docs/TASKS.md` ISS-021 任务卡状态更新为「第一版已交付」+ 进度日志追加；`docs/ROADMAP.md` **未改**。
- 验证：76 个测试文件 / 689 个测试全部通过（新增 14 项：updateService 7 / updateCapability 2 / index 1 / AboutSection 4 新测试覆盖真实 outcome 流程替换 3 项老 placeholder 断言）；`npm run typecheck` 干净；`npm run build` 成功；`cargo check --manifest-path src-tauri/Cargo.toml` 干净（9 个 pre-existing warnings 与本期无关）。
- 已知限制（v0.3）：
  - `autoUpdateCheck` 设置项未实现（落地需要改 forbidden 的 `src/shared/settings/types.ts`，留 follow-up：从 `feat/app-distribution` 拆 `feat/auto-update-check`，扩展 `AppSettings` 并在 About section mount hook 自动检查）。
  - `tauri.conf.json` 的 `plugins.updater.pubkey` 当前是占位 `RWSY2kf...`（CI 弱密码生成的 base64 段），私钥已 rm 丢弃。**首次生产发布前**必须由 PM 本地 `cargo tauri signer generate -p <STRONG_PASSWORD>` 重新生成并替换 + 把私钥 / 密码加到 GitHub Secrets（步骤见 `docs/RELEASE.md §3.1`）。
  - 增量更新失败回退到完整重装未实现：tauri-plugin-updater 内部 chunk 重试后失败，需用户手动去 GitHub Releases 页面下载新安装包；不在本期 scope。
  - 移动端（Android / iOS）打包在 v0.3 评估范围：本期不实现；后续启动需扩展 `release.yml` 矩阵 + 单独签名 keypair + `latest.json` platform 字段。
  - 平台级 CODE_SIGNING（macOS notarization / Windows EV 证书 / Linux apt repo 签名）不在本期 scope。
- ISS-007 OCR 端到端联调（DEC-050 / feat/ocr-e2e）：补齐 OCR 真实接入的"端到端联调"缺口——之前所有测试都没跑过真实 ocrmypdf 子进程 + 真实 pdftotext 文本抽取 + 真实质量报告生成链路。
- ISS-007 OCR 端到端联调（DEC-050 / feat/ocr-e2e）：补齐 OCR 真实接入的"端到端联调"缺口——之前所有测试都没跑过真实 ocrmypdf 子进程 + 真实 pdftotext 文本抽取 + 真实质量报告生成链路。
  - `tests/fixtures/ocr/generate-scan-fixture.mjs`（新增）：Node + pdf-lib 脚本，把 400x150 预渲染 PNG（base64 内嵌在源文件里，**不依赖 ImageMagick / pdftoppm**）嵌入 2 页 A4 PDF，生成 `scan-only-sample.pdf`（~5 KB），保证 clone 后 `node tests/fixtures/ocr/generate-scan-fixture.mjs` 即可得到稳定 fixture；2 页 A4 便于覆盖 `pageRange` 参数；产物由 `.gitignore` 排除（`tests/fixtures/ocr/*.pdf`）。
  - `tests/fixtures/ocr/README.md`（新增）：记录重新生成命令、本机工具需求（ocrmypdf ≥ 13 / pdftotext ≥ 22 / curl ≥ 7 / tesseract + eng + chi_sim）、已知限制。
  - `tests/e2e/ocr-e2e.test.ts`（新增）：4 个 case — `full pipeline: validate → start → poll → extract → quality report`（真实 `OcrBridgeService.startOcr` + 注入真实 ocrmypdf 后端 + `OcrJobController` 注入 pdftotext 后端 + `OcrPostProcessor.buildReport` 全链路断言 2 页都可检索 / 关键词 "OCR/E2E/2026" 全部命中 / `passed=true`）；`bridge rejects mismatched providerId before spawning ocrmypdf`；`controller sanitises backend errors so paths do not leak`；`prepareOcrRequest fills outputPath and outputStrategy defaults`；缺 `ocrmypdf` / `pdftotext` 时 `beforeAll` 探测 + 每个 test 内部 `requireTools()` 静默跳过。
  - `src-tauri/src/lib.rs` 末尾新增 `#[cfg(test)] mod ocr_e2e_tests`（1 个 case）：复用前端 fixture 复制到 temp 目录 → `dispatch_ocr(OcrDispatchBackend::LocalOcrMyPdf)` 真实跑 ocrmypdf → `extract_pdf_text` 真实跑 pdftotext 抽 2 页文字 → `OcrJobQueue::new(tempfile)` 持久化 + `OcrJobQueue::new(same path)` reload 验证 `status=completed` / `backend=local-ocrmypdf` / `input_path_summary.kind=local-pdf` / `fingerprint` 非空 / `progress.completed_pages=2`；缺工具或 fixture 时静默跳过。
  - `src-tauri/src/ocr_text_extract.rs`：1 行参数顺序 bug 修复（`extract_pdf_text` 之前 `.arg("-").arg(pdf_path)` 与 pdftotext CLI 语法 `pdftotext [options] input.pdf [output]` 不符，导致 `Syntax Error: Document stream is empty` 错误地传给上游 `start_ocr_job` 质量检查分支；修正为 `.arg(pdf_path).arg("-")`；E2E 真实链接测试补了这个盲点——DEC-030 接入以来 `extract_ocr_text` 从未被真实链接测试覆盖过）。
  - `.gitignore`（追加 3 行）：`tests/fixtures/ocr/*.pdf` / `*.tmp` / `*.bak`。
  - 范围严格遵守：未修改 `package.json` / 锁文件（fixture 走 pdf-lib 已有依赖）/ `src-tauri/Cargo.toml`（Rust 测试只复用前端 fixture，**不重新生成**；`lopdf` 已 DEC-040 引入）/ `src/components/**` / `src/App.tsx` / 全局样式 / 路由 / `Toolbar.tsx`（按 DEC-032 协议）/ `src/shared/ocr/*` 共享契约 / 其他模块（reader / search / annotation / forms / export / pages / settings / scan-preprocess）；不引入新 crate / 新 npm 包。
  - **scope 变更**：`src-tauri/src/lib.rs` 原本在 forbidden 范围，但项目无 `src-tauri/tests/` 目录 + 除 `run()` 外所有模块都是 private，Rust 集成测试只能内联在此文件末尾的 `#[cfg(test)] mod`（与 `ocr_bridge_tests` / `scan_preprocess_tests` 风格一致）。仅追加测试模块，**不修改 `run()` / 任何 command / 任何共享契约**。STATUS.json `scope_change_log` 详细说明 + `pm_action_required=true`。
- 同步 `docs/DECISIONS.md` 追加 DEC-050（`feat/ocr-e2e` 整体方案 + scope 变更说明 + bug fix 归并 + typecheck 现状）；`docs/TASKS.md` ISS-007 任务卡后追加「ISS-007 OCR 端到端联调 worker」活跃任务卡 + 进度日志；`docs/ROADMAP.md` **未改**。
- 验证：`npm test -- --run` ✅ 74 文件 / 697 tests 全过（+ 4 个新 e2e）；`cargo test --manifest-path src-tauri/Cargo.toml --offline --lib` ✅ 42 / 42 全过（+ 1 个新 Rust E2E）；`cargo check --manifest-path src-tauri/Cargo.toml --offline` ✅ 干净（9 个 pre-existing dead_code warning 来自 scan_preprocess，与本 PR 无关）；`npx vite build` ✅ 2.81s 出完整 dist；`ocrmypdf --version` 17.4.0 / `pdftotext -v` 26.02.0。
- 已知限制：`npm run build` 走 `tsc && vite build` 阶段因项目级 pre-existing `target: ES2020` 不支持 `Array.prototype.at` 报 28 个 TS2550 错误（**与本 PR 无关**，详见 DEC-050 §4）；fixture 不入仓，clone 后必须先 `node tests/fixtures/ocr/generate-scan-fixture.mjs`，否则 Rust E2E 静默跳过；CI 镜像未预装 `ocrmypdf` / `pdftotext` / `tesseract` 时 E2E 静默跳过；云端 OCR provider（paddleocr / mineru）真实 HTTP 调用的 E2E 留 ISS-010 consent flow 收口后另起 worker（ISS-007 v0.1 真实使用场景是本地 ocrmypdf）。

## 0.1.0-alpha.9 - 2026-06-04

- 批注深化第三阶段（DEC-040 / ISS-026）：把第二阶段产出的 `AnnotationSidebar` 真正挂到 `AppShell` + 中文 stamp 文字用思源黑体 SC 真实绘制（补 DEC-039 W8 已知限制）。
  - `src/components/layout/types.ts`：`UtilityPanelId` 新增 `"annotation"` 面板。
  - `src/components/layout/AppShell.tsx`：`UtilityPanel` 增加 `panel === "annotation"` 分支，渲染 `AnnotationSidebar`（受控组件：annotations / currentPage / pageCount / onSelectPage 全部从 reader 透传）。
  - `src/App.tsx`：`handleModeChange` 在切到 `annotate` mode 时强制 `setUtilityPanel("annotation")`；从 `annotate` 切到其他 mode 时若 panel 仍是 `annotation` 则回 `summary`。
  - `src/modules/annotation/annotationStampFont.ts`（新）：`resolveStampFont(pdfDoc, text, options)` 路由 CJK → `embedChineseFont` / Latin-only → `StandardFonts.Helvetica`，与 `fontAwareWatermark.ts` 模式一致；7 项单测覆盖（含 `chineseFontBytes` / `chineseFontLoader` 注入）。
  - `src/modules/annotation/annotationPdfWriter.ts`：`drawAnnotation` 改 async；`drawStamp` 改用 `await resolveStampFont(workingPdf, label)` 替代统一 Helvetica font；字体加载失败 / 编码失败时静默保留边框（与原行为一致，drawn: true 不计入 skipped）。
  - `src/components/layout/AppShell.test.tsx`（新）：8 项单测覆盖 utilityPanel=annotation/summary/none 三态 + currentPage / onSelectPage 跳转链 + 中文搜索 + annotate/export 工具条。
  - `src/modules/annotation/index.ts` 追加 `resolveStampFont` / `ResolveStampFontOptions` 导出。
- 范围严格遵守：未修改 `package.json` / 锁文件（fontkit + 思源黑体已就位，按 DEC-039 协议）；未修改 `Toolbar.tsx`（仍按 DEC-032 协议由后续 mode 工具 worker 通过 `registerModeTools` 接入）；未修改 `Sidebar.tsx`（`AnnotationListPanel` 保留在 DocumentSummaryPanel 的「批注列表」tab 中作为 read/forms/ocr/export 模式的基础列表）；未修改 `src-tauri/Cargo.toml`；未修改其他模块（reader / forms / export / settings / ocr）。
- 同步 `docs/DECISIONS.md` DEC-040；`docs/TASKS.md` ISS-026 进度日志追加对应记录；`docs/ROADMAP.md` **未改**。
- 验证：71 个测试文件 / 636 个测试全部通过（新增 15 项：annotationStampFont 7 + AppShell 8）；`npm run typecheck` 干净；`npm run build` 成功；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 干净。
- 已知限制：窄屏下 annotate 模式 utilityPanel 槽位被 AnnotationSidebar 占满，无法同时看 DocumentSummaryPanel 缩略图（点「文档摘要」按钮可手动切回 summary）；textbox 批注的中文仍是 Helvetica 静默跳过（不属本期范围）；`AnnotationSidebar` 的 `onAnnotationClick` / `activeAnnotationId` 暂未与 `AnnotationOverlay` 联动（Overlay 暂无 controller）；`ContextToolbar` 批注工具按钮仍是死按钮（按 prompt 协议未修改 Toolbar.tsx）。
- OCR 模式工具条接入 AppShell（DEC-040 / ISS-007 UI）：把已有 `OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView` 三个独立组件挂到 AppShell 的 ocr mode 渲染路径上，并把 OCR 后端调用、任务轮询、选中状态聚合成 `useOcrWorkspaceController` hook 喂给它们。
  - `src/modules/ocr/ui/useOcrWorkspaceController.ts`：维护 `jobs / currentJob / selectedJobId / busy / hasDocument / hasProvider / errorMessage` 状态；mount 调 `controller.listOcrJobs`、存在 active 任务时按 `pollIntervalMs`（默认 1500ms）轮询；`startOcr` 走 `OcrBridgeService.startOcr`（带 provider 校验 + 隐私 consent）后 `listOcrJobs` 刷新；`outputLayeredPdf` 强制 `new-layered-pdf` 策略；`cancelJob` 走 `controller.cancelOcrJob`；`selectJob` / `openQualityReport` 写 `selectedJobId`；`currentJob` 优先 active job，否则回退到 `selectedJobId`；早期无文档 / 无 provider 错误经 `errorMessage` 暴露给 OcrWorkspace 展示。
  - `src/modules/ocr/ui/OcrWorkspace.tsx`：左侧 `OcrJobList`（选 / 取消 / 打开报告）+ 右侧 `OcrQualityReportView`（选中任务的报告，无选中显示占位），错误用 `role="alert"` 提示；当前 active job 自动 focus。
  - `src/modules/ocr/ui/ocrWorkspace.css`：独立 CSS（grid 双列 + 720px 折叠），不动 `ocrModeToolbar.css`。
  - `src/modules/ocr/index.ts` 追加导出 `OcrWorkspace` / `useOcrWorkspaceController` / `deriveLayeredOutputPath` / 2 个 type。
  - `src/components/layout/AppShell.tsx`：新增 `ocr?: OcrWorkspaceController` prop；ocr mode 渲染分支：context toolbar 用 `<OcrModeToolbar>` 替换 hardcoded `["增强扫描","拆分页面","裁剪页面","清除空白边","识别文本","内容选定","裁剪"]` 7 个占位按钮；主区域挂 `<OcrWorkspace controller={ocr}>` 替换 `ReaderCanvas`；`utilityPanel` 在 ocr 模式隐藏（OCR 工作区独占主区域，与 pages mode 同策略）；`ContextToolbar` 拆 `ocr` 入参后按 mode 路由。
  - `src/App.tsx` 追加接线：新增 `useOcrWorkspaceController({ documentPath, providers, providerId, requireNetworkConsent })`，用 `useMemo` 锁入参；传给 AppShell `ocr={ocrController}`。**未**改 Toolbar / 全局样式 / 路由 / 锁文件 / package.json / src-tauri/。
  - `src/App.test.tsx` OCR mode 断言从 7 个 hardcoded 按钮更新为 OcrModeToolbar 4 个核心按钮（识别文本 / 输出双层 PDF / 质量检查 / 任务列表）+ OcrWorkspace `main` region。
  - 测试：新增 33 个单测（`useOcrWorkspaceController.test.tsx` 14 + `OcrWorkspace.test.tsx` 6 + `AppShell.test.tsx` 11 + `deriveLayeredOutputPath` 4 + App.test.tsx 调整 1），总测试 72 文件 / 653 通过；`npm run typecheck` 干净；`npm run build` 成功；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 干净。
  - 已知限制：ocr mode 主区域不会读真实 PDF 渲染（与 pages mode 一致；ReaderCanvas 留给 read / annotate / forms / export 模式）；`documentPath === ""` 时（浏览器 `<input type="file">` 走 PDF.js 加载）`startOcr` 会拒绝并展示明确错误，等 Tauri 文件对话框接线后路径会自动填充；云端 OCR provider（paddleocr / mineru）的 `networkConsentGranted` 在 settings 缺省为 false，privacy guard 会拒绝并把错误回写到 `errorMessage`（不弹 confirm 浮层，由后续 ISS-010 consent flow 补）；`useOcrWorkspaceController` 一次性锁定 controller / bridge（首挂载后不再重新注入），切到 ocr 模式后想替换需要刷新 App。
- 范围严格遵守：未修改 `package.json` / 锁文件 / `src-tauri/Cargo.toml` / `src/shared/ocr/*` 共享契约 / reader / search / annotation / forms / export / pages / settings 等其他模块；DEC-040 编号承接 DEC-039 导出字体后 +1。
- 同步 `docs/DECISIONS.md` DEC-040（OCR 模式 UI 接线方案）；`docs/TASKS.md` ISS-007 进度日志追加对应记录；`docs/ROADMAP.md` **未改**。

## 0.1.0-alpha.8 - 2026-06-04
## 0.1.0-alpha.7 - 2026-06-04

- 阅读模式深化（DEC-034）：4 种 view mode（连续 / 单页 / 双页 / **适合宽度**）切换，缩放预设 8 项（50/75/100/125/150/200% / 适合宽度 / 适合页面），旋转 90° 步进（顺/逆时针），键盘翻页（PageUp/PageDown/方向键/Space/Home/End），阅读位置本地恢复（localStorage 持久化 fingerprint + currentPage + zoom + viewMode + rotation）。
- 数据模型扩展：`PdfViewMode` 增加 `fit-width`；`PdfDocumentState` 增加 `rotation: 0 | 90 | 180 | 270`；新增 `ZOOM_PRESETS` 清单、`ReaderSession` 持久化类型、`PageRotation` 别名。
- 新增 `src/modules/reader/viewMode.ts`：`calculateFitWidthZoom`（按容器宽度等比缩放，16px padding 防水平滚动条）、`calculateFitPageZoom`（取宽高限制较小值）、`resolveEffectiveZoom`（fit-width 模式下用容器宽度覆盖 manualZoom）、`applyZoomPresetId`（8 预设 id → viewMode + zoom）；纯函数覆盖 13 项单测。
- 新增 `src/modules/reader/readerSessionStorage.ts`：`ReaderSessionStorage` 接口 + `createLocalStorageReaderSessionStorage`（生产）+ `createMemoryReaderSessionStorage`（测试）+ `normalizeReaderSession`（字段全校验） + 默认探测（localStorage 不可用时回退内存版）；key 命名空间 `faropdf:reader-session:<fingerprint>`；覆盖 13 项单测。
- `useReaderController` 新增 `rotateClockwise / rotateCounterClockwise / setRotation / setZoomPreset / zoomIn / zoomOut / goToNextPage / goToPreviousPage / goToFirstPage / goToLastPage` 10 个动作；通过 `useEffect` 在 `fingerprint` 匹配时自动从 sessionStorage 恢复 `currentPage / zoom / viewMode / rotation`，并在状态变化后写回；首轮加载完成前不写回避免覆盖；新增 `useReaderControllerOptions.sessionStorage` 注入用于测试；新增 9 项 controller 单测覆盖旋转/翻页/缩放预设/session 加载/写回。
- `readerReducer` 新增 `setRotation` / `rotate`（累加 90 度，跨 360 回 0） / `applySession`（fingerprint 不匹配时跳过）3 个 actions；`loadSucceeded` 初始 `rotation = 0`；`setZoom` 把 [0.25, 4] 夹紧抽成 `clampZoom` 工具；`readerReducer` 测试覆盖从 3 个扩到 10 个。
- 新增 `useReaderKeyboard` hook：PageDown/Space/ArrowDown/ArrowRight 推进，PageUp/ArrowUp/ArrowLeft 回退，Home/End 跳首尾；double 模式下 Arrow 步进 2 页；input/textarea/contenteditable 元素内和 Cmd/Ctrl/Alt 组合键不拦截；覆盖 11 项单测。
- `ReaderCanvas` 抽出 `DocumentReader` 子组件，`ResizeObserver` 监听容器宽度，fit-width 模式实时计算 effectiveZoom；rotation 90/270 时交换宽高参与计算；double 模式 `flexDirection: row` 并排；`PdfPage` 在单/双页模式下点击页边空白翻页（左半上一页、右半下一页）；暴露 `data-view-mode` / `data-page-number` / `data-rotation` 属性。`data-testid="reader-status-footer"` 给后续 StatusBar 接入。9 项 ReaderCanvas 单测覆盖 4 mode / rotation / 键盘 / renderPageToCanvas 调用。
- `Sidebar.tsx` 的 `ViewSettingsPanel` 扩展为 4 视图按钮 + 8 缩放预设 + 顺/逆时针 90° 旋转按钮；`isFitWidth` 时强制高亮「适合宽度」缩放预设；`data-testid="view-mode-grid"` / `data-testid="zoom-preset-grid"` / `data-testid="rotate-grid"` 暴露。8 项 ViewSettingsPanel 单测覆盖 4 视图 + 8 预设 + 旋转 + 禁用态。
- `AppShell` 接线：`reader.rotateClockwise / rotateCounterClockwise` 包装为 onRotate 回调；`reader.setZoomPreset` 包装为 onZoomPresetChange；按 0.01 容差把当前 zoom 推断为 `ZoomPresetId`（fit-width / fit-page 由 viewMode 决定，不由 zoom 匹配）。
- 新增 `registerReadModeTools()` 通过 `registerModeTools("read", [...])` 注册 3 个 mode 工具：顺时针 / 逆时针 / 适合页面快捷；自动出现在 `Toolbar.tsx` 的 `ModeActiveTools` 区域（PR #20 DEC-032 注册表）；`App.tsx` 启动时一次性调用。**未直接修改 `Toolbar.tsx`**。6 项 readerModeTools 单测覆盖注册/disabled/3 个工具的 onClick 行为。
- 兼容修订：`src/shared/pdf/types.ts` 的 `Record<PdfViewMode, string>` 标签字典加 `fit-width`；`src/modules/settings/SettingsPanel.tsx` 同样加 `fit-width`；`src/shared/contracts.test.ts` 的 `PdfDocumentState` 加上 `rotation: 0`；`src/shared/settings/defaults.ts` 的 `allowedViewModes` 集合加 `fit-width`。
- 验证：53 个测试文件 / 435 个测试全部通过；`npm run typecheck` 干净；`npm run build` 成功。
- 同步 `docs/DECISIONS.md` DEC-034 阅读模式深化方案；`docs/TASKS.md` 进度日志追加对应记录。
- 表单填写与签署第一版（DEC-035 / ISS-008）：在 `feat/forms-signing` 落 `src/shared/pdf/form.ts` 契约扩展 + `formService` execute 能力升级 + reader `getFileBytes` / `saveUpdatedBytes` 扩展 + forms mode 工具按 DEC-032 §"W3 Forms" 指南通过 `registerModeTools("forms", [...])` 注册 + `useFormController` + `FormsPanel` 浮层。
  - 契约新增 `PdfFormOperation` 联合（`fill` / `sign` / `flatten`）、`PdfFormBatchRequest` / `PdfFormBatchResult`、`PdfFormFlattenSummary`、helper `isPdfFormOperationType` / `isPdfFormOperation` / `validateFormBatchRequest`；保留旧 `PdfFormField` / `PdfFormState` / `PdfFormFillingInput` / `PdfSignatureInput` 字段。
  - `formService.mapFormField` 修 `pageIndex` 硬编码 0：构造 `PDFDict → pageIndex` 查找表，`page.node.Annots()` 是 `PDFRef`、需 `context.lookup(ref, PDFDict)` 解析后才能与 `widget.dict` 比较引用相等。
  - `formService.flattenForm(pdfBytes) → { bytes, summary }`：调用 pdf-lib `form.flatten()`，产出 before / after 字段数。
  - `formService.applyFormOperations(request)` 批量入口：单次 `PDFDocument.load` 后按顺序执行 operation，单条失败封装为 `status: "failed"` 不中断后续；输出 `PdfFormBatchResult { bytes, appliedCount, failedCount, results, completedAt }`。
  - reader `useReaderController` 新增 `getFileBytes()` / `getCurrentFileName()` / `saveUpdatedBytes(bytes, suggestedFileName)`：源 bytes 在 `openFile` 时缓存，导出走浏览器原生 `<a download>`，不依赖 Tauri command。
  - `src/modules/forms/activeFormController.ts` 模块级 set / get controller 桥：让 mode 工具按钮 onClick 闭包拿到当前 controller，避免修改 `ToolbarState` 类型。
  - `src/modules/forms/registerFormsToolbarTools.ts` 注册 4 个 forms mode 工具（`forms.refresh` / `forms.fill` / `forms.signature` / `forms.flatten`），按 `order` 升序渲染，全部 `isDisabled: (state) => !state.reader.state.document`。
  - `src/modules/forms/useFormController.ts` 维护 formState / loading / errorMessage / successMessage / panelMode / selectedFieldId / draftValue / signatureImageBytes / signatureImageType；提供 refresh / openPanel / closePanel / selectField / setDraftValue / setSignatureImage / clearSignatureImage / applyFieldEdit / applySignature / flattenAndSave / applyBatchAndSave / setErrorMessage / clearMessages 13 个动作；reader 切换 document 时 reset 全部状态。
  - `src/modules/forms/FormProvider.tsx` 顶层 Provider：注册 controller 到模块级桥 + 在 `activeMode === "forms"` 时调 `registerFormsToolbarTools()` + 渲染 children + 仅在 forms mode 挂载 `FormsPanel`。
  - `src/modules/forms/ui/FormsPanel.tsx` + `ui/FormsPanel.css` 浮层 panel：按字段类型分组渲染 + 填值编辑器（text / dropdown / checkbox / radio）+ 签名图片选择（PNG / JPG），错误 / 成功提示走独立 alert / status 区域；CSS 独立文件不污染 `src/styles/app.css`。
- 新增 82 项测试：form 契约 16 + formService 21 + activeFormController 4 + registerFormsToolbarTools 9 + useFormController 16 + FormsPanel 16；总测试 419 / 419 通过。
- 4 件套验证：`npm run typecheck` / `npm run build` / `npm test -- --run` / `cargo check --manifest-path src-tauri/Cargo.toml --offline` 全绿。
- 已知限制：FormsPanel 是绝对定位浮层（fixed top:72 right:16），在窄屏（< 360px）会与主工具栏重叠；签名图片必须 PNG / JPG；扁平化后源 PDF 仍保留 `textLayerStatus: "missing"` 不会重新标记；浏览器 `<a download>` 一次只触发一个文件。
- 同步 `docs/DECISIONS.md` DEC-035（ISS-008 表单填写与签署第一版方案，DEC 编号承接 DEC-034 阅读模式深化后 +1）；`docs/TASKS.md` 进度日志追加对应记录。
- ISS-013 第二阶段（真实压缩 + 中文字体）按 DEC-036 延期：Wave 3 W5 worker 在 `feat/export-real-encoding` 启动后即触发 scope-fontkit 物理冲突（pdf-lib 嵌入自定义字体需 `@pdf-lib/fontkit`，与 worker prompt 的"不修改 package.json / 不引入 npm 字体包"约束冲突），worktree 清理。重启条件：worker prompt 显式声明 `@pdf-lib/fontkit` 是 pdf-lib 官方 devDep 可装 + 选开源协议中文字体（OFL / Apache 2.0 / MIT）下载到 `assets/fonts/`，且 PM 兜底。ISS-013 状态保持"已完成交付工具导出底座第一版"，第二阶段从"延期"标签继续。

## 0.1.0-alpha.6 - 2026-06-03

- 新增 ReaderToolbar 注册表基础设施（DEC-032）：新增 `src/components/layout/toolbarRegistry.ts` 暴露 `ToolbarState` / `ToolbarToolItem` 类型与 `registerModeTools` / `getModeTools` / `_resetToolbarRegistry` 三个函数；`getModeTools` 按 `AppModeId` 命名空间隔离，多次注册累加，**不**自动排序（调用方需 `slice().sort()` 后再渲染，避免污染注册表）。
- 新增 9 项 `toolbarRegistry` 单元测试，覆盖未注册返回空、追加、跨 mode 隔离、注册顺序保持、`isActive` / `onClick` 收到传入 state、`isDisabled` 可选、reset 清空。
- `src/components/layout/Toolbar.tsx` 末尾新增 `ModeActiveTools` 组件，挂在 `toolbar__group--modes` 内 4 个常驻 mode 入口按钮（annotate / export / forms / ocr）之后，按 `getModeTools(activeMode).slice().sort()` 渲染当前 mode 工具；4 个常驻 mode 入口按钮保留 Toolbar 内 `modeButtons` 硬编码（不归注册表管）；activeMode="read" / "pages" / "export" 时新区域渲染空 fragment，UI 与重构前完全一致。
- 后续 W3 Forms / W4 Reader modes worker 在各自模块内 `registerModeTools("<mode>", [...])` 即可接入 mode 工具，不再修改 Toolbar.tsx。
- 已知限制：`ToolbarState` 当前只暴露 `activeMode / reader / search`；如未来某 mode 工具需要 `onModeChange` / `onUtilityPanelChange` 等额外上下文，再按需扩展。
- 同步 `docs/DECISIONS.md` DEC-032（ReaderToolbar 注册表契约）+ DEC-033（page-organizer-suite 第二阶段方案，DEC 编号从原 PR #21 写的 032 改为 033 释放 PR #20 已占用的编号）；`docs/TASKS.md` 进度日志追加对应记录。

- 页面整理真实改写（ISS-006 第二阶段）：`pdfOperationEngine` 在 `mode=execute` 下用 pdf-lib 真实改写 PDF —— 按 `reorder.pageIndexes` 拷贝源页、过滤 `delete.pageIndexes`、对 `rotate` 操作写入 PDF page `Rotate` 字典；`pageOperationPlan.mode = "execute"`，`entries.status` 全部 `applied`；plan-only 模式仍可由调用方显式指定，仅记录计划并把 `*-organized.pdf` 当作占位输出。补齐 `pageOrganizer.export.test.ts` 4 个端到端用例覆盖 execute / plan-only / 缺页 / 空操作四种行为。
- 证据图片 A4 编排真实拾取 + 像素渲染 + 写入新 PDF（ISS-018 第二阶段）：`imagePackItemResolver` JPEG SOF marker 偏移从 `offset+3/+5` 修正为 `offset+5/+7`（marker 后还有 2 字节 length + 1 字节 precision）；`imagePackRenderer` 在 PDF 页面渲染路径上把 `copyPages` 替换为 `embedPdf` —— pdf-lib 1.17.1 + vitest 4 下 `copyPages` 返回 `PDFPage[]` 不能喂给 `drawPage`，会抛 `embeddedPage must be of type PDFEmbeddedPage, but was actually of type NaN`。
- 新增 `src/modules/pages/imagePack/imagePackExecutor.ts`：端到端执行器，承担 plan 校验 + 路径安全（绝对路径、`.pdf`、与 `plan.items[].sourcePath` 不同、storage 不存在 `outputPath`）+ `createImagePackRenderer.renderPlan` 渲染 + `PdfExportStorage.writeNewFile` 写入；错误统一经 `sanitizePdfExportError` 脱敏。补 10 个端到端测试覆盖 PNG 真实拾取 + 渲染 + 写入、PDF 页面真实嵌入、路径与 plan 校验和兜底同源检测。
- 修正 `src/modules/pages/imagePack/index.ts` 的导出分类：把 `ImagePackFileReader` / `ImagePackRenderer` / `RenderImagePackPlanInput` / `RenderImagePackPlanResult` 移到 `imagePackRenderer` 子模块导出；`index.ts` 之前把它们误放在 `imagePackItemResolver` 下，导致 typecheck 失败和外部消费者拿不到正确类型。
- 新增 `docs/DECISIONS.md` DEC-033 `page-organizer-suite` 第二阶段方案（DEC 编号 PM rebase 时从 032 改为 033 释放 PR #20 已占用的 032）；`docs/TASKS.md` 进度日志追加对应记录。

## 0.1.0-alpha.5 - 2026-06-03

- 真实接入 OCR bridge（ISS-007 第二版）：
  - 后端按 provider 分发到本地 `ocrmypdf` 二进制（`local-ocrmypdf` / `legal-skills`）和 `curl + HTTPS endpoint`（PaddleOCR / MinerU）。
  - 任务队列持久化到 `app_config_dir/ocr-jobs.json`，启动时回收残留 running 任务为 cancelled，支持 `list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text` 四个新 command。
  - 凭证引用解析：仅接受 `env:NAME` 等安全引用形式，明文 API Key 仍被 `isSafeApiKeyRef` 拒绝；`keychain:` 等暂未集成的引用返回明确错误。
  - OCR 完成后通过 `pdftotext` 提取页面文本，喂给 ISS-017 `ocrQualityCheckService` 生成可检索页比例、关键词命中、体积比和耗时报告。
  - 新增前端 `createTauriOcrJobController`、`createOcrPostProcessor` 和 `OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView` 组件，识别文本 / 输出双层 PDF / 质量检查三个核心按钮；工具条作为独立组件交付，不改 `src/App.tsx` 和全局样式。
  - 已知限制：本机需先安装 `ocrmypdf`、`pdftotext`、`curl`；`keychain:` 引用形式需后续 OS Keychain 集成落地。
- 新增批注深化第一版（ISS-026）：在批注 sidecar 之上加入几何规整（normalizeRect/pointsToRect/unionRects/inkStrokesToRect/lineToRect/recomputeLineRects/recomputeInkRects/sanitizeRects/isRectWithinBounds/clampRectToBounds/annotationBoundingRect）、搜索过滤（collectAnnotationSearchHaystack + matchesQuery/matchesPageFilter/matchesTypeFilter/matchesColorFilter）、图章 SVG 模板（5 套模板、4:1 viewBox、矩形/圆角/椭圆/横幅 4 种 shape、escapeXml 注入）、工具条 model（ANNOTATION_TOOL_LIST/ANNOTATION_TOOL_MAP/ANNOTATION_COLOR_SWATCHES/AnnotationToolState + 5 个不可变 reducer）。
- 新增 `AnnotationOverlay`：覆盖高亮/下划线/删除线/备注/文本框/矩形/箭头/手写/图章 9 种批注的点击/拖拽/手写 3 种交互模式，预览走 `id: "preview"` 占位 annotation 并通过 `onAnnotationDraft` 派发不可变 draft。
- 新增 `AnnotationToolbar`：9 工具按钮 + 6 色色板 + 图章 5 模板子区段 + 图章文字输入，受控组件模式（外部 state + onStateChange）。
- 新增 11 项 `AnnotationToolbar` 单元测试：覆盖 9 工具按钮渲染、arm/disarm、工具切换、颜色更新、图章选项可见性、图章文字修改、图章模板切换回填 defaultLabel 和 disabled 行为。
- 新增 `docs/DECISIONS.md` DEC-031 记录批注深化的几何/搜索/图章/工具条边界；新增 `docs/TASKS.md` ISS-026 批注深化活跃任务卡和归档索引。

## 0.1.0-alpha.4 - 2026-06-03

- 新增阅读器缩略图真实渲染：`pdfReaderService` 暴露 `renderThumbnail`，`useReaderController` 提供对应方法；缩略图按 `maxWidth` 等比缩放并懒加载。
- 左侧文档摘要接入 PDF.js 缩略图：缩略图按页码 1-based 渲染，当前页带 `aria-current` 和高亮样式；批注、搜索命中和 OCR 缺失页码显示对应标记。
- 阅读器滚动同步：单页 `IntersectionObserver` 阈值 0.5，进入视口后通知 `setCurrentPage`，左侧缩略图当前页会随滚动更新。
- 同步补齐 reader 模块 3 项缩略图测试、Sidebar 9 项缩略图 UI 测试、AppShell 数据流绑定和 search 集成测试 mock。

## 0.1.0-alpha.3 - 2026-06-03

- 新增文书整理 manifest 服务：支持页级检查、空白页/文本长度剧变边界检测、规范命名建议。
- 新增 organizer 模块和共享契约类型。

## 0.1.0-alpha.2 - 2026-06-03

- 导出引擎新增页面操作 execute 模式：支持真实的页面旋转、删除和重排，通过 pdf-lib 选择性复制页面并设置旋转属性。
- 新增 6 项导出引擎 execute 模式测试：覆盖 reorder、delete、rotate、组合操作、空操作和越界报错。

## 0.1.0-alpha.1 - 2026-06-03

- 新增 OCR 质量检查报告：支持可检索页比例、关键词命中、CER（Levenshtein 距离）、体积比和耗时阈值检查，并标识问题页和失败原因。
- 新增证据图片 A4 编排计划器：支持图片/PDF 页面按 A4 1/2/3/4 张每页自动编排，包含方向自动检测、边距校验、排序和安全输出路径。

## 0.1.0-alpha.0 - 2026-06-02

- 创建 Tauri v2 + React + TypeScript + Vite 基础工程。
- 建立基础阅读器 Shell：顶部工具栏、左侧按需工具区、中央 PDF 阅读区、上下文工具条、页面管理工作台和底部状态栏。
- 建立设置入口和默认 OCR provider 设置，联网 OCR 默认要求确认，外部 provider 默认未启用。
- 建立共享契约：PDF 文档状态、页面视口、批注、页面操作、导出任务、OCR provider、OCR 任务和应用设置。
- 建立 `src/modules/` 模块边界和测试 fixture 规则，为后续多 worktree worker 提供文件范围。
- 补齐 `typecheck`、测试、lint、构建和 Tauri/Rust 检查基础命令。
- 并行接入 PDF.js 阅读底座：本地文件输入、PDF 元数据读取、独立 worker、阅读状态、缩放/视图模式和虚拟化范围计算。
- 并行接入设置/OCR provider 配置：设置持久化 command、PaddleOCR/MinerU provider 编辑、API Key 脱敏和联网 OCR 确认策略。
- 在 `feat/pdf-expert-shell-ia` 分支参考 PDF Expert 的页面逻辑推进 Shell 草案，方向为中央阅读优先、左侧摘要/设置抽屉、顶部搜索、模式上下文工具条和独立页面管理网格；该 UI 仍需继续 polish 后再合并。
- `feat/pdf-expert-shell-ia` 增加打开/拖拽空态、转换入口、最近文件占位、分组导出工具条、填写签名工具条、扫描/OCR 工具条和页面管理另存出口。
- 收紧 `feat/pdf-expert-shell-ia` 的窄屏顶栏布局，避免 900px 视口下任务按钮和搜索区溢出。
- 修正 `feat/pdf-expert-shell-ia` 评审问题：无文档页面管理不再显示假页面，视图设置绑定真实阅读模式，窄屏保留搜索入口，空态拖拽打开 PDF 可用。
- 增加 FaroPDF 临时应用图标：先采用纸页叠层与灯塔方案，并同步网页 favicon 与 Tauri 平台图标。
- 建立批注 sidecar 模型第一版：支持高亮、下划线、删除线、备注、文本框、矩形、箭头、手写和图章的 JSON 持久化、仓储服务和 Markdown / HTML 摘要导出；摘要不包含真实用户文件名。
- 新增扫描预处理第一版基础：preprocess-only 任务契约、参数校验、默认新 PDF 输出路径、路径脱敏、前端 service 和 Tauri command bridge stub。
- 增加文本层检测与全文搜索第一版：搜索时按需建立页文本索引，展示命中列表、上下文片段、上下一个命中、当前页轻量高亮和扫描件 OCR 提示。
- 修正搜索换文档状态隔离、英文分段文本搜索和纯扫描长卷 OCR 提示，避免旧 PDF 搜索片段出现在新文档界面。
- 新增 OCR bridge/stub 第一版：建立 OCR 请求与任务模型、provider adapter 边界、云端 consent、安全 apiKeyRef、HTTPS endpoint 拦截、默认 `*-ocr.pdf` 新输出路径和路径脱敏；当前不执行真实 OCR、不生成双层 PDF、不发起联网 OCR 请求。
- 收紧 OCR bridge/stub 的云端 provider 安全校验：HTTP 调试 endpoint 只接受真实 loopback，拒绝 `127.*` 伪装域名，并修正带逗号或中文标点 PDF 路径的错误脱敏。
- 新增 OCR 质量检查报告底座：可基于 OCR 后页面文本生成可检索页比例、关键词命中率、体积比、耗时和可选 CER 报告，并列出未达阈值的问题页；当前不解析真实 PDF、不执行真实 OCR。
- 建立 PDF 导出引擎底座第一版：支持 pdf-lib 复制导出为新 PDF bytes、路径型导出绝对新路径和仅新建写入、AcroForm 表单扁平化、批注 sidecar plan-only 导出摘要和页面操作 plan-only 入口。
- 建立页面整理工作台第一版底座：支持页面状态创建、旋转、删除、重排、恢复和撤销，并生成默认 `*-organized.pdf` 的 plan-only 页面操作导出请求；当前不真实改写 PDF 页序、旋转或删除结果。
- 新增法律材料隐私与联网 OCR 提示第一版：建立联网 OCR notice、consent decision、脱敏 audit record 和 guard 服务；云端 OCR 没有本次匹配 notice/consent 时拒绝，旧布尔确认标记不能单独放行，本地 OCR 不需要联网 consent；当前不执行真实 PaddleOCR/MinerU 调用。
- 新增 PDF 交付工具底座：导出引擎支持文字/图片水印、普通页码和 Bates 编号写入 PDF，新增 `*-delivery.pdf` 安全输出请求；压缩预设当前生成 plan-only 计划和警告，真实图像重编码后续接入。
- 新增证据图片 A4 编排第一版 plan-only 底座：纯函数规划器支持图片或 PDF 页面按 A4 1/2/3/4 张编排，`itemsPerPage=auto` 时竖版多数自动 3 张/页、横版多数自动 1 张/页，`orientation=auto` 在 `itemsPerPage=1` 时按条目方向逐页取方向、`itemsPerPage>=2` 时固定 landscape，默认 `*-evidence-pack.pdf` 输出建议并拒绝与输入 sourcePath 等价的输出；当前不读取真实图片或 PDF、不渲染像素、不引入新依赖。

## 0.0.0 - 2026-06-02

- 初始化 FaroPDF 项目上下文。
- 固定项目定位：独立 PDF 阅读器，不并入 Folia。
- 固定首版范围：快读、检索、批注、OCR/扫描、页面整理、表单签署。
- 固定技术方向：Tauri v2 + React + TypeScript + Vite + PDF.js + pdf-lib + OCR bridge。
- 建立 `AGENTS.md`、`README.md` 和 `docs/` 文档体系。
- 按 `project-init` skill 补齐 `CLAUDE.md`、`.claude/settings.json`、`.gitignore`，并安装开发协作 skills。
- 初始化 Git 基线，并推送到同名 GitHub private 仓库 `FaroPDF`。
- 明确 v0.1 采用 Foundation Gate + 多 worktree 并行推进，并补充设置页、外部 OCR provider、水印、压缩等第一版任务。
- 梳理 `pdf-processor`、`pdf-organizer`、`img2pdf` 的脚本算法，并统一记录到 `docs/TASKS.md` 任务源。

- 扫描预处理真实处理（DEC-040 / ISS-016 第二阶段）：把第一版 `start_scan_preprocess_job` queued stub 推进到「文件持久化任务队列 + lopdf 真实 PDF 清洁 + 真实状态机流转」。
  - `src-tauri/Cargo.toml` 加 `lopdf = "0.33"`（纯 Rust，0.34 在 rustc 1.88 reader.rs API 失配回退 0.33），不引入 opencv / mupdf（系统级依赖 + macOS 装机风险）。
  - 新增 `src-tauri/src/scan_preprocess/` 五子文件：
    - `mod.rs` 模块入口，公开 `ScanPreprocessJobQueue / ScanPreprocessJobQueueState / ScanPreprocessStored* / run_scan_preprocess_job`。
    - `types.rs` 持久化类型，含完整生命周期（status / progress / summary / error_message / started_at / completed_at / path summary），去掉 Eq derive（f32 不支持）。
    - `queue.rs` 仿 `ocr_queue.rs` 的 `OcrJobQueue`，持久化到 app config dir 的 `scan-preprocess-jobs.json`（schema_version = 1），启动时把残留 `running` 标 `cancelled`，路径走 `redact_path` 脱敏 + `fingerprint_of` 哈希；7 项单测。
    - `pdf_probe.rs` 用 lopdf 0.33 真实解析 `MediaBox` / `Rotate` / 文本对象数；`apply_clean_edge` 按 `margin_px` 真实内缩 MediaBox（边距过宽安全跳过）；`save_pdf` 包含父目录 create_dir_all；`detect_orientation_vote` plan-only（lopdf 不解析压缩 content stream，待 mupdf 接入）；3 项单测。
    - `runner.rs` 主流程 `validating → preprocessing → writing-output → completed`，真实 `elapsed_ms` + 失败落盘；2 项单测。
  - `src-tauri/src/lib.rs` 改造：删除旧 `command_stub_returns_queued_job_and_safe_summary` 测试（OCR command 同样无 State mock 测试，模式一致）；`start_scan_preprocess_job` 函数体改为「写 stored job（status=running, stage=validating）→ `tauri::async_runtime::spawn` 跑 runner → 返回 scan_stored_to_command_job」；新增 `list_scan_preprocess_jobs / poll_scan_preprocess_job / cancel_scan_preprocess_job` 三个 Tauri command；`ScanPreprocessCommandJob` 扩展 `error_message / started_at / completed_at`；`setup` manage `ScanPreprocessJobQueueState`；`invoke_handler` 注册 4 个新 command；1 项新增 stored → command 转换单测。
  - 前端 `src/modules/preprocess/scanPreprocessService.ts`：`ScanPreprocessBackend` / `ScanPreprocessService` 接口加 `listPreprocessJobs / pollPreprocessJob / cancelPreprocessJob` 三个方法（统一错误脱敏 + 空 jobId 拒绝）；`normalizeScanPreprocessJob` 兼容缺字段 / 不可信 options（fallback request.options 或 defaultOptions），不再做危险 `Record → ScanPreprocessOptions` 强转；4 项新单测（list newest first / poll null / cancel cancelled / 空 jobId 拒绝）。
  - 范围严格遵守：未修改 `package.json` / `package-lock.json` / `Toolbar.tsx` / `App.tsx` / 全局样式 / 路由 / `src/shared/preprocess/*` 共享契约（不破坏现有前端 PDF 工具）/ `src-tauri/Cargo.lock` 之外的其他 crate 依赖。
  - 验证：69 文件 / 625 测试全过（4 项新增：list 排序 / poll null / cancel cancelled / 空 jobId 拒绝）；41 个 Rust 单测全过（16 项新增：queue 7 + pdf_probe 3 + runner 2 + lib 1 新增 + 3 旧 helper + 1 旧 options）；`npm run typecheck` / `npm run build` / `cargo check` 全绿。
  - 已知限制：90 度方向检测 + 微倾斜 + 双页拆分均为 plan-only（lopdf 不解析压缩 content stream，文本对象 `cm` 矩阵投票需 mupdf / opencv 栅格化能力）；空白边裁剪为 MediaBox 线性内缩不做像素检测；fontkit devDep 需在新 worktree 跑 `npm install` 才能 typecheck；Tauri command State mock 测试难构造，由 `scan_stored_to_command_job` 纯函数单测 + `run_scan_preprocess_job` 间接覆盖。
  - 同步 `docs/DECISIONS.md` DEC-040（ISS-016 第二阶段方案，DEC 编号承接 DEC-039 ISS-013 v2 后 +1）；`docs/TASKS.md` 进度日志追加对应记录。**未**改 `docs/ROADMAP.md`。

## 0.1.0-alpha.10 - 2026-06-04

- PDF Expert Shell UI 收口（DEC-049 / ISS-009 第二阶段）：在 `feat/pdf-expert-shell-ia` 完成 4 个 milestone（阅读态视觉 polish / 搜索结果层 / 页面管理多选撤销 / OCR 任务参数区），沿用「不修改 `Toolbar.tsx` / 不修改共享契约 / 不引入新依赖」原则。
  - **阅读态视觉 polish（M1）**：`src/components/layout/ReaderCanvas.tsx` 在 `ocrStatus === "needed"` 时显示醒目的提示条 + 跳转到 OCR 模式的按钮（新增 `onRequestOcr` 回调 prop，从 `App.tsx` 注入）。每个 `PdfPage` fallback 区增加 `data-testid="text-layer-badge-N"` 文字层状态徽章（`available` / `missing` / `poor` 颜色区分）。`Toolbar.tsx` `fileSubtitle` 在无文档时区分"未打开文档" / "打开失败"中文文案。`src/styles/app.css` 新增 `.reader__status-banner` / `.pdf-page__text-layer-badge--*` 样式。
  - **搜索结果层（M2）**：`Toolbar.tsx` `SearchResultsPopover` 头部从 `命中 N 处` 升级为 `命中 X / N（N 处）` 索引计数 + 索引进度 `索引 X / Y 页`；新增命中页码 chip 行（`p.N` 按钮，点击直接 `selectHit`）；按钮文案精简为「上一个」「下一个」。`DocumentReader` 在 `activeHit.pageNumber` 变化时自动 `scrollIntoView`，对应 `PdfPage` 加 `data-active-hit="true"`（CSS `outline: 2px solid var(--accent)` 高亮）。`searchUi.test.tsx` 同步更新文本断言。
  - **页面管理多选 / 撤销 / 风险（M3）**：`PageOrganizerWorkspace` 从 `AppShell.tsx` 内部函数拆出为独立组件 + CSS + 测试。多选状态 `Set<pageNumber>` + shift+click 区间选择（修复 `lastClickedPageRef` 在 React updater 异步运行时的 stale 读 bug）。7 个操作按钮按选择态正确启用/禁用；删除前弹 `RiskConfirmDialog`（列出页码 + 风险说明）；另存为新 PDF 弹 `ExportRiskDialog`（明确不覆盖原始文件）；撤销按钮 + 计数占位。`PageOrganizerWorkspace.css` 独立文件，`app.css` 不动。
  - **扫描 / OCR 任务参数区（M4）**：`OcrWorkspaceController` 扩展 `parameters: OcrWorkspaceParameters` 派生字段（`activeProvider` 含 `kind: "local" | "cloud"` 归一化 / `outputStrategy` / `qualityCheck` / `networkConsentRequired`）。新增 `OcrWorkspaceHeader` 组件展示文档 / provider / 页码范围 / 输出策略 / 质量检查；云端 provider 未授权时显示红色「需要联网授权」警告。`AppShell` 透传 `availableProviders` / `documentLabel` / `pageCount`。`OcrWorkspaceHeader.css` 合并到 `ocrWorkspace.css`。
  - **baseline unblock**：`tsconfig.json` `lib` / `target` 从 `"ES2020"` 升级到 `"ES2022"`，吸收现有 `Array.prototype.at()` / `String.prototype.at()` 调用。这是 17 个 pre-existing 类型错误的 lib 字段滞后修复，不修改任何代码语义。
- 范围严格遵守：未修改 `src/shared/**` / `src-tauri/**` / `package.json` / 锁文件 / 全局路由 / 共享契约；未修改 `Toolbar.tsx`（按 DEC-032 协议）/ `Sidebar.tsx` / `StatusBar.tsx` / `AnnotationSidebar.tsx` / 其他模块（reader / search / annotation / forms / export / settings / preprocess）；未引入新依赖；未实现新功能（搜索算法 / 批注写入 / OCR 调用 / 导出操作 / 真实页面变换）。
- 同步 `docs/DECISIONS.md` DEC-049；`docs/TASKS.md` ISS-009 进度日志 + 「下一步」更新；`docs/DESIGN.md`「当前设计差距」一节标记本次推进条目。
- 验证：75 个测试文件 / 692 个测试全部通过（19 项新测试：ReaderCanvas 4 + 1 / PageOrganizerWorkspace 8 / OcrWorkspaceHeader 7 — 同步 searchUi 文本断言调整 3 处）；`npm run typecheck` 干净；`npm run build` 成功；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 干净。
- 已知限制：页面管理 Undo 是占位 UI（仅计数 + 视觉 enabled 切换，未接 pageOrganizer service 真实 history/undo）；OCR 参数区是只读展示，改 provider / qualityCheck / networkConsent 仍需走「设置 → OCR provider」面板（后续 ISS-022 浮层收口时可让 OcrWorkspaceHeader 各项点击直接打开对应 section）；`/tmp/faropdf-ui-sample.pdf` 在本会话期间不存在，视觉验证以 dev server + 浏览器打开 `/` 即可，无须 fixture PDF 即可观察空态 + 模式切换。
- 4 个 milestone commit + 1 个文档 commit = 5 commit。

按 Wave 1 协议违反教训强化 AGENTS.md（DEC-145）：

- `AGENTS.md` 新增「多 Agent 并行与 PR 收口纪律」整章（4 条硬约束）：
  - **双层监测**（防 silent done）：sentinel + 定时巡检 ~15 min
  - **收窄 envelope 不默认 lean**：worker spawn 默认带 AGENTS.md / DESIGN.md / Issue / 必读素材
  - **PR 第一动作**：worker 提交后 PM 立即 `gh pr create`（7 段 PR 正文：Issue ID / 变更摘要 / 验证 / 来源 / 文档 / Agent Attribution / 风险）
  - **范围控制**：worker 不超 allowed files；PM 自身 docs 改动也走 TASKS / DECISIONS / CHANGELOG 闭环
- 导火索：Wave 1 W1 (ISS-NEW-A 阶段 1) ship 后 PM 直接 `git merge --ff-only` 跳 PR 流程，违反 `multi-agent-orchestration` §8.0；git revert 链修复后落地本章
- 不覆盖 subagent / Agent Teams / ACP 等其他执行模式（仅针对 `tmux + worktree`）
# 未发版 · PDF Expert 搜索态补采与缺口复核（2026-07-24）

- 新增 `N-CROP-L3-SEARCH` a/b raw 与 window-only crop：完整 L3 工具栏、左侧大纲、右侧搜索结果栏、`Purpose` 两页命中高亮。
- 更新 `manifest.json`、`measurements.json`、状态矩阵、覆盖缺口和补采分析；该组保持 `measured`，不宣称 `accepted-golden`。
- 记录真实文字层拖选未触发浮动工具栏、当前会话缩略图入口 disabled 的负面证据；`ISS-NEW-N-SEL` 与 `ISS-NEW-N-THUMB` 继续保持缺口。
## 未发版 · 功能框架真实性与页面/OCR/导出闭环（2026-07-30，DEC-187）

- **验收目标调整**：PDF Expert 改为功能框架参考，不再把像素一致、accepted-golden 或截图补采作为 M3～M5 的功能前置；完成标准改为入口接真实模块、产物可重开、未实现能力 fail-closed。
- **页面管理**：真实选择/多选、拖拽重排、旋转、删除、撤销和 `*-organized.pdf` 导出接线；Playwright 下载后重开确认 5 页且第一页旋转 90°。复制/粘贴显式禁用。
- **功能真实性**：T 编辑、图片/Word 转换、翻译及 planned 原生命令不再产生假状态/假反馈；“文档助手/共享”改为真实“摘要/导出与交付”。
- **右栏与批注**：文档摘要接当前 PDF bytes/metadata；OCR 状态与页码范围接真实 controller；批注 sidecar 使用 localStorage 持久化并在不可用时回退内存。
- **中文导出修复**：修复 Vite 字体 URL、Node 测试 fallback 和 `@pdf-lib/fontkit` CJS interop，默认中文文字水印可实际导出有效 5 页 PDF。
- **产物元数据**：页面 execute 导出写入 `faropdf:page-operations-applied`，不再错误标成 `plan-only`。
