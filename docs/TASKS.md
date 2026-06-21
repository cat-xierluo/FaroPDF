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

### ISS-073 v0.2 阶段 2 "PDF Expert 页面布局"完整对齐路线图（差距追踪）

- 优先级：P0（v0.2 顶层目标，wrap ISS-059/060 阶段 2 + ISS-065 持续）
- 类型：UI 信息架构 / 整体 polish / 路线图
- 状态：路线图（不直接交付，作为差距追踪 + 阶段 2 ISS 入口）；部分 ship — panelWidthStore localStorage 持久化（DEC-121）+ AppShell 集成读宽度（DEC-131 即将 ship）
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

## ISS-NEW-A ~ F：v0.2 PDF Expert 工具栏 + tab 全量对齐（基于 2026-06-20 截图复核）

> 立项依据：研究 `research/pdf-expert/FEATURE_CATALOG.md`（含 §0 顶层架构 5 层分层 + §1.2 tab 位置 + §1.3 toolbar 5 段 + §2 L4 二级工具条 + §3 L5b 右栏 + §4 菜单栏 + §7.1/7.2 批注工具 + §9 多 tab）后，发现 ISS-059 (DEC-142 / adcd8f0) 的 tab bar 位置错误 + 整个 Toolbar 偏离 PDF Expert 5 段布局，需要从 PDF Expert 视角重新拆分 v0.2 收口工作。

### ISS-NEW-A Toolbar 5 段布局重构（L2 + L3 一票否决）

- 优先级：P0（v0.2 阻塞）
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §0 / §1.2 / §1.3；截图 01 / 20 / 30 / 61 / 63 / 80
- 状态：**阶段 1 已完成（2026-06-21，commit `5b2b285` / DEC-144 / Wave 1 W1 worker ship + rebase FF merge）；阶段 2 待启动**
- 范围：
  1. **L2 行 1**：`<TitlebarTabs>` 上移到 `<Toolbar>` **上方**作为独立行（修复 ISS-059 位置错误）— ✅ 阶段 1 完成
  2. **L3 行 2**：`<Toolbar>` 重构为 5 段（sidebar toggles / file / reading / mode / right）— ✅ 阶段 1 完成
  3. **左区**：4 个 sidebar toggle 图标（缩略图 / 大纲 / 批注 / 书签），对齐 PDF Expert L3 左区 — ⏳ 阶段 2（侧栏按钮已有 3 个，缺「书签」）
  4. **文件区**：打开按钮保持（已是 icon-only）— ✅ 阶段 1 完成
  5. **阅读区**：**瘦身到 4 元素** — 页码跳转 + 视图模式 4-icon toggle + 缩放% + -/+（**当前 10 元素超载**）— ⏳ 阶段 2（视图模式 toggle 已切，旋转/适合页面 6 个按钮还在 L3 段，留 ISS-NEW-B）
  6. **模式切换区**：恢复「A 批注」「T 编辑」按钮（**当前缺失**，被 `工具` 启动器吸收）— ✅ 阶段 1 完成
  7. **右区**：搜索 / 工具 / 设置保持 — ✅ 阶段 1 完成
  8. **视图模式呈现**：combobox → 4-icon toggle（保持 viewMode 算法不变）— ✅ 阶段 1 完成
  9. **`工具` 启动器仍保留**：作为 macOS 系统菜单 + 深层功能入口（ISS-055 不撤销），但**主模式入口**回到 L3 模式按钮 — ✅ 阶段 1 完成
- 关键文件：
  - `src/components/layout/Toolbar.tsx`（重构 5 段 + A/T 按钮 + 视图模式 4-icon toggle）— ✅ 阶段 1
  - `src/components/layout/TitlebarTabs.tsx`（位置修正 — 已在 AppShell 集成中移至 Toolbar 上方）— ✅ 阶段 1
  - `src/components/layout/AppShell.tsx`（集成 L2 上移 + Toolbar 5 段）— ✅ 阶段 1
  - `src/components/layout/types.ts`（新增 `AppToolbarSectionId`）— ✅ 阶段 1
  - `src/components/layout/Toolbar.css`（新建 — 5 段 grid + 视图模式 toggle 样式）— ✅ 阶段 1
  - `src/components/layout/Toolbar.test.tsx`（新建 5 段 / A/T / 4-icon toggle 测试）— ✅ 阶段 1
  - `src/components/layout/AppShell.test.tsx`（5 段结构 + TitlebarTabs 位置断言）— ✅ 阶段 1
