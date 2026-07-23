# PDF Expert 复刻验收合同

## 完成状态

| 状态 | 定义 | 能否关闭 UI 复刻任务 |
| --- | --- | --- |
| `skeleton` | 组件、入口或静态面板存在 | 否 |
| `wired` | 入口与真实状态/控制器连接；无 noop | 否 |
| `behavior-complete` | 主流程可操作，保存/导出后可验证结果 | 否 |
| `visually-verified` | behavior-complete，并通过真实应用的几何、截图和交互验收 | 是 |

出现以下任一情况时，状态最高只能是 `skeleton`：

- `noop`、`TODO`、`placeholder`、`等待后续 worker`；
- 只显示 toast，没有改变文档或应用状态；
- 使用其他 mode 冒充目标 mode；
- 只有单元测试，没有启动应用验证；
- 参考截图、状态或异常路径仍标记 `missing`，但任务卡没有保留未完成项。

## 第一阶段几何门禁

测试视口：1500×900 和 1280×800。允许测量误差为 2px。

### Read

- L2 在 L3 上方。
- L3 有 5 个 `data-section`，计算后的 CSS Grid 也必须是 5 列。
- L3 保持单行，默认高度约 48px，不能把 right section 自动换到第二行。
- L4 不渲染。
- 默认无 L5a、无 L5b。
- `.workspace__main` 与 `.workspace` 的 x、宽度相同。

### Annotate

- L4 渲染批注工具。
- 默认 L5b 位于 `.workspace__main` 右侧，宽度使用持久化值，默认约 320px。
- 无 L5a 时，`.workspace__main.x === .workspace.x`。
- L5a、L5b 同时出现时，顺序必须是 L5a → L5c → L5b；中央宽度等于 workspace 减去两栏。

### Edit

- 点击 `T 编辑` 后 `aria-pressed=true`。
- 中央区显示 `编辑模式网格`，不是填写签名面板。
- 网格目标为 5 列；空文档状态也必须保留正确模式和工作台语义。
- 拖动重排只有在真实写回页面顺序并可导出验证后才能达到 `behavior-complete`。

## PR / 交付门禁

任何涉及 AppShell、Toolbar、TitlebarTabs、RightPanel 或全局布局 CSS 的交付必须附：

1. 使用的 golden evidence id。
2. 两种 viewport 的 Playwright 几何断言结果。
3. read、annotate、双栏、edit 四张应用截图。
4. typecheck、聚焦测试、build 的实际结果。
5. 所有 placeholder/noop 列表及其任务状态。

不满足时保持任务未完成，不能用「后续优化」关闭验收项。
