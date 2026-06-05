# FaroPDF 任务清单

> 待处理任务、缺陷修复、技术债清理和未归属 Roadmap 的工作项。已完成的 ISS 任务卡归档到 `docs/DECISIONS.md` 的「ISS 任务归档」一节。

## 推进策略

`docs/TASKS.md` 是 FaroPDF 的活跃任务入口：当前正在推进、待开工或暂缓的任务保留详细任务卡；已经完成或第一版已合并的任务迁移到 `docs/DECISIONS.md` 的「ISS 任务归档」，TASKS.md 本身保持精简。

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

- `feat/foundation-scaffold`：ISS-001、ISS-011、ISS-012（已合并到 main）。
- `feat/pdf-output-tools`：ISS-005、ISS-013，可在导出引擎稳定后合并推进。
- `feat/ocr-pipeline`：ISS-007、ISS-016、ISS-017，可在设置页和文本层完成后合并推进。
- `feat/page-organizer-suite`：ISS-006、ISS-018、ISS-019，可在阅读底座和导出引擎完成后合并推进。
- `feat/app-distribution`：ISS-021，单独推进收口后再合并，避免与设置页 UI 互相阻塞。
- `feat/settings-page`：ISS-022、ISS-023，建议合并推进，集中在 `src/components/settings/` 和 `src/modules/settings/`，避免与 ISS-021 同时改 `src-tauri/`。

## 活跃任务

### ISS-007 OCR bridge

- 优先级：P0
- 类型：OCR
- 状态：进行中（bridge 真实接入第二版已完成，等待合并 / 后续 UI 接入）
- 建议分支：`feat/ocr-bridge`
- 建议 worktree：`.claude/worktrees/tmux-ocr-bridge`
- 依赖：ISS-003、ISS-014、ISS-017
- 范围：`src/modules/ocr/`、`src/shared/ocr/`、`src-tauri/` OCR command、OCR 相关测试
- 参考算法：`pdf-processor/scripts/pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py`
- 目标：建立 OCR 任务模型，优先连接本地 Legal Skills / `ocrmypdf`，并支持 PaddleOCR、MinerU 等外部 OCR API adapter。
- 验收：纯扫描 PDF 可触发 OCR 任务；任务显示后端、页码范围、进度、输出路径和失败原因；生成双层 PDF 后能做搜索质量抽查；OCR 模式工具条至少覆盖识别文本、输出双层 PDF 和质量检查。
- 当前进度：bridge 真实接入第二版已完成。后端 `start_ocr_job` 按 provider 分发到 `ocrmypdf` 本地子进程（`local-ocrmypdf` / `legal-skills`）或 `curl + HTTPS` 云端 OCR（PaddleOCR / MinerU），错误信息脱敏并写回 job 进度；任务队列持久化到 `app_config_dir/ocr-jobs.json`，启动时回收残留 running 任务为 cancelled；新增 `list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text` 四个 command；OCR 完成后 `pdftotext` 提取页面文本喂给 ISS-017 `ocrQualityCheckService` 生成可检索页比例、关键词命中和体积比报告。前端 `createTauriOcrJobController` 包装新 command；`createOcrPostProcessor` 把后端提取的文本转换成 `OcrQualityReport`；`OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView` 作为独立 React 组件覆盖识别文本、输出双层 PDF 和质量检查三个按钮以及任务列表 / 质量报告视图；**新组件已接入 `AppShell` context toolbar 与 main 工作区**（PR #29 / DEC-042），`activeMode === "ocr"` 时挂载 `OcrModeToolbar` + `OcrWorkspace`（含 OcrJobList / OcrQualityReportView），`utilityPanel` 在 ocr 模式隐藏。云端 apiKeyRef 当前仅接受 `env:` 形式（其他 `keychain:` / `credential:` / `credential-ref:` / `api-key-ref:` 暂时返回明确错误，提示用户改用 `env:`）；本机需安装 `ocrmypdf` / `pdftotext` / `curl` 才能跑通 OCR 真实路径。窄屏（< 720px）`OcrWorkspace` 内部两列 grid 折叠为单列（与 floating-panel 的 480px 断点区分）。
- 下一步：真实 PDF 端到端 fixture 验证（PR #33 / DEC-050 已落端到端测试基础设施 + 1 case；多 fixture 多 case 持续补充）、`keychain:` 凭证引用形式与 OS Keychain 集成、根据 `legal-skills` 实际可用脚本收敛 fallback 逻辑。

### ISS-007 OCR 端到端联调 worker（feat/ocr-e2e）

- 优先级：P0
- 类型：OCR
- 状态：进行中（端到端测试基础设施 + E2E 集成测试已落 feat/ocr-e2e，等待 PM 合 review）
- 建议分支：`feat/ocr-e2e`
- 建议 worktree：`.claude/worktrees/tmux-ocr-e2e`
- 依赖：ISS-007 第二版（DEC-030 / DEC-042）
- 范围：`tests/fixtures/ocr/**` + `tests/e2e/ocr-e2e.test.ts` + `src-tauri/src/ocr_text_extract.rs`（1 行参数顺序修复）+ `src-tauri/src/lib.rs` 末尾 `#[cfg(test)] mod ocr_e2e_tests` + `.gitignore` + 文档
- 目标：把 OCR 真实接入的"端到端联调"缺口补齐——之前所有测试都没跑过真实 ocrmypdf 子进程 + 真实 pdftotext 文本抽取 + 真实质量报告生成。
- 验收：
  - fixture PDF 存在（`tests/fixtures/ocr/scan-only-sample.pdf`，由 `.gitignore` 排除，由 `generate-scan-fixture.mjs` 重新生成）
  - `npm test -- --run` 全过（含 `tests/e2e/ocr-e2e.test.ts` 4 个 case）
  - `cargo test --manifest-path src-tauri/Cargo.toml --offline --lib` 全过（含 `ocr_e2e_tests` 1 个 case）
  - 顺带修复 `extract_pdf_text` 的 pdftotext 参数顺序 bug（详见 DEC-050 §2.4）
