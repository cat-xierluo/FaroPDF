# PDF Expert 补采分析（2026-07-24）

本文件是 2026-07-24 在 PDF Expert 3.9.2 实机完成的补采结果，供不能使用截图工具的实现 Agent 作为事实入口。它不替代 M1 全量重采，也不把任何图升级为 `accepted-golden`。

## 证据入口

| 状态 | window-only crop | 观察结论 | 证据等级 |
| --- | --- | --- | --- |
| 阅读默认 | `captures/cropped/G01-read-default-a.png` / `-b.png` | 单页阅读、深色 shell、L2/L3 顺序、两侧 pane 折叠 | measured |
| 页面管理 | `captures/cropped/G02-page-management-grid-a.png` / `-b.png` | 5 个真实页面卡片同排，第一页蓝色选中；7 个页面操作入口 | measured |
| 批注 | `captures/cropped/G03-annotate-a.png` / `-b.png` | 批注上下文工具条、左侧大纲面板、中央页面 | measured |
| 矩形工具 | `captures/cropped/G04-shape-rectangle-a.png` / `-b.png` | 右侧矩形工具面板和完整形状样式控件 | measured |
| 编辑画布 | `captures/cropped/G05-edit-grid-a.png` / `-b.png` | 编辑模式是文本/图像/链接/隐藏上下文工具条，不是页面卡片网格 | measured |

每组 a/b 都用 `ImageMagick compare -metric AE` 做 reference-vs-reference 检查，差异像素为 0。此结果只证明本次两次采集稳定，不证明 FaroPDF 已对齐。

## 观察到的状态机

```text
read default
  ├─ 页面管理 → page-management grid（5 cards, page 1 selected）
  ├─ 批注 → annotation toolbar + optional outline panel
  │            └─ 矩形菜单 → annotation toolbar + left outline + right shape panel
  └─ 编辑 → edit canvas toolbar（文本 / 图像 / 链接 / 隐藏）
```

以下两项在本次环境中没有形成可用图：

- 左侧“缩略图列表 + 当前页高亮”：点击“页面管理”得到的是整页页面管理网格，不是左栏缩略图列表。因此 `ISS-NEW-N-THUMB` 仍然是缺口；实现 Agent 不得把 `G02` 当成 Sidebar thumbnails 证据。
- read 模式文本选区浮条：真实文字层框选没有出现浮动工具条；保留 `ISS-NEW-N-SEL` 未完成，不能用 `R07` 或探索性 `TEST-*` 图推断。

## 分层实现提示

所有坐标均为 1280×832 逻辑点的人工量测，误差约 ±4pt；详细值在 `measurements.json`。

- L2：窗口标题栏约 29pt，包含 tab 与窗口控制。
- L3：默认主工具栏约 32pt；批注、页面管理、编辑等入口处于同一行。
- L4：上下文工具条约 65pt，只有批注/编辑/页面管理等模式出现；read default 不应凭空增加 L4。
- L5a：批注截图中的大纲面板约 211pt 宽；它是大纲，不是缩略图。
- L5c：页面画布保持 A4 纵向比例；页面管理状态不显示阅读页，而是全宽卡片网格。
- L5b：矩形工具右栏约 480pt 宽，位于中央画布右侧；可见 preview、shape selector、stroke width、border type、opacity、stroke/fill color、collapse footer。

## 对 FaroPDF 实现的直接约束

1. `EditModeGridView` 的页面卡片模式应由页面管理入口驱动；不能将“编辑模式文本工具条”和“页面管理卡片网格”合并成一个状态。
2. 页面管理截图显示 5 张真实页面缩略图，且第一页有蓝色选中框；卡片内容必须来自 PDF 页面渲染，不能用统一渐变占位图。
3. 批注截图仅证明左侧大纲 + 中央页面 + 批注工具条；不要据此自动打开 RightPanel。
4. 形状右栏的可见控件顺序是实现 contract，`矩形` 是当前选择；其他形状的具体默认样式和落点行为仍需单独证据。
5. 任何“缩略图列表”“文本选区浮条”“固定 5 列编辑网格”“像素级等价”表述都必须继续标为 missing / hypothesis，直到对应 accepted-golden 和 M2 回归验证完成。

## 工具与限制

本轮按 `capture-protocol.md` 固定窗口和 fixture，使用 macOS `screencapture` + ImageMagick 完成 Retina crop。环境未提供 ZAI bbox MCP，因此量测是人工复核，不是自动元素抽取；这也是本批次保持 `measured`、不升级 `accepted-golden` 的原因。

## 追加补采：搜索态与选区浮条负面验证（2026-07-24）

### 搜索态（`N-CROP-L3-SEARCH`）

- 入库：`captures/raw/N-CROP-L3-search-a.png` / `-b.png`；`captures/cropped/N-CROP-L3-search-a.png` / `-b.png`。
- 状态：固定 1280×832 logical window；完整 L3 主工具栏可见；左侧为“大纲”面板，右侧为搜索结果面板；查询 `Purpose`，显示“已找到：2”，第 1、2 页均有命中高亮。
- 量测：标题栏 29pt、L3 32pt、左大纲约 272pt、右搜索栏约 480pt；详细 bbox 写入 `measurements.json`。
- 稳定性：`compare -metric AE` 为 148 个差异像素；差异来自搜索字段 caret/IME 浮泡的瞬态变化，语义布局稳定，因此保持 `measured`，不升级 `accepted-golden`。
- 限制：window-only crop 不含 macOS 菜单栏；raw 保留菜单栏但同时包含桌面背景和备份通知。raw 只能作为过程审计，不能作为 golden。

### `ISS-NEW-N-SEL` 负面验证

- 在 read 模式真实文字层（fixture 第 1 页）内完成一次固定坐标拖选，未出现可见选区或浮动工具栏。
- 该结果与 R07 一致，只能证明“本次环境/触发方式没有产出目标浮条”，不能证明 PDF Expert 不支持文本选区浮条。
- 因此 `ISS-NEW-N-SEL` 继续保持 missing；不得据此实现或关闭 `TextSelectionToolbar`。后续仍需找到可复现的原生选区触发路径后再采集 a/b。

### 缩略图缺口复核

- 本次通过 PDF Expert View 菜单检查“缩略图 / 缩略图面板”入口，当前 3.9.2 会话中对应菜单项为 disabled，未能打开左栏真实缩略图列表。
- 现有 `N-PAGE-MANAGEMENT-GRID` 仍是页面管理整页网格，不能替代 `ISS-NEW-N-THUMB`；该缺口继续保留。
