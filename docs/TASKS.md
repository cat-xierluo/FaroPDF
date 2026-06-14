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

### ISS-039 PDF 工具启动器与导出编号面板收口

- 优先级：P0
- 类型：UI 信息架构 / 导出 / 多层级菜单
- 状态：已完成（2026-06-08，全量验证通过）
- 来源：用户持续反馈“多层级菜单”和“整体 UI 简洁”未完成，并要求整体页面和功能布局参照 PDF Expert。
- 目标：
  1. 阅读态顶栏只保留常用入口，`另存为`、页码、Bates、压缩等低频交付命令不再平铺。
  2. 右侧 `工具` 按钮打开 PDF Expert 式工作流启动器，按 `组织页面 / 交付导出 / 标注填写 / 扫描 OCR` 分组。
  3. `添加页码` / `Bates 编号` 从三级工具入口进入导出模式，导出模式右侧设置面板承载编号参数。
  4. 导出二级工具条只保留 `文字水印 / 图片水印`，不把页码 / Bates 重新塞回二级按钮。
  5. 页码 / Bates 导出默认生成新 PDF，不覆盖原始 PDF。
- 关键文件：
  - `src/shared/app/commands.ts`
  - `src/components/layout/Toolbar.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/styles/app.css`
- 验收：
  - [x] `工具` 菜单按四组展示，并复用统一 command model。
  - [x] `添加页码` / `Bates 编号` 不出现在一级顶栏或导出二级工具条。
  - [x] 导出模式显示 `交付设置面板`，可在 `普通编号 / 证据编号` 间切换。
  - [x] 普通页码可按样式、位置和起始号导出 `*-page-numbered.pdf`。
  - [x] Bates 可按前缀、后缀、位数、位置和起始号导出 `*-bates.pdf`。
  - [x] 空态不展示旋转 / 适合页面等文档专属辅助按钮，页码控件不显示 `1 / 0`。
  - [x] 工具启动器只展示分组标题和命令名，命令说明收进悬停提示，降低菜单文字密度。
  - [x] 全量测试、类型检查、Rust 检查、生产构建和 960×720 视觉复核通过。

### ISS-040 文字 / 图片水印交付面板接入

- 优先级：P1
- 类型：导出 UI / 多层级菜单 / PDF Expert 式交付工具
- 状态：已完成（2026-06-08）
- 来源：ISS-039 后续审计：导出引擎已有文字/图片水印 operation，但 UI 只有二级工具条按钮，缺少同一套右侧交付设置面板。
- 目标：
  1. 导出二级工具条的 `文字水印 / 图片水印` 只负责切换右侧面板，不直接弹散乱入口。
  2. `ExportDeliveryPanel` 支持 `文字水印 / 图片水印 / 普通编号 / 证据编号` 四类交付工具。
  3. 文字水印支持内容、位置、字号、透明度和旋转角度，并默认导出 `*-text-watermarked.pdf` 新副本。
  4. 图片水印支持选择 PNG/JPG、位置、宽度和透明度，并默认导出 `*-image-watermarked.pdf` 新副本。
  5. 继续不覆盖原始 PDF。
- 关键文件：
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/modules/export/ui/ExportDeliveryPanel.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
- 验收：
  - [x] 导出工具条点击 `文字水印 / 图片水印` 会切换右侧交付设置面板。
  - [x] 文字水印可导出新 PDF 副本。
  - [x] 图片水印选择 PNG/JPG 后可导出新 PDF 副本。
  - [x] 页码 / Bates 仍留在深层工具入口和交付面板，不回到二级工具条。
  - [x] 全量测试、类型检查、lint、构建、Rust 检查和 960×720 视觉复核通过。

### ISS-041 压缩交付面板接入

- 优先级：P1
- 类型：导出 UI / 多层级菜单 / 压缩
- 状态：已完成（2026-06-08）
- 来源：用户要求整体页面和功能布局继续参照 PDF Expert，低频交付能力不能重新平铺到顶栏或二级工具条；ISS-040 后压缩仍停留在工具命令入口，缺少右侧交付设置面板。
- 目标：
  1. `压缩` 继续作为三级工具 / 原生菜单入口，不进入阅读态顶栏或导出二级工具条。
  2. `export-compress` 进入导出模式后选中右侧 `压缩设置`。
  3. `ExportDeliveryPanel` 增加压缩预设选择，默认 `法院 10MB`，并输出 `*-compressed.pdf` 新副本。
  4. `pdfOperationEngine` 的 `compress mode=apply` 使用压缩服务返回的 PDF 作为后续导出工作副本，避免只生成摘要、不改变输出 bytes。
  5. 继续不覆盖原始 PDF。
