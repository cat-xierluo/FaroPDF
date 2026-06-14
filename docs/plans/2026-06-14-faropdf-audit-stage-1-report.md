# FaroPDF 第 1 阶段排查报告 — 静态扫描

> 日期: 2026-06-14
> 类型: 静态扫描(不启动 Tauri,仅基于代码 + 文档)
> 范围: 维度 1 功能交付真实性 / 维度 2 PDF Expert 视觉偏差 / 维度 3 ROADMAP 优先级偏差
> 关联设计: `docs/plans/2026-06-14-faropdf-audit-stage-1-design.md`

---

## 0. 总览

| 维度 | 发现数 | P0 | P1 | P2 | 通过 |
|------|--------|----|----|----|----|
| 1. 功能交付真实性 | 12 条 | 2 | 3 | 4 | 3 |
| 2. PDF Expert 视觉偏差 | 18 条 | 0 | 6 | 5 | 7 |
| 3. ROADMAP 优先级偏差 | 5 条核心 + 17 ISS 审计 | 3 | 2 | 0 | 0 |
| **合计** | **35 条** | **5** | **11** | **9** | **10** |

**最关键一句话**: 用户三类反馈都成立 —

- **运行时**确认 2 个 P0 真没完成(OCR 是 stub / 图片转 PDF 是战略缺口);
- **视觉**确认 6 个 P1 偏差(分组错位 / 文字标签 / 硬编码色值 / 非体系圆角 / 间距 + 999px 胶囊);
- **优先级**确认 14/17 个最近 ISS 与用户"做错功能"主诉错位(只有 ISS-044/046/047 真正回应"功能没完成")。

但**好消息是**: ISS-055 顶栏任务模式入口收口 + ISS-030 侧边栏默认关闭 + 21 个 AppCommandId 全部分组归位 + 12 个 CSS 颜色 token 全部对齐,核心机制其实已经搭好,问题集中在"细节没到位"和"主诉没回应"。

---

## 1. 维度 1 — 功能交付真实性(12 条)

> 详细证据见 Agent 1 报告,本节为综合版。

### 1.1 P0 关键问题(2 条)

| 编号 | 问题 | 文档原话 | 代码位置 | 用户反馈对应 |
|------|------|----------|----------|--------------|
| **F-01 / F-10** | **OCR 模式整个是 stub**:`useOcrWorkspaceController` 调 `bridge.ts` 只返回 queued job, 不真跑 OCR / 不生成双层 PDF / 不发起联网请求 | `src/modules/ocr/README.md:7,13` 自承 "Tauri command 当前只返回 queued job, 不执行真实 OCR" | `src/modules/ocr/service/bridge.ts` | 用户点 OCR 永远"已加入队列" / 没结果 |
| **F-08** | **图片转 PDF / Word 转 PDF 完全没有**(不是清理,是缺口) | CHANGELOG 0.1.0-alpha.19 写 "空态移除未接通的图片/Word 转 PDF 按钮" — 但全仓 grep 0 命中 = 功能不存在 | (无代码) | 用户用 PDF 工具常期待"把图片合成 PDF" |

### 1.2 P1 重要问题(3 条)

| 编号 | 问题 | 文档原话 | 代码位置 |
|------|------|----------|----------|
| **F-02** | **PDF 压缩只跑对象流压缩, DPI 降采样 + 真实图像重编码没真做** | CHANGELOG 0.1.0-alpha.20 自承 "DPI 降采样仍保留后续深化";代码里 `COMPRESSION_PLAN_ONLY_WARNING` 警告字面写 "尚未执行图像重编码" | `src/modules/export/pdfOperationEngine.ts:23,445`; `src/modules/export/README.md:16` |
| **F-03** | **批注图章工具导出时只画矩形+文字, 不画 5 套 SVG 模板形状** | `annotationPdfWriter.ts:404` 注释自承 "避免画真实 SVG 复杂形状" | `src/modules/annotation/annotationPdfWriter.ts:404-405` |
| **F-04** | **作者卡微信二维码是 1×1 占位图** | `AuthorCard.tsx:24` JSDoc "ISS-029 替换占位图为真实二维码" | `src/components/settings/AuthorCard.{tsx:24,css:35}` |

