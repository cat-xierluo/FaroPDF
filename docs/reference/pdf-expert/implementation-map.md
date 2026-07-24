# FaroPDF 当前实现映射

本文件回答“代码现在真实做到哪一步”。它不分配任务；任务状态和顺序以 `docs/TASKS.md` 的 ISS-NEW-M 为准。

## Surface 映射

| Surface / workflow | 主要代码 | 当前等级 | 已知事实 | 升级前必须完成 |
| --- | --- | --- | --- | --- |
| L2 tabs | `TitlebarTabs.tsx` | `wired` | 多 tab、关闭和新增入口已存在 | 与规范化参考图比较；补 overflow、拖动和跨窗口证据 |
| L3 toolbar | `Toolbar.tsx`、`Toolbar.css` | `wired` + `geometry-verified` | 五个语义 section 和单行 CSS grid 已验证 | 校准图标、密度、顺序、主题、响应式；逐控件行为复核 |
| L4 read | `AppShell.tsx` | `wired` + `geometry-verified` | read 不渲染 L4 | 补可靠 read golden；视图菜单真实动作单独验收 |
| L5 column order | `workspaceLayout.ts`、`AppShell.tsx`、`app.css` | `wired` + `geometry-verified` | DOM 顺序和中央弹性列已验证 | 参考产品双栏同屏、精确宽度和动画仍 missing |
| L5a sidebar | `Sidebar.tsx`、`AnnotationSidebar.tsx` | `wired`，部分行为已有 | reader thumbnail API 可用；大纲/批注等面板存在 | 真实缩略图状态、tab 顺序、宽度、懒加载和视觉 diff |
| Read canvas | reader module / canvas components | `behavior-complete` 的部分能力 | PDF.js 阅读、页码、缩放等已存在 | 逐视图模式与 accepted-golden 对齐；两页态现无可靠参考 |
| Search | search module、`SearchResultsPanel.tsx` | `wired`，部分行为已有 | 查询和结果组件存在 | 零结果/导航/关闭/状态保持 + 视觉验证 |
| Annotate | annotation module、`AnnotationToolbar.tsx`、`AnnotationToolbar.css` | `wired` + geometry-coarse-verified（ISS-NEW-N-P06） | overlay 和多种批注能力存在；active 态已有 --selection 蓝反馈 | 可靠 annotate capture、工具/右栏联动、保存重开和视觉验证 |
| Text selection | `TextSelectionToolbar.tsx` | `skeleton/wired` 混合 | 部分动作接线；翻译仍为 placeholder 文本 | 可靠 selection 证据；所有按钮真实行为或显式 YAGNI |
| Edit page grid | `EditModeGridView.tsx/.css`、`AppShell.tsx` | `skeleton` | 入口存在，但空白渐变、硬编码 A4、额外局部工具条、固定 5 列和 noop reorder 仍在 | 真实缩略图、响应式规则、真实尺寸、写回、导出和重开 |
| Page organizer | `PageOrganizerWorkspace.tsx`、pages module | `wired/behavior-complete` 的部分能力 | 页面操作和导出底座已存在 | 与 `T 编辑` 的单一工作流整合；避免两套网格语义 |
| Right panel shell | `RightPanel.tsx` | `skeleton/wired` 混合 | mode-driven 容器和多个 panel 组件存在 | 按 panel 逐项验收，不能以容器存在代表内容完成 |
| Document summary | `RightPanel.tsx` | `skeleton` | AppShell 传入 `docSummary={null}` | 接真实文档数据和空/加载/错误态 |
| OCR status panel | `RightPanel.tsx`、`OcrStatusPanelView.tsx` | `skeleton` | `onStartOcr={() => undefined}`，组件注释明确 placeholder | 接 OCR controller、队列、取消和结果 |
| Shape panel | `RightPanel.tsx` | `skeleton/wired` | controlled placeholder 已存在 | 先校准 R12 语义，再接真实 shape state 和绘制 |
| Signature panel | `SignaturePanel.tsx`（forms/ui）、`signatureStore.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P01） | 列表/存储/落点链路存在；点击后选中蓝描边（--selection） | 参考状态精确宽度、落点动画、保存重开和视觉验证 |
| Stamp panel | `StampPanel.tsx`（stamp/ui）、`CustomStampPanel.tsx`、`stamps.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P04） | 统一面板：标准/自定义 tab + 响应式网格（9 模板）+ 选中蓝 | stamp 落点几何、精确 2×2 断点、custom 上传完整闭环和视觉验证 |
| Welcome | `WelcomeScreen.tsx`、`AppShell.tsx` | `skeleton/wired` 混合 | welcome UI 存在；图片/Word 转换入口曾是反馈占位 | 只保留真实入口；按 R14 重采规范化 golden |
| Forms | forms module / `FormsPanel`、`AppShell.tsx` | `wired`，部分 behavior-complete | 字段读取/填写/扁平化底座存在；当前 forms→shape fallback 是旧 ISS-NEW-I 行为，不是 `T 编辑` 合同 | 移除/改正旧 fallback；补 forms 可靠参考图、状态矩阵和 round-trip |
| Export | export module / `ExportDeliveryPanel` | `wired/behavior-complete` 的部分能力 | 多项导出能力存在 | export 参考态缺失；逐工具真实输出和视觉验证 |

## 明确的 placeholder / noop

以下内容在清理当日仍能从代码直接检出，任何相关任务不得标记完成：

- `EditModeGridView.tsx`：空白缩略图、硬编码 A4、placeholder 回调说明。
- `AppShell.tsx`：edit reorder TODO；`docSummary={null}`；`onStartOcr={() => undefined}`。
- `RightPanel.tsx` / `OcrStatusPanelView.tsx`：OCR placeholder；shape controlled placeholder。
- `TextSelectionToolbar.tsx`：翻译占位文本。
- Welcome 图片/Word 转换若仍只设置 command feedback，则属于 toast-only。

## 验证器能力

| 验证 | 能证明 | 不能证明 |
| --- | --- | --- |
| typecheck / unit tests | 类型和局部逻辑 | 真实 UI、视觉、完整工作流 |
| build | 可打包前端 | 功能可用 |
| `verify:ui-layout` | L3/L5 几何和模式入口 | L2/L3 顺序、参考产品视觉一致、缩略图、重排写回 |
| 截图人工看图 | 当前画面 | 可重复阈值和回归稳定性 |
| 未来 visual diff | accepted-golden 范围内的视觉回归 | 未采集状态和业务正确性 |

## 状态更新规则

实现 Agent 只能升级自己负责的行，并在 TASKS、RESULT/PR 和本文件给出同一组证据。没有证据时降级，不使用“基本完成”“已接线所以完成”等模糊词。
