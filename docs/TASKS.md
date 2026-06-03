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
- 当前进度：已在 `feat/pdf-expert-shell-ia` 做出基础壳层重排，并补上 PDF Expert 风格空态、转换入口、最近文件占位、分组导出工具条、填写签名工具条、扫描/OCR 工具条和页面管理"另存为新 PDF"出口；已用 `/tmp/faropdf-ui-sample.pdf` 检查打开态、页面管理和导出工具条，并修正 900px 窄屏顶栏溢出。code review 后已修正无文档页面管理假页面、视图设置状态硬编码和窄屏搜索入口隐藏问题。但 UI 还未达到最终合并标准，必须继续做视觉密度、真实缩略图、搜索结果层、页面管理交互和真实文件态 polish。
- 下一步：继续推进阅读态真实 PDF 打开后的视觉 polish、搜索结果层、页面管理多选/撤销/风险提示，以及扫描/OCR 任务参数区；先补测试，再实现，最后用浏览器截图检查无重叠。
- 设计差距速查：见 `docs/DESIGN.md` 「当前设计差距」一节。

### ISS-021 全平台打包与自动更新

- 优先级：P1
- 类型：发布 / 工程
- 状态：待处理
- 建议分支：`feat/app-distribution`
- 建议 worktree：`.claude/worktrees/tmux-app-distribution`
- 依赖：ISS-001、ISS-009
- 范围：`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`.github/workflows/release.yml`（新增）、`scripts/create-updater-manifest.mjs`（新增或参考 folia）、`src/modules/settings/`（更新入口）、`src/shared/update/`（新增 update service）、`src/components/settings/AboutSection.tsx`（更新检查 UI）、`docs/RELEASE.md`（新增）
- 参考实现：`folia/src-tauri/Cargo.toml`（`tauri-plugin-updater` 依赖）、`folia/src-tauri/tauri.conf.json`（`plugins.updater.endpoints` + `pubkey` + `bundle.createUpdaterArtifacts = true`）、`folia/.github/workflows/release.yml`、`folia/scripts/create-updater-manifest.mjs`、`folia/src/services/updateService.ts`、`folia/src/services/autoUpdateScheduler.ts`
- 目标：让 FaroPDF 具备和 folia 同等的全平台桌面打包与自动更新能力，覆盖 macOS / Windows / Linux；接入 `tauri-plugin-updater` 与 GitHub release updater manifest，建立签名密钥对、`latest.json` 生成和应用内「检查更新」入口。
- 验收：
  - `src-tauri/Cargo.toml` 加入 `tauri-plugin-updater`；`tauri.conf.json` 配置 `plugins.updater.endpoints` + `pubkey`，`bundle.createUpdaterArtifacts = true`。
  - 桌面三平台 `tauri build` 产出 `.app` / `.msi` / `.AppImage` / `.deb` 及对应签名 updater artifact。
  - `.github/workflows/release.yml` 在 `v*` tag push 时跨平台矩阵构建、生成 `latest.json` 与签名、自动发布到 GitHub Releases。
  - 应用内 `checkForAppUpdate` 走 `tauri-plugin-updater`，能拉到新版本并支持下载安装；`autoUpdateCheck` 设置项可关闭自动检查。
  - 更新密钥通过本地 `tauri signer generate` 生成，私钥不入库，公钥写入 `tauri.conf.json`。
  - 增量更新失败时回退到完整重装路径，不阻塞用户阅读。
  - 移动端（Android / iOS）打包在 v0.3 评估范围，先在 `docs/RELEASE.md` 记录限制与后续计划，不在 ISS-021 内强制实现。

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
- 状态：进行中（首版部署中；体检脚本与 subagent 定义已落盘，待 git add -f 跟踪与首跑建基线）
- 建议分支：`chore/doc-curator-bootstrap`（首版直接推 main 后不再开分支）
- 建议 worktree：无（项目级 skill，直接在主目录 commit）
- 依赖：—
- 范围：`.claude/skills/doc-curator/`（新增项目级 skill）、`.claude/agents/doc-curator.md`（新增 Agent 注册）、`docs/TASKS.md` / `docs/DECISIONS.md`（同步任务与决策记录）、`AGENTS.md`（Skill 强制调用表加 doc-curator 行）、`.claude/skills/git-workflow/SKILL.md`（加 post-action 触发说明）
- 目标：把 FaroPDF 的项目级文档膨胀与归档一致性纳入自动检查：监控 `docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `CHANGELOG.md` / `README.md` / `AGENTS.md` 的硬性、自适应、软提示项；触发时机为 PR 创建后与 PR 合并后（Agent 主动调起，非 hooks 门禁），必要时自动提 maintenance PR。
- 验收：
  - `.claude/skills/doc-curator/scripts/scan.sh` 输出 JSON 行 + markdown 报告，退出码 0 / 1 / 2 / 3 区分全部 ok / hard / adaptive / soft。
  - `.claude/skills/doc-curator/scripts/first-baseline.sh` 测量各文件大小并写入 `state.json`。
  - `.claude/skills/doc-curator/scripts/maintenance-pr.sh` 在工作区干净时创建 `chore/doc-curator-<date>` 分支、推、`gh pr create`，标签 `automated,docs,maintenance`。
  - `.claude/agents/doc-curator.md` 注册自定义 Agent，工具范围 `Read, Grep, Glob, Bash, Edit, Write`。
  - `.claude/skills/git-workflow/SKILL.md` 升级到 v1.3.0，在「## 4. PR 工作流」末尾增加「PR 创建后：调起 doc-curator 体检」与「PR 合并后：调起 doc-curator 体检」两个 post-action 小节。
  - 不修改 `src/` / `src-tauri/` / `tests/`；不写 `CHANGELOG.md`（由 `release-workflow` 负责）；不直接 push 到 main，所有 PR 走 PR 流程。
  - 触发流程不依赖 hooks；Agent 在 `gh pr create` / `gh pr merge` 成功后主动调起 subagent。
