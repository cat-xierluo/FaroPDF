# FaroPDF Session Handoff

> 生成时间：2026-06-03
> 触发原因：前一个 session 到达上下文上限，无法继续运作

## 1. 当前分支状态

工作目录位于 `feat/reader-canvas-render-clean`，相对 main 有以下未合并工作：

### 已提交（1 commit）

| 提交 | 说明 |
| --- | --- |
| `8d38e80` | feat: add real PDF canvas rendering to ReaderCanvas |

改动范围：`ReaderCanvas.tsx`、`pdfReaderService.ts`、`useReaderController.ts` 及相关测试。核心变更是给 `LoadedPdfDocument` 和 `PdfJsReaderAdapter` 增加了 `renderPageToCanvas` 方法，`ReaderCanvas` 使用新 `PdfPage` 组件做 canvas 渲染 + 文本 fallback。

### 已暂存未提交（4 个文件，+372 行）

| 文件 | 说明 |
| --- | --- |
| `src/App.tsx` | 接入 `AnnotationService`，文档加载成功后自动拉取批注列表，传递给 AppShell |
| `src/components/layout/AppShell.tsx` | 透传 `annotations` 到 UtilityPanel → DocumentSummaryPanel |
| `src/components/layout/Sidebar.tsx` | 新增"批注列表"tab：按页码分组、9 种类型中文标签、点击跳转、长文本截断 |
| `src/components/layout/Sidebar.test.tsx` | 新增 141 行测试：空态、分组、跳转、类型标签、截断、无内容批注 |

这些暂存改动对应 ISS-004 的 UI 接入部分（侧边栏批注列表渲染和点击跳转）。

## 2. 其他未合并分支

| 分支 | 相对 main 提交数 | 内容 |
| --- | --- | --- |
| `feat/annotation-sidebar-list` | 1 | `06eccde` — 与当前暂存改动功能相同但基于不同 base，是同一段工作的另一份提交 |
| `feat/forms-signing` | 3 | canvas 渲染 + ISS-008 表单填写签署 service layer + 类型修复 |

注意：`feat/forms-signing` 包含与 `feat/reader-canvas-render-clean` 相同的 canvas 渲染 commit（不同 SHA），合并时需要处理重复。

## 3. 各 ISS 当前进度

| ISS | 状态 | 已完成 | 待推进 |
| --- | --- | --- | --- |
| ISS-001/011/012 | 已完成 | 脚手架、共享契约、Shell | — |
| ISS-002 阅读底座 | 已完成（底座） | PDF.js 加载、状态、虚拟化范围、canvas 渲染 | 连续滚动、缩放交互、缩略图、键盘翻页、上次页码恢复 |
| ISS-003 搜索 | 已完成（第一版） | 按需索引、命中列表、上下一个、当前页高亮、OCR 提示 | text-layer 几何高亮 |
| ISS-004 批注 | 进行中 | sidecar 模型、仓储、摘要导出、**侧边栏列表 UI（暂存未提交）** | 批注工具条、交互创建/编辑、PDF 扁平化绘制 |
| ISS-005 导出引擎 | 部分完成 | bytes-first 引擎、表单 flatten、plan-only 批注/页面操作 | 批注真实几何绘制、页面操作真实改写（execute 模式已有底座） |
| ISS-006 页面整理 | 进行中 | 状态机、旋转/删除/重排/撤销、plan-only 导出 | 完整页面网格 UI、插入/合并/裁剪、A4 标准化、manifest UI |
| ISS-007 OCR bridge | 进行中 | bridge/stub、provider adapter、安全校验 | 真实 OCR 执行、双层 PDF、任务队列 |
| ISS-008 表单 | `feat/forms-signing` 有代码 | — | 合并评估、UI 接入 |
| ISS-009 设计系统 | 进行中 | Shell 信息架构、工具条 | 视觉 polish、搜索结果层、页面管理交互 |
| ISS-010 隐私 | 已完成（模型） | notice/consent/audit、guard | UI 弹窗 |
| ISS-013 交付工具 | 已完成（底座） | 水印/页码/Bates pdf-lib 写入、压缩 plan-only | 真实压缩、中文字体、UI 预览 |
| ISS-014 设置 | 已完成 | 设置持久化、provider 配置 | Keychain |
| ISS-016 扫描预处理 | 已完成（stub） | job model、bridge stub | 真实 OpenCV/PyMuPDF |
| ISS-017 OCR 质量 | 已完成 | 报告服务 | 真实 PDF 解析 |
| ISS-018 证据图片 | 已完成 | plan-only 编排计划器 | 真实图片读取/渲染 |
| ISS-019 文书整理 | 已完成 | manifest 服务 | 真实 PDF 解析、UI |

## 4. 推荐后续步骤

### 立即处理

1. **提交暂存的批注侧边栏改动**：当前 `feat/reader-canvas-render-clean` 暂存区有 ISS-004 侧边栏 UI 的完整改动（4 文件），应提交并评估是否创建 PR 合并。

2. **清理重复分支**：
   - `feat/annotation-sidebar-list` 与当前分支暂存改动重复，确认后可删除
   - `feat/forms-signing` 包含 canvas 渲染重复 commit，合并前需 rebase 或 cherry-pick

3. **验证当前分支**：运行 `npm run typecheck && npm test && npm run lint && npm run build` 确认所有改动通过。

### 短期推进优先级

按 TASKS.md 的 P0 优先级和依赖关系：

1. **ISS-002 阅读深化**：连续滚动、缩放交互、左侧缩略图、键盘翻页 — 这是后续所有 UI 交互的阅读底座
2. **ISS-009 设计系统 polish**：搜索结果层、页面管理交互 — 依赖阅读深化
3. **ISS-004 批注工具条**：创建/编辑交互 — 依赖阅读深化的文本选择
4. **ISS-006 页面管理 UI**：完整网格、拖拽、多选 — 依赖设计系统
5. **ISS-008 表单**：评估 `feat/forms-signing` 分支代码质量后合并

### 不急于推进

- ISS-007/016/017 真实 OCR 执行：需要 Python bridge 或 Rust 后台，属于后端深化
- ISS-013 真实压缩：需要 PyMuPDF bridge
- ISS-015 直接编辑 PDF：P2 暂缓

## 5. 验证命令

```bash
# 基础验证
npm run typecheck
npm test
npm run lint
npm run build

# 桌面应用验证
cd src-tauri && cargo check

# 分支状态
git log --oneline main..HEAD
git diff --cached --stat
```

## 6. 关键文件索引

| 文件 | 职责 |
| --- | --- |
| `docs/TASKS.md` | 唯一任务源 |
| `docs/ROADMAP.md` | 路线图和阶段进度 |
| `docs/DECISIONS.md` | 决策记录和工作日志 |
| `docs/ARCHITECTURE.md` | 架构和模块边界 |
| `docs/DESIGN.md` | 视觉设计系统 |
| `CHANGELOG.md` | 变更记录 |
| `CLAUDE.md` | 项目协作指南和开发命令 |