### 1.3 P2 次要问题(4 条)

| 编号 | 问题 | 代码位置 |
|------|------|----------|
| F-05 | 另存为用浏览器 `<a download>`, 不走 Tauri save dialog — 桌面壳里用户希望走原生保存对话框 | `src/modules/reader/useReaderController.ts:297-315` |
| F-06 | 批注扁平化是二跳: 命令只切侧栏视图, 不直接执行 | `AppShell.tsx:253-257` |
| F-07 | 表单扁平化同上, 命令路径不直连 | `AppShell.executeCommand` 无 `forms-flatten` 分支 |
| F-12 | `file-save-as` 在更多菜单(三级), 不在顶栏 / 一级 utility | `src/shared/app/commands.ts:90` |

### 1.4 通过项(3 条)

| 编号 | 项 | 证据 |
|------|-----|------|
| F-PASS-1 | 7 种 pdfOperationEngine operation 的 UI 入口除压缩外都真接通 | `ExportDeliveryPanel` / `AnnotationSidebar` / `FormsPanel` / `PageOrganizerWorkspace` |
| F-PASS-2 | `picture-to-pdf` / `word-to-pdf` 等占位按钮全仓已无 | grep 0 命中 |
| F-PASS-3 | `help-about` / `mode-ocr` / `mode-forms` 等命令路由清晰 | `commands.ts` + `AppShell` 接线对得上 |

---

## 2. 维度 2 — PDF Expert 视觉偏差(18 条)

> 详细证据见 Agent 2 报告,本节为综合版。

### 2.1 P1 关键问题(6 条)

| 编号 | 偏差点 | DESIGN.md 规定 | 代码实际值 |
|------|--------|----------------|------------|
| **2.3.2** | `organize` 分组里混入 `export-page-number` / `export-bates`, 应归 `deliver` | §3/§10/§15 "水印/页眉页脚/页码/Bates/压缩参数由右侧交付设置面板承载" | `commands.ts:289` 把页码/Bates 放 `organize` 组, 与右栏"交付设置"概念错位 |
| **2.1.2** | 顶栏"工具" / "设置"按钮始终显示中文文字标签 | §3 "图标优先, 短标签辅助"; §10 "图标优先, 文字标签仅在空间充足时显示" | `tool-button--icon` 强制 `<span>工具</span>` / `<span>设置</span>`, 仅 1100px 以下 `display: none` |
| **2.4.13** | 多出 5 个未在 docs 注册的隐式 token | §1 只列 12 个 | 多出 `--surface-soft` / `--warning-bg` / `--warning-border` / `--warning-fg` / `--page-chrome` |
| **2.4.14** | CSS 中 ~14 处硬编码色值(违反 §1 + §20 禁令) | "所有颜色通过 CSS 变量定义, 不硬编码色值" | 行 803/817/821/825/891/922/934/949/961/1098/1097/1172/1180 共 ~14 处 `#fff` / `#d6a820` / `#2374ab` / `#e4e8eb` / `#f3f5f6` 等 |
| **2.4.19** | 999px 胶囊形圆角(违反 §20 "圆角超过 10px 禁止") | 6/8/10px 体系, 禁超 10px | 行 703/801/1082/1162 共 4 处 `border-radius: 999px` |
| **2.4.30** | 间距体系外 ~10 处奇数 / 非体系值 | §5 "所有间距遵循 4/6/8/12/16/20px 体系, 不使用奇数值" | 行 10/145/417/471/525/615/634/683/745/921 共 ~10 处 7/9/10/14/3 px |

### 2.2 P2 次要问题(5 条)

