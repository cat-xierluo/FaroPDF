# PDF Expert 复刻执行指引

本文件描述依赖和交付方式，不是第二任务源。下一项具体任务、状态、负责人和 allowed files 只从 `docs/TASKS.md` 的 ISS-NEW-M 读取。

## 必读顺序

1. 根目录 `AGENTS.md`
2. `docs/TASKS.md` 的“当前唯一推进序列”和 ISS-NEW-M
3. 本目录 `README.md`
4. `acceptance-contract.md`
5. `manifest.json` 与目标 capture
6. `state-matrix.md`
7. `implementation-map.md`
8. `docs/DESIGN.md` 和 `docs/ARCHITECTURE.md`

不要从 `CHANGELOG.md` 或旧 DEC 反推当前需求。

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
