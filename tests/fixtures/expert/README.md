# PDF Expert 高保真复刻参考 Fixture

本目录提供 `docs/reference/pdf-expert/` 采集与视觉比对（ISS-NEW-M 的 M1/M2）共用的受控 PDF 基线。

## 文件

| 文件 | 说明 |
| --- | --- |
| `generate.mjs` | 确定性生成脚本。用项目已装的 `pdf-lib` 内置 Helvetica，不嵌入字体、不依赖外部工具。可重复运行覆盖产出。 |
| `reference.pdf` | 生成产物。5 页 A4，真实 PDF 文字层，未加密。**入仓**，保证任意 worker clone 后复采到同一基线。 |

## 规格校验（2026-07-23 实测）

- Pages：5（`pdfinfo`）
- Page size：595 × 842 pt（A4）
- Encrypted：no
- TextContent：可被 `pdftotext` 提取（存在真实文字层，非扫描像素）
- File size：7.9 KB
- PDF version：1.7

## 5 页内容设计

| 页 | 内容 | 支撑的采集状态 |
| --- | --- | --- |
| 1 | 封面：标题、副标题、分隔线、文档元信息 | read（标题）、thumbnails（封面页可区分） |
| 2 | 正文段落：Recitals，含 `Consideration`/`Breach`/`Indemnify` 等可搜索词 | read 搜索、annotate 高亮、text selection |
| 3 | 编号子条款 6.1–6.4 | annotate 文本标注、text selection |
| 4 | 当事人信息表（矢量边框 + 文字） | 矢量图形/表格布局渲染验证 |
| 5 | 签署页：签字线、日期线 | edit 重排/删除（页码可核对顺序） |

每页页脚含 `Reference Fixture · Page N of 5`，供 thumbnails 五页区分与 edit 重排后核对顺序。

## 为什么不用 `tests/fixtures/ocr/scan-only-sample.pdf`

- 该文件刻意**无文字层**（扫描件，为 ocrmypdf OCR 路径设计），只有 2 页，且被 `.gitignore` 排除。
- M1 要求 read/thumbnails/annotate/edit 四状态共用同一 fixture 并复采两次做稳定性 diff；无文字层则搜索/选区/批注态都无法真实呈现，多页多样性也不足。

## 已知局限

- **不含 CJK 文字层**：Helvetica 不支持中文。本 fixture 核心职责是提供稳定可复采的视觉基线，布局与文字语言无关；CJK 排版/搜索的视觉验证如需，M2 可另建一份中文 fixture。
- **Tagged: no**：非无障碍标签 PDF，不影响视觉采集。

## 生成命令

```bash
node tests/fixtures/expert/generate.mjs
```

脚本幂等，可重复运行覆盖 `reference.pdf`。

## 合规

- 内容为纯虚构英文法律样例（合同条款风格），不含真实案件材料、个人信息或商业秘密，符合 `tests/fixtures/README.md` 规则。
- 生成脚本不修改 `src/`、`src-tauri/`、`package.json` 或全局样式，只产出本目录文件。
