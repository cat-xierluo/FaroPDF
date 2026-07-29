# PDF Expert 状态矩阵

本矩阵只记录当前受版本控制证据能够证明的事实。证据等级采用 manifest.json 的最新重分级（2026-07-24）；补采 measured 仍不是 accepted-golden：

- `raw-Aminus`：可作面板/对话框级实现 wireframe + 关键 bbox 粗估；仍未 crop 到窗口、未做 reference-vs-reference 稳定性 diff。
- `raw-B`：只证实目标状态出现过或排除反例，不能给精确尺寸、间距或断点。
- `raw-B-low-confidence`：B 级内容但语义不确定；仅可作负面证据。
- `raw-C`：误标或与目标状态不符，不可作基线。
- `measured`：已固定窗口并完成 window-only crop、人工量测和 a/b 稳定性 diff；2026-07-28 的 M2.1 S4 审计通过不自动升级证据等级，仍需按 M1 完成复采准入与 golden 裁决。
- `missing`：现有 raw 不覆盖，必须补采（按 `coverage-gap.md` 的 ISS-NEW-N-* 子卡归档）。
- `YAGNI`：用户明确决定不做。

## Mode × surface

| mode | L3 模式区 | L4 | L5a 左栏 | L5c 中央区 | L5b 右栏 |
| --- | --- | --- | --- | --- | --- |
| read | `A 批注`、`T 编辑` 可见；measured N-CROP-READ-DEFAULT。搜索态完整 L3：measured N-CROP-L3-SEARCH | 未见二级工具条；measured N-CROP-READ-DEFAULT / N-CROP-L3-SEARCH | 默认折叠；大纲展开与搜索态同屏：measured N-CROP-L3-SEARCH | 单页阅读画面；measured N-CROP-READ-DEFAULT / N-CROP-L3-SEARCH | 默认折叠；搜索态结果栏：measured N-CROP-L3-SEARCH |
| read + two-page | missing：R03 是 raw-C，未显示两页 | missing | missing | missing：需重新进入双页并规范化采集（ISS-NEW-N-CROP 顺带补） | missing |
| read + thumbnails | **missing：页面管理并非左栏缩略图**；measured N-PAGE-MANAGEMENT-GRID 仅证明整页网格 | missing | missing：需真实缩略图列表、当前页和滚动态（ISS-NEW-N-THUMB） | page-flow 预期保留，但缺同屏证据 | missing |
| annotate | measured N-ANNOTATE-TOOLBAR | measured N-ANNOTATE-TOOLBAR：批注上下文工具条 | measured N-ANNOTATE-TOOLBAR：大纲面板 | measured N-ANNOTATE-TOOLBAR：单页 | absent/collapsed：基础状态没有右栏；signature/stamp/shape 属于显式子状态 |
| annotate + shape | measured N-SHAPE-RECTANGLE | measured N-SHAPE-RECTANGLE | measured N-SHAPE-RECTANGLE：大纲 | measured N-SHAPE-RECTANGLE | measured N-SHAPE-RECTANGLE：矩形工具 6 段样式控件 |
| annotate + signature | raw-Aminus R08：右侧签名面板 header `签名` + `+`、竖排签名卡（首张蓝描边） | raw-Aminus R08 | missing | 页面可见；raw-Aminus R08 | raw-Aminus R08：竖排 7 张签名卡 |
| annotate + stamp | raw-Aminus R11：右侧 `标准/自定义` tab + 2×2 preset 网格 | raw-Aminus R11 | missing | 页面可见；raw-Aminus R11 | raw-Aminus R11：tab×2 + 2×2 preset |
| edit | measured N-EDIT-CANVAS：编辑入口可见 | measured N-EDIT-CANVAS：文本/图像/链接/隐藏 | measured N-EDIT-CANVAS：272pt 大纲左栏，且大纲 tab 激活 | measured N-EDIT-CANVAS：单页编辑画布；页面卡片网格另见 N-PAGE-MANAGEMENT-GRID | 默认未见；measured N-EDIT-CANVAS |
| OCR | OCR 入口可见；raw-Aminus R10：`扫描和文本识别` 段展开次级工具条 5 项 | raw-Aminus R10：次级工具条（增强扫描/拆分/裁剪/清除/识别文本） | missing | 页面预览在 modal 背后；raw-Aminus R10 | raw-Aminus R10：5 段结构（header/预览/说明/语言下拉/主按钮） |
| forms | missing | missing | missing | missing | missing |
| export | missing | missing | missing | missing | missing |
| modal: password | raw-Aminus R09：center modal + 半透明遮罩 + 2 row + 2 action，焦点蓝描边 | — | — | — | — |
| welcome / no document | 工具栏状态 raw-B R14；区段顺序粗证（转换/打开/最近） | YAGNI：无文档不应出现文档工具 | 不适用 | 转换、打开 PDF、最近文件；raw-B R14（legacy intended annotation summary 与实际不符） | 不适用 |

## 正交状态