- 关键文件：
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/modules/export/pdfOperationEngine.ts`
  - `src/components/layout/AppShell.tsx`
  - `src/modules/export/ui/ExportDeliveryPanel.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
- 验收：
  - [x] 压缩工具只从 `工具` 菜单 / 原生菜单进入导出模式右侧面板。
  - [x] 右侧面板支持法院上传 5MB / 10MB / 20MB / 50MB 以及屏幕阅读 / 电子归档 / 打印优先预设。
  - [x] 压缩导出默认生成 `*-compressed.pdf` 新副本。
  - [x] 压缩 apply 模式使用压缩服务输出替换工作 PDF，不再只是计划摘要。
  - [x] 全量测试、类型检查、lint、构建、Rust 检查、git diff 空白检查和 960×720 视觉复核通过。

### ISS-042 页眉页脚交付面板接入

- 优先级：P1
- 类型：导出 UI / 多层级菜单 / 页眉页脚
- 状态：已完成（2026-06-08）
- 来源：ISS-041 后续审计：`页眉页脚` 已在工具启动器和原生菜单中作为深层命令暴露，但仍只是占位反馈，没有进入右侧交付设置面板。
- 目标：
  1. `页眉页脚` 继续作为三级工具 / 原生菜单入口，不进入阅读态顶栏或导出二级工具条。
  2. `export-header-footer` 进入导出模式后选中右侧 `页眉页脚设置`。
  3. `ExportDeliveryPanel` 支持页眉、页脚、字号和透明度设置，并默认输出 `*-header-footer.pdf` 新副本。
  4. 导出实现复用现有文字 watermark operation，在页面上方 / 下方写入固定说明，不新增独立分叉引擎。
  5. 继续不覆盖原始 PDF。
- 关键文件：
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/shared/app/commands.ts`
  - `src/modules/export/ui/ExportDeliveryPanel.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
- 验收：
  - [x] 页眉页脚工具只从 `工具` 菜单 / 原生菜单进入导出模式右侧面板。
  - [x] 右侧面板支持页眉、页脚、字号和透明度设置。
  - [x] 页眉页脚导出默认生成 `*-header-footer.pdf` 新副本。
  - [x] 页眉和页脚均为空时阻止导出并提示。
  - [x] 全量测试、类型检查、lint、构建、Rust 检查、git diff 空白检查和 960×720 视觉复核通过。

### ISS-043 表单扁平化入口与填写签名工具条收口

- 优先级：P1
- 类型：UI 信息架构 / 表单 / 多层级菜单
- 状态：已完成（2026-06-08）
- 来源：继续推进 PDF Expert 式页面和功能布局；审计发现 `表单扁平化` 已有输出能力，但深层工具命令只切到 forms mode，没有稳定打开填写签名面板；填写签名二级工具条仍保留日期、钩号等未接通占位按钮。
- 目标：
  1. `表单扁平化` 继续作为三级工具 / 原生菜单入口，不进入阅读态顶栏或导出二级工具条。
  2. `forms-flatten` 进入填写和签名模式后打开左侧 `填写和签名面板`，由面板承载读取字段和扁平化导出确认。
  3. 填写和签名二级工具条只展示已接通动作：`读取字段 / 填写 / 签名 / 扁平化导出`。
  4. 移除日期、钩号、叉号、图章、图像等未接通占位按钮，避免 UI 看似丰富但不可用。
  5. 表单扁平化继续默认输出 `*-flattened.pdf` 新副本，不覆盖原始 PDF。
