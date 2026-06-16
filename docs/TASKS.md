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

## ISS-059..065：PDF Expert 视觉与功能对照复检（v0.2 候选）

> 触发：2026-06-15 大批次 PDF Expert 截图复检（v0.1.2 封箱期间 30 张 + 6 月 15 日新增 39 张），目标是把 PDF Expert 界面语言、画面语义和交互行为系统化记录到仓内，供后续 v0.2 设计 / 实现对照参考。
> 详细图片索引：见 `research/pdf-expert/FEATURE_CATALOG.md`（按 chrome / 视图与导航 / 侧边栏 / 批注 / 对话框 5 大块罗列 69 张截图要点）。
> 详细架构对照与落地建议：见 `docs/ARCHITECTURE.md` 中新增的「PDF Expert 视觉与架构对照（v0.2 起点）」节。
> 详细设计语言对照：见 `docs/DESIGN.md` §18 已扩展的分层与交互对照表。

### ISS-059 多 Tab 与 inline rename

- 优先级：P0
- 类型：UI 信息架构 / 窗口
- 来源：PDF Expert 截图 30, 65, 83（窗口顶部文件 tab bar）
- 目标：
  1. 同一窗口内开多个 PDF tab；右上角 `+` 新建 tab；选中 tab 内编辑。
  2. Tab 标题可 inline rename（双击进入编辑态、ESC 取消、Enter 提交）。
  3. tab 拖拽排序、tab 关闭按钮（X）、tab 拖离窗口剥离为新窗口。
  4. 不引入新依赖；不破坏现有 `recentFiles`/`utilityPanel` 状态。
- 关键文件：候选新文件 `src/components/layout/TitlebarTabs.tsx`、`src/state/tabStore.ts`，与 `AppShell.tsx` 集成。
- 验收：
  - [ ] 单窗口 ≥ 3 PDF 同时打开，可独立关闭/激活。
  - [ ] tab 重命名后，主窗口标题/最近文件命名均同步。
  - [ ] tab 拖放重排序生效，跨窗口剥离生成独立窗口。
- 备注：v0.1 缺位，但属于「重大交互变化」，先做技术 spike（react-aria/headless UI 选型 + Tauri 多窗口通信）。

### ISS-060 左 + 右 双侧栏（模式驱动侧栏内容）

- 优先级：P1
- 类型：UI 信息架构
- 状态：阶段 1 已完成（2026-06-15，右栏 `RightPanel` skeleton 接入 AppShell，按 activeMode 推导内容）；阶段 2 显式 Toolbar 切换按钮 + 各 mode 真实内容（图章网格 / 签名列表 / 导出预览 / OCR 队列）待启动。
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
- 状态：阶段 1 已完成（2026-06-15，`TextSelectionToolbar` + `usePdfTextSelection` hook 接入 AppShell 真选区，5 启用 + 2 disabled 占位 + Esc 关闭）；阶段 2 选区→直接 draft（跳过 user 二次拖拽）+ 翻译 / 朗读真接入待启动。
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
- 状态：阶段 1 已完成（2026-06-15，内置 5→9 + diagonal 形态）；阶段 2 自定义上传 tab + 缩略图渲染待启动。
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
- 状态：阶段 1 已完成（2026-06-15，`SecurityPanel` UI + `export-set-password / export-remove-password` 命令接入工具启动器和原生菜单 + `remove_pdfpassword` Rust 命令用 lopdf 真实解密生成 `-unsecured.pdf` 新副本）；阶段 2 `set_pdfpassword` 真实加密待 lopdf 升级到 0.34 或引入 qpdf。
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
- 状态：未启动
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
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，applyRedaction 算法 + 10 测试）；阶段 2 RedactionOverlay UI + commands.ts 入口 + 去页眉页脚 + 多矩形拖拽 待启动
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
- 状态：未启动
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
- 状态：未启动
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
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，SignaturePad 组件 + 8 测试）；阶段 2 FormsPanel 集成 + signatureStore 持久化 + commands.ts 入口 + 落入文档任意位置 待启动
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
- 状态：阶段 1 已完成（2026-06-15，4 个抽象 + 双侧测试 + AppShell 迁移示范 1 处）；阶段 2 全面迁移其他模块（OCR pageRange / SecurityPanel error / 导出 units）待启动
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
- 状态：阶段 1 已完成（2026-06-16，PM 单 session TDD，readPdfMetadata + writePdfMetadata + 10 测试，Producer 字段 pdf-lib 限制 → DEC-109 阶段 2 用 Rust lopdf 解决）；阶段 2 PropertiesDialog UI + commands.ts 入口 + Producer 真覆盖 待启动
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

