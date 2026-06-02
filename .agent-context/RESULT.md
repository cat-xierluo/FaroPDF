# ISS-018 Worker Result

- 任务：ISS-018 证据图片 A4 编排
- Worker：Claude Code (PM Host: Codex)
- 分支：`feat/evidence-image-pack`
- Worktree：`/Users/maoking/Library/Application Support/maoscripts/FaroPDF/.claude/worktrees/tmux-evidence-image-pack`
- 完成时间：2026-06-02T16:20:05Z

## 状态

完成 ISS-018 第一版 plan-only 底座。代码、测试、文档全部就绪，所有验证命令通过。已 commit 并推送到 `origin/feat/evidence-image-pack`，并尝试创建非 draft PR（结果见末尾）。

## 交付内容

### 共享契约

- `src/shared/pdf/imagePack.ts`
  - `A4_PORTRAIT_SIZE_PT = { width: 595, height: 842 }` / `A4_LANDSCAPE_SIZE_PT = { width: 842, height: 595 }`
  - `ImagePackSourceKind` / `ImagePackPerPageOption` / `ImagePackOrientationOption` / `ImagePackSortStrategy`
  - `ImagePackInputItem` / `ImagePackLayoutOptions` / `ImagePackCell` / `ImagePackPage` / `ImagePackSummary` / `ImagePackPlan` / `ImagePackPlanInput`
- `src/shared/index.ts`：在 `pdf/pageOrganizer` 之后 re-export imagePack 类型与 A4 常量。

### 模块

- `src/modules/pages/imagePack/imagePackPlanner.ts`
  - `createImagePackPlan(input)`：纯函数规划器，校验条目、归一化选项、按 `sort` 排序、解析 `itemsPerPage=auto`、生成单元格布局、建议 `*-evidence-pack.pdf` 输出路径并拒绝与输入 `sourcePath` 等价的输出。
  - `suggestImagePackOutputPath(firstItemPath?)`：根据第一个输入 `sourcePath` 生成 `*-evidence-pack.pdf`。
  - 内部辅助：`normalizeOptions` / `sortItems` / `resolveItemsPerPage` / `resolvePageSize` / `buildCellsForChunk` / `buildSingleCell` / `validateOutputPath` / `normalizePathForComparison`。
- `src/modules/pages/imagePack/imagePackPlanner.test.ts`：19 项单元测试。
- `src/modules/pages/imagePack/index.ts`：模块入口 re-export。
- `src/modules/pages/index.ts`：在 pageOrganizer 之后 re-export imagePack planner。
- `src/modules/pages/README.md`：补充 imagePack 子模块说明。

### 共享契约测试

- `src/shared/contracts.test.ts`：新增 `ImagePackPlan` / `ImagePackSummary` 共享类型断言和 A4 常量引用。

### 文档

- `docs/TASKS.md`：ISS-018 状态从「待处理」更新为「待 PR review（第一版 plan-only 底座已完成；真实目录拾取、像素渲染、image/PDF I/O 待后续 worktree）」，补充「当前进度」描述。
- `docs/DECISIONS.md`：新增 DEC-005 决策条目，记录 plan-only 边界、`auto` 解析规则、单元格布局和被暂缓的子项。
- `docs/ARCHITECTURE.md`：在「已落地服务 / Pages」之后新增「证据图片 A4 编排（imagePack）」小节，描述共享契约、planner 入口、输出路径规则和 plan-only 边界。
- `CHANGELOG.md`：在 0.1.0-alpha.0 末尾追加证据图片 A4 编排第一版用户可见变更。

### 元数据

- `.agent-context/STATUS.json`：记录 `status=running`、`phase=verification`、branch / worktree / runtime_profile / allowed_files / forbidden_files / node v25.2.1 / npm 11.6.2 / `phase_history`。
- `.agent-context/RESULT.md`：本文件。
- `.agent-context/PATCH_SUMMARY.md`：变更摘要。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | clean（`tsc --noEmit` 无输出） |
| `npm test -- --run src/modules/pages src/shared` | 52/52 通过（8 个 test files） |
| `npm test -- --run` | 134/134 通过（25 个 test files） |
| `npm run lint` | clean（`eslint .` 无输出） |
| `npm run build` | 成功，dist 生成（`pdf.worker-iVMkNdeB.mjs` 2.19 MB / `pdf-CkIk37Ba.js` 428 KB / `index-BA-tSdkx.js` 233 KB） |
| `cd src-tauri && cargo check` | 未执行（`src-tauri/` 未触碰，按 PM 规则跳过） |

## 范围遵守

仅修改以下路径（与 PM allowed_files 一致）：

- `src/modules/pages/imagePack/**`（新增 2 个文件：`imagePackPlanner.ts` / `imagePackPlanner.test.ts`，以及 `index.ts`）
- `src/modules/pages/index.ts`
- `src/modules/pages/README.md`
- `src/shared/pdf/imagePack.ts`（新增）
- `src/shared/index.ts`
- `src/shared/contracts.test.ts`
- `docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ARCHITECTURE.md`
- `CHANGELOG.md`
- `.agent-context/STATUS.json` / `.agent-context/RESULT.md` / `.agent-context/PATCH_SUMMARY.md`

未触碰：

- `package.json` / `package-lock.json` / `node_modules/`
- `src-tauri/`
- `src/App.tsx` / `src/styles/`
- `.gitignore`
- 其他模块或共享契约

## 后续工作（记录到 docs/TASKS.md / docs/DECISIONS.md）

- 真实目录扫描、image/PDF 页面尺寸读取、PDF 写出执行、UI 编排对话框、多页预览。
- 在 `pdfOperationEngine` 接入 image-pack 写盘路径。
- `sort=time` 需要 `modifiedAt` 字段支持。
- 行布局（per_page=4 拆 2×2）等增量能力按需扩展。
