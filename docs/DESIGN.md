# FaroPDF 设计系统

> Last updated: 2026-06-07
> 版本：2.0 — 对齐 Folia / Funes 设计系统成熟度

## 设计目标

FaroPDF 是一个 PDF 阅读器，不是 Markdown 编辑器，也不是全能文件管理器。第一视觉永远是 PDF 页面。工具栏、侧边栏、批注列表和 OCR 面板都要服务于阅读、定位和交付。

关键词：

- 清亮：浅色纸面、低噪音工具栏、克制线条。
- 快速：打开即可读，搜索和缩略图逐步可用。
- 专业：适合法律材料、长卷宗、扫描件和批注整理。
- 可回退：任何会改变 PDF 的操作都清楚展示输出和影响。

## 视觉原则

- 主背景使用接近纸张的暖白或浅灰，不使用深色科技感大渐变。
- PDF 页面使用真实白色纸面和细边界，页面之间保留足够间距。
- 强调色只用于当前页、搜索命中、批注激活和主操作按钮。
- 工具栏默认轻量图标化，复杂工具进入面板或浮层。
- 不使用营销式首屏，不做大面积 hero；启动后就是阅读器。

## 1. 颜色体系

所有颜色通过 CSS 变量定义，不硬编码色值。

| Token | 用途 | 值 |
| --- | --- | --- |
| `--bg` | 应用背景 | `#eef1f3` |
| `--surface` | 工具栏、侧栏、面板 | `#fbfcfd` |
| `--surface-strong` | 输入框、卡片内嵌区域 | `#ffffff` |
| `--paper` | PDF 页面纸面 | `#ffffff` |
| `--border` | 分隔线、页面边界 | `#d7dde2` |
| `--border-strong` | 当前页强调边框 | `#b7c1c9` |
| `--fg` | 主要文字 | `#182026` |
| `--muted` | 次要文字 | `#66717a` |
| `--accent` | 当前页、激活工具、主操作 | `#276f76` |
| `--accent-soft` | hover 背景、focus ring 发光 | `#d9eef0` |
| `--highlight` | 搜索命中和文本高亮 | `#f6d66f` |
| `--danger` | 危险操作（删除、覆盖） | `#a83f3f` |

规则：

- 单一 accent 色（`--accent`），不引入第二主题色。
- 批注颜色允许多色，但必须限制在批注语义内，不扩散为全应用主题色。
- 交互状态统一使用 `accent` + `accent-soft`，不使用浏览器默认蓝色。
- 所有 `focus-visible` 使用 `border-color: var(--accent)` + `box-shadow: 0 0 0 2px var(--accent-soft)` 或 `outline: 2px solid var(--accent)`。

## 2. 字体

| 角色 | 字体栈 |
| --- | --- |
| UI 正文 | `system-ui, "PingFang SC", "Microsoft YaHei UI", sans-serif` |
| 状态栏 / 页码 | `ui-monospace, "SF Mono", Menlo, monospace` |
| 设置页快捷键 | `ui-monospace, "SF Mono", Menlo, monospace` |
| PDF 页内容 | 由 PDF 原始字体决定 |

规则：

- UI 字号范围 12px–16px；标题最大 18px。
- 状态栏文字 12px，颜色 `--muted`，不抢阅读注意力。
- 中文文字不加 letter-spacing。
- 标题层级通过 font-weight（600–700）和字号区分，不切换 font-family。

## 3. 布局架构

```text
┌──────────────────────────────────────────────┐
│ Main Toolbar (48px)                          │
│ Open · Pager · Modes · Search · Layout · Set │
├──────────────┬───────────────────────────────┤
│ Utility Pane │ PDF Pages / Task Workspace    │
│ Summary/View │ Virtual viewport or page grid  │
├──────────────┴───────────────────────────────┤
│ Status Bar: page / zoom / text layer / dirty │
└──────────────────────────────────────────────┘
```

