# reader 夹具

ISS-NEW-M M5 异常态闭环用到的 PDF 阅读器夹具。

## corrupt.pdf

故意截断的 PDF，用于复现 PDF.js `InvalidPDFException` 加载失败路径（损坏 PDF →
reader 错误态 → 中文错误卡片 + 重新选择文件入口）。

生成方式：先用 pdf-lib 生成合法小体积 PDF，再截断尾部（丢弃 xref / trailer）。

重新生成：

```bash
node tests/fixtures/reader/generate-corrupt.mjs
```

程序化生成、无敏感数据，产物入仓供 CI / 实机验证使用（与 `tests/fixtures/forms/`
约定一致）。
