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
- 当前进度：bridge 真实接入第二版已完成。后端 `start_ocr_job` 按 provider 分发到 `ocrmypdf` 本地子进程（`local-ocrmypdf` / `legal-skills`）或 `curl + HTTPS` 云端 OCR（PaddleOCR / MinerU），错误信息脱敏并写回 job 进度；任务队列持久化到 `app_config_dir/ocr-jobs.json`，启动时回收残留 running 任务为 cancelled；新增 `list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text` 四个 command；OCR 完成后 `pdftotext` 提取页面文本喂给 ISS-017 `ocrQualityCheckService` 生成可检索页比例、关键词命中和体积比报告。前端 `createTauriOcrJobController` 包装新 command；`createOcrPostProcessor` 把后端提取的文本转换成 `OcrQualityReport`；`OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView` 作为独立 React 组件覆盖识别文本、输出双层 PDF 和质量检查三个按钮以及任务列表 / 质量报告视图；新组件未接入 `src/App.tsx`，由后续 layout worker 接入 context toolbar。云端 apiKeyRef 当前仅接受 `env:` 形式（其他 `keychain:` / `credential:` / `credential-ref:` / `api-key-ref:` 暂时返回明确错误，提示用户改用 `env:`）；本机需安装 `ocrmypdf` / `pdftotext` / `curl` 才能跑通 OCR 真实路径。
- 下一步：把 OCR 模式工具条接入 `AppShell` context toolbar、真实 PDF 端到端联调（提供 fixture 验证 `*-ocr.pdf` 输出 + 质量检查）、`keychain:` 凭证引用形式与 OS Keychain 集成、根据 `legal-skills` 实际可用脚本收敛 fallback 逻辑。

### ISS-008 表单填写与签署

- 优先级：P1
- 类型：表单
- 状态：进行中（第一版契约 + formService execute 升级 + reader 扩展 + useFormController + FormsPanel 浮层 + 4 件套验证已落 `feat/forms-signing`）
- 建议分支：`feat/forms-signing`
- 建议 worktree：`.claude/worktrees/tmux-forms-signing`
- 依赖：ISS-002、ISS-005
- 范围：`src/modules/forms/`、`src/shared/pdf/form*`、表单签署相关测试 + `src/modules/reader/useReaderController.ts`（加 3 个方法，不破坏 API 形状）
- 目标：支持 AcroForm 字段识别、填写、签名图片、手写签名、日期、勾号、叉号、图章、图片和扁平化导出。
- 验收：常见 PDF 表单可填写并导出为不可编辑提交版；填写和签名模式工具条覆盖文本、签名、日期、勾号、叉号、图章、图片和导出为压平。
- 当前进度：在 `feat/forms-signing` 完成第一版（DEC-035）：`src/shared/pdf/form.ts` 扩展 `PdfFormOperation` / `PdfFormBatchRequest` / `PdfFormBatchResult` / `PdfFormFlattenSummary` + helper；`formService` 真实 `pageIndex`（PDFDict → pageIndex 查找表）+ `flattenForm` + `applyFormOperations` 批量入口；`useReaderController` 暴露 `getFileBytes` / `getCurrentFileName` / `saveUpdatedBytes`（浏览器 `<a download>`，不依赖 Tauri）；`useFormController` 13 个动作维护 formState / panelMode / 草稿 / 签名图片，文档切换 reset；`activeFormController` 模块级桥让 mode 工具 onClick 拿到 controller；`registerFormsToolbarTools` 按 DEC-032 §"W3 Forms" 注册 4 个 forms mode 工具（refresh / fill / signature / flatten）到 `registerModeTools("forms", [...])`；`FormProvider` + `FormsPanel` 浮层在 `activeMode === "forms"` 时挂载，独立 `FormsPanel.css` 不污染全局样式。`src/components/layout/Toolbar.tsx` / `src/App.tsx` / 全局样式 / 路由 / `package.json` / 锁文件 / `src-tauri/Cargo.toml` **未修改**。82 项新测试通过；总测试 419 / 419；`npm run typecheck` / `npm run build` / `npm test -- --run` / `cargo check --manifest-path src-tauri/Cargo.toml --offline` 全绿。
- 下一步：FormsPanel 浮层在窄屏（< 360px）会与主工具栏重叠，需要 layout worker 在 `feat/pdf-expert-shell-ia` 收口时把 forms 改走 utility panel 路径；签名图片限定 PNG / JPG（pdf-lib embed 限制）；批量填写 / 字段校验规则引擎 / 手写签名 / 日期 / 勾号 / 叉号 / 图章等高级控件待后续 worker 推进。

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
- 状态：第一版已交付（手动检查 + 跨平台 CI）；autoUpdateCheck 设置项 / 移动端 / 增量回退 / CODE_SIGNING 留 follow-up
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
  - 应用内 `checkForAppUpdate` 走 `tauri-plugin-updater`，能拉到新版本并支持下载安装；`autoUpdateCheck` 设置项可关闭自动检查。⚠️ 手动检查 M2 已落地；`autoUpdateCheck` 设置项留 follow-up（见 DEC-048 §2.2 + docs/RELEASE.md §4）
  - 更新密钥通过本地 `tauri signer generate` 生成，私钥不入库，公钥写入 `tauri.conf.json`。⚠️ 占位 pubkey 已写，正式发布前由 PM 重生成（见 DEC-048 §2.3 + docs/RELEASE.md §3.1）
  - 增量更新失败时回退到完整重装路径，不阻塞用户阅读。❌ 留 v0.3+ follow-up（tauri-plugin-updater 内置 chunk 重试；失败需用户手动去 GitHub Releases 下载）
  - 移动端（Android / iOS）打包在 v0.3 评估范围，先在 `docs/RELEASE.md` 记录限制与后续计划，不在 ISS-021 内强制实现。✅ docs/RELEASE.md §1 + §4 记录