| 编号 | 偏差点 | 严重度 |
|------|--------|--------|
| 2.1.1 | pager 区 "1/24" / "100%" / 视图 select 文字始终占位不消失, ≥1100px 不缩成图标 | P2 |
| 2.1.3 | pager 区 48px 内塞 8+ 元素, ModeActiveTools 在 read 模式会追加 3 个 reader 按钮 | P2 |
| 2.4.16-18 | 多处 4/5/7px 圆角不在 §5 规定内 | P2 |
| 2.4.23 | `.toolbar` 用 `min-height: 48px` 而非 `height`, 内容可能撑高 | P2 (实际未超) |
| 2.4.26 | 状态栏实际渲染 ~30px 略超 §5 规定的 28px | P2 |

### 2.3 通过项(7 条, 给 PM 信心)

| 编号 | 项 | 证据 |
|------|-----|------|
| 2-PASS-1 | **ISS-055 顶栏任务模式入口收口**[通过] | `mode-annotate` / `mode-export` / `mode-forms` / `mode-ocr` 4 个 `AppCommandId` 在 Toolbar.tsx 0 命中, commands.ts 全标 `["more-menu"]` |
| 2-PASS-2 | **ISS-030 侧边栏默认关闭**[通过] | `App.tsx:29` `utilityPanel` 初始 `"none"` |
| 2-PASS-3 | 21 个 `AppCommandId` 全部归位 4 个启动器分组, 无遗漏 | `commands.ts:284-316` |
| 2-PASS-4 | 12 个 CSS 颜色 token 全部对齐 DESIGN.md §1 | `app.css:1-27` |
| 2-PASS-5 | 圆角 6/8px 大量使用, 符合 §5 | 出现 18 次 |
| 2-PASS-6 | `.context-toolbar` / `.page-organizer__toolbar` 42px 符合 §5 | `app.css:439-444` |
| 2-PASS-7 | box-shadow 仅用于 3 处浮层, 符合 §7 | 行 262/348/1276 |

---

## 3. 维度 3 — ROADMAP 优先级偏差

> 详细证据见 Agent 3 报告,本节为综合版。

### 3.1 17 个最近 ISS 审计结论

**直接命中"功能没真正完成"用户反馈的只有 3 个 / 17 个 = 18%**:

- ✅ ISS-044 (页面管理真实状态) — [对路]
- ✅ ISS-046 (页面重排 UI) — [对路]
- ✅ ISS-047 (PDF.js 并发渲染取消) — [对路]

**其余 14 个是 UI 收口 / 设计 polish, 与用户"做错功能"主诉错位**:

- ISS-039 / 040 / 041 / 042 / 043 / 045 / 048 / 049 / 050 / 051 / 052 / 053 / 054 / 055

这 14 个 ISS 不是错(它们都直接对应 DESIGN.md §10/§15/§18 的 PDF Expert 收口),但**它们完成的是设计层面的"克制化",不是用户层面的"功能没完成"**。换句话说, PM 推了 17 个 ISS, 其中 14 个是"看起来更 PDF Expert", 3 个是"真把功能做完"。

### 3.2 优先级偏差(3 个 P0)

| 编号 | 偏差 | 证据 |
|------|------|------|
| **P-01** | **手写签名 / 签名位置调整** ROADMAP §7 第 97 行标 `[ ]`, 但 README §表单签署 第 101 行写 "签名图片(PNG/JPG)+ 签名位置调整" + CHANGELOG 0.1.0-alpha.5 (ISS-008) 实际交付。**ROADMAP 严重滞后** | ROADMAP vs README/CHANGELOG 不一致 |
| **P-02** | **插入 PDF / 合并 / 提取页码范围** 整组缺位 — PDF Expert / Folia / Adobe 全部标配, 法律场景(多卷宗合并)高频, **被当 follow-up 但用户大概率 v0.1 就想要** | ROADMAP §5 第 66-67 行 仍 `[ ]`, CHANGELOG 0.1.0-beta.1 封箱只说"旋转/删除/重排" |
| **P-03** | **证据图片 A4 真实渲染** ROADMAP §5 第 70 行 仍 `[ ]` 标 plan-only, 但 README §导出 第 93 行 + CHANGELOG 0.1.0-alpha.6 (ISS-018 第二阶段) 已落真实拾取 + 像素渲染。**ROADMAP 至少 1 个核心能力已实际完成但状态未刷新** | ROADMAP vs CHANGELOG 矛盾 |

