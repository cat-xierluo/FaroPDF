# FaroPDF 设计系统

> Last updated: 2026-07-30
> 版本：3.1 — PDF Expert 功能框架优先与真实性门禁

## 设计目标

FaroPDF 是一个 PDF 阅读器，不是 Markdown 编辑器，也不是全能文件管理器。第一视觉永远是 PDF 页面。工具栏、侧边栏、批注列表和 OCR 面板都要服务于阅读、定位和交付。

关键词：

- 清亮：浅色纸面、低噪音工具栏、克制线条；应用壳层可在设置中切换浅色 / 深色。
- 快速：打开即可读，搜索和缩略图逐步可用。
- 专业：适合法律材料、长卷宗、扫描件和批注整理。
- 可回退：任何会改变 PDF 的操作都清楚展示输出和影响。

## 视觉原则

- 主背景默认使用接近纸张的暖白或浅灰；深色模式使用中性暗色壳层，不使用科技感大渐变。
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
| `--warning-bg` | 警告提示背景（OCR 提示、状态 banner） | `#fff8df` |
| `--warning-border` | 警告提示边框 | `#efd796` |
| `--warning-fg` | 警告提示文字 | `#5f4b00` |
| `--surface-soft` | 弱化面板背景（`color-mix` 中间色） | `#f6f8f9` |
| `--page-chrome` | PDF 页面 chrome 背景（缩略图、状态层） | `#f6f7f8` |

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

### PDF Expert 参考边界

FaroPDF 以 PDF Expert 的 macOS 信息架构、模式语义、面板联动和核心工作流作为功能参考。2026-07-30 用户明确不要求像素级或一比一视觉一致；颜色、间距和图标差异不阻塞功能完成。受版本控制的截图与量测仍用于可选视觉优化。

允许差异仅限：

- 使用 FaroPDF 品牌，不复制 PDF Expert 商标、专有图标和素材。
- 原文件不覆盖、破坏性操作输出副本、联网 OCR 先知情等安全规则继续优先。
- 截图无法证明的能力标记 `missing`，经明确产品决策暂不实现的能力标记 `YAGNI`。

历史 DECISIONS 或 TASKS 与本节冲突时不能静默择一执行；以 `docs/reference/pdf-expert/README.md` 定义的规范优先级为准，并记录 supersede 决策。

```text
┌──────────────────────────────────────────────┐
│ L2 Tabs: close · filename · +                 │
├──────────────────────────────────────────────┤
│ L3: navigation · zoom · workflows · collab · search │
├──────────────────────────────────────────────┤
│ L4: mode tools（read 时为空）                 │
├──────────┬───────────────────────┬───────────┤
│ L5a Left │ L5c PDF/Edit/Page Grid│ L5b Right │
│ optional │ always in the middle  │ optional  │
├──────────┴───────────────────────┴───────────┤
│ Status Bar: workflow-specific; reference read/edit/pages hide │
└──────────────────────────────────────────────┘
```

### Toolbar（40px）

L2 tab bar 与 L3 toolbar 是两个独立的 40px 行。L3 严格使用 5 段：`navigation / zoom / workflows / collaboration / search`。

| 区域 | 内容 |
| --- | --- |
| 导航区 | 文档摘要、页面管理、视图设置 |
| 缩放区 | 当前缩放百分比、缩小、放大 |
| 核心工作流区 | `A 批注`、`T 编辑`、导出、填写和签名、扫描和文本识别、更多工具 |
| 协作区 | 摘要、导出与交付 |
| 搜索区 | 常驻全文搜索输入框 |

规则：

- 无品牌区域（logo / 名称不占工具栏空间）。
- 图标优先，短标签辅助；图标按钮使用 `title` 属性提供无障碍文本。
- `A 批注`、`T 编辑`、导出、填写签名和 OCR 是 L3 直接入口；低频命令和设置由更多工具菜单承载。
- read 模式不渲染 L4；annotate / edit / OCR / forms / export 按状态渲染对应 L4。
- 内容编辑引擎接入后，`T 编辑` 必须进入单页内容编辑画布并显示 `文本 / 图像 / 链接 / 隐藏` L4；引擎未接通前，入口必须保持禁用并明确说明。
- 所有命令分为 `ready / partial / planned`；`planned` 必须 disabled 或由执行层 fail-closed，禁止用 toast、计数或状态切换冒充成功。
- 页面管理是左侧独立入口，进入页面卡片网格；不得与 `T 编辑` 复用 active mode。
- 左右栏默认折叠；任一侧栏出现时只能压缩 L5c，不能改变 L5a → L5c → L5b 的顺序。