- 关键文件：
  - `src/shared/app/commands.ts`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/AppShell.test.tsx`
  - `src/shared/app/commands.test.ts`
  - `src/App.test.tsx`
- 验收：
  - [x] `forms-flatten` 标记为三级命令，并路由到 `forms` mode + `forms` utility panel。
  - [x] 工具启动器 / 原生菜单触发 `表单扁平化` 后，前端命令模型请求打开填写签名面板。
  - [x] 填写签名二级工具条只保留真实接线动作，不展示日期 / 钩号 / 导出为压平等旧占位。
  - [x] 全量测试、类型检查、lint、构建、Rust 检查、git diff 空白检查和 960×720 视觉复核通过。

### ISS-044 页面管理工作台真实状态与另存导出接入

- 优先级：P0
- 类型：页面整理 / UI 信息架构 / 多层级菜单
- 状态：已完成（2026-06-08）
- 来源：继续推进 PDF Expert 式页面和功能布局；审计发现页面管理工作台仍停留在视觉计数和风险提示，未接入 `pageOrganizer` 状态机和真实 PDF 页面改写导出。
- 目标：
  1. 页面管理继续作为左上角布局入口 / 独立工作台，不回到阅读态顶栏或导出二级工具条。
  2. 页面网格接入 `pageOrganizer` 状态机，旋转、删除和撤销要真实更新工作台状态。
  3. 删除必须先确认，确认后页面从活动网格移除；撤销可恢复删除和旋转。
  4. `另存为新 PDF` 使用当前 PDF bytes 和 `pdfOperationEngine` 的 `page-operations execute` 导出新副本。
  5. 默认文件名为 `*-organized.pdf`，不覆盖原始 PDF。
- 关键文件：
  - `src/components/layout/PageOrganizerWorkspace.tsx`
  - `src/components/layout/PageOrganizerWorkspace.test.tsx`
  - `src/modules/pages/pageOrganizer.ts`
  - `src/modules/export/pdfOperationEngine.ts`
- 验收：
  - [x] 旋转已选页面后，页面卡片显示旋转状态且撤销可恢复。
  - [x] 删除确认后，页面从活动网格移除且撤销可恢复。
  - [x] 另存导出调用真实页面操作导出并保存 `*-organized.pdf` 新副本。
  - [x] 页面管理相关低频动作不进入阅读态顶栏或导出二级工具条。

### ISS-045 批注扁平化入口与批注侧栏导出接入

- 优先级：P0
- 类型：批注 / UI 信息架构 / 多层级菜单
- 状态：已完成（2026-06-08）
- 来源：继续推进 PDF Expert 式页面和功能布局；ROADMAP §5.1 剩余项显示表单 flatten 与页面操作真实改写已完成，但批注扁平化 UI 仍未接入。底层 `pdfOperationEngine` 已支持 `flatten-annotations` 的 `draw` 策略，缺少深层入口和面板确认。
- 目标：
  1. `批注扁平化` 作为三级工具 / 原生菜单入口，归属 `标注填写` 分组，不进入阅读态顶栏或导出二级工具条。
  2. `annotations-flatten` 进入批注模式后打开左侧 `批注侧边栏`，由侧栏承载扁平化导出确认。
  3. 批注侧栏在有批注时展示 `扁平化导出` 动作，调用 `pdfOperationEngine` 的 `flatten-annotations draw` 真实绘制批注。
  4. 默认输出 `*-annotations-flattened.pdf` 新副本，不覆盖原始 PDF。
  5. 无文档、无批注或缺少源 PDF bytes 时给出明确状态，不显示虚假成功。
- 关键文件：
  - `src/shared/app/commands.ts`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/AnnotationSidebar.tsx`
  - `src/components/layout/AnnotationSidebar.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
- 验收：
  - [x] `annotations-flatten` 标记为三级命令，并路由到 `annotate` mode + `annotation` utility panel。
  - [x] 工具启动器 / 原生菜单触发 `批注扁平化` 后打开批注侧栏，不进入导出工具条。
  - [x] 批注侧栏 `扁平化导出` 调用真实 `flatten-annotations draw` 并保存 `*-annotations-flattened.pdf`。
  - [x] 无批注时不显示可点击的扁平化导出假入口。

### ISS-046 页面管理重排 UI 与真实另存接入

- 优先级：P0
- 类型：页面整理 / UI 信息架构 / PDF Expert 式工作台
- 状态：已完成（2026-06-08，全量验证通过）
- 来源：继续推进未完成任务；ROADMAP §5 显示页面旋转 / 删除 / 撤销已完成，但 `重排 UI 待完成`。底层 `pageOrganizer` 已有 reorder 状态机，`pdfOperationEngine page-operations execute` 已能真实改写页序，缺少工作台内可操作入口。
- 目标：
  1. 页面重排只在页面管理工作台内完成，不进入阅读态顶栏或导出二级工具条。
  2. 页面卡片提供克制的上移 / 下移动作，支持多次移动、撤销和状态提示。
  3. 重排后的页面顺序参与 `另存为新 PDF`，输出 `*-organized.pdf` 新副本，不覆盖原始 PDF。
  4. 未选择页面或边界页时禁用无效移动，不展示未接通的插入 / 合并 / 摘录占位按钮。
- 关键文件：
  - `src/components/layout/PageOrganizerWorkspace.tsx`
  - `src/components/layout/PageOrganizerWorkspace.test.tsx`
  - `src/components/layout/PageOrganizerWorkspace.css`
  - `src/modules/pages/pageOrganizer.ts`
- 验收：
  - [x] 页面管理工作台可对选中页面执行上移 / 下移，页面网格立即反映新顺序。
  - [x] 重排动作可撤销。
  - [x] 重排后的另存导出调用真实 `page-operations execute` 并保存新副本。
  - [x] 重排入口不进入阅读态顶栏或导出二级工具条。

### ISS-047 ReaderCanvas PDF.js 并发渲染取消缺陷

- 优先级：P1
- 类型：阅读渲染 / 缺陷修复
- 状态：已完成（2026-06-08，全量验证通过）
- 来源：ISS-046 Playwright 960×720 复核时，上传 5 页临时 PDF 后从页面管理切到导出模式，console 出现 `Cannot use the same canvas during multiple render() operations`。
- 目标：
  1. `ReaderCanvas` 在页面重新渲染、模式切换或组件卸载时取消上一轮 PDF.js render task。
  2. 避免同一 canvas 被重复 render 导致页面回退到渲染失败占位。
  3. 增加回归测试覆盖快速模式切换 / 重新渲染场景。
- 关键文件：
  - `src/components/layout/ReaderCanvas.tsx`
  - `src/components/layout/ReaderCanvas.test.tsx`
  - `src/modules/reader/pdfReaderService.ts`
  - `src/modules/reader/useReaderController.ts`
- 验收：
  - [x] 快速上传 PDF 后切换页面管理 / 导出 / 阅读模式，不再出现同 canvas 并发 render 错误。
  - [x] PDF 页面保持 canvas 渲染，不落入文本占位回退。
  - [x] 相关单测和 Playwright 复核通过。

### ISS-048 工具启动器去假入口与批注摘要重路由

- 优先级：P0
- 类型：UI 信息架构 / 多层级菜单 / PDF Expert 式收口
- 状态：已完成（2026-06-08，核心验证通过）
- 来源：用户继续反馈“多层级菜单、整体 UI 简洁”仍未完成，并要求整体页面和功能布局参照 PDF Expert。
- 目标：
  1. 空态不展示未接通的图片转 PDF / Word 转 PDF 假入口，保持打开 PDF 的主动作清晰。
  2. 工具启动器中的 `另存为` 必须执行真实副本导出，默认不覆盖原始 PDF。
  3. `批注摘要` 从工具启动器进入批注侧栏的摘要视图，避免切到没有对应设置项的导出面板。
  4. 工具启动器继续按工作流分组展示，低频命令不回到阅读态顶栏或导出二级工具条。
- 关键文件：
  - `src/components/layout/ReaderCanvas.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/AnnotationSidebar.tsx`
  - `src/shared/app/commands.ts`
  - `src/App.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
  - `src/shared/app/commands.test.ts`
