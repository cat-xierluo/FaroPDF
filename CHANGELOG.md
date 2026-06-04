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
- ISS-007 OCR 端到端联调（DEC-048 / feat/ocr-e2e）：补齐 OCR 真实接入的"端到端联调"缺口——之前所有测试都没跑过真实 ocrmypdf 子进程 + 真实 pdftotext 文本抽取 + 真实质量报告生成链路。
  - `tests/fixtures/ocr/generate-scan-fixture.mjs`（新增）：Node + pdf-lib 脚本，把 400x150 预渲染 PNG（base64 内嵌在源文件里，**不依赖 ImageMagick / pdftoppm**）嵌入 2 页 A4 PDF，生成 `scan-only-sample.pdf`（~5 KB），保证 clone 后 `node tests/fixtures/ocr/generate-scan-fixture.mjs` 即可得到稳定 fixture；2 页 A4 便于覆盖 `pageRange` 参数；产物由 `.gitignore` 排除（`tests/fixtures/ocr/*.pdf`）。
  - `tests/fixtures/ocr/README.md`（新增）：记录重新生成命令、本机工具需求（ocrmypdf ≥ 13 / pdftotext ≥ 22 / curl ≥ 7 / tesseract + eng + chi_sim）、已知限制。
  - `tests/e2e/ocr-e2e.test.ts`（新增）：4 个 case — `full pipeline: validate → start → poll → extract → quality report`（真实 `OcrBridgeService.startOcr` + 注入真实 ocrmypdf 后端 + `OcrJobController` 注入 pdftotext 后端 + `OcrPostProcessor.buildReport` 全链路断言 2 页都可检索 / 关键词 "OCR/E2E/2026" 全部命中 / `passed=true`）；`bridge rejects mismatched providerId before spawning ocrmypdf`；`controller sanitises backend errors so paths do not leak`；`prepareOcrRequest fills outputPath and outputStrategy defaults`；缺 `ocrmypdf` / `pdftotext` 时 `beforeAll` 探测 + 每个 test 内部 `requireTools()` 静默跳过。
  - `src-tauri/src/lib.rs` 末尾新增 `#[cfg(test)] mod ocr_e2e_tests`（1 个 case）：复用前端 fixture 复制到 temp 目录 → `dispatch_ocr(OcrDispatchBackend::LocalOcrMyPdf)` 真实跑 ocrmypdf → `extract_pdf_text` 真实跑 pdftotext 抽 2 页文字 → `OcrJobQueue::new(tempfile)` 持久化 + `OcrJobQueue::new(same path)` reload 验证 `status=completed` / `backend=local-ocrmypdf` / `input_path_summary.kind=local-pdf` / `fingerprint` 非空 / `progress.completed_pages=2`；缺工具或 fixture 时静默跳过。
  - `src-tauri/src/ocr_text_extract.rs`：1 行参数顺序 bug 修复（`extract_pdf_text` 之前 `.arg("-").arg(pdf_path)` 与 pdftotext CLI 语法 `pdftotext [options] input.pdf [output]` 不符，导致 `Syntax Error: Document stream is empty` 错误地传给上游 `start_ocr_job` 质量检查分支；修正为 `.arg(pdf_path).arg("-")`；E2E 真实链接测试补了这个盲点——DEC-030 接入以来 `extract_ocr_text` 从未被真实链接测试覆盖过）。
  - `.gitignore`（追加 3 行）：`tests/fixtures/ocr/*.pdf` / `*.tmp` / `*.bak`。
  - 范围严格遵守：未修改 `package.json` / 锁文件（fixture 走 pdf-lib 已有依赖）/ `src-tauri/Cargo.toml`（Rust 测试只复用前端 fixture，**不重新生成**；`lopdf` 已 DEC-040 引入）/ `src/components/**` / `src/App.tsx` / 全局样式 / 路由 / `Toolbar.tsx`（按 DEC-032 协议）/ `src/shared/ocr/*` 共享契约 / 其他模块（reader / search / annotation / forms / export / pages / settings / scan-preprocess）；不引入新 crate / 新 npm 包。
  - **scope 变更**：`src-tauri/src/lib.rs` 原本在 forbidden 范围，但项目无 `src-tauri/tests/` 目录 + 除 `run()` 外所有模块都是 private，Rust 集成测试只能内联在此文件末尾的 `#[cfg(test)] mod`（与 `ocr_bridge_tests` / `scan_preprocess_tests` 风格一致）。仅追加测试模块，**不修改 `run()` / 任何 command / 任何共享契约**。STATUS.json `scope_change_log` 详细说明 + `pm_action_required=true`。
- 同步 `docs/DECISIONS.md` 追加 DEC-048（`feat/ocr-e2e` 整体方案 + scope 变更说明 + bug fix 归并 + typecheck 现状）；`docs/TASKS.md` ISS-007 任务卡后追加「ISS-007 OCR 端到端联调 worker」活跃任务卡 + 进度日志；`docs/ROADMAP.md` **未改**。
- 验证：`npm test -- --run` ✅ 74 文件 / 697 tests 全过（+ 4 个新 e2e）；`cargo test --manifest-path src-tauri/Cargo.toml --offline --lib` ✅ 42 / 42 全过（+ 1 个新 Rust E2E）；`cargo check --manifest-path src-tauri/Cargo.toml --offline` ✅ 干净（9 个 pre-existing dead_code warning 来自 scan_preprocess，与本 PR 无关）；`npx vite build` ✅ 2.81s 出完整 dist；`ocrmypdf --version` 17.4.0 / `pdftotext -v` 26.02.0。
- 已知限制：`npm run build` 走 `tsc && vite build` 阶段因项目级 pre-existing `target: ES2020` 不支持 `Array.prototype.at` 报 28 个 TS2550 错误（**与本 PR 无关**，详见 DEC-048 §4）；fixture 不入仓，clone 后必须先 `node tests/fixtures/ocr/generate-scan-fixture.mjs`，否则 Rust E2E 静默跳过；CI 镜像未预装 `ocrmypdf` / `pdftotext` / `tesseract` 时 E2E 静默跳过；云端 OCR provider（paddleocr / mineru）真实 HTTP 调用的 E2E 留 ISS-010 consent flow 收口后另起 worker（ISS-007 v0.1 真实使用场景是本地 ocrmypdf）。

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