- 进度日志：
  - 2026-06-04：在 `feat/app-distribution` 推进 ISS-021 第一版（DEC-048）：新增 `src/shared/update/` 5 文件（types / updateService 累计 progress adapter / updateCapability / index + 3 测试文件，14 项新单测）+ `src/modules/settings/sections/AboutSection.tsx` 接 `createTauriUpdateClient` 9 态状态机（手动检查 → available → 下载并安装 → 重启提示；AboutSection.test.tsx 9 项）+ `src-tauri/Cargo.toml` 加 `tauri-plugin-updater = "2.10.1"` + `src-tauri/src/lib.rs` 注册 plugin + `src-tauri/tauri.conf.json` `bundle.createUpdaterArtifacts` + `plugins.updater` 配置块 + `package.json` 加 `@tauri-apps/plugin-updater@2.10.1` + `tsconfig.json` lib ES2020→ES2022（解锁 27 个 pre-existing `Array.prototype.at` 错误）+ `.github/workflows/release.yml`（3 平台 matrix：macos-universal / windows-x64 / linux-x64 → artifacts → `scripts/create-updater-manifest.mjs` → latest.json + softprops/action-gh-release@v2 发布）+ `scripts/create-updater-manifest.mjs`（纯 ESM，零 npm 依赖，扫描 .app.tar.gz / .msi / .AppImage 调 `cargo tauri signer sign`）+ `docs/RELEASE.md`（产物矩阵 / 密钥管理 / 发布流程 / 5 项限制）。**未**改 `src/components/...`（除 update 入口）/ `src/styles/` / `Toolbar.tsx` / `App.tsx` / `Sidebar.tsx` / `src-tauri/src/{ocr,scan_preprocess,forms}/` / 其他 reader/search/annotation/forms/export/pages/ocr/preprocess 模块 / `src/shared/{pdf,ocr,preprocess,annotation,form,export,settings}/` / `assets/fonts/`。pubkey 写占位 `RWSY2kf...`（CI 弱密码生成的 base64 段），私钥已 rm 丢弃；首次生产发布前必须由 PM 重生成。验证：76 文件 / 689 测试（+5：updateService 7 / updateCapability 2 / AboutSection 新增 6 + 替换 3）；typecheck / build / cargo check 全绿；增量更新失败回退 / autoUpdateCheck / 移动端 / CODE_SIGNING 留 follow-up（详见 DEC-048 + docs/RELEASE.md §4）。

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
- 状态：待处理
- 建议分支：`feat/settings-page`（可与 ISS-022 同 worktree 顺序推进）
- 建议 worktree：`.claude/worktrees/tmux-settings-page`
- 依赖：ISS-021、ISS-022
- 范围：`src/components/settings/AboutSection.tsx`（新增）、`src/components/settings/AuthorCard.tsx`（新增或合并在 About 内）、`src/assets/`（应用 icon、微信二维码占位）、`docs/about/`（作者信息、二维码说明）、`docs/DESIGN.md`（作者卡视觉补遗）
- 参考实现：`folia/src/components/settings/AboutSection.tsx`（应用 icon、版本、update check、作者名 / GitHub / 微信二维码）、`folia/src/services/updateService.ts`（`getCurrentAppVersion` + `checkForAppUpdate` + `FALLBACK_APP_VERSION`）
- 目标：在设置页增加「关于」section，展示 FaroPDF 应用 icon、产品名、定位、版本、官网 / GitHub 链接、当前更新状态；同 section 或独立子卡展示作者信息（姓名、GitHub 链接、微信公众号二维码和说明）；「检查更新」按钮接入 ISS-021 的 update service。
- 验收：
  - 关于 section 显示应用 icon、产品名「FaroPDF」+ 定位句、版本号（取自 `getCurrentAppVersion`，回退 `FALLBACK_APP_VERSION`）、官网 / GitHub 链接和「检查更新」按钮。
  - 「检查更新」按钮触发 `checkForAppUpdate`，显示 idle / checking / latest / available / unsupported / error 六种文案；自动更新开关读取 `settings.autoUpdateCheck`。
  - 作者卡显示作者姓名、GitHub 个人页链接、微信公众号二维码图片和扫码说明。
  - 二维码图片走 `src/assets/` 静态资源或文档附件，不内置账号 / 密码 / Token 等敏感信息。
  - 关于 section 在 900px 窄屏视口下不被裁切，关键信息不重叠。

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
- 状态：进行中（第一版 UI 与 model 已落盘，等待合并 / 后续 AppShell 接入）
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

