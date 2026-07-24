# PDF Expert 复刻执行指引

本文件描述依赖和交付方式，不是第二任务源。下一项具体任务、状态、负责人和 allowed files 只从 `docs/TASKS.md` 的 ISS-NEW-M 读取。

## 必读顺序

1. 根目录 `AGENTS.md`
2. `docs/TASKS.md` 的“当前唯一推进序列”和 ISS-NEW-M
3. 本目录 `README.md`
4. `acceptance-contract.md`
5. `manifest.json` 与目标 capture
6. `measurements.json` 与 `supplemental-analysis-2026-07-24.md`（若使用 N-* 补采证据）
7. `state-matrix.md`
8. `implementation-map.md`
9. `docs/DESIGN.md` 和 `docs/ARCHITECTURE.md`

不要从 `CHANGELOG.md` 或旧 DEC 反推当前需求。

补采事实提醒：`N-PAGE-MANAGEMENT-GRID` 是整页页面管理网格，不是左栏 thumbnails；`N-EDIT-CANVAS` 是文本/图像/链接/隐藏编辑画布，不是页面卡片网格；`ISS-NEW-N-THUMB` 与 `ISS-NEW-N-SEL` 仍缺可信图。N-* 图片最高为 `measured`，不能直接关闭视觉任务。

## 依赖顺序

```text
证据校准与规范化采集
        ↓
量测规格 + accepted-golden
        ↓
视觉 diff 验证器
        ↓
纵向功能切片实现
        ↓
真实 PDF round-trip + 视觉验收
```

M0 完成后只允许执行 `docs/TASKS.md` 已领取的 M1；M1 禁止修改 `src/**`、`src-tauri/**` 或提前做任何真实接线。只有 TASKS 明确解锁后，才进入 M2～M5。

## 并行不是默认值

上下文整理完成解决的是“worker 读到什么”，不是“规格是否已经足够精确”或“实现是否已经通过验收”。当前不允许通过增加 Agent 数量跳过 M1/M2。

| 阶段 | 推荐 owner | 可并行范围 | 禁止事项 |
| --- | --- | --- | --- |
| M1 | 1 个证据 owner | 必要时可由只读 reviewer 做完整度审计 | 多人同时写 manifest；修改产品源码；提前调 CSS |
| M2 | 1 个 foundation owner | reviewer 可独立做故障注入 | 每个 surface 自建阈值；只生成截图不产生失败码 |
| M3 | 1 个纵向闭环 owner | reviewer 可验证导出 PDF | 拆开网格、重排状态和 PDF 写回给互相依赖的 worker |
| M4 | 每个独立 surface 1 个 owner | accepted-golden、验证器和文件隔离均满足后可组成 Wave | 并行争抢 AppShell、全局样式、共享状态或全局布局 |
| M5 | 每个独立工作流 1 个 owner | forms/export/OCR/异常态在契约不重叠时可组成 Wave | 共享写回链路、命令模型或 Tauri 接口无 owner |

PM 派工前必须逐项回答：

- 当前阶段是否已在 TASKS 解锁？
- 目标 surface 的 accepted-golden ID 是什么？
- 视觉验证器是否会对该 surface fail closed？
- allowed/forbidden files 是否与在途任务重叠？
- 谁独占共享布局、状态和写回链路？
- 真实应用截图、DOM/bbox、交互断言和 PDF round-trip 将落在哪里？

任一答案缺失时保持串行或停止补证据，不以“模型更强”“多开几个 Agent”替代门禁。

## 实现切片原则

- 每个 worker 只负责一个纵向工作流，不能同时改 shell、edit grid 和 RightPanel。
- 先行为后视觉：入口 → state/controller → 文档结果 → 导出/重开 → accepted-golden。
- 全局布局文件由单一 worker 独占。
- 发现 noop、placeholder 或缺图，先回写 TASKS；不顺手扩范围。
- 任何 responsive 规则都要写“条件 + 量测”，不写固定列数猜测。

## 交付模板

```text
Task:
Allowed files:
Forbidden files:
Capture evidence:
Evidence level:
Facts implemented:
Explicitly not inferred:
Delivery level:
Behavior verification:
Visual verification:
Remaining placeholder/noop:
```

## 停止条件

出现任一情况必须停止实现并交回 PM：

- manifest、state matrix、DESIGN、TASKS 对同一状态说法不同；
- 目标 capture 为 rejected、low-confidence raw、semantic uncertainty 或 missing；
- 需要修改共享契约、锁文件或全局布局但不在 allowed files；
- 只能用 toast、演示数据或 placeholder 完成任务；
- 无法用真实 PDF 证明保存/导出结果；
- 视觉失败但没有 measured spec 判断哪一方错误。