### 3.3 优先级偏差(2 个 P1)

| 编号 | 偏差 |
|------|------|
| P-04 | 扫描件清洁校正(粗方向/微倾斜/裁边/分块)真实处理 — ROADMAP §6 第 85 行 仍 `[ ]`, ISS-016 第二阶段 lopdf 真实清洁已落但"方向/倾斜/拆分双页"仍 plan-only |
| P-05 | 透明标题栏 + 原生窗口拖动 — ROADMAP §1 第 33 行 仍 `[ ]`, Tauri 桌面应用标配 |

---

## 4. PM 应该立刻看到的最关键 3 件事

1. **OCR 模式是纯 stub(F-01 / F-10, P0)**: `src/modules/ocr/README.md` 第 7、13 行自承 "第一版只提供 bridge/stub, Tauri command 当前只返回 queued job, 不执行真实 OCR、不生成双层 PDF、不发起联网请求"。用户点 OCR 永远"已加入队列", 这是用户"功能没真正完成"的最直接证据。

2. **导出引擎有 3 个真 TODO 自我承认**: ① 压缩 `COMPRESSION_PLAN_ONLY_WARNING` + README `DPI 降采样留给后续后台 bridge`; ② 批注图章 `annotationPdfWriter.ts:404` 自承"避免画真实 SVG 复杂形状" → 5 套图章模板 UI 看着漂亮, **导出后只画矩形+文字**; ③ 作者卡二维码 ISS-029 自承"替换占位图为真实二维码"没做。CHANGELOG 把这 3 个都包装成"已完成", 但代码 + 注释 + README 都在喊 "TODO"。

3. **最近 17 个 ISS 中 14 个是设计 polish 而非功能补完**: ISS-039 ~ ISS-055 大多是 UI 信息架构收口(工具启动器、交付面板、深色模式、页眉页脚奇偶页), 直接回应"功能没完成"主诉的只有 ISS-044 / 046 / 047(共 3 个 = 18%)。同时 ROADMAP §5 的"插入/合并/提取页码范围" / §6 的"扫描件清洁校正真实处理" / §7 的"手写签名" 仍是 `[ ]`, 但这些是 PDF Expert / 法律场景的**标配**能力, 不是"设计 polish"。

---

## 5. 需要进入第 2 阶段(启动 Tauri 验证)的具体清单

> 这一节是给第 2 阶段 Playwright 复核时**具体要跑哪些场景**的清单。

### 5.1 必跑(确认 P0 问题真实存在)

1. **OCR stub 复现**: 打开一份扫描 PDF → 工具启动器 → 扫描 OCR → 真的点"开始 OCR" → 看任务是否永远 queued, console 有没有"已加入队列"日志(应复现 F-01)
2. **图片转 PDF 缺口复现**: 工具启动器 / 欢迎页 / 设置页 → 搜任何"导入图片"/"图片合成 PDF"入口 → 确认 0 入口(应复现 F-08 战略层)
3. **压缩效果对比**: 选一份含 50 张高分辨率图的 PDF → 压缩 → 法院 10MB 预设 → 导出 → 比较压缩前后体积(应几乎不变, 复现 F-02)
4. **批注图章导出对比**: 加 5 个图章批注(已阅/重点/证据/待核/自定义)→ 扁平化导出 → 打开导出的 PDF → 截图对比 5 个图章是不是真的 SVG 复杂形状(应只是矩形+文字, 复现 F-03)
5. **作者卡二维码**: 设置 → 关于 → 用手机扫二维码(应识别不了 / 报"占位图")

### 5.2 必跑(确认 P1 视觉偏差)

