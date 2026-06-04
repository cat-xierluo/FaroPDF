## 0.1.0-alpha.8 - 2026-06-04

- 批注深化第二阶段（DEC-037 / ISS-026）：新增批注侧边栏 4 维度分组与搜索/筛选、批注 → PDF 真实绘制导出、AnnotationSidebar 独立组件。
  - `src/modules/annotation/sidebarGroups.ts`：`AnnotationSidebarGroupBy = "page" | "color" | "type" | "label"` 4 维度分组纯函数 + `applyAnnotationSidebarFilters` 组合 query / types / pageNumbers / colors / labels 多 chip 筛选 + `deriveAnnotationLabel` 单来源标签提取 + `collectAnnotationLabelChoices` / 6 色 / 9 类型 chip 选项 + `sidebarFiltersFromSearch` / `sidebarFiltersToSearch` 互转；28 项单测覆盖。
  - `src/modules/annotation/annotationPdfWriter.ts`：`writeAnnotationPdf({ sourceBytes, sidecar, sourceFingerprint? })` 入口用 `pdf-lib` 真实绘制 9 种批注（highlight / underline / strikeout / note / textbox / rectangle / arrow / ink / stamp）；3/6 位 hex 颜色解析；越界 rect 自动 clamp；非法颜色 / 缺字段 / clamp 后面积为 0 / 中文 WinAnsi 字符等单批注跳过并记录原因；pageIndex 越界、pageCount 不一致、fingerprint 不匹配、schemaVersion 不匹配、空 / 非法 PDF 在调用方层抛错并脱敏；输出 PDF 元数据写入 `faropdf:annotation-flattened` 等关键字；`summary` 包含 drawnCount / skippedCount / pageDrawCounts / fingerprintChecked；建议输出名 `*-annotated.pdf`；20 项单测覆盖。
  - `src/components/layout/AnnotationSidebar.tsx`：受控组件 props（`hasDocument` / `annotations` / `currentPage`（1-based）/ `pageCount` / `onSelectPage(pageIndex)`（0-based 与 `AnnotationListPanel` 协议一致）/ `activeAnnotationId` / `onAnnotationClick`）；UI 含 segment control 4 维度切换 + 搜索 input + 4 类 chip（type 9 + color 6 + page 1-12 + label 来自 `collectAnnotationLabelChoices`）+ 清除筛选按钮 + 分组列表 + 3 态空态；**未挂 AppShell**（与第一版 Overlay/Toolbar 同策略，由 layout worker 后续 PR 接入）；18 项单测。
  - `src/modules/annotation/index.ts` 追加 sidebarGroups / annotationPdfWriter 全部导出。
- 范围严格遵守：未修改 `package.json` / 锁文件 / `Toolbar.tsx` / `AppShell.tsx` / `Sidebar.tsx`（已有 `AnnotationListPanel` 不动）/ `App.tsx` / 全局样式 / 路由 / `reader/` / `export/` / `forms/` / `src/shared/pdf/annotation.ts`（sidecar schema 不变）/ `src-tauri/Cargo.toml`；沿用 pdf-lib 1.17.1 无新依赖。
- 同步 `docs/DECISIONS.md` DEC-037（ISS-026 第二阶段方案，DEC 编号承接 DEC-036 ISS-013 延期后 +1）；`docs/TASKS.md` ISS-026 进度日志追加对应记录。
- 验证：60 个测试文件 / 561 个测试全部通过（新增 66 项：sidebarGroups 28 + annotationPdfWriter 20 + AnnotationSidebar 18）；`npm run typecheck` 干净；`npm run build` 成功；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 通过。
- 已知限制：批注扁平化导出未接入 `pdfOperationEngine.exportPdf` 的 `flatten-annotations` 路径（保持 plan-only 摘要），由后续导出 worker 决定是否升级为 execute；stamp 文字使用 Helvetica 真实绘制，中文 stamp label 静默跳过文字但保留边框（中文真实字形等 ISS-013 字体方案重启后并入）；AnnotationSidebar 不挂 AppShell，UI 验收需 layout worker 接入后浏览器截图。

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
