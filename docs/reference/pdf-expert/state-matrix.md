# PDF Expert 状态矩阵

本矩阵只记录当前受版本控制证据能够证明的事实。`raw Rxx` 表示原始采集，不能当作精确视觉规格；`missing` 表示必须补采；`YAGNI` 只用于用户明确决定不做的能力。

## Mode × surface

| mode | L3 模式区 | L4 | L5a 左栏 | L5c 中央区 | L5b 右栏 |
| --- | --- | --- | --- | --- | --- |
| read | `A 批注`、`T 编辑` 可见；raw R02 | 未见二级工具条；raw R02 | 默认折叠；raw R02。大纲展开：raw R04 | 单页阅读画面；raw R02 | 默认折叠；raw R02 |
| read + two-page | missing：R03 没有显示两页 | missing | missing | missing：需重新进入双页并规范化采集 | missing |
| read + thumbnails | missing：R04 实际是大纲 | missing | missing：需真实缩略图列表、当前页和滚动态 | page-flow 预期保留，但缺同屏证据 | missing |
| annotate | missing：R05 未进入批注态 | missing：需批注工具完整态 | missing | missing：需 overlay 同屏 | missing |
| annotate + shape | 可能有工具激活；raw R12，语义不确定 | raw R12，内容未量测 | missing | 页面可见；raw R12 | 可能是样式预设；raw R12，不能推导“6 段” |
| edit | 模式/编辑工具可见；raw R13/R15 | 页面命令工具条；raw R13/R15 | missing：未证明 edit 下左栏行为 | 响应式页面卡片网格；R15 在所捕获窗口中为 4+1，不是固定 5 列 | 默认未见；raw R15 |
| OCR | OCR 入口/对话框；raw R10 | missing：R10 是 modal，不足以证明常驻 L4 | missing | 页面预览在 modal 背后；raw R10 | missing：不能把 OCR modal 当作 OCR 右栏 |
| forms | missing | missing | missing | missing | missing |
| export | missing | missing | missing | missing | missing |
| welcome / no document | 工具栏状态未规范化 | YAGNI：无文档不应出现文档工具 | 不适用 | 转换、打开 PDF、最近文件；raw R14 | 不适用 |

## 正交状态

| state | absent | present | 证据与结论 |
| --- | --- | --- | --- |
| document | welcome | PDF shell | raw R14 / R02；均未规范裁剪 |
| left panel | 中央区使用左侧空间 | 左栏位于中央区左侧 | raw R02 / R04；仅证明大纲面板，不证明缩略图 |
| right panel | 中央区使用右侧空间 | 右栏位于中央区右侧 | raw R02 / R06/R08/R11/R12 |
| both panels | missing | missing | 必须补同屏状态，不能用分别出现的两张图拼接推断 |
| search keyword | 结果栏折叠 | 命中列表和页面高亮 | raw R02 / R06 |
| text selection | 无浮层 | missing | R07 没有清晰可见的选区或浮动工具条 |
| tabs | 单 tab | 两个 tab | raw R02 / R13；3+、overflow、拖动均 missing |
| modal | 无背板 | 居中 modal + 背板 | raw R09/R10 |
| view mode | 单页可见 | two-page missing | R03 不能证明双页 |
| edit grid | page-flow | 页面卡片网格 | raw R02 / R15；列数必须响应式，精确断点 missing |

## 交互证据

| 交互 | 状态 | 证据 / 下一动作 |
| --- | --- | --- |
| hover / focus / disabled | missing | 同一控件四态尚未采集 |
| 点击 `A 批注` | missing | R05 采集失败，需重采进入态和退出态 |
| 点击 `T 编辑` | raw | R15 证明结果态，不证明转换时序 |
| 页卡选择 | raw | R15 有蓝色选中态；焦点和取消选择 missing |
| 页卡拖动开始 / 进行中 | missing | 需要源卡透明态、drop indicator 和光标位置 |
| 页卡 drop 后 | raw result only | R15 不能证明顺序已写入 PDF；必须导出并重开 |
| 搜索导航 | raw result only | R06 证明面板存在；上一项、下一项、清空和零结果 missing |
| 签名选择与落点 | missing | R08 只证明列表，不证明插入 |
| 图章选择与落点 | missing | R11 只证明列表，不证明插入 |
| OCR 开始 / 取消 | missing | R10 只证明设置 dialog |

## 转换约束

以下仅是实现目标；没有证据的转换继续标记 missing：

1. `read → annotate`：目标为挂载批注工具并保留页面位置；进入、退出和侧栏保持均 missing。
2. `read → edit`：目标为中央区切换到响应式页卡网格；结果态 raw R15，转换和位置保持 missing。
3. 打开 L5a：代码几何门禁要求 L5a → L5c；参考产品精确宽度 missing。
4. 打开 L5b：代码几何门禁要求 L5c → L5b；参考产品精确宽度和动画 missing。
5. 同时打开两栏：代码已验证 DOM 顺序，但参考产品同屏证据 missing，不能称为视觉对齐。