### Utility Pane（当前基础默认：左 272px / 右 320px）

- 默认不显示；用户点击工具栏左侧按钮时展开对应面板。
- 缩略图、大纲、批注和书签共用 L5a。
- 页面书签与 PDF 自带大纲分开：书签是用户按页维护的本地 sidecar，支持添加当前页、跳转和删除；同页重复添加保持幂等，不在 UI 中制造重复条目。
- 设置页使用全屏 Portal 浮层，不占用左侧区域。
- 当前 `panelWidthStore` 基础默认左 272px、右 320px。已量测的搜索右栏单独使用 240px，形状右栏单独使用约 380px；不得把某个 surface 的宽度当作全局右栏宽度。其余 panel 的精确宽度仍由 M1 补采确定。
- 缩略图标记当前页、搜索命中、批注存在和 OCR 状态。
- 大卷宗下缩略图必须懒加载。

### Reader

- 支持连续、单页、双页和适合宽度。
- 当前页保持清晰边界，但不使用厚重阴影。
- 搜索命中使用半透明高亮；当前命中由命中层和右栏选中态表达，不给整页增加蓝色外框。
- 单页/双页模式下点击页边空白翻页（左半 → 上一页，右半 → 下一页）。

### Task Workspaces

复杂任务进入独立工作台或上下文工具条：

- 搜索：顶部关键词输入；命中结果进入 L5b。
- 批注：上下文工具条（高亮、下划线、删除线、笔记、图章、签名）；批注扁平化归入侧栏确认，不进入导出二级工具条。
- OCR：上下文工具条（识别文本、输出双层 PDF、质量检查）+ 独立工作区。
- `T 编辑`：G05 measured 参考态保留 272px 大纲左栏，L5c 保持以整窗中心线对齐的单页 ReaderCanvas，L4 显示 `文本 / 图像 / 链接 / 隐藏`。当前只达到 `skeleton`；未接通动作不得以可用按钮或成功提示冒充。
- 页面管理：L5c 切换为响应式页面卡片网格；页面命令位于其独立操作栏。列数由 measured spec 和可用宽度决定，禁止固定写成 5 列。
- 导出：交付工具优先（水印、页眉页脚、页码、Bates、压缩、扁平化）；水印 / 页眉页脚 / 编号 / 压缩参数进入导出模式右侧面板，不平铺到顶栏。
- 表单：上下文工具条只展示已接通动作（读取字段、填写、签名、扁平化导出）；表单扁平化从工具启动器 / 原生菜单进入填写和签名面板确认，不平铺到顶栏。

### 完成等级

UI 任务仍可记录 `skeleton → wired → behavior-complete → visually-verified`，但产品功能完成以 `behavior-complete` 为准：入口接真实模块、产物可重开、错误可见。`visually-verified` 是可选精修等级，不再阻塞功能交付。

## 4. 组件样式

### 按钮体系

| 类别 | 高度 | 边框 | 最小宽度 | 用途 |
| --- | --- | --- | --- | --- |
| `.tool-button` | 28px | 1px solid border | 58px | 工具栏主按钮 |
| `.tool-button--primary` | 28px | accent 色 | 58px | 主操作（选择文件、前往 OCR） |
| `.tool-button--compact` | 28px | 无边框 | 32px | 布局按钮（摘要、管理、视图） |
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

- L2 titlebar、L3 主工具栏均为 40px；annotate/edit 的 L4 为 43px，页面管理 L4 为 44px；read 不渲染 L4。
- 设置面板圆角 10px，最大宽度 960px，最大高度 720px。
- 设置导航项 8px padding，行高 18px。
- 列表项最小高度 34px。
- 搜索浮层最大高度 `min(460px, calc(100vh - 112px))`。
- 上下文工具条高度按 surface 使用 43px 或 44px。
- read/annotate/edit/pages 参考态隐藏状态栏；OCR 等仍需要状态信息的工作流保留现有状态栏。
- spacing token 遵循 4px/6px/8px/12px/16px/20px 体系；40/43/44px 属于 measured 层高例外，不拿层高反推 spacing。

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
- 只展示已接通的入口；当前图片转 PDF / Word 转 PDF 未接通时不显示，避免空态出现假按钮。
- 不显示硬编码占位文件名或缩略图。
- 无真实最近文件时，"最近文件"区域不显示。
- 工具栏模式按钮可用（进入对应工具条/工作台空态）。
- 未打开文档时不展示旋转、适合页面等文档专属阅读辅助按钮；页码控件使用 `- / -` 占位，不显示 `1 / 0`。

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
| 一级/二级分层 | 常用阅读操作在工具栏；专业工作流从工具启动器进入，再用上下文工具条承载 |
| 侧边栏默认关闭 | 不常驻空侧栏；用户主动点击才展开 |
| 布局控件收左上角 | 摘要/管理/视图使用紧凑图标按钮，无边框 |
| 图标优先 | 文字标签仅在空间充足时显示 |
| 模式按钮切换上下文 | 不常驻多个工具条，只显示当前模式工具条 |

