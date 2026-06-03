# FaroPDF 变更记录

## 0.1.0-alpha.5 - 2026-06-03

- 新增批注深化第一版：在批注 sidecar 之上加入几何规整（normalizeRect/pointsToRect/unionRects/inkStrokesToRect/lineToRect/recomputeLineRects/recomputeInkRects/sanitizeRects/isRectWithinBounds/clampRectToBounds/annotationBoundingRect）、搜索过滤（collectAnnotationSearchHaystack + matchesQuery/matchesPageFilter/matchesTypeFilter/matchesColorFilter）、图章 SVG 模板（5 套模板、4:1 viewBox、矩形/圆角/椭圆/横幅 4 种 shape、escapeXml 注入）、工具条 model（ANNOTATION_TOOL_LIST/ANNOTATION_TOOL_MAP/ANNOTATION_COLOR_SWATCHES/AnnotationToolState + 5 个不可变 reducer）。
- 新增 `AnnotationOverlay`：覆盖高亮/下划线/删除线/备注/文本框/矩形/箭头/手写/图章 9 种批注的点击/拖拽/手写 3 种交互模式，预览走 `id: "preview"` 占位 annotation 并通过 `onAnnotationDraft` 派发不可变 draft。
- 新增 `AnnotationToolbar`：9 工具按钮 + 6 色色板 + 图章 5 模板子区段 + 图章文字输入，受控组件模式（外部 state + onStateChange）。
- 新增 11 项 `AnnotationToolbar` 单元测试：覆盖 9 工具按钮渲染、arm/disarm、工具切换、颜色更新、图章选项可见性、图章文字修改、图章模板切换回填 defaultLabel 和 disabled 行为。
- 新增 `docs/DECISIONS.md` DEC-026 记录批注深化的几何/搜索/图章/工具条边界；新增 `docs/TASKS.md` ISS-021 批注深化活跃任务卡和归档索引。

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
