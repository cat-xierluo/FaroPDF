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

## encrypted.pdf

用户密码为 `test123` 的 256-bit 加密 PDF，用于复现 PDF.js `PasswordException`
加载路径（加密 PDF → reader 提示输入密码 → 输对打开 / 输错重试 / 取消）。

- 无密码加载：`PasswordException code=1`（NEED_PASSWORD）
- 错误密码：`PasswordException code=2`（INCORRECT_PASSWORD）
- 密码 `test123`：加载成功

生成方式：pdf-lib 生成明文 + 系统 `qpdf` 加密（generate-time 工具，不进 runtime
依赖）。密码常量 `ENCRYPTED_FIXTURE_PASSWORD` 从 `generate-encrypted.mjs` 导出。

重新生成（需本机 `brew install qpdf`）：

```bash
node tests/fixtures/reader/generate-encrypted.mjs
```
