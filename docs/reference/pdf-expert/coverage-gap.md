# PDF Expert 复刻覆盖缺口

## P0：阻塞所有视觉完成声明

| 类别 | 缺口 | 下一动作 |
| --- | --- | --- |
| capture truth | 15 张首批图片有误标、重复和自动化失败；accepted-golden 为 0 | 按 `manifest.json` 重采 rejected、low-confidence raw 和 semantic uncertainty 状态 |
| normalization | 所有可用图仍包含桌面背景，窗口 crop、主题、窗口尺寸不统一 | 固定 fixture、主题和窗口尺寸，只截目标窗口 |
| measurement | 没有 `s1-elements.json`、bbox、字号、颜色、间距和断点 | 配置 ZAI bbox MCP，或人工量测并标 uncertainty |
| visual verdict | 现有脚本只测几何，没有黄金图视觉 diff | measured spec 完成后建立 crop + perceptual diff + 非零退出码 |
| state | read two-page、真实 thumbnails、annotate、text selection、annotation summary 均无可靠图 | 按失败 capture id 逐项补采 |
| state | forms、export、L5a+L5b 同屏、OCR 运行态无可靠图 | 补入口、设置、进行中、完成和错误态 |
| interaction | edit 拖动开始、drop indicator、写回和导出重开无证据 | 采完整序列并做 PDF 顺序 round-trip |
| runtime | FaroPDF 仍有多个 noop/placeholder/toast-only | M3～M5 解锁后，以 `implementation-map.md` 为清单逐项接通；M1 不改代码 |

## P1：交互和异常覆盖

- 同一控件的 idle、hover、active、focus、disabled。
- OCR loading、success、failed、cancelled。
- 密码错误、损坏 PDF、空 PDF、超大 PDF。
- 3+ tab、tab overflow、tab 重排、跨 tab 拖页。
- 搜索零结果、关闭搜索、上一项/下一项。
- 签名、图章、形状从选择到页面落点的完整链路。
- 深色/浅色主题以及窄窗口下的响应式行为。

## 已知错误规格

- R04 不是缩略图面板，而是大纲面板。
- R05 没有进入批注模式。
- R03 不能证明双页模式。
- R07 没有清晰的文本选区浮层。
- R14 是 welcome，不是批注摘要。
- R15 是响应式 4+1，不支持“固定 5 列”结论。

这些错误已经从现行矩阵撤销；历史文件中出现相反描述时，以本目录现行文件和 DEC-173 为准。

## 明确保留的 FaroPDF 差异

- 品牌名称、商标和专有图标不复制。
- 原 PDF 默认不覆盖；破坏性操作继续输出副本。
- 联网 OCR 继续要求知情确认。
- 法律材料隐私、安全和可回退规则优先。
