# ISS-NEW-A PDF 插入 / 合并 / 提取三件套 — 设计

> 日期: 2026-06-14
> 状态: 已对齐待用户决策
> 关联: DEC-094 / 第 1 阶段报告 §6.2 / ROADMAP §5 行 66-67

## 背景

ROADMAP §5 行 66-67 "插入 PDF / 合并 / 提取页码范围" 整组标 [ ], 缺位。PDF Expert / Folia / Adobe 全员标配, 法律场景(多卷宗合并成证据材料)高频, 用户大概率 v0.1 就想要。

第 1 阶段报告 §6 标 P-02 优先级偏差 (P0 核心, ROADMAP 长期滞后)。

## 目标

实现 3 个新 PDF operation + UI 入口, 让用户能:
1. 把另一份 PDF 的全部页插入到当前 PDF 指定位置 → `*-inserted.pdf`
2. 把多份 PDF 合并成一份 → `*-merged.pdf`
3. 从当前 PDF 提取指定页码范围 → `*-extracted.pdf`

全部走 `pdfOperationEngine.executePdfRequest()` 真实改写, 默认另存新 PDF, 不覆盖原始文件。

## 当前引擎契约

`src/shared/pdf/export.ts` `PdfExportOperation` 联合类型当前 7 个值:
- `flatten-annotations` / `flatten-form` / `page-operations`
- `watermark` / `page-number` / `bates-number` / `compress`

需要扩展为 10 个, 加:
- `insert-pages`: `{ source: { bytes: Uint8Array; fileName: string }; insertAtIndex: number; pageRange?: string }`
- `merge-pdfs`: `{ sources: Array<{ bytes: Uint8Array; fileName: string }> }`
- `extract-pages`: `{ pageRange: string; outputFileName?: string }`

`PdfExportRequest` 已经有 `source.bytes` 字段, 不变。`extract-pages` 走 `source.bytes` + 新的 `pageRange`, 复用 `source` 主 PDF 字节流。

`merge-pdfs` 的设计难点: 多源 PDF 字节流怎么传? 现有 `PdfExportRequest.source` 是单 `bytes`, 不支持多源。**两个选项**:
- **A**: 扩展 `PdfExportRequest` 加 `additionalSources?: Array<{ bytes; fileName }>`, 仅 `merge-pdfs` 使用
- **B**: `merge-pdfs` operation 内嵌 `sources: Array<{ bytes; fileName }>`, 与 `source` 并列(主源是 `sources[0]`)

**推荐选 A**: 保留 `source` 为单一主源语义, `additionalSources` 是合并专用扩展。`PdfExportRequest.destination.bytes` 返回单一输出 PDF。

## 涉及文件

| 文件 | 变更类型 | 估计行数 |
|------|----------|----------|
| `src/shared/pdf/export.ts` | 扩 `PdfExportOperation` 联合 + `PdfExportRequest` | +60 |
| `src/modules/export/pdfOperationEngine.ts` | 加 3 个新 operation handler | +200 |
| `src/shared/app/commands.ts` | 加 3 个 AppCommandId + 启动器分组 | +30 |
| `src/modules/pages/mergeOperations.ts` (新) | 业务封装: 选文件、参数确认、另存路径生成 | +80 |
| `src/modules/pages/extractPageRange.ts` (新) | 业务封装: 输入页码范围、验证 | +40 |
| `src/components/layout/PageOrganizerWorkspace.tsx` | 加 3 个 UI 入口(对话框/列表) | +150 |
| `src/components/layout/PageOrganizerWorkspace.test.tsx` | 加测试 | +80 |
| `src/modules/export/pdfOperationEngine.test.ts` | 加 3 个 operation 测试 | +150 |
| `tests/fixtures/ocr/` 旁 / `tests/fixtures/pdf/` (新) | 测试 fixture: 多份 2-3 页 PDF | +10 |
| `docs/ROADMAP.md` §5 行 66-67 标 [x] + 链接 | +6 |
| `docs/DECISIONS.md` DEC-097 | +60 |
| `CHANGELOG.md` | +10 |

**总估计**: ~900 行新增 + 改

## 实施顺序

### 阶段 1: 共享契约 + 引擎 (1.5h)

