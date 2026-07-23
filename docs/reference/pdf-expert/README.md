# PDF Expert 高保真复刻上下文

本目录是 FaroPDF 复刻 PDF Expert macOS 版时唯一有效的视觉证据入口。它保存证据、事实边界、实现映射和验收门禁，但不替代 `docs/TASKS.md` 的任务状态。

## 当前结论

- 目标仍是高保真复刻 PDF Expert 的信息架构、可见布局、模式语义、面板联动和核心工作流。
- 2026-07-23 复核发现：首批 15 张图片中存在多张误标、重复或自动化失败画面。它们已从 `golden/` 降级到 `captures/raw/`，并按实际画面重新命名。
- 当前 accepted golden 数量为 0。任何 Agent 都不得使用“已有 15 张黄金图”作为视觉完成依据。
- `scripts/verify-pdf-expert-layout.mjs` 目前只证明少量几何不变量，不是视觉一致性测试。
- 在完成规范化重采集、窗口裁剪、元素量测和视觉 diff 之前，相关 UI 的最高状态只能是 `behavior-complete`，不能是 `visually-verified`。
- M0 上下文纠偏已完成；下一项只能领取 `docs/TASKS.md` ISS-NEW-M 的 M1 规范化重采集与量测。

## 权威来源分工

任务状态、负责人、依赖和 allowed files 只看 `docs/TASKS.md` 的当前活跃任务，不参与下列证据排序。

视觉与行为事实发生冲突时按以下顺序解释：

1. `acceptance-contract.md`
2. `manifest.json` 中的 `observed_state`、`classification` 和限制说明
3. `state-matrix.md`
4. `docs/DESIGN.md`
5. `implementation-map.md` 中由代码直接证明的实现现状
6. 历史 `docs/DECISIONS.md`、`CHANGELOG.md` 和被忽略的 `research/pdf-expert/`

历史记录只说明“当时做过什么”，不能覆盖当前规范。任何 Agent 如果发现当前 TASKS 与第 1–5 项对目标状态的描述仍相互冲突，必须停止 UI 实现，先把冲突登记到 `docs/TASKS.md`。

## 证据等级

| 等级 | 定义 | 可用于什么 |
| --- | --- | --- |
| `rejected` | 画面与文件名/触发状态不符，或根本不是目标应用画面 | 只能证明采集失败，不得作为 UI 依据 |
| `raw` | 能看出部分目标状态，但包含桌面背景、裁剪不统一或缺少量测 | 只能帮助理解，不能做像素验收 |
| `measured` | 已完成目标窗口裁剪、元素 bbox、尺寸和状态校对 | 可生成实现规格和几何断言 |
| `accepted-golden` | measured，触发步骤可复现，画面与状态矩阵一致，且 reference-vs-reference 稳定性 diff 通过 | 可作为 M2 的产品 visual diff reference 和最终验收基线 |

当前 `manifest.json` 中没有 `accepted-golden`。

## 文件职责

- `captures/raw/`：原始采集。文件名描述实际画面，不再沿用错误的预期状态。
- `golden/README.md`：黄金图准入规则。目录中目前没有已接受图片。
- `manifest.json`：逐图真实观察、可信度、可用范围和禁止推论。
- `state-matrix.md`：mode、surface、交互和转换状态的 evidence / missing / YAGNI 矩阵。
- `acceptance-contract.md`：完成等级、证据门禁和实机验证要求。
- `implementation-map.md`：当前代码组件、真实接线、placeholder/noop 和完成等级。
- `rebuild-guide.md`：后续 Agent 的阅读顺序、依赖顺序和交付格式；任务状态仍以 `docs/TASKS.md` 为准。
- `completeness-checklist.md`：截图抽取完整度检查。
- `coverage-gap.md`：必须补采、补量测或补运行时验证的缺口。
- `s4-verification-report.md`：重建 Agent 反向审计结果。

## Agent 开工门禁

处理 L2–L6、Toolbar、AppShell、Sidebar、RightPanel、EditModeGridView 或模式切换前必须：

1. 阅读本文件、`acceptance-contract.md`、`manifest.json`、`state-matrix.md` 和 `implementation-map.md`。
2. 在 `docs/TASKS.md` 找到明确的活跃子任务、依赖、允许文件和验收证据；没有任务卡不得自行挑一个历史 ISS 开工。
3. 打开与任务有关的图片；不得只读文件名或历史 catalog。
4. 在交付说明中列出使用的 capture id、证据等级和不能从图片推断的内容。
5. 明确交付等级：`skeleton`、`wired`、`behavior-complete` 或 `visually-verified`。
6. 未达到 `visually-verified` 时不得把“高保真复刻”或对应 surface 标记为完成。

## 明确保留的 FaroPDF 差异

- 使用 FaroPDF 品牌，不复制 PDF Expert 商标、专有图标和素材。
- 原 PDF 默认不覆盖；破坏性操作输出副本。
- 联网 OCR 必须知情确认。
- 法律材料隐私、安全、可回退和可交接规则优先。

这些差异不授权随意改变已经被 accepted-golden 证明的信息架构、控件位置、模式语义或交互顺序。