- 当前进度：
  - 夹具脚本 `tests/fixtures/ocr/generate-scan-fixture.mjs` 已落（pdf-lib 嵌入 base64 PNG，2 页 A4 扫描件 ~5 KB，README.md 记录工具需求与重新生成命令）
  - 前端 vitest E2E `tests/e2e/ocr-e2e.test.ts` 4 case 全过（`full pipeline` + `bridge rejects mismatched providerId` + `controller sanitises backend errors` + `prepareOcrRequest defaults`）
  - Rust 集成测试 `src-tauri/src/lib.rs` 末尾 `ocr_e2e_tests` mod 1 case 全过（`full_ocr_pipeline_runs_ocrmypdf_then_extracts_text_via_pdftotext`：dispatch_ocr 真实跑 ocrmypdf + extract_pdf_text 真实跑 pdftotext + OcrJobQueue 持久化 + reload 字段完整性）
  - 顺手修了 `src-tauri/src/ocr_text_extract.rs` 的 pdftotext 参数顺序 bug（之前 `- pdf_path` 顺序导致 `Syntax Error: Document stream is empty` 错误地传给上游 `start_ocr_job` 质量检查分支；E2E 真实链接测试补了这个盲点）
  - 总测试 74 文件 / 697 tests 通过；typecheck / build 失败是项目级 pre-existing `target: ES2020` 不支持 `Array.prototype.at`（与本 PR 无关，详见 DEC-050 §4 / §5）
  - `docs/DECISIONS.md` 追加 DEC-050（`feat/ocr-e2e` 整体方案 + scope 变更说明 + bug fix 归并 + typecheck 现状）
  - 进度日志：本任务卡（即此段）+ `CHANGELOG.md` 新增 0.1.0-alpha.10 段（合并 DEC-050 的 OCR E2E 进展）
- 下一步：合并后跑 CI 验证 fixture 在干净环境下的重新生成；PM 决定是否把 `tsconfig.json` 升级到 ES2022 的修复并入本 PR 或独立 maintenance PR；后续 ISS-007 工作（`keychain:` 凭证引用 + OS Keychain 集成 + legal-skills fallback 收敛）按原计划推进。

### ISS-008 表单填写与签署

- 优先级：P1
- 类型：表单
- 状态：进行中（第一版契约 + formService execute 升级 + reader 扩展 + useFormController + FormsPanel 浮层 + 4 件套验证已落 `feat/forms-signing`；**窄屏（< 480px）底部 sheet 适配收口 DEC-055，已落 `fix/iss-008-forms-narrow` 待 PM 合 review**）
- 建议分支：`feat/forms-signing` + `fix/iss-008-forms-narrow`
- 建议 worktree：`.claude/worktrees/tmux-forms-signing` + `.claude/worktrees/fix-iss-008-forms-narrow`
- 依赖：ISS-002、ISS-005
- 范围：`src/modules/forms/`、`src/shared/pdf/form*`、表单签署相关测试 + `src/modules/reader/useReaderController.ts`（加 3 个方法，不破坏 API 形状）
- 目标：支持 AcroForm 字段识别、填写、签名图片、手写签名、日期、勾号、叉号、图章、图片和扁平化导出。
- 验收：常见 PDF 表单可填写并导出为不可编辑提交版；填写和签名模式工具条覆盖文本、签名、日期、勾号、叉号、图章、图片和导出为压平。
- 当前进度：在 `feat/forms-signing` 完成第一版（DEC-035）：`src/shared/pdf/form.ts` 扩展 `PdfFormOperation` / `PdfFormBatchRequest` / `PdfFormBatchResult` / `PdfFormFlattenSummary` + helper；`formService` 真实 `pageIndex`（PDFDict → pageIndex 查找表）+ `flattenForm` + `applyFormOperations` 批量入口；`useReaderController` 暴露 `getFileBytes` / `getCurrentFileName` / `saveUpdatedBytes`（浏览器 `<a download>`，不依赖 Tauri）；`useFormController` 13 个动作维护 formState / panelMode / 草稿 / 签名图片，文档切换 reset；`activeFormController` 模块级桥让 mode 工具 onClick 拿到 controller；`registerFormsToolbarTools` 按 DEC-032 §"W3 Forms" 注册 4 个 forms mode 工具（refresh / fill / signature / flatten）到 `registerModeTools("forms", [...])`；`FormProvider` + `FormsPanel` 浮层在 `activeMode === "forms"` 时挂载，独立 `FormsPanel.css` 不污染全局样式。`src/components/layout/Toolbar.tsx` / `src/App.tsx` / 全局样式 / 路由 / `package.json` / 锁文件 / `src-tauri/Cargo.toml` **未修改**。82 项新测试通过；总测试 419 / 419；`npm run typecheck` / `npm run build` / `npm test -- --run` / `cargo check --manifest-path src-tauri/Cargo.toml --offline` 全绿。
- **窄屏适配收口（DEC-055 / `fix/iss-008-forms-narrow`，待 PM 合 review）**：`FormsPanel` 浮层在 < 480px 视口下与主工具栏（56px）+ 上下文工具条（42px）顶部重叠；新增 `src/modules/forms/breakpoints.ts` 暴露 `FORMS_PANEL_NARROW_BREAKPOINT = 480` 常量 + `formsPanelNarrowMediaQuery()` helper；`FormsPanel.tsx` 用 `matchMedia` 监听视口切换 `data-layout="floating" | "bottom-sheet"` 属性；`FormsPanel.css` 新增 `@media (max-width: 479px)` + `[data-layout="bottom-sheet"]` 选择器把浮层改为 `bottom:0 left:0 right:0` 全宽 `70vh` 最大高度的底部 sheet，避开工具栏；新增 6 项窄屏单测（断点常量 / 桌面默认 / 360px 切换 / 视口缩放动态切换 / 480px 边界 / 窄屏下字段列表+编辑器内容仍可渲染），总测试 22 / 22 通过；`npm run typecheck` / `npm run lint` 干净（pre-existing 43 errors 与本 PR 无关）/ `npm run build` 成功；`src/components/layout/{AppShell,Toolbar,Sidebar}.tsx` / `package.json` / 锁文件 / `src-tauri/**` / 全局样式 / 其他模块均**未修改**，符合 layout worker 范围隔离协议。
- 下一步：FormsPanel 走 utility panel 路径在 `feat/pdf-expert-shell-ia` 收口时统一处理（DEC-049 已规划），本 worker 只做窄屏底部 sheet 自适应；签名图片限定 PNG / JPG（pdf-lib embed 限制）；批量填写 / 字段校验规则引擎 / 手写签名 / 日期 / 勾号 / 叉号 / 图章等高级控件待后续 worker 推进。

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
- 当前进度：已在 `feat/pdf-expert-shell-ia` 做出基础壳层重排，并补上 PDF Expert 风格空态、转换入口、最近文件占位、分组导出工具条、填写签名工具条、扫描/OCR 工具条和页面管理"另存为新 PDF"出口；已用 `/tmp/faropdf-ui-sample.pdf` 检查打开态、页面管理和导出工具条，并修正 900px 窄屏顶栏溢出。code review 后已修正无文档页面管理假页面、视图设置状态硬编码和窄屏搜索入口隐藏问题。**第二阶段 4 个 milestone（M1 阅读态视觉 polish / M2 搜索结果层 / M3 页面管理多选撤销 / M4 OCR 任务参数区）已在 `feat/pdf-expert-shell-ia` 完成（DEC-049 / 0.1.0-alpha.10），等 PM 合 review 后发版。**
- 下一步：浏览器截图检查 4 个 milestone 视觉无重叠（与 PM 协同 PR 合并 / 视觉验收）；页面管理 Undo 接 pageOrganizer service 真实 history/undo（留作后续导出 worker）；OCR 参数区接「设置 → OCR provider」section 跳转（ISS-022 浮层收口时合并）。
- 设计差距速查：见 `docs/DESIGN.md` 「当前设计差距」一节。