FaroPDF 的页面逻辑参考 PDF Expert 的信息架构，但不照搬其品牌、图标或视觉样式。

### Toolbar（48px）

CSS Grid 5 列布局：`max-content max-content minmax(230px, 1fr) max-content minmax(190px, 250px)`。

| 区域 | 内容 |
| --- | --- |
| 左区 | 文档摘要、页面管理、视图设置（compact 图标按钮，无文字） |
| 核心区 | 打开、页码、缩放、视图模式 |
| 模式区 | 批注、导出、填写和签名、OCR |
| 右区 | 全文搜索、设置 |

规则：

- 无品牌区域（logo / 名称不占工具栏空间）。
- 图标优先，短标签辅助；图标按钮使用 `title` 属性提供无障碍文本。
- 模式按钮点击后显示第二行上下文工具条，不常驻。
- 侧边栏默认关闭，点击"文档摘要"时展开。

### Utility Pane（290–320px）

- 默认不显示；用户点击工具栏左侧按钮时展开对应面板。
- 文档摘要、视图设置共用同一区域。
- 设置页使用全屏 Portal 浮层，不占用左侧区域。
- 宽度 280–320px，可折叠。
- 缩略图标记当前页、搜索命中、批注存在和 OCR 状态。
- 大卷宗下缩略图必须懒加载。

### Reader

- 支持连续、单页、双页和适合宽度。
- 当前页保持清晰边界，但不使用厚重阴影。
- 搜索命中使用半透明高亮，当前命中使用 `outline: 2px solid var(--accent)`。
- 单页/双页模式下点击页边空白翻页（左半 → 上一页，右半 → 下一页）。

### Task Workspaces

复杂任务进入独立工作台或上下文工具条：

- 搜索：顶部关键词输入；命中列表使用搜索框下方轻量浮层。
- 批注：上下文工具条（高亮、下划线、删除线、笔记、图章、签名）。
- OCR：上下文工具条（识别文本、输出双层 PDF、质量检查）+ 独立工作区。
- 页面管理：独立网格工作台（插入、旋转、复制、删除、重排）。
- 导出：格式转换（Word/Excel/PPT/文本/图片）+ 交付工具（水印/Bates/压缩/扁平化）。
- 表单：上下文工具条（文本、签名、日期、勾号、图章、扁平化导出）。

## 4. 组件样式

### 按钮体系

| 类别 | 高度 | 边框 | 最小宽度 | 用途 |
| --- | --- | --- | --- | --- |
| `.tool-button` | 32px | 1px solid border | 62px | 工具栏主按钮 |
| `.tool-button--primary` | 32px | accent 色 | 62px | 主操作（选择文件、前往 OCR） |
| `.tool-button--compact` | 32px | 无边框 | — | 布局按钮（摘要、管理、视图） |
| `.context-tool` | 30px | 1px solid border | — | 上下文工具条 |
| `.context-tool--primary` | 30px | accent + accent-soft 填充 | — | 上下文主操作 |

### 输入控件（设置页）

| 控件 | 高度 | focus-visible |
| --- | --- | --- |
| `.settings-field input` | 34px | accent 边框 + accent-soft 发光 |
| `.settings-field select` | 34px | accent 边框 + accent-soft 发光 |
| checkbox | 浏览器原生 | — |

### 导航项

| 组件 | hover | active | focus-visible |
| --- | --- | --- | --- |
| `.settings-overlay__nav-item` | accent-soft 背景 | accent-soft + accent 色 + 600 字重 | 2px accent outline |
| `.settings-overlay__topnav-item` | accent-soft 背景 | 同上 | 2px accent outline |

### 卡片与列表

