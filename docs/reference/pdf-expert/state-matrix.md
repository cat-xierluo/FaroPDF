# PDF Expert 状态矩阵

本矩阵只记录当前受版本控制证据能够证明的事实。证据等级采用 manifest.json 的最新重分级（2026-07-23）：

- `raw-Aminus`：可作面板/对话框级实现 wireframe + 关键 bbox 粗估；仍未 crop 到窗口、未做 reference-vs-reference 稳定性 diff。
- `raw-B`：只证实目标状态出现过或排除反例，不能给精确尺寸、间距或断点。
- `raw-B-low-confidence`：B 级内容但语义不确定；仅可作负面证据。
- `raw-C`：误标或与目标状态不符，不可作基线。
- `missing`：现有 raw 不覆盖，必须补采（按 `coverage-gap.md` 的 ISS-NEW-N-* 子卡归档）。
- `YAGNI`：用户明确决定不做。

## Mode × surface

| mode | L3 模式区 | L4 | L5a 左栏 | L5c 中央区 | L5b 右栏 |
| --- | --- | --- | --- | --- | --- |
| read | `A 批注`、`T 编辑` 可见；raw-B R02 | 未见二级工具条；raw-B R02 | 默认折叠；raw-B R02。大纲展开：raw-B R04 | 单页阅读画面；raw-B R02 | 默认折叠；raw-B R02 |
| read + two-page | missing：R03 是 raw-C，未显示两页 | missing | missing | missing：需重新进入双页并规范化采集（ISS-NEW-N-CROP 顺带补） | missing |
| read + thumbnails | missing：R04 实为大纲，无缩略图 | missing | missing：需真实缩略图列表、当前页和滚动态（ISS-NEW-N-THUMB） | page-flow 预期保留，但缺同屏证据 | missing |
| annotate | missing：R05 是 raw-C，未进入批注态 | 工具条顺序粗证：raw-Aminus R11（pen active 蓝） | missing | missing：需 overlay 同屏 | missing：右栏真实布局未证 |
| annotate + shape | **negative only**：raw-B-low-confidence R12（实为 stamp，不是 shape） | raw-B-low-confidence R12 | missing | 页面可见；raw-B-low-confidence R12 | missing：6 段合同无图（ISS-NEW-N-SHAPE） |
| annotate + signature | raw-Aminus R08：右侧签名面板 header `签名` + `+`、竖排签名卡（首张蓝描边） | raw-Aminus R08 | missing | 页面可见；raw-Aminus R08 | raw-Aminus R08：竖排 7 张签名卡 |
| annotate + stamp | raw-Aminus R11：右侧 `标准/自定义` tab + 2×2 preset 网格 | raw-Aminus R11 | missing | 页面可见；raw-Aminus R11 | raw-Aminus R11：tab×2 + 2×2 preset |
| edit | 模式/编辑工具可见；raw-Aminus R13/R15 | 次级工具条 7 项（插入/附加/旋转/复制/粘贴/摘录/删除）：raw-Aminus R13/R15 | missing：未证明 edit 下左栏行为 | 响应式页面卡片网格 4+1：raw-Aminus R15（R15 在所捕获窗口中为 4+1，不是固定 5 列） | 默认未见；raw-Aminus R15 |
| OCR | OCR 入口可见；raw-Aminus R10：`扫描和文本识别` 段展开次级工具条 5 项 | raw-Aminus R10：次级工具条（增强扫描/拆分/裁剪/清除/识别文本） | missing | 页面预览在 modal 背后；raw-Aminus R10 | raw-Aminus R10：5 段结构（header/预览/说明/语言下拉/主按钮） |
| forms | missing | missing | missing | missing | missing |
| export | missing | missing | missing | missing | missing |
| modal: password | raw-Aminus R09：center modal + 半透明遮罩 + 2 row + 2 action，焦点蓝描边 | — | — | — | — |
| welcome / no document | 工具栏状态 raw-B R14；区段顺序粗证（转换/打开/最近） | YAGNI：无文档不应出现文档工具 | 不适用 | 转换、打开 PDF、最近文件；raw-B R14（legacy intended annotation summary 与实际不符） | 不适用 |

## 正交状态

