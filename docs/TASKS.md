# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。已完成的 ISS 任务卡归档到 `docs/DECISIONS.md` 的「ISS 任务归档」一节。

## 推进策略

`docs/TASKS.md` 是 FaroPDF 仓的活跃任务入口：当前正在推进、待开工或暂缓的任务保留详细任务卡；已经完成或第一版已合并的任务迁移到 `docs/DECISIONS.md` 的「ISS 任务归档」，TASKS.md 本身保持精简。

**跨仓任务边界**：FaroPDF 只追踪 Tauri 桌面应用本身的工作（PDF 阅读 / 检索 / 批注 / OCR / 页面整理 / 导出 / 表单 / 设置 / 发布工程 等）。跨仓任务示例：

- 杨卫薪律师个人主页 + 两产品展示 → 在 `cat-xierluo/cat-xierluo.github.io`（personal-site）仓的 `docs/TASKS.md` 追踪，对应 ISS-001~ISS-012（v0.1.0-alpha.8 + i18n + Legal Skills 集成已落定）。FaroPDF 仓不重复登记。
- 跨仓 cleanup（personal-site 官网占位 / README 同步等）已合到 FaroPDF `## Unreleased` 历史段（DEC-058 / DEC-062），不作为活跃任务。

### 基础状态门槛

满足以下条件后，才进入多 worktree 并行：

- Tauri v2 + React + TypeScript + Vite 应用可启动。
- `typecheck`、测试、构建命令可运行。
- PDF 阅读器主工具栏、按需左侧工具区、上下文工具条、页面管理工作台、状态栏和设置入口存在。
- `PdfDocumentState`、`PdfPageViewport`、`PdfAnnotation`、`PdfPageOperation`、`PdfExportJob`、`OcrProviderConfig`、`OcrJob`、`AppSettings` 等共享契约已落盘。
- `src/modules/` 下 reader、search、annotation、pages、export、ocr、forms、settings 模块边界已建立。
- worker 文件范围和验证命令已写入对应任务。

### 并行执行 + Worktree 分组

分支命名、worktree 路径、worker 范围隔离、PM 收口流程、Wave 调度规则等**通用规范全部见 `multi-agent-orchestration` skill**（项目级 `.claude/skills/multi-agent-orchestration/SKILL.md`）的 §3 标准流程 / §3.1 Wave-Based / §4 命名规则 / §8 收口。本文件不再重复表述，避免上下文冗余。

FaroPDF 特定的额外约束（不在 skill 里、必须保留）：

- `package.json`、锁文件、`src-tauri/`、`src/shared/`、`src/App.tsx`、全局样式和路由由 foundation 或 PM 统一收口（不随意散到各 worker）。
- 不得把 Agent skill CLI 流程原样变成 UI 逻辑；脚本只能作为算法来源、后台 bridge 或 sidecar 参考。

历史上已合并的合并组（v0.1 阶段）：

- `feat/foundation-scaffold`：ISS-001、ISS-011、ISS-012（已合并到 main）
- `feat/pdf-output-tools`：ISS-005、ISS-013
- `feat/ocr-pipeline`：ISS-007、ISS-016、ISS-017
- `feat/page-organizer-suite`：ISS-006、ISS-018、ISS-019
- `feat/app-distribution`：ISS-021
- `feat/settings-page`：ISS-022、ISS-023

## v0.2.0 发布后实机回归缺陷（2026-08-04，ISS-QA-01 ~ ISS-QA-06）

> **批次状态**：[草案] 排查完成、任务卡已细化，待开工。
> **来源**：用户实机安装 v0.2.0 后回归测试发现（2026-08-04 口述反馈）。
> **排查方法**：PM 单 session 静态读码（`AppShell.tsx` / `Toolbar.tsx` / `ReaderCanvas.tsx` / `WelcomeScreen.tsx` / `pdfjsWorker.ts` / `src-tauri/src/lib.rs` / `commands.ts` / `capabilities/default.json`）+ grep 定位，**未启动 dev / 打包应用**。凡未在打包产物中实机复现的根因均标注 `NOT_VERIFIED`，修复 worker 必须先在打包环境复现再改。
> **完成线**：功能项以 `behavior-complete` 为准（真实交互断言 + 打包产物验证；worker 自述 / typecheck / 单测 / build 不单独构成完成证据）；UI 项额外要求 `符合 docs/DESIGN.md`；未实现入口必须 **fail-closed**（明确禁用 + tooltip，非静默无响应）—— 见项目 AGENTS.md「UI 与多 Agent 协作门禁」。
> **验证环境**：ISS-QA-01 / 02 / 04 / 06 必须在 `npm run tauri build` 产物里验证（dev 与打包行为可能不同，ISS-QA-02 根因即 dev/prod 差异）；ISS-QA-03 / 05 可在 dev + typecheck 验证。
> **安全边界**：所有修复不得覆盖用户原始 PDF；新增打开路径走「读 bytes → 渲染」，不写回原文件（项目 AGENTS.md「PDF 安全边界」）。
>
> **worktree 分组建议**（项目 AGENTS.md「多 Agent 编排」）：
> - 可同组并行（文件不重叠）：ISS-QA-03（纯 tsx 换图标）+ ISS-QA-05（纯 css token 归一）。
> - 必须顺序或合并（共享 `src-tauri/src/lib.rs`）：ISS-QA-01（Rust 加 DragDrop）与 ISS-QA-06（Rust 加 `settings-open` 菜单）都改 lib.rs，**禁止同 worktree 并行**，建议同一 Rust 改动 PR 顺序推进。
> - 共享 `AppShell.tsx` / `Toolbar.tsx`：ISS-QA-04（命令路由）与 ISS-QA-06（工具栏入口）有重叠，**同一 owner 顺序推进**。
> - 独立：ISS-QA-02（pdfjs worker / vite 配置）单独 PR。
>
> **推进顺序**：QA-06（解锁设置可达）→ QA-02（核心阅读，打包复现）→ QA-01（核心入口）→ QA-04（功能展开，工作量最大）→ QA-03 / QA-05（视觉收尾，可并行）。

### 缺陷总览

| id | 现象 | 严重级 | 根因摘要（证据） | 主改动文件 | 完成线 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| ISS-QA-01 | 拖入 PDF 不打开 | [P0] | HTML5 onDrop 收不到系统文件；lib.rs 无 DragDrop | `lib.rs` + `App.tsx` | behavior-complete | [已修复 2026-08-04] Rust DragDrop emit + 前端 listen 复用 readPdfFileFromPath，typecheck/cargo check 过，GUI 待验 |
| ISS-QA-02 | 打开显示「未知」+ 慢 + 缩略图不可用 | [P0] | 实机「未知」= worker 失败（W2 §0.4 origin 隐患），非 InvalidPDF；workerSrc 字符串不稳 | `pdfjsWorker.ts` | behavior-complete | [workerPort 修复 2026-08-05] workerSrc→workerPort Worker 实例，待实机确认 |
| ISS-QA-03 | 界面 emoji | [P1] | 5 文件 6 处 emoji 字面量 | 5 个 tsx | grep 清零 + 视觉 | [已修复 main 8c5cc01 2026-08-04] 7 处→lucide，typecheck/lint 过，GUI 待验 |
| ISS-QA-04 | 批注/编辑/导出/OCR 点击无展开 | [P0] | mode 切换强关 panel（路径B executeCommand 1134-1138）+ stub + width 待查 | `AppShell.tsx` | behavior-complete | [已修复 2026-08-04] Fix-1 mode-aware 不强关（forms→FormsPanel），typecheck 过；stub 完整 fail-closed 需改 Toolbar（后续 ISS）+ width(panelWidthStore)待 shared 核查；GUI 待验 |
| ISS-QA-05 | 左侧边栏颜色不统一 | [P1] | Sidebar 多 panel token 未归一 | `Sidebar.tsx` + `app.css` | 符合 DESIGN.md | [已修复 main 8c5cc01 2026-08-04] 10 个 `--panel-*` token，typecheck/lint 过，GUI 待验 |
| ISS-QA-06 | 设置入口不见了 | [P0] | 入口藏在二级菜单；原生菜单未注册 | `Toolbar.tsx` + `lib.rs` | behavior-complete | [已修复 main 13974db 2026-08-04] 工具栏常驻齿轮 + 文件菜单 settings-open，typecheck/cargo check 过，GUI 待验 |

---

### ISS-QA-01　PDF 文件拖入窗口不打开　[P0]

- **状态**：[待开工]　**类型**：缺陷修复　**完成线**：behavior-complete
- **现象（用户视角）**：从系统 Finder / 邮件附件把 `.pdf` 拖到 FaroPDF 窗口，无任何反应，文档不打开。律师高频从 Finder 拖卷宗，是核心入口。
- **根因**：
  - 前端三处拖拽走 HTML5 `onDrop` + `event.dataTransfer.files`：`ReaderCanvas.tsx:257`、`WelcomeScreen.tsx:59`、`ReaderErrorScreen.tsx:54`。
  - Tauri v2 webview 中，**从系统拖入的文件不进入浏览器层 `dataTransfer.files`**——系统级文件拖拽是 webview 级事件，必须由 Rust 监听 `WindowEvent::DragDrop`（或 `tauri-plugin-drag`），把路径 emit 给前端。
  - `src-tauri/src/lib.rs` 全文 grep 仅有 tab drag detach（`create_faropdf_window`）和 RAII guard，**无任何 DragDrop / file-drop 事件处理**。拖入时 `dataTransfer.files` 为空 → `find()` 返回 undefined → `onOpenFile` 不触发 → 完全匹配「拖入无反应」。
  - 验证状态：根因 PLAUSIBLE（Tauri v2 行为 + grep 证据），**未打包复现**。
- **输入依赖**：
  - 前端需有「路径 → 读 bytes → `loadPdfFromBytes`」链路；注意 `AppShell.tsx:1263` 注释「真实路径打开（reader.openFile + 路径寻址）由后续 worker 接入」——可能需同时补 `readPdfFileFromPath` 前端入口（Rust 侧 `read_pdf_file_from_path` 已存在，见 CHANGELOG DEC-194）。
  - 若新增前端路径读取，确认 `capabilities/default.json` 走既有 Rust command，避免新开 fs 权限面。
- **范围**：
  - in scope：Rust 监听 DragDrop + emit 路径；前端 App 层监听并调用既有打开链路；保留 HTML5 onDrop 作 web 降级。
  - out of scope：拖入多文件批量打开（本轮单文件）；拖入非 PDF 的转换（图片/Word 转 PDF 属 ISS-NEW-G 占位）。
- **推进步骤**：
  1. **复现**：`npm run tauri build`，从 Finder 拖 PDF 到窗口，确认无反应 + devtools 看 `dataTransfer.files` 为空。
  2. **Rust**：在 `lib.rs` `setup` / `on_window_event` 监听 `WindowEvent::DragDrop`，过滤 `.pdf`，emit 事件（含路径）到前端。
  3. **前端**：App 层（`App.tsx` 或 `AppShell`）`listen` 该事件 → 取首个 `.pdf` 路径 → 调既有「路径 → bytes → `loadPdfFromBytes`」（缺则补 `readPdfFileFromPath` 入口）。
  4. **保留** HTML5 `onDrop` 作浏览器/web 降级，不删。
- **验收标准（behavior-complete）**：
  - [ ] 打包产物：从 Finder 拖入正常 PDF → 正常打开渲染（页码/视图状态与「打开」按钮一致）。
  - [ ] 拖入非 PDF → 忽略（不报错、不闪退）。
  - [ ] 拖入损坏 PDF → 命中 ISS-QA-02 错误卡片而非静默。
  - [ ] dev 模式（浏览器降级）HTML5 onDrop 仍可用。
- **证据载体**：打包后 Playwright/手测截图 + console 无 error；路径脱敏不写日志。
- **验证命令**：`cd src-tauri && cargo check`；`npm run typecheck`；`npm run tauri build` 后实机拖拽。
- **阻塞 / 剩余**：若 `readPdfFileFromPath` 前端入口缺失，需先补（小工作量）。
- **worktree**：与 ISS-QA-06 共享 `lib.rs`，顺序推进或合并到一个 Rust PR。

---

### ISS-QA-02　打开 PDF 显示「损坏的文件」　[P0]

- **状态**：[待开工]　**类型**：缺陷修复　**完成线**：behavior-complete
- **现象（用户视角）**：用「打开」按钮选择正常 PDF（其它阅读器可正常打开），FaroPDF 内显示「损坏 / 无法打开」。
- **根因（[原假设已被 W2 证伪 REFUTED 2026-08-04，下方原记录保留作历史；Wave 4 必须先读 `docs/QA-02-repro-report.md` 判 A/B 再改代码]）**：
  - worker 配置 `pdfjsWorker.ts:1`：`import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url"`，`pdfjs-dist@6.0.227`。
  - Vite `?url` 在 dev 解析为 `http://localhost:1420/...`（正常）；**打包成 Tauri app 后** `frontendDist` 走 `tauri://` / `asset://`，module worker 在自定义协议下加载失败或路径漂移 → `getDocument` 中断 → 抛 `InvalidPDFException`。
  - 异常经 `shared/error.ts:60` `classifyPdfjsException` 归一化为 `PdfParseError`，命中 DEC-192「无法打开此 PDF」错误卡片。
  - `tauri.conf.json` `csp=null`（排除 CSP）；「打开」走 File → `loadPdfFromBytes`（`AppShell.tsx:729`），不依赖 fs，故 fs 权限不解释此现象。
  - 验证状态：根因 **NOT_VERIFIED**，dev vs prod 对比是关键实验。
- **输入依赖**：pdfjs-dist 6 worker 加载机制；vite `?url` 在 Tauri asset 协议下的行为；`config/vite.config.ts`。
- **范围**：
  - in scope：修正 worker 在打包产物下的加载方式；确保 dev/prod 一致。
  - out of scope：pdfjs 版本升级（除非证实是 6.x 兼容 bug）；PDF 内容修复（只修加载，不改 PDF）。
- **推进步骤**：
  1. **复现（关键，先做）**：`npm run tauri dev` 打开正常 PDF（预期正常）→ `npm run tauri build` 产物打开同一 PDF（预期显示损坏）→ devtools 看 worker 加载错误 / 是否 fallback fake worker。**若 dev 也损坏，根因另寻**。
  2. **样本**：测 ≥3 份不同来源 PDF（扫描件 / 文字层 / 解密后），排除 pdfjs-dist 6 对特定 PDF 的兼容问题。
  3. **修复（候选，按复现结果选）**：改用 `new Worker(new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url), { type: 'module' })` + `GlobalWorkerOptions.workerPort`；或确保 worker 资产正确拷贝到 `dist/` 且在 asset 协议下路径可解析（查 `config/vite.config.ts`）。
  4. **验证**：dev + 打包产物都能正常打开测试 PDF。
- **验收标准（behavior-complete）**：
  - [ ] 打包产物打开 ≥3 份不同来源正常 PDF 均正常渲染。
  - [ ] dev 与 prod 行为一致。
  - [ ] 真正损坏的 PDF 仍正确命中 DEC-192 错误卡片（不误判正常 PDF）。
- **证据载体**：dev/prod 对照截图 + devtools worker Network/Console 输出。
- **验证命令**：`npm run typecheck`；`npm run tauri dev`；`npm run tauri build` 后实机打开。
- **阻塞 / 剩余**：根因未复现前不要改代码（避免盲改）。
- **worktree**：独立 PR（pdfjs worker / vite，与其他 QA 文件不重叠）。

---

### ISS-QA-03　界面 emoji 清理（统一换 lucide 图标）　[P1]

- **状态**：[待开工]　**类型**：体验修复　**完成线**：grep 清零 + 视觉确认
- **现象（用户视角）**：界面多处 emoji 字面量，与「律师专业工具」定位不符，显得不够高级。
- **根因（已确认）**：5 文件 6 处 emoji 字面量未走图标库：
  - `ReaderErrorScreen.tsx:86` 密码锁 emoji（密码输入框）
  - `WelcomeScreen.tsx:85` 图片 emoji、`:96` 文档 emoji（转换卡片）
  - `TextSelectionToolbar.tsx:52` 便签 emoji（glyph）
  - `AnnotationSidebar.tsx:23` 便签 emoji、`Sidebar.tsx:58` 便签 emoji（note 标记）
- **输入依赖**：`lucide-react@1.17.0`（已在依赖）。映射：密码锁→`Lock`、图片→`Image`、文档→`FileText`、便签→`StickyNote`（或 `MessageSquare`）。
- **范围**：
  - in scope：上述 6 处替换为 lucide 图标，保持 `aria-hidden` / a11y；补查 CSS `content:`、`public/`、`index.html` 残留 emoji。
  - out of scope：图标体系重设计（仅 1:1 替换）；新增图标颜色/尺寸规范（属 DESIGN 范畴）。
- **推进步骤**：
  1. 逐处替换 emoji 为对应 lucide 组件，保持现有布局（图标尺寸对齐 `size={16}` 等）。
  2. `grep -rPn` 覆盖 `src/` + `public/` + `index.html`（含 CSS `content:`）确认无残留。
  3. dev 视觉确认 5 处渲染正常（无错位/留白）。
- **验收标准**：
  - [ ] grep `src/` + `public/` + `index.html` 无 emoji 残留（CJK / ASCII 标点除外）。
  - [ ] 打包界面 5 处图标正常渲染，无 emoji。
  - [ ] `npm run typecheck` + `npm run lint` 过。
- **证据载体**：替换前后对照截图；grep 输出。
- **验证命令**：`npm run typecheck`；`npm run lint`；`npm run dev` 视觉确认。
- **worktree**：可与 ISS-QA-05 同组并行（纯前端，文件不重叠）。

---

### ISS-QA-04　批注/编辑/导出/扫描与文本识别点击后无功能展开　[P0]

- **状态**：[待开工]　**类型**：缺陷修复（多因）　**完成线**：behavior-complete
- **现象（用户视角）**：工具栏点击「A 批注 / T 编辑 / 导出 / 扫描和文本识别」等模式或菜单项后，没有对应功能面板/工具条展开。
- **根因（多因，需实机分项走查）**：
  1. mode 按钮接线正常：`Toolbar.tsx:155-188`（A 批注 `:161` / 导出 `:181` / OCR `:187`）`onClick={enterMode}` → `onModeChange`（`:63`）。但工作流按钮 `disabled={!document}`——**未打开 PDF 时点击无反应**（可能被误判为坏了）。
  2. 切 mode 时 utility panel 被强关：`AppShell.tsx:1134-1138`，`else if (group=export/forms/mode 非 annotate)` → `onUtilityPanelChange("none")`，视觉上「什么都没展开」。
  3. 大量子命令是 stub：AppShell 多处 `setCommandFeedback("…待后续 worker 接入…")`（`:856/:901/:911/:938/:1252/:1257/:1263`），点击只弹 toast 不展开真实功能（CHANGELOG 标注为 v0.2 占位）。
  4. ContextToolbar/RightPanel 不连贯：`showContextToolbar` = `activeMode!=="pages" && !="ocr"`（`:191-192`，OCR 无 L4）；RightPanel `ocr→ocr-queue`、`export→export-preview`（`:254-255`），但若 RightPanel 折叠/宽 0，感知为「没展开」。
  - 验证状态：根因 PLAUSIBLE（多因叠加），需实机走查后拆子任务。
- **输入依赖**：`AppShell.tsx` 命令路由；`ContextToolbar` / `RightPanel` / `UtilityPanel` 三栏渲染条件；既有 `verify:ui-layout` + Playwright。
- **范围**：
  - in scope：实机走查每个 mode 切换后三栏 DOM，区分「按钮 disabled / panel 被关 / stub 占位 / panel 折叠」四类并分别处理；重审 `:1136-1137` 强关逻辑。
  - out of scope：把所有 stub 实装成真功能（本轮只让入口语义清晰 + 面板正确展开，真实功能实装另立 ISS）。
- **推进步骤**：
  1. **走查（先做）**：打开任一 PDF，逐个点击 A 批注 / T 编辑 / 导出 / 扫描和文本识别 + 各子菜单，用 Playwright/手测记录每个 mode 切换后 ContextToolbar / RightPanel / UtilityPanel 的实际 DOM（复用 `npm run verify:ui-layout`）。产出「四类分类表」。
  2. **分类处理**：按钮 disabled → 补 tooltip「请先打开 PDF」（fail-closed）；panel 被强关 → 修 `:1136-1137` 让进 export/ocr 等模式时展开对应 RightPanel；stub 占位 → 未实装统一 disabled + tooltip「未实装」；panel 折叠 → 确保 RightPanel 进模式后有默认宽度/可见。
  3. **验证**：每个 mode 都有可见功能面板或明确 disabled + 原因。