| 组件 | 背景 | 边框 | 圆角 |
| --- | --- | --- | --- |
| `.settings-provider-config` | surface-strong | 1px border | 6px |
| `.settings-about-card` | surface-strong | 1px border | 8px |
| `.settings-list` | border（1px 间隙效果） | 1px border | 6px |
| `.settings-list__row` | surface-strong | — | — |
| `.settings-shortcut-row` | surface-strong | 1px border | 6px |
| `.settings-recent__item` | surface-strong | 1px border | 6px |

## 5. 信息密度

- 工具栏高度 48px（克制化后从 56px 降低）。
- 设置面板圆角 10px，最大宽度 960px，最大高度 720px。
- 设置导航项 8px padding，行高 18px。
- 列表项最小高度 34px。
- 搜索浮层最大高度 `min(460px, calc(100vh - 112px))`。
- 上下文工具条最小高度 42px。
- 状态栏高度约 28px。
- 所有间距遵循 4px/6px/8px/12px/16px/20px 体系，不使用奇数值。

## 6. 交互规则

### 键盘

- 方向键翻页（上下 → 上/下一页；左右在单页模式等效）。
- Esc 关闭浮层/对话框/设置面板。
- 设置面板 Tab 导航：侧边导航项 → 内容区控件。

### 鼠标

- 拖拽 PDF 文件到阅读区打开（空态和阅读态均支持）。
- 单页/双页模式：点击页左半 → 上一页，右半 → 下一页。
- 连续模式：滚动同步当前页（IntersectionObserver 50% 阈值）。

### 动画

- 搜索命中跳转使用 `scrollIntoView({ behavior: "smooth" })`。
- 不使用 CSS 动画 / 过渡 / bounce 效果。

### 拖拽

- 拖拽区域接受 `application/pdf` MIME 和 `.pdf` 后缀。
- 非法文件静默忽略，不弹出错误提示。

## 7. 深度层级

FaroPDF 不使用 `box-shadow` 建立层级，通过颜色差异和透明度区分：

| 层级 | 用途 | 表现 |
| --- | --- | --- |
| 0 | 应用背景 | `--bg`（#eef1f3） |
| 1 | 工具栏、侧栏、状态栏 | `--surface`（#fbfcfd） |
| 2 | 输入框、卡片内嵌、按钮 | `--surface-strong`（#ffffff） |
| 3 | 设置浮层 | `--surface` + 1px border + `box-shadow` |
| 4 | 搜索浮层、确认对话框 | `--surface-strong` + `box-shadow` |

唯一使用 `box-shadow` 的场景：浮层（设置面板、搜索浮层）和对话框。

## 8. 响应式行为

FaroPDF 是桌面应用（Tauri），不面向移动端。

- 最小窗口：960 x 600px。
- 设置面板窄屏断点（< 768px）：左侧导航折叠为顶部 tab。
- 工具栏响应式断点：1500px / 1100px / 920px，逐级隐藏按钮文字标签。
- 不做缩放适配，不做横竖屏切换。

## 9. 页面状态与空态规范

### 空态（未打开 PDF）

- 中央区域：打开/拖拽区 + "选择文件"主按钮。
- 上方提供格式转换入口（图片转 PDF、Word 转 PDF）。
- 不显示硬编码占位文件名或缩略图。
- 无真实最近文件时，"最近文件"区域不显示。
- 工具栏模式按钮可用（进入对应工具条/工作台空态）。

### 设置页状态

- 每个设置 section 独立，不依赖其他 section 状态。
- OCR provider 列表始终显示所有 provider（含启用/禁用状态）。
- 最近文件为空时显示"暂无最近文件"提示文本。

### 工作台空态

- 页面管理工作台：未打开 PDF 时显示"打开 PDF 后管理页面"。
- OCR 工作区：始终显示任务列表 + 质量报告。

## 10. 工具栏克制原则（ISS-030 / ISS-037）

工具栏是阅读器的辅助工具，不是品牌展示区。

