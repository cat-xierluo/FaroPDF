# PDF Expert 状态矩阵

每个 cell 必须包含 `evidence`、`missing` 或 `YAGNI`。本矩阵描述参考产品，不等于 FaroPDF 当前实现状态。

## Mode × surface

| mode | L3 模式区 | L4 | L5a 左栏 | L5c 中央区 | L5b 右栏 |
| --- | --- | --- | --- | --- | --- |
| read | `A 批注`、`T 编辑`；evidence G02 | 空；evidence G02 | 默认折叠，可显式打开；evidence G04/G14 | page-flow；evidence G02/G03 | 默认折叠；evidence G02 |
| annotate | 两个模式按钮，批注 active；evidence G05 | 批注工具；evidence G05 | 可保持用户显式状态；missing：切换保持过程 | page-flow + annotation overlay；evidence G05 | 颜色/工具或显式子面板；evidence G08/G11/G12 |
| annotate + shape | 同 annotate；evidence G12 | 批注工具 + shape active；evidence G12 | missing：有无变化 | page-flow + shape preview；missing：拖动中截图 | 6 段形状设置；evidence G12 |
| edit | `T 编辑` active；evidence G15 | 页面编辑命令；evidence G15 | missing：参考产品 edit 左栏状态 | 5 列页面网格；evidence G15 | 页面/拖动上下文；evidence G15，missing：完整字段 |
| ocr / scan | 模式附加动作；evidence G10 | OCR / 扫描工具；evidence G10 | 默认折叠；evidence G10 | page-flow；evidence G10 | 状态、范围、进度、开始；evidence G10 |
| forms | 两个模式按钮 | missing：没有可靠截图 | missing | missing | missing |
| export | 两个模式按钮或导出动作 | missing：参考产品导出态未进入黄金集 | missing | missing | missing |

## 正交状态

| state | absent | present | evidence |
| --- | --- | --- | --- |
| document | welcome / recent documents | L2-L5 + PDF | G01 / G02 |
| left panel | L5c 使用左侧剩余空间 | L5a → L5c | G02 / G04 / G14 |
| right panel | L5c 使用右侧剩余空间 | L5c → L5b | G02 / G06 / G08 / G10 / G11 / G12 |
| both panels | 中央区不换位 | L5a → L5c → L5b | missing：需补同屏黄金截图 |
| search keyword | 搜索结果栏折叠 | 结果列表 + 上下导航 | G02 / G06 |
| text selection | 无浮层 | selection overlay | G07 |
| tabs | 单 tab | 3+ tab | G02 / G13 |
| modal | 无背板 | 居中 modal + 背板 | G09 |
| view mode | continuous | two-page | G02 / G03 |
| edit grid | page-flow | 5 列网格 | G02 / G15 |

## 模式转换约束

1. `read → annotate`：L4 挂载，L5c 保持中央 page-flow，L5b 在右侧出现。
2. `annotate → read`：L4 卸载，默认 L5b 折叠，L5c 重新占用释放空间。
3. `read → edit`：L5c 从 page-flow 切到 5 列网格；`T 编辑` 不得进入 forms。
4. 打开 L5a：只在中央区左侧增加列，不得把 L5c 挤到最后一列。
5. 打开 L5b：只在中央区右侧增加列，DOM 与视觉顺序均为 L5a → L5c → L5b。