- 验收：
  - [x] L2 tab bar 在 toolbar 上方独立行 — 阶段 1 验证
  - [x] L3 toolbar 严格 5 段（DOM 结构 / data-section 属性）— 阶段 1 验证
  - [ ] 阅读区只有 4 元素（页码 + 视图模式 4 图标 + 缩放% + -/+）— 阶段 2 + ISS-NEW-B
  - [x] 视图模式 4 图标 toggle（不是 combobox）— 阶段 1 验证
  - [x] 「A 批注」「T 编辑」按钮在 L3 第 4 段（点击切换 activeMode）— 阶段 1 验证
  - [x] `工具` 启动器仍然存在（ISS-055 不动）— 阶段 1 验证
  - [ ] 960×720 Playwright 实操：上传 PDF → tab 上方显示 / toolbar 5 段对齐 / 视图模式 4 图标可见 / A/T 模式按钮可见 — 阶段 2 验证（pre-existing vitest 环境问题修复后跑）
  - [x] 全部既有测试通过 + 新增 5 段结构测试 — 阶段 1 验证（typecheck pass，vitest 待 pre-existing 环境修复后跑）

- 阶段 1 收口（2026-06-21 / DEC-144）：
  - 6 files / +664 / -36 / 1 commit
  - Wave 1 W1 worker ship（独立 worktree `feat/iss-new-a-l2-tabbar`）→ rebase onto `e296211` → FF merge 到 main
  - W2 worker（ISS-NEW-G）按 memory contingency graceful kill 释放 MiniMax 配额
  - 已知限制：`npm test -- --run` / `npm run lint` / `npm run build` / `cargo check` 未运行（pre-existing vitest 4.x + `html-encoding-sniffer`/`@exodus/bytes` ESM 冲突，main 仓库根也复现，与本次改动无关）

### ISS-NEW-B 阅读辅助按钮下移 L4 二级工具条

- 优先级：P1
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §1.3 + §2；截图 04 / 05 / 06
- 状态：待启动；依赖 ISS-NEW-A
- 范围：
  1. 把当前 L3 阅读控制区的 6 个额外按钮（逆时针 / 顺时针 / 适合页面）下移到 L4 二级工具条
  2. 「适合页面」/「实际大小」也可走 macOS 视图菜单（FEATURE_CATALOG §4 视图菜单）
  3. Toolbar 阅读区瘦身到 4 元素（详见 ISS-NEW-A 第 5 项）
- 验收：
  - [ ] L3 阅读区无旋转 / 适合页面按钮
  - [ ] L4 二级工具条出现旋转（逆 / 顺）+ 适合页面（在「适合宽度」模式下隐藏）
  - [ ] macOS 视图菜单「实际大小」「适合页面」可用

### ISS-NEW-C 右侧 mode-driven panel 体系（L5b）

- 优先级：P0（v0.2 阻塞）
- 类型：UI 信息架构 / 侧栏
- 来源：FEATURE_CATALOG §3；截图 20 / 36 / 50 / 53 / 55 / 57-60 / 61-multi-tab-opened-2nd
- 状态：**✅ 已完成**（Wave 2 W1 / DEC-146 / PR #67）。文档摘要 + OCR 状态 2 个 panel 落地；形状/搜索右栏归 ISS-NEW-I。
- 范围：完整 `<RightPanel>` 组件 + `rightPanelMode` 状态，按触发切换内容：
  | 触发 | 内容 | 状态 |
  | --- | --- | --- |
  | 阅读默认 | 折叠 | ✅ 等价 |
  | 批注 / 形状 | 颜色选择 + 工具切换 + 形状选择（矩形/椭圆/箭头/双向/直线/铅笔）+ 线条宽度 + 透明度 + 边框/填充色 | ❌ 缺 |
  | 签名 | 手写签名缩略图列表 | ✅ ISS-070 |
  | 图章 | 标准 2×2 + 自定义 tab | ✅ ISS-062 |
  | OCR / 扫描 | 状态 + 页码范围 + 开始按钮 | ⚠️ 模式 toolbar 有，右栏缺 |
  | 搜索 | 命中列表 + 上下导航 + 回到第 1 项 | ❌ 当前是 popover，需迁 L5b |
  | 文档摘要 | 文件信息缩略图 + 元数据 | ❌ 缺（截图 61 显示 PDF Expert 双 tab 时右栏是文档摘要） |
