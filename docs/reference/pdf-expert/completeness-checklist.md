# PDF Expert 截图抽取完整度

当前结果不是合格 catalog，更不是 golden reference。“部分 / raw”仅表示有可用的非最终证据；最终仍需 measured/accepted-golden。

| 检查项 | 当前状态 | 证据 / 缺口 |
| --- | --- | --- |
| L1–L6 layer 覆盖 | 部分 | L2/L3、annotate/edit L4、G05 edit L5a/L5c、shape L5b、搜索 L5a+L5b 双栏已有 measured；左栏真实缩略图、forms/export/OCR L4 和工作流状态栏逐字段仍缺失 |
| macOS 菜单全部展开 | raw 在 ignored research | 未进入受控基线，未复核误触 |
| 每个 mode 的四个 surface | 不通过 | annotate/forms/export/两页/read thumbnails 缺失 |
| widget idle/hover/active/disabled | 不通过 | 未形成同控件四态 |
| empty/loading/success/error | 不通过 | welcome raw；异步状态不完整 |
| 单 tab/多 tab/跨 tab drag | 部分 | 单 tab R02、双 tab R13；overflow/drag missing |
| 模态覆盖 | 部分 | 密码 R09、OCR R10；合并/拆分/属性未纳入 |
| 右栏 mode 覆盖 | 部分 | 搜索与 shape 有 measured；签名、图章有 raw；summary/forms/export/OCR panel 缺可靠 evidence |
| L4 变体 | 部分 | annotate/edit 有 measured；forms/export/OCR 缺可靠证据 |
| 文本选区浮层 | 不通过 | R07 不显示目标状态 |
| 拖动状态 | 不通过 | 没有 drag start/in-progress/drop indicator |
| 状态栏字段 | 不通过 | read/annotate/edit/pages measured 参考态已证明隐藏；OCR 等工作流状态栏尚未逐字段规范化采集 |
| Welcome | raw | R14 可理解结构，但未裁剪/量测 |

## 结论

- 合格项：0/13（按 accepted-golden 标准）。
- 非最终证据覆盖仍不等于完成；特别是 L4/右栏只有少数 surface 达到 measured，不能跨状态借值。
- 在 P0 缺口完成前，不得把本目录描述为 exhaustive catalog 或 golden reference。