任务模式入口和低频 PDF 命令必须进入右侧 `工具` 工作流启动器，按 `组织页面 / 交付导出 / 标注填写 / 扫描 OCR` 分组；`OCR / 批注 / 填写和签名 / 导出` 不得回到阅读态顶栏平铺。导出模式二级工具条只保留 `文字水印 / 图片水印` 这类高频交付按钮；水印 / 页眉页脚 / 页码 / Bates / 压缩参数由右侧 `交付设置` 面板承载。

填写签名模式的二级工具条只放真实可执行动作；日期、勾叉、图章、图像等未完整接线能力不得作为可见按钮占位。`表单扁平化` 属于 `标注填写` 分组下的三级命令，进入填写和签名面板后由面板承载字段读取、状态提示和导出确认。

`批注扁平化` 属于 `标注填写` 分组下的三级命令和原生工具菜单入口。触发后只负责进入批注模式并打开批注侧栏；侧栏在有批注时显示 `扁平化导出` 动作，导出 `*-annotations-flattened.pdf` 新副本。无批注时不显示可点击的扁平化假入口。

工具启动器只展示分组标题和命令名；命令说明可以作为 `title` 等辅助信息保留，但不作为可见正文堆叠，避免菜单变成说明面板。

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
| 文件 | 新建窗口、打开…、另存为…、关闭窗口 |
| 编辑 | 撤销、重做、—、剪切、复制、粘贴、全选（PredefinedMenuItem） |
| 视图 | 文档摘要、页面管理、视图设置、—、全屏 |
| 工具 | 添加页码、Bates 编号、页眉页脚、文字水印、图片水印、压缩、批注扁平化、表单扁平化 |
| 窗口 | 最小化、—、关闭窗口 |
| 帮助 | 关于 FaroPDF |

规则：

- macOS 原生菜单使用中文标签。
- 编辑菜单使用 `PredefinedMenuItem` 获得系统原生行为。
- 视图菜单项对应工具栏左侧布局按钮的功能。
- 工具菜单项使用与 `AppCommandId` 一致的 id，经 `faropdf://command` 事件桥接到前端 command model；不得在 Rust 菜单事件里复制 PDF 业务分支。
- `新建窗口`、`全屏`、`关闭窗口` 属于系统窗口动作，由 Rust 菜单事件直接处理，不进入前端 PDF 业务 command catalog，也不得显示“后续补齐”式提示。
- `文件 > 打开…` 走 Tauri dialog 选择 PDF，再由专用读取 command 将 bytes 交给 reader；不开放通用 fs scope。
- `帮助 > 关于 FaroPDF` 进入设置浮层的 `关于` section，不在帮助菜单放置在线文档链接。

## 13. 批注交互

- 选择文本后出现浮动批注条：高亮、下划线、删除线、备注。
- 批注工具栏提供矩形、椭圆、直线、单向/双向箭头、文本框、手写和图章；arm 形状时打开 shape 右栏，切回非形状工具时关闭该右栏。
- shape 右栏的线型、线宽、不透明度、边框色与填充色必须进入批注领域状态和 sidecar，不能只改变控件选中态；填充色只作用于矩形/椭圆，线条类忽略填充。
- 批注 overlay 必须与当前页容器 bbox 重合，并把 DOM 左上坐标转换为 PDF 左下用户空间；不得覆盖整个 workspace 后再按页面尺寸缩放。
- 批注列表按页码排序，可按颜色、类型和关键词筛选。
- 删除批注要可撤销。
- 批注摘要导出时保留页码、类型、内容和上下文。
- 批注扁平化导出只在批注侧栏内确认；有批注时显示动作，无批注时只显示空态说明。

## 14. OCR 交互

- 无文字层时在阅读区顶部显示提示条 + "前往 OCR 模式"按钮，不弹出阻塞对话框。
- OCR 后端选择放在 OCR 面板内。
- 联网 OCR 必须展示隐私提示和确认操作。
- 任务运行中展示进度、后端、页码范围和输出路径。
- OCR 完成后提供打开输出 PDF、搜索抽查和替换当前阅读文件三个动作。

## 15. 页面整理交互