- 验收：
  - [ ] 形状工具右栏：6 形状选择 + 宽度滑块 + 透明度滑块 + 边框/填充色块（对齐截图 57-60）
  - [ ] 搜索右栏：命中列表 + 上下导航 + 回到第 1 项（对齐截图 36）
  - [ ] 文档摘要右栏：文件信息 + 元数据（对齐截图 61）
  - [ ] OCR 模式右栏：状态 + 页码范围 + 开始按钮（对齐截图 53）
  - [ ] 旧 popover / utilityPanel 平滑迁移

### ISS-NEW-D macOS 菜单栏中文化补齐

- 优先级：P2
- 类型：菜单栏 / i18n
- 来源：FEATURE_CATALOG §4；截图 37 / 38 / 39 / 40
- 状态：**defer**（Wave 3 W2 撞 GLM 配额耗尽 2056 未启动，留下一 Wave）；部分已建（ISS-032 文件/编辑/视图/窗口/帮助菜单）；依赖现有 nativeMenuBridge
- 范围：补齐「批注」「编辑 PDF」「扫描」「前往」4 个菜单的中文化 + Tauri 桥接
  - 批注：高亮 / 下划线 / 删除线 / 文本 / 笔 / 橡皮擦 / 便签 / 形状 / 链接 / 内容表
  - 编辑 PDF：编辑 / 添加图像 / 添加链接 / 添加文字 / 隐藏
  - 扫描：增强扫描 / 扫描至可搜索 / OCR 文字 / 调整为可搜索
  - 前往：首页 / 末页 / 上一页 / 下一页 / 历史记录 / 返回
- 验收：
  - [ ] 4 个菜单的中文 label 与快捷键正确
  - [ ] 菜单触发后调起对应 action（批注/扫描需对应 ISS-NEW-A / ISS-NEW-C）
  - [ ] 全部命令在 `commands.ts` 注册

### ISS-NEW-E L4 模式二级工具条统一抽象

- 优先级：P1
- 类型：UI 信息架构 / Toolbar
- 来源：FEATURE_CATALOG §2；截图 20 / 21 / 53 / 56 / 80 / 81
- 状态：部分已实现（OcrModeToolbar / TextSelectionToolbar）；依赖 ISS-NEW-A
- 范围：`<ModeSecondaryToolbar>` 组件按 `activeMode` 切换内容：
  - 阅读：空
  - 批注：高亮 / 下划线 / 删除线 / 文本 / 笔 / 橡皮擦 / 便签 / 形状 + 颜色选择
  - 编辑：插入页（5 子菜单：占位 / 来自文件 / 来自扫描 / 空白页 / 位置选择）+ 删除 + 提取 + 旋转（逆 / 顺）+ 撤销 / 重做 + 移动 / 复制
  - 扫描：扫描切边 / 增强扫描 + 页码范围 + 开始按钮
- 验收：
  - [ ] L4 二级工具条按 activeMode 切换内容
  - [ ] 阅读模式不渲染 L4
  - [ ] 编辑模式 L4 显示「插入页」下拉 + 删除/提取/旋转 + 撤销/重做 + 页数
  - [ ] OCR 模式 L4 显示扫描切边/增强扫描 + 页码范围 + 开始

### ISS-NEW-F tab 拖离窗口剥离 + 跨窗口状态共享