- 当前进度：首版在 `.claude/skills/doc-curator/` 完成 SKILL.md / LICENSE.txt / CHANGELOG.md / config/faropdf.yaml / state.json / scripts/scan.sh / scripts/first-baseline.sh / scripts/maintenance-pr.sh / lib/*；`.claude/agents/doc-curator.md` 已落盘；`AGENTS.md` Skill 强制调用表新增 doc-curator 行；`docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ARCHITECTURE.md` / `.claude/skills/git-workflow/SKILL.md` 同步。
- 下一步：`.claude/skills/` 默认被 `.gitignore` 忽略，需用 `git add -f` 强制跟踪该子目录；按 git-workflow 多模块规则拆 commit；推 main 后跑首跑基线脚本；观察一轮 PR 行为再调阈值。

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
- 下一步：把 AnnotationOverlay/AnnotationToolbar 接入 `AppShell` context toolbar 槽位、补批注侧边栏搜索/筛选接入、图章模板预览增强、导出引擎批注真实绘制；用浏览器截图检查无重叠。

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

只保留最近 5 条；更早的条目在 `docs/DECISIONS.md` 工作日志。

- 2026-06-04：在 `feat/reader-modes` 推进 v0.1-§2 阅读模式深化（DEC-034）：`PdfViewMode` 增加 `fit-width`，`PdfDocumentState` 增加 `rotation`，新增 `ZOOM_PRESETS` 8 项清单 + `ReaderSession` 持久化类型；新增 `viewMode.ts` 适合宽度/适合页面缩放计算 + `readerSessionStorage.ts` localStorage 适配器 + `useReaderKeyboard` 键盘翻页 hook；`useReaderController` 新增旋转/翻页/缩放预设/zoom in-out 10 个动作，自动从 sessionStorage 恢复阅读位置；`ReaderCanvas` 抽出 `DocumentReader` 用 `ResizeObserver` 驱动 fit-width effective zoom；`Sidebar` ViewSettingsPanel 扩展 4 视图 + 8 缩放预设 + 旋转；`registerReadModeTools` 通过 PR #20 DEC-032 注册表挂入 3 个 read mode 工具（顺/逆时针/适合页面），**未直接修改 Toolbar.tsx**；53 测试文件 / 435 测试 / typecheck / build 三件套全绿；新增 DEC-034、CHANGELOG 0.1.0-alpha.7。
- 2026-06-03：在 `feat/reader-toolbar-refactor` 推进 DEC-032 ReaderToolbar 注册表基础设施：新增 `src/components/layout/toolbarRegistry.ts`（`ToolbarState` / `ToolbarToolItem` + `registerModeTools` / `getModeTools` / `_resetToolbarRegistry`）和 9 项单元测试；`Toolbar.tsx` 末尾新增 `ModeActiveTools` 组件挂在 `toolbar__group--modes` 内 4 个 mode 入口按钮之后，按 `getModeTools(activeMode).slice().sort()` 渲染当前 mode 工具；activeMode="read" 时为 `[]`，UI 与重构前一致；typecheck / 332 项测试 / build 三件套全绿。后续 W3 Forms / W4 Reader modes worker 在各自模块内 `registerModeTools("<mode>", [...])` 即可接入 mode 工具，不再改 Toolbar.tsx。
- 2026-06-03：部署 doc-curator 文档瘦身 subagent：在 `.claude/skills/doc-curator/` 落 SKILL.md / LICENSE.txt / CHANGELOG.md / config/faropdf.yaml / state.json / scripts/{scan,first-baseline,maintenance-pr}.sh / lib/{common,check-tasks,check-decisions,check-files}.sh；`.claude/agents/doc-curator.md` 注册自定义 Agent；`AGENTS.md` Skill 强制调用表新增 doc-curator 行；`docs/TASKS.md` 新增 ISS-024，`docs/DECISIONS.md` 新增 DEC-028，`docs/ARCHITECTURE.md` 补角色说明，`.claude/skills/git-workflow/SKILL.md` 升级 v1.3.0 加 PR 创建后 / 合并后 post-action 触发小节；触发采用 Agent 主动调起，**不依赖 hooks**。
- 2026-06-03：在 `feat/ocr-bridge` 推进 ISS-007 真实接入第二版：后端按 provider 分发到 `ocrmypdf` / `curl + HTTPS`、任务队列持久化、`pdftotext` 联动质量检查；前端 controller + 模式工具条 / 任务列表 / 质量报告组件；OCR 模式工具条作为独立组件交付，由后续 layout worker 接入 `AppShell`。
- 2026-06-03：在 `feat/annotation-tools` 推进 ISS-026 批注深化第一版：几何规整（normalizeRect/unionRects/lineToRect/inkStrokesToRect 等 11 个工具）、搜索过滤（4 个 helper + searchAnnotations）、5 套 SVG 图章模板、9 工具描述 + 6 色色板 + 5 reducer 工具条 model；AnnotationOverlay 覆盖 9 批注 × 3 交互，AnnotationToolbar 受控组件 + 11 项测试；Overlay/Toolbar 暂未挂 AppShell，由后续 layout worker 接入。
- 2026-06-03：在 `feat/reader-thumbnails` 推进 ISS-002 阅读深化第三步：`pdfReaderService` 暴露 `renderThumbnail`、Sidebar 接入 PDF.js 真实缩略图、`PdfPage` 用 IntersectionObserver 同步当前页；通过 PR #14 合并到 main。
- 2026-06-04：在 `feat/forms-signing` 推进 ISS-008 表单填写与签署第一版：契约扩展（`PdfFormOperation` 联合 + `PdfFormBatchRequest/Result` + `PdfFormFlattenSummary` + helper）+ `formService` 真实 `pageIndex`（PDFDict → pageIndex 查找表，`page.node.Annots()` 是 PDFRef 需 `context.lookup` 解析）+ `flattenForm` + `applyFormOperations` 批量入口 + `useReaderController` 暴露 `getFileBytes` / `saveUpdatedBytes`（浏览器 `<a download>`）+ `useFormController` 13 个动作 + `activeFormController` 模块级桥 + `registerFormsToolbarTools` 按 DEC-032 §"W3 Forms" 注册 4 个 forms mode 工具 + `FormProvider` + `FormsPanel` 浮层（独立 CSS 不污染 `src/styles/app.css`）。`Toolbar.tsx` / `App.tsx` / 全局样式 / `package.json` / 锁文件 / `Cargo.toml` **未修改**。82 项新测试，总测试 419 / 419 通过；typecheck / build / cargo check --offline 全绿。DEC-035 + CHANGELOG 0.1.0-alpha.7 已落。
- 2026-06-03：合并 `feat/ocr-quality`（ISS-017）和 `feat/evidence-image-pack`（ISS-018）到 `main`；ISS-017 质量检查报告和 ISS-018 A4 编排计划器第一版完成。
- 2026-06-03：从前一个到达上下文上限的 session 接手，创建 `docs/HANDOFF.md` 交接文件。
- 2026-06-03：合并 `feat/reader-canvas-render-clean` 和 `feat/annotation-sidebar-list` 的 canvas 渲染 + 批注侧边栏 UI 到 main；创建 PR #12 走正式合并流程；清理重复分支和 worktree。
- 2026-06-03：在 `feat/page-organizer-suite` 推进 ISS-006 + ISS-018 第二阶段：`pdfOperationEngine` 在 `mode=execute` 下用 pdf-lib 真实改写 PDF 页面顺序/旋转/删除；`imagePackItemResolver` JPEG SOF 偏移修正 + `imagePackRenderer` 把 `copyPages` 换成 `embedPdf`；新增 `imagePackExecutor` 端到端执行器（plan 校验 + 路径安全 + 渲染 + 写入）；修正 `index.ts` 中 `ImagePackFileReader` / `ImagePackRenderer` 误放 `imagePackItemResolver` 的导出；45 测试文件 / 350 测试 / typecheck / build / cargo check 全绿；新增 DEC-032、CHANGELOG 0.1.0-alpha.6。