- 验收：
  - [x] 未打开 PDF 时只展示打开 / 拖拽 PDF 主入口，不展示未接通转换按钮。
  - [x] `工具 > 另存为` 真实保存 `*-copy.pdf` 新副本，缺少源 bytes 时给出明确错误。
  - [x] `工具 > 批注摘要` 打开批注侧栏摘要视图，可继续导出 Markdown / HTML。
  - [x] 页码 / Bates / 压缩等低频命令仍只在工具启动器或对应工作台中出现。

### ISS-049 阅读模式工具注册幂等修复

- 优先级：P0
- 类型：UI 信息架构 / 缺陷修复
- 状态：已完成（2026-06-08，浏览器复核通过）
- 来源：ISS-048 960×720 浏览器复核：打开 PDF 后阅读辅助按钮 `逆时针 / 顺时针 / 适合页面` 重复出现，console 提示 React children key 重复。
- 目标：
  1. `registerReadModeTools()` 在开发热更新或重复初始化时保持幂等，不重复追加同一批工具。
  2. `toolbarRegistry` 按 mode + tool id 去重，避免相同按钮在顶栏重复显示。
  3. 阅读态仍只在有文档时显示阅读辅助按钮，未打开 PDF 时保持空态顶栏克制。
- 关键文件：
  - `src/components/layout/toolbarRegistry.ts`
  - `src/components/layout/toolbarRegistry.test.ts`
  - `src/modules/reader/readerModeTools.test.ts`