1. `src/shared/pdf/export.ts` 加 `PdfInsertPagesOperation` / `PdfMergePdfsOperation` / `PdfExtractPagesOperation` 3 个 type
2. `PdfExportRequest` 加 `additionalSources?: Array<{ bytes: Uint8Array; fileName: string }>`
3. `src/modules/export/pdfOperationEngine.ts` 加 3 个 handler:
   - `applyInsertPages`: 用 `PDFDocument.load(source)` + `PDFDocument.load(insertSource)`, copyPages(insertDoc, [0..n-1]) → insertAtIndex 位置
   - `applyMergePdfs`: load 主源 + 每个 additionalSources, copyPages → append, 输出单一 PDF
   - `applyExtractPages`: load 主源, 按 pageRange 解析, copyPages 到新 doc, 输出
4. 引擎测试: 3 个 operation, 用真实 PDF fixture (3 页 + 2 页), 验证合并后页数 = 5, 提取 2-3 页输出新 doc 2 页

### 阶段 2: 命令 + UI 入口 (1h)

1. `src/shared/app/commands.ts` 加:
   - `AppCommandId` 加 `"insert-pdf"` / `"merge-pdfs"` / `"extract-page-range"`
   - 启动器 `organize` 组加 3 个命令
2. `src/components/layout/PageOrganizerWorkspace.tsx`:
   - 工具启动器点击 `insert-pdf` 弹出"插入 PDF 对话框"(让用户选另一份 PDF + 输入插入位置页码)
   - `merge-pdfs` 弹"多 PDF 合并"(主 PDF + 添加多个其他 PDF)
   - `extract-page-range` 弹"提取页码范围"(`2-5, 8, 11-13` 格式)
3. 3 个对话框 form + 默认输出路径(`*-inserted.pdf` / `*-merged.pdf` / `*-extracted.pdf`)

### 阶段 3: 文档同步 + commit (30 min)

1. ROADMAP §5 行 66-67 标 [x] + 链接到新 PR
2. CHANGELOG + DECISIONS.md DEC-097
3. typecheck + lint + test + cargo check
4. commit + push + 新 PR

## 验证

- 合并: 2 份示例 PDF (3 页 + 2 页) → `*-merged.pdf` 5 页, PDF.js 重新打开页数正确, 文本层合并
- 提取: 3 页 PDF 提取 `2-3` → `*-extracted.pdf` 2 页
- 插入: 3 页 PDF 插入另一份 2 页到第 2 页后 → `*-inserted.pdf` 5 页, 顺序正确
- 默认另存: 全部输出 `*-{inserted,merged,extracted}.pdf` 不覆盖源
- 错误路径: 非法页码范围 / 缺失源文件 / 输出路径等于输入路径, 给明确错误

## 范围与不变更项

- **不修改**:
  - `src-tauri/**` (Tauri 侧不变, 前端 `pdfOperationEngine` 走浏览器 `pdf-lib`)
  - `package.json` 依赖 (pdf-lib 已就位)
  - `Toolbar.tsx` / `AppShell.tsx` (走 `commands.ts` 启动器统一入口)
  - `src/components/layout/AppShell.tsx` (operate 工作台不需新 mode)
  - `src/styles/app.css` / 全局样式
- **不引入** 任何新 npm 包 / Rust crate
- **不加** 任何新 ROADMAP 节(只更新 §5 行 66-67)

## 风险与缓解

1. **多源 PDF 字节流传递**: 选 A 方案 (`additionalSources`), 不破坏现有 7 个 operation 契约
2. **页码范围解析**: 用 `parsePageRange("2-5, 8, 11-13")` helper, 容错 + 边界检查(0-based 索引 vs 用户输入 1-based)
3. **大 PDF 内存峰值**: `pdf-lib` 一次性 load 全部页, 不流式; 1000 页以上 PDF 可能 OOM,本期不优化
4. **pdf-lib copyPages 行为**: 必须 1-based 索引, 跟用户输入 1-based 一致, 避免 0-based 混淆

## 决策点

- **新分支**: `feat/iss-new-a-pdf-merge-split`, 从 main 拉(不在 chore/audit-and-iss-fixes 加 commit,避免 PR #61 review 复杂化)
- **新 PR**: feat/iss-new-a-pdf-merge-split → main
- **优先级**: P0(ROADMAP §5 整组缺位),不阻塞 PR #61
