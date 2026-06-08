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

## 活跃任务

### ISS-030 工具栏布局克制化（一级/二级分层 + 侧边栏默认关闭 + 页面布局收左上角）

- 优先级：P1
- 类型：UI / 布局
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 参考：`docs/DESIGN.md` § Toolbar + § PDF Expert UI 探索素材池 + § 当前设计差距（"顶栏仍过密"）
- 目标：
  1. 工具栏按一级/二级分层：一级是模式切换（批注 / 导出 / 填写签名 / OCR 等），点击模式后才展开对应的二级上下文工具条，不把所有功能平铺。
  2. 文档摘要（左侧边栏）不应默认打开；未打开 PDF 时更不应显示空侧边栏。
  3. 页面布局类功能（文档摘要、页面管理、视图设置）收到左上角，参照 PDF Expert 的左上角 3 按钮模式，不作为主工具栏的独立功能区。
  4. 确保主工具栏在阅读态只保留必要的导航/模式入口，不挤压阅读区域。
- 验收：启动后工具栏只显示一级入口，进入具体模式才展开二级工具；文档摘要默认关闭；页面布局功能集中在左上角。
- 设计约束：参照 PDF Expert 但不照搬品牌/图标；遵循 DESIGN.md 视觉原则。
- 初步分析：
  - 当前 `Toolbar.tsx` 有 5 组按钮平铺在顶栏（brand / utility / 文件操作 / 阅读控制 / 任务模式 + 搜索设置），utility 组的"文档摘要""页面管理""视图设置""填写和签名"均作为一级按钮，不符合 PDF Expert 左上角收拢模式。
  - 一级/二级概念已部分存在：`ContextToolbar`（二级）在非 read/pages 模式时出现，`ModeActiveTools` 通过 `toolbarRegistry` 按模式注册工具。但一级入口没有收拢——utility 按钮始终可见。
  - 侧边栏默认打开：`App.tsx:26` 初始化 `utilityPanel = "summary"`，导致启动即显示文档摘要面板。
  - 关键文件：`src/App.tsx`（状态管理）、`src/components/layout/Toolbar.tsx`（工具栏）、`src/components/layout/AppShell.tsx`（布局壳）、`src/components/layout/Sidebar.tsx`（侧边栏面板）。

### ISS-031 PDF 打开/渲染功能修复（拖拽打开 + 文件选择后渲染异常）

- 优先级：P1
- 类型：缺陷修复
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 目标：
  1. 支持拖拽 PDF 文件到窗口直接打开。
  2. 通过文件选择对话框打开 PDF 后，PDF 页面能正常渲染显示（当前似乎无法正常渲染）。
- 验收：拖拽 PDF 到窗口可打开并渲染；文件对话框选择 PDF 后可正常渲染所有页面。
- 初步分析：
  - 拖拽：仅欢迎页（空态 dropzone）实现了 DnD（`ReaderCanvas.tsx:61-69`），`DocumentReader`（阅读态）无 DnD handler。需扩展到整个窗口或至少阅读区。
  - 文件打开流程：浏览器 `<input type="file">` → `reader.openFile` → `loadPdfFromFile` → `loadPdfFromBytes` → PDF.js `getDocument()`。Rust 后端无 PDF 读取命令，全部在前端完成。
  - 渲染管线：`PdfPage` 组件（`ReaderCanvas.tsx:312-463`）用 `useEffect` 调用 `renderPageToCanvas`，失败时设置 `renderFailed = true` 并显示文本回退。Canvas 渲染失败是可能的故障点。
  - PDF.js worker 配置（`pdfjsWorker.ts`）：使用 `pdfjs-dist/build/pdf.worker.mjs?url` Vite 虚拟导入，懒加载——只在首次 `loadPdfFromBytes` 时配置。Tauri webview 环境下 worker URL 解析可能有兼容问题。
  - 无日志：PDF 加载/渲染失败后只在 UI 显示错误信息，不输出到 console 或日志服务，排查困难。
  - 排查优先级：① 启动 `npm run tauri dev` 实际打开 PDF 观察 console 错误；② 检查 worker 是否成功加载；③ 检查 `renderPageToCanvas` 是否抛出异常。
  - 关键文件：`src/modules/reader/pdfReaderService.ts`（PDF.js 集成）、`src/modules/reader/useReaderController.ts`（加载控制）、`src/modules/reader/pdfjsWorker.ts`（worker 配置）、`src/components/layout/ReaderCanvas.tsx`（渲染 UI）。

### ISS-032 macOS 菜单栏中文化 + 深层功能菜单入口

- 优先级：P2
- 类型：UI / 本地化
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 目标：
  1. macOS 原生菜单栏从默认英文（File / Edit / View / Window / Help）改为中文。
  2. 在菜单栏中暴露不常用的深层功能（如页眉页脚、页码添加等），作为工具栏次级功能的补充入口，参照 PDF Expert 通过菜单栏访问低频功能的方式。
