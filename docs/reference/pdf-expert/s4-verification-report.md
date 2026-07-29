# S4 Reverse Verification Report

## Pass 1 — 2026-07-23

独立重建 Agent 只读审计当前 HEAD，结论为不能 auto-launch 整体高保真复刻。

主要 high severity 问题：

1. G04 实图是大纲面板，却标为 thumbnails。
2. G15 实图是响应式 4+1，却被合同和代码描述为固定 5 列。
3. G01、G05、G07、G14 等图片与 intended state 不符。
4. 编辑网格使用空白渐变、硬编码 A4 和 noop reorder。
5. DESIGN、ARCHITECTURE、TASKS 同时保留旧候选口径和新高保真口径。
6. 没有规范化窗口 crop、bbox、断点和视觉 diff。
7. forms、export、双栏、拖动过程证据缺失。

处理：

- 首批图片撤销 golden 资格并迁入 `captures/raw/`。
- manifest 改为 observed-state 索引。
- 固定 5 列结论撤销。
- 上述缺口进入 coverage gap 和 ISS-NEW-M。

## Pass 2 — 2026-07-23

独立 Agent 复检发现 3 个 high、5 个 medium、3 个 low：

- 旧 ISS-059～065、ISS-073、ISS-NEW-A～J 仍有可领取任务外形。
- M1 accepted-golden 与 M2 visual verifier 的 diff 含义形成循环依赖。
- rebuild guide 允许证据未完成时提前真实接线。
- `verify:ui-layout` 超范围声称验证 L2；旧 shape/search 分段、pane 宽度和源码注释仍会误导。
- completeness 计数和 `uncertain` 分类不可复算。

这些问题已全部回写：历史卡冻结；M1 reference-vs-reference 与 M2 FaroPDF-vs-reference 分离；M1 禁止代码接线；脚本能力边界降为 L3/L5；旧截图规格和源码话术撤销。

## Pass 3 — 2026-07-23

同一独立 Agent 对所有 Pass 2 问题逐项复核：

- verdict：`pass`
- next_task_unambiguous：`true`
- remaining high：0
- remaining medium：0
- remaining low：3 条源码注释漂移，随后已全部修正

现行结论：M0 已关闭；M1“规范化重采集与量测”是唯一可领取下一项。整体高保真复刻仍不能跳过 M1/M2 自动推进实现。

## Pass 4 — 2026-07-28

独立 S4 Agent 对 M2.1 状态机、截图证据、实现映射、两套验证器及其 actual/report 做只读反向审计，首轮判定为 `fail`。发现的核心问题包括：

1. `T 编辑` 与页面管理仍在旧文档中混用；annotate 基础态被误写成需要右栏。
2. DESIGN、measurements、coverage gap 和 accepted-golden 清单保留旧尺寸或旧依赖。
3. visual/layout report 的状态语义、产物范围和 stale artifact 排除不足以审计。
4. `ARCHITECTURE.md` 与 `ROADMAP.md` 仍保留旧验证能力和 `EditModeGridView` 路线。

上述问题已逐项修正。第一次复审确认九项核心整改均已落地，但因架构和路线图仍有三处旧口径，按严格标准继续判为 `fail`，未提前关闭文档闭环。

## Pass 5 — 2026-07-28

同一独立 S4 Agent 对最后三处规范漂移及九项核心整改再次只读复核：

- verdict：`pass`
- `T 编辑` / `pages` 状态独立，annotate 默认无右栏。
- canonical 量测统一为 L2/L3/L4 `29/32/33pt`、outline `272pt`、shape right panel 约 `380pt`、page card `x=69 / width=175 / gap=66pt`。
- `verify:pdf-expert-visual` 最新结果为 24/24 pass；`verify:ui-layout` 产物含 timestamp、scope、artifact 白名单和 stale exclusion。
- doc-curator working-tree context-sync 为 `hard=0 / adaptive=0 / soft=0`。

阶段判定：M2 measured 几何/语义门禁和 M2.1 可以闭环；这不等于 accepted-golden 图像回归或 `visually-verified`。M1 accepted-golden 仍为 0；M3 的真实缩略图、响应式网格、重排写回、导出副本和重开验证仍未完成。

## Pass 6 — 2026-07-28

独立 S4 Agent 对 M2.2 的 reference、触发协议、state matrix、manifest、measurements、实现、两套验证器、actual/report 与协作文档完成三轮只读回验。

首轮判定 `fail`，发现 G05 reference 明确显示 272pt 大纲左栏，但协议、矩阵、量测、实现和验证器仍按折叠左栏处理，造成 edit surface 假绿。整改后回验又发现两个分支问题：

1. 原生 `pdf-edit-*` 命令在进入 edit 后二次请求 `none`，与 L3 `T 编辑` 产生两个结果态；现已统一请求 summary。
2. G05 measurements 同时写 272pt 左栏与 1280pt canvas，bbox 语义重叠；现已改为真实 `page_canvas x=272 / width=1008`，另记整窗 center=640/page center≈639，并把中央区 x/width 纳入门禁。

最终结论：

- verdict：`pass`
- G05 统一为 272pt 大纲左栏、1008pt 中央区、页面按整窗中心线对齐、编辑 L4 为文本/图像/链接/隐藏。
- L3 与原生 PDF 编辑命令进入同一结果态；最新 `verify:pdf-expert-visual` 为 73/73 PASS，双视口 layout report PASS。
- 文档统一为 73 项门禁；doc-curator context-sync / decision-sync 均 exit 0，hard/adaptive/soft 为 0。
- accepted-golden 仍为 0；本结论只关闭 M2.2 的 `wired + geometry/density/semantic-verified`，不升级为 `visually-verified`。

## Termination

M2.1 与 M2.2 的状态机、Shell 几何/密度和 measured 门禁歧义审计已达到本轮终止条件；证据完整度和页面管理行为仍未达到复刻终止条件。accepted-golden 为 0，必须继续执行 M1；M3 仅真实缩略图前置完成，响应式重排、写回、导出与重开仍未完成。
