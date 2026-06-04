# PDF Expert Shell UI 收口（ISS-009）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `feat/pdf-expert-shell-ia` 推进 ISS-009 信息架构收口：阅读态真实 PDF 打开后的视觉 polish、搜索结果层（命中可视位置 + 滚动到命中）、页面管理多选/撤销/风险提示、扫描/OCR 任务参数区。

**Architecture:** 视觉与交互收紧，不改后端、不改共享契约；新增组件 + 既有组件的 prop 扩展。新组件独立文件 + 独立 CSS，不污染 `app.css`。每个 milestone 一个 commit。

**Tech Stack:** React + TypeScript + Vite + PDF.js + pdf-lib；现有项目结构，shared 契约 / service 边界保持不变。

**Branch:** `feat/pdf-expert-shell-ia`（已存在 worktree）。

**Base Ref:** `main`（已 rebase 同步，0 drift）。

---

## Milestone 0 — 准备

- [x] 读 `docs/TASKS.md` ISS-009 + `docs/DESIGN.md`「当前设计差距」+ `src/components/layout/{AppShell,Toolbar,Sidebar,ReaderCanvas}.tsx`
- [x] 跑 `npm install`（新 worktree 必需）
- [x] 跑 `npm run typecheck` + `npm test -- --run` + `npm run build` + `cargo check --offline`
- [x] 修 `tsconfig.json` `lib: ["ES2020"...] → "ES2022"...]`（baseline unblock：17 个 `.at()` 类型错误被 ES2022 吸收），写到 DEC-049「baseline 修复」

## Milestone 1 — 阅读态视觉 polish

**Files:**
- Modify: `src/components/layout/ReaderCanvas.tsx`（添加 OCR 提示 + 文本层状态徽章）
- Modify: `src/components/layout/Toolbar.tsx`（无 OCR-needed 提示时折叠 sub-status）
- Modify: `src/styles/app.css`（增加 `.reader__status-ocr-needed`、`.reader__text-layer-badge`、`.pdf-page__meta`）
- Add: `src/components/layout/ReaderCanvas.test.tsx`（不引入新依赖，复用现有 testing-library 模式；如无合适 hook 则跳过，仅手动验证）

**Step 1:** 在 `ReaderCanvas` 的 `DocumentReader` 渲染里，文档 `ocrStatus === "needed"` 时在主区域顶部加一行 `.reader__status-banner` 提示（"本文档需要 OCR 后才能搜索和复制"），并提供一个 `<button>前往 OCR 模式</button>` 调用 `onRequestOcr` 风格的回调（此处仅 UI 文字 + emit callback 形状，不强制 OCR mode 切换）。

**Step 2:** 在每个 `PdfPage` section 底部（fallback `.empty-state` 块上）增加一个微小的文本层状态徽章（"已识别" / "部分识别" / "需 OCR"），用 `textLayerStatus` 决定。

**Step 3:** 调整 `Toolbar.tsx` 的 `fileSubtitle`：当 `document === null` 且 `reader.state.status === "ready"` 时显示 "未打开文档" 而非 "等待文件"；当 `errorMessage` 存在时用 `aria-live="polite"` 提示。

**Step 4:** commit `chore(shell): reader-state visual polish`

## Milestone 2 — 搜索结果层增强

**Files:**
- Modify: `src/components/layout/Toolbar.tsx`（`SearchResultsPopover` 增强：命中 1/N 索引 + 跳转按钮 + 索引进度条）
- Modify: `src/components/layout/ReaderCanvas.tsx`（`DocumentReader` 接受 `onSelectHit?: (pageNumber: number) => void` + 命中时 `data-active-hit="true"` 标记）
- Modify: `src/components/layout/AppShell.tsx`（接线 `onSelectHit={reader.setCurrentPage}`）
- Modify: `src/styles/app.css`（`.page-search-highlight` 实际视觉：黄色半透明 + active 时橙色边框）

**Step 1:** `SearchResultsPopover` 头部增加 `命中 N / 总 M` 计数器 + 命中页码 chip（点击即跳）。

**Step 2:** `DocumentReader` 拿到 `activeHit` 时给对应页 `<section>` 加 `data-active-hit="true"`，CSS 用 `outline: 2px solid var(--accent)` 高亮。

**Step 3:** 搜索 popover 命中列表项加 "滚动到该页" 微小图标（`ChevronRight`）。

**Step 4:** commit `feat(shell): search-results layer hit navigation`

## Milestone 3 — 页面管理多选/撤销/风险提示

**Files:**
- Add: `src/components/layout/PageOrganizerWorkspace.tsx`（从 AppShell.tsx 拆出来作为独立文件，便于测试与维护）
- Add: `src/components/layout/PageOrganizerWorkspace.css`
- Add: `src/components/layout/PageOrganizerWorkspace.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`（把 `PageOrganizerWorkspace` 从内部函数改为 import 形式）
- Modify: `src/styles/app.css`（`.page-organizer` + `.page-card` + `.page-card--selected` + `.page-card--deleted` + `.page-organizer__risk-confirm`）