- **验收标准（behavior-complete）**：
  - [ ] 打开 PDF 后，A 批注 / T 编辑 / 导出 / 扫描和文本识别每个 mode 都有可见功能面板或工具条展开。
  - [ ] 未实装入口明确 disabled + tooltip 说明（fail-closed），无静默无响应。
  - [ ] `npm run verify:ui-layout` 通过（如有相关断言）。
- **证据载体**：走查分类表 + 修复前后 Playwright 截图；console 无 error。
- **验证命令**：`npm run typecheck`；`npm run verify:ui-layout`；`npm run tauri build` 实机。
- **阻塞 / 剩余**：工作量最大，建议走查后拆成 ISS-QA-04a / b / c 子任务。
- **worktree**：与 ISS-QA-06 共享 `AppShell.tsx` / `Toolbar.tsx`，同一 owner 顺序推进。

---

### ISS-QA-05　左侧边栏各 panel 颜色不统一　[P1]

- **状态**：[待开工]　**类型**：视觉修复　**完成线**：符合 docs/DESIGN.md
- **现象（用户视角）**：左侧边栏「书签 / 大纲 / 批注列表 / 缩略图」等 panel 背景/边框/标题色各自为政，视觉不统一。
- **根因（已确认）**：`Sidebar.tsx` 多 panel（BookmarkPanel / DocumentSummaryPanel / ViewSettingsPanel / AnnotationSidebar / 缩略图）各自 className（`utility-panel view-settings`、`bookmark-panel` 等），背景/标题样式未归一到同一组 design token。
- **输入依赖**：`src/styles/app.css`（token 定义）；`docs/DESIGN.md`（侧栏色板基线，若无则按 DEC-186 中性深色壳层定 baseline）。
- **范围**：
  - in scope：盘点 Sidebar 所有 panel 容器样式，归一到统一 utility-panel token（背景/内边距/标题字号色/分隔线）。
  - out of scope：重设计侧栏布局结构；新增 panel。
- **推进步骤**：
  1. 盘点：列出 Sidebar 下所有 panel className + 实际生效背景/边框/标题色。
  2. 定 baseline：查 `docs/DESIGN.md` 侧栏色板；未规定则按 DEC-186 中性深色壳层定一组 token（小 DESIGN 决策，记 `docs/DECISIONS.md`）。
  3. 在 `app.css` 定义统一 utility-panel token，各 panel 复用。
  4. read / annotate / edit 三模式 + 深/浅主题视觉确认。
- **验收标准**：
  - [ ] 书签/大纲/批注列表/缩略图四 panel 在 read/annotate/edit 同模式下背景、标题、分隔线视觉一致。
  - [ ] 深浅主题切换一致。
  - [ ] `符合 docs/DESIGN.md`（或补 DESIGN baseline）。
- **证据载体**：三模式 × 深浅主题截图对照。
- **验证命令**：`npm run typecheck`；`npm run dev` 视觉确认。
- **worktree**：可与 ISS-QA-03 同组并行（纯前端 css/tsx）。

---

### ISS-QA-06　设置页面入口不见了　[P0]

- **状态**：[待开工]　**类型**：缺陷修复　**完成线**：behavior-complete
- **现象（用户视角）**：在界面上找不到「设置」入口，无法进入设置（OCR 后端、语言、偏好等全部不可达）。
- **根因**：
  - 设置唯一 UI 入口埋在工具栏二级「工具启动器」下拉：`Toolbar.tsx:281` `<button className="tool-launcher-menu__settings">`，`onClick={onOpenSettings}` → `openUtilityPanel("settings")`（`:198`）。该 launcher 由 `toolsMenuOpen` 控制，触发按钮可见性**存疑**（可能折叠/条件错误，用户打不开二级菜单）。
  - **原生菜单栏未注册 `settings-open`**：`lib.rs` grep 仅 `:984` `view-settings`，无 `settings-open`。
  - 命令定义本身对：`commands.ts:781-788` `settings-open` 有 `targetUtilityPanel:"settings"`；`SettingsPanel`（`AppShell.tsx:1497`）`open={utilityPanel==="settings"}`。即只要把 utilityPanel 切到 "settings" 就能打开——纯粹缺显式入口。
  - 验证状态：根因 PLAUSIBLE，launcher 触发按钮可见性需实机确认。
- **输入依赖**：`Toolbar.tsx`（工具栏布局）；`lib.rs`（原生菜单注册）；既有 `settings-open` 命令 + `SettingsPanel`。
- **范围**：
  - in scope：工具栏加常驻 Settings 齿轮入口（直接 `openUtilityPanel("settings")`）；原生菜单补 `settings-open` 注册；确认/修复 launcher 触发按钮可见性。
  - out of scope：SettingsPanel 内容改造；设置项新增。
- **推进步骤**：
  1. **实机确认**：`npm run tauri dev` / build，看工具栏能否看到「工具启动器」下拉触发器，确认用户为何找不到。
  2. 工具栏右侧（collaboration / right 段）加常驻 Settings 齿轮按钮，直接打开设置，不再藏二级菜单。
  3. `lib.rs` 原生菜单（FaroPDF 菜单 / 文件菜单）补 `settings-open` 注册 + event handler match arm。
  4. 决定 launcher 路径去留（修复可见性 or 废弃二级菜单）。
- **验收标准（behavior-complete）**：
  - [ ] 工具栏可见齿轮入口 + 原生菜单项两条路径都能打开 SettingsPanel。
  - [ ] 设置浮层正确渲染、可关闭、可切 section。
  - [ ] `npm run typecheck` + `cargo check` 过。
- **证据载体**：工具栏齿轮 + 原生菜单打开设置的截图。
- **验证命令**：`npm run typecheck`；`cd src-tauri && cargo check`；`npm run tauri build` 实机。
- **worktree**：与 ISS-QA-01 共享 `lib.rs`、与 ISS-QA-04 共享 `Toolbar.tsx` / `AppShell.tsx`，顺序推进。

---

### 后续延伸 ISS（W5 走查 ISS-QA-04 时发现，2026-08-04）

> ISS-QA-04 核心已修（Fix-1 mode-aware，main `f54d43a`）。完整 fail-closed + 右栏宽度核查需改 forbidden 域（Toolbar / shared），W5 worker 不能动，另立以下延伸 ISS。

#### ISS-QA-04a　stub 入口完整 fail-closed（改 Toolbar / commands.ts）　[P1][体验]　[待开工]

- **现象**：批注辅助 9 命令 / view-toggle / ocr-enhance-all / forms-flatten 等 stub 子命令点击只弹 toast「待接入」，未 disabled + tooltip，fail-closed 不完整。
- **根因**：disabled + tooltip 需在 `src/components/layout/Toolbar.tsx`（mode 按钮渲染）+ `src/shared/app/commands.ts`（`availability` 字段）配置，W5 forbidden 域。
- **范围**：`Toolbar.tsx` + `commands.ts`（`availability: "planned"`）。
- **证据**：W5 RESULT §1 分类 ③。

#### ISS-QA-04b　右栏宽度 panelWidthStore 默认值核查（src/shared）　[P1][体验]　[待开工]

- **现象**：右栏 export-preview / ocr-queue 渲染真实面板，但若 `panelWidthStore` 默认 right 宽度 = 0，视觉折叠（看似「没展开」）。
- **根因**：NOT_VERIFIED（W5 无法读 `src/shared` forbidden）；需核查 `panelWidthStore` 默认值 + `showRightPanel` 宽度派生。
- **范围**：`src/shared`（panelWidthStore）+ 可能 `AppShell.tsx`。
- **证据**：W5 RESULT §1 分类 ④。

---

### v0.2.0 实机回归批次 2（2026-08-05 用户 GUI 实机反馈，ISS-QA-07 ~ ISS-QA-16）

> 来源：用户 dev 实机验证 ISS-QA-01~06 后的新反馈。**已确认修好**：QA-01 拖入（慢但可）、QA-06 设置入口。**修复中**：QA-02 打开「未知」（workerPort）。其余为 UI/UX/定位/配置新涌现，根因多待静态排查（吸取教训：先静态 review 再实机，不浪费用户时间）。

#### 缺陷总览