| 规则 | 说明 |
| --- | --- |
| 无品牌区域 | 不在工具栏显示 logo、应用名或品牌色块 |
| 一级/二级分层 | 常用操作在工具栏；专业操作在上下文工具条 |
| 侧边栏默认关闭 | 不常驻空侧栏；用户主动点击才展开 |
| 布局控件收左上角 | 摘要/管理/视图使用紧凑图标按钮，无边框 |
| 图标优先 | 文字标签仅在空间充足时显示 |
| 模式按钮切换上下文 | 不常驻多个工具条，只显示当前模式工具条 |

## 11. 设置页 UI 统一规范（ISS-035）

设置页所有交互控件遵循统一的视觉规范：

- 所有 `input` / `select` 统一 34px 高度、6px 圆角、`surface-strong` 背景。
- `focus-visible` 统一使用 accent 色边框 + accent-soft 发光环，不使用浏览器默认蓝色。
- 导航项 `hover` 使用 accent-soft 背景，`active` 额外加 accent 色 + 600 字重。
- 链接和按钮 `hover` 使用 accent 色边框 + accent 色文字。
- 所有 `focus-visible` 使用 `outline: 2px solid var(--accent)` + `outline-offset: 2px`。
- 不混用不同圆角大小（统一 6px 内联控件、8px 卡片、10px 面板）。

## 12. 菜单栏规范（ISS-032）

macOS 原生菜单栏使用 Tauri v2 Menu API 配置中文标签：

| 菜单 | 菜单项 |
| --- | --- |
| 文件 | 新建窗口、打开…、关闭窗口 |
| 编辑 | 撤销、重做、—、剪切、复制、粘贴、全选（PredefinedMenuItem） |
| 视图 | 文档摘要、页面管理、视图设置、—、全屏 |
| 窗口 | 最小化、—、关闭窗口 |
| 帮助 | 关于 FaroPDF |

规则：

- macOS 原生菜单使用中文标签。
- 编辑菜单使用 `PredefinedMenuItem` 获得系统原生行为。
- 视图菜单项对应工具栏左侧布局按钮的功能。
- 不在帮助菜单放置在线文档链接（应用内已有设置页关于 section）。

## 13. 批注交互

- 选择文本后出现浮动批注条：高亮、下划线、删除线、备注。
- 批注工具栏提供矩形、箭头、文本框、手写、图章。
- 批注列表按页码排序，可按颜色、类型和关键词筛选。
- 删除批注要可撤销。
- 批注摘要导出时保留页码、类型、内容和上下文。

## 14. OCR 交互

- 无文字层时在阅读区顶部显示提示条 + "前往 OCR 模式"按钮，不弹出阻塞对话框。
- OCR 后端选择放在 OCR 面板内。
- 联网 OCR 必须展示隐私提示和确认操作。
- 任务运行中展示进度、后端、页码范围和输出路径。
- OCR 完成后提供打开输出 PDF、搜索抽查和替换当前阅读文件三个动作。

## 15. 页面整理交互

- 页面整理进入独立网格视图，避免在普通阅读时误删页面。
- 删除、重排、旋转支持撤销。
- 导出按钮明确显示"另存为新 PDF"。
- Bates 编号和页码添加必须提供预览和位置选择。

## 16. 应用图标

- 当前临时图标采用纸页叠层和灯塔标识，保留 `Faro` 的"指引"寓意。
- 图标颜色以暖白纸页、深墨蓝绿和少量琥珀灯光为主。
- 后续正式品牌图标应收敛到 2–3 个主色，降低细节密度，保证 32px 小尺寸下轮廓清楚。
- macOS 图标加 RGBA 透明四角实现系统圆角遮罩。

## 17. 与 Folia 的边界

FaroPDF 不复用 Folia 的 Markdown 编辑布局：

- 不提供 Markdown 源码模式。
- 不提供 Word 纸张预览。
- 不提供 HTML 导出预览。
- 不把 PDF 阅读作为 Folia 的右侧面板。