**Step 1:** 新组件维护本地 `selectedPageIds: Set<string>`（点击 toggle，shift+click 区间选择）。空态时不显示多选工具条。

**Step 2:** 顶部工具条按钮分两段：左侧"插入 / 附加 / 旋转 / 复制 / 摘录 / 删除"（多选时启用）；右侧"撤销 / 重做 / 另存为新 PDF"。Undo 按钮暂为占位（不接 pageOrganizer 真实 service，但提供"已应用 N 个动作"计数 + 视觉 enabled 切换）。

**Step 3:** 删除前弹 `confirm()`（或自定义 inline 风险提示框），文案："将删除 N 页（页码 X、Y、Z）。删除后可通过「撤销」恢复，但「另存为新 PDF」前的预览不保留原始文件副本。是否继续？"

**Step 4:** 另存为新 PDF 按钮点击时弹风险提示："输出将保存为新 PDF，不覆盖原文件。请确认输出路径（设置页可调整默认保存目录）。"

**Step 5:** commit `feat(shell): page-organizer multi-select undo risk`

## Milestone 4 — 扫描/OCR 任务参数区

**Files:**
- Add: `src/components/layout/OcrWorkspaceHeader.tsx`（参数区：provider / pageRange / outputStrategy / qualityCheck / networkConsent 状态展示）
- Add: `src/components/layout/OcrWorkspaceHeader.test.tsx`
- Modify: `src/components/layout/AppShell.tsx`（把 `OcrWorkspace` 的 `controller` 透传过来；不在 OCR controller 上加新方法——参数只读展示）
- Modify: `src/modules/ocr/ui/OcrWorkspace.tsx`（在 jobs 区域上方加 `<OcrWorkspaceHeader controller={controller} />`）
- Modify: `src/modules/ocr/ui/ocrWorkspace.css`（`.ocr-workspace__parameters` 区域视觉）

**Step 1:** `OcrWorkspaceHeader` 接受 `controller` 派生参数展示：
- 当前 provider（从 `controller.providers[0]` 或 controller 暴露的 `activeProvider` —— 如果 hook 没暴露，**不**改 hook，从 props 传入 `activeProvider: { id, label, kind: "local" | "cloud" }`）
- 页码范围（缺省 "全部页面"）
- 输出策略（"双层 PDF（new-layered-pdf）"）
- 质量检查（"未启用" / "已启用 · 关键词 X Y Z"）
- 网络 consent（云端 provider 未授权时显示橙色 "需要联网授权" 提示，本地 provider 隐藏）

**Step 2:** 把 header 注入 `OcrWorkspace.tsx` jobs 区域上方。

**Step 3:** 测试覆盖 4 个场景：本地 provider / 云端 provider 未授权 / 云端 provider 已授权 / 质量检查已启用。

**Step 4:** commit `feat(shell): ocr parameter area`

## Milestone 5 — 文档与 PR

- 写 DEC-049（阅读态 polish / 搜索结果层 / 页面管理 / OCR 参数 + baseline tsconfig 修复）
- 更新 `docs/TASKS.md` ISS-009「下一步」+ 进度日志
- 更新 `CHANGELOG.md` 0.1.0-alpha.10 段
- 更新 `docs/DESIGN.md`「当前设计差距」标记部分完成
- 单 commit `docs(iss-009): 收口方案 + 进度 + 设计差距标记`（或并入主 commit）
- 跑最终 `npm run typecheck` + `npm test -- --run` + `npm run build` + `cargo check --offline`
- `git push origin feat/pdf-expert-shell-ia`
- `gh pr create --base main --head feat/pdf-expert-shell-ia`
- 更新 STATUS.json（status=done）+ RESULT.md + PATCH_SUMMARY.md
- 回复 `pr created <PR-NUMBER>`

## 范围严格遵守

- ✅ Allowed: `src/components/layout/`, `src/styles/app.css`, `src/modules/{reader,search,pages,ocr}/*`, `src/App.tsx`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `docs/TASKS.md`, `CHANGELOG.md`, `tsconfig.json`（baseline unblock）
- ❌ Forbidden: `src/shared/*`, `src-tauri/*`, `package.json` 锁文件, OCR / 导出 service 内部
- ❌ 不实现新功能（搜索算法、批注写入、OCR 调用、导出操作、真实页面变换）
- ❌ 不引入新 npm 包

## 风险与已知限制

- /tmp/faropdf-ui-sample.pdf 不存在 → 视觉验证改为在 dev server 起来后用 playwright 截 dev 空态（开发环境打开 vite dev server）
- OCR provider 状态由 props 传入（不动 hook）以保持本 PR 范围可控
- 页面管理 Undo 是占位 UI（不接 pageOrganizer service）— 在 DEC-049 标注
- baseline tsconfig 修复跨全项目，但仅 1 行 lib 字段，影响 ES2022 已支持 API
