# PDF Expert 复刻覆盖缺口

## 阻塞 `visually-verified`

| 严重度 | 类别 | 缺口 | 下一动作 |
| --- | --- | --- | --- |
| high | screenshot pipeline | 尚无逐截图 bbox `s1-elements.json` | 配置 ZAI bbox MCP 后按 82 张源图重跑 S1 |
| high | state | forms mode 的 L4/L5b/L5c 无可靠截图 | 补采 forms 全状态 |
| high | state | export mode 的参考布局未进入黄金集 | 补采导出入口、设置和完成态 |
| high | interaction | edit 拖动开始/进行中/drop indicator/写回缺完整证据 | 补采拖动序列并做导出重开验证 |
| high | layout | L5a + L5b 同屏黄金参考缺失 | 补采双栏同屏状态 |
| high | runtime | FaroPDF 当前仍有多个 noop/placeholder | 逐项降级任务状态并按纵向工作流接通 |

## 中优先级

- hover、focus、disabled 的同控件四态截图不完整。
- OCR loading / success / failed / cancelled 的完整视觉序列不完整。
- 加密错误、损坏 PDF、超大 PDF 等异常状态缺截图与性能基线。
- 多 tab 超过 5 个后的滚动箭头、跨 tab 拖页中间态缺完整证据。
- 深色模式、窗口缩放和较窄视口尚未形成独立黄金合同。

## 明确保留的 FaroPDF 差异

- 品牌名称、商标和专有图标不复制。
- 原 PDF 默认不覆盖；破坏性操作继续输出副本。
- 联网 OCR 继续要求知情确认。
- 法律材料隐私、安全和可回退规则优先于视觉一致性。

这些差异不改变 L2-L6 的信息架构、模式语义和面板顺序。