### ISS-021 全平台打包与自动更新

- 优先级：P1
- 类型：发布 / 工程
- 状态：第二版已交付（autoUpdateCheck 设置项 + About toggle）；移动端 / 增量回退 / CODE_SIGNING 仍 follow-up
- 建议分支：`feat/app-distribution`
- 建议 worktree：`.claude/worktrees/tmux-app-distribution`
- 依赖：ISS-001、ISS-009
- 范围：`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`.github/workflows/release.yml`（新增）、`scripts/create-updater-manifest.mjs`（新增或参考 folia）、`src/modules/settings/`（更新入口）、`src/shared/update/`（新增 update service）、`src/components/settings/AboutSection.tsx`（更新检查 UI）、`docs/RELEASE.md`（新增）
- 参考实现：`folia/src-tauri/Cargo.toml`（`tauri-plugin-updater` 依赖）、`folia/src-tauri/tauri.conf.json`（`plugins.updater.endpoints` + `pubkey` + `bundle.createUpdaterArtifacts = true`）、`folia/.github/workflows/release.yml`、`folia/scripts/create-updater-manifest.mjs`、`folia/src/services/updateService.ts`、`folia/src/services/autoUpdateScheduler.ts`
- 目标：让 FaroPDF 具备和 folia 同等的全平台桌面打包与自动更新能力，覆盖 macOS / Windows / Linux；接入 `tauri-plugin-updater` 与 GitHub release updater manifest，建立签名密钥对、`latest.json` 生成和应用内「检查更新」入口。
- 验收：
  - `src-tauri/Cargo.toml` 加入 `tauri-plugin-updater`；`tauri.conf.json` 配置 `plugins.updater.endpoints` + `pubkey`，`bundle.createUpdaterArtifacts = true`。✅ M1
  - 桌面三平台 `tauri build` 产出 `.app` / `.msi` / `.AppImage` / `.deb` 及对应签名 updater artifact。✅ M3（CI 矩阵 + createUpdaterArtifacts；本地不跑跨平台构建）
  - `.github/workflows/release.yml` 在 `v*` tag push 时跨平台矩阵构建、生成 `latest.json` 与签名、自动发布到 GitHub Releases。✅ M3
  - 应用内 `checkForAppUpdate` 走 `tauri-plugin-updater`，能拉到新版本并支持下载安装；`autoUpdateCheck` 设置项可关闭自动检查。✅ M2（手动检查 M2-1 + `autoUpdateCheck` 设置项 M2-2 / DEC-056）
  - 更新密钥通过本地 `tauri signer generate` 生成，私钥不入库，公钥写入 `tauri.conf.json`。⚠️ 占位 pubkey 已写，正式发布前由 PM 重生成（见 DEC-048 §2.3 + docs/RELEASE.md §3.1）
  - 增量更新失败时回退到完整重装路径，不阻塞用户阅读。❌ 留 v0.3+ follow-up（tauri-plugin-updater 内置 chunk 重试；失败需用户手动去 GitHub Releases 下载）
  - 移动端（Android / iOS）打包在 v0.3 评估范围，先在 `docs/RELEASE.md` 记录限制与后续计划，不在 ISS-021 内强制实现。✅ docs/RELEASE.md §1 + §4 记录
- 进度日志：
  - 2026-06-04：在 `feat/app-distribution` 推进 ISS-021 第一版（DEC-048）：新增 `src/shared/update/` 5 文件（types / updateService 累计 progress adapter / updateCapability / index + 3 测试文件，14 项新单测）+ `src/modules/settings/sections/AboutSection.tsx` 接 `createTauriUpdateClient` 9 态状态机（手动检查 → available → 下载并安装 → 重启提示；AboutSection.test.tsx 9 项）+ `src-tauri/Cargo.toml` 加 `tauri-plugin-updater = "2.10.1"` + `src-tauri/src/lib.rs` 注册 plugin + `src-tauri/tauri.conf.json` `bundle.createUpdaterArtifacts` + `plugins.updater` 配置块 + `package.json` 加 `@tauri-apps/plugin-updater@2.10.1` + `tsconfig.json` lib ES2020→ES2022（解锁 27 个 pre-existing `Array.prototype.at` 错误）+ `.github/workflows/release.yml`（3 平台 matrix：macos-universal / windows-x64 / linux-x64 → artifacts → `scripts/create-updater-manifest.mjs` → latest.json + softprops/action-gh-release@v2 发布）+ `scripts/create-updater-manifest.mjs`（纯 ESM，零 npm 依赖，扫描 .app.tar.gz / .msi / .AppImage 调 `cargo tauri signer sign`）+ `docs/RELEASE.md`（产物矩阵 / 密钥管理 / 发布流程 / 5 项限制）。**未**改 `src/components/...`（除 update 入口）/ `src/styles/` / `Toolbar.tsx` / `App.tsx` / `Sidebar.tsx` / `src-tauri/src/{ocr,scan_preprocess,forms}/` / 其他 reader/search/annotation/forms/export/pages/ocr/preprocess 模块 / `src/shared/{pdf,ocr,preprocess,annotation,form,export,settings}/` / `assets/fonts/`。pubkey 写占位 `RWSY2kf...`（CI 弱密码生成的 base64 段），私钥已 rm 丢弃；首次生产发布前必须由 PM 重生成。验证：76 文件 / 689 测试（+5：updateService 7 / updateCapability 2 / AboutSection 新增 6 + 替换 3）；typecheck / build / cargo check 全绿；增量更新失败回退 / autoUpdateCheck / 移动端 / CODE_SIGNING 留 follow-up（详见 DEC-048 + docs/RELEASE.md §4）。
  - 2026-06-05：在 `feat/iss-021-auto-update-check` 推进 ISS-021 follow-up 第二版（DEC-056）：`autoUpdateCheck: boolean` 写入 `AppSettings`（`src/shared/settings/types.ts`，默认 `true`）+ `createDefaultAppSettings` / `normalizeAppSettings` 同步更新（`src/shared/settings/defaults.ts`）+ `AboutSection` 加「自动检查更新」checkbox + useEffect 在 mount 时按 `autoUpdateCheck` 决定是否自动调 `checkForAppUpdate`（ref 一次性 guard，禁 strict mode 双调用 + 切到 true 不会重复触发）+ 6 项 AboutSection 单测（toggle 默认值 / 切换持久化 / mount 时自动检查 / 关闭时跳过 / 手动按钮仍可用 / 切回 true 持久化）+ 2 项 SettingsService 单测（持久化 `autoUpdateCheck=false` 不被默认值覆盖 / 旧 release 无该字段时退回默认 `true`）+ `SettingsPanel.css` 补充 `.settings-about-card__auto-toggle` / `__auto-toggle-hint` 样式（与既有 `.settings-row` 一致）。`contracts.test.ts` 同步补 `autoUpdateCheck: true` 字段（typecheck 通过）。**未**改 `src/shared/update/*`（DEC-048 9 态状态机保留原样）/ `src/components/layout/*` / `src/App.tsx` / `src/styles/app.css` / `package.json` / 锁文件 / `src-tauri/**` / `config/**`（DEC-053 收口） / 任何 reader / search / annotation / forms / export / pages / ocr / preprocess 模块。9 态状态机 `available` / `downloading` / `downloaded` / `installing` 行为零改动（确保 regression）。验证：80 文件 / 751 测试（+8：AboutSection 6 + SettingsService 2；现有 6 个 manual-check 测试在 `autoUpdateCheck=false` 下独立验证 9 态状态机）；typecheck 干净；lint 43 个错误（与 main 基线一致，pre-existing 0 回归）；build 2022 modules 成功；cargo check 干净（9 pre-existing dead_code warning 0 回归）。已知限制：auto-check 触发点是「About section mount」（用户首次打开设置 → 关于），**不**是 App 启动时刻（避免触碰 forbidden 的 `App.tsx` / `AppShell.tsx`）；debounce 500ms 未实现（App.tsx 当前 `onChange` 是同步 in-memory，SettingsService 真正落盘的 future PR 接入时再按需加）；增量更新失败回退 / 移动端 / CODE_SIGNING 仍 follow-up。

### ISS-022 设置页面 UI 整合

- 优先级：P1
- 类型：UI
- 状态：待处理
- 建议分支：`feat/settings-page`
- 建议 worktree：`.claude/worktrees/tmux-settings-page`
- 依赖：ISS-014、ISS-021
- 范围：`src/components/SettingsPage.tsx`（新增）、`src/components/settings/`（新增分组目录）、`src/modules/settings/SettingsPanel.tsx`（拆分到各 section）、`src/styles/`、`docs/DESIGN.md`（设置浮层视觉补遗）
- 参考实现：`folia/src/components/SettingsPage.tsx`、`folia/src/components/settings/GeneralSection.tsx` / `AppearanceSection.tsx` / `ShortcutsSection.tsx`、`folia/src/hooks/useSettings.ts`、`folia/src/services/settingsService.ts`
- 目标：把现有扁平的 `SettingsPanel.tsx` 改造成左侧导航 + 右侧多 section 的浮层设置页，至少包含「常规 / 阅读 / OCR provider / 快捷键 / 关于」五个 section；遵循 `docs/DESIGN.md` 的视觉系统。
- 验收：
  - 设置入口在主工具栏触发浮层，Esc 关闭、点遮罩关闭、焦点管理符合 `docs/DESIGN.md`。
  - 左侧导航在窄屏视口下能折叠为顶部 tabs 或下拉。
  - 五个 section 全部可访问；非首屏 section 走 `lazy` 减少首屏体积。
  - 现有 `AppSettings`、`OcrProviderConfig` 契约和 `useSettings` 不破坏。
  - 单元测试覆盖导航切换、Esc 关闭、section 懒加载和验证错误展示。
  - 与 `docs/DESIGN.md` 的色板、字号、控件密度和暗色模式保持一致。

### ISS-023 关于页面与作者页

- 优先级：P1
- 类型：UI / 品牌
- 状态：第一版收口（DEC-051，feat/iss-023-author-update 待 PM 合 review）
- 建议分支：`feat/iss-023-author-update`（独立推进，避免与 `feat/settings-page` / `feat/app-distribution` 同时改设置模块）
- 建议 worktree：`.claude/worktrees/tmux-iss-023-author-update`
- 依赖：ISS-021、ISS-022
- 范围：`src/components/settings/{AuthorCard.tsx, AuthorCard.test.tsx, AuthorCard.css}`（新增）、`src/assets/{wechat-qrcode.png, QRCODE_LICENSE.md}`（新增）、`src/modules/settings/sections/{AboutSection.tsx, AboutSection.test.tsx}`（末尾作者卡占位替换为 AuthorCard + 追加 3 项测试）；不动 `src/components/settings/AboutSection.tsx`（计划路径；实际 AboutSection 在 `src/modules/settings/sections/` 已有，DEC-038 已落）
- 参考实现：`folia/src/components/settings/AboutSection.tsx`（应用 icon、版本、update check、作者名 / GitHub / 微信二维码）、`folia/src/services/updateService.ts`（`getCurrentAppVersion` + `checkForAppUpdate` + `FALLBACK_APP_VERSION`）
- 目标：在设置页增加「关于」section，展示 FaroPDF 应用 icon、产品名、定位、版本、官网 / GitHub 链接、当前更新状态；同 section 或独立子卡展示作者信息（姓名、GitHub 链接、微信公众号二维码和说明）；「检查更新」按钮接入 ISS-021 的 update service。
- 验收：
  - 关于 section 显示应用 icon、产品名「FaroPDF」+ 定位句、版本号（取自 `getCurrentAppVersion`，回退 `FALLBACK_APP_VERSION`）、官网 / GitHub 链接和「检查更新」按钮。✅ DEC-038 + DEC-048
  - 「检查更新」按钮触发 `checkForAppUpdate`，显示 9 态（DEC-048 扩展了 downloading / downloaded / installing 三个下载阶段）；自动更新开关读取 `settings.autoUpdateCheck`。⚠️ 9 态 ✅ DEC-048；`autoUpdateCheck` 留 follow-up（src/shared/settings/ 在 ISS-023 forbidden 范围）
  - 作者卡显示作者姓名、GitHub 个人页链接、微信公众号二维码图片和扫码说明。✅ DEC-051
  - 二维码图片走 `src/assets/` 静态资源或文档附件，不内置账号 / 密码 / Token 等敏感信息。✅ DEC-051（`QRCODE_LICENSE.md` 明确约定）
  - 关于 section 在 900px 窄屏视口下不被裁切，关键信息不重叠。✅ DEC-038 + DEC-051（`@media (max-width: 479px)` 单列布局）
- 当前进度（DEC-051 / 2026-06-05）：作者卡独立组件 `AuthorCard`（`src/components/settings/AuthorCard.tsx`，受控 props 注入避免耦合 `readAppMetadata`；空 name 兜底「作者信息未配置」）+ 独立 CSS（`AuthorCard.css`，`image-rendering: pixelated` 让 1×1 占位图保持方块感，`< 480px` 折叠单列）+ 6 项单测（name / GitHub href-target-rel / QR src-alt / 扫码说明 / 空 name 兜底 / className 透传）+ 1×1 灰阶 PNG 占位（`src/assets/wechat-qrcode.png`，67 字节，Python 直接写 PNG 三 chunk 生成）+ 替换说明（`src/assets/QRCODE_LICENSE.md`，不收录敏感信息）；AboutSection 末尾占位 div 替换为 `<AuthorCard>`，12 项测试全过（9 旧 + 3 新）；新增 9 项测试，总测试 76 文件 / 703 通过；`npm run typecheck` / `npm run build` / `cargo check --offline` 全绿；2 个 commit（`[m1] feat(settings): AuthorCard 基础组件` / `[m2] feat(settings): AboutSection 接 AuthorCard`）。
- 下一步：公众号二维码替换为真实图片（按 `QRCODE_LICENSE.md` 流程）+ 与 PM 协同 PR 合并 / 视觉验收；公众号二维码**不**支持热更新；AuthorCard 不感知 dark mode（仅跟随全局 CSS variable）。

### ISS-024 文档瘦身 subagent（doc-curator）

- 优先级：P1
- 类型：开发协作 / 工具链
- 状态：进行中（首版部署完成；本机基线已建；symlink 治理另案 — DEC-043）
- 建议分支：主目录直接维护（symlink 形式不入仓）
- 建议 worktree：无
- 依赖：—
- 范围：`.claude/skills/doc-curator/`（本机 symlink → `private-skills/doc-curator`）、`.claude/agents/doc-curator.md`（已入仓）、`docs/TASKS.md` / `docs/DECISIONS.md`（同步任务与决策记录）、`AGENTS.md`（Skill 强制调用表加 doc-curator 行）、`.claude/skills/git-workflow/SKILL.md`（post-action 触发说明）
- 目标：把 FaroPDF 的项目级文档膨胀与归档一致性纳入自动检查：监控 `docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `CHANGELOG.md` / `README.md` / `AGENTS.md` 的硬性、自适应、软提示项；触发时机为 PR 创建后与 PR 合并后（Agent 主动调起，非 hooks 门禁），必要时自动提 maintenance PR。
- 验收：
  - `.claude/skills/doc-curator/scripts/scan.sh` 输出 JSON 行 + markdown 报告，退出码 0 / 1 / 2 / 3 区分全部 ok / hard / adaptive / soft。
  - `.claude/skills/doc-curator/scripts/first-baseline.sh` 测量各文件大小并写入 `state.json`。
  - `.claude/skills/doc-curator/scripts/maintenance-pr.sh` 在工作区干净时创建 `chore/doc-curator-<date>` 分支、推、`gh pr create`，标签 `automated,docs,maintenance`。
  - `.claude/agents/doc-curator.md` 注册自定义 Agent，工具范围 `Read, Grep, Glob, Bash, Edit, Write`。
  - `.claude/skills/git-workflow/SKILL.md` 升级到 v1.3.0，在「## 4. PR 工作流」末尾增加「PR 创建后：调起 doc-curator 体检」与「PR 合并后：调起 doc-curator 体检」两个 post-action 小节。
  - 不修改 `src/` / `src-tauri/` / `tests/`；不写 `CHANGELOG.md`（由 `release-workflow` 负责）；不直接 push 到 main，所有 PR 走 PR 流程。
  - 触发流程不依赖 hooks；Agent 在 `gh pr create` / `gh pr merge` 成功后主动调起 subagent。
- 当前进度：首版在 `.claude/skills/doc-curator/` 完成 SKILL.md / LICENSE.txt / CHANGELOG.md / config/faropdf.yaml / state.json / scripts/scan.sh / scripts/first-baseline.sh / scripts/maintenance-pr.sh / lib/*；`.claude/agents/doc-curator.md` 已落盘；`AGENTS.md` Skill 强制调用表新增 doc-curator 行；`docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ARCHITECTURE.md` / `.claude/skills/git-workflow/SKILL.md` 同步。**本轮（DEC-043）**：`first-baseline.sh` 跑通，本机基线建立（CHANGELOG.md 167 / docs/DECISIONS.md 1366 / docs/TASKS.md 257 / docs/ARCHITECTURE.md 733 / docs/DESIGN.md 192 / docs/ROADMAP.md 140 / README.md 68 / AGENTS.md 102）；撤销原计划 `git add -f` 跟踪 symlink 的动作（理由见 DEC-043：symlink target 是用户本机私有 `private-skills/` 路径，跟踪无移植收益）。
- 下一步：项目级 skill 治理（`private-skills/` vs 仓库内置 vs 选择性 fork 副本）作为单独议题单独评估，不在本次 Wave 4 范围；本机 `state.json` 已建基线，doc-curator 在 PR 流程中的实际行为按需调阈值。

### ISS-026 批注深化（高亮/手写/图章/搜索）

- 优先级：P0
- 类型：批注
- 状态：进行中（第一版 UI 与 model 已落盘 / 第四阶段 AppShell 接线 + Overlay 渲染 / Toolbar 接入 / 导出引擎 + stamp 预览 / active 联动均已落盘，等待合并）
- 建议分支：`feat/annotation-tools`
- 建议 worktree：`.claude/worktrees/tmux-annotation-tools`
- 依赖：ISS-004
- 范围：`src/modules/annotation/`、`src/components/layout/AnnotationOverlay.tsx`、`src/components/layout/AnnotationToolbar.tsx`
- 目标：在批注 sidecar 之上完成几何规整、搜索过滤、SVG 图章模板、工具条 model 和 Overlay/Toolbar UI，覆盖高亮/下划线/删除线/备注/文本框/矩形/箭头/手写/图章 9 种批注。
- 验收：常见 PDF 可在 Overlay 上点击/拖拽/手写创建 9 种批注；工具条 9 工具按钮可 arm/disarm；6 色色板可切换颜色；图章 5 模板可选择并填入文字；批注搜索可按作者、类型、页码、文本过滤；视觉验证 Overlay/Toolbar 与 `docs/DESIGN.md` 风格一致且不阻塞阅读区。
- 当前进度：在 `feat/annotation-tools` 完成几何规整（normalizeRect/pointsToRect/unionRects/inkStrokesToRect/lineToRect/recomputeLineRects/recomputeInkRects/sanitizeRects/isRectWithinBounds/clampRectToBounds/annotationBoundingRect）、搜索过滤（collectAnnotationSearchHaystack + matchesQuery/matchesPageFilter/matchesTypeFilter/matchesColorFilter）、图章 SVG 模板（5 套模板、4:1 viewBox、4 种 shape、escapeXml 注入）、工具条 model（ANNOTATION_TOOL_LIST/ANNOTATION_TOOL_MAP/ANNOTATION_COLOR_SWATCHES/AnnotationToolState + 5 个不可变 reducer）、AnnotationOverlay（9 批注 × 3 交互）、AnnotationToolbar（9 工具按钮 + 6 色色板 + 5 图章模板子区段 + 11 项受控组件测试）。`AnnotationService` 暴露 `searchAnnotations` 供 UI 过滤 sidecar 内容。Overlay/Toolbar 暂未挂到 AppShell，本分支先固化可测试边界；接入 AppShell 时只需在批注模式新增 armed state 并把 `activeToolType`/`activeColor`/`activeStampName`/`activeStampLabel` 透传给 Overlay。
- 第二阶段（`feat/annotation-stage-2`，DEC-037）：新增 `sidebarGroups` 4 维度分组纯函数 + `applyAnnotationSidebarFilters` 多 chip 筛选、`annotationPdfWriter` 真实 PDF 绘制导出（pdf-lib 9 批注全覆盖，3/6 位 hex 颜色，越界 clamp，WinAnsi 中文跳过）、`AnnotationSidebar` 独立受控组件（segment control 4 维度 + 搜索 + 4 类 chip + 跳转 + active 联动）。66 项新单测全过；`npm run typecheck` / `build` / `cargo check` 全绿；**未挂 AppShell**，由 layout worker 后续 PR 接入。
- 下一步：把 AnnotationOverlay/AnnotationToolbar 接入 `AppShell` context toolbar 槽位、把 AnnotationSidebar 接入左侧 utility panel（新 utilityPanelId "annotations" 或扩展 summary tab）、图章模板预览增强、把 `writeAnnotationPdf` 接入 `pdfOperationEngine.exportPdf` 的 `flatten-annotations` 路径（决定 plan-only / execute 二选一）、ISS-013 字体重启后并入 stamp 中文真实字形；用浏览器截图检查无重叠。
- 2026-06-04：在 `feat/annotation-stage-4` worktree 推进 ISS-026 第四阶段收尾（DEC-044 总方案 + DEC-045/046/047 三 milestone 详情）：3 个 commit milestone（AppShell 接线 + Overlay 渲染 / Toolbar 接入 / 导出引擎 + stamp 预览）按 cadence 落盘。`types.ts` 追加 `AnnotationOverlayAnchor` / `AnnotationArmedStateBundle` / `AnnotationDraftSubmission` 透传 shape；`AppShell.tsx` workspace 内部追加 `workspace__main` 相对定位容器，annotate 模式 + hasDocument + overlayViewport 时挂 `AnnotationOverlay`（注入 currentPage-1 pageIndex + PDF 视口 + currentPage 批注子集 + armed bundle），`ContextToolbar` 的 annotate 分支替换为受控 `<AnnotationToolbar>`（外层 div 保留 `role="toolbar" aria-label="批注工具条"` 以兼容既有 AppShell 测试契约，disabled 由 `!hasDocument` 派生）。`App.tsx` 把 `annotationToolState` 用 `useState` 上提为单一真相源，useEffect 离开 annotate 自动 disarm，`handleAnnotationDraft` 走 `service.addAnnotation` + append loadedAnnotations。`pdfOperationEngine.ts` `flatten-annotations` 分支按 strategy 分发：plan-only 保持原行为、draw 走 `writeAnnotationPdf` 并 reload workingPdf、`skipped` 降级为 `warnings`（非致命）、PDF metadata 切换 `faropdf:annotation-flattened` + drawn 计数；类型层 `PdfAnnotationFlattenStrategy` 扩 `"draw"`，`PdfAnnotationFlattenPlan` 新增 drawnCount/skippedCount/skipped/pageDrawCounts/fingerprintChecked 可选字段，entry.status 联合 `"planned" | "applied" | "skipped"`。`stamps.ts` 新增 `renderStampPreview` helper（共用 0 0 400 100 viewBox，字号缩 0.55×，与 renderStampSvg 共享 escapeXml 防 XSS，导出 STAMP_PREVIEW_VIEWBOX_WIDTH/HEIGHT + DEFAULT_STAMP_PREVIEW_WIDTH/HEIGHT 常量）；`AnnotationToolbar` stamp 按钮改为 `<svg>` + `<g dangerouslySetInnerHTML>` 注入预览子树 + label span，加 `data-testid="stamp-preview-{id}"`，**不引入新依赖**。`package.json` / 锁文件 / `Toolbar.tsx`（按 DEC-032 协议 worker 走 `ContextToolbar` 槽位注入）/ `Sidebar.tsx`（按 DEC-041 保留 `AnnotationListPanel` tab）/ `src/styles/app.css` / `src-tauri/` / 全局样式 / 路由 / 其他模块（reader / forms / ocr / settings / pages / preprocess）**未修改**。新测 17 项（AppShell 9 + AnnotationToolbar 3 + stamps 5），总测试 73 文件 / 693 通过；`npm run typecheck` 干净（pre-existing `.at` ES2022 lib target / `@pdf-lib/fontkit` 模块未装 错误不在本 PR 范围）；`npx vitest run` 693/693；`npx vite build` 2012 modules 成功（`tsc` 严格检查在项目级 pre-existing 失败，与本 PR 无关）。`docs/DECISIONS.md` 追加 DEC-044/045/046/047；`CHANGELOG.md` 新增 0.1.0-alpha.10 段；`docs/ROADMAP.md` **未改**。已知限制：导出工具条"压平批注"按钮 UI 入口未接（属另一个 worker 范围，本 worker 留 hook）；CJK textbox 仍走 Helvetica WinAnsi 跳过语义（与 DEC-037 一致）；AnnotationOverlay 与 AnnotationSidebar 的 active 联动仍未接（`onAnnotationClick` prop 留好，等下一阶段统一接线）。

- 2026-06-05：在 `feat/iss-026-overlay-sidebar-active-sync` worktree 推进 ISS-026 active 联动（DEC-057）：把 `AnnotationOverlay` 与 `AnnotationSidebar` 共享的 `activeAnnotationId` 状态在 `AppShell` 内落地为单一 `useState<string | null>(null)`，双向同步通过 prop drilling（Overlay `onAnnotationClick` → setState → Sidebar `activeAnnotationId` 透传；反向同理）；`useEffect` 在 `activeMode` 切出 annotate 时清空 active 状态，避免 stale 选中。Overlay 侧保留 `AppShellProps.onAnnotationClick` 向上传递出口（App.tsx 当前未传，no-op；为后续「点击批注 → 详情面板」等扩展留接口）；Sidebar 侧 `onAnnotationClick` 直接绑定 `setActiveAnnotationId`，不重复包装。`AnnotationOverlay.handleAnnotationClick` 既有 `if (interaction) return` 保护保留（armed toolType 下点击不触发 active 同步，避免与新建批注冲突）——本期**不**改 `AnnotationOverlay.tsx` / `AnnotationSidebar.tsx` / `types.ts` / `AnnotationService.ts` / `App.tsx`，仅 `AppShell.tsx` 内 5 行 + 透传 2 处。验证：4 项新单测（sidebar→overlay 高亮 / overlay→sidebar 高亮 / armed 阻止 / mode 切换清空）总测试 80 文件 / 761 用例全过；`npm run typecheck` 干净；`npm run lint` 43 个 pre-existing 错误（与 main 基线一致）；`npm run build` 2022 modules 成功；`cargo check --offline` 9 pre-existing dead_code warning。`docs/DECISIONS.md` 追加 DEC-057（编号后续由 PM 修正，commit message 保留 DEC-058 字样以反映实际 commit）；`CHANGELOG.md` 新增 0.1.0-alpha.17 段；`docs/ROADMAP.md` **未改**。已知限制：armed toolType 下点 overlay 不触发 active 同步（既有行为，保留以避免与新建批注冲突）；App.tsx 未参与（`onAnnotationClick` 透传出口已留，no-op）；后续如需 active 状态跨 mode 保留 / 弹详情面板 / 几何高亮样式等扩展，状态机不变，由独立 worker 推进。

### ISS-027 根目录配置收束（chore / DEC-053）

- 优先级：P1
- 类型：项目卫生（chore / 工具链）
- 状态：第一版收口（DEC-053，待 PM 合 review）
- 建议分支：`chore/consolidate-configs`
- 建议 worktree：`.claude/worktrees/tmux-consolidate-configs`
- 依赖：无
- 范围：`config/`（新增子目录，容纳 5 个配置文件） + `package.json`（scripts 改 8 行）
- 目标：参照 Folia 项目结构把 5 个根目录配置文件（`eslint.config.js` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts` / `vitest.config.ts`）搬到新 `config/` 子目录；根目录只保留说明文档 + `package.json` + `package-lock.json` + `index.html` + `LICENSE`（Folia 风格）。
- 验收：5 个配置文件成功移到 `config/`（`git mv` 保留 rename 历史）；`package.json` scripts 全部加 `--config config/<name>` 显式指向；`npm run typecheck` / `lint` / `test` / `build` 全部通过（与 main 基线一致，无回归）；`cd src-tauri && cargo check` 通过；根目录只剩说明文档 + npm 锁文件 + `index.html` + `LICENSE`。
- 关键决策（DEC-053）：
  - `vite.config.ts` 不动：Vite 以 cwd 为 project root，`--config` 不影响 root 解析；无 `root` / `outDir` / 显式 `process.cwd()` 调用。
  - `tsconfig.json` `include: ["src"]` 改为 `include: ["../src"]`（相对 config 文件位置）。`references` 保持不变（双方同移，sibling 相对引用仍正确）。
  - `tsconfig.node.json` 不动：`include: ["vite.config.ts", ...]` 是裸文件名，和 tsconfig 同目录，移入后自动正确。
  - `vitest.config.ts` 改 `dependencyRoot` 为 `projectRoot`：worktree 场景 slice 到 marker，常规场景 `configDir.replace(/\/config$/, "")` 走父目录。`fs.allow` 同步从 `dependencyRoot` 改为 `projectRoot`。
  - `eslint.config.js` 从 `parserOptions.projectService: true` 切换到 `parserOptions.project: ["./config/tsconfig.json", "./config/tsconfig.node.json"]`：tsconfig 收束到 `config/` 后，project service 从 linted 文件向上 walk 找不到；`defaultProject` / `allowDefaultProject` 不支持 `**` glob，无法覆盖 `src/**/*.ts`。显式列路径最稳。`tsconfigRootDir` 改用 `fileURLToPath` + `resolve(..)` 算 project root。
- 2026-06-05：在 `chore/consolidate-configs` worktree 收口：5 个文件 `git mv` 到 `config/`（保留 rename 历史）；`tsconfig.json` `include` 改 `../src`；`vitest.config.ts` 修 `projectRoot`；`eslint.config.js` 换 `parserOptions.project` 显式指向；`package.json` 8 个 scripts 全部加 `--config` 标志。验证：`npm run typecheck` 干净；`npm run lint` 43 个错误（与 main 基线一致，pre-existing）；`npm test` 80 文件 / 743 用例全过；`npm run build` 2022 modules 成功；`cargo check` 干净（9 个 pre-existing dead_code warning）。`docs/DECISIONS.md` 追加 DEC-053；`CHANGELOG.md` 新增 0.1.0-alpha.13 段（README PR 占用 0.1.0-alpha.12）；`docs/ROADMAP.md` **未改**。
- 下一步：与 PM 协同 PR 合并 / 验证；后续 chore 类工作（如整理 `tests/fixtures/` 体积、清理 pre-existing lint 错误）按需拆 worker；Folia 对齐度（删除 `package.json` 中 Tauri 配置/多余 deps）等 0.2 再议。

### ISS-028 杨卫薪律师个人主页 + 两产品展示（Folia / FaroPDF）

- 优先级：P1
- 类型：项目卫生（chore / 文档 + 营销）
- 状态：待 PM 启动（brainstorm + design，**本 ISS 任务卡**仅登记框架，**不**绑定实现）
- 建议分支：TBD（启动时由 PM 与 brainstorming 决定）
- 建议 worktree：TBD
- 依赖：无
- 范围：独立仓库（建议 `cat-xierluo/personal-site` 或同 owner 下 monorepo 路径） + Folia / FaroPDF README §"官方仓库" 加主页入口（如 `https://cat-xierluo.github.io/`） + 可选 `description` / `homepage` 字段更新
- 目标：杨卫薪律师个人主页，展示 Folia / FaroPDF 两个产品，作为作者对外的「官方门面」+ 项目入口聚合点。技术方向待定（Astro / Vite + React / 纯静态 HTML / GitHub Pages 自定义域）。
- 验收：TBD（启动 brainstorming 时与 PM 确认）
- 关联：DEC-054 §4「后续路径」登记项；与 Folia 同作者的「个人品牌 + 多个产品」聚合页需求
- 关键决策（待 brainstorm 时确认）：
  - 仓库位置：独立 repo / monorepo 子目录 / GitHub Pages
  - 域名：`https://cat-xierluo.github.io/`（默认）或自定义
  - 框架：Astro（与 Folia `website/` 一致）/ Vite + React（与 Folia / FaroPDF 一致）/ 纯静态
  - 内容板块：bio / 工作领域 / 产品列表 / 联系方式 / 公众号（与 Folia README / AuthorCard 数据打通）/ 中英文切换
  - 与 Folia `website/` 子目录的关系：迁出独立仓库 / 保留子目录但主页独立 / 二者并行
- 2026-06-05：登记 ISS-028 任务卡（DEC-054 §4 后续路径触发）。**当前分支 `chore/add-license-and-author` 不实现本 ISS**；启动时由 PM 开 brainstorming，按 ISS-007 / ISS-026 模式拆 worker 推进。
- 下一步：brainstorming（确认仓库位置 / 域名 / 框架 / 内容板块 / 与现有 Folia website 关系）→ 新分支 → 落地。

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

## 归档任务索引

已合并到 main 或第一版已发布的功能，详细任务卡归档在 `docs/DECISIONS.md` 的「ISS 任务归档」一节。索引按领域分组：

- **工程基础**：ISS-001、ISS-011、ISS-012
- **阅读核心**：ISS-002
- **检索**：ISS-003
- **批注**：ISS-004
- **导出 / 法律材料**：ISS-005、ISS-013
- **页面管理 / 证据材料**：ISS-006、ISS-018
- **OCR / 质量**：ISS-010、ISS-017
- **扫描预处理**：ISS-016
- **设置 / OCR Provider**：ISS-014
- **法律材料整理**：ISS-019
- **品牌 / UI**：ISS-020

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志