- 2026-06-04：在 `feat/settings-page` 推进 ISS-022 + ISS-023 设置页面 UI 整合第一版（DEC-038）：把现有扁平 `SettingsPanel` 升级为左侧导航 + 多 section 的 Portal 浮层（`role="dialog" aria-modal="true"`，`Esc` 关闭、点遮罩关闭、打开抢焦点、窄屏 < 768px 折叠为顶部 tab），5 个 section（常规 / 阅读 / OCR provider / 快捷键 / 关于）拆到 `src/modules/settings/sections/`，CSS 落到独立 `SettingsPanel.css` 不污染 `src/styles/app.css`；新增 `src/shared/app/metadata.ts` 读 `tauri.conf.json`（productName / version）与 `package.json`（description / homepage / repository / author）双源，AboutSection 直接 import `src-tauri/icons/128x128.png` 展示应用 icon。`AppSettings` 字段**不**新增；「检查更新」按钮展示 ISS-021 集成后启用的占位文案（未接 tauri-plugin-updater）；「快捷键」section 仅展示只读；AppShell 把 SettingsPanel 从 `utility-panel--settings` aside 提升到 app-shell 顶层（与 StatusBar 同级），AppShell 加 `onSettingsChange` prop，`App` 改 `useState` 持 settings + 新增 `handleSettingsChange` 走 `setSettings`（SettingsService 持久化后续接入）。`Toolbar.tsx` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` / 其他模块（reader / annotation / forms / pages / ocr）**未修改**。`package.json` 仅新增 `description` / `homepage` / `repository` / `author` 4 个 metadata 字段，**未引入**新依赖。新增 36 个测试（5 section + SettingsPanel 容器 + metadata helper），总测试 526 / 526 通过（63 测试文件）；`npm run typecheck` 干净；`npm run build` 成功（`dist/assets/128x128-D40VdaNu.png` 17.61 KB 等）；`cargo check --manifest-path src-tauri/Cargo.toml --offline` 干净。`App.test.tsx` 旧的 aside 断言改为 dialog + 顶部 tab 切到 OCR section 才能看到「默认 OCR 后端」的新流程；`src/test/setup.ts` 加 `window.matchMedia` jsdom 兜底（v29 jsdom 缺实现）。`docs/DECISIONS.md` 追加 DEC-038；`CHANGELOG.md` 新增 0.1.0-alpha.8 段；`docs/ROADMAP.md` **未改**。

- 2026-06-04：在 `feat/reader-modes` 推进 v0.1-§2 阅读模式深化（DEC-034）：`PdfViewMode` 增加 `fit-width`，`PdfDocumentState` 增加 `rotation`，新增 `ZOOM_PRESETS` 8 项清单 + `ReaderSession` 持久化类型；新增 `viewMode.ts` 适合宽度/适合页面缩放计算 + `readerSessionStorage.ts` localStorage 适配器 + `useReaderKeyboard` 键盘翻页 hook；`useReaderController` 新增旋转/翻页/缩放预设/zoom in-out 10 个动作，自动从 sessionStorage 恢复阅读位置；`ReaderCanvas` 抽出 `DocumentReader` 用 `ResizeObserver` 驱动 fit-width effective zoom；`Sidebar` ViewSettingsPanel 扩展 4 视图 + 8 缩放预设 + 旋转；`registerReadModeTools` 通过 PR #20 DEC-032 注册表挂入 3 个 read mode 工具（顺/逆时针/适合页面），**未直接修改 Toolbar.tsx**；53 测试文件 / 435 测试 / typecheck / build 三件套全绿；新增 DEC-034、CHANGELOG 0.1.0-alpha.7。
- 2026-06-04：在 `feat/annotation-stage-2` 推进 ISS-026 第二阶段（DEC-037）：`sidebarGroups` 4 维度分组纯函数（page/color 按 6 色色板顺序、type 按 `PDF_ANNOTATION_TYPES` 固定顺序、label 保留首次出现顺序）+ `applyAnnotationSidebarFilters` 多 chip 组合筛选 + `deriveAnnotationLabel` 单来源标签提取；`annotationPdfWriter` 真实 PDF 绘制（pdf-lib 9 批注全覆盖，3/6 位 hex 颜色，越界 clamp，WinAnsi 中文跳过，pageIndex 越界 / pageCount 不一致 / 指纹不匹配 / schemaVersion 不匹配在调用方层抛错并脱敏）；`AnnotationSidebar` 受控组件（segment control 4 维度 + 搜索 + 4 类 chip + 跳转 + active 联动）**未挂 AppShell**。66 项新单测（sidebarGroups 28 + annotationPdfWriter 20 + AnnotationSidebar 18），总测试 60 文件 / 561 通过；typecheck / build / cargo check --offline 全绿；`package.json` / 锁文件 / Toolbar.tsx / AppShell.tsx / Sidebar.tsx（已有 `AnnotationListPanel` 不动）/ App.tsx / 全局样式 / 路由 / reader / export / forms / 共享契约 / Cargo.toml **未修改**；新增 DEC-037、CHANGELOG 0.1.0-alpha.8。
- 2026-06-03：在 `feat/reader-toolbar-refactor` 推进 DEC-032 ReaderToolbar 注册表基础设施：新增 `src/components/layout/toolbarRegistry.ts`（`ToolbarState` / `ToolbarToolItem` + `registerModeTools` / `getModeTools` / `_resetToolbarRegistry`）和 9 项单元测试；`Toolbar.tsx` 末尾新增 `ModeActiveTools` 组件挂在 `toolbar__group--modes` 内 4 个 mode 入口按钮之后，按 `getModeTools(activeMode).slice().sort()` 渲染当前 mode 工具；activeMode="read" 时为 `[]`，UI 与重构前一致；typecheck / 332 项测试 / build 三件套全绿。后续 W3 Forms / W4 Reader modes worker 在各自模块内 `registerModeTools("<mode>", [...])` 即可接入 mode 工具，不再改 Toolbar.tsx。

- 2026-06-03：部署 doc-curator 文档瘦身 subagent：在 `.claude/skills/doc-curator/` 落 SKILL.md / LICENSE.txt / CHANGELOG.md / config/faropdf.yaml / state.json / scripts/{scan,first-baseline,maintenance-pr}.sh / lib/{common,check-tasks,check-decisions,check-files}.sh；`.claude/agents/doc-curator.md` 注册自定义 Agent；`AGENTS.md` Skill 强制调用表新增 doc-curator 行；`docs/TASKS.md` 新增 ISS-024，`docs/DECISIONS.md` 新增 DEC-028，`docs/ARCHITECTURE.md` 补角色说明，`.claude/skills/git-workflow/SKILL.md` 升级 v1.3.0 加 PR 创建后 / 合并后 post-action 触发小节；触发采用 Agent 主动调起，**不依赖 hooks**。

- 2026-06-03：在 `feat/ocr-bridge` 推进 ISS-007 真实接入第二版：后端按 provider 分发到 `ocrmypdf` / `curl + HTTPS`、任务队列持久化、`pdftotext` 联动质量检查；前端 controller + 模式工具条 / 任务列表 / 质量报告组件；OCR 模式工具条作为独立组件交付，由后续 layout worker 接入 `AppShell`。
- 2026-06-04：在 `feat/export-real-encoding` 推进 ISS-013 第二阶段 v2（DEC-039，承接 DEC-036 重启条件）：`fontLoader` + `@pdf-lib/fontkit` devDep + 思源黑体 SC（OFL 1.1，16.5MB，asset + LICENSE）+ `compressionService` 真实压缩（`save({useObjectStreams})` + 图像 inventory + 重采样 plan-only fallback）+ `fontAwareWatermark` 路由 CJK→思源黑体 / Latin→Helvetica + `pdfOperationEngine` 集成（watermark/page-number/bates 走 `resolveTextFont`，compress apply 模式走 `compressPdf`）。`Toolbar.tsx` / `App.tsx` / 全局样式 / 路由 / `src-tauri/Cargo.toml` **未修改**；新增 19 项单测（fontLoader 9 + compressionService 4 + fontAwareWatermark 6），总测试 69 文件 / 621 通过；typecheck / build / cargo check 全绿。PM 修 10 处 worker 留下 bug：fontkit namespace import / vitest `?arraybuffer` 兼容（readFileSync fallback）/ PDFDict 防御 / PDFName.toString() 公开 API / normalizeBatesDigits 默认 6→0 / Object.assign 类型断言 / await PDFDocument.create() 误用 / compressionService.test.ts 删未用 import / pdfOperationEngine.test.ts 删 apply 模式 plan-only 警告矛盾。


- 2026-06-04：在 `feat/scan-preprocess-real` 推进 ISS-016 第二阶段（DEC-042）：`src-tauri/Cargo.toml` 加 `lopdf = "0.33"`（0.34 在 rustc 1.88 reader.rs API 失配，回退 0.33）；新增 `src-tauri/src/scan_preprocess/` 五子文件（mod / types / queue 持久化 `scan-preprocess-jobs.json` / pdf_probe 用 lopdf 真实解析 MediaBox/Rotate/文本对象数 + apply_clean_edge 真实缩小 MediaBox + save_pdf 父目录 create_dir_all / runner 真实状态机 validating→preprocessing→writing-output→completed + 真实 elapsed_ms + 失败落盘）；`lib.rs` `start_scan_preprocess_job` 由 queued stub 改为「写 stored job + spawn async task 跑 runner + 返回 scan_stored_to_command_job」；新增 `list_scan_preprocess_jobs / poll_scan_preprocess_job / cancel_scan_preprocess_job` 三个 Tauri command（仿 OCR 队列命令同形）；`ScanPreprocessCommandJob` 扩展 `error_message / started_at / completed_at`；setup manage `ScanPreprocessJobQueueState`；前端 `ScanPreprocessBackend` / `ScanPreprocessService` 接口加 list / poll / cancel 三个方法 + 错误脱敏 + 空 jobId 拒绝；`normalizeScanPreprocessJob` 兼容缺字段 / 不可信 options（fallback request.options 或 defaultOptions）。**未**改 `package.json` / `package-lock.json` / `Toolbar.tsx` / `App.tsx` / 全局样式 / 路由 / `src/shared/preprocess/*` 共享契约（不破坏现有前端 PDF 工具）/ 锁文件。16 项 Rust 单测（queue 7 + pdf_probe 3 + runner 2 + lib 4 保留 helper + stored→command 转换 1）+ 4 项前端单测（list 排序 / poll null / cancel / 空 jobId 拒绝），总测试 625 / 625 通过（69 文件）；typecheck / build / cargo check 全绿。已知限制：90 度方向检测 + 微倾斜 + 双页拆分均为 plan-only（lopdf 不解析压缩 content stream，文本对象 `cm` 矩阵投票需 mupdf/opencv 栅格化能力，留后续阶段）；空白边裁剪为 MediaBox 线性内缩不做像素检测；fontkit devDep 需在新 worktree 跑 `npm install` 才能 typecheck；Tauri command State mock 测试难构造，由 `scan_stored_to_command_job` 纯函数单测 + `run_scan_preprocess_job` 间接覆盖。`docs/DECISIONS.md` 追加 DEC-042，`CHANGELOG.md` 同步对应条目。
- 2026-06-04：在 `feat/annotation-stage-3` 推进 ISS-026 第三阶段（DEC-041）：把第二阶段产出的 `AnnotationSidebar` 真正挂到 `AppShell` + 中文 stamp 文字用思源黑体 SC 真实绘制（补 DEC-039 W8 已知限制）。`types.ts` 给 `UtilityPanelId` 新增 `"annotation"`；`AppShell.tsx` 在 `UtilityPanel` 增加 `panel === "annotation"` 分支渲染 `AnnotationSidebar`（受控组件透传 reader + annotations）；`App.tsx` `handleModeChange` 在切到 `annotate` 时强制 `setUtilityPanel("annotation")`，从 `annotate` 切到其他 mode 时若仍是 `annotation` 则回 `summary`（保持 `AnnotationListPanel` 在 DocumentSummaryPanel 「批注列表」tab 中作为 read/forms/ocr/export 的基础列表，不动 `Sidebar.tsx`）。`annotationStampFont.ts`（新）`resolveStampFont(pdfDoc, text, options)` 路由 CJK → `embedChineseFont` / Latin → `StandardFonts.Helvetica`，与 `fontAwareWatermark.ts` 模式一致；`annotationPdfWriter.ts` `drawAnnotation` 改 async + `drawStamp` 改用 `await resolveStampFont` 替代统一 Helvetica font；字体加载 / 编码失败时静默保留边框（与原行为一致 drawn: true，不计入 skipped）。`package.json` / 锁文件 / `Toolbar.tsx`（按 DEC-032 协议由后续 mode 工具 worker 通过 `registerModeTools` 接入）/ `Sidebar.tsx` / 全局样式 / 路由 / `src-tauri/Cargo.toml` / 其他模块（reader / forms / export / settings / ocr）**未修改**；未引入新依赖。新增 15 项单测（annotationStampFont 7 + AppShell 8），总测试 71 文件 / 636 通过；typecheck / build / cargo check --offline 全绿。`docs/DECISIONS.md` 追加 DEC-041；`CHANGELOG.md` 新增 0.1.0-alpha.9 段；`docs/ROADMAP.md` **未改**。已知限制：窄屏下 annotate 模式 utilityPanel 槽位被 AnnotationSidebar 占满（点「文档摘要」按钮可手动切回 summary）；textbox 中文仍是 Helvetica 静默跳过（不属本期）；`AnnotationSidebar` 的 `onAnnotationClick` / `activeAnnotationId` 暂未与 `AnnotationOverlay` 联动（Overlay 暂无 controller）；`ContextToolbar` 批注工具按钮仍是死按钮（按 prompt 协议未修改 Toolbar.tsx）。
- 2026-06-04：在 `feat/ocr-toolbar-integration` 推进 ISS-007 OCR 模式工具条接入 AppShell（DEC-042）：把已有 `OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView` 三组件挂到 AppShell ocr mode 渲染路径，新增 `useOcrWorkspaceController` hook 聚合 Tauri controller / bridge + 当前文档元信息到 `OcrWorkspaceController` 状态对象；mount 拉 `listOcrJobs`、存在 active 任务时按 1500ms 轮询；`startOcr` 走 `OcrBridgeService.startOcr`（带 provider 校验 + 隐私 consent）后刷新；`currentJob` 优先 active 否则回退到 `selectedJobId`；`errorMessage` 由主动动作写入、refresh 成功不主动清空（避免 mount 并发覆盖）。`OcrWorkspace` grid 双列（左任务列表 / 右选中任务报告，< 720px 折叠单列），独立 `ocrWorkspace.css`。`AppShell.tsx` 新增 `ocr?: OcrWorkspaceController` prop；ocr mode context toolbar 用 `<OcrModeToolbar>` 替换 hardcoded 7 个占位按钮；主区域 `<OcrWorkspace>` 替换 `<ReaderCanvas>`；`utilityPanel` 在 ocr 模式隐藏（与 pages mode 同策略）。`App.tsx` 追加 `useOcrWorkspaceController` hook 调用 + `useMemo` 锁入参 + 传 `<AppShell ocr={...}>`。33 个新单测（hook 14 + workspace 6 + AppShell 11 + deriveLayeredOutputPath 4）+ App.test.tsx OCR mode 断言更新到 OcrModeToolbar 4 核心按钮 + OcrWorkspace `main` region；总测试 72 文件 / 653 通过；typecheck / build / cargo check --offline 全绿。`package.json` / 锁文件 / `src-tauri/Cargo.toml` / `src/shared/ocr/*` 共享契约 / `Toolbar.tsx` / reader / search / annotation / forms / export / pages / settings **未改**。`docs/DECISIONS.md` 追加 DEC-042；`CHANGELOG.md` 新增 0.1.0-alpha.9 段。

- 2026-06-04：PM 直接处理 ISS-024 doc-curator 首跑基线（DEC-043）：撤销原计划 `git add -f` 跟踪 `.claude/skills/doc-curator` symlink 的动作（理由：symlink target 是用户本机私有 `private-skills/doc-curator` 路径，跟踪 symlink 等于把用户机器特定路径固化到公共仓库且 `.gitignore` 仍排除 `.claude/skills/`，其他开发者 clone 也拿不到 symlink，没有可移植收益）；保留本机 doc-curator 工具通过 symlink 独立使用；`bash .claude/skills/doc-curator/scripts/first-baseline.sh` 跑通，本机基线已建（CHANGELOG.md 167 / docs/DECISIONS.md 1366 / docs/TASKS.md 257 / docs/ARCHITECTURE.md 733 / docs/DESIGN.md 192 / docs/ROADMAP.md 140 / README.md 68 / AGENTS.md 102，state.json 写入 symlink target 路径仓库不可见）；`docs/DECISIONS.md` 追加 DEC-043；`docs/TASKS.md` ISS-024 任务卡「下一步」改为「项目级 skill 治理另案」；CHANGELOG.md 0.1.0-alpha.9 段不增（doc-curator 治理决策属于 PM 内部协调，非用户可见变更）。

- 2026-06-04：在 `feat/app-distribution` 推进 ISS-021 全平台打包与自动更新第一版（DEC-048）：新增 `src/shared/update/` 5 源文件 + 3 测试文件（14 项新单测）封装 `tauri-plugin-updater`；`src/modules/settings/sections/AboutSection.tsx` 9 态状态机接 `createTauriUpdateClient`，props 注入 `updateClient` 替身便于单测；`src-tauri/Cargo.toml` 加 `tauri-plugin-updater = "2.10.1"` + `lib.rs` 注册 plugin + `tauri.conf.json` `bundle.createUpdaterArtifacts` + `plugins.updater` 配置块（active / endpoints GitHub Releases latest / pubkey 占位 / windows.installMode passive）；`package.json` 加 `@tauri-apps/plugin-updater@2.10.1`；`tsconfig.json` lib ES2020→ES2022（解锁 27 个 pre-existing `Array.prototype.at` 错误，ISS-021 verification 传递依赖）；`.github/workflows/release.yml`（3 平台 matrix：macos-universal / windows-x64 / linux-x64 → 跑 build → 上传 artifacts → release job 拉取 + 跑 `scripts/create-updater-manifest.mjs` → `latest.json` + softprops/action-gh-release@v2 发布）；`scripts/create-updater-manifest.mjs`（纯 ESM，零 npm 依赖，按文件后缀匹配 updater 平台 + spawn `cargo tauri signer sign`）；`docs/RELEASE.md`（产物矩阵 / 密钥管理 / 3 步发布流程 / 5 项限制）。**未**改 `src/components/...`（除 update 入口）/ `src/styles/` / `Toolbar.tsx` / `App.tsx` / `Sidebar.tsx` / `src-tauri/src/{ocr,scan_preprocess,forms}/` / 其他 reader/search/annotation/forms/export/pages/ocr/preprocess 模块 / `src/shared/{pdf,ocr,preprocess,annotation,form,export,settings}/` / `assets/fonts/`。pubkey 写占位 `RWSY2kf...`（CI 弱密码生成的 base64 段），私钥已 rm 丢弃；首次生产发布前必须由 PM 重生成。验证：76 文件 / 689 测试（+5 实际 14：updateService 7 / updateCapability 2 / AboutSection 新增 6 + 替换 3）；typecheck / build / cargo check 全绿；增量更新失败回退 / `autoUpdateCheck` / 移动端 / CODE_SIGNING 留 follow-up（详见 DEC-048 + docs/RELEASE.md §4）。
- 2026-06-04：在 `feat/pdf-expert-shell-ia` 推进 ISS-009 PDF Expert Shell UI 收口（DEC-049，4 个 milestone + 1 个 baseline unblock）：M1 阅读态视觉 polish（`ReaderCanvas` ocrStatus=needed 提示条 + 文字层徽章 + Toolbar fileSubtitle 区分无文档/错误文案）；M2 搜索结果层（`SearchResultsPopover` 命中索引 + 索引进度 + 命中页码 chip + active hit 自动滚动 + `data-active-hit` outline 高亮）；M3 页面管理多选/撤销/风险（`PageOrganizerWorkspace` 独立组件 + 多选 + shift 选区 + 删除/导出风险对话框 + 撤销占位）；M4 OCR 任务参数区（`OcrWorkspaceController.parameters` 派生字段 + `OcrWorkspaceHeader` 展示 provider / 页码范围 / 输出策略 / 质量检查 / 网络授权）。附带 `tsconfig.json` lib ES2020→ES2022 baseline unblock 修复 17 个 pre-existing `.at()` 类型错误。`src/components/layout/{ReaderCanvas,AppShell,Toolbar,PageOrganizerWorkspace}` + `src/modules/ocr/ui/{OcrWorkspace,OcrWorkspaceHeader,useOcrWorkspaceController,ocrWorkspace}` + `src/modules/search/searchUi.test.tsx` + `src/styles/app.css` + `tsconfig.json` 同步更新；`src/shared/**` / `src-tauri/**` / `package.json` / 锁文件 / `Toolbar.tsx` / `Sidebar.tsx` / 其他模块（reader / annotation / forms / export / settings / preprocess）**未修改**；未引入新依赖；未实现新功能。19 项新单测（ReaderCanvas 5 + PageOrganizerWorkspace 8 + OcrWorkspaceHeader 7 = 20；searchUi.test.tsx 文本断言调整 3 处不在新增计数内），总测试 75 文件 / 692 通过；`npm run typecheck` / `npm run build` / `cargo check --offline` 全绿。`docs/DECISIONS.md` 追加 DEC-049；`CHANGELOG.md` 新增 0.1.0-alpha.10 段；ISS-009 任务卡「下一步」改为「浏览器截图检查无重叠 + 与 PM 协同 PR 合并 / 视觉验收」。已知限制：页面管理 Undo 是占位 UI（未接 pageOrganizer service 真实 history/undo）；OCR 参数区只读展示（provider / qualityCheck / networkConsent 改动仍需走「设置 → OCR provider」面板）；`/tmp/faropdf-ui-sample.pdf` 在本会话期间不存在（视觉验证以 dev server + 浏览器打开 `/` 即可）。
