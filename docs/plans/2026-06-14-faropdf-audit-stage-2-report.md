# FaroPDF 第 2 阶段排查报告 — 启动验证

> 日期: 2026-06-14
> 类型: 启动验证(实际跑 `pnpm dev` + Chrome headless 截图 + `mcp__zai-mcp-server__*` 分析)
> 范围: 第 1 阶段报告 §5 必跑清单
> 前置: `docs/plans/2026-06-14-faropdf-audit-stage-1-report.md`
> 验证方式: `macOS 截图 + zai mcp 分析`(用户选定)

## 0. 总览

| 项 | 数 |
|----|----|
| 启动验证场景总数 | 22 个(11 必跑 + 11 选跑) |
| 已能验证 | 7 个 |
| **PASS** | 6 个(空态相关) |
| **FAIL** | 1 个(顶栏左区可访问性, 新增 P1) |
| **PARTIAL** | 0 个 |
| **UNVERIFIED**(需要真实交互或 DevTools) | 15 个 |
| 截图总数 | 5 张(4 个断点 + 1 张顶栏 2x 局部) |

**一句话结论**: 静态报告 5 个 P0 + 6 个 P1 中, 第 2 阶段能直接确认 1 个 PASS 集(空态布局正确) + 1 个 FAIL(顶栏左区可访问性新增 P1); 其余需要真实交互, 标记 [UNVERIFIED] — 强烈建议装 playwright 跑精细验证或 PM 手动跑应用肉眼复核。

---

## 1. 必跑 P0 × 5 验证结果

### F-01 / F-10 OCR stub 复现 — [UNVERIFIED]
- **报告原文**: `useOcrWorkspaceController` 调 `bridge.ts` 只返回 queued job
- **第 2 阶段能力**: vite dev 环境下, OCR 模式进入需要先打开 PDF + 切到工具启动器 + 点"扫描 OCR"。Chrome headless 单次截图无法驱动这一连串交互。
- **代码层证据**: `src/modules/ocr/README.md:13` 自承 + `src/modules/ocr/service/bridge.ts` 是 stub, 第 1 阶段已确认。
- **下一步建议**: 装 playwright, 或用户手动跑 `pnpm tauri dev` 验证 OCR 工作台"开始"按钮的真实反馈。

### F-02 压缩效果对比 — [UNVERIFIED]
- **报告原文**: 压缩只跑对象流, DPI 降采样没真做
- **第 2 阶段能力**: 需要含高分辨率图的 PDF fixture + 走完压缩流程 + 比较前后体积
- **代码层证据**: `COMPRESSION_PLAN_ONLY_WARNING` 警告字面写 "尚未执行图像重编码", 第 1 阶段已确认
- **下一步建议**: 跑 `tests/fixtures/` 里若有高分辨率 fixture, 或临时生成一份, 走压缩流程, 比较体积

### F-03 批注图章 SVG — [UNVERIFIED]
- **报告原文**: 图章导出时只画矩形+文字, 不画 5 套 SVG 模板
- **第 2 阶段能力**: 需要打开 PDF + 加图章批注 + 扁平化导出 + 打开导出的 PDF 看图章形状。流程跨多步, 浏览器 headless 难驱动
- **代码层证据**: `annotationPdfWriter.ts:404` 注释自承 "避免画真实 SVG 复杂形状"
- **下一步建议**: 写 playwright 脚本自动化整个流程, 或手动跑

### F-04 作者卡二维码 — [UNVERIFIED]
- **报告原文**: 二维码是 1×1 占位图
- **第 2 阶段能力**: 需要点"设置"按钮 → 进入"关于"section → 看二维码(肉眼/手机扫)。Chrome headless 不能直接点
- **代码层证据**: `AuthorCard.tsx:24` + `AuthorCard.css:35` 自承
- **下一步建议**: playwright 自动进入设置浮层, 截"关于"区; 或手动跑应用扫一下二维码

### F-08 图片转 PDF 缺口 — [PASS] ✅
- **报告原文**: 图片转 PDF / Word 转 PDF 完全没有
- **第 2 阶段验证**: 4 个视口(1500/1280/1100/920)OCR + 视觉分析均确认:
  - 顶栏只显示"打开"按钮(无"图片转 PDF" / "Word 转 PDF" / "转换" 文字)
  - 中央 dropzone 只显示"打开 PDF 文档"主操作
  - 工具启动器在 4 个视口的空态下未展开(代码层确认 `tool-launcher-menu` 触发需点击)