- 优先级：P3（v0.2 收尾）
- 类型：UI 信息架构 / Tauri IPC
- 来源：FEATURE_CATALOG §9；截图 30 / 80-83
- 状态：未启动；依赖 ISS-NEW-A + ISS-NEW-E
- 范围：
  1. tab drag detach 手势（拖到窗口外 → 创建新窗口）
  2. Tauri `WebviewWindow` 新建 IPC
  3. 文档句柄表（多窗口共享同一文档状态）
  4. 跨 tab 拖页（截图 81）：编辑模式下从 tab A 拖页到 tab B
- 验收：
  - [ ] tab 拖离窗口外 → 新窗口创建并接管该 tab
  - [ ] 新窗口能继续读取文档
  - [ ] 编辑模式跨 tab 拖页：拖到目标 tab 的 drop zone 触发移动/复制
  - [ ] 多窗口共享 recentFiles / annotations

### ISS-NEW-G Welcome 屏 + 状态栏语言切换 + Preferences 字段对齐

- 优先级：P2
- 类型：UI 信息架构 / 空态 / i18n / 设置
- 来源：FEATURE_CATALOG §5.3 / §5.4 / §5.5；截图 13-preferences / 50 / 53 / 61-multi-tab-opened-2nd / 63-tab-bar-zoomed
- 状态：**部分完成**（DEC-149 Welcome 屏 + DEC-151 状态栏语言切换已落地）；Preferences 字段 / OCR 状态栏 / 全量字符串 i18n / languageEvent emit defer（PM 单 session 推进，provider 不稳不开 worker）。
- 范围：
  1. **Welcome 屏**（无 PDF 时）：3 段布局
     - 顶部「转换」区：2 张卡片「图片转 PDF」「Word 转 PDF」
     - 中部「打开 PDF 文档」：大蓝色「选择文件」按钮
     - 底部「最近」区：4 张最近文件缩略图网格 + 右上「清除最近」链接
  2. **状态栏语言切换**：底部 toggle（English / 简体中文），与 `appSettings.language` 联动
  3. **OCR 模式底部状态**：光标位置 + 状态文字
  4. **Preferences 字段对齐**：默认 PDF 查看应用 / PDF Expert 打开方式 / 关闭文档时的保存方式 / 作者 / 回到页面 / 页码指示符
- 验收：
  - [ ] Welcome 屏 3 段布局（截图 63 对齐）
  - [ ] 「图片转 PDF」「Word 转 PDF」入口可点击（依赖 OCR pipeline / merge engine）
  - [ ] 「最近」网格渲染最近 4 个文件缩略图
  - [ ] 「清除最近」按钮一键清空 recentFiles
  - [ ] 状态栏语言 toggle 切换后所有 UI 文字立即更新
  - [ ] Preferences 字段 6 项与 PDF Expert 对齐

### ISS-NEW-H 视图菜单 + 批注菜单 submenu 深度补全

- 优先级：P2
- 类型：菜单栏 / nativeMenuBridge
- 来源：FEATURE_CATALOG §4 二审补全（2026-06-20）；截图 33 / 37 / 39
- 状态：未启动；依赖 ISS-NEW-D（菜单栏中文化补齐）
- 范围：
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
- 验收：
  - [ ] 视图菜单 12+ 项全实现，含 3 个 submenu
  - [ ] 批注菜单 9+ 项全实现，形状 submenu 6 选项
  - [ ] 扫描菜单 5 项，4 档质量 submenu
  - [ ] 全菜单 ⌘ 快捷键与 PDF Expert 对齐

### ISS-NEW-I 编辑模式页面网格 + 形状工具右栏 6 段 + 搜索右栏 + L3 模式附加按钮