- 验收：
  - [x] 重复调用 `registerReadModeTools()` 后 read mode 仍只有 3 个阅读工具。
  - [x] 重复注册同 id 工具时，注册表保留最新项且不产生重复 key。
  - [x] 浏览器复核打开 PDF 后不再出现重复阅读按钮或重复 key console 错误。

### ISS-050 原生菜单系统动作去提示型假入口

- 优先级：P0
- 类型：UI 信息架构 / 原生菜单 / PDF Expert 式收口
- 状态：已完成（2026-06-08，核心验证通过）
- 来源：继续推进用户反馈的“多层级菜单、整体 UI 简洁”问题；ISS-048 后审计发现 `新建窗口` 和 `关于 FaroPDF` 仍是提示型入口，系统级窗口动作也混在前端业务 command catalog 中。
- 目标：
  1. `文件 > 新建窗口` 必须执行真实桌面壳层动作，不再发前端占位提示。
  2. `帮助 > 关于 FaroPDF` 必须直接打开设置页的 `关于` section，不再只显示“关于信息位于设置页”提示。
  3. `新建窗口 / 全屏 / 关闭窗口` 等系统动作由 Rust 菜单事件处理，不进入前端 PDF 业务 command catalog。
  4. 前端 `nativeMenuBridge` 只接收需要业务路由的菜单命令，继续复用统一 command model。
- 关键文件：
  - `src-tauri/src/lib.rs`
  - `src/shared/app/commands.ts`
  - `src/modules/settings/SettingsPanel.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/shared/app/commands.test.ts`
  - `src/modules/settings/SettingsPanel.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
- 验收：
  - [x] `file-new-window` / `view-fullscreen` 不再作为前端 `native-menu` command 暴露。
  - [x] Rust 菜单事件中 `file-new-window` 直接创建新的 FaroPDF 窗口。
  - [x] `help-about` 无占位 feedback，触发后打开设置对话框并定位到 `关于` section。
  - [x] 相关前端回归测试和 `cargo check` 通过。

### ISS-051 页眉页脚奇偶页范围接入

- 优先级：P1
- 类型：导出 UI / 多层级菜单 / 页眉页脚深化
- 状态：已完成（2026-06-09，全量验证通过）
- 来源：`docs/DESIGN.md` §19 当前设计差距仍记录“页眉页脚的奇偶页差异”待后续深化；该能力属于导出模式右侧交付设置，不应增加顶栏或二级工具条噪音。
- 目标：
  1. `页眉页脚` 继续只从工具启动器 / 原生菜单进入导出右侧面板，不进入阅读态顶栏或导出二级工具条。
  2. `ExportDeliveryPanel` 的页眉页脚设置增加 `全部页面 / 奇数页 / 偶数页` 应用范围。
  3. 奇数页 / 偶数页范围通过 `PdfWatermarkOperation.pageIndexes` 精确传给导出引擎。
  4. 无匹配页面时阻止导出并提示，不显示虚假成功。
  5. 默认仍输出 `*-header-footer.pdf` 新副本，不覆盖原始 PDF。
- 关键文件：
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/modules/export/ui/ExportDeliveryPanel.test.tsx`
  - `docs/DESIGN.md`
  - `docs/DECISIONS.md`
  - `CHANGELOG.md`