| state | absent | present | 证据与结论 |
| --- | --- | --- | --- |
| document | welcome | PDF shell | raw-B R14 / raw-B R02；均未规范裁剪 |
| left panel | 中央区使用左侧空间 | 左栏位于中央区左侧 | raw-B R02 / raw-B R04；仅证明大纲面板，不证明缩略图（依赖 ISS-NEW-N-THUMB） |
| right panel | 中央区使用右侧空间 | 右栏位于中央区右侧 | raw-B R02 / raw-B R06 / raw-Aminus R08 / raw-Aminus R11 / raw-B-low-confidence R12 |
| both panels | missing | missing | 必须补同屏状态，不能用分别出现的两张图拼接推断（依赖 ISS-NEW-N-CROP） |
| search keyword | 结果栏折叠 | 命中列表和页面高亮 | raw-B R02 / raw-B R06 |
| text selection | 无浮层 | missing | raw-C R07 没有清晰可见的选区或浮动工具条（依赖 ISS-NEW-N-SEL） |
| tabs | 单 tab | 多个 tab | raw-B R02 / raw-Aminus R13（3 tabs）/ raw-Aminus R15（4 tabs）；overflow、拖动均 missing |
| modal | 无背板 | 居中 modal + 背板 | raw-Aminus R09（password）/ raw-Aminus R10（OCR） |
| view mode | 单页可见 | two-page missing | raw-C R03 不能证明双页 |
| edit grid | page-flow | 页面卡片网格 | raw-B R02 / raw-Aminus R13（2 卡 + 次级工具条 7 项）/ raw-Aminus R15（4+1 响应式 wrap）；列数必须响应式，精确断点 missing |

## 交互证据

| 交互 | 状态 | 证据 / 下一动作 |
| --- | --- | --- |
| hover / focus / disabled | missing | 同一控件四态尚未采集；R09 仅证 password input focus 蓝描边 |
| 点击 `A 批注` | raw-Aminus partial | R11 证明 annotate 工具条出现 + pen active 蓝；进入/退出时序未证 |
| 点击 `T 编辑` | raw-Aminus | R15 证明结果态（4+1 grid），不证明转换时序；R13 证明次级工具条 7 项 |
| 页卡选择 | raw-Aminus | R15 有蓝色选中态；焦点和取消选择 missing |
| 页卡拖动开始 / 进行中 | missing | 需要源卡透明态、drop indicator 和光标位置（依赖 ISS-NEW-N-THUMB/SHAPE） |
| 页卡 drop 后 | raw result only | R15 不能证明顺序已写入 PDF；必须导出并重开 |
| 搜索导航 | raw-B | R06 证明面板存在；上一项、下一项、清空和零结果 missing |
| 签名选择与落点 | raw-Aminus partial | R08 证竖排卡 + 首张选中蓝；插入行为、save/reopen missing |
| 图章选择与落点 | raw-Aminus partial | R11 证 2×2 preset + tab×2；插入行为、custom tab 内容 missing |
| 形状激活与右栏样式 | missing | R12 不可用；需 ISS-NEW-N-SHAPE 补采 |
| OCR 开始 / 取消 / 队列 | raw-Aminus partial | R10 证设置面板 + 主按钮；loading/progress/failed/cancelled 全部 missing |
| 密码模态完整闭环 | raw-Aminus partial | R09 证 UI；validation error / loading / success 态 missing |

## 转换约束

以下仅是实现目标；没有证据的转换继续标记 missing；A-/B 级证据只支撑面板级骨架，不支撑像素级转换动画。

1. `read → annotate`：目标为挂载批注工具并保留页面位置；进入/退出时序仍 missing，但**结果态骨架由 raw-Aminus R11 粗证**（工具条顺序 + pen active 蓝）。
2. `read → edit`：目标为中央区切换到响应式页卡网格；结果态由 raw-Aminus R15 粗证（4+1 布局），次级工具条由 R13 粗证 7 项；转换时序和位置保持 missing。
3. `read → annotate + signature`：`read → annotate → 打开右栏签名`：raw-Aminus R08 粗证竖排签名卡 + 首张选中蓝；精确面板宽度和打开动画 missing。
4. `read → annotate + stamp`：同上，raw-Aminus R11 粗证。
5. `read → annotate + OCR`：raw-Aminus R10 粗证 OCR 右面板 5 段 + 次级工具条 5 项。
6. 打开 L5a：代码几何门禁要求 L5a → L5c；参考产品精确宽度 missing（依赖 ISS-NEW-N-CROP）。
7. 打开 L5b：代码几何门禁要求 L5c → L5b；参考产品精确宽度和动画 missing（依赖 ISS-NEW-N-CROP）。
8. 同时打开两栏：代码已验证 DOM 顺序，但参考产品同屏证据 missing，不能称为视觉对齐（依赖 ISS-NEW-N-CROP）。