6. **顶栏文字密度**: 1500px / 1280px 视口截图 → 看"工具" / "设置"按钮是不是真的显示中文文字(应显示, 复现 2.1.2)
7. **工具启动器分组**: 打开工具下拉 → 截图 → 看"组织页面"组里是不是有"添加页码"和"Bates 编号"(应有, 复现 2.3.2)
8. **CSS 颜色一致性**: DevTools 取 `.reader` 背景色 → 应该是 `#eef1f3` 还是 `#e4e8eb`(应硬编码, 复现 2.4.14)
9. **圆角 999px**: DevTools 检查 annotation 行的 author 胶囊 / 缩略图 status marker / pdf-page text-layer badge / search-popover page-chip(都应是 999px, 复现 2.4.19)
10. **隐式 token**: DevTools 找 `--warning-bg` 用在哪个元素上, 看 DESIGN.md §1 没列(应隐式存在, 复现 2.4.13)

### 5.3 选跑(给 PM 信心)

11. **通过项截图**: 启动后侧边栏默认关闭(应 false), 顶栏无 OCR/批注/填写/导出按钮(应无), 工具启动器 4 组齐全(应齐)

---

## 6. 建议的新 ISS(给 PM 决策)

> 基于第 1 阶段发现, 这些是建议插入的 ISS, 不在当前 ROADMAP 也不在归档索引, 需 PM 决策是否启动新 worker。

| 编号 | 主题 | 优先级 | 范围 |
|------|------|--------|------|
| **ISS-NEW-A** | PDF 插入 / 合并 / 提取三件套真实改写 | [C 核心] | `src/modules/pages/pageOrganizer.ts` 扩 state + `src/modules/export/pdfOperationEngine.ts` 加 `insert-pages` / `merge-pdfs` / `extract-pages` execute mode + 工作台 UI |
| **ISS-NEW-B** | OCR 真实接入(让 F-01 不再是 stub) | [C 核心] | 真实接 ocrmypdf / PaddleOCR / MinerU, 不只是返回 queued job |
| **ISS-NEW-C** | 批注图章 SVG 真实绘制(F-03) | P1 | `src/modules/annotation/annotationPdfWriter.ts:404` 用真实 SVG 几何代替"矩形+文字"降级 |
| **ISS-NEW-D** | PDF 压缩真实 DPI 降采样(F-02) | P1 | PyMuPDF bridge 或 pdf-lib 真实图像重采样, 替代 `COMPRESSION_PLAN_ONLY_WARNING` |
| **ISS-NEW-E** | ROADMAP / README / CHANGELOG 状态对齐审计 | [C 核心] | 逐条核对 ROADMAP `[ ]` 项, 把已实际完成的能力翻 `[x]` 并补 DEC 编号 |
| **ISS-NEW-F** | 视觉细节 polish(2.3.2 / 2.1.2 / 2.4.13 / 2.4.14 / 2.4.19 / 2.4.30 合并) | P1 | commands.ts 分组 / Toolbar 文字 / CSS token / 硬编码 / 999px 圆角 / 间距 |
| **ISS-NEW-G** | 作者卡真实二维码(F-04) | P1 | 按 ISS-029 / DEC-062 流程替换 1×1 占位 |

---

## 7. 报告状态

- 维度 1 / 2 / 3 三个 Explore agent 已完成,本报告已综合
- 第 2 阶段(启动 Tauri 验证)需要 PM 确认是否进入, 见 §5 必跑清单
- 第 3 阶段(对齐报告) 等第 2 阶段完成后产出
- 本报告零代码改动, 不修改 `src/**` / `src-tauri/**` / 任何 docs/ 文件

---

**关联记忆**:
- `[[project_multi_agent_state]]` — multi-agent orchestration state
- `[[feedback_release_workflow_authority]]` — release workflow authority
- `[[feedback_tauri_updater_secrets]]` — Tauri updater secrets + pubkey format(本报告未触发)

**关联设计**:
- `docs/plans/2026-06-14-faropdf-audit-stage-1-design.md` — 第 1 阶段排查设计
