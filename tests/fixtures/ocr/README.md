# OCR E2E 测试夹具

ISS-007 OCR 端到端联调（DEC-044）使用的扫描型 PDF 夹具。

## 文件

- `generate-scan-fixture.mjs` — Node 脚本，使用 `pdf-lib` 把 400x150 的预渲染 PNG 嵌入 2 页 A4 PDF，模拟纯扫描件（**无 PDF 文字层**，只有像素）。
- `scan-only-sample.pdf` — 生成产物，体积小（~5 KB），由 `.gitignore` 排除，**不入仓**。

## 重新生成

```bash
node tests/fixtures/ocr/generate-scan-fixture.mjs
```

脚本自包含：PNG 以 base64 内嵌在源文件里，**不依赖** ImageMagick / `pdftoppm` / Tesseract 等外部工具。

如果需要替换夹具内容（更大的图 / 多页 / 不同语言文字），先在外部生成新 PNG，再用 Node 重新 base64 编码替换 `SAMPLE_PNG_BASE64` 常量。源 PNG 生成示例：

```bash
magick -size 800x400 xc:white -fill black -pointsize 36 -gravity NorthWest \
  -annotate +30+30 'OCR Pipeline E2E Test 2026' \
  -annotate +30+90 '中文 测试' \
  /tmp/ocr-fixture.png
base64 -i /tmp/ocr-fixture.png | tr -d '\n'
```

## 本机运行 E2E 所需工具

| 工具 | 版本（最低） | 用途 | 安装（macOS） |
| --- | --- | --- | --- |
| `ocrmypdf` | 13+ | 本地 OCR provider 实际执行 | `brew install ocrmypdf` |
| `pdftotext`（poppler-utils） | 22+ | OCR 后双层 PDF 文本提取 + 质量抽查 | `brew install poppler` |
| `curl` | 7+ | 云端 OCR provider HTTP 派发 | `xcode-select --install` |
| `tesseract` + `eng` / `chi_sim` 语言包 | 5+ | ocrmypdf 内部依赖 | 随 `ocrmypdf` 一并安装 |

可用性自检（任一缺失会清晰报错）：

```bash
ocrmypdf --version
pdftotext -v 2>&1 | head -1
```

## 已知限制

- 夹具 PDF 是 2 页相同图像；`pageRange` 参数用 `1` 或 `1-2` 都能命中，`2` 单独命中第二页。
- 内嵌 PNG 用 `pointsize 22 / 14` 渲染，tesseract 5.x 在 macOS 上英文 + 数字识别率近 100%；中文需 `-l chi_sim+eng`（与 `ocr_dispatch.rs` 默认一致）。
- 体积比（`fileSizeRatio`）会大于 1：源 PDF 已经是嵌入图像（≈ 5 KB），ocrmypdf 输出的双层 PDF 包含 OCR 文字层 + 图像（≈ 9 KB）。这是嵌入图像 PDF 的固有现象，不是 bug。