- 验收：
  - [x] 页眉页脚面板有 `应用范围` 控件，默认 `全部页面`。
  - [x] 选择 `奇数页` 时，页眉和页脚 operation 都只携带 0-based 奇数显示页索引，例如 3 页文档为 `[0, 2]`。
  - [x] 选择 `偶数页` 时，单页文档阻止导出并提示“当前文档没有偶数页。”。
  - [x] 导出模式二级工具条仍不展示 `页眉页脚` 按钮。

### ISS-052 缩略图状态标记克制化

- 优先级：P1
- 类型：UI 信息架构 / 左侧摘要 / PDF Expert 式状态提示
- 状态：已完成（2026-06-09，核心验证通过）
- 来源：`docs/DESIGN.md` §19 仍记录“左侧缩略图接批注 / 搜索 / OCR 标记的视觉化”；当前代码已经能接收批注、搜索命中和 OCR 状态，但缩略图卡片使用 `批注 / 命中 / OCR` 文字胶囊，长卷宗左侧容易形成重复文字噪音。
- 目标：
  1. 状态提示继续只放在左侧文档摘要缩略图卡内，不增加阅读态顶栏、二级工具条或工具启动器入口。
  2. 批注、搜索命中和 OCR 状态改为紧凑视觉标记，降低重复文字密度。
  3. 保留 `title` / `aria-label` 等辅助说明，让屏幕阅读器和鼠标悬停仍能知道标记含义。
  4. 支持同一页同时出现多个状态标记，且不改变缩略图尺寸或点击跳页行为。
  5. 无状态页不显示空的标记容器。
