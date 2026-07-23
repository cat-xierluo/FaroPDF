# Accepted golden 目录

当前没有已通过准入的 golden 图片。

图片进入本目录前必须同时满足：

1. 触发步骤可重复，并记录目标 PDF、窗口尺寸、主题和应用版本。
2. 只保留目标应用窗口，或在 metadata 中提供经过人工确认的窗口 crop。
3. `s1-elements.json` 或等价量测文件记录关键 surface bbox、控件尺寸和不确定性。
4. 画面状态与 `manifest.json`、`state-matrix.md` 一致。
5. 同一 PDF Expert 参考状态至少复跑两次，完成 reference-vs-reference 稳定性 diff，并记录工具、阈值和结果。
6. 由独立重建审计确认文件名、画面和状态描述没有互相矛盾。

这里的稳定性 diff 只用于 M1 判断“参考状态能否稳定复采”。M2 另行建立 FaroPDF-vs-reference 的回归验证器，两者不得混称。

原始截图统一放在 `../captures/raw/`。未经上述门禁，不得把 raw 图片复制到这里或在任务卡中称为“黄金图”。