- 优先级：P0（与 ISS-NEW-A / C 并行）
- 类型：UI 信息架构 / 模式 / 右栏 / L3 toolbar
- 来源：FEATURE_CATALOG §2.1 + §3 + §1.3.1 + §1.3.2 三审补全（2026-06-20）；截图 50 / 59 / 65 / 67 / 69 / 80 / 81 / 83
- 状态：**✅ 已完成**（Wave 2 W2 / DEC-147 / PR #68）。EditModeGridView 5 列网格 + ShapeToolPanel 6 段 + SearchResultsPanel 4 段 + Toolbar L3 模式附加按钮落地；OCR L3「开始/增强扫描」按钮因 commands.ts 未暴露 AppCommandId 暂缓（合理降级，后续 worker 补）；真实形状绘制/跨 tab IPC 接 placeholder。
- 范围：
  1. **T 编辑模式页面网格视图**：
     - PDF 内容区从单页流式改为 5 列缩略图网格
     - 选中页：蓝边框 + label 显示页面尺寸（如「A4 (210×297 毫米)」）
     - 拖动重排：水平 / 垂直 drop indicator（截图 69）
     - 跨 tab 拖页：drag-monitor-fixture tab 在底栏显示「drop monitor」状态（截图 81）
     - 与现有 `PageOrganizerWorkspace`（ISS-046）的关系：T 编辑模式可复用其 grid 组件
  2. **L4 工具条命令补全**：
     - 编辑模式 L4：8 命令（插入页 5 子菜单 / 删除 / 提取 / 旋转双向 / 移动 / 复制 / 撤销 / 重做 / 页数 + 尺寸）
     - 扫描模式 L4：5 区段（扫描切边 / 增强扫描 / 页码 - / + / 输入范围 / 页数显示）
     - 批注模式 L4：8 工具（书签 / 高亮 / 下划线 / 删除线 / 文本 / 笔 / 橡皮擦 / 便签 / 形状）
  3. **L5b 形状工具右栏 6 段**（ISS-NEW-C 子任务）：
     - 形状选择（6 形状 2×3 网格：矩形 / 椭圆 / 箭头 / 双向箭头 / 直线 / 铅笔）
     - 线条工具（实线 / 虚线 2 切换）
     - 线条宽度滑块（1 像素）
     - 不透明度滑块（100%）
     - 边框色（7 色块：灰 / 黑 / 红 / 橙 / 黄 / 绿 / 蓝）
     - 填充色（7 色块 + 透明）
  4. **L5b 搜索右栏**（ISS-NEW-C 子任务）：
     - Header：「已找到 N 项」
     - 输入框 + X 关闭
     - 命中列表：每行 Line N: 文本（关键词高亮）
     - Footer：「回到第 1 项」按钮 + 页码导航 2/2
  5. **L3 模式附加按钮**：
     - 扫描模式激活后 L3 第 4 段插入「增强扫描」「开始」按钮
     - L3 右区搜索框常驻（含 X 关闭）
     - 底部 status bar 持久显示「已找到 N 项」
  6. **图章 / 形状 / 自定义双 tab**：右栏形状 tab 包含「形状」「自定义」2 个 sub-tab
- 验收：
  - [ ] T 编辑模式 PDF 内容区是 5 列网格（截图 80 / 81 / 83 对齐）
  - [ ] 编辑模式 L4 8 命令全实现
  - [ ] 扫描模式 L4 5 区段全实现
  - [ ] 形状工具右栏 6 段（截图 59 对齐）
  - [ ] 搜索右栏 4 段（截图 41 对齐）
  - [ ] L3 模式附加按钮就位
  - [ ] 全部组件 Playwright 960×720 实操验证

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
- **UI 信息架构 / 导出面板**：ISS-039、ISS-040、ISS-041、ISS-042
- **跨仓协调**：personal-site `ISS-005`（Folio 仓 PR-A / FaroPDF 仓 PR-B 联动，FaroPDF 仓侧见 DEC-058 docs-only 同步）
- **跨仓交付**：personal-site `ISS-001~012`（仓 `cat-xierluo/cat-xierluo.github.io`，v0.1.0-alpha.8 + i18n + 微信二维码真实化 + URL 去 subpath + Legal Skills 集成已落定；FaroPDF 仓侧不重复登记，详见 `docs/TASKS.md` § 推进策略 > 跨仓任务边界 + DEC-072）

需要恢复为活跃任务时，先在 `docs/DECISIONS.md` 的归档条目下加"恢复"标注，再回到本文件新增任务卡。

## 进度日志

