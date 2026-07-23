# PDF Expert 复刻验收合同

## 完成状态

| 状态 | 定义 | 能否关闭 UI 复刻任务 |
| --- | --- | --- |
| `skeleton` | 组件、入口、静态面板或演示数据存在 | 否 |
| `wired` | 入口与真实 state/controller 连接；无 noop、toast-only 或不可达分支 | 否 |
| `behavior-complete` | 主流程可操作，保存/导出后能验证真实结果 | 否 |
| `visually-verified` | behavior-complete，并通过 accepted-golden 的几何、视觉 diff 和交互验收 | 是 |

`geometry-verified` 是验证标签，不是第五种完成状态。它只说明某些 DOM 顺序和宽度断言通过，不能把 `wired` 自动升级为 `visually-verified`。

出现以下任一情况时，状态最高只能是 `skeleton`：

- `noop`、`TODO`、`placeholder`、`等待后续 worker`；
- 只显示 toast，没有改变文档或应用状态；
- 使用其他 mode 冒充目标 mode；
- 使用空白渐变、硬编码 A4 或演示缩略图冒充真实页面；
- 只有单元测试或几何测试，没有真实应用行为验证；
- 参考截图、状态或异常路径为 `missing`，但任务卡把对应 surface 写成完成。

## 证据门禁

1. `rejected` 图片不得参与实现决策。
2. `raw` 图片只能支持可见事实，不能支持精确尺寸、颜色、断点或未显示的交互。
3. 精确 CSS/布局规格必须来自 `measured` 或 `accepted-golden`。
4. 当前 accepted-golden 数量为 0，因此整个高保真复刻仍未达到 `visually-verified`。
5. 任何新 golden 必须遵守 `golden/README.md` 的准入规则。
6. M1 的 reference-vs-reference 稳定性 diff 只负责参考证据准入；M2 的 FaroPDF-vs-reference diff 才负责产品视觉回归。

## 已通过的代码几何门禁

`scripts/verify-pdf-expert-layout.mjs` 当前只验证：

- L3 的五个语义 section 映射到五个 CSS Grid 列并保持单行；
- read 不渲染 L4；
- L5 DOM 顺序为 L5a → L5c → L5b；
- 无侧栏时 L5c 占满 workspace；
- `T 编辑` 进入 edit workspace，而不是 forms。

以下内容没有通过该脚本验证：

- PDF Expert 的主题、颜色、字号、间距、图标、窗口 chrome；
- 左右栏在参考产品中的精确宽度；
- 缩略图内容、卡片尺寸和响应式断点；
- 页面重排是否写回、导出和重开；
- raw capture 与 FaroPDF 的像素/感知差异。

## Edit 专项门禁

- 不得再写“固定 5 列”。R15 在其捕获窗口内明确呈现首行 4 页、次行 1 页；精确窗口 crop 和断点尚未量测。
- 网格必须基于可用宽度响应式排列，并在 measured spec 形成后固定最小卡片宽度、gap 和断点。
- 每张卡必须渲染真实页面缩略图和真实页面尺寸；空白渐变与硬编码 A4 只能算 skeleton。
- 不得增加参考状态中没有证据的局部工具条或说明行；确需 FaroPDF 差异时必须在 DESIGN 和 DECISIONS 记录。
- 拖动重排只有在页面顺序写入真实操作状态、导出副本并重新打开验证后，才能达到 `behavior-complete`。

## PR / 交付门禁

任何涉及 AppShell、Toolbar、TitlebarTabs、Sidebar、RightPanel、EditModeGridView 或全局布局 CSS 的交付必须附：

1. 使用的 capture id、证据等级和明确未推断事项。
2. 两种以上 viewport 的几何 JSON；涉及响应式网格时还要覆盖断点两侧。
3. 目标状态的应用截图；存在 accepted-golden 后必须附视觉 diff。
4. typecheck、聚焦测试、build 和实际启动结果。
5. placeholder/noop/toast-only 列表及其 TASKS 状态。
6. 交付等级及升级理由。

不满足时保持任务未完成，不能用“后续优化”关闭验收项。