- 关键文件：
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/Sidebar.test.tsx`
  - `src/styles/app.css`
  - `docs/DESIGN.md`
  - `docs/DECISIONS.md`
  - `CHANGELOG.md`
- 验收：
  - [x] 有批注 / 搜索命中 / OCR 状态的页码显示紧凑状态标记，不再显示重复的 `批注 / 命中 / OCR` 可见文字。
  - [x] 每个标记保留可访问名称和悬停说明。
  - [x] 同一页多个状态标记可以并排显示，缩略图按钮点击仍按 0-based pageIndex 跳页。
  - [x] 左侧摘要状态标记不进入顶栏、二级工具条或工具启动器。

### ISS-053 页眉页脚视觉位置选择器

- 优先级：P1
- 类型：导出 UI / 多层级菜单 / 页眉页脚深化
- 状态：已完成（2026-06-09，全量验证通过）
- 来源：继续推进用户反馈的“多层级菜单、整体 UI 简洁”和“整体页面和功能布局参照 PDF Expert”；`docs/DESIGN.md` §19 仍记录“页眉页脚可视化拖拽定位”待深化。
- 目标：
  1. `页眉页脚` 继续只从工具启动器 / 原生菜单进入导出右侧面板，不进入阅读态顶栏或导出二级工具条。
  2. 页眉和页脚各自支持左 / 中 / 右位置选择，默认页眉上方居中、页脚下方居中。
  3. 位置选择使用面板内的紧凑视觉选择器表达，不新增大面积说明或复杂拖拽组件。
  4. 导出时页眉位置传给上方 watermark placement，页脚位置传给下方 watermark placement，并继续复用奇偶页 `pageIndexes` 范围。
  5. 默认仍输出 `*-header-footer.pdf` 新副本，不覆盖原始 PDF。
- 关键文件：
  - `src/modules/export/ui/ExportDeliveryPanel.tsx`
  - `src/modules/export/ui/ExportDeliveryPanel.css`
  - `src/modules/export/ui/ExportDeliveryPanel.test.tsx`
  - `docs/DESIGN.md`
  - `docs/DECISIONS.md`
  - `CHANGELOG.md`
- 验收：
  - [x] 页眉位置选择默认 `top-center`，可切换到 `top-left` / `top-right`。
  - [x] 页脚位置选择默认 `bottom-center`，可切换到 `bottom-left` / `bottom-right`。
  - [x] 选择奇数页 / 偶数页时，位置和 `pageIndexes` 同时正确传给导出引擎。
  - [x] 导出模式二级工具条仍不展示 `页眉页脚` 按钮。
  - [x] 相关测试、类型检查、lint、构建、Rust 检查、空白检查和 960×720 视觉复核通过。

### ISS-054 深色模式最小接入

- 优先级：P1
- 类型：UI 视觉 / 设置 / PDF Expert 式界面 polish
- 状态：已完成（2026-06-09，核心验证通过）
- 来源：`docs/DESIGN.md` §19 当前设计差距仍记录“深色模式（当前仅亮色）”。该能力属于整体视觉系统和设置项，不应新增顶栏按钮，也不应改变已收口的工具层级。
- 目标：
  1. 外观选择放在 `设置 > 常规`，不进入阅读态顶栏、二级工具条或工具启动器。
  2. `AppSettings` 新增外观偏好，默认 `浅色`；旧持久化数据缺字段时自动回退浅色。
  3. 切换 `深色` 后通过根节点 `data-theme="dark"` 应用深色 token，让设置浮层、工具启动器、阅读区和状态栏共享同一主题。
  4. PDF 页面纸张仍保持可读的纸面语义，不把原始 PDF 内容反相。
  5. 不引入新依赖，不改动 PDF 导出或文件保存语义。
- 关键文件：
  - `src/shared/settings/types.ts`
  - `src/shared/settings/defaults.ts`
  - `src/modules/settings/sections/GeneralSection.tsx`
  - `src/App.tsx`
  - `src/styles/app.css`
  - `src/modules/settings/sections/GeneralSection.test.tsx`
  - `src/shared/settings/defaults.test.ts`
  - `src/App.test.tsx`
- 验收：
  - [x] 默认设置为浅色，根节点为 `data-theme="light"`。
  - [x] 旧设置数据没有外观字段时回退浅色，非法字段被校验拦截或归一化。
  - [x] 在常规设置中选择深色后，根节点切换为 `data-theme="dark"`。
  - [x] 深色模式不新增顶栏 / 二级工具条入口，既有工具层级保持不变。
  - [x] 相关测试、类型检查、lint、构建、空白检查和 960×720 视觉复核通过。

### ISS-055 顶栏任务模式入口收口

- 优先级：P0
- 类型：UI 信息架构 / 多层级菜单 / PDF Expert 式顶栏
- 状态：已完成（2026-06-09，全量验证通过）
- 来源：用户继续反馈“多层级菜单、整体 UI 简洁”仍未达到预期，并明确要求整体页面和功能布局参照 PDF Expert。
- 目标：
  1. 阅读态顶栏不再直接平铺 `OCR / 批注 / 填写和签名 / 导出` 四个任务模式按钮。
  2. 任务模式入口统一进入右侧 `工具` 工作流启动器，由 `交付导出 / 标注填写 / 扫描 OCR` 等分组承载。
  3. 切入某个任务模式后，仍只显示该模式对应的第二行上下文工具条或工作台。
  4. 阅读辅助按钮继续只在打开 PDF 后出现，并保持图标化，不把文字标签重新堆回顶栏。
  5. 不改变导出、批注、表单、OCR 的业务命令语义和默认另存安全策略。
- 关键文件：
  - `src/components/layout/Toolbar.tsx`
  - `src/shared/app/commands.ts`
  - `src/styles/app.css`
  - `src/App.test.tsx`
  - `src/components/layout/AppShell.test.tsx`
  - `src/shared/app/commands.test.ts`
- 验收：
  - [x] 顶栏关闭状态下没有 `OCR / 批注 / 填写和签名 / 导出` 四个任务模式按钮。
  - [x] `工具` 菜单中仍可进入 `导出 / 批注 / 填写和签名 / OCR`。
  - [x] 进入导出 / 批注 / 填写 / OCR 后，对应上下文工具条和工作台行为保持不变。
  - [x] 打开 PDF 后阅读辅助工具保持图标化，不增加顶栏文字噪音。
  - [x] 相关测试、类型检查、lint、构建、空白检查和浏览器视觉复核通过。

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
- 状态：已完成（2026-06-08，原生菜单桥接补齐）
- 来源：用户实际使用反馈
- 目标：
  1. macOS 原生菜单栏从默认英文（File / Edit / View / Window / Help）改为中文。
  2. 在菜单栏中暴露不常用的深层功能（如页眉页脚、页码添加等），作为工具栏次级功能的补充入口，参照 PDF Expert 通过菜单栏访问低频功能的方式。
- 初步分析：
  - `tauri.conf.json` 无 `app.menu` 配置，Tauri v2 在 macOS 上自动生成默认英文菜单。需通过 Tauri Menu API（`@tauri-apps/api/menu`）或 `tauri.conf.json` 的 `app.menus` 字段自定义菜单项和标签。
  - 中文菜单标签：文件（新建窗口 / 打开 / 保存 / 另存为 / 关闭）、编辑（撤销 / 重做 / 剪切 / 复制 / 粘贴）、视图（文档摘要 / 页面管理 / 视图设置 / 全屏）、窗口、帮助。
  - 深层功能入口：可在"文件"或"工具"菜单下添加"添加页眉页脚""添加页码""Bates 编号"等菜单项，点击后进入对应的工具模式或打开设置面板。
  - 关键文件：`src-tauri/tauri.conf.json`（菜单配置）、可能需要 `src-tauri/src/lib.rs` 添加菜单事件处理。
- 验收：
  - [x] macOS 菜单栏显示中文标签。
  - [x] `文件 > 打开…` 通过 Tauri dialog 选择 PDF，并经专用 Rust command 读取 bytes 后进入 reader。
  - [x] `工具 > 添加页码 / Bates 编号 / 页眉页脚 / 水印 / 压缩 / 表单扁平化` 通过 `faropdf://command` 事件进入前端 command model。
  - [x] 原生菜单命令 id 与 `src/shared/app/commands.ts` 保持一致，避免菜单、工具启动器和 AppShell 分叉。

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
- **UI 信息架构 / 导出面板**：ISS-039、ISS-040、ISS-041、ISS-042
- **跨仓协调**：personal-site `ISS-005`（Folio 仓 PR-A / FaroPDF 仓 PR-B 联动，FaroPDF 仓侧见 DEC-058 docs-only 同步）
- **跨仓交付**：personal-site `ISS-001~012`（仓 `cat-xierluo/cat-xierluo.github.io`，v0.1.0-alpha.8 + i18n + 微信二维码真实化 + URL 去 subpath + Legal Skills 集成已落定；FaroPDF 仓侧不重复登记，详见 `docs/TASKS.md` § 推进策略 > 跨仓任务边界 + DEC-072）

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