- 2026-06-17：完成 review follow-up 修复（DEC-140）：ISS-067 `regionsScreenToPdf` 透传 `color`，补回归测试防止白 / 灰遮蔽最终回退为默认黑色；ISS-064 `SecurityPanel` 用户密码留空文案改成"无需密码即可打开副本"，不再暗示可沿用旧用户密码。
- 2026-06-17：完成 ISS-067 阶段 2 后续 RedactionOverlay UI 细化。nextColor state + 3 颜色芯片（黑/白/灰，律师场景：黑色涂黑 / 白色擦除 / 灰色模糊），颜色仅作用于后续 commit 的 region（已 commit 不变）。新增撤销按钮 + 单 X 删除按钮（X 按钮 pointerEvents:auto 不冒泡触发 overlay 拖动）。**全量 1206/1207 通过**（+5 新测试）。复用 DEC-107 applyRedaction 算法 + DEC-132 redactPageMargins 算法，零算法层变更。
- 2026-06-17：完成 ISS-071 阶段 3 error.ts → SecurityPanel AppError 端到端迁移（DEC-138）。Rust set/remove_pdfpassword 改返 `Result<_, AppError>` 替代 `Result<_, String>`，错误码映射：NotSupported / FileNotFound / InvalidInput / PdfParseError / DecryptionError / IoError，context 携带脱敏 path（DEC-102 P0-1）。调整 remove_pdfpassword 校验顺序：空密码 → 文件存在 → canonicalize → load（用户友好）。前端 SecurityPanel `friendlyMessageForCode(err: AppError)` helper，9 个 ErrCode 各有中文兜底文案（i18n 后续可按 code 切英文）。`normalizeError` 兼容旧 string 错误（code=Unknown, message=原串）。**全量 1206/1207 通过**（+4 新前端测试）。ISS-071 累计 75 测试 / 3 commit 全部 ship。
- 2026-06-17：完成 ISS-064 阶段 2 真实 PDF 加密（DEC-139 + DEC-135 决策更新）。**DEC-135 决策纠偏**：原计划升级 lopdf 0.34 不可行（0.34 仍无 encrypt API + 0.34.0 pom_parser 自带编译 bug + 0.33 没 pdf_writer feature），实际升级到 lopdf 0.41（含完整 V4 128-bit AES 加密 API）。`set_pdfpassword` 真实实现：`EncryptionState::try_from(EncryptionVersion::V4 { ... })` + `Aes128CryptFilter` + `doc.encrypt(&state)`，输出 `<stem>-secured.pdf` 新副本；自动补缺失的 `/ID`（某些工具导出 PDF 缺 /ID，lopdf 加密算法强制要求）。权限组合：PRINTABLE | COPYABLE | ANNOTABLE | FILLABLE | ASSEMBLABLE。SecurityPanel set 模式激活（按钮 disabled={loading || !ownerPwd}），复用 DEC-138 normalizeError。**真实 AES 加密 round-trip 测试**：构造 PDF → set 密码 → decrypt 验证 user_password 正确。**cargo test 97/97**（+1 新测试；原 90 → 96 → 97 累加）+ **npm test 1208/1209**（+5 累计，pre-existing zoom 唯一失败 DEC-099 已知）。
- 2026-06-17：完成 ISS-072 阶段 2 后续 阶段 3 前端 PropertiesDialog 集成 set_pdf_producer（DEC-137）。PropertiesDialog 只读 fieldset 内新增「用 FaroPDF 真覆盖 Producer (Rust 后端)」按钮 + 成功 / 错误反馈行；inputFilePath 缺失（浏览器拖拽场景）或未传 onProducerOverride 回调时按钮不渲染。AppShell.handleProducerOverride 接 document.path → invoke set_pdf_producer → 反馈回填到 dialog，错误用 alert role + 命令反馈双通道（与 SecurityPanel handleRemovePassword 同模式）。**全量 1198/1199 通过**（+6 UI 测试；唯一失败 useReaderController zoomIn/zoomOut 是 pre-existing，DEC-099 已知）。**ISS-072 累计 30 测试 / 4 commit** 全部 ship（DEC-109 10 + DEC-116 9 + DEC-136 5 + DEC-137 6）。设计决策：把 Rust 路径拆为独立按钮，不和 pdf-lib「保存元数据」confirm 联动，理由是输出位置不同（Rust 写源目录、pdf-lib 走浏览器下载）合成会让用户困惑。复用 DEC-136 Rust set_pdf_producer（lopdf InfoDict 真覆盖）+ DEC-102 P0-3 输出副本碰撞保护 + DEC-109 pdf-lib Producer 限制绕道。CHANGELOG / DECISIONS / TASKS 三处同步。
- 2026-06-16：完成 ISS-070 阶段 2 + ISS-060 阶段 2 第二步签名持久化（DEC-113）。新增 `signatureStore.ts` localStorage 持久化（save/list/delete + 上限 4 + 损坏数据兜底 + 9 测试）+ `SignaturePanel.tsx`（缩略图列表 + 「+ 新画签名」按钮弹 SignaturePad + 删除 + 错误提示 + 9 测试）。`RightPanel` 扩 signatures panel 接入 SignaturePanel（annotate/forms 模式可用），同时 stamps panel 扩到 forms/export 模式让律师表单签字时也能盖业务章。AppShell 注入 `onSelectSignature` 回调：annotate 模式把 signature.image 当 custom stamp 落点；forms 模式反馈提示。**全量 1028 通过**（+20 新测试）+ typecheck/lint 全绿。阶段 3 FormsPanel 真集成 + commands.ts 入口 + 落入文档任意位置 UI 待启动。
- 2026-06-16：完成 ISS-060 阶段 2 第一步 + ISS-062 阶段 3 集成（DEC-112）。RightPanel 从 skeleton placeholder → **真实渲染 CustomStampPanel**（annotate + stamps 模式）。AppShell 接 `onSelectCustomStamp` → `annotationArmed`：用户从右栏选自定义图章立即 set `activeToolType="stamp"` + `stampName="custom"` + `stampLabel` + `stampImage` → 画布可点按落点。`AnnotationToolState` 加 `stampImage?: string` 字段（base64 data URL）。RightPanel 测试 +2（annotate+stamps 真渲染 / 非 annotate 不渲染）。**全量 1008 通过**（+1 测试，CustomStampPanel 与 RightPanel 共用 test-id 测试稳定）。这是 PDF Expert 风格右栏的首次真实内容接入；后续 ISS-060 阶段 2 第二/三/四步接 SignaturePad（forms+signatures）/ 标准图章 grid 增强 / OCR 队列简版 / 导出预览简版。
- 2026-06-16：完成 ISS-062 阶段 2 自定义图章上传 + 持久化（DEC-111）。**Wave A 5/5 完成**。`customStampStore` localStorage 持久化（saveCustomStamp / listCustomStamps / deleteCustomStamp / 上限 4 张 FIFO 强制 + 损坏数据兜底过滤 + 10 测试）+ `CustomStampPanel` React 组件（2×2 缩略图网格 + 上传 PNG/JPG ≤ 1MB + 删除按钮 + 错误提示 + 上限禁用 + 9 测试 含 FileReader prototype mock）。**全量 1007 通过**（+19）。**Wave A 累计**：5 个 ISS 阶段 1 全部 ship（067/070/072/066/062-stage2），988 → 1007 共 +29 测试，~2.5 小时纯 PM 单 session TDD。阶段 3 集成到 RightPanel + commands.ts 入口待启动。
- 2026-06-16：完成 ISS-066 阶段 1 扫描拆双页 + 网格切 + 自定义断点切算法（DEC-110）。PM 单 session TDD 第 4 个 ISS（**Wave A 4/5 完成**）。`splitPagesByGrid(pdfBytes, { rows, cols, pageIndexes? })` 按 N×M 网格切每页 → 输出 N×M 倍页数；`splitPagesByBreakpoints(pdfBytes, { pageIndex, horizontalBreaks?, verticalBreaks? })` 按自定义断点切单页。**真切**（不是只改 cropbox）：用 pdf-lib `embedPage` + `drawPage` 平移 offset 让目标子矩形落入新 page (0,0)~(cellW,cellH) 区域。11 测试覆盖：1×2 拆双页 / 2×2 网格切 / 子页尺寸 / pageIndexes 限定（只切指定页其他保留）/ rows=0 / cols=0 / pageIndexes 越界 / 1 水平断点 / 1 横+1 纵 / 不切 / 断点越界。**全量 988 通过**（+11）。
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
