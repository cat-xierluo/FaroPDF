# PDF Expert 功能框架与视觉参考上下文

本目录保存 FaroPDF 参考 PDF Expert macOS 版时的证据、事实边界、实现映射和验收门禁，但不替代 `docs/TASKS.md` 的任务状态。

## 当前结论

- 2026-07-30 用户明确不要求像素级一比一复刻；当前目标是信息架构、模式语义、面板联动和核心工作流一一对应。视觉证据只用于可选精修。
- 2026-07-23 复核发现：首批 15 张图片中存在多张误标、重复或自动化失败画面。它们已从 `golden/` 降级到 `captures/raw/`，并按实际画面重新命名。
- 2026-07-24 补采批次已入库：5 组 PDF Expert 3.9.2 window-only crop（阅读、页面管理、批注、矩形 shape、编辑画布），每组 a/b reference diff 为 0；量测见 `measurements.json`，分析见 `supplemental-analysis-2026-07-24.md`。
- 当前 accepted golden 数量为 0；新增图片最高为 `measured`，任何 Agent 都不得使用“已有 15 张黄金图”或本批次 measured 图作为最终视觉完成依据。
- `scripts/verify-pdf-expert-layout.mjs` 证明结构不变量；`verify-pdf-expert-visual.mjs` 以 measured bbox 验证 L2/L3/L4、L3 横向分布、页面与页卡几何，并断言单页/缩略图/surface 语义。二者都不是 accepted-golden 像素一致性测试。
- 在完成规范化重采集、窗口裁剪、元素量测和视觉 diff 之前，相关 UI 的最高状态只能是 `behavior-complete`，不能是 `visually-verified`。
- M0、M2.1、M2.2 已完成；M3 核心页面管理行为已接真实状态和 PDF 导出，M4/M5 按功能真实性继续推进。M1/accepted-golden 不再是功能前置。
- 新文档能降低上下文歧义，但不会自动补足缺失证据、视觉判断或功能实现；当前不得把“多个 Agent 一起做”理解成“多个 Agent 一起改 UI”。

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
- `measurements.json`：补采批次的固定窗口、Retina crop、人工 bbox 和 uncertainty。
- `supplemental-analysis-2026-07-24.md`：补采状态机、观察事实、实现约束和仍缺失的 surface。
- `s4-verification-report.md`：重建 Agent 反向审计结果。

## 视觉验证器（M2）

两个验证器分工，不重叠、不互相替代：

| 验证器 | 命令 | 职责 | 退出码 |
| --- | --- | --- | --- |
| `verify:ui-layout` | `npm run verify:ui-layout` | 双视口结构回归：L3 五段、DOM 顺序、read/annotate/edit/pages 模式路由与互斥 | 0 通过 / 非 0 失败 |
| `verify:pdf-expert-visual` | `npm run verify:pdf-expert-visual` | 73 项 measured 门禁：L2/L3/L4、L3 横向分布、页面 bbox/单页计数、G05 编辑大纲/中央画布、页卡 bbox/真实 canvas、搜索双栏、状态栏与 surface 语义 | 0 全 pass / 1 超容差或语义错误 / 2 环境错误 |

`verify:pdf-expert-visual` 当前用 measured reference（G01-G05，非 accepted-golden）。策略是分层/横向几何 diff + surface-specific DOM 断言，不比较页面内容像素。M1 完成 accepted-golden 后再增加图像回归并收紧容差。

## Agent 开工门禁

处理 L2–L6、Toolbar、AppShell、Sidebar、RightPanel、PageOrganizerWorkspace、EditModeGridView 或模式切换前必须：

1. 阅读本文件、`acceptance-contract.md`、`manifest.json`、`state-matrix.md` 和 `implementation-map.md`。
2. 在 `docs/TASKS.md` 找到明确的活跃子任务、依赖、允许文件和验收证据；没有任务卡不得自行挑一个历史 ISS 开工。
3. 打开与任务有关的图片；不得只读文件名或历史 catalog。
4. 视觉任务在交付说明中列出 capture id、证据等级和不能从图片推断的内容；纯功能任务列真实 fixture、交互和产物证据。
5. 明确交付等级：`skeleton`、`wired`、`behavior-complete` 或 `visually-verified`。
6. 未达到 `visually-verified` 时不得把“高保真复刻”或对应 surface 标记为完成。

## 多 Agent 启动判断

先看 `docs/TASKS.md` 的阶段并发权。功能任务不再被 accepted-golden 阻塞，但共享 AppShell/状态/写回链路仍只能有一个 owner；视觉精修继续服从 M1/M2 门禁。

后续只有同时满足以下条件，才允许把工作拆给多个 Agent：

1. 每个 worker 的 allowed/forbidden files 互不冲突，共享布局和状态只有一个 owner；
2. 每个功能任务都有独立的行为闭环、真实 fixture、产物重开和完成等级；
3. 视觉任务额外要求 accepted-golden、可失败的 M2 验证器和实机截图；
4. planned 入口必须 disabled/fail-closed，不得由其他 worker 暗中改成 toast-only；
5. PM 按真实运行证据验收，不以 worker 自述、测试通过或截图数量代替产品结果。

这套规则提高的是方向一致性、可交接性和漏项可见性，不保证模型不会偏题。执行波动仍由窄任务、双层监测、独立 PR 和 PM 实机验收兜底。

## 明确保留的 FaroPDF 差异

- 使用 FaroPDF 品牌，不复制 PDF Expert 商标、专有图标和素材。
- 原 PDF 默认不覆盖；破坏性操作输出副本。
- 联网 OCR 必须知情确认。
- 法律材料隐私、安全、可回退和可交接规则优先。

这些差异不授权随意改变已经被 accepted-golden 证明的信息架构、控件位置、模式语义或交互顺序。
