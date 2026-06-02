# ISS-018 Patch Summary

变更集中于 ISS-018 证据图片 A4 编排第一版 plan-only 底座。下表按文件列出 `+/-` 行数与用途。

## 新增文件

| 文件 | 用途 |
| --- | --- |
| `src/shared/pdf/imagePack.ts` | imagePack 共享契约 + A4 常量（73 行） |
| `src/modules/pages/imagePack/imagePackPlanner.ts` | 纯函数 planner + 路径校验（~270 行） |
| `src/modules/pages/imagePack/imagePackPlanner.test.ts` | 19 项核心行为单元测试（~330 行） |
| `src/modules/pages/imagePack/index.ts` | 子模块入口 re-export（1 行） |
| `.agent-context/STATUS.json` | PM 要求的运行态元数据 |
| `.agent-context/RESULT.md` | 最终汇报 |
| `.agent-context/PATCH_SUMMARY.md` | 本文件 |

## 修改文件

| 文件 | 变更 | 用途 |
| --- | --- | --- |
| `src/shared/index.ts` | +16 | 在 `pdf/pageOrganizer` 之后 re-export imagePack 类型与 A4 常量 |
| `src/shared/contracts.test.ts` | +59 | 新增 `ImagePackPlan` / `ImagePackSummary` 共享类型断言 |
| `src/modules/pages/index.ts` | +1 | 导出 `createImagePackPlan` / `suggestImagePackOutputPath` |
| `src/modules/pages/README.md` | +18 | 增加 imagePack 子模块说明 |
| `docs/TASKS.md` | +2 / -1 | ISS-018 状态更新为「待 PR review」并补充当前进度 |
| `docs/DECISIONS.md` | +21 | 新增 DEC-005 决策条目 |
| `docs/ARCHITECTURE.md` | +9 | 新增「证据图片 A4 编排（imagePack）」小节 |
| `CHANGELOG.md` | +1 | 0.1.0-alpha.0 末尾追加用户可见变更 |

合计 8 个修改文件 +7 个新增文件。

## 关键算法要点

- `itemsPerPage=auto`：竖版条目 ≥ 横版条目 → 3/页；否则 1/页。
- `orientation=auto`：
  - `itemsPerPage=1` 时按当前条目方向逐页取 A4 portrait/landscape。
  - `itemsPerPage>=2` 时固定 A4 landscape（与 `img2pdf/scripts/img_to_pdf.py` 行为一致）。
- 单元格布局（aspect-ratio 保持 + 居中）：
  - 1/页：cell 占满 `a4 - 2*margin`，item 居中。
  - 2/3/4/页：`cols = perPage` 单行布局；`cell_w = (a4_w - (cols+1)*gap) / cols`，`cell_h = a4_h - 2*margin`，`gap = margin`。
- 输出路径安全：
  - 必须绝对路径、`.pdf` 结尾、不能与任何输入 `sourcePath` 归一化后等价。
  - 建议名 `*-evidence-pack.pdf`（无 sourcePath 时回退 `evidence-pack.pdf`）。
- 排序：
  - `name` 按 `label` → `sourcePath` → `id` 升序。
  - `none` 保持输入顺序。
  - `time` 当前保持输入顺序（plan-only 模型未携带 mtime）。

## 边界 / 暂缓

- 不读取真实图片/PDF、不渲染像素、不引入新依赖、不修改 package / lock。
- 不向 `pdfOperationEngine` 提交 operation。
- 不修改 `src-tauri/`、`src/App.tsx`、`src/styles/`、`.gitignore`。
- 真实目录拾取、I/O、UI 编排对话框、多页预览交由后续 worktree。