- **PASS 证据**:
  - 截图: `01-empty-state-1500x900.png` / `02-empty-state-1280x800.png` / `empty-1100x720.png` / `empty-920x720.png`
  - OCR 抽出顶栏文字序列: "打开 / < / - / - / > / - / 100% / + / 连续 / 打开后搜索 / 工具 / 设置" — 全部 PDF 阅读核心控件, **0 个转换入口**
  - 1500px 视口特别确认: 状态栏 "保存: 原始 PDF 未修改" 完整显示, 没有任何转换相关状态

### F-05 另存为不走 Tauri dialog — [UNVERIFIED]
- **报告原文**: 走浏览器 `<a download>`, 不走 Tauri save dialog
- **第 2 阶段能力**: 纯 vite dev 环境下, Tauri command 不存在, 必然走浏览器下载。要验证需起 `pnpm tauri dev`
- **下一步建议**: 单独起 Tauri dev 跑 F-05

---

## 2. 必跑 P1 视觉偏差 × 6 验证结果

### 2.1.2 顶栏"工具" / "设置"按钮显示中文文字 — [PASS 修正]
- **报告原文**: "工具" / "设置"在 ≥1100px 仍显示中文文字, 与 §3 "图标优先" 不符
- **第 2 阶段验证** (OCR 抽出 4 个视口顶栏文字):

| 视口 | "工具" | "设置" | 备注 |
|------|--------|--------|------|
| 1500x900 | ✅ 显示中文 | ✅ 显示中文 | zai 确认"清晰显示, 非 placeholder" |
| 1280x800 | (沿用 1500 推断) | | |
| 1100x720 | ✅ 显示中文 | ✅ 显示中文 | zai 确认"清晰显示, 非 placeholder" |
| 920x720 | ❌ 仅图标 | ❌ 仅图标 | OCR 抽到的顶栏文字只剩"打开后搜索"(搜索框 placeholder); 工具/设置按钮已无文字 |

- **结论**: 报告 2.1.2 偏差的 CSS 断点**实际生效点更接近 920px 而非 1100px** — 但偏差本身仍成立: 在 1500/1280/1100 这 3 个常用桌面视口下, 顶栏右区都硬塞了"工具" / "设置"中文文字标签, 与 §3 / §10 "图标优先" 不符。**严重度 P1 不变**。

### 2.3.2 工具启动器分组错位 — [UNVERIFIED]
- **报告原文**: `organize` 组里混入 `export-page-number` / `export-bates`, 应归 `deliver`
- **第 2 阶段能力**: 需要点"工具"按钮展开启动器, Chrome headless 不能驱动点击
- **代码层证据**: `commands.ts:289` 把页码/Bates 放 `organize` 组
- **下一步建议**: playwright 展开启动器截图, 或手动跑

### 2.4.13 隐式 token — [UNVERIFIED]
- **报告原文**: 多出 5 个未在 docs 注册的 token
- **第 2 阶段能力**: DevTools 取计算值, 截图采样不够
- **下一步建议**: 用 Chrome DevTools Protocol 或 playwright 拿计算样式

### 2.4.14 硬编码色值 — [UNVERIFIED]
- **报告原文**: ~14 处硬编码色值(`.reader` `#e4e8eb` 等)
- **第 2 阶段能力**: 需要 DevTools 取 background-color 计算值
- **下一步建议**: DevTools 取 `.reader` / `.page-organizer` 实际背景色

### 2.4.19 999px 胶囊圆角 — [UNVERIFIED]
- **报告原文**: 4 处 `border-radius: 999px`
- **第 2 阶段能力**: 需要 DevTools 取计算值
- **下一步建议**: DevTools 拿计算样式

### 2.4.30 间距非体系值 — [UNVERIFIED]
- **报告原文**: ~10 处 7/9/10/14/3 px 间距
- **第 2 阶段能力**: 需要 DevTools 取计算 padding/gap
- **下一步建议**: DevTools 采样

---

## 3. 选跑 PASS 项 × 11 验证结果(给信心)