| id | 现象 | 优先 | 主改动文件（推断） | 状态 |
| --- | --- | --- | --- | --- |
| ISS-QA-07 | 批注工具（高亮/下划线/删除线）出现在左上角，位置不对 | P1 | Toolbar / ContextToolbar / AnnotationToolbar CSS | 待排查 |
| ISS-QA-08 | 批注有二级菜单、编辑没有（不一致） | P1 | Toolbar / commands.ts submenu | 待排查 |
| ISS-QA-09 | 导出二级菜单很怪 | P1 | Toolbar / commands.ts | 待排查 |
| ISS-QA-10 | 填写签名没居中一致 | P1 | SignaturePanel / FormsPanel CSS | 待排查 |
| ISS-QA-11 | 扫描与文本识别配置页结构混乱 | P1 | OcrPanel / OcrWorkspace / RightPanel | 待排查 |
| ISS-QA-12 | 扫描右侧加号按钮功能多/分类乱/与其他页重复 | P1 | ToolLauncherMenu（Toolbar 加号）/ commands | 待排查 |
| ISS-QA-13 | 设置页 UI 参照 Folia（当前选项背景光泽难看） | P1 | settings/*.css | 待设计（参照 Folia） |
| ISS-QA-14 | 关于界面参照 Folia（介绍 + 个人信息） | P1 | AboutSection | 待设计（参照 Folia） |
| ISS-QA-15 | 定位改「面向知识工作者」（去律师/卷宗） | P1 | README / package.json / 关于 / WelcomeScreen | 待改 |
| ISS-QA-16 | OCR endpoint 默认填 | P2 | defaults.ts | MinerU 已填默认；PaddleOCR 无默认（自部署） |

---

#### ISS-QA-07　批注工具出现在左上角（位置不对）　[P1][待排查]
- 现象：批注工具（高亮/下划线/删除线）出现在窗口左上角，非工具栏批注 mode 的 L4 位置。
- 待排查：Toolbar mode 段 / ContextToolbar（annotate L4）/ AnnotationToolbar 渲染挂载点 + CSS 布局；可能浮动/错位。
- 验收：批注工具在批注 mode 的 L4 工具条位置，不浮在左上角。

#### ISS-QA-08　批注有二级菜单、编辑没有（不一致）　[P1][待排查]
- 现象：批注按钮有二级菜单（形状 submenu 等），编辑按钮没有。
- 待排查：Toolbar annotate/edit mode 按钮的二级菜单注册（commands.ts submenu）；edit mode 是否应有 L4（文本/图像/链接/隐藏）。
- 验收：批注/编辑入口的二级菜单行为一致（按 DESIGN，都有或都无）。

#### ISS-QA-09　导出二级菜单很怪　[P1][待排查]
- 现象：导出二级菜单视觉/结构怪。
- 待排查：导出 submenu 注册 + 渲染；对照 PDF Expert 导出菜单。
- 验收：导出二级菜单结构清晰，符合 DESIGN。

#### ISS-QA-10　填写签名没居中一致　[P1][待排查]
- 现象：填写和签名 mode 内容/面板没居中，视觉不一致。
- 待排查：FormsPanel / SignaturePanel 布局 CSS；签名预览/选择居中。
- 验收：填写签名面板内容居中一致。

#### ISS-QA-11　扫描与文本识别配置页结构混乱　[P1][待排查]
- 现象：OCR mode 配置页结构混乱。
- 待排查：OcrPanel / OcrWorkspace / RightPanel（ocr-queue）结构；对照 PDF Expert OCR 面板。
- 验收：OCR 配置页结构清晰（任务列表 + 参数 + 状态），符合 DESIGN。

#### ISS-QA-12　扫描右侧加号按钮功能多/分类乱/与其他页重复　[P1][待排查]
- 现象：扫描 mode 右侧加号按钮（ToolLauncherMenu）功能非常多，部分在其他页面也有、部分只此页有，分类不明确。
- 待排查：ToolLauncherMenu（Toolbar.tsx:191 `+` 触发）命令清单；去重（与其他 mode 入口重复）；分类（扫描专属 vs 通用）。
- 验收：加号按钮功能分类明确，无与其他页重复，职责单一。

#### ISS-QA-13　设置页 UI 参照 Folia　[P1][待设计]
- 现象：设置页选项背景色带光泽，不好看。
- 方向：参照 Folia 项目设置页 UI（memory `feedback_faropdf_folia_alignment`：FaroPDF 跟 Folia 对齐）。
- 范围：`src/modules/settings/*.css` + SettingsPanel 布局。
- 验收：设置页视觉与 Folia 一致（去光泽、简洁），符合 DESIGN。

#### ISS-QA-14　关于界面参照 Folia　[P1][待设计]
- 现象：关于界面（介绍 + 个人信息）要参照 Folia。
- 范围：AboutSection（settings about section）。
- 验收：关于界面与 Folia 一致（介绍 + 作者信息），符合 DESIGN。

#### ISS-QA-15　定位改「面向知识工作者」　[P1][待改]
- 现象：当前定位「面向律师日常处理卷宗/证据/判决/合同/扫描材料」要改。
- 改：全处「面向律师日常处理卷宗...」→「面向知识工作者」。
- 范围：README.md / package.json description / 关于界面 / WelcomeScreen / 各 UI 文案（grep `律师|卷宗|证据|判决`）。
- 验收：全处定位统一为「面向知识工作者」，无律师/卷宗字样。

#### ISS-QA-16　OCR endpoint 默认填　[P2][部分完成 2026-08-05]
- 现象：OCR provider endpoint 该默认填（用户只填 API key）。
- 已做：MinerU endpoint 默认填 `https://mineru.net/api/v4`（固定官方，`defaults.ts:68`）；用户只填 API token。
- 未做：PaddleOCR endpoint **无固定默认**（每用户从 aistudio.baidu.com/paddleocr/task 部署自己的 app，URL 各异），留空 + placeholder 提示「自部署 aistudio app URL」。
- 来源：pdf-processor skill references（mineru-api-guide.md / paddleocr-api-guide.md）。
- 验收：MinerU endpoint 默认填（用户只填 token）；PaddleOCR placeholder 提示自部署。

---

## 当前唯一推进序列（PDF Expert 功能框架对应）

2026-07-30 用户明确调整验收目标：不要求像素级或一比一视觉复刻；PDF Expert 只作为信息架构和功能映射参考。P0 改为“入口与真实模块一一对应、写入结果可验证、未实现能力 fail-closed”。accepted-golden、截图补采和视觉 diff 保留为非阻塞质量项，不再阻塞 M3～M5 的功能推进。

| 顺序 | 阶段 | 状态 | 进入条件 | 交付 |
| --- | --- | --- | --- | --- |
| M0 | 上下文纠偏 | 已完成 | 无 | raw capture 重新分类；DESIGN/ARCH/TASKS/DEC 统一；实现映射和门禁 |
| M1 | 规范化重采集与量测 | 可选/暂缓 | 用户不要求像素一致 | 固定 fixture/主题/窗口；窗口 crop；bbox；accepted-golden |
| M2 | 视觉验证器 | **73 项 measured 几何/密度/语义门禁已完成（2026-07-28）**；accepted-golden 图像回归待 M1 | measured reference 可用 | 分层/横向/页面/G05 编辑大纲与中央画布/页卡/搜索双栏几何 JSON + surface 语义断言 + 非零失败码 |
| M2.1 | 状态机与验证器纠偏 | **已完成（2026-07-28，Codex；独立 S4 PASS）** | G01–G05 measured 证据和失败基线可用 | `T 编辑`/页面管理已拆分；批注默认 panel、L2/L3/L4 与 surface 语义已校准 |
| M2.2 | Shell 层级、密度与画布几何纠偏 | **已完成（2026-07-28，Codex；独立 S4 PASS）** | G01/G02/G03/G05 measured + 当前 actual 肉眼复核 | 重建 L3 分组；校准中性深色壳层、按钮间距、单页与编辑大纲几何；页面管理接真实缩略图；验证器新增横向/页面/页卡/搜索门禁 |
| M3 | 页面管理纵向闭环 | **核心行为 + 页面剪贴板已闭环；剩余为视觉优化** | 功能契约和真实 PDF fixture | 真实缩略图、选择/多选、拖拽、删除、旋转、撤销、导出与重开、**复制/粘贴（DEC-195）** 已通过；剩余为真实页面尺寸标签、响应式断点和 EditModeGridView 历史清理 |
| M4 | Shell / Sidebar / RightPanel 分域接线 | **shape-style、页面书签已 behavior-complete；其余 surface 继续推进** | 不依赖 accepted-golden | 每个可见入口接真实 state/controller；planned 入口显式禁用 |
| M5 | forms/export/OCR/异常态补齐 | 进行中 | 不依赖 capture | forms/export/OCR 逐项以真实产物、round-trip 和错误态验收 |

### 待补齐清单（2026-07-24 盘点）

以下是本会话推进过程中发现的所有未完成项，按类型集中标注。任何 worker/agent 接手前先读本清单确认自己领的不是已完成或被阻塞的项。

**A. 补采集（缺图，需桌面 GUI）**

| id | surface | 阻塞谁 | 入口 | 备注 |
| --- | --- | --- | --- | --- |
| ISS-NEW-N-THUMB | 左栏 Sidebar 缩略图列表 + 当前页高亮 | P05/M4 thumbnails | `docs/TASKS.md` ISS-NEW-N-THUMB 子卡 | G02 是整页页面管理网格，不是左栏缩略图，不能替代 |
| ISS-NEW-N-SEL | text selection 浮动工具条 | TextSelectionToolbar 实现 | `docs/TASKS.md` ISS-NEW-N-SEL 子卡 | R07 与 2026-07-24 真实文字层拖选均无浮条，仍缺可复现触发路径 |
| ISS-NEW-N-CROP（L3 全展开） | L3 工具栏全展开 + 菜单栏 window crop | L3 自适应断点精确值 | `docs/TASKS.md` ISS-NEW-N-CROP 子卡 | `N-CROP-L3-SEARCH` 已补完整 L3 + 搜索双栏 measured crop；菜单栏仅在含桌面背景的 raw 中可见，仍待 M1 统一 |
| M1 全量重采 | read/thumbnails/annotate/edit 的 accepted-golden | M2 容差收紧、visually-verified 验收 | `docs/TASKS.md` ISS-NEW-M M1 | 当前 accepted-golden 为 0；M2 用 measured 暂代 |
| OCR 专属采集 | OCR 右面板真实状态（非 R10 modal） | P03 OCR 5 段规格定义 | `docs/TASKS.md` ISS-NEW-N-P03 | G01-G05 未覆盖 OCR surface |

**B. 补规格（目标态定义不清，不能直接写代码）**

| id | 问题 | 阻塞谁 | 入口 | 备注 |
| --- | --- | --- | --- | --- |
| P03 OCR 5 段 | "5 段"具体哪 5 段、次级工具条挂哪个 L3 段都没定 | P03 实现 | `docs/TASKS.md` ISS-NEW-N-P03 | 代码库无对应交互（ModeSecondaryToolbar 是扁平按钮非 popover） |
| P05 状态机拆分 | "编辑"（单页文本编辑画布）vs"页面管理"（页面网格）是两个独立状态，但代码曾合成一个 `pages` mode | P05/M3 实现 | `docs/TASKS.md` ISS-NEW-N-P05 + `measurements.json` state_machine_note | **2026-07-28 已落地：`edit` 保持单页 ReaderCanvas 并显示编辑 L4；`pages` 单独挂载 PageOrganizerWorkspace；P05 错误规格已关闭。** |

**C. 补代码（证据已足够，待实现）**

| id | 问题 | 入口 | 备注 |
| --- | --- | --- | --- |
| M3 页面管理闭环 | 页面剪贴板复制/粘贴、真实页面尺寸标签和更多异常态 | `docs/TASKS.md` ISS-NEW-M M3 | 核心重排/旋转/删除/撤销/导出已闭环，剩余入口已 disabled，不再被截图门禁阻塞 |
| M4 剩余 surface | thumbnails / outline / annotations 与 signatures / stamps 等仍需逐项行为复核；shape-style、bookmarks 已完成行为闭环 | `docs/TASKS.md` ISS-NEW-M M4 | 用真实 state/controller 验收；视觉只作非阻塞优化 |
| M5 功能闭环 | 表单真实 fixture round-trip、Tauri GUI 错误态 | `docs/TASKS.md` ISS-NEW-M M5 | OCR 本地真实 pipeline 与导出产物已验证；继续补表单和异常态 |

**D. 补验证/复核（已有产出但需人工或独立审计）**

| id | 问题 | 入口 | 备注 |
| --- | --- | --- | --- |
| measurements.json 3 处分歧 | 左栏 211 vs ~272、右栏 x800/w480 vs x900/w380、card.x 51 vs ~69 | `measurements.json` 各 surface 的 `measurement_review_2026_07_24` | **2026-07-28 已将复核值 272、900/380、69/175/66 写入 canonical 字段，并把原值保存在 `disputed_original`；M1 仍需独立复核** |
| M2 accepted-golden 扩展 | measured 层已按 L2/L3/L4 + surface 语义通过；尚无图像级 golden diff | `scripts/verify-pdf-expert-visual.mjs` | 2026-07-28 两套 Playwright 门禁 exit 0；M1 准入 golden 后再加入图像回归，不跨 surface 借宽度 |
| P01/P02/P04/P06 实机确认 | active 蓝/modal/网格视觉未做实机截图确认 | `npm run dev` 手动 | M2 当前覆盖 L2/L3/L4 几何 + read/annotate/edit/pages 语义，不覆盖这些面板的像素/交互 |
| readerReducer.test.ts | 用户未提交修改（可选链 `?.`），lint 报 prefer-const | `src/modules/reader/readerReducer.test.ts` | 非本会话工作，ISS-NEW-M 明确不触碰；留用户处理 |
| Vitest 全量退出悬挂 | `npm test -- --run --reporter=dot` 大量用例继续输出、未见失败，但随后超过 90 秒无新输出且不退出 | 测试基础设施 / open handles | 2026-07-28 本次聚焦回归均 exit 0；全量运行被人工中止为 exit 130，不得记为全量通过。后续单独定位未清理 timer/worker/observer |

### PDF Expert 阶段并发权

文档整理完成只表示 worker 能获得一致上下文，不表示 UI 已具备并行实现条件。并发必须同时满足“前置阶段完成、证据准入、验证器可失败、文件范围不重叠”四项条件。

| 阶段 | 并发权 | 约束 |
| --- | --- | --- |
| M1 | 单一证据 owner | 只采集、量测和准入 golden；不得修改或并行实现 `src/**` |
| M2 | 单一 foundation owner | 先建立统一视觉验证器，避免各 surface 自建不同阈值 |
| M3 | 单一纵向闭环 owner | 页面状态、拖拽重排、PDF 写回和重开验证由同一 owner 收口 |
| M4 | 条件式并行 | 仅目标 surface 已有 accepted-golden 且 allowed files 不重叠时拆分；全局布局只允许一个 owner |
| M5 | 条件式 Wave | forms/export/OCR/异常态按独立工作流拆分；共享契约、AppShell 和写回链路不得并行争抢 |

当前优先项（2026-07-30 更新）：**M5 异常态四项全部 behavior-complete 并合并**（文件损坏 DEC-192 + 密码 PDF DEC-193 + 权限不足/OCR 失败 DEC-194，PR #70/#72/#73/#74 已 merge）。M5 主线收口，进入收尾与下一阶段规划。M1/ISS-NEW-N 截图补采仍为可选视觉优化；后续任务以 `ready / partial / planned` 功能状态和真实产物为主证据，不再因 accepted-golden 为 0 停止实现。

### 状态词统一

- `skeleton`：组件或静态外观存在。
- `wired`：入口与真实 state/controller 连接，无 noop。
- `behavior-complete`：真实 PDF 结果可保存/导出并重开验证。
- `visually-verified`：在 behavior-complete 基础上通过 accepted-golden。
- `geometry-verified` 只是验证标签，不代表视觉完成。

当前 accepted-golden 为 0，因此没有任何 PDF Expert surface 可以按“高保真”关闭。

## 活跃任务

本节含少量尚未机械迁移的历史完成卡。`状态：已完成`、`✅` 或所有验收均勾选的卡片只作历史记录，不是可领取任务；Agent 只能领取明确写为“待开始 / 进行中 / 部分完成”且仍有未勾选验收项的卡片。PDF Expert UI 例外：即使旧卡写“已完成”，仍须服从上方 M0–M5 和 ISS-NEW-M 的重新验收。

（ISS-039~055 已完成，2026-07-31 归档至 `docs/DECISIONS.md`「ISS 任务归档」区。）

### ISS-036 检查更新失败（私有仓库导致 latest.json 不可访问）

- 优先级：P2
- 类型：发布 / 缺陷
- 状态：已知原因
- 来源：用户实际使用反馈
- 描述：设置页"检查更新"始终显示失败。
- 原因：仓库 `cat-xierluo/FaroPDF` 当前为 **private**，updater endpoint `https://github.com/cat-xierluo/FaroPDF/releases/latest/download/latest.json` 对未认证请求返回 404。
- 解决方案：仓库公开后自动修复。若需在私有阶段测试更新，可改用 GitHub API + token 或私有 CDN 托管 `latest.json`（不在 v0.1 阻塞）。
- 关键文件：`src-tauri/tauri.conf.json` § plugins.updater.endpoints、`src/modules/settings/sections/AboutSection.tsx`（更新状态 UI）。

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

### ISS-025 Agent 集成（Q&A 抽屉 + OCR 后处理 + 跨卷宗分析）

- 优先级：P2
- 类型：Agent / 工程
- 状态：暂缓（v0.3 不进入关键路径；设计已归档到 `docs/plans/2026-06-03-agent-integration-design.md`）
- 建议分支：`feat/agent-integration`
- 建议 worktree：`.claude/worktrees/tmux-agent-integration`
- 依赖：ISS-007、ISS-009、ISS-021、ISS-022
- 范围（预留）：`src/modules/agent/`、`src/shared/agent/`、`src-tauri/src/agent/`、`src/components/agent/AgentDrawer.tsx`、设置页 Agent section
- 目标：把本机 Claude Code CLI 作为 sidecar 一次性 spawn，提供 PDF 问答 / 摘要、OCR 后处理 / 文字层修正、跨文档案卷分析 / 证据链整理三类能力；批注在左、agent 抽屉在右，遵循 PDF Expert 风格无常驻 Inspector；走全局开关 consent。
- 回归条件：ISS-007 真实双层 PDF 落地、ISS-013 真实压缩落地、ISS-022 设置浮层合并，或 v0.3 整体收口。
- 不在 v0.3 实施；后续回到这个方向时从设计文档 §6 / §7 / §8 切入。

### ISS-056 computer-use skill 路径 A：AXPress 优先 + 真实光标存/恢复

- 优先级：P2
- 类型：工具链调研 / skill 内部升级
- 状态：暂缓（待综合评估后选定一条或多条并行）
- 来源：2026-06-15 `computer-use` skill 调研。背景：当前 SKILL.md 走 `osascript` + `System Events`，底层是 `CGEventPost` 全局路径，会动真实鼠标光标；想达到 Codex / Operator 的"独立光标 + 不抢焦点"体验，最低成本是先在 skill 内部改造。
- 目标：
  1. 在 `computer-use` skill 的"阶段 2：循环操作"前置一个 AX tree 解析层（`osascript` 拉 AX 元素，匹配描述/标题），命中时优先用 `AXPress` 触发，失败再降级到现有 click button / keystroke。
  2. 阶段 0.5 用 `cliclick p` 缓存真实光标位置，阶段 2.3 之后用 `cliclick m:原x,原y` 移回去，减少"光标跳"感。
  3. 阶段 2.4 之后比对新旧 AX tree，触发态变化才算"操作成功"，未变化回退一次 keystroke。
  4. 输出不变，仍是截图 + README 索引表 + DESIGN.md 对照。
- 关键文件：
  - `.claude/skills/computer-use/SKILL.md`
- 验收：
  - [ ] 复测 `research/pdf-expert/` 13 张截图，AXPress 路径覆盖至少 5 个原 keystroke 步骤。
  - [ ] 操作前后真实光标位置一致（`cliclick p` 对比）。
  - [ ] README 索引表新增"操作方式"列（AXPress / click / keystroke）。
  - [ ] 失败回退有明确日志（哪个 AX 解析失败 → 降级到哪条路径）。

### ISS-057 computer-use skill 路径 B：装 `minghinmatthewlam/computer-use-mcp` 验证 Codex 体验

- 优先级：P2
- 类型：工具链调研 / MCP 集成
- 状态：暂缓（待综合评估）
- 来源：2026-06-15 调研。该项目是 macOS 14+ Swift 原生 Computer Use MCP，2026-06-10 创建、Stars 少，但实现路径（AXPress → per-window event → per-pid event → opt-in global cursor + 自绘 agent cursor 覆盖层）正是 Codex 那种"独立光标 + 不抢焦点"机制。
- 目标：
  1. 在**专用空 macOS 账户**或 VM 内（不要在生产账户）安装 `computer-use-mcp`，授权 Accessibility + Screen Recording。
  2. 在 Claude Code 注册为 stdio MCP，复用 `computer-use` skill 的 operation 配置跑一次 PDF Expert 截图任务。
  3. 验证：(a) 真实光标不动 / 不抢焦点 / 用户可并行操作；(b) 自绘 agent cursor 显示在正确位置；(c) AXPress 解析速度与纯 osascript 路径对比。
  4. 记录权限授权的"宿主进程绑定"问题（TCC 把权限绑到启动 server 的 terminal/agent app，签名 / notarize 需评估）。
- 关键文件：
  - `.claude/settings.local.json` 或 `.mcp.json`（MCP 注册）
  - `.claude/skills/computer-use/SKILL.md`（新增"v2 路径"小节）
- 验收：
  - [ ] 在隔离账户 / VM 内 `computer-use-mcp serve` 跑通，`doctor --prompt` 授权成功。
  - [ ] 同样 13 张截图任务在 MCP 路径下产出截图 + AX tree dump。
  - [ ] 主观评估"独立光标体验"是否达到 Codex 水平（不是 / 一般 / 接近 / 超过）。
  - [ ] 安全评估：是否需要 Developer ID 签名 + notarytool 公证，签名前后对权限绑定的影响。
- 风险：项目新、Stars 少、Swift 原生二进制需要 Accessibility 权限，不要在生产/含敏感数据的 macOS 账户跑。

### ISS-058 computer-use skill 路径 C：clone `anthropic-quickstarts/computer-use-best-practices` 学架构

- 优先级：P2
- 类型：工具链调研 / 架构学习
- 状态：暂缓（待综合评估）
- 来源：2026-06-15 调研。Anthropic 官方 quickstart 是 macOS 原生 Computer Use 参考实现，强调 "run it in a VM!"，展示 explicit tool definitions / image sizing & pruning / prompt caching / server-side compaction / batched tool calls / sandboxed shell / trajectory recording。我们的 `computer-use` skill 离生产可用差的就是这三件事的明确分层。
- 目标：
  1. `git clone --depth 1 https://github.com/anthropics/anthropic-quickstarts`，只读 `computer-use-best-practices/` 源码。
  2. 提炼**不抄代码、只抄心智模型**的三件事：
     - explicit tool definitions（operation schema 化）
     - trajectory recording（截图 + 命令 + 时间戳的 JSON 记录，而非纯 README 表格）
     - verification 闭环（多模态 prompt 模板，让模型自己填"预期 vs 实际"列）
  3. 把这三件并到 `computer-use` skill SKILL.md，不重复造 quickstart 已经做好的事。
- 关键文件：
  - `.claude/skills/computer-use/SKILL.md`
  - `research/pdf-expert/README.md`（现成的 13 张图做 case study）
- 验收：
  - [ ] 一份 **1-2 页的笔记**（`docs/notes/computer-use-quickstart-mental-model.md`），说明 quickstart 怎么把"显式工具 + 轨迹 + 验证"组织成一个 skill，我们怎么学。
  - [ ] SKILL.md 决定保留 operations 配置 + 加 trajectory.json 输出 + 加多模态验收 prompt 模板。
  - [ ] 至少在一个新截图任务里跑通 trajectory.json → contact sheet → 多模态 prompt 闭环。

### 综合评估（ISS-056 / 057 / 058 共用）

三条路径不互斥。综合评估的目标是确定：

- **当前阶段**（v0.1.x）：用哪条 / 哪几条？轻量改进先上 ISS-056，重型验证后做。
- **下一阶段**（v0.2）：是否把 `computer-use` skill 升级到 v2（封装 MCP + trajectory + verification）？
- **绝对不要**：在 v0.1.x 内把 ISS-057 装到生产账户；ISS-058 不要阻塞 v0.1.x 收口。

## 历史冻结卡：ISS-059..065 PDF Expert 视觉与功能对照复检

> **不可领取。** 本区保留 2026-06 的实现和拆解历史，其中的“进行中”“待启动”、截图编号、百分比、宽度和 Wave 顺序均不是现行需求。未完成内容已由 ISS-NEW-M 的 M1～M5 接管；任何 Agent 不得从本区直接开工，也不得把 `research/pdf-expert/FEATURE_CATALOG.md` 当规范源。

> 触发：2026-06-15 大批次 PDF Expert 截图复检（v0.1.2 封箱期间 30 张 + 6 月 15 日新增 39 张），目标是把 PDF Expert 界面语言、画面语义和交互行为系统化记录到仓内，供后续 v0.2 设计 / 实现对照参考。
> 详细图片索引：见 `research/pdf-expert/FEATURE_CATALOG.md`（按 chrome / 视图与导航 / 侧边栏 / 批注 / 对话框 5 大块罗列 69 张截图要点）。
> 详细架构对照与落地建议：见 `docs/ARCHITECTURE.md` 中新增的「PDF Expert 视觉与架构对照（v0.2 起点）」节。
> 详细设计语言对照：见 `docs/DESIGN.md` §18 已扩展的分层与交互对照表。

### ISS-059 多 Tab 与 inline rename

- 优先级：P0
- 类型：UI 信息架构 / 窗口
- 来源：PDF Expert 截图 30, 65, 83（窗口顶部文件 tab bar）
- 状态：**需修正（2026-06-20）** — 阶段 1 (DEC-142 / adcd8f0) 已实现 tab store + UI 但**位置错误**（放在 toolbar 下面而非 toolbar 上面独立行 L2）。整个 toolbar 架构偏离 PDF Expert，需合并进 ISS-NEW-A 全量重做。Phase 2+ 验收项保留。
- 目标：
  1. 同一窗口内开多个 PDF tab；右上角 `+` 新建 tab；选中 tab 内编辑。
  2. Tab 标题可 inline rename（双击进入编辑态、ESC 取消、Enter 提交）。
  3. tab 拖拽排序、tab 关闭按钮（X）、tab 拖离窗口剥离为新窗口。
  4. 不引入新依赖；不破坏现有 `recentFiles`/`utilityPanel` 状态。
- 关键文件：`src/state/tabStore.tsx`、`src/components/layout/TitlebarTabs.tsx` / `TitlebarTabs.css`，与 `AppShell.tsx` + `App.tsx` 集成。
- 验收：
  - [x] Phase 1：tab 列表 / 单文件独立关闭 / 激活切换 / 双击 inline rename（Enter / Esc / 空字符串清除）/ HTML5 拖放重排 / `+` 新建按钮 / dirty 标记预留接口。**位置错误**，需随 ISS-NEW-A 校正为 L2 独立行。
  - [ ] Phase 2：单窗口 ≥ 3 PDF 同时打开（per-PDF reader state，目前 AppShell 仍单 reader → 切换 tab 实际是切文档而非独立 reader）。
  - [ ] Phase 2：tab 重命名后，主窗口标题同步（Tauri `setTitle`） + 最近文件命名同步（`recentFiles` 感知 customTitle）。
  - [ ] Phase 3：tab 拖离窗口剥离生成独立窗口（Tauri `WebviewWindow` 新建 IPC + drag detach 手势）。
- 备注：阶段 1 仅 tab UI + state + tab 切换，但**位置违反 PDF Expert L2 行 1 架构**（参考 §1.2）。完整位置校正见 ISS-NEW-A。

### ISS-060 左 + 右 双侧栏（模式驱动侧栏内容）

- 优先级：P1
- 类型：UI 信息架构
- 状态：阶段 1 已完成（2026-06-15）；阶段 2 进行中（2026-06-16 第一步 DEC-112：annotate+stamps 真渲染 CustomStampPanel + AppShell 接 onSelectCustomStamp → annotationArmed）；阶段 2 后续待启动：annotate+signatures 接 SignaturePad / export+export-preview 真预览 / ocr+ocr-queue 真队列 / forms+signatures 真签名列表 + Toolbar 显式切换按钮 + 左右栏宽度持久化
- 来源：截图 50, 65, 68（右侧栏随工具切换显示签章/图章/OCR 面板）
- 目标：
  1. 引入右栏：与左栏对称的 200-320px 宽的 `UtilityPane` 容器。
  2. 当选择「批注 / 签名 / 图章 / OCR」类工具时，右栏自动打开并展示对应模板/列表/选项。
  3. 选择「阅读」或「编辑」时右栏关闭，左栏 4 tabs（书签/大纲/批注/缩略图）不受影响。
  4. 与现有 4-tab Sidebar 同级别但独立；左右栏宽度各自持久化。
- 关键文件：`src/components/layout/AppShell.tsx`（布局层）、`src/components/layout/RightPane.tsx`（新增）、`src/components/layout/Sidebar.tsx`。
- 验收：切换工具模式时，右栏内容随之替换；高度 0 折叠态折叠；阴影 16% 透明不挡主内容。
- 备注：v0.1 留有 `Tool` 入口（v0.3 follow-up）；本次仅做主路径。

### ISS-061 浮动文本工具条（高亮 / 下划线 / 删除线 / 便签 / 复制 / 翻译 / 朗读）

- 优先级：P1
- 类型：批注 UI 强化
- 状态：阶段 1 已完成（2026-06-15，`TextSelectionToolbar` + `usePdfTextSelection` hook 接入 AppShell 真选区，5 启用 + 2 disabled 占位 + Esc 关闭）；阶段 2 已完成（2026-06-16，salvage Wave 7 W2 RED + PM GREEN：选区→floating-annotation-tool draft（高亮/下划线/删除线/便签）+ 翻译 clipboard 占位 + 朗读 Web Speech + 7 动作全 enabled + commands.ts annotation-translate/annotation-tts，DEC-118）。
- 来源：截图 23 floating annotate toolbar（PDF Expert 选区后立即出现的微型工具条）
- 目标：
  1. `TextSelectionOverlay` 重构：选区确定后即出现靠近选区中心的浮动工具条。
  2. 操作 5 个：Hl（高亮）/ Ul / St / Note / Copy。
  3. 工具条锚定到选区 bbox 中心 + 偏移，bounds 内吸附到视口边缘。
  4. 翻译 / 朗读两个 v0.1 没能力的按钮可以 v0.2 预留位但 disabled。
- 关键文件：`src/components/layout/TextSelectionOverlay.tsx`、`src/components/layout/TextSelectionOverlay.css`。
- 验收：选完文本 100ms 内浮现；可逐项点击执行；Esc 关闭；不抢主选择区域焦点。
- 备注：v0.1 已有 `TextSelectionOverlay` 简化版（仅高亮颜色条），本 ISS 升级为 PDF Expert 同位级浮动工具条。

### ISS-062 图章模板可编辑（标准 + 自定义）

- 优先级：P1
- 类型：批注
- 状态：阶段 1 已完成（2026-06-15，内置 5→9 + diagonal 形态，commit 8776461）；阶段 2 已完成（2026-06-16，customStampStore + CustomStampPanel + 19 测试，DEC-111 commit a568e9e）；阶段 3 已完成（2026-06-17，RightPanel 真渲染 CustomStampPanel + AnnotationOverlay activeStampImage + annotationPdfWriter.drawStamp image 分支 + 3 测试，DEC-112/122 commits 2c492c2 + 71f13c7，DEC-129 收口）。
- 来源：截图 55（图章面板：标准 2×2 = 4 个 + 自定义 8 个）
- 目标：
  1. 现状 `stamps.ts` 已有 5 个内置模板（APPROVED / DRAFT / CONFIDENTIAL / FINAL / DRAFT COPY）。需扩展至 ≥ 8 个内置（新增 FOR REVIEW / NOT FOR DISTRIBUTION / INTERNAL ONLY / PROPRIETARY 等常用印章）。
  2. 新增「自定义」tab，承载用户上传 PNG/JPG 印章图（≤ 4 张 / 用户，缩略图 + 名称）。
  3. 落点：右侧 utility pane `StampPanel`，图章由「批注」二级工具条入口。
- 关键文件：`src/modules/annotation/stamps.ts`、`src/modules/annotation/ui/StampPanel.tsx`（新增）。
- 验收：内置 5→8 模板；可上传/删除自定义；图章拖入 PDF 落点合理；同质化标准圆框。

### ISS-063 文档属性对话框

- 优先级：P2
- 类型：UI 补充
- 来源：截图 14（设置 / 文档属性面板）
- 目标：补一个文档属性页（标题、作者、创建时间、页数、文件大小、字体、安全属性、是否加密）。
- 关键文件：`src/modules/document/properties.ts`（新）、`src/modules/document/ui/PropertiesDialog.tsx`（新）、`src/shared/app/commands.ts` 新增 `document-properties` 命令。
- 验收：File > Properties 弹出 modal；可只读展示，可编辑标题/作者/页数（如果原 PDF 允许）；窗口关闭后不污染状态。
- 备注：v0.2 候选；如不优先，可合并到 v0.3。

### ISS-064 文档密码保护（设置 / 移除）

- 优先级：P1
- 类型：安全 / 导出
- 状态：阶段 1 已完成（2026-06-15，`SecurityPanel` UI + `export-set-password / export-remove-password` 命令接入工具启动器和原生菜单 + `remove_pdfpassword` Rust 命令用 lopdf 真实解密生成 `-unsecured.pdf` 新副本）；阶段 2 已完成（2026-06-17，升级 lopdf 0.33→0.41 含完整 V4 128-bit AES 加密 API + `set_pdfpassword` 真实实现生成 `-secured.pdf` 新副本 + SecurityPanel set 模式激活 + 3 Rust + 3 前端测试，DEC-139；DEC-135 决策纠偏：实际跳到 0.41 而非 0.34，0.34 仍无 encrypt API + pom_parser 自带编译 bug）；review follow-up 已修复（2026-06-17，SecurityPanel 用户密码留空文案改为"无需密码即可打开副本"，不再暗示沿用旧密码）。
- 来源：截图 52（设置密码 modal：密码输入 + 确认输入 + 取消/确定）
- 目标：
  1. 在工具启动器「导出」分组中加 `设置密码 / 移除密码` 命令。
  2. 通过 Rust 后端封装 qpdf 1.7 类的密码设置 / 移除。
  3. 安全策略：默认输出新副本（`* -secured.pdf` / `* -unsecured.pdf`），不覆盖原文件。
- 关键文件：`src-tauri/src/export/password.rs`（新）、`src/modules/export/ui/ExportDeliveryPanel.tsx`。
- 验收：选定文件路径后调出密码设置 modal；确认可重新打开 PDF 不需要密码；重新打开需要密码。

### ISS-065 v0.2 起步：PDF Expert 视觉信息架构对齐

- 优先级：P0（v0.2 顶层目标）
- 类型：UI 信息架构 / 整体 polish
- 状态：进行中（自 ISS-055 起延续至 v0.2 起点）
- 目标（截至 v0.2）：
  1. **多 Tab**（ISS-059 解决）：单窗口可开多个 PDF，互不干扰。
  2. **左 + 右 双侧栏**（ISS-060 解决）：左 tabs（书签/大纲/批注/缩略图），右 pane 模式驱动（签章/图章/OCR）。
  3. **浮动工具条**（ISS-061 解决）：选区中心弹出 Hl/Ul/St/Note/Copy。
  4. **图章扩展**（ISS-062 解决）：内置 5→8，新增自定义上传。
  5. **密码保护**（ISS-064 解决）：设置/移除密码的新模态对话框。
- 跨任务约束：v0.2 阶段不再为这些特性引入新顶层按钮、不修改 `app.menu` 顶层结构、不变更导出二级工具条布局、不破坏 v0.1 顶栏克制原则（`ISS-030`/`ISS-037`）。
- 关键参考：`docs/DESIGN.md` § 当前设计差距（"顶栏仍过密"）+ `research/pdf-expert/FEATURE_CATALOG.md`。
- 验收：ISS-059/060/061/062/064 全部通过且互不破坏；`npm test`/`tsc -p .`/`cargo test`/lint 全绿。

## ISS-066..072：基于 PDF-Guru 调研立的能力候选（v0.2 / v0.3）

> 来源：DEC-103 PDF-Guru 调研结论。律师场景刚需 + 工程基础设施。**只学思路 + 独立重写**（PDF-Guru 是 AGPL-3.0，不引入代码）。

### ISS-066 扫描清洁校正（拆双页 / 网格切 / 自定义断点切）

- 优先级：P1
- 类型：扫描预处理 / 页面整理 / 律师场景刚需
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，splitPagesByGrid + splitPagesByBreakpoints + 11 测试）；阶段 2 PageOrganizerWorkspace 集成已完成（2026-06-16，SplitPagesDialog + 「扫描拆页」按钮 + handleConfirmSplit，DEC-115）；阶段 2 后续 部分完成（2026-06-17，trimPageMargins 裁边切算法 + 10 测试，commit 即将 ship DEC-130）；缩略图拖断点 UI 待后续（splitPagesByBreakpoints 算法已 ship，UI 拖断点留 v0.3）。
- 来源：DEC-103 / ROADMAP §5 v0.1 缺口"扫描清洁校正"+ PDF-Guru `cut.go` + `thirdparty/cut.py:15-79`
- 律师场景：扫描卷宗常见双页合一（A3 扫成 A4 两页粘一起）/ 多面 A4 拼图扫成单页 / 需要按断点切单页为多页
- 目标：
  1. 实现 3 种切页模式：
     - **网格切**（n_row × n_col）：把每页按矩阵切成 N 个子页，常用于 2×1 拆双页
     - **自定义断点切**：用户在缩略图上拖断点线（横/纵），按断点切成多页
     - **裁边切**：按 margin_bbox 裁掉页边白边或扫描黑边
  2. 反操作：**组合**（`combine_pdf_by_grid` 思路）—— 把多页按网格拼成大页（用于打印场景）
  3. 接入页面管理工作台，作为 `extract` 类操作的扩展
  4. 默认输出 `*-cut.pdf` 新副本
- 关键文件：
  - `src/modules/pages/scanSplit.ts`（新）：算法
  - `src/components/layout/PageOrganizerWorkspace.tsx`：UI 入口
  - `src/modules/export/pdfOperationEngine.ts`：导出引擎扩展
- 参考思路（不复制）：PyMuPDF `page.set_cropbox(bbox)` + 多次 `show_pdf_page` 拼接
- 验收：
  - [ ] 网格切 2×1 可拆双页扫描件为单页流（验收用 fixture 横向 A4 双页 PDF）
  - [ ] 用户在缩略图上拖断点可视化切页
  - [ ] 输出 `*-cut.pdf` 新副本，不覆盖原文件

### ISS-067 矩形遮罩涂黑 + 去页眉页脚

- 优先级：**P0**
- 类型：导出 / 律师证据遮蔽 / 律师场景刚需
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，applyRedaction 算法 + 10 测试）；阶段 2 RedactionOverlay 拖矩形 UI + commands.ts redact-region 入口 + AppShell 集成已完成（2026-06-16，DEC-114）；阶段 2 后续 部分完成（2026-06-17，redactPageMargins 去页眉页脚算法 + 9 测试，DEC-132 即将 ship）；阶段 2 后续 UI 细化 已完成（2026-06-17，RedactionOverlay 多矩形拖拽：3 颜色芯片 / 撤销按钮 / 单 X 删除按钮 + 5 UI 测试）；review follow-up 已修复（2026-06-17，`regionsScreenToPdf` 透传 `color`，白 / 灰遮蔽可进入最终 `applyRedaction` 输出）。
- 来源：DEC-103 / PDF-Guru `mask.go` + `thirdparty/mask.py:18-60` + `header_and_footer.go:60-83`
- 律师场景：
  - **证据遮蔽**：身份证号 / 隐私电话 / 商业秘密在出具材料时必须涂黑，是律师工作高频操作
  - **去页眉页脚**：扫描卷宗多有原始页眉页脚（"机密"/"内部资料"/页码），出庭前清理
- 目标：
  1. **矩形遮罩**：用户在阅读区拖矩形 → 黑色 / 白色 / 自定义颜色填充覆盖 → 写入新副本（`*-redacted.pdf`）
  2. **多矩形批量**：支持一次遮罩多个区域，同页或跨页
  3. **去页眉页脚**：按 `margin_bbox` 自动裁掉上/下边的页眉页脚区域（不是覆盖，是真删除内容流）
  4. 进入工具启动器「标注填写」分组（与批注体系并列，因为本质是"信息处置"）
  5. 默认输出 `*-redacted.pdf` 不覆盖原文件
- 关键文件：
  - `src/modules/redaction/`（新模块）
  - `src/components/layout/RedactionOverlay.tsx`（新）：阅读区拖矩形 UI
  - `src/modules/export/pdfOperationEngine.ts`：加 `redact` operation
  - `src/shared/app/commands.ts`：加 `redaction-add-rect` / `redaction-export` 命令
- 参考思路（不复制）：PDF-Guru 用 `reportlab.canvas` 生成黑色矩形 PDF 再 `show_pdf_page(overlay=True)`，FaroPDF 用 pdf-lib `drawRectangle({color: rgb(0,0,0)})` + `flushAnnotations` 真删除批注层
- 验收：
  - [ ] 在阅读区拖矩形添加 1 个遮罩，预览实时显示黑色覆盖
  - [ ] 跨页多矩形批量遮罩
  - [ ] 去页眉页脚按 `margin_bbox` 真删除内容
  - [ ] 输出 `*-redacted.pdf` 新副本，原文件保留
  - [ ] 输出的遮罩区域**真不可恢复**（不是 PDF annotation，是 content stream 编辑）

### ISS-068 去水印（按索引 / 按文本内容）

- 优先级：**P0**
- 类型：导出 / 律师卷宗清洁
- 状态：阶段 1 部分完成（2026-06-17，PM 单 session TDD，watermarkDetector 检测层 + 12 测试 ship DEC-134）；"真删除"留 v0.3（DEC-123 暂缓，content stream 风险）
- 来源：DEC-103 / PDF-Guru `watermark.go:115-138` + `thirdparty/watermark.py` remove 段
- 律师场景：卷宗常带原始水印（"草稿"/"机密"/版权 logo），开庭前清洁
- 目标：
  1. **检测水印**：扫描 PDF 内容流找 watermark 候选（重复出现的文本对象 / 半透明图片 / 旋转文本）
  2. **按索引删**：用户在检测列表里勾选要删的水印对象
  3. **按文本内容删**：输入要删除的水印文本（如"草稿"），自动批量删除所有匹配项
  4. 默认输出 `*-no-watermark.pdf` 新副本
- 关键文件：
  - `src/modules/redaction/watermarkRemover.ts`（新）
  - `src-tauri/src/lib.rs`：可能需 Rust 后端处理内容流（lopdf 可解析 PDF 对象）
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`：增"去水印"工具
- 参考思路（不复制）：PDF-Guru 解析 PDF object stream 找 watermark 对象，本质是 PDF 内容流 patch
- 验收：
  - [ ] 检测出测试 PDF（含明显"草稿"水印）的水印对象列表
  - [ ] 按索引或文本删除水印
  - [ ] 输出 `*-no-watermark.pdf` 验证视觉上无水印

### ISS-069 OCR 后自动生成目录（字号 + 字体 + 缩进聚类）

- 优先级：P0
- 类型：OCR 后处理 / 自动出目录
- 状态：阶段 1+2+3 全部完成（2026-06-17，PM 单 session TDD：autoToc 算法 + pdf-lib outline 写入 + AutoTocDialog UI + AppShell 集成 + OCR 衔接 fallback 路径 + 55 测试通过，DEC-125/126/127）；Playwright 端到端实操验证留 open follow-up
- 来源：DEC-103 / PDF-Guru `thirdparty/bookmark.py:1-72` 600+ 行
- 律师场景：扫描卷宗 OCR 后自动生成目录（章节 / 证据 / 附件），免手动编排
- 目标：
  1. OCR 完成后扫描文字层，按字号 + 字体 + 缩进三维度聚类识别章节
  2. 中文章节模式正则识别：`第X章` / `1.1.1` / `\t` 缩进 / `证据X`
  3. 自动生成 PDF bookmark（outline），写入新 PDF 副本
  4. 用户可在 UI 预览生成的目录树，二次手工编辑
- 关键文件：
  - `src/modules/ocr/autoToc.ts`（新）
  - `src-tauri/src/auto_toc.rs`（新，可能需 PyO3 子进程或独立实现）
- 参考思路（不复制）：PDF-Guru `title_preprocess()` 80-130 行 + `bookmark.py` 主算法。FaroPDF 应纯 Rust / TypeScript 重写，不引入 PyMuPDF（AGPL 风险）
- 验收：
  - [ ] 测试卷宗（5 章 + 10 证据 + 3 附件）自动识别 ≥ 90% 的章节标题
  - [ ] 用户在 UI 二次编辑目录
  - [ ] 输出含 outline 的新 PDF 副本

### ISS-070 签名手写板（v-perfect-signature 等价 React）

- 优先级：P1
- 类型：表单签名 / 律师材料签字
- 状态：阶段 1 已完成（2026-06-16，SignaturePad 组件 + 8 测试）；阶段 2 已完成（2026-06-16，signatureStore localStorage 持久化 + SignaturePanel 缩略图列表 + RightPanel 接入 + 18 测试，DEC-113）；阶段 3 部分完成（2026-06-16，PM 全 TDD 接管 Wave 7 W1：SignatureLibraryPicker + FormsPanel 签名库选择 + commands.ts forms-sign-handwrite + AppShell openPanel("sign")，DEC-119）+ 阶段 3 落点 ship（2026-06-17，DEC-121 signature as stamp 落点路径，AppShell onSelectSignature annotate 模式把 signature.image 当 stamp 落点与 customStamp 同套路）。拖动 resize UI 留 v0.3。
- 来源：DEC-103 / PDF-Guru `sign.go` + `sign.py:8-38` + `v-perfect-signature` Vue 库
- 律师场景：律师在客户文件、和解协议、授权委托书上签字，弥补 v0.1 表单签名只支持上传 PNG/JPG 的缺口
- 目标：
  1. 引入手写签名 React 库（如 `react-signature-canvas` MIT）
  2. 用户在 modal 内画签名 → 自动把白底变透明 + bbox 裁剪 → 保存为 PNG
  3. 接入表单签名流程：用户在表单签名字段 / 文档任意位置拖入签名
  4. 签名持久化（用户的"我的签名"列表，可保存多个）
  5. 默认输出 `*-signed.pdf` 新副本
- 关键文件：
  - `src/modules/forms/ui/SignaturePad.tsx`（新）
  - `src/modules/forms/signatureStore.ts`（新）：签名持久化
  - `src/shared/app/commands.ts`：加 `forms-sign-handwrite` 命令
- 参考思路（不复制）：PDF-Guru `sign_img()` 用 PIL 像素级遍历转透明（O(w×h) 慢）。FaroPDF 用 Canvas `getImageData` + 阈值算法，更快
- 验收：
  - [ ] 用户可在 modal 内画手写签名
  - [ ] 签名背景透明，签字部分清晰
  - [ ] 签名持久化，下次打开仍在
  - [ ] 接入表单签名字段，可拖入 / 单击落点

### ISS-071 工程基础设施抽象（页码 DSL / 单元转换 / 文件命名 / 错误 schema）

- 优先级：P1
- 类型：工程基础设施 / 重构 / 复用
- 状态：阶段 1 已完成（2026-06-15，4 个抽象 + 双侧测试 + AppShell 迁移示范 1 处）；阶段 2 已完成（2026-06-17，3 模块迁移：AppShell naming inline / OCR bridge pageRange 校验 / formatBytes 共享，DEC-128）；阶段 3 已完成（2026-06-17，set/remove_pdfpassword Rust 改返 AppError + SecurityPanel friendlyMessageForCode + 6 Rust + 4 前端测试，DEC-138）。
- 来源：DEC-103 §架构亮点借鉴 / DEC-104 Wave 1 失败后 PM 直推
- 目标：一次性受益所有 ISS 的 4 个基础抽象
  1. **页码范围 DSL**（`src/modules/pages/pageRange.ts`）
     - 支持 `all` / `even` / `odd` / `1,4-5` / `!1-3`（反向）/ `N`（最后一页）
     - 解析为 `number[]` 给所有页码输入复用（OCR 范围 / 导出范围 / 提取范围 / 删除范围）
  2. **单元转换工具**（`src-tauri/src/util/units.rs` + `src/shared/units.ts`）
     - pt ↔ cm ↔ mm ↔ in 互转
     - 当前各模块（导出 / 页面整理 / 水印）重复 hardcode
  3. **统一文件命名约定**（`src-tauri/src/export/naming.rs` + `src/shared/naming.ts`）
     - 集中管理 `{stem}-加密.pdf` / `-双层.pdf` / `-加页眉页脚.pdf` 等后缀
     - 当前 AppShell / ExportDeliveryPanel / PageOrganizerWorkspace 各自硬编码
  4. **统一错误 schema**（`src-tauri/src/error.rs` + `src/shared/error.ts`）
     - `pub struct AppError { code: ErrCode, message: String, context: HashMap<String, String> }`
     - Rust 命令返回 `Result<T, AppError>`，前端按 `code` 触发 i18n + UI 分支
     - 当前 Rust 命令返回 `Result<T, String>` 字符串化错误，前端难按类型处理
- 关键文件：见目标各项
- 验收：
  - [ ] 4 个抽象都有单测
  - [ ] 至少 3 个现有模块迁移到新抽象（页码 DSL → OCR 范围 / 单元 → 导出 / 错误 → SecurityPanel）
  - [ ] 文档化 API + 迁移指南

### ISS-072 文档属性写回（扩展 ISS-063 从只读到读写）

- 优先级：P2
- 类型：文档属性 / 元数据
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，readPdfMetadata + writePdfMetadata + 10 测试，Producer 字段 pdf-lib 限制 → DEC-109 阶段 2 用 Rust lopdf 解决）；阶段 2 PropertiesDialog UI + commands.ts document-properties 入口 + AppShell 集成已完成（2026-06-16，DEC-116）；阶段 2 后续 Producer 真覆盖已完成（2026-06-17，Rust `set_pdf_producer` Tauri command 用 lopdf 直接编辑 InfoDict 绕过 pdf-lib force override + 5 测试，DEC-136）；阶段 2 后续 阶段 3 前端 PropertiesDialog 集成已完成（2026-06-17，PropertiesDialog 只读 fieldset 新增「用 FaroPDF 真覆盖 Producer」按钮 + AppShell handleProducerOverride invoke set_pdf_producer + 6 UI 测试，DEC-137）。
- 来源：DEC-103 / PDF-Guru `MetaForm.vue` + `thirdparty/metadata.py`
- 律师场景：律师整理客户文件，需要修改 Title / Author / Subject / Keywords，避免泄露原作者
- 目标：
  1. ISS-063 文档属性对话框基础上加"编辑模式"
  2. 用户可修改 Title / Author / Subject / Keywords / Producer（可选）
  3. CreationDate / ModDate 可保留或重置为当前时间
  4. 默认输出 `*-metadata.pdf` 新副本（不覆盖原文件，遵守 v0.1 安全策略）
- 关键文件：
  - `src/modules/document/ui/PropertiesDialog.tsx`（ISS-063 + 编辑模式）
  - `src/modules/document/properties.ts`：metadata 读 + 写
  - `src-tauri/src/lib.rs`：加 `write_pdf_metadata` Tauri command
- 参考思路（不复制）：PDF-Guru `doc.set_metadata({producer, creator, modDate, creationDate})`，FaroPDF 用 pdf-lib `pdfDoc.setTitle()` / `setAuthor()` 等
- 验收：
  - [ ] 用户可编辑 Title / Author / Subject / Keywords
  - [ ] 输出 `*-metadata.pdf` 新副本验证 metadata 已更新
  - [ ] Producer 字段默认写"FaroPDF"，不写底层库名（避免实现细节泄露）

### ISS-073【历史冻结，不可领取】v0.2 阶段 2 “PDF Expert 页面布局”旧差距追踪

- 优先级：P0（v0.2 顶层目标，wrap ISS-059/060 阶段 2 + ISS-065 持续）
- 类型：UI 信息架构 / 整体 polish / 路线图
- 状态：**历史冻结，已被 ISS-NEW-M / DEC-173 接管。** 下列百分比、分桶和 Wave 只记录当时判断，不是当前完成度、任务入口或执行顺序。
- 来源：2026-06-15 PDF Expert audit 揭露剩余差距 + DEC-103 PDF-Guru 调研 + DEC-105 ISS-071 阶段 1 落地后的下一波

### 当前 "页面布局" 完成度（vs PDF Expert）

| PDF Expert 分节 | 完成度 | 缺什么 |
|---|---|---|
| §18.1 总体结构 6 区 | 85% | 右栏 skeleton（真实内容缺） |
| §18.2 工具栏 5 区 | 100% | — |
| §18.3 右侧模式驱动栏 | 40% | 真图章网格 / 真签名列表 / 真导出预览 / 真 OCR 队列 |
| §18.4 浮动文本工具条 | 70% | 选区→直接 draft（不再 armed mode）/ 翻译 / 朗读 |
| §18.5 图章 | 60% | 自定义上传 tab + 缩略图 |
| §18.6 签名面板 | 0% | 手写板（v0.1 仅 PNG/JPG 静态） |
| §18.7 对话框：合并 100% / 密码 50% / 拆分 0% / 属性 0% | 35% | 拆分 + 属性 + set 密码真实加密 |
| §18.8 搜索 | 100% | — |
| §18.9 多 Tab + 拖离剥离 | 0% | 整个 multi-tab + window 体系（v0.1 一窗一 PDF） |
| §18.10 视觉细节 | 95% | — |

整体加权：**~70%** 视觉信息架构对齐；**~75%** "页面布局"；**~50%** PDF 处理能力（vs PDF-Guru 全集）。

### 差距分桶（优先级 + 工作量 + 关联 ISS）

#### 桶 1：P0 / "页面布局"最显眼缺口

| 项 | 工作量 | ISS |
|---|---|---|
| 多 Tab + inline rename + 拖离剥离窗口 | **high**（需 Pinia 类状态管理 + Tauri 多窗口 IPC） | **ISS-059** |
| 右栏真实内容 stage 2（图章网格 / 签名列表 / OCR 队列 / 导出预览 4 个） | medium-high | **ISS-060 阶段 2** |

#### 桶 2：P0 / 律师场景刚需（PDF 处理）

| 项 | 工作量 | ISS |
|---|---|---|
| 矩形遮罩涂黑 + 去页眉页脚 | low-medium（pdf-lib drawRectangle） | **ISS-067** |
| 去水印（按索引 / 按文本） | medium（lopdf 内容流编辑） | **ISS-068** |
| OCR 自动出目录（PaddleOCR + 字号聚类） | high（独立算法重写） | **ISS-069** |
| `set_pdfpassword` 真实加密（v0.2 阶段 2） | medium（lopdf 升级 0.34 或 qpdf） | **ISS-064 阶段 2** |

#### 桶 3：P1 / 表单 + 扫描 + 视觉补全

| 项 | 工作量 | ISS |
|---|---|---|
| 浮动工具条选区直接转 draft + 翻译 / 朗读 | medium | **ISS-061 阶段 2** |
| 自定义图章上传 tab + 缩略图 | low-medium | **ISS-062 阶段 2** |
| 手写签名板 | low（react-signature-canvas） | **ISS-070** |
| 扫描拆双页 / 网格切 / 自定义断点切 | medium | **ISS-066** |
| 左右栏宽度持久化 | low | **ISS-065 polish** |

#### 桶 4：P1 / 工程基础设施 stage 2

| 项 | 工作量 | ISS |
|---|---|---|
| OCR pageRange / SecurityPanel error / 导出 units / lib.rs Result<T,String> → AppError 全面迁移 | medium | **ISS-071 阶段 2** |

#### 桶 5：P2 / 元数据 + 文档属性

| 项 | 工作量 | ISS |
|---|---|---|
| 文档属性对话框（只读） | low | **ISS-063** |
| 文档属性写回（编辑 + `*-metadata.pdf`） | low | **ISS-072** |

### 推进策略（按依赖 + 风险排序）

**Wave A**（互不冲突 + 文件范围窄 + 适合 multi-agent）：
- ISS-067 阶段 1（redaction 模块新建：`src/modules/redaction/` + RedactionEngine + 测试，不接 AppShell）
- ISS-070 阶段 1（SignaturePad 组件：`src/modules/forms/ui/SignaturePad.tsx` + 测试，PM 先 commit react-signature-canvas dep）
- ISS-062 阶段 2（自定义图章上传 tab：`src/modules/annotation/ui/CustomStampTab.tsx` + 测试）
- ISS-066 阶段 1（拆双页算法：`src/modules/pages/scanSplit.ts` + 测试，不接 UI）
- ISS-072 阶段 1（properties.ts 读取层 + 测试，不接 UI）

5 个候选都是**纯新建模块 + 测试**，不动 shared / commands / AppShell / package.json（ISS-070 例外），适合并行。

**Wave B**（需 PM 收口 + 集成）：
- 各 Wave A 模块接 AppShell / commands.ts 入口
- ISS-071 阶段 2 全面迁移
- ISS-060 阶段 2 右栏真实内容（依赖图章 / OCR / 导出模块）

**Wave C**（高风险 / 大依赖）：
- ISS-059 多 Tab（架构级，Pinia/Zustand 状态管理 + Tauri 多窗口 IPC）
- ISS-064 阶段 2 set_pdfpassword（需 lopdf 升级或 qpdf 引入）
- ISS-068 去水印（需 lopdf 内容流编辑）
- ISS-069 OCR 自动出目录（高 high 工作量 + 算法独立实现）

### 阶段成功标准

- Wave A 全部 ship → 整体 "页面布局" 70% → **80%**
- Wave B ship → 90%
- Wave C ship → 95% → v0.2 收尾

### 关联

- DEC-101（v0.2 第一波 ISS-060/061/064 阶段 1 集成）
- DEC-102（v0.2 第一波 code review 修复）
- DEC-103（PDF-Guru 调研引出 ISS-066~072）
- DEC-104（Wave 1 multi-agent 失败教训 + 单 session 替代路径）
- DEC-105（ISS-071 阶段 1 工程基础设施落地）
- skill 侧 v1.16.2（multi-agent 启动注意事项警示）

## 历史冻结卡：ISS-NEW-A～J PDF Expert UI 旧拆解

> **不可领取。** 本区只记录已提交组件、路由和测试的历史。所有未完成项由 ISS-NEW-M 接管；“M1 是唯一下一项”是 DEC-173 时点的历史门禁，已被 DEC-187 的功能优先决策取代。

> 立项依据：研究 `research/pdf-expert/FEATURE_CATALOG.md`（含 §0 顶层架构 5 层分层 + §1.2 tab 位置 + §1.3 toolbar 5 段 + §2 L4 二级工具条 + §3 L5b 右栏 + §4 菜单栏 + §7.1/7.2 批注工具 + §9 多 tab）后，发现 ISS-059 (DEC-142 / adcd8f0) 的 tab bar 位置错误 + 整个 Toolbar 偏离 PDF Expert 5 段布局，需要从 PDF Expert 视角重新拆分 v0.2 收口工作。

### ISS-NEW-A Toolbar 5 段布局重构（L2 + L3 一票否决）

- 优先级：P0（v0.2 阻塞）
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §0 / §1.2 / §1.3；截图 01 / 20 / 30 / 61 / 63 / 80
- 状态：**结构与几何已接线，视觉重新验收中**。历史阶段 1/2 只证明组件和 DOM；DEC-173 撤销“整体已完成”含义。
- 范围：
  1. **L2 行 1**：`<TitlebarTabs>` 上移到 `<Toolbar>` **上方**作为独立行（修复 ISS-059 位置错误）— ✅ 阶段 1
  2. **L3 行 2**：`<Toolbar>` 重构为 5 段（sidebar toggles / file / reading / mode / right）— ✅ 阶段 1
  3. **左区**：4 个 sidebar toggle 图标（缩略图 / 大纲 / 批注 / 书签）已存在；书签仍是 placeholder，顺序和视觉缺 accepted-golden
  4. **文件区**：打开按钮保持（已是 icon-only）— ✅ 阶段 1
  5. **阅读区**：当前为页码跳转 + 视图模式 4-icon toggle + 缩放% + -/+；“旋转/适合页面下移 read L4”的旧结论已撤销，read L4 为空
  6. **模式切换区**：恢复「A 批注」「T 编辑」按钮 — ✅ 阶段 1
  7. **右区**：搜索 / 工具 / 设置保持 — ✅ 阶段 1
  8. **视图模式呈现**：combobox → 4-icon toggle — ✅ 阶段 1
  9. **`工具` 启动器仍保留** — ✅ 阶段 1
- 关键文件：
  - `src/components/layout/Toolbar.tsx` — ✅ 阶段 1 + 阶段 2
  - `src/components/layout/TitlebarTabs.tsx` — ✅ 阶段 1
  - `src/components/layout/AppShell.tsx` — ✅ 阶段 1 + 阶段 2（加 `<BookmarkPanelPlaceholder>` + `<ReadModeToolbar>`）
  - `src/components/layout/types.ts`（新增 `AppToolbarSectionId` + `UtilityPanelId` "bookmark"）— ✅ 阶段 1 + 阶段 2
  - `src/components/layout/Toolbar.css` — ✅ 阶段 1
  - `src/components/layout/Toolbar.test.tsx` — ✅ 阶段 1 + 阶段 2（+5 新测）
  - `src/components/layout/AppShell.test.tsx` — ✅ 阶段 1 + 阶段 2（+7 新测）
- 验收（`[x]` 只代表结构/历史测试，不代表 visually-verified）：
  - [x] L2 tab bar 在 toolbar 上方独立行 — 阶段 1 验证
  - [x] L3 toolbar 严格 5 段（DOM 结构 / data-section 属性）— 阶段 1 验证
  - [x] 阅读区只有 4 元素（页码 + 视图模式 4 图标 + 缩放% + -/+）— 阶段 2 + ISS-NEW-B
  - [x] 视图模式 4 图标 toggle（不是 combobox）— 阶段 1 验证
  - [x] 「A 批注」「T 编辑」按钮在 L3 第 4 段（点击切换 activeMode）— 阶段 1 验证
  - [x] `工具` 启动器仍然存在（ISS-055 不动）— 阶段 1 验证
  - [ ] 侧栏 4 toggle 的顺序、图标、密度和真实 panel 均通过 accepted-golden
  - [x] read 模式不显示 L4；旋转/适合页面由视图菜单承载 — geometry-verified，视觉待 M1/M2
  - [x] typecheck pass — 阶段 1 + 阶段 2
  - [x] Toolbar 24/24 ✅ + AppShell 7/7（ISS-NEW-A 子集）✅ + readerModeTools 7/7 ✅

- 阶段 1 收口（2026-06-21 / DEC-144）：
  - 6 files / +664 / -36 / 1 commit
  - Wave 1 W1 worker ship（独立 worktree `feat/iss-new-a-l2-tabbar`）→ rebase onto `e296211` → FF merge 到 main
  - W2 worker（ISS-NEW-G）按 memory contingency graceful kill 释放 MiniMax 配额
  - 已知限制：`npm test -- --run` / `npm run lint` / `npm run build` / `cargo check` 未运行（pre-existing vitest 4.x + `html-encoding-sniffer`/`@exodus/bytes` ESM 冲突，main 仓库根也复现，与本次改动无关）
- 阶段 2 收口（2026-06-22 / DEC-155）：
  - 4 files / 5 new tests
  - PM 单 session 推进（Wave 4 multi-agent GLM provider 配额耗尽降级）
  - 历史限制：BookmarkPanelPlaceholder / 旧 ReadModeToolbar / ModeSecondaryToolbar / macOS 视图菜单 submenu。现行处理见 ISS-NEW-B/E/M。

### ISS-NEW-B 阅读辅助按钮下移 L4 二级工具条

- 优先级：P1
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §1.3 + §2；截图 04 / 05 / 06
- 状态：**旧任务标题已作废，现行结论见 ISS-NEW-M / DEC-173**。当前代码和 raw R02 均未显示 read L4；视觉结论待 accepted-golden。
- 范围：
  1. L3 阅读区保持页码、视图模式、缩放百分比、缩小 / 放大。
  2. read 模式不渲染 L4。
  3. 旋转、适合页面、实际大小进入 macOS 视图菜单，不在 read L4 常驻。
- 验收：
  - [x] L3 阅读区不常驻旋转 / 适合页面按钮（代码与几何验证）
  - [x] read 模式 L4 为空（geometry-verified；不是视觉完成）
  - [ ] macOS 视图菜单「实际大小」「适合页面」可用
  - [ ] read accepted-golden 建立并通过视觉 diff

### ISS-NEW-C 右侧 mode-driven panel 体系（L5b）

- 优先级：P0（v0.2 阻塞）
- 类型：UI 信息架构 / 侧栏
- 来源：FEATURE_CATALOG §3；截图 20 / 36 / 50 / 53 / 55 / 57-60 / 61-multi-tab-opened-2nd
- 状态：**混合 skeleton/wired，尚未完成**。RightPanel 容器已落地且 L5b 几何位置通过；各 panel 必须独立验收，不能沿用旧表的统一 `✅`。
- 当前分项：
  | 触发 | 目标内容 | 当前等级 / 阻塞 |
  | --- | --- | --- |
  | 阅读默认 | 折叠 | `wired + geometry-verified`；视觉待 read golden |
  | 批注 / 形状 | 形状/样式设置 | `behavior-complete`（DEC-189）；统一 state、sidecar、overlay 与 12 类 PDF writer，视觉 accepted-golden 为可选优化 |
  | 签名 | 手写签名缩略图列表 | `wired`，部分真实行为；选择→落点→保存重开未统一验收 |
  | 图章 | 标准 + 自定义 tab | `wired`，部分真实行为；参考结构和落点链路未视觉验收 |
  | OCR status | 状态、范围、开始 | `skeleton`；AppShell 仍传 noop |
  | OCR queue | 任务列表和取消 | 组件/部分 controller 存在；完整行为与视觉未验收 |
  | 搜索 | 命中列表和导航 | `wired`，部分真实行为；零结果/关闭/状态保持缺证据 |
  | 文档摘要 | 文件信息和元数据 | `skeleton`；AppShell 仍传 `docSummary=null` |
  | 导出预览 | active tool 和参数摘要 | 组件/部分行为存在；export reference 缺失 |
- 验收：
  - [x] L5b 在 L5c 右侧，双栏 DOM 顺序正确 — geometry-verified
  - [ ] shape 语义重采后接真实 state 和绘制
  - [ ] signature / stamp 完成选择→页面落点→保存重开
  - [ ] OCR status 去除 noop，接真实队列和取消
  - [ ] document summary 接真实数据和空/加载/错误态
  - [ ] search 完成零结果、导航、关闭和状态保持
  - [ ] 每个 panel 有 accepted-golden 和视觉 diff
  - [ ] 旧 popover / utilityPanel 平滑迁移

### ISS-NEW-D macOS 菜单栏中文化补齐

- 优先级：P2
- 类型：菜单栏 / i18n
- 来源：FEATURE_CATALOG §4；截图 37 / 38 / 39 / 40
- 状态：**阶段 1+2 收口（2026-06-22 / DEC-159 / DEC-160）**；4 独立顶层菜单（批注 / 扫描 / 编辑 PDF / 前往）全部 ship，批注菜单补 9 辅助 command，共 46 command id。剩余：批注 / 扫描 / 编辑 PDF 真实功能链路 / 前往浏览历史栈 / ⌘ 快捷键 / i18n 字典扩展 — 留后续。
- 范围（阶段 1+2 收口）：
  - **批注菜单**（commit `0c25006`，✅）：8 工具（高亮/下划线/删除线/文本/笔/橡皮擦/便签）+ 形状 submenu（6 形状）
  - **扫描菜单**（commit `d5bfa10`，✅）：增强扫描 submenu（4 档质量）+ 4 顶层动作（扫描至可搜索 / OCR 文字 / 调整为可搜索 / 增强所有扫描页）
  - **编辑 PDF 菜单**（commit `3037e53`，✅）：5 动作（编辑 / 添加图像 / 添加链接 / 添加文字 / 隐藏）
  - **前往菜单**（commit `322c7ca`，✅）：5 顶层（首页/末页/上一页/下一页/返回）+ 浏览历史 submenu（5 项：最近 1-5）
- 验收：
  - [x] 批注菜单 8 工具 + 形状 submenu 6 形状（commit `0c25006`）— DEC-159
  - [x] 扫描菜单 4 档质量 submenu + 4 顶层动作（commit `d5bfa10`）— DEC-159
  - [x] 编辑 PDF 菜单 5 动作（commit `3037e53`）— DEC-159
  - [x] 前往菜单 5 顶层 + 5 历史 submenu（commit `322c7ca`）— DEC-159
  - [x] 4 个菜单的中文 label — DEC-159
  - [x] 全部命令在 `commands.ts` 注册（37 个新 AppCommandId 枚举 + APP_COMMANDS definition）— DEC-159
  - [x] macOS 菜单 event handler match arm 加 37 个新 command id — DEC-159
  - [x] AppShell nativeMenuBridge 路由 37 个 command — DEC-159
  - [x] typecheck ✅ + commands.test.ts 19/19 ✅ — DEC-159
  - [ ] 批注 8 工具真实 arm / 形状 6 项真实绘制 / 6 形状扩 PDF_ANNOTATION_TYPES — 留后续
  - [ ] 扫描 4 档质量 + 4 顶层动作真实 OCR 入口 — 留后续
  - [ ] 编辑 PDF 5 动作真实 PDF 内容编辑链路 — 留后续
  - [x] 前往浏览历史栈（5 历史 + 1 返回）— DEC-171（3 块 ship：readerState history 字段 + controller goBack/goToHistory API + AppShell 路由）
  - [ ] 批注菜单 9 辅助 command 真实功能（链接 / 内容表 / 删除 / 跳到批注 / 折叠 / 展开）— 留后续
  - [ ] ⌘ 快捷键与 PDF Expert 对齐 — 留后续

### ISS-NEW-E L4 模式二级工具条统一抽象

- 优先级：P1
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §2；截图 20 / 21 / 53 / 56 / 80 / 81
- 状态：**结构已接线，尚未完成**。read L4 为空只达到 geometry-verified；其他 mode 的组件存在不等于行为或视觉完成。
- 范围：`<ModeSecondaryToolbar>` 组件按 `activeMode` 切换内容（实际由 AppShell `ContextToolbar` 内 if-else 分支实现）：
  - **阅读**：L4 为空；旋转与适合页面走视图菜单（geometry-verified）
  - **批注**：AnnotationToolbar 组件存在，工具真实行为和视觉逐项验收
  - **编辑**：`edit` 使用单页阅读画布 + 独立编辑 L4；内容编辑引擎尚未接入
  - **页面管理**：`pages` 使用 `PageOrganizerWorkspace`；真实缩略图、重排写回、导出和重开仍待 M3 闭环
  - **扫描**：OcrModeToolbar 组件存在；右栏 OCR 开始仍有 noop
  - **导出**：exportToolGroups 和交付面板存在；参考状态缺失
  - **填写和签名**：4 个工具入口存在；forms reference 缺失
- 验收：
  - [x] L4 路由结构按 activeMode 切换 — 只代表 wired 结构
  - [x] 阅读模式 L4 为空 — geometry-verified
  - [ ] 编辑模式 4 个 L4 工具及 5 个原生菜单命令接入真实内容编辑引擎；当前仅完成独立 mode 路由与禁用态语义
  - [ ] 页面管理真实缩略图、重排写回、导出和重开闭环；不得再借用 `EditModeGridView` 代表编辑模式
  - [x] OCR / annotate / export / forms 的对应组件可渲染 — 只代表 skeleton/wired
  - [x] 历史 typecheck / Toolbar / readerModeTools 测试通过 — 不代表业务或视觉
  - [ ] read / annotate / edit / OCR / export / forms 全状态 accepted-golden + Playwright 视觉验证
- 历史收口 DEC-164 由 DEC-172、DEC-173 纠偏：组件存在不等于行为和视觉完成。

### ISS-NEW-F tab 拖离窗口剥离 + 跨窗口状态共享

- 优先级：P3（v0.2 收尾）
- 类型：UI 信息架构 / Tauri IPC
- 来源：FEATURE_CATALOG §9；截图 30 / 80-83
- 状态：**✅ 第 1+2+3 步收口（2026-06-24 / DEC-162 + DEC-163 + DEC-170）**；tab drag detach 手势 + Tauri WebviewWindow IPC + 跨窗口 localStorage 状态恢复 闭环 ship。剩余：跨 tab 拖页（截图 81）+ 多窗口共享 recentFiles / annotations + Tauri 文档句柄表（多窗口共享 bytes）— 留后续。
- 范围：
  1. tab drag detach 手势（拖到窗口外 → 创建新窗口）— ✅ 第 1+2 步（DEC-162/163）
  2. Tauri `WebviewWindow` 新建 IPC — ✅ 第 2 步（DEC-163）
  3. 文档句柄表（多窗口共享同一文档状态）— ⏳ 第 3 步部分 ship（仅 filePath/fileName/lastPage，bytes 仍每次重读）
  4. 跨 tab 拖页（截图 81）：编辑模式下从 tab A 拖页到 tab B — ⏳ 留后续
- 验收：
  - [x] tab 拖离窗口外 → 新窗口创建并接管该 tab — DEC-163（IPC）+ DEC-170（localStorage 状态）
  - [x] 新窗口能继续读取文档 — DEC-170（PendingDetachRestore 调 readPdfFileFromPath + openNativeFile + setCurrentPage）
  - [ ] 编辑模式跨 tab 拖页：拖到目标 tab 的 drop zone 触发移动/复制 — 留后续（需要 EditModeGridView 拖动 API + tab 间 IPC）
  - [ ] 多窗口共享 recentFiles / annotations — 留后续（持久化层 + 状态广播）

### ISS-NEW-G Welcome 屏 + 状态栏语言切换 + Preferences 字段对齐

- 优先级：P2
- 类型：UI 信息架构 / 空态 / i18n / 设置
- 来源：FEATURE_CATALOG §5.3 / §5.4 / §5.5；截图 13-preferences / 50 / 53 / 61-multi-tab-opened-2nd / 63-tab-bar-zoomed
- 状态：**部分完成（Wave 3 收口后于 2026-06-22 二次收口）** — DEC-154 完成 4 块 ship：AppShell 接线 / 全量 i18n 基础 / Preferences 4 字段 / OCR 模式状态栏。仅剩「图片转 PDF / Word 转 PDF」真实流程接通（依赖 OCR pipeline / merge engine，留 v0.2 收口后）。
- 已 ship 范围（2026-06-22 收口）：
  - **AppShell 接线** — DEC-154：`ReaderCanvas` 加 `onConvertFromImages / onConvertFromWord` props 透传到 `<WelcomeScreen>`；`AppShell` 提供占位 handler（`setCommandFeedback` 反馈）
  - **全量 UI 字符串 i18n 基础** — DEC-154：`src/shared/i18n/` 新建（dictionaries + useI18n）；`StatusBar` / `WelcomeScreen` / `GeneralSection` 27 个查表点全切
  - **OCR 模式底部状态栏** — DEC-154：`StatusBar` 加 `activeMode?` + `ocrState?` props；切「光标位置 + 5 状态枚举 + idle」布局
  - **Preferences 字段 4/6** — DEC-154：`defaultPdfViewer` / `pdfExpertOpenMode` / `resumeLastPage` / `pageNumberIndicator`
- 范围：
  1. **Welcome 屏**（无 PDF 时）：3 段布局
     - 顶部「转换」区：2 张卡片「图片转 PDF」「Word 转 PDF」
     - 中部「打开 PDF 文档」：大蓝色「选择文件」按钮
     - 底部「最近」区：4 张最近文件缩略图网格 + 右上「清除最近」链接
  2. **状态栏语言切换**：底部 toggle（English / 简体中文），与 `appSettings.language` 联动
  3. **OCR 模式底部状态**：光标位置 + 状态文字
  4. **Preferences 字段对齐**：默认 PDF 查看应用 / PDF Expert 打开方式 / 关闭文档时的保存方式 / 作者 / 回到页面 / 页码指示符
- 验收：
  - [x] Welcome 屏 3 段布局（截图 63 对齐）— DEC-149
  - [x] 「最近」网格渲染最近 4 个文件缩略图 — DEC-149
  - [x] 「清除最近」按钮一键清空 recentFiles — DEC-149
  - [x] 状态栏语言 toggle UI（English / 简体中文）— DEC-151
  - [x] 状态栏语言 toggle 切换后所有 UI 文字立即更新（全量 i18n 基础）— DEC-154
  - [x] Preferences 字段 1/6（作者）— DEC-153
  - [x] Preferences 字段 4/6（默认 PDF 查看应用 / PDF Expert 打开方式 / 回到页面 / 页码指示符）— DEC-154
  - [x] AppShell 接线 `onConvertFromImages / onConvertFromWord`（占位 handler）— DEC-154
  - [x] OCR 模式底部状态栏（光标位置 + 状态文字）— DEC-154
  - [ ] 「图片转 PDF」「Word 转 PDF」入口接通真实流程（依赖 OCR pipeline / merge engine，留 v0.2 收口后）

### ISS-NEW-H 视图菜单 + 批注菜单 submenu 深度补全

- 优先级：P2
- 类型：菜单栏 / nativeMenuBridge
- 来源：FEATURE_CATALOG §4 二审补全（2026-06-20）；截图 33 / 37 / 39
- 状态：**阶段 1 收口（2026-06-22 / DEC-157 / Wave 4e minimax + PM 收口）**；视图菜单 submenu 补全 ship（缩放 5 + 缩略图 2 + 3 顶层占位）。剩余：独立批注 / 扫描 / 编辑 PDF / 前往 4 菜单（ISS-NEW-D 范围）+ 视图菜单 12+ 项剩余项 — 留后续。
- 范围（阶段 1 收口）：
  1. **视图菜单深度补全**（原 catalog 只列 9 项，实际 12+ 项）：
     - 滚动模式（滚动 ⌘5 / 翻页 ⌘6）— 当前缺
     - 缩放 submenu（放大 / 缩小 / 实际大小 / 适合页面 / 缩放工具）— 当前缺 submenu
     - 适合屏幕 / 跳到当前页 / 重新载入 / 添加书签 — 当前缺
     - 工具栏 / 隐藏工具栏 toggle — 当前缺
     - 左侧边栏 / 隐藏左侧边栏 toggle — 当前缺
     - 缩略图 submenu（单列 / 双列）— 当前缺 submenu
     - 缩放工具 / 进入全屏模式（⌃⌘F）— 当前缺
  2. **批注菜单补全**：
     - 形状 submenu（矩形 / 椭圆 / 箭头 / 双向箭头 / 直线 / 铅笔 6 形状）— 当前缺
     - 添加书签（⌘D）/ 链接 — 当前缺
     - 删除 / 删除全部 — 当前缺
     - 跳到批注 / 上一项 / 下一项 / 全部折叠 / 全部展开 — 当前缺
  3. **扫描菜单补全**：
     - 增强扫描 4 档质量 submenu（原始 / 标准 / 高级 / 自定义）— 当前缺 submenu
     - 增强所有扫描页 — 当前缺
- 验收（阶段 1 / DEC-157）：
  - [x] 视图菜单 submenu 补全（缩放 5 + 缩略图 2 + 3 顶层占位）— DEC-157
  - [x] 11 个 command id 在 `commands.ts` 注册 — DEC-157
  - [x] macOS 菜单 event handler match arm 加 11 个新 command id — DEC-157
  - [x] AppShell nativeMenuBridge 路由 11 个 command — DEC-157
  - [x] 5 files / +396 / -0 commit（commit 8cd98b2）— DEC-157
  - [x] FF merge 到 main — DEC-157
  - [x] typecheck ✅（merge 后 main 状态）— DEC-157
  - [ ] 视图菜单 12+ 项全实现，含 3 个 submenu
  - [ ] 批注菜单 9+ 项全实现，形状 submenu 6 选项
  - [ ] 扫描菜单 5 项，4 档质量 submenu
  - [ ] 全菜单 ⌘ 快捷键与 PDF Expert 对齐

### ISS-NEW-I【历史冻结】编辑模式、形状与搜索组件旧拆解

- 优先级：P0（实现阻塞于 ISS-NEW-M M1/M2）
- 类型：UI 信息架构 / 模式 / 右栏 / L3 toolbar
- 来源：FEATURE_CATALOG §2.1 + §3 + §1.3.1 + §1.3.2 三审补全（2026-06-20）；截图 50 / 59 / 65 / 67 / 69 / 80 / 81 / 83
- 状态：**历史卡，部分口径已被 2026-07-24 measured 证据推翻。** 现行状态以 ISS-NEW-M M2.1/M3 为准；本卡中“`T 编辑`=页面网格”的条款全部撤销。真实页面缩略图、重排写回、形状绘制、跨 tab IPC 和全状态视觉验收仍未完成。
- 范围：
  1. **页面管理网格视图（原误写为 T 编辑）**：
     - PDF 内容区从单页流式改为响应式真实页面卡片网格；禁止固定 5 列
     - R15 在所捕获窗口中为首行 4 页、次行 1 页；精确断点待 M1 量测
     - 选中页：蓝边框 + 真实页码和页面尺寸；禁止硬编码所有页面为 A4
     - 拖动重排：需补 drag start / in-progress / drop indicator 证据
     - 跨 tab 拖页：阻塞于可靠 capture 和 tab 间 IPC
     - 与 `PageOrganizerWorkspace` 形成单一页面操作工作流，避免两套网格/状态
  2. **L4 工具条命令补全**：
     - 编辑模式 L4：8 命令（插入页 5 子菜单 / 删除 / 提取 / 旋转双向 / 移动 / 复制 / 撤销 / 重做 / 页数 + 尺寸）
     - 扫描模式 L4：5 区段（扫描切边 / 增强扫描 / 页码 - / + / 输入范围 / 页数显示）
     - 批注模式 L4：8 工具（书签 / 高亮 / 下划线 / 删除线 / 文本 / 笔 / 橡皮擦 / 便签 / 形状）
  3. **L5b 形状工具右栏**（ISS-NEW-C 子任务）：
     - R12 只能证明“可能是形状工具状态”，不能证明旧 catalog 所写固定 6 段
     - M1 先重采并量测形状选择、线型、宽度、透明度、边框和填充的真实层级
     - 量测前只允许清理 placeholder 或接真实 state，不允许按旧 6 段猜布局
  4. **L5b 搜索右栏**（ISS-NEW-C 子任务）：
     - R06 只能证明搜索结果面板、命中高亮和结果列表存在
     - 旧 catalog 的固定四段、具体按钮文案和 footer 布局均降级为 M1 待验证 hypothesis
  5. **L3 模式附加按钮**：
     - 旧 catalog 中的扫描附加按钮、常驻搜索框和状态栏文案均未形成 measured evidence
     - 由 M1 重新采集对应 mode 后决定，不在本历史卡继续实现
  6. **图章 / 形状 / 自定义 tab**：具体 tab 数量、命名与层级待 M1 重采，不沿用旧 catalog 推测
- 验收：
  - [x] 点击 `T 编辑` 进入 edit workspace，而不是 forms — geometry-verified
  - [ ] 移除固定 5 列、空白渐变、硬编码 A4 和额外无证据局部工具条
  - [ ] 真实缩略图 + 响应式断点 + 真实页尺寸
  - [ ] 重排写回 → 导出新副本 → 重开顺序一致
  - [ ] 编辑模式 L4 8 命令全实现
  - [ ] 扫描模式 L4 5 区段全实现
  - [ ] 形状状态重采量测后按真实层级实现
  - [ ] 搜索右栏经 M1 重采后按真实层级验收
  - [ ] L3 模式附加按钮经 M1 取证后再决定
  - [ ] accepted-golden 建立后覆盖断点两侧的 Playwright + visual diff

### ISS-NEW-J 残留 PDF Expert 细节（v0.3 候选，不阻塞 v0.2 收口）

- 优先级：P3（v0.2 收口后）
- 类型：UI 信息架构 / 表单 / 注释 / 全局拖入
- 来源：FEATURE_CATALOG §5.6 / §5.8 / §5.9 / §5.10 四审补全（2026-06-21）
- 状态：未启动；非 v0.2 阻塞项
- 范围：
  1. **表单填写 T mode 完整化**（§5.6）：
     - 表单字段（text / checkbox / radio / listbox / combobox / button / signature）激活/输入 UI
     - 表单字段 tooltip / 验证 / 必填提示
     - 表单字段填充后自动保存到 PDF
     - 表单 L4 工具条（按表单 mode）
  2. **注释弹层**（§5.9）：
     - 点击已存在批注弹评论 popover
     - hover tooltip 显示批注作者 / 时间
     - 批注 replies 列表
  3. **全局 drop indicator**（§5.8）：
     - 从 Finder 拖入 app 窗口时全局 drop 高亮
     - 区别于 modal 内 drop zone 与跨 tab 拖页
  4. **「新建指南」空 tab**（§5.10，YAGNI 不做）
- 验收：
  - [ ] 表单字段激活 / 输入 / 自动保存完整流程
  - [ ] 点击批注弹评论 popover
  - [ ] 全局 drop indicator 与现有 modal drop zone 区分清晰

**不做**：
- 撤销/重做 history 独立面板（YAGNI，L4 ↶↷ 按钮足够）
- 「新建指南」向导（YAGNI，v0.2 律师场景 = 打开本地文件即可）



## 归档任务索引

已合并到 main 或第一版已发布的功能，详细任务卡归档在 `docs/DECISIONS.md` 的「ISS 任务归档」一节。索引按领域分组：

- **工程基础**：ISS-001、ISS-011、ISS-012
- **阅读核心**：ISS-002
- **检索**：ISS-003
- **批注**：ISS-004
- **导出 / 法律材料**：ISS-005、ISS-013
- **页面管理 / 证据材料**：ISS-006、ISS-018
- **OCR / 质量**：ISS-007（含 E2E 联调 worker）、ISS-010、ISS-017
- **扫描预处理**：ISS-016
- **设置 / OCR Provider**：ISS-014、ISS-022、ISS-024（doc-curator 部署）
- **表单 / 签署**：ISS-008
- **设计系统 / UI 整合**：ISS-009、ISS-023
- **批注深化**：ISS-026
- **发布 / 工程**：ISS-021、ISS-027
- **法律材料整理**：ISS-019
- **品牌 / UI**：ISS-020、ISS-029
- **UI 信息架构 / 导出面板**：ISS-039、ISS-040、ISS-041、ISS-042、ISS-048、ISS-055
- **v0.1 UI 收口批次（2026-06-07~09，2026-07-31 批量归档）**：ISS-030~035、ISS-037~038、ISS-039~055（共 24 张已完成卡，详见 DECISIONS「ISS 任务归档」区）
- **跨仓协调**：personal-site `ISS-005`（Folio 仓 PR-A / FaroPDF 仓 PR-B 联动，FaroPDF 仓侧见 DEC-058 docs-only 同步）
- **跨仓交付**：personal-site `ISS-001~012`（仓 `cat-xierluo/cat-xierluo.github.io`，v0.1.0-alpha.8 + i18n + 微信二维码真实化 + URL 去 subpath + Legal Skills 集成已落定；FaroPDF 仓侧不重复登记，详见 `docs/TASKS.md` § 推进策略 > 跨仓任务边界 + DEC-072）

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

> 依照 AGENTS.md 与 doc-curator 门禁，本节只保留最近 5 条摘要；它不是任务入口。领取任务只看本文件顶部的 M0～M5 与 ISS-NEW-M，完整历史见 `docs/DECISIONS.md`。

- 2026-07-30：DEC-195 M3 页面剪贴板——同文档复制/粘贴闭环（写剪贴板 + 克隆副本插入 + 撤销 + 导出重开页数正确），M3 纵向闭环核心行为全部完成。
- 2026-07-30：DEC-194 M5 异常态收尾——权限不足（read_pdf_file_from_path 迁移 AppError + 前端归一化）与 OCR 失败（OcrDispatchError 7 变体单测）合并，M5 四项异常态全部 behavior-complete。
- 2026-07-30：DEC-193 加密 PDF 密码输入闭环；密码中间态 + 提交/重试/取消 + qpdf 加密 fixture，Playwright 实机往返通过。
- 2026-07-30：DEC-192 损坏 PDF 不再 silent failure；归一化错误码后中文错误卡片与「重新选择文件」入口闭环，新增 corrupt fixture。
- 2026-07-30：DEC-191 按最新 AGENTS / doc-curator 门禁瘦身 TASKS，并修复历史归档排序与 DEC 索引断档。

较早进度均已由 `docs/DECISIONS.md` 的对应 DEC 与工作日志承接，不再重复留在唯一任务源中。

### ISS-NEW-K `feature-extract-from-screenshots` skill 落地

- 优先级：P2（v0.2 工具链）
- 类型：Skill 沉淀
- 来源：2026-06-21 用户对话「整个功能抽取流程沉淀成 skill」+ 4 轮审漏复盘
- 状态：**已完成**（2026-06-21，commit adcd8f0 / DEC-143）
- 范围：
  1. `.claude/skills/feature-extract-from-screenshots/SKILL.md` — skill manifest（4 阶段入口 + 边界 + 终止条件）
  2. `references/s1-screenshot-analyzer.md` — S1 6-Layer Spine 自动分类 SOP
  3. `references/state-matrix-template.md` — S2 State Machine 反向工程模板
  4. `references/completeness-checklist.md` — S3 13 项强制 checklist
  5. `references/rebuild-agent-prompt.md` — S4 reverse verification subagent prompt
- 配套升级：
  - `research/pdf-expert/FEATURE_CATALOG.md` 增 §12 mode×state 矩阵 / §13 13 项 checklist / §14 rebuild guide / §15 coverage gap
  - 修复 §3 重复（lines 105/131）
  - `research/pdf-expert/s4-verification-report.md` 记录 S4 pass 1+2
- 验收：
  - [x] 5 个文件创建完成
  - [x] PDF Expert catalog 从 557 行扩展到 ~1100 行（新增 4 节）
  - [x] S4 pass 1 返回 31 issues，已分流到 §14.3 / §14.4 / §15.1
  - [x] skill 与 `computer-use` 边界明确（capture 阶段前者 / extract 阶段本 skill）
- 备注：本 skill 是「catalog 自动化生成器」，下游 `frontend-design` skill 用 catalog 作为 spec 重建 UI。

### ISS-NEW-L feature-extract-from-screenshots skill v0.2.0 修复 + v0.3.0 计划

- 优先级：P2（v0.2 工具链）
- 类型：Skill 修复
- 来源：2026-06-21 用户对话「再简单排查一下」+ 5 个修复
- 状态：**部分完成**（v0.2.0 修复 done，v0.3.0 重构待启动）
- v0.2.0 修复（已落地）：
  1. S2 加 B 类 cross-interaction 10 问（hover / drag / drop / double-click / right-click / long-press / shortcut / focus / gesture）
  2. S2 加 C 类 cross-state-transition 5 问（时序 / 中断 / error / loading / empty）
  3. S3 抽 meta-checklist 框架（参数化 platform_profile）
  4. computer-use 加 state coverage matrix（capture 阶段 coverage guarantee）
  5. PDF Expert 4 个 missing state 重判（forms mode / annotation popover 仍 missing v0.3；history panel / new-tab wizard 仍 YAGNI）
- v0.3.0 重构（计划）：
  - 6-layer spine → 8+3 meta-layer（M1-M8 + H1-H3）
  - position + 职责解耦（top/left/right/bottom/floating）
  - platform_profile TypeScript 类型
  - Pages / Sketch / iOS 3 个 E2E 跑通
  - 现有 PDF Expert catalog 迁移
  - 详见 `research/pdf-expert/FEATURE_CATALOG.md` §14 + `.claude/skills/feature-extract-from-screenshots/DECISIONS.md` DEC-008
- 验收：
  - [x] S2 反推问题从 10 个 → 25 个（A/B/C 三类）
  - [x] S3 checklist 抽 meta 框架
  - [x] computer-use state coverage matrix
  - [x] PDF Expert E2E 重判（4 个 state 维持判定）
  - [x] Pages 通用性验证
  - [ ] v0.3.0 8+3 meta-layer 实施
- 备注：v0.3.0 是架构重构，会破坏现有 catalog 引用，需大版本 bump。触发时机：v0.2 收口后。

### ISS-NEW-M PDF Expert 高保真复刻：证据、上下文与执行门禁

- 优先级：P0
- 类型：UI 信息架构 / 上下文治理 / 视觉与行为验收
- 来源：2026-07-23 用户反馈「多次要求完整复刻 PDF Expert，但截图研究没有转化为最终布局和功能」
- 状态：**M0、M2.1、M2.2 已完成；2026-07-30 起不再以像素一致为交付目标。M3 核心行为已完成真实 PDF 往返；M4/M5 按功能真实性继续推进。M1/accepted-golden 降为可选视觉优化。**
- 当前负责人：M4 页面书签已由 Codex 于 2026-07-30 单 owner 收口；当前无进行中代码领取，下一候选为 M5 密码 / 损坏 / 权限 / OCR 失败异常态。M2.2、M3 核心、M5 表单与 M4 shape-style 也已收口。继续禁止触碰 `src/modules/reader/readerReducer.test.ts`、`.zcode/**`、`src-tauri/**`。
- 唯一证据入口：`docs/reference/pdf-expert/README.md`
- 实现现状入口：`docs/reference/pdf-expert/implementation-map.md`
- 验收入口：`docs/reference/pdf-expert/acceptance-contract.md`
- 执行方式：`docs/reference/pdf-expert/rebuild-guide.md`

#### 已确认根因

1. 原始研究材料长期只在被 Git 忽略的 `research/`，worker 无法稳定获得完整证据。
2. 自动化失败、重复画面和状态不符的截图被错误命名为 golden；后续实现据此推导了错误布局。
3. DESIGN、ARCHITECTURE、TASKS 和历史 DEC 对 L4、右栏、编辑网格与“完成”的含义互相冲突。
4. `skeleton / noop / placeholder / toast-only` 曾被当作功能完成，缺少从行为到导出结果的闭环。
5. `verify:ui-layout` 只证明 L3/L5 几何、DOM 顺序和模式路由，却曾被描述为视觉一致性验证。
6. T 编辑依据误标截图被实现成固定 5 列、空白渐变缩略图和硬编码 A4，并且重排仍是 noop。
7. 过去的多 Agent 推进缺少阶段并发门禁；在证据和验证器尚未就绪时同时修改 UI，只会放大猜测、共享文件冲突和“自述完成”风险。

#### M0 — 上下文与证据纠偏

- [x] 将首批 15 张图片从 `golden/` 降级并按真实画面迁入 `captures/raw/`
- [x] 在 manifest 逐张记录 observed state、可证明项、不可证明项、局限和置信度
- [x] 明确 accepted-golden 数量为 0；禁止继续声称“已有 15 张黄金图”
- [x] 重写 state matrix，只记录画面确实证明的状态
- [x] 建立 acceptance contract、coverage gap、implementation map、rebuild guide 和 completeness checklist
- [x] 同步 AGENTS、DESIGN、ARCHITECTURE 和本任务源的现行口径
- [x] 清理源码中的 read L4、固定五列、截图 41/59 分段和 forms=T 编辑等过期注释/提示文案，不改变业务行为
- [x] 同步 DEC-173、README、ROADMAP、CHANGELOG
- [x] 完成独立 S4 三轮歧义审计与 doc-curator 一致性扫描
- [x] 补充 DEC-174 多 Agent 阶段并发权：M1/M2/M3 单 owner，M4/M5 满足证据、验证器和文件隔离后才条件式并行

#### M1 — 规范化重采集与量测（可选视觉优化）

- 可领取状态：不再是 M3～M5 前置；仅在需要视觉精修时领取。
- 必须调用：`computer-use` 负责可复现采集，`feature-extract-from-screenshots` 负责状态矩阵、量测与 S4 反向验证。
- Allowed files：`docs/reference/pdf-expert/captures/`、`golden/`、`manifest.json`、`state-matrix.md`、`coverage-gap.md`、`completeness-checklist.md`，以及新建 `measurements.json` / `state-specs/`；仅在认领和收口时更新本任务卡状态。
- Forbidden files：`src/**`、`src-tauri/**`、`package*.json`、全局样式和历史 DEC/CHANGELOG；M1 不实现 UI。
- 交付证据：每个 capture 的 fixture、主题、应用版本、窗口尺寸、触发步骤、应用窗口 crop、bbox/量测方法、分类和 uncertainty；不完整状态保持 missing。
- Golden 准入：同一 PDF Expert 参考状态至少重复采集两次，执行 reference-vs-reference 稳定性 diff 并记录阈值/结果；这是参考证据准入，不是 M2 的 FaroPDF-vs-reference 回归验证器。
- [ ] 固定 PDF fixture、应用版本、主题、缩放、窗口尺寸和触发步骤
- [ ] 重采 read default / two-page / thumbnails / outline / annotate / text selection / search
- [ ] 重采 signature / stamp / shape / annotation summary / forms / export / OCR / 双栏
- [ ] 重采 edit 默认态、选择态、拖拽态和落点态；记录断点两侧布局
- [ ] 每张图只保留应用窗口，记录 window crop、组件 bbox、字体和间距量测
- [ ] 至少为 read、sidebar thumbnails、annotate、edit canvas、page management 建立可复现的 accepted-golden

#### M2 — 可失败的视觉验证器

- 状态：**measured 几何/密度/语义门禁已完成（2026-07-28）**；基于 measured reference 而非 accepted-golden。最新 run 为 PASS：read/annotate/edit/pages/search 共 73 项断言通过，覆盖 L2/L3/L4、L3 五段横向分布、页面 bbox/单页计数、G05 编辑大纲与中央画布、页卡 bbox/真实 canvas、搜索双栏、参考态状态栏与 surface 语义。这不等于 `visually-verified`。
- [x] 以 M1 的 reference 在相同 fixture、主题、窗口和 crop 下启动 FaroPDF 并截图（当前用 measured G01-G05，非 accepted-golden；M1 完成后换 reference 即可）
- [x] 输出几何 JSON（report.json：每 surface 实际/期望/差值）；感知视觉 diff 暂不做（DEC-182：PDF Expert 原生 vs FaroPDF web 像素 diff 必然失败，改用几何 bbox 对比）
- [x] 超出阈值时返回非零退出码（exit 1 = 超容差；exit 2 = 环境错误）
- [x] 报告包含实际截图、DOM/bbox 测量和失败原因（report.json + 控制台摘要）
- [x] 明确保留 `verify:ui-layout` 的"结构/几何回归"定位，不冒充视觉验证器（README 已说明两者分工）
- [x] L2/L3/L4 分层断言，避免把 titlebar、主工具栏和 contextual toolbar 合并比较
- [x] read/annotate/edit/pages surface 语义断言；禁止 edit/pages 合并和 annotate 默认伪右栏
- **已知 gap**：accepted-golden 为 0，因此尚无图像级 diff；页面内容像素、响应式断点、shape/search 之外的 panel 宽度和交互态仍不在本门禁范围。

#### M2.2 — Shell 层级、密度与画布几何纠偏（用户直接要求，已完成并独立 S4 PASS）

- 负责人：Codex，单一 foundation owner；不启动并行 UI worker。
- 目标 surface：G01 read、G03 annotate、G05 edit canvas、G02 page management；证据等级均为 `measured`，最高交付等级为 `wired + geometry/density-verified`，不得声称 `visually-verified`。
- 已确认失败基线：旧验证器只比较 L2/L3/L4 高度，未检查 L3 横向功能层级、页面 bbox、单页可见页数和页面卡真实像素，因而出现 24/24 PASS 但 current actual 与 reference 肉眼差距显著。
- Allowed files：`src/components/layout/Toolbar*`、`TitlebarTabs*`、`ReaderCanvas*`、`AppShell*`、`PageOrganizerWorkspace*`、`types.ts`、`src/styles/app.css`、`scripts/verify-pdf-expert-{layout,visual}.mjs`、`docs/reference/pdf-expert/**` 及本轮协作文档。
- Forbidden files：`src/modules/reader/readerReducer.test.ts`、`.zcode/**`、`src-tauri/**`、PDF 写回/导出引擎。
- [x] L3 从旧 sidebar/file/reading/mode/right 堆叠改为与 G01 一致的导航/缩放/核心工作流/协作/搜索层级，并校准按钮间隙与激活态。
- [x] 单页模式只显示当前页；50% 运行态页面 bbox 对齐 48% reference 的 measured 画面范围，连续模式仍保留虚拟化。
- [x] 页面管理用 `reader.renderThumbnail` 渲染真实页图，卡片宽度、间距、选中态与 G02 measured 对齐；不在本轮实现重排写回。
- [x] 视觉验证器新增 L3 分组横向 bbox、页面 bbox、单页计数、页面卡 bbox 与真实 canvas 断言，超阈值 exit 1。
- [x] read 搜索由 L3 浮层切换为 240px L5b 结果栏；左 273px / 中 767px / 右 240px measured 三列门禁通过。
- [x] 修复独立 S4 发现的 G05 假绿：编辑态恢复 272px 大纲左栏并激活大纲 tab，L3/原生菜单、触发协议、state matrix、measurements、实现与验证器统一。
- [x] typecheck、聚焦测试、build、两套实机验证器和 actual 截图通过；独立 S4 三轮回验 PASS，未留下新的高/中风险状态或规范冲突。

#### M3 — 页面管理垂直闭环

- [x] 将 `T 编辑` 与 `pages` 状态拆分；`T 编辑` 保持单页画布，页面管理挂载 `PageOrganizerWorkspace`（M2.1）
- [ ] 删除/归档已从运行时卸载的 `EditModeGridView` 历史 skeleton
- [x] 运行时 `PageOrganizerWorkspace` 使用真实 PDF canvas 缩略图；1280×832 下五卡 bbox 与首卡选中态通过 measured 门禁（M2.2）
- [ ] 删除 legacy `EditModeGridView` 的空白渐变/硬编码 A4 历史文件
- [ ] 用真实页面尺寸替换元数据占位，并按 M1 断点证据完成响应式卡片网格
- [x] 实现选择、多选、拖拽排序、插入、删除、旋转和撤销的真实状态
- [x] 重排/旋转/删除结果写入 `*-organized.pdf`；Playwright 下载后用 `pdfinfo` 重开解析，确认 5 页且第一页旋转 90°
- [x] 页面复制/粘贴已接通同文档剪贴板（DEC-195）：复制写剪贴板、粘贴克隆副本插入选中页后（页数+1）、可撤销、导出重开页数正确；不再 disabled
- [x] 覆盖选择、拖拽、删除、旋转、撤销和导出行为测试；像素视觉 diff 不再是功能完成前置

#### M4 — Shell / Sidebar / RightPanel 分域复刻

- 本轮完成（2026-07-30，Codex，单 owner）：页面书签纵向闭环。
  - ISS-NEW-M 阶段：M4。
  - 目标 surface：L5a `书签` tab、工具 / 原生命令 `添加书签` 与 Reader 当前页跳转；不把 PDF outline 冒充个人页面书签。
  - capture / 证据等级：R04 仅为 `raw-B`，可证明 L5a tab 信息架构和大纲相邻位置，不能证明书签列表内容、精确间距或交互；书签目标状态仍为 `missing`。本轮按 2026-07-30 功能优先决策推进，最高交付 `behavior-complete`，不得声称 `visually-verified`。
  - Allowed files：`src/modules/bookmarks/**`、`src/shared/pdf/bookmark.ts`、`src/components/layout/Sidebar.tsx`、`src/components/layout/Sidebar.test.tsx`、`src/components/layout/AppShell.tsx`、`src/components/layout/AppShell.test.tsx`、`src/components/layout/types.ts`、`src/shared/app/commands.ts` 与对应测试、`src/shared/index.ts`、`src/styles/app.css`（仅 bookmark / summary 局部 selector）、`src/App.tsx` 与 `scripts/verify-pdf-expert-{layout,visual}.mjs`（仅修复 planned T 编辑的 dev-only 验证触发）、对应协作文档。
  - Forbidden files：`src/modules/reader/readerReducer.test.ts`、`.zcode/**`、`src-tauri/**`、批注 / 表单 / OCR / 页面管理 / PDF 写回链路和全局 shell 几何。
  - 行为验证：真实五页 fixture 打开后添加当前页、添加第二页、重复添加幂等、列表排序、点击跳页、删除、刷新 / 重新打开恢复；不同文档 key 隔离；没有文档时 fail-closed。
  - 视觉验证：只检查 L5a tab、空态 / 列表态、当前页状态和控件可达性；因 accepted-golden=0 且书签 surface=`missing`，本轮不做像素差异验收。
- 上一轮完成（2026-07-30，Codex，单 owner）：形状样式右栏纵向闭环。Allowed files：`src/modules/annotation/**`、`src/shared/pdf/annotation.ts`、批注相关 `AppShell` / `AnnotationOverlay` / `ShapeToolPanel` / 类型与测试、对应协作文档；Forbidden files：`src/modules/reader/readerReducer.test.ts`、`.zcode/**`、`src-tauri/**`、表单 / OCR / 页面管理链路。
- [x] 建立失败基线：右栏 shape / width / opacity / stroke / fill 只改变独立 UI state，未进入批注草稿、sidecar、overlay 或 PDF writer
- [x] 矩形、椭圆、直线、箭头、双向箭头和铅笔共用真实 shape state；选择右栏形状会 arm 对应画布工具
- [x] 线宽、不透明度、实线 / 虚线、边框色与填充色进入 sidecar，并在画布重开后回显
- [x] PDF writer 支持全部六类形状，导出后重开确认无 skipped；修正扁平化元数据在 save 后设置导致未写入的问题
- [x] Playwright 实际绘制、刷新恢复、导出下载与 PDF 重开验证通过
- [x] 建立书签失败基线：命令仍为 planned、utilityPanel 是“开发中”占位、摘要栏书签加号无动作
- [x] 页面书签使用按 document fingerprint / 安全摘要隔离的 sidecar；不写原 PDF，不把真实文件名写入 storage key
- [x] 接通添加当前页、重复添加幂等、列表排序、当前页标记、点击跳页和删除
- [x] 接通 `view-add-bookmark` 命令与 L5a 书签 tab；无文档时 fail-closed，不再用 recentFiles.lastPage 冒充书签
- [x] 单元 / 组件测试和 Playwright 实机覆盖刷新恢复、文档隔离与控制台零错误
- [x] 修复验证器与 planned 策略冲突：先断言 `T 编辑` disabled，再由带显式 query 的 dev-only 测试钩子触发潜在 edit surface；正式构建和普通开发页面均不解锁
- [ ] 按 accepted-golden 依次验收 L2、L3、L5、状态栏，不并行争抢全局布局
- [ ] 左栏分别完成 thumbnails、outline、annotations、bookmarks、search 的真实面板和状态
- [ ] 右栏分别完成 signatures、stamps、shape-style、annotation-summary、forms、export、OCR
- [x] 文档摘要使用当前 PDF bytes/metadata；OCR 状态和页码范围接真实 controller，不再传 null/noop
- [x] “文档助手/共享”误导入口改为真实“摘要/导出与交付”路由
- [x] command catalog 增加 `availability=planned`；未实现命令统一 fail-closed
- [ ] 每个 surface 单独记录 `skeleton / wired / behavior-complete / visually-verified`
- [ ] 不用相邻面板、重复画面或文字说明替代目标状态证据

#### M5 — 功能闭环与错误状态

- 本轮完成（2026-07-30，Codex，单 owner）：AcroForm 表单纵向闭环。Allowed files：`src/modules/forms/**`、表单相关 `AppShell` 接线、`tests/fixtures/forms/**`、对应测试与协作文档；未触碰 `src/modules/reader/readerReducer.test.ts`、`.zcode/**`、OCR / 页面管理写回链路。
- [x] 用可提交的无敏感信息 AcroForm fixture 复现“连续填写仍从原始 bytes 开始”的失败基线
- [x] 同一表单会话累计填写、勾选、签名和扁平化到工作副本；任何一步都不覆盖原文件
- [x] 从 UI 导出填写副本 / 扁平副本，并重开确认字段值、字段数量和页面结果
- [x] 表单填写、签名、导出、重新打开闭环（已有字段落点；自由拖放签名位置不在本子任务范围）
- [x] OCR controller、页码范围、任务队列、取消/质量报告链路有单元覆盖；本机真实 `ocrmypdf 17.4.0 + pdftotext 26.02.0` E2E pipeline 通过
- [x] 默认中文文字水印实际导出 5 页 PDF；字体 URL/fontkit interop 修复，浏览器下载产物可重开
- [x] 密码 PDF、文件损坏、权限不足、OCR 失败等错误态可复现并验收（**四项全部完成**：文件损坏 DEC-192 + 密码 PDF DEC-193 + 权限不足/OCR 失败 DEC-194，均经单元/集成测试验证）
- [x] T 编辑、图片/Word 转换、翻译、页面复制/粘贴在真实引擎接入前显式禁用，不能产生假成功反馈
- [x] 所有写入型操作继续遵守“不覆盖原文件、可回退、可交接”的 FaroPDF 安全边界（DEC-192~194 全程遵守：corrupt/encrypted fixture 入仓、密码不存储、路径脱敏、权限错误不泄露完整路径）

#### 当前只可声称的验证结果

- `geometry/density/semantic-verified`：L2/L3/L4 分层；L3 五段 x/width；read 不渲染 L4；单页页面 bbox/计数；L5 DOM 顺序；`T 编辑` 的 L3/原生菜单入口统一进入 272px 大纲左栏（大纲 tab 激活）+ 1008px 中央区 + 整窗居中单页；页面管理独立 `pages` mode、五张真实缩略图和页卡 bbox；搜索 273/767/240 三列；read/annotate/edit/pages 参考态状态栏隐藏。
- 两个测试视口已证明左右栏展开时中央区仍有可用宽度。
- 这些结果**没有**证明 accepted-golden 级颜色、字体、图标、像素差异、响应式断点或 PDF Expert 视觉等价。

#### 已知阻塞与边界

- ZAI bbox MCP 未配置，尚无自动元素坐标抽取；M1 可先人工量测，但必须记录方法。
- G01–G05 已有固定窗口 measured crop，但 accepted-golden 仍为 0；本轮只能生成带 ±12pt 容差的 measured CSS/门禁，不能关闭最终视觉验收。
- `src/modules/reader/readerReducer.test.ts` 有用户未提交修改；本任务不改写、不归并该文件。
- 历史 DEC、CHANGELOG 和进度日志只证明“当时做过什么”，不得覆盖本卡的当前状态。

### ISS-NEW-N PDF Expert 面板修正批次（基于 raw，限定范围）+ 补采归档

- 优先级：P1
- 类型：UI 修正批次（面板/对话框级）+ 补采归档
- 来源：2026-07-23 用户决策”用现有 raw 推进修正，剩下的缺图后续让其他 worker 补采后再归档”；独立 S4 反向审计评级：6 张 raw-Aminus + 5 张 raw-B（1 raw-B-low-confidence）+ 4 张 raw-C。
- 状态：**P01/P02/P04/P06 已完成（2026-07-24，wired + geometry-coarse-verified）。补采批次已落盘：CROP 的 window-only 机械流程与 SHAPE 已达到 `measured`，但 CROP 目标中的 L3 全展开状态仍待补采（均非 accepted-golden）；THUMB、SEL 仍缺图。P03（OCR，规格不清）未启动；P05 错误规格已于 2026-07-28 撤销并由 M2.1 完成状态拆分；M1 全量重采未启动。**
- 唯一证据入口：`docs/reference/pdf-expert/README.md`
- 实现现状入口：`docs/reference/pdf-expert/implementation-map.md`
- 协作文档：`docs/reference/pdf-expert/state-matrix.md`、`coverage-gap.md`、`manifest.json`

#### 范围与边界（与 ISS-NEW-M 的关系）

- ISS-NEW-N 是**ISS-NEW-M 的降级并行任务**：M1 全量重采 + 4 个 accepted-golden 仍按 ISS-NEW-M 推进，不被本卡替代。
- 本卡所有面板修正子卡**禁止宣称 `visually-verified`**。最高交付等级为 `wired` + `geometry-coarse-verified`（基于 raw 粗估），对应 acceptance-contract 的”非第五种完成状态”。
- 任何受 ISS-NEW-N-CROP / THUMB / SEL / SHAPE 补采子卡影响的实现项，必须在该子卡完成并 accepted-golden 准入后**单独复核**——不允许在 raw-Aminus 基础上声称”对齐 PDF Expert”。
- 本卡不修改 `src-tauri/`、`package*.json`、全局样式、`src/modules/reader/readerReducer.test.ts`。

#### 已确认根因（启动本卡的事实）

1. 15 张首批图片重新分级：6 raw-Aminus（R08/R09/R10/R11/R13/R15）+ 4 raw-B（R02/R04/R06/R14）+ 1 raw-B-low-confidence（R12）+ 4 raw-C（R01/R03/R05/R07）；accepted-golden 仍为 0。
2. raw-Aminus 6 张足以支撑 6 处的面板/对话框骨架修正（精度为粗估，未 crop、未稳定性 diff）。
3. 4 块 surface（chrome 精确尺寸、缩略图、selection 浮条、shape 6 段合同）在现有 raw 中无图，必须补采。
4. 重采速度过慢且环境存在真实阻碍（PDF Expert 会话恢复抢占 fixture；osascript 辅助功能权限被拒无法固定窗口），完整 M1 重采需独立 PR 与环境授权。

#### ISS-NEW-N-P01 SignaturePanel 竖排签名卡骨架

- 状态：**已完成（2026-07-24，commit 658b512）**；wired + geometry-coarse-verified。
- Allowed files：`src/modules/signature/`（components、store）、`docs/reference/pdf-expert/`
- 实际改动文件：`src/modules/forms/ui/SignaturePanel.tsx`（selectedId state）、`SignaturePanel.css`（--selected）、`SignaturePanel.test.tsx`（+1 测试）、`src/styles/app.css`（--selection token，与 P04/P06 共用）
- Forbidden files：`src-tauri/**`、全局样式、`readerReducer.test.ts`
- 证据：raw-Aminus R08
- 事实：竖排 7 张签名卡 + 首张选中蓝描边；header `签名` + `+`；右栏 placement；面板粗宽度（占中央可视区 1/4–1/3）
- 显式不推导：精确像素宽度、签名卡真实像素高度、empty state、insertion behavior、save/reopen
- 交付等级：wired + geometry-coarse-verified（最高不允许 visually-verified）
- 行为验证：组件存在、列表渲染、点击选中；不要求尺寸与 PDF Expert 像素对齐
- 视觉验证：自截图与 R08 视觉对照，不报失败码
- 实现决策：不改变"点击即落入"交互，给最近落入的签名加蓝色高亮反馈（视觉匹配 R08 的"选中蓝"）。selectedId 在删除选中签名时清空。
- 验收：
  - [x] SignaturePanel 渲染 header + 竖排卡片
  - [x] 首张选中蓝描边（点击后 selectedId 高亮 --selection）
  - [x] 不声明"对齐 PDF Expert"
  - [x] PR 描述引用 R08 + manifest.json 的 raw-Aminus 分级（commit 658b512）

#### ISS-NEW-N-P02 SetPasswordDialog center modal + 半透明遮罩

- 状态：**已完成（2026-07-24）**；wired + geometry-coarse-verified。
- Allowed files：`src/modules/forms/` 或 `src/components/dialog/`、`docs/reference/pdf-expert/`
- 实际改动文件：`src/components/layout/SecurityPanel.tsx`（根元素 aside→modal dialog + backdrop）、`SecurityPanel.css`（position:fixed + 居中 + 半透明遮罩 + focus 蓝）、`SecurityPanel.test.tsx`（+1 modal 测试）
- 证据：raw-Aminus R09
- 事实：center modal + 半透明遮罩 + 2 row（label+input）+ 2 action；focus 蓝描边
- 实现决策：SecurityPanel 当前是功能完整的右栏 aside（set/remove 双 mode + 真实加密 invoke）。采用方案 A：整体加 modal 外壳（position:fixed + backdrop + 居中），保留 set/remove 双 mode（不破坏现有功能）。不新建独立 SetPasswordModal，避免两个密码入口。input:focus 改用 --selection 蓝匹配 R09。
- 显式不推导：精确像素宽度、字体大小、validation error / loading / success 态的视觉
- 交付等级：wired + geometry-coarse-verified
- 行为验证：模态打开/关闭、set/remove 双 mode、backdrop 点击关闭、2 行输入提交
- 视觉验证：自截图与 R09 视觉对照
- 验收：
  - [x] 模态居中显示、半透明遮罩覆盖（position:fixed + backdrop）
  - [x] 保留 set/remove 双 mode + 2 row label+input + action 按钮
  - [x] focus 蓝描边（input:focus 用 --selection）
  - [x] backdrop 点击关闭（+1 测试）
  - [x] PR 描述引用 R09

#### ISS-NEW-N-P03 OcrPanelView 5 段结构 + L3 `扫描和文本识别` 次级工具条

> **⛔ 阻塞：规格不清，不可直接领取。** 见顶部"待补齐清单 B"。需先补 OCR 专属采集图（当前 G01-G05 未覆盖 OCR surface）并定义"5 段"具体清单 + 次级工具条挂载点。代码库无对应交互（ModeSecondaryToolbar 是扁平按钮非 popover）。归 M5。

- Allowed files：`src/modules/ocr/`（OcrPanelView、OcrStatusPanelView、controller）、`src/components/layout/`（Toolbar 中 `扫描和文本识别` 段）、`docs/reference/pdf-expert/`
- 证据：raw-Aminus R10
- 事实：右面板 header / 预览 / 说明 / 语言下拉 / 主按钮 5 段；主工具栏 `扫描和文本识别` 段点击展开次级工具条 5 项（增强扫描 / 拆分页面 / 裁剪页面 / 清除空白边 / 识别文本）
- 显式不推导：OCR 队列/进度/失败/取消态、次级工具条右端 overflow 真实内容、精确像素宽度、真实页面预览替代插画
- 交付等级：wired + geometry-coarse-verified（OCR 完整闭环留给 M5）
- 验收：
  - [ ] OcrPanelView 5 段渲染
  - [ ] 主工具栏 `扫描和文本识别` 段点击展开次级工具条
  - [ ] onStartOcr 仍为 placeholder 时不宣称 behavior-complete
  - [ ] PR 描述引用 R10

#### ISS-NEW-N-P04 StampPanel tab × 2 + preset 网格

- 状态：**已完成（2026-07-24，commit 658b512）**；wired + geometry-coarse-verified。
- Allowed files：`src/modules/stamp/`、`docs/reference/pdf-expert/`（实际扩展到 `src/components/layout/RightPanel.tsx` + `AppShell.tsx` 仅 stamps tab 接入点）
- 实际改动文件：新建 `src/modules/stamp/ui/StampPanel.{tsx,css,test.tsx}`；`RightPanel.tsx`（接入）、`AppShell.tsx`（onSelectStandardStamp + activeStampName）、`src/styles/app.css`（--selection token）
- 证据：raw-Aminus R11
- 事实：右面板 `标准/自定义` tab + preset 网格；首张蓝描边
- 实现决策：R11 粗估看到"2×2 共 4 张"，但 STAMP_TEMPLATE_LIST 有 9 个标准模板。**不砍模板**，改用响应式网格（默认 2 列、宽时 3 列）展示全部 9 个。严格 2×2 只是 R11 在某窗口宽度的巧合呈现，不是合同。
- 显式不推导：custom tab 内容、stamp 落点行为、精确像素尺寸、精确 2×2 断点
- 交付等级：wired + geometry-coarse-verified
- 验收：
  - [x] StampPanel 渲染 tab×2 + 标准/自定义切换
  - [x] 标准 tab 渲染 9 个模板预设（响应式网格，非固定 2×2）
  - [x] 选中蓝描边（--selection）
  - [x] 自定义 tab 嵌入 CustomStampPanel
  - [x] PR 描述引用 R11（commit 658b512）

#### ISS-NEW-N-P05 EditModeGridView 4 列响应式 wrap（4+1）+ 次级工具条 7 项（已撤销）

> **已关闭（2026-07-28）：不按本卡实现。** G05+G02 measured 证据证明“编辑”与“页面管理”是独立状态；M2.1 已完成状态机拆分并从 AppShell 卸载 `EditModeGridView`。原“4+1 wrap”来自误标 raw，不再是产品规格。页面网格后续只在 M3 的 `PageOrganizerWorkspace` 闭环推进。

- Allowed files：无；本卡禁止领取。后续 allowed files 由 M3 新 owner 单独声明。
- 证据：raw-Aminus R13（2 卡 + 次级工具条 7 项）+ raw-Aminus R15（4+1 响应式 wrap）
- 事实：次级工具条顺序 `插入页 / 附加文件 / 旋转 / 复制 / 粘贴(灰) / 摘录 / 删除(红)`；卡片两行元数据（页码索引 + A4 尺寸）；4 列响应式 wrap
- 显式不推导：固定 5 列、精确卡片像素宽度、drag 进行中/drop indicator、reorder persistence、save/export round-trip
- 交付等级：wired + geometry-coarse-verified（M3 完整闭环另立任务）
- 验收：
  - [x] 撤销本卡错误规格并阻止后续 worker 领取
  - [x] edit/pages 状态机拆分由 M2.1 落地
  - [ ] 页面管理真实缩略图、拖拽、写回与重开改由 M3 验收

#### ISS-NEW-N-P06 AnnotationToolbar active 蓝描边色

- 状态：**已完成（2026-07-24，commit 658b512）**；wired + geometry-coarse-verified。
- Allowed files：`src/modules/annotation/AnnotationToolbar.tsx/.css`、`docs/reference/pdf-expert/`
- 实际改动文件：新建 `src/components/layout/AnnotationToolbar.css`（最小基础样式 + 3 条 active 规则）、`AnnotationToolbar.tsx`（import css）、`src/styles/app.css`（--selection token）
- 证据：raw-Aminus R11 + raw-B-low-confidence R12（同样激活态）
- 事实：工具条顺序（粗肉眼）`text-highlight/text-underline/text-strike/pen(blue active)/highlighter/textbox/note/more`；active 蓝描边色
- 实现决策：组件 JSX 早已加 `--active` className，但 CSS 规则完全缺失（裸 button）。新建 AnnotationToolbar.css 补最小可读基础样式 + 3 条 active 规则（tool-button / color-swatch / stamp-button 用 --selection）。未改工具条项顺序（保持现有 ANNOTATION_TOOL_LIST）。
- 显式不推导：工具条右端 overflow、每项 hover/focus/disabled 四态、形状/形状样式（依赖 ISS-NEW-N-SHAPE）、工具条项精确顺序的独立语义审计
- 交付等级：wired + geometry-coarse-verified
- 验收：
  - [x] AnnotationToolbar active 态有蓝色视觉反馈（--selection box-shadow）
  - [x] pen active 蓝描边色（tool-button / color-swatch / stamp-button 三类 active 均覆盖）
  - [x] 不改工具条项顺序（保持现有 ANNOTATION_TOOL_LIST）
  - [x] PR 描述引用 R11（commit 658b512）

#### ISS-NEW-N-CROP 窗口已 crop 的 L3 工具栏全展开参考

> **🟡 部分完成：window-only 机械流程与搜索态已 measured（N-CROP-READ-DEFAULT、N-CROP-L3-SEARCH），但菜单栏/统一 M1 目标态仍缺。** 见顶部"待补齐清单 A"。搜索态已证明完整 L3、左大纲与右搜索结果同屏；raw 才含菜单栏且带桌面背景，不能直接升 golden。

- 优先级：P1（补采）
- 类型：证据补采
- Allowed files：`docs/reference/pdf-expert/captures/`、`golden/`、`manifest.json`、`state-matrix.md`、`measurements.json`、`capture-protocol.md`
- 证据基线：raw-B R06（含桌面背景，唯一 L3 全展开的图）
- 目标：单张已 crop 到 PDF Expert 窗口、含完整 L3 工具栏全展开 + macOS 菜单栏；按 capture-protocol.md 流程复采 2 次做 reference-vs-reference 稳定性 diff
- 阻塞 surface：L3 toolbar 自适应断点、窗口外边距、左右栏与中央分割线精确宽度
- Forbidden files：`src/**`、`src-tauri/**`、全局样式
- 验收：
  - [x] 已生成固定窗口的 window-only crop（`N-CROP-READ-DEFAULT`）；历史 raw 仍保留桌面背景
  - [x] capture-protocol.md 的窗口、fixture、Retina crop 参数已写入 `measurements.json`
  - [x] 2 次复采 + reference-vs-reference 稳定性 diff 通过（0 differing pixels）
  - [x] `measurements.json` 含 bbox + uncertainty；ZAI MCP 不可用已记录
  - [ ] manifest `classification` 升级为 `accepted-golden`（需独立审计和 M1 全量覆盖）
  - [x] 已补 `N-CROP-L3-SEARCH`：完整 L3、左大纲、右搜索结果、2 条命中高亮均在 window-only crop 中可见
  - [ ] 目标状态仍缺“window-only crop 同时含菜单栏”的干净图；当前菜单栏只在带桌面背景的 raw 中可见
  - [ ] 不实现 UI；唯一目的是让后续 M4 worker 能用此图做 measured spec

#### ISS-NEW-N-THUMB 左栏缩略图列表 + 当前页高亮

> **🔴 未启动：完全缺图。** 见顶部"待补齐清单 A"。G02 是整页页面管理网格不是左栏缩略图，不能替代。阻塞 P05/M4 thumbnails。

- 优先级：P1（补采）
- 类型：证据补采
- Allowed files：同 ISS-NEW-N-CROP
- 证据基线：raw-B R04（实为大纲，非缩略图）
- 目标：缩略图模式打开左栏的稳定截图；至少 5 页可见、当前页高亮可见
- 阻塞 surface：Sidebar thumbnails tab、缩略图卡片尺寸/间距、多页滚动当前页定位
- 验收：
  - [ ] 图片只保留 PDF Expert 应用窗口
  - [ ] 至少 5 张缩略图、当前页蓝色高亮
  - [ ] capture-protocol.md 流程完整
  - [ ] manifest `classification` 升级为 `accepted-golden`

#### ISS-NEW-N-SEL text selection 浮动工具条

> **🔴 未启动：完全缺图。** 见顶部"待补齐清单 A"。R07 与 2026-07-24 真实文字层安全拖选均无浮条；这只是负面验证，不构成目标状态证据。阻塞 TextSelectionToolbar 实现。

- 优先级：P1（补采）
- 类型：证据补采
- Allowed files：同 ISS-NEW-N-CROP
- 证据基线：raw-C R07（无 selection 浮条）
- 目标：在 read 模式下用真实文字层 fixture 框选一段，捕捉浮出工具条
- 阻塞 surface：TextSelectionToolbar、选区可见性、翻译占位文案替换
- 验收：
  - [ ] 图片显示选区 + 浮动工具条（本轮固定坐标拖选未触发，需找到可复现原生路径）
  - [ ] capture-protocol.md 流程完整
  - [ ] manifest `classification` 升级为 `accepted-golden`

#### ISS-NEW-N-SHAPE shape 6 段合同的真参考

> **🟡 部分完成：矩形激活态已 measured（N-SHAPE-RECTANGLE），但其他形状/绘制落点/段名独立审计仍缺。** 见顶部"待补齐清单 A"。manifest 自标 "six-section wording is interpreted, no independent audit"。

- 优先级：P1（补采）
- 类型：证据补采
- Allowed files：同 ISS-NEW-N-CROP
- 证据基线：raw-B-low-confidence R12（实为 stamp，误标）
- 目标：形状工具激活态截图；右侧面板展示 6 段形状样式合同
- 阻塞 surface：Shape panel、形状工具激活态与右栏样式、形状绘制行为
- 验收：
  - [x] 图片只保留 PDF Expert 应用窗口（`N-SHAPE-RECTANGLE`）
  - [x] 矩形形状工具激活态可见
  - [x] 右栏展示 preview / selector / stroke width / border / opacity / stroke+fill color / collapse 控件
  - [x] capture-protocol.md 流程参数和 a/b 稳定性 diff 已记录
  - [ ] manifest `classification` 升级为 `accepted-golden`（绘制行为、其他形状和独立审计仍缺）

#### 当前只可声称的验证结果

- 6 处面板/对话框级 raw-Aminus 骨架已存在，足以支撑 wired 修正交付。
- 6 组补采图已入库：read crop、页面管理网格、批注、矩形 shape、编辑画布、L3 搜索双栏；其中 crop/shape/search 已有 measured bbox，search 的 a/b 仅有 148 个 caret/IME 瞬态差异。
- 左栏缩略图与 text selection 浮条仍是硬缺口；页面管理网格不能冒充缩略图列表。
- **没有**声称任何 PDF Expert surface 已达到 `visually-verified` 或 PDF Expert 视觉等价。

#### 已知阻塞与边界

- ISS-NEW-N 不替代 ISS-NEW-M M1；M1 全量重采仍按 ISS-NEW-M 推进。
- 任何面板修正子卡升级到 `behavior-complete` 必须先有真实 PDF 结果（保存/导出/重开）；当前 raw 不足以证明。
- 任何面板修正子卡升级到 `visually-verified` 必须先有对应 accepted-golden（当前 6 张全是 raw-Aminus，不可）。
- 重采速度过慢的根因（会话恢复抢占 fixture、辅助功能权限被拒）仍存在；补采子卡执行时仍需你授权辅助功能或协助用 cliclick 拖动窗口。
- `src/modules/reader/readerReducer.test.ts` 有你的未提交修改；本卡任何子卡都不触碰。

### ISS-NEW-O doc-curator 扫描范围与历史任务卡归档维护

- 优先级：P1（文档治理维护，不阻塞 M4/M5 功能推进）
- 类型：工具链 / 上下文健康
- 来源：2026-07-30 按最新 AGENTS.md 执行 doc-curator 全量体检
- 状态：**进行中（第一批归档已完成 2026-07-31）**；本轮已修复进度日志、ISS 归档排序、DEC-074～096 索引断档，并把 ISS-030~055 共 24 张 v0.1 历史完成卡批量迁入 DECISIONS 归档区（TASKS 1907→约 1370 行）。
- 现状（2026-07-31 doc-curator 全量体检）：`tasks` / `decisions` / `context-sync` / `decision-sync` / `active-zone-residue` 硬门禁全部通过。全量 `markdown-link-broken` 报 324 条 hard，**经诊断全部是外部工具 glob bug 误报**：`check-markdown-link-broken.sh` 的排除规则 `*/node_modules/*` 漏匹配根级 `node_modules/`（路径以 `node_modules/` 开头时不匹配 `*/node_modules/*`），且该 checker 硬编码排除、不读 config 的 `exclude_paths`。FaroPDF 自身文档**零断链**（排除 node_modules/worktrees/target 后 0 hard）。根因在 doc-curator skill 所属的 `legal-skills` 仓，需在该仓修 checker glob（加 `node_modules/*` 分支），不在 FaroPDF 仓内。adaptive 项（TASKS 活跃卡数、DECISIONS/DESIGN/AGENTS 行数）随归档继续收敛。
- Allowed files：`.claude/skills/doc-curator/config/faropdf.yaml`、必要的 doc-curator 扫描脚本、`docs/TASKS.md`、`docs/DECISIONS.md` 与对应 skill 内部三件套；如项目 skill 为 symlink，按 skill-manager / git-workflow 另行确认真正归属仓库。
- Forbidden files：`src/**`、`src-tauri/**`、PDF Expert 功能实现、用户已有 `src/modules/reader/readerReducer.test.ts` 与 `.zcode/**`。
- 验收：
  - [ ] 断链扫描显式排除依赖目录、ignored worktree、构建产物和被项目规则弃用的 `research/pdf-expert/`
  - [ ] 为反引号示例、外部路径和真实仓内链接建立可区分的测试 fixture，避免“修文档迎合误报”
  - [ ] 审计 46 张旧任务卡，将已完成项分批迁入 DECISIONS 归档；未完成项保留真实状态，不机械删除
  - [ ] 维护后全量 scan 无 hard；adaptive 项有明确接受或后续记录

### ISS-022 updater 闭环启用 + Windows shell bash 回归 + keypair 脚本化

- 优先级：P1（发布工程 follow-up，DEC-070/DEC-071 的收口）
- 类型：发布工程 / 安全护栏
- 来源：2026-08-04 PR 2 `feat/updater-closed-loop`；PR 90（release.yml Folia 对齐）合并后从 main 拉
- 状态：**进行中（PR 待合并）**
- 范围：把 v0.1.1 设计时留作「分两步策略」的 updater 4 件套补齐，让打 tag 后 release.yml 产 `.sig` + `latest.json`，应用内自动更新真正闭环。
- 改动：
  - `src-tauri/tauri.conf.json`：`bundle.createUpdaterArtifacts` / `plugins.updater.active` → `true`；`plugins.updater.pubkey` 填正式公钥
  - `src-tauri/Cargo.toml`：**不改**。v2 plugin 拆分形式，updater 走独立 `tauri-plugin-updater` crate（已在 deps）+ Rust 端 `lib.rs:877` 已注册 `tauri_plugin_updater::Builder::new().build()`。`cargo check` 验证主 crate 无 `updater` feature，`features = []` 保持。
  - `.github/workflows/release.yml`：`tauri-action` step 加 `shell: bash`（DEC-070 fix 在 v0.1.1 重写时漏回）
  - `scripts/generate-updater-keypair.sh` + `package.json` `updater:keygen`：一键生成 + 灌 secret
  - `.gitignore` + `src-tauri/.gitignore`：`*.key` / `*.key.pub` / `*.sig` / `tauri-key*` 排除护栏
  - `docs/RELEASE.md` §3.1：加脚本引用 + 修正 pubkey 命令（`.pub` 文件本身 1 行 base64，直接 cat）
- 验收：
  - [ ] `cargo check --manifest-path src-tauri/Cargo.toml` 通过（updater feature 编译）
  - [ ] `pnpm run typecheck && pnpm run lint && pnpm run build` 全绿
  - [ ] PR 合并后打 tag `v0.2.0`，release.yml 产 3 平台 `.sig` + `latest.json`（SIG_COUNT > 0，不走 no-sigs 分支）
  - [ ] 应用内「关于 → 检查更新」走通：检测到新版本 → 下载 → 签名验证 → 安装
- 不在本 PR：ci.yml 门禁（vitest 4.1.8 退出悬挂单独 sprint 处理）、移动端、CODE_SIGNING 平台级签名