- 初步分析：
  - `tauri.conf.json` 无 `app.menu` 配置，Tauri v2 在 macOS 上自动生成默认英文菜单。需通过 Tauri Menu API（`@tauri-apps/api/menu`）或 `tauri.conf.json` 的 `app.menus` 字段自定义菜单项和标签。
  - 中文菜单标签：文件（新建窗口 / 打开 / 保存 / 另存为 / 关闭）、编辑（撤销 / 重做 / 剪切 / 复制 / 粘贴）、视图（文档摘要 / 页面管理 / 视图设置 / 全屏）、窗口、帮助。
  - 深层功能入口：可在"文件"或"工具"菜单下添加"添加页眉页脚""添加页码""Bates 编号"等菜单项，点击后进入对应的工具模式或打开设置面板。
  - 关键文件：`src-tauri/tauri.conf.json`（菜单配置）、可能需要 `src-tauri/src/lib.rs` 添加菜单事件处理。
- 验收：macOS 菜单栏显示中文标签；低频功能可通过菜单栏访问。

### ISS-033 主页下半部分灰色渲染异常

- 优先级：P1
- 类型：缺陷修复
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 描述：应用主页（未打开 PDF 时）下半部分显示一个灰色框，疑似渲染问题。
- 初步分析：
  - 主页空态由 `ReaderCanvas.tsx` 的欢迎 dropzone 渲染。灰色框可能是 workspace 区域的默认背景色（`--bg` / `--surface` token）在无文档时与 dropzone 区域产生视觉不一致。
  - 也可能与 `AppShell.tsx` 的 workspace 布局有关：sidebar 打开后 workspace 区域的 `workspace__main` 背景色可能与 dropzone 不匹配。
  - 需启动 `npm run tauri dev` 实际观察确认灰色框的位置和触发条件。
  - 关键文件：`src/components/layout/AppShell.tsx`（workspace 布局）、`src/components/layout/ReaderCanvas.tsx`（空态 dropzone）、全局 CSS 变量。

### ISS-034 欢迎页"最近文件"硬编码占位符应移除

- 优先级：P2
- 类型：UI / 缺陷修复
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 描述：欢迎页"最近"区域硬编码了"卷宗材料.pdf""合同附件.pdf""扫描件.pdf"三个占位文件名（`ReaderCanvas.tsx:37`），用户未打开过任何文件时不应显示虚假占位条目。
- 目标：无真实最近文件时，"最近"区域直接留空或隐藏整个区域，不显示任何占位符。有真实最近文件记录后再展示。
- 关键文件：`src/components/layout/ReaderCanvas.tsx`（`recentPlaceholders` 数组 + 渲染逻辑）。

### ISS-035 设置页 UI 视觉不统一（高光 / 亮色不一致）

- 优先级：P2
- 类型：UI / 视觉
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 描述：设置页面部分选项带有高光效果，与整体 UI 风格不统一。
- 初步分析：需启动应用实际截图对比，确认哪些控件有异常高光，可能是 focus ring、active 状态、CSS 变量覆盖不一致或浏览器默认样式未完全重置。
- 关键文件：`src/modules/settings/` 下各 section 组件 + 全局 CSS。

### ISS-036 检查更新失败（私有仓库导致 latest.json 不可访问）

- 优先级：P2
- 类型：发布 / 缺陷
- 状态：已知原因
- 来源：用户实际使用反馈
- 描述：设置页"检查更新"始终显示失败。
- 原因：仓库 `cat-xierluo/FaroPDF` 当前为 **private**，updater endpoint `https://github.com/cat-xierluo/FaroPDF/releases/latest/download/latest.json` 对未认证请求返回 404。
- 解决方案：仓库公开后自动修复。若需在私有阶段测试更新，可改用 GitHub API + token 或私有 CDN 托管 `latest.json`（不在 v0.1 阻塞）。
- 关键文件：`src-tauri/tauri.conf.json` § plugins.updater.endpoints、`src/modules/settings/sections/AboutSection.tsx`（更新状态 UI）。

### ISS-037 工具栏左上角品牌区域去除图标和名称占位

- 优先级：P2
- 类型：UI / 布局
- 状态：已完成（2026-06-07）
- 来源：用户实际使用反馈
- 描述：工具栏左上角 `toolbar__brand` 区域当前显示 FaroPDF 图标 + 应用名称，在桌面应用中属于冗余占位（窗口标题栏已有应用名）。参照 PDF Expert 不在工具栏内重复显示品牌信息。
- 目标：移除工具栏左上角的图标和名称占位，将空间让给页面布局类功能（文档摘要 / 页面管理 / 视图设置），配合 ISS-030 整体调整。
- 关键文件：`src/components/layout/Toolbar.tsx`（`toolbar__brand` 区域，约 line 92-100）。

### ISS-038 DESIGN.md 对齐 Folia / Funes 设计系统成熟度

