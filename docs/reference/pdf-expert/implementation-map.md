# FaroPDF 当前实现映射

本文件回答“代码现在真实做到哪一步”。它不分配任务；任务状态和顺序以 `docs/TASKS.md` 的 ISS-NEW-M 为准。

## Surface 映射

| Surface / workflow | 主要代码 | 当前等级 | 已知事实 | 升级前必须完成 |
| --- | --- | --- | --- | --- |
| L2 tabs | `TitlebarTabs.tsx` | `wired` + `geometry/density-verified` | 40px 中性深色 titlebar、多 tab、关闭和新增入口已存在 | accepted-golden 图像比较；补 overflow、拖动和跨窗口证据 |
| L3 toolbar | `Toolbar.tsx`、`Toolbar.css` | `wired` + `geometry/density-verified` | navigation/zoom/workflows/collaboration/search 五段的 x/width 与 40px 层高已验证 | accepted-golden 图标/字体/响应式视觉 diff；逐控件行为复核 |
| L4 read | `AppShell.tsx` | `wired` + `geometry-verified` | read 不渲染 L4 | 补可靠 read golden；视图菜单真实动作单独验收 |
| L5 column order | `workspaceLayout.ts`、`AppShell.tsx`、`app.css` | `wired` + `geometry-verified` | DOM 顺序和中央弹性列已验证；搜索态 273/767/240 双栏 measured | 其他双栏组合、精确宽度和动画仍 missing |
| L5a sidebar | `Sidebar.tsx`、`AnnotationSidebar.tsx` | `wired`，部分行为已有 | reader thumbnail API 可用；大纲 measured 态的图标标签栏、标题、空态与 272px 宽度已接线 | 左栏 thumbnails/annotations/bookmarks 的完整状态与 accepted-golden 视觉 diff |
| Read canvas | reader module / canvas components | `behavior-complete` 的部分能力 + `geometry/density-verified` | PDF.js 阅读、页码、缩放已存在；single 只渲染当前页，50% 运行态页面 bbox 对齐 48% reference | 两页态可靠参考；accepted-golden 页面内容与主题 diff |
| Search | search module、`SearchResultsPanel.tsx` | `wired` + `geometry/density-verified`，部分行为已有 | L3 查询打开 240px L5b 结果栏；273/767/240 三列与按页分组结果已接线 | accepted-golden 字体/命中高亮；零结果/关闭/状态保持逐态复核 |
| Annotate | annotation module、`AnnotationToolbar.tsx`、`AnnotationToolbar.css` | `wired` + geometry-coarse-verified（ISS-NEW-N-P06） | overlay 和多种批注能力存在；G03 大纲/L4/单页 measured 几何与 active 蓝反馈已接线 | accepted-golden、工具/可选右栏联动、保存重开和视觉验证 |
| Text selection | `TextSelectionToolbar.tsx` | `skeleton/wired` 混合 | 部分动作接线；翻译仍为 placeholder 文本 | 可靠 selection 证据；所有按钮真实行为或显式 YAGNI |
| Edit canvas | `AppShell.tsx`、`Sidebar.tsx`、ReaderCanvas | `skeleton` + M2 geometry/semantic-verified | L3 与原生菜单统一进入独立 `edit` mode；G05 的 272px 大纲、1008px 中央区、整窗居中单页和文本/图像/链接/隐藏 L4 已验证；未接通工具显式禁用 | 接 PDF 内容编辑引擎、选择态、撤销、写回副本和重开验证 |
| Page organizer | `PageOrganizerWorkspace.tsx`、pages module | `wired/behavior-complete` 的部分能力 + `geometry/density-verified` | 独立 `pages` mode；5 张 PDF canvas 缩略图、首卡选中与 measured 卡片 bbox 已验证 | 拖拽重排写回、完整 undo、导出和重开；禁用/移除剩余 placeholder 动作 |
| Legacy edit grid | `EditModeGridView.tsx/.css` | `deprecated skeleton` | 已从 AppShell 运行时卸载；仍保留空白渐变、硬编码 A4 和 noop callback 的历史组件 | M3 确认无调用方后删除，不能再作为 edit/pages 规格源 |
| Right panel shell | `RightPanel.tsx` | `skeleton/wired` 混合 | mode-driven 容器和多个 panel 组件存在 | 按 panel 逐项验收，不能以容器存在代表内容完成 |
| Document summary | `RightPanel.tsx` | `skeleton` | AppShell 传入 `docSummary={null}` | 接真实文档数据和空/加载/错误态 |
| OCR status panel | `RightPanel.tsx`、`OcrStatusPanelView.tsx` | `skeleton` | `onStartOcr={() => undefined}`，组件注释明确 placeholder | 接 OCR controller、队列、取消和结果 |
| Shape panel | `RightPanel.tsx` | `skeleton/wired` | controlled placeholder 已存在 | 先校准 R12 语义，再接真实 shape state 和绘制 |
| Signature panel | `SignaturePanel.tsx`（forms/ui）、`signatureStore.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P01） | 列表/存储/落点链路存在；点击后选中蓝描边（--selection） | 参考状态精确宽度、落点动画、保存重开和视觉验证 |
| Stamp panel | `StampPanel.tsx`（stamp/ui）、`CustomStampPanel.tsx`、`stamps.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P04） | 统一面板：标准/自定义 tab + 响应式网格（9 模板）+ 选中蓝 | stamp 落点几何、精确 2×2 断点、custom 上传完整闭环和视觉验证 |
| Welcome | `WelcomeScreen.tsx`、`AppShell.tsx` | `skeleton/wired` 混合 | welcome UI 存在；图片/Word 转换入口曾是反馈占位 | 只保留真实入口；按 R14 重采规范化 golden |
| Forms | forms module / `FormsPanel`、`AppShell.tsx` | `wired`，部分 behavior-complete | 字段读取/填写/扁平化底座存在；无证据的 forms→shape 默认 fallback 已移除 | 补 forms 可靠参考图、状态矩阵和 round-trip |
| Export | export module / `ExportDeliveryPanel` | `wired/behavior-complete` 的部分能力 | 多项导出能力存在 | export 参考态缺失；逐工具真实输出和视觉验证 |

