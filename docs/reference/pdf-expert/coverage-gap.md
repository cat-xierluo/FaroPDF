# PDF Expert 复刻覆盖缺口

最后更新：2026-07-24（补采批次入库）

## P0：阻塞所有视觉完成声明

| 类别 | 缺口 | 下一动作 | 来源任务 |
| --- | --- | --- | --- |
| capture truth | 15 张首批图片重新分级：6 raw-Aminus + 5 raw-B（1 raw-B-low-confidence）+ 4 raw-C；accepted-golden 仍为 0 | 按 ISS-NEW-N / ISS-NEW-M 推进；M1 完整重采不阻塞当前面板修正批次 | ISS-NEW-N |
| normalization | 2026-07-24 补采 6 组已按固定窗口生成 2560×1664 window-only crop；搜索态 raw 仍含桌面背景 | `N-CROP-L3-SEARCH` 已补完整 L3 + 搜索结果双栏的 measured crop；CROP 的菜单栏与 accepted-golden 门禁仍待 M1 统一 | ISS-NEW-N-CROP |
| measurement | 新增 `measurements.json`，记录 1280×832 逻辑 bbox、人工误差 ±4pt；ZAI bbox MCP 不可用 | M1 独立复核并补自动量测 | ISS-NEW-N-CROP |
| visual verdict | 现有脚本只测几何，无黄金图视觉 diff | M2 验证器（M1 完成后建立） | ISS-NEW-M M2 |
| state | thumbnails（左栏真缩略图 + 当前页高亮）仍无可靠图；N-PAGE 是整页页面管理网格 | ISS-NEW-N-THUMB 补采；不得把 N-PAGE 当 Sidebar thumbnails | ISS-NEW-N-THUMB |
| state | text selection 浮动工具条无图；本轮真实文字层拖选仍未触发 | 找到可复现的原生选区触发路径后再补采 | ISS-NEW-N-SEL |
| state | shape 右栏已补采矩形激活态；R12 仍是 stamp 负面证据 | N-SHAPE-RECTANGLE 可支撑 measured 面板合同；绘制/其他形状仍由 ISS-NEW-N-SHAPE 后续补齐 | ISS-NEW-N-SHAPE |
| state | annotate 右栏真实布局、welcome 真目标状态、forms、export、L5a+L5b 同屏、OCR 运行态、双栏 | 当前 raw 不支持；归档为后续任务，由 ISS-NEW-N 子卡或 M4/M5 推进 | ISS-NEW-M M4/M5 |
| interaction | edit 拖动开始、drop indicator、写回和导出重开无证据 | 采完整序列并做 PDF 顺序 round-trip（依赖 ISS-NEW-N-THUMB / SHAPE 等前置） | ISS-NEW-M M3 |
| runtime | FaroPDF 仍有多个 noop/placeholder/toast-only | M3～M5 解锁后，以 `implementation-map.md` 为清单逐项接通；M1 不改代码 | ISS-NEW-M M3+ |

## P0+：ISS-NEW-N 补采硬缺口（无图就无法做对应修正）

以下 2 个 surface 在本次补采后仍无可信图；CROP 已有搜索态 measured 证据但尚未满足菜单栏/accepted-golden 门禁，SHAPE 也已有 measured 证据。归档为 ISS-NEW-N 子卡，由后续 worker 执行：

- **ISS-NEW-N-CROP**（窗口已 crop 的 L3 工具栏全展开参考）
  - 阻塞：`L3 toolbar 自适应断点`、`窗口外边距`、`左右栏与中央分割线精确宽度`
  - 最近现有图：R06（含桌面背景，唯一 L3 全展开的图）
  - 当前：`N-CROP-READ-DEFAULT` + `N-CROP-L3-SEARCH` 已完成 window-only crop；搜索态证明完整 L3 与大纲+搜索双栏，但 raw 才含菜单栏，仍需 M1 统一重采和独立审计后才可 accepted-golden
- **ISS-NEW-N-THUMB**（左栏缩略图列表 + 当前页高亮）
  - 阻塞：`Sidebar thumbnails tab`、缩略图卡片尺寸/间距、多页滚动当前页定位
  - 最近现有图：R03/R04/R05（都不是 thumbnail 实图）；N-PAGE 是整页页面管理网格，不能替代
  - 验收：缩略图模式打开左栏的稳定截图；至少 5 页可见、当前页高亮可见
- **ISS-NEW-N-SEL**（text selection 浮动工具条）
  - 阻塞：`TextSelectionToolbar`、选区可见性、`TextSelectionToolbar` 翻译占位文案替换
  - 最近现有图：R07 与 2026-07-24 本轮安全框选尝试（均无 selection 浮条）
  - 验收：在 read 模式下用真实文字层 fixture 框选一段，捕捉浮出工具条
- **ISS-NEW-N-SHAPE**（shape 6 段合同的真参考）
  - 阻塞：`Shape panel`、形状工具激活态与右栏样式、形状绘制行为
  - 最近现有图：R12（实为 stamp，不是 shape）；补采 `N-SHAPE-RECTANGLE` 已证明矩形面板控件顺序
  - 剩余验收：其他形状、绘制落点、保存/重开及独立审计

这 4 个补采子卡与 M1 全量重采不同：每卡只补 1 张（或 2 张）参考图、按 `capture-protocol.md` 流程执行即可，不必等 M1 的 4 个 accepted-golden 全部准入。

## P1：交互和异常覆盖（待 M4/M5 推进）

- 同一控件的 idle、hover、active、focus、disabled。
- OCR loading、success、failed、cancelled。
- 密码错误、损坏 PDF、空 PDF、超大 PDF。
- 3+ tab、tab overflow、tab 重排、跨 tab 拖页。
- 搜索零结果、关闭搜索、上一项/下一项。
- 签名、图章、形状从选择到页面落点的完整链路。
- 深色/浅色主题以及窄窗口下的响应式行为。

## 已知错误规格（保持撤销状态）

- R04 不是缩略图面板，而是大纲面板。
- R05 没有进入批注模式。
- R03 不能证明双页模式。
- R07 没有清晰的文本选区浮层。
- R14 是 welcome，不是批注摘要；legacy_intended 与 observed 不符。
- R15 是响应式 4+1，不支持"固定 5 列"结论。
- R12 是 stamp 不是 shape；不可作 shape 实现基线。

这些错误已从现行矩阵撤销；历史文件中出现相反描述时，以本目录现行文件和 DEC-173 为准。

## 明确保留的 FaroPDF 差异

- 品牌名称、商标和专有图标不复制。
- 原 PDF 默认不覆盖；破坏性操作继续输出副本。
- 联网 OCR 继续要求知情确认。
- 法律材料隐私、安全和可回退规则优先。