- 优先级：P2
- 类型：设计系统
- 状态：已完成（2026-06-07）
- 来源：用户要求
- 描述：FaroPDF 的 DESIGN.md 目前偏薄，缺少 Folia / Funes 设计系统中已有的成熟规范（如完整的色彩 Token 体系、组件样式规范、信息密度规范、交互规则、深度层级、禁止事项等）。UI 克制原则和功能分层规则需要从 Folia / Funes 提炼通用规范并适配 PDF 阅读器场景。
- 目标：
  1. 参照 Folia DESIGN.md（12 节结构：视觉主题 / 色彩 / 字体 / 布局 / 组件样式 / 信息密度 / 交互 / 深度层级 / 响应式 / 页面状态 / 禁止事项 / 设计评审）和 Funes DESIGN.md（9 节结构：视觉主题 / 色彩 / 字体 / 布局 / 组件 / 信息密度 / 交互 / 深度 / 响应式），补全 FaroPDF DESIGN.md 的缺失章节。
  2. 新增「工具栏克制原则」一节：一级/二级分层、侧边栏默认关闭、页面布局收左上角、品牌信息不在工具栏显示等规则（对应 ISS-030 / ISS-037）。
  3. 新增「设置页 UI 统一规范」：控件样式、高光/亮色一致性规则（对应 ISS-035）。
  4. 新增「空态规范」：欢迎页布局、最近文件区域规则、无占位符原则（对应 ISS-034）。
  5. 新增「菜单栏规范」：macOS 原生菜单中文化、深层功能入口规则（对应 ISS-032）。
- 参考项目：
  - Folia（`/maoscripts/folia/docs/DESIGN.md`）：书卷气 + 工具克制 + 单一赭色 accent + 透明工具栏 + 禁止事项清单 + AI 协作变更约束。
  - Funes（`/maoscripts/Funes/DESIGN.md`）：专业工具感 + 亮色清爽 + 灰度色块分层 + 渐进式展示 + 装饰性元素必须有用 + 侧边栏窄条模式。
- 验收：DESIGN.md 覆盖完整的色彩/字体/布局/组件/交互/密度/深度/禁止事项规范，新 UI 改动可直接从文档中找到对应规则而不需要猜。

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
- **OCR / 质量**：ISS-007（含 E2E 联调 worker）、ISS-010、ISS-017
- **扫描预处理**：ISS-016
- **设置 / OCR Provider**：ISS-014、ISS-022、ISS-024（doc-curator 部署）
- **表单 / 签署**：ISS-008
- **设计系统 / UI 整合**：ISS-009、ISS-023
- **批注深化**：ISS-026
- **发布 / 工程**：ISS-021、ISS-027
- **法律材料整理**：ISS-019
- **品牌 / UI**：ISS-020、ISS-029
- **跨仓协调**：personal-site `ISS-005`（Folio 仓 PR-A / FaroPDF 仓 PR-B 联动，FaroPDF 仓侧见 DEC-058 docs-only 同步）
- **跨仓交付**：personal-site `ISS-001~012`（仓 `cat-xierluo/cat-xierluo.github.io`，v0.1.0-alpha.8 + i18n + 微信二维码真实化 + URL 去 subpath + Legal Skills 集成已落定；FaroPDF 仓侧不重复登记，详见 `docs/TASKS.md` § 推进策略 > 跨仓任务边界 + DEC-072）

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

- 2026-06-07：ISS-030 / ISS-031 / ISS-032 / ISS-033 / ISS-034 / ISS-035 / ISS-037 / ISS-038 全部完成。工具栏克制化（48px、无品牌区、compact 布局按钮）、欢迎页空态清理（移除占位符和最近文件区域）、主页灰色区域修复（reader flex: 1）、PDF 拖拽打开（DocumentReader DnD handler）、PDF.js worker 幂等配置、设置页 UI 统一（focus-visible + 遗留 CSS 清理）、macOS 菜单栏中文化（Tauri v2 MenuBuilder）、DESIGN.md 重构为 21 节成熟结构（对齐 Folia / Funes）。
- 2026-06-06：ISS-013 法院上传压缩预设 4 档 + 真实 JPEG 图像重编码（DEC-069 / `feat/iss-013-court-compression-presets`）：4 档 court preset（5MB/10MB/20MB/50MB）+ Canvas API JPEG DCTDecode 重编码 + 目标体积验证 + 保守路径（CMYK/FlateDecode/其他 Filter 保留原图）。
- 2026-06-05：ISS-029 落地（fix/iss-029-faropdf-real-qr，资源替换 + AuthorCard 注释 + QRCODE_LICENSE.md 改写 + docs 同步）。
- 2026-06-05：封箱 0.1.0-alpha.18（release/0.1.0-alpha.18，DEC-063）：合并 4 条 Unreleased 条目为 `## 0.1.0-alpha.18 - 2026-06-05` 段 + `package.json` / `src-tauri/tauri.conf.json` 版本号 bump 到 `0.1.0-alpha.18` + ROADMAP v0.1 状态从「待开始」改为「进行中（alpha.0~18 已封箱）」+ release.yml tag pattern 从 `v*.*.*` 扩到 `["v*.*.*", "v*.*.*-*"]` 让 prerelease 也能触发 CI；详见 DEC-063。是否实际打 `v0.1.0-alpha.18` tag 触发 release.yml 由 PM 在 PR 合并后决定（占位 pubkey 不打 tag；PM 重新生成 keypair 替换 + 配 GitHub Secrets 后再打 tag）。