- 页面整理进入独立网格视图，避免在普通阅读时误删页面。
- 上移、下移、删除、旋转支持撤销；重排只在页面管理工作台内出现，不进入阅读态顶栏或导出二级工具条。
- 导出按钮明确显示"另存为新 PDF"。
- 页面管理工作台的页面卡必须反映真实状态变化，例如重排后的顺序、旋转角度和删除后的活动页计数，不允许只维护视觉计数。
- 页面管理另存必须通过真实 `page-operations execute` 输出新 PDF，不覆盖原始文件。
- 水印、Bates 编号和页码添加必须提供关键参数和预览 / 文件选择状态。
- 页眉页脚 / 页码 / Bates / 压缩从 `工具` 菜单进入导出模式后，面板内使用 `页眉页脚 / 普通编号 / 证据编号 / 压缩` 切换，避免把命令名再次堆到二级工具条；文字 / 图片水印从二级工具条切换同一面板。表单扁平化不进入导出工具条，归属填写和签名面板；批注扁平化同样不进入导出工具条，归属批注侧栏。

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

## 18. PDF Expert 证据与现行目标

受版本控制的现行证据只在 `docs/reference/pdf-expert/`。`research/pdf-expert/` 是历史采集区，文件名和 catalog 中存在自动化误触，不再直接作为实现规格。

### 18.1 已确认的信息架构

- L2 tab bar 位于 L3 toolbar 上方。
- L3 有五个语义区域：navigation / zoom / workflows / collaboration / search。
- read 状态不显示 L4；annotate/edit 的 measured L4 为 43px，页面管理的 measured L4 为 44px，其他 mode 继续逐态取证。
- L5 的稳定顺序是左栏 / 中央内容 / 右栏；两栏均为可选。
- 中央内容在 read/edit 为单页 PDF；页面管理才切换为页面卡片网格。
- 搜索、签名、图章等状态存在右侧上下文面板。

这些是信息架构目标，不代表 FaroPDF 已经视觉对齐。

### 18.2 当前证据不能证明的内容

- 没有 accepted-golden，不能确定精确色值、字号、icon、padding、gap、阴影、圆角和动画。
- R15 只证明所捕获窗口下为 4+1 页卡；不能推导固定 5 列。
- R04 是大纲而不是缩略图；R05 没进入批注；R14 是 welcome 而不是批注摘要。
- 双页、左栏真实 thumbnails、text selection、forms、export 和拖动过程仍缺可靠证据；annotate、edit 大纲结果态、页面管理五卡与搜索双栏已有 measured 证据，但仍非 accepted-golden。
- raw 图片普遍带桌面背景，不能直接做全图像素比较。

### 18.3 FaroPDF 当前视觉策略

- 在 accepted-golden 建立前，保留现有 token 体系作为临时产品主题，不声称与 PDF Expert 相同。
- 未来视觉校准以目标主题的规范化 capture 为准；浅色和深色需要分别验收。
- 不因“高保真”复制商标或专有资产，但必须尊重已证实的层级、位置、密度和交互顺序。
- 所有 UI 现状与完成等级见 `docs/reference/pdf-expert/implementation-map.md`。

## 19. 当前设计差距与推进边界

- 全局 shell 已通过部分几何门禁，但主题、密度和图标尚未视觉验证。
- `edit` 仍是内容编辑 skeleton（L4 显式禁用），但 G05 的大纲左栏与单页几何已接线；页面管理已独立挂载 `PageOrganizerWorkspace` 并渲染真实 PDF canvas，硬编码 A4 文案和 placeholder 页面动作仍需在 M3 纠正。
- RightPanel 是混合状态：容器存在不等于 summary、OCR、shape、签名、图章和搜索全部完成。
- forms/export 有功能底座，但缺参考状态与视觉验收。
- Welcome、文本选区、多 tab、菜单和异常状态都需要按证据等级重新验收。
- 下一步顺序只读 `docs/TASKS.md` 的 ISS-NEW-M，不从本节或历史 DEC 领取任务。

## 20. 禁止事项

| 禁止 | 替代做法 |
| --- | --- |
| 在工具栏显示品牌 logo / 名称 | 品牌信息只在设置页关于 section 和应用图标 |
| 引入第二主题色 | 使用 accent + accent-soft 处理所有交互状态 |
| 使用浏览器默认蓝色 focus ring | 统一 accent 色 focus-visible |
| 硬编码色值 | 使用 CSS 变量 |
| 常驻侧边栏空面板 | 默认关闭，按需展开 |
| 把 L2/L3/L4 合并成单层工具栏 | 保持 40px / 40px / 43–44px 分层；read 不渲染 L4 |
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
3. 新组件高度是否对齐现有密度（L3 28px 按钮 / 34px 输入框）？
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
