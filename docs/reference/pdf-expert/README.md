# PDF Expert 高保真复刻基线

本目录是 FaroPDF 实现 PDF Expert 信息架构、可见布局和核心交互时的受版本控制基线。它解决原始 `research/pdf-expert/` 被 `.gitignore` 排除后，worker / worktree 看不到截图和规格的问题。

## 目标与边界

- 目标：高保真复刻 PDF Expert 的 L2-L6 布局、模式切换、面板联动、可见状态和核心工作流。
- 允许差异：保留 FaroPDF 名称；不复制 PDF Expert 商标、专有图标和素材；继续遵守原文件不覆盖、联网 OCR 先知情等安全约束。
- 不允许用「FaroPDF 风格」作为随意改变信息架构、控件位置、模式语义或交互顺序的理由。
- 无截图或行为证据的部分必须标记 `missing`；经产品决策明确不做的部分标记 `YAGNI`。两者都不能写成「已完成」。

## 规范优先级

发生冲突时按以下顺序解释：

1. `docs/reference/pdf-expert/acceptance-contract.md`
2. `docs/reference/pdf-expert/state-matrix.md`
3. `docs/DESIGN.md`
4. 当前 `docs/TASKS.md` 任务卡
5. 历史 `docs/DECISIONS.md` 和原始 `research/pdf-expert/FEATURE_CATALOG.md`

历史记录不会自动覆盖当前规范。需要改变基线时，必须同步更新前三项并在 `docs/DECISIONS.md` 写明 supersede 关系。

## 文件

- `manifest.json`：黄金截图的触发动作和状态假设；所有路径都在 Git 跟踪范围内。
- `golden/`：首批关键状态截图，供 worker、视觉对比和 PR review 使用。
- `state-matrix.md`：mode × surface 与正交状态的证据矩阵。
- `acceptance-contract.md`：完成状态、几何门禁和实机验证要求。
- `coverage-gap.md`：未覆盖、无法确认和明确暂缓项。

## Agent 开工前检查

处理 L2-L6、Toolbar、AppShell、RightPanel 或模式切换前必须：

1. 阅读本文件、`state-matrix.md` 和 `acceptance-contract.md`。
2. 打开与任务有关的 `golden/` 截图，不只依赖 TASKS 摘要。
3. 在交付说明中列出使用过的 evidence id。
4. 明确交付等级：`skeleton`、`wired`、`behavior-complete` 或 `visually-verified`。
5. 未达到 `visually-verified` 时不得把 UI 复刻任务标记为完成。

## 当前限制

当前环境未配置 `feature-extract-from-screenshots` 所需的 ZAI bbox MCP，因此本目录先提供人工复核的状态与证据映射；逐元素 bbox 的 `s1-elements.json` 仍是未完成门禁，已登记在 `coverage-gap.md`。
