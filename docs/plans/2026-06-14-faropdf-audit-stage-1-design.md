# FaroPDF 第 1 阶段排查设计 — 静态扫描

> 日期: 2026-06-14
> 状态: 已对齐,执行中
> 关联记忆: [[project_multi_agent_state]] / [[feedback_release_workflow_authority]]

## 背景

用户反馈三类问题:

1. 功能层面: 标记为"已完成"的 ISS 实际运行时并未真正完成
2. 布局层面: 顶栏 / 侧栏 / 工具启动器整体视觉与"参照 PDF Expert"差距大
3. 优先级层面: 推了很多用户不是核心需要的能力(页眉页脚奇偶页 / 深色模式 / 压缩预设),真正想要的核心能力反而在 follow-up

`AGENTS.md` §2 实操验证要求"实际启动应用眼见为实",但 CHANGELOG 显示 ISS-039 ~ ISS-055 的"全量验证通过"基本是 typecheck + vitest + build 组合,**没有看到 960×720 实际启动 Tauri 后用户点头的证据链**。

## 目标

不启动 Tauri,基于代码和文档,定位"声称完成但实际是占位"的功能,以及与 PDF Expert 视觉基准的明显偏差;并识别 ROADMAP 优先级与用户预期不一致的能力。

## 三个扫描维度

### 维度 1: 功能交付真实性

对照 ROADMAP §2-7 每一项 ✅,在 `src/` 下确认:

- **命令路由**: `src/shared/app/commands.ts` 的 `AppCommandId` 是否被 AppShell / Toolbar / 原生菜单事件真正消费,有没有"命令注册了但 UI 不触发"或"UI 触发了但命令没实现"的孤儿
- **占位/假入口审计**: 全仓 grep `占位` / `placeholder` / `stub` / `TODO` / `图片转 PDF` / `Word 转 PDF` / `日期` / `钩号` / `叉号` / `图章` / `图像` 这几个 ISS-048 明确点过的关键词
- **关键功能接线审计**: `pdfOperationEngine` 的 7 种 operation 在 UI 入口上是否都能点到、UI 入口是不是真在 `ExportDeliveryPanel` / `AnnotationSidebar` / `FormsPanel` / `PageOrganizerWorkspace` 里

### 维度 2: PDF Expert 视觉偏差

对照 `DESIGN.md` §3 布局架构 + §10 工具栏克制原则 + §18 PDF Expert UI 探索素材池,逐项检查:

- `src/components/layout/Toolbar.tsx`: 顶栏按钮清单 vs DESIGN.md §3 的 4 列网格定义,有没有"OCR / 批注 / 填写和签名 / 导出"还在顶栏(ISS-055 验收说要彻底收口)
- `src/App.tsx` 初始化: `utilityPanel` 默认值(`summary` vs `null`),侧边栏默认开/关(ISS-030 说要默认关闭)
- `src/components/layout/AppShell.tsx`: 工具启动器分组("组织页面 / 交付导出 / 标注填写 / 扫描 OCR")是否齐全且无遗漏
- 视觉 token 一致性: `src/styles/app.css` 的 `--bg` / `--surface` / `--accent` / 圆角 / 间距是否对齐 §1 颜色体系 + §5 信息密度

### 维度 3: ROADMAP 优先级偏差

把 ROADMAP 当前所有 `[ ]` 项和 ISS 归档索引对比,识别"被标记为 follow-up 但用户心里是核心"的能力:

- §5 页面整理: 插入/合并/裁剪/拆分双页扫描/manifest/命名 6 项
- §6 OCR: 扫描件清洁校正(粗方向/微倾斜/裁边/分块)真实处理
- §7 表单: 手写签名 + 签名位置调整
- §v0.2: 文书拆分合并/页级索引/规范命名工作台
- §v0.3: 跨平台打包/性能/官网文档站

## 输出

报告文件: `docs/plans/2026-06-14-faropdf-audit-stage-1-report.md`

格式: 3 个维度各 1 张表,**每条问题标注 (a) 文档原话 / (b) 代码位置 / (c) 严重度**(P0/P1/P2)/ `(d) 与用户反馈的对应`。

零代码改动,只产报告。

## 工作流(总 3 阶段,本设计为第 1 阶段)

1. **第 1 阶段: 静态扫描** (本文档) — 3 个 Explore agent 并行扫三个维度
2. **第 2 阶段: 启动验证** (待用户确认是否进入) — `npm run tauri dev` + Playwright MCP 跑阅读/批注/OCR/表单/导出/页面管理/设置 7 个模块,各拍 3-5 张 960×720 截图 + DOM 断言
3. **第 3 阶段: 对齐报告** (待用户确认是否进入) — 综合 1+2 阶段输出,出具《对齐报告》含实际功能交付状态、PDF Expert 视觉偏差、ROADMAP 优先级偏差

## 范围与不变更项

- **不修改** `src/**` / `src-tauri/**` / `package.json` / `config/**` / 锁文件
- **不修改** `CHANGELOG.md` / `TASKS.md` / `ROADMAP.md` / `DESIGN.md` / `ARCHITECTURE.md` / `DECISIONS.md`
- 只新增 `docs/plans/2026-06-14-faropdf-audit-stage-1-report.md` 报告文件