| state | absent | present | 证据与结论 |
| --- | --- | --- | --- |
| document | welcome | PDF shell | raw-B R14 / raw-B R02；均未规范裁剪 |
| left panel | 中央区使用左侧空间 | 左栏位于中央区左侧 | raw-B R02 / raw-B R04 / measured N-CROP-L3-SEARCH；仅证明大纲面板，不证明缩略图（依赖 ISS-NEW-N-THUMB） |
| right panel | 中央区使用右侧空间 | 右栏位于中央区右侧 | raw-B R02 / raw-B R06 / measured N-CROP-L3-SEARCH / raw-Aminus R08 / raw-Aminus R11 / raw-B-low-confidence R12 |
| both panels | missing | measured：大纲 + 搜索结果栏同屏 | N-CROP-L3-SEARCH 证明一个真实双栏组合；其他 annotate/shape 双栏仍 missing，不能泛化（依赖 ISS-NEW-N-CROP） |
| search keyword | 结果栏折叠 | 命中列表和页面高亮 | measured N-CROP-L3-SEARCH；R06 仅 raw-B |
| text selection | 无浮层 | missing | 本轮真实文字层框选未出现浮条；R07 与本轮探索图都不能证明目标状态（依赖 ISS-NEW-N-SEL） |
| tabs | 单 tab | 多个 tab | raw-B R02 / raw-Aminus R13（3 tabs）/ raw-Aminus R15（4 tabs）；overflow、拖动均 missing |
| modal | 无背板 | 居中 modal + 背板 | raw-Aminus R09（password）/ raw-Aminus R10（OCR） |
| view mode | 单页可见 | two-page missing | raw-C R03 不能证明双页 |
| page management grid | page-flow | 页面卡片网格 | measured N-PAGE-MANAGEMENT-GRID；raw R02/R13/R15 仅作历史辅助。与 edit canvas 是独立状态；列数断点、拖动和写回仍 missing |

## 交互证据

| 交互 | 状态 | 证据 / 下一动作 |
| --- | --- | --- |
| hover / focus / disabled | missing | 同一控件四态尚未采集；R09 仅证 password input focus 蓝描边 |
| 点击 `A 批注` | raw-Aminus partial | R11 证明 annotate 工具条出现 + pen active 蓝；进入/退出时序未证 |
| 点击 `T 编辑` | measured result | N-EDIT-CANVAS 证明大纲左栏 + 单页内容编辑画布 + 文本/图像/链接/隐藏 L4；真实编辑行为仍 missing |
| 点击 `页面管理` | measured result | N-PAGE-MANAGEMENT-GRID 证明 5 张真实页卡单排 + 页面操作 L4；转换时序、拖拽和写回仍 missing |
| 页卡选择 | raw-Aminus | R15 有蓝色选中态；焦点和取消选择 missing |
| 页卡拖动开始 / 进行中 | missing | 需要页面管理专属的源卡透明态、drop indicator 和光标位置；不依赖 Sidebar thumbnails 或 shape 证据 |
| 页卡 drop 后 | raw result only | R15 不能证明顺序已写入 PDF；必须导出并重开 |
| 搜索导航 | measured partial | N-CROP-L3-SEARCH 证明搜索字段、上一项/下一项控件、2 条结果和页面高亮；清空、零结果、稳定键盘导航仍 missing |
| 签名选择与落点 | raw-Aminus partial | R08 证竖排卡 + 首张选中蓝；插入行为、save/reopen missing |
| 图章选择与落点 | raw-Aminus partial | R11 证 2×2 preset + tab×2；插入行为、custom tab 内容 missing |
| 形状激活与右栏样式 | measured | N-SHAPE-RECTANGLE 证明矩形激活态和右栏控件顺序；绘制、保存和其他形状仍 missing |
| OCR 开始 / 取消 / 队列 | raw-Aminus partial | R10 证设置面板 + 主按钮；loading/progress/failed/cancelled 全部 missing |
| 密码模态完整闭环 | raw-Aminus partial | R09 证 UI；validation error / loading / success 态 missing |

## 转换约束

以下仅是实现目标；没有证据的转换继续标记 missing；A-/B 级证据只支撑面板级骨架，不支撑像素级转换动画。

1. `read → annotate`：目标为挂载批注工具并保留页面位置；进入/退出时序仍 missing，但**结果态骨架由 raw-Aminus R11 粗证**（工具条顺序 + pen active 蓝）。
2. `read + outline → edit canvas`：目标为保留 272pt 大纲左栏与单页阅读画布，并挂载文本/图像/链接/隐藏 L4；结果态由 measured N-EDIT-CANVAS 证明，真实内容编辑和写回仍 missing。
3. `read → page management`：目标为切换到独立页面卡片网格；结果态由 measured N-PAGE-MANAGEMENT-GRID 证明，拖拽、写回和重开仍 missing。此转换与 `read → edit canvas` 独立。
4. `read → annotate + signature`：`read → annotate → 打开右栏签名`：raw-Aminus R08 粗证竖排签名卡 + 首张选中蓝；精确面板宽度和打开动画 missing。
5. `read → annotate + stamp`：同上，raw-Aminus R11 粗证。
6. `read → annotate + OCR`：raw-Aminus R10 粗证 OCR 右面板 5 段 + 次级工具条 5 项。
7. 打开 L5a：代码几何门禁要求 L5a → L5c；左侧大纲 measured 近似宽度 272pt，其他左栏 surface 仍需独立证据。
8. 打开 L5b：代码几何门禁要求 L5c → L5b；搜索 240pt、shape 380pt 是 surface-specific，其他右栏宽度和动画 missing。
9. 同时打开两栏：N-CROP-L3-SEARCH 已证明“大纲 + 中央画布 + 搜索结果”这一组合；其他双栏组合不能据此泛化。
