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

## Termination

上下文歧义审计已达到本轮终止条件；证据完整度仍未达到复刻终止条件。accepted-golden 为 0，必须继续执行 M1。