## 明确的 placeholder / noop

以下内容在清理当日仍能从代码直接检出，任何相关任务不得标记完成：

- `EditModeGridView.tsx`：已卸载的历史 skeleton，仍含空白缩略图、硬编码 A4、placeholder 回调说明。
- `AppShell.tsx`：内容编辑 L4 明确禁用；`docSummary={null}`；`onStartOcr={() => undefined}`。
- `PageOrganizerWorkspace.tsx`：真实插入/合并/提取等能力与若干视觉计数 placeholder 并存，不能整体标记 behavior-complete。
- `RightPanel.tsx` / `OcrStatusPanelView.tsx`：OCR placeholder；shape controlled placeholder。
- `TextSelectionToolbar.tsx`：翻译占位文本。
- Welcome 图片/Word 转换若仍只设置 command feedback，则属于 toast-only。

## 验证器能力

| 验证 | 能证明 | 不能证明 |
| --- | --- | --- |
| typecheck / unit tests | 类型和局部逻辑 | 真实 UI、视觉、完整工作流 |
| build | 可打包前端 | 功能可用 |
| `verify:ui-layout` | 双视口 L2/L3/L5 结构、edit/pages 独立模式入口 | 参考产品像素视觉一致、重排写回 |
| `verify:pdf-expert-visual` | 73 项 measured reference 门禁：分层/横向几何、页面 bbox/count、G05 编辑大纲/中央画布、页卡 bbox/真实 canvas、搜索双栏、状态栏与 surface 语义 | accepted-golden 像素一致、未采集状态和业务写回 |
| 截图人工看图 | 当前画面 | 可重复阈值和回归稳定性 |
| 未来 visual diff | accepted-golden 范围内的视觉回归 | 未采集状态和业务正确性 |

## 状态更新规则

实现 Agent 只能升级自己负责的行，并在 TASKS、RESULT/PR 和本文件给出同一组证据。没有证据时降级，不使用“基本完成”“已接线所以完成”等模糊词。
