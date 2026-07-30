# FaroPDF 当前实现映射

本文件回答“代码现在真实做到哪一步”。它不分配任务；任务状态和顺序以 `docs/TASKS.md` 的 ISS-NEW-M 为准。

## Surface 映射

| Surface / workflow | 主要代码 | 当前等级 | 已知事实 | 升级前必须完成 |
| --- | --- | --- | --- | --- |
| L2 tabs | `TitlebarTabs.tsx` | `wired` + `geometry/density-verified` | 40px 中性深色 titlebar、多 tab、关闭和新增入口已存在 | accepted-golden 图像比较；补 overflow、拖动和跨窗口证据 |
| L3 toolbar | `Toolbar.tsx`、`Toolbar.css` | `wired` + `geometry/density-verified` | 五段结构已验证；协作区只提供真实“摘要/导出与交付”；未实现 T 编辑显式禁用 | 继续逐控件行为复核；视觉 diff 为可选优化 |
| L4 read | `AppShell.tsx` | `wired` + `geometry-verified` | read 不渲染 L4 | 补可靠 read golden；视图菜单真实动作单独验收 |
| L5 column order | `workspaceLayout.ts`、`AppShell.tsx`、`app.css` | `wired` + `geometry-verified` | DOM 顺序和中央弹性列已验证；搜索态 273/767/240 双栏 measured | 其他双栏组合、精确宽度和动画仍 missing |
| L5a sidebar | `Sidebar.tsx`、`AnnotationSidebar.tsx` | `wired`，部分行为已有 | reader thumbnail API 可用；大纲 measured 态的图标标签栏、标题、空态与 272px 宽度已接线 | 左栏 thumbnails/annotations/bookmarks 的完整状态与 accepted-golden 视觉 diff |
| Read canvas | reader module / canvas components | `behavior-complete` 的部分能力 + `geometry/density-verified` | PDF.js 阅读、页码、缩放已存在；single 只渲染当前页，50% 运行态页面 bbox 对齐 48% reference | 两页态可靠参考；accepted-golden 页面内容与主题 diff |
| Search | search module、`SearchResultsPanel.tsx` | `wired` + `geometry/density-verified`，部分行为已有 | L3 查询打开 240px L5b 结果栏；273/767/240 三列与按页分组结果已接线 | accepted-golden 字体/命中高亮；零结果/关闭/状态保持逐态复核 |
| Annotate | annotation module、`AnnotationToolbar.tsx`、`AnnotationOverlay.tsx` | `behavior-complete`（形状纵向闭环）+ geometry-coarse-verified | 12 类批注；shape state/样式、当前页 bbox、PDF 坐标、sidecar 重开和扁平副本已实测；G03 大纲/L4/单页 measured 几何与 active 蓝反馈已接线 | 其余辅助命令、异常态与 accepted-golden 视觉优化 |
| Text selection | `TextSelectionToolbar.tsx` | `wired`，部分能力 planned | 批注、复制、朗读有真实动作；翻译服务未接入并显式 disabled | 接真实翻译 provider，或维持 planned |
| Edit canvas | `AppShell.tsx`、`Sidebar.tsx`、ReaderCanvas | `planned` + M2 geometry/semantic-verified | 内容编辑引擎未接入；L3 和原生命令均 fail-closed，不再进入假编辑态 | 接 PDF 内容编辑引擎、选择态、撤销、写回副本和重开验证 |
| Page organizer | `PageOrganizerWorkspace.tsx`、pages module | `behavior-complete`（核心）+ `geometry/density-verified` | 真实缩略图、选择/多选、拖拽、旋转、删除、撤销和 execute 导出已接线；产物重开确认 5 页/90° | 页面复制粘贴、真实尺寸标签和更多异常态 |
| Legacy edit grid | `EditModeGridView.tsx/.css` | `deprecated skeleton` | 已从 AppShell 运行时卸载；仍保留空白渐变、硬编码 A4 和 noop callback 的历史组件 | M3 确认无调用方后删除，不能再作为 edit/pages 规格源 |
| Right panel shell | `RightPanel.tsx` | `skeleton/wired` 混合 | mode-driven 容器和多个 panel 组件存在 | 按 panel 逐项验收，不能以容器存在代表内容完成 |
| Document summary | `RightPanel.tsx` | `wired` | AppShell 从当前 PDF bytes、页数和 metadata 派生摘要 | 补更丰富 metadata 与错误态 |
| OCR status panel | `RightPanel.tsx`、`OcrStatusPanelView.tsx` | `wired` | 当前任务状态、进度、错误和页码范围接真实 OCR controller | Tauri GUI 下继续验收 provider/权限错误态 |
| Shape panel | `RightPanel.tsx`、`ShapeToolPanel.tsx`、annotation module | `behavior-complete` | 六类形状与 stroke/fill/opacity 共用真实 state；Playwright 绘制、刷新恢复、overlay/canvas bbox 和 2/2 PDF 扁平化通过 | accepted-golden 只作可选视觉优化；继续补极端尺寸/旋转页异常态 |
| Signature panel | `SignaturePanel.tsx`（forms/ui）、`signatureStore.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P01） | 列表/存储/落点链路存在；点击后选中蓝描边（--selection） | 参考状态精确宽度、落点动画、保存重开和视觉验证 |
| Stamp panel | `StampPanel.tsx`（stamp/ui）、`CustomStampPanel.tsx`、`stamps.ts` | `wired` + geometry-coarse-verified（ISS-NEW-N-P04） | 统一面板：标准/自定义 tab + 响应式网格（9 模板）+ 选中蓝 | stamp 落点几何、精确 2×2 断点、custom 上传完整闭环和视觉验证 |
| Welcome | `WelcomeScreen.tsx`、`AppShell.tsx` | `wired` + planned 子项 | 打开/拖放 PDF 真实；图片/Word 转换引擎未接入，卡片明确 disabled | 接转换引擎后再启用 |
| Forms | forms module / `FormsPanel`、`AppShell.tsx` | `behavior-complete`（AcroForm 字段工作流） | 真实 fixture 已从 UI 累计填写、勾选、签名和扁平化下载；重开确认字段值累积、签名 XObject 存在、最终 1 页/0 字段；不覆盖原 PDF | 自由拖放签名位置和异常表单扩展；视觉参考为可选优化 |
| Export | export module / `ExportDeliveryPanel` | `wired/behavior-complete` 的部分能力 | 多项导出能力存在；默认中文文字水印实际输出 5 页有效 PDF | 继续逐工具 round-trip 与错误态 |

## 明确的 planned / 未完成项

以下内容在清理当日仍能从代码直接检出，任何相关任务不得标记完成：

- `EditModeGridView.tsx`：已卸载的历史 skeleton，仍含空白缩略图、硬编码 A4、placeholder 回调说明。
- `AppShell.tsx` / command catalog：内容编辑、部分批注辅助命令、独立缩放工具、重新载入、书签和 OCR 批量增强标记 `availability=planned`，执行层 fail-closed。
- `PageOrganizerWorkspace.tsx`：复制/粘贴在页面剪贴板实现前 disabled；不再增加假计数。
- `TextSelectionToolbar.tsx`：翻译 disabled，不再把原文包装成“翻译结果”写入剪贴板。
- Welcome 图片/Word 转换入口 disabled，不再触发 toast-only feedback。

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