### ISS-073 v0.2 阶段 2 "PDF Expert 页面布局"完整对齐路线图（差距追踪）

- 优先级：P0（v0.2 顶层目标，wrap ISS-059/060 阶段 2 + ISS-065 持续）
- 类型：UI 信息架构 / 整体 polish / 路线图
- 状态：路线图（不直接交付，作为差距追踪 + 阶段 2 ISS 入口）
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

- 2026-06-16：完成 ISS-072 阶段 1 PDF 文档属性读写层（DEC-109）。PM 单 session TDD 第 3 个 ISS。`readPdfMetadata(pdfBytes)` + `writePdfMetadata(pdfBytes, updates)` + `PdfMetadata { title, author, subject, keywords[], producer, creator, creationDate, modDate, pageCount, isEncrypted }`。Title / Author / Subject / Keywords / Creator / Dates 字段正常通过 pdf-lib API 读写。**Producer 字段 pdf-lib v1.17.1 已知限制**（DEC-109 §决策）：`save()` force override + XMP metadata 双写让 SaveOptions + 字节流 patch 都无法稳定覆盖；本阶段把 "FaroPDF" 标识写入 **Creator** 字段，Producer 真覆盖留阶段 2 用 Rust lopdf 直接编辑 InfoDict。10 测试覆盖：empty/含字段读取 / 写 title / 写 author+keywords / 保留既有字段 / Creator 默认 FaroPDF / Creator 可覆盖 / ModDate 自动更新 / 空 updates / 输出合法 PDF。**全量 977 通过**（+10）。
- 2026-06-16：完成 ISS-070 阶段 1 SignaturePad 手写签名板（DEC-108）。PM 单 session TDD 路径第 2 个 ISS。`SignaturePad` React 组件 + 纯 Canvas API（无外部库）：mousedown→mousemove→mouseup 画笔触 + 多笔画支持 + 清空/保存/取消 3 按钮 + 白底变透明（保存前 getImageData 把 R/G/B > 250 像素 alpha 置 0）+ onSave 回调 PNG data URL。8 测试覆盖：默认渲染 / width-height 可控 / 单笔画 strokeCount / 多笔画 / 清空 reset / 保存 toDataURL + onSave / 取消 onCancel / mouseleave 中止笔画。**全量 966 通过**（+8）。阶段 2 待启动：FormsPanel 集成 + signatureStore localStorage 持久化 + commands.ts forms-sign-handwrite + 落入文档任意位置 UI。
- 2026-06-16：完成 ISS-067 阶段 1 矩形遮罩涂黑算法（DEC-107）。PM 单 session TDD 路径（DEC-106 multi-agent 退役后第一个 ISS）。`applyRedaction(pdfBytes, regions): Promise<Uint8Array>` + `RedactionRegion { pageIndex, x, y, width, height, color? }`，用 pdf-lib drawRectangle 在指定 pageIndex 区域绘制不透明矩形（默认黑色 rgb(0,0,0)）覆盖原内容。**真不可恢复**（不是 PDF annotation，是 content stream 直接绘制）。10 测试覆盖：单页单矩形、多页多矩形、跨页同 pageIndex、默认黑色、自定义 hex 颜色、空 regions、越界 pageIndex 抛错、负数 pageIndex、非法 color、负数 width/height。**全量 958 通过**（+10）+ typecheck/lint/cargo check 全绿。后续 ISS-067 阶段 2 接 AppShell + commands.ts + RedactionOverlay 拖矩形 UI + 去页眉页脚。
- 2026-06-16：Wave A 5-worker multi-agent 实战**完全失败**（详见 DEC-106）。spawn 全 5 worker + paste-buffer 投递 prompt 成功，但 90 分钟内 0 commit / 0 文件 / 仅 2 worker 写出 STATUS bootstrap。System load 持续 14-17 严重过载（8 核机器跑 5 claude REPL + 既有 tmux session），permission prompt 重复弹出阻塞 worker，paste-buffer 时序坑（4 个 worker 首次 paste 在 REPL 没就绪时丢失，需要 PM 手动 second paste），ISS-072 触发 autocompact 37%。**决策**：multi-agent 在 FaroPDF 本机环境退役（双 Wave 8 worker 尝试全失败）；ISS-067/070/062-stage2/066/072 改 PM 单 session 顺序推进。5 worker prompt 保留在 `/tmp/iss-*-worker-prompt.md` 供下次 PM 直推参考。Skill 改进建议（paste-buffer 时序 / permission auto-accept / load-cap / worker envelope 文档）记入 skill follow-up。
- 2026-06-15：登记 ISS-073 v0.2 阶段 2 "PDF Expert 页面布局"完整对齐路线图。整理 PDF Expert audit 揭露的剩余差距按 5 桶分类：桶 1（P0 页面布局：多 Tab + 右栏真实内容）；桶 2（P0 律师场景：遮罩 / 去水印 / OCR 出目录 / 真实加密）；桶 3（P1 表单+扫描+视觉）；桶 4（P1 ISS-071 阶段 2 迁移）；桶 5（P2 元数据）。推进策略 Wave A/B/C 按依赖 + 风险排序。Wave A 5 个 ISS 阶段 1（ISS-067/070/062/066/072）是窄 scope + 互不冲突 + 适合 multi-agent。
- 2026-06-15：完成 ISS-071 阶段 1（4 个工程基础设施抽象，DEC-105）。**m1 pageRange DSL** `parsePageRange(input, totalPages) → number[]` 支持 all/even/odd/N/范围/反向/混合 + 12 测试；**m2 units** `convertLength(value, from, to)` pt/cm/mm/in 互转 TS + Rust 双侧 + 12 TS + 12 Rust 测试；**m3 naming** `suggestOutputName(name, suffix)` 18 个 OutputSuffix 枚举 TS + Rust 双侧 + 12 TS + 8 Rust 测试；**m4 error schema** `AppError { code, message, context }` + 9 个 ErrCode + serde::Serialize TS + Rust 双侧 + 8 TS + 8 Rust 测试。lib.rs 加 `mod util; mod error;`。AppShell.tsx 迁移示范：两个本地命名 helper 改用 `suggestOutputName`。全量 948 通过（+51 新测试）+ cargo 26 测试 + typecheck/lint 全绿。
- 2026-06-15：Wave 1 multi-agent spawn ISS-071 worker 实战失败（详见 DEC-104）。3 个 bug 阻塞：①`.git/main` 孤儿文件导致 `main` ref ambiguous；②`spawn-worker.sh` `<` shell redirect 不被 tmux 展开（需 `bash -lc` 包）；③claude `-p` batch 模式 + 7KB prompt + FaroPDF 大上下文 → autocompact thrash 3 次自动终止。**决策**：取消 Wave 1，ISS-066~072 改 PM 单 session 顺序推进。未来 multi-agent 启用条件提高（小 prompt + 交互式 claude + 窄 scope）。
- 2026-06-15：归档 PDF-Guru 参考项目调研（DEC-103）。新立 ISS-066~072 律师场景刚需 + 工程基础设施任务卡。**P0 候选**：ISS-067（证据遮蔽 + 去页眉页脚）、ISS-068（去水印）、ISS-069（OCR 自动出目录）。**P1**：ISS-066（扫描清洁校正）、ISS-070（签名手写板）、ISS-071（页码 DSL / 单元转换 / 文件命名 / 错误 schema 抽象）。明确不引入 PyMuPDF（AGPL-3.0 传染风险），所有实现 Rust / TypeScript 独立重写。
- 2026-06-15：完成 code review cce1ce5..HEAD 4 个 commit（DEC-102）+ push origin/main。3 个 P0 安全 bug + 5 个 P1 hooks/UI + 1 个被错放 P2 的核心交互 bug（rightPanel useState→useMemo）+ 5 个 P2 polish 全部修复。新增 SecurityPanel.test.tsx 7 + RightPanel.test.tsx +2 测试覆盖。907 单测通过 + 1 pre-existing zoom 失败。
- 2026-06-15：完成 ISS-060 / ISS-061 / ISS-064 阶段 1 集成（详见 DEC-101）。`RightPanel` 接入 AppShell 按 activeMode 推导内容；`TextSelectionToolbar` 接入 `usePdfTextSelection` hook 真选区，5 启用 + 2 disabled 占位；`SecurityPanel` 接入 utility panel slot，`export-set-password / export-remove-password` 命令进入导出模式打开面板，`remove_pdfpassword` Rust 命令注册到 `invoke_handler!` 并能用 lopdf 真实解密；新增 3 个测试（commands 1 + AppShell 2），typecheck / lint / 全量单测 897 通过 / cargo check 17 warnings（pre-existing）全部 0 回归。
- 2026-06-15：完成 ISS-062 阶段 1（内置图章 5→9 + diagonal 对角斜条带形态）。`PdfStampName` 扩 4 个（forReview / notForDistribution / internalOnly / proprietary），`PdfStampShape` 加 `diagonal`，`PdfAnnotationStamp.image` 字段为阶段 2 自定义图章预留；stamps.test.ts 12/12 通过；阶段 2 自定义上传 tab + 缩略图渲染留下次推进。
- 2026-06-15：登记 DEC-100 修正 DEC-099 与 Cargo 现实矛盾——HEAD 上 Cargo.toml = 0.1.2 但 lock = 0.1.1 本就不同步，working tree lock 升 0.1.2 是修复同步，应保留，DEC-099 "撤回 Cargo.lock" 条款作废。
- 2026-06-15：登记 ISS-056 / 057 / 058 + 综合评估段。`computer-use` skill 调研结论：当前走 `osascript + System Events` 是"路径 B 最轻量"路线，能用但会动真实鼠标；Codex 那种"独立光标 + 不抢焦点"靠的是 AXPress 优先 + 自绘覆盖层 / MCP 代理。给出三条升级路径（A 自改 / B 装第三方 MCP / C 学官方 quickstart 架构）暂缓入队，综合评估不互斥、A 最轻先做、B/C 安全风险需评估。
- 2026-06-09：完成 ISS-055。针对用户继续反馈的多层级菜单与整体简洁问题，收口顶栏任务模式入口：`OCR / 批注 / 填写和签名 / 导出` 统一进入 `工具` 工作流启动器，顶栏只保留阅读和全局入口；切入后继续显示对应上下文工具条或工作台。
- 2026-06-09：完成 ISS-054。深色模式作为 `设置 > 常规` 的外观偏好接入，默认浅色、旧设置缺字段回退浅色；切换深色后根节点写入 `data-theme="dark"` 并套用深色 token，不新增顶栏、二级工具条或工具启动器入口，PDF 纸面内容保持不反相。
- 2026-06-09：完成 ISS-053。页眉页脚继续保持工具启动器 / 原生菜单深层入口，不进入导出二级工具条；右侧交付设置面板新增页眉 / 页脚各自的左 / 中 / 右视觉位置选择器，导出时映射到上方 / 下方 watermark placement，并继续与奇偶页范围共存。
- 2026-06-09：完成 ISS-052。左侧文档摘要缩略图的批注 / 搜索命中 / OCR 状态改为紧凑视觉标记，保留 `aria-label` 和 `title` 辅助说明；状态提示继续停留在左侧摘要，不进入顶栏、二级工具条或工具启动器。
- 2026-06-09：完成 ISS-051。`页眉页脚` 继续保持工具启动器 / 原生菜单深层入口，不进入导出二级工具条；右侧交付设置面板新增 `全部页面 / 奇数页 / 偶数页` 应用范围，奇偶页通过 `PdfWatermarkOperation.pageIndexes` 传给导出引擎，无匹配页面时阻止导出并提示。

较早进度日志已迁移到 `docs/DECISIONS.md` 的 DEC-083。