可以复用的只有设计经验：清亮、克制、内容优先、按需加载。

## 18. PDF Expert UI 探索素材池

以下观察只作为信息架构和交互编排参考，不复制 PDF Expert 的品牌、图标、配色或具体视觉资产。

已观察结论：

- 新建标签页：顶部主工具栏 disabled，中央是打开/拖拽 PDF 区，旁边提供 Word/PDF、图片/PDF 转换入口，下方是最近文件缩略图。
- 阅读态：顶部主工具带 + 中央 PDF 页面 + 左侧按需文档摘要，不常驻右侧 Inspector。
- 文档摘要：左侧抽屉顶部用小图标切换书签、大纲、批注、缩略图。
- 视图设置：占用左侧工具区，提供单页/双页、无拆分/垂直/水平分屏。
- 页面管理：进入独立页面网格工作台，阅读区被替换。
- 批注模式：第二行上下文工具条。
- 导出模式：区分格式转换和交付工具。
- 搜索：顶部搜索框带搜索选项和历史菜单。

## 19. 当前设计差距

- 导出 / 水印 / 压缩 / Bates 模式拆分（ISS-013 后续 worker）。
- 左侧缩略图接批注 / 搜索 / OCR 标记的视觉化。
- 深色模式（当前仅亮色）。
- 多窗口 / 标签页支持。

### 2026-06-07 推进（ISS-030 ~ ISS-038）

- 工具栏克制化（48px、无品牌区、紧凑布局按钮）。
- 设置页 UI 统一（focus-visible、遗留 CSS 清理）。
- 欢迎页空态清理（移除占位文件、移除硬编码最近文件）。
- macOS 菜单栏中文化（Tauri v2 Menu API）。
- DESIGN.md 对齐 Folia / Funes 成熟结构。

## 20. 禁止事项

| 禁止 | 替代做法 |
| --- | --- |
| 在工具栏显示品牌 logo / 名称 | 品牌信息只在设置页关于 section 和应用图标 |
| 引入第二主题色 | 使用 accent + accent-soft 处理所有交互状态 |
| 使用浏览器默认蓝色 focus ring | 统一 accent 色 focus-visible |
| 硬编码色值 | 使用 CSS 变量 |
| 常驻侧边栏空面板 | 默认关闭，按需展开 |
| 工具栏高度超过 56px | 保持 48px |
| 使用 box-shadow 建立层级 | 使用颜色差异（surface vs surface-strong） |
| 新增组件不更新本文档 | 所有 UI 变更必须先确认设计规则 |
| 大面积 CSS 动画 / bounce | 无动画，仅 scrollIntoView smooth |
| 占位符数据展示为真实内容 | 空态时显示明确提示或隐藏区域 |
| 边框圆角超过 10px | 内联 6px、卡片 8px、面板 10px |

## 21. 设计评审与 AI 协作

### 评审清单

每次 UI 变更后检查：

1. 是否使用了 CSS 变量而非硬编码色值？
2. focus-visible 是否统一使用 accent 体系？
3. 新组件高度是否对齐现有密度（32px 按钮 / 34px 输入框）？
4. 圆角是否在 6–10px 范围内？
5. 是否引入了新颜色？如果是，是否必要且已更新颜色体系？
6. 侧边栏是否保持默认关闭？
7. 工具栏是否保持克制（无品牌区域、图标优先）？
8. 空态是否无占位符数据？
9. 是否有破坏性操作缺少确认？
10. 设置页控件是否遵循统一规范？

### AI 变更影响评估

AI 修改 UI 时必须回答：

1. 变更影响哪个区域（工具栏 / 侧栏 / 阅读区 / 设置页 / 上下文工具条）？
2. 是否引入了新颜色或新组件？
3. 是否增加了视觉噪音（不必要的边框、阴影、动画）？
4. 是否违反了"工具退居幕后"原则（工具栏应服务于阅读，不抢注意力）？