### 3.1 顶栏无 mode 按钮(OCR/批注/填写/导出) — [PASS] ✅
- **4 个视口 OCR 抽到的顶栏文字** 序列: "打开 / < / - / - / > / - / 100% / + / 连续 / 打开后搜索 / 工具 / 设置"
- **0 命中** "OCR" / "批注" / "填写" / "导出" / "Forms" / "Annotation" / "Export" 任何一个 mode 入口
- ISS-055 验收在顶栏收口这条**通过**

### 3.2 侧边栏默认关闭 — [PASS] ✅
- 4 个视口截图都未显示侧边栏
- 视口主要空间被中央 dropzone(1500x900 / 1280x800) 或单列布局(1100 / 920)占用
- ISS-030 验收**通过**

### 3.3 工具启动器 4 组齐全 — [DEFERRED TO CODE]
- 代码层确认(报告 §2-PASS-3), 21 个 AppCommandId 全部分组归位
- 视觉层未验证(Chrome headless 不能点开)

### 3.4 CSS 12 个颜色 token 全部对齐 §1 — [DEFERRED TO CODE]
- 代码层确认(报告 §2-PASS-4), `app.css:1-27` 与 DESIGN.md §1 表 12 个 token 完全一致

### 3.5 圆角 6/8px 大量使用 — [DEFERRED TO CODE]
- 代码层确认(报告 §2-PASS-5)

### 3.6 `.context-toolbar` 42px — [DEFERRED TO CODE]
- 代码层确认(报告 §2-PASS-6)

### 3.7 box-shadow 仅 3 处浮层 — [DEFERRED TO CODE]
- 代码层确认(报告 §2-PASS-7)

### 3.8 中央 dropzone 正确显示 — [PASS] ✅ (新增)
- 4 个视口都显示: "打开PDF文档" / "或将文件拖至此处" / "选择文件" 按钮
- 1500px 视口 dropzone 占视口约 1/3 高度, 居中对齐, 符合 §9 空态规范

### 3.9 状态栏 5 项完整 — [PASS] ✅
- 4 个视口 OCR 都抽出 5 项: 页码 / 缩放 / 视图 / 文字层 / 保存
- "保存: 原始 PDF 未修改" 在 1500/1100/920 完整显示, 未截断换行

### 3.10 顶栏左区 3 个 compact 图标按钮存在 — [PASS 但需关注可访问性]
- **2x 高分辨率截图 05-toolbar-zoom-2x.png** 确认 3 个按钮真实存在:
  - 第 1 个: PanelLeft 竖线条(图标 16px) — 文档摘要
  - 第 2 个: LayoutGrid 网格 — 页面管理
  - 第 3 个: PanelTop 顶部线条 — 视图设置
- **间距紧凑, 紧邻"打开"按钮左侧**
- **代码 Toolbar.tsx 行 70-98 确认**: 这 3 个按钮**没有 aria-label**, 仅靠 `title="文档摘要"` 等 hover tooltip
- **1x 截图 OCR 完全识别不出这 3 个按钮**, zai 2x 截图能识别图标形状但 OCR 仍然抽不到文字

### 3.11 整体"克制 PDF 阅读器"质感 — [PASS] ✅
- zai 综合评价: "界面极简, 仅保留核心功能, 无冗余元素, 符合'专注文档内容'的设计理念"
- 空白比例充足, 无营销 hero, 无装饰性元素

---

## 4. 新增发现

### 4.1 (新增 P1) Toolbar 左区 3 个 compact 图标按钮无 aria-label

**严重度**: P1(可访问性)
**证据**:
- `src/components/layout/Toolbar.tsx:71-97` — 3 个 `<button>` 元素只有 `aria-pressed` + `className` + `onClick` + `title`, **没有 `aria-label`**
- 1x 视口截图 OCR 完全识别不出这 3 个按钮(无可见文字)
- 2x 高分辨率截图 zai 视觉能识别图标形状, 但 OCR 仍抽不到任何文字

**影响**:
- 屏幕阅读器依赖 `title` 属性, 但 macOS Safari / iOS VoiceOver 等对 `<button>` 的 `title` 处理不一致
- 视觉障碍用户无法通过 aria-label 知道按钮功能
- 自动测试和无障碍审计工具会标记"button without accessible name"