- 2026-06-09：完成 ISS-055。针对用户继续反馈的多层级菜单与整体简洁问题，收口顶栏任务模式入口：`OCR / 批注 / 填写和签名 / 导出` 统一进入 `工具` 工作流启动器，顶栏只保留阅读和全局入口；切入后继续显示对应上下文工具条或工作台。
- 2026-06-09：完成 ISS-054。深色模式作为 `设置 > 常规` 的外观偏好接入，默认浅色、旧设置缺字段回退浅色；切换深色后根节点写入 `data-theme="dark"` 并套用深色 token，不新增顶栏、二级工具条或工具启动器入口，PDF 纸面内容保持不反相。
- 2026-06-09：完成 ISS-053。页眉页脚继续保持工具启动器 / 原生菜单深层入口，不进入导出二级工具条；右侧交付设置面板新增页眉 / 页脚各自的左 / 中 / 右视觉位置选择器，导出时映射到上方 / 下方 watermark placement，并继续与奇偶页范围共存。
- 2026-06-09：完成 ISS-052。左侧文档摘要缩略图的批注 / 搜索命中 / OCR 状态改为紧凑视觉标记，保留 `aria-label` 和 `title` 辅助说明；状态提示继续停留在左侧摘要，不进入顶栏、二级工具条或工具启动器。
- 2026-06-09：完成 ISS-051。`页眉页脚` 继续保持工具启动器 / 原生菜单深层入口，不进入导出二级工具条；右侧交付设置面板新增 `全部页面 / 奇数页 / 偶数页` 应用范围，奇偶页通过 `PdfWatermarkOperation.pageIndexes` 传给导出引擎，无匹配页面时阻止导出并提示。

较早进度日志已迁移到 `docs/DECISIONS.md` 的 DEC-083。
