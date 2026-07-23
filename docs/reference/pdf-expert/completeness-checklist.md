# PDF Expert 截图抽取完整度

当前结果不是合格 catalog，更不是 golden reference。“部分 / raw”仅表示有可用的非最终证据；最终仍需 measured/accepted-golden。

| 检查项 | 当前状态 | 证据 / 缺口 |
| --- | --- | --- |
| L1–L6 layer 覆盖 | 部分 | L2/L3/L5b/L6 有 raw；真实缩略图、可靠 L4、双栏缺失 |
| macOS 菜单全部展开 | raw 在 ignored research | 未进入受控基线，未复核误触 |
| 每个 mode 的四个 surface | 不通过 | annotate/forms/export/两页/read thumbnails 缺失 |
| widget idle/hover/active/disabled | 不通过 | 未形成同控件四态 |
| empty/loading/success/error | 不通过 | welcome raw；异步状态不完整 |
| 单 tab/多 tab/跨 tab drag | 部分 | 单 tab R02、双 tab R13；overflow/drag missing |
| 模态覆盖 | 部分 | 密码 R09、OCR R10；合并/拆分/属性未纳入 |
| 右栏 mode 覆盖 | 部分 | 搜索、签名、图章有 raw；shape 不确定，summary/OCR panel 缺失 |
| L4 变体 | 不通过 | edit raw；annotate/forms/export/OCR 缺可靠证据 |
| 文本选区浮层 | 不通过 | R07 不显示目标状态 |
| 拖动状态 | 不通过 | 没有 drag start/in-progress/drop indicator |
| 状态栏字段 | 不通过 | 未逐字段规范化采集 |
| Welcome | raw | R14 可理解结构，但未裁剪/量测 |

## 结论

- 合格项：0/13（按 accepted-golden 标准）。
- 非最终证据部分覆盖：6/13（L1–L6、macOS 菜单、tab、模态、右栏、Welcome）。
- 在 P0 缺口完成前，不得把本目录描述为 exhaustive catalog 或 golden reference。