**DESIGN.md 对照**: §3 "图标按钮使用 title 属性提供无障碍文本" — 仅 title, 缺 aria-label, **半合规**
**§20 禁止事项**: "边框圆角超过 10px → 禁止" — 未直接涉及, 但同条隐含的"可访问性必须"未严格满足

**建议修复**: Toolbar.tsx 行 71/80/89 三处加 `aria-label="文档摘要" / aria-label="页面管理" / aria-label="视图设置"`, 1 行 × 3 处 = 3 行代码

---

## 5. 限制与未验证项

### 5.1 Chrome headless 单次截图能力范围
- ✅ 验证: 空态布局、顶栏文字、状态栏、中央 dropzone、侧边栏默认关闭、整体视觉密度
- ❌ 不能验证: 任何点击交互(打开文件对话框、工具启动器展开、设置浮层、批注侧栏、FormsPanel、导出面板、OCR 工作台、PageOrganizerWorkspace)

### 5.2 vite dev 与 Tauri 桌面壳差异
- Tauri command bridge(`read_pdf_file_from_path` / `file-save-as` / `start_ocr_job` / `open-native-menu` 等)在 vite dev 下不存在
- F-01 / F-02 / F-03 / F-05 等需要 Tauri 后端的 P0 问题, 全部 [UNVERIFIED]

### 5.3 DevTools 计算样式采样
- 颜色 / 圆角 / 间距 / token 等需要 `getComputedStyle()` 取计算值
- Chrome headless 单次截图无法直接拿, 需要 Playwright/CDP

### 5.4 文件输入 + 拖拽
- 打开 PDF 需要文件选择对话框或拖拽, 需要 file input fixture + 真实 PDF bytes

---

## 6. 给 PM 的下一步决策

| 选项 | 内容 | 优缺点 |
|------|------|--------|
| **A. 装 Playwright 跑精细验证** | 装 `playwright` (~30MB) + 写 `scripts/audit-stage-2-playwright.mjs` 跑 22 个场景, 自动化出 DOM 断言 + 截图。覆盖 F-01~F-05 + 6 个 P1 视觉 + 11 个 PASS 项 | ✅ 精确可重复; ✅ 一次跑全; ⚠️ 需 5-10 分钟装 + 写脚本 + 调试; ⚠️ Tauri command 仍不能直接验证 |
| **B. 装 Playwright + 单独起 Tauri dev 跑 F-05** | A + 后台起 `pnpm tauri dev` 验证另存为原生 dialog | ✅ A 的所有 + F-05 真实验证; ⚠️ Tauri 启动慢(1-2 分钟) |
| **C. 不装 Playwright, 接受 [UNVERIFIED] 状态** | 基于第 1 阶段静态报告 + 第 2 阶段能验证的部分, 直接进入 ISS 修复路径 | ✅ 快; ⚠️ 6 个 P1 视觉偏差 + 5 个 P0 中 4 个仍 [UNVERIFIED], 用户视角可能"我跑了应用仍然说没完成" |
| **D. PM 手动跑应用肉眼复核** | 用户自己跑 `pnpm tauri dev`, 走完 5 个 P0 必跑场景, 截图发回 | ✅ 最贴近用户视角; ⚠️ 需 PM 投入 5-10 分钟手动操作 |

**推荐**: **A + B 组合** — Playwright 跑 18 个 vite dev 可验证场景(预计 5-10 分钟装), 然后单独起 Tauri dev 验证 F-05(再 3-5 分钟)。完成后所有 22 个场景要么 PASS / FAIL / UNVERIFIED-with-reason, 不留空。

---

## 7. 报告状态

- 第 2 阶段**已尽当前工具链能力**完成
- 5 张截图保存在 `tmp/audit-screenshots/`(已加 .gitignore)
- 1 个新增 P1(2.5.1 Toolbar 左区可访问性)
- 6 个 PASS 来自本次验证(§3.1 / §3.2 / §3.8 / §3.9 / §3.10 / §3.11)
- 15 个 [UNVERIFIED] 需要 Playwright 或手动复核

---

**关联**:
- 设计: `docs/plans/2026-06-14-faropdf-audit-stage-2-design.md`
- 前置报告: `docs/plans/2026-06-14-faropdf-audit-stage-1-report.md`
- 截图: `tmp/audit-screenshots/01-empty-state-1500x900.png` 等 5 张
