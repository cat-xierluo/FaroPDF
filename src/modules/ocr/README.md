# OCR Module

负责 OCR job model、后端选择、任务进度、双层 PDF 输出和 OCR 质量检查入口。

联网 OCR 只允许在用户确认后运行，API Key 不进入日志、仓库或错误报告。

当前第一版只提供 bridge/stub：

- `service/bridge.ts` 准备 OCR 请求、校验 provider、联网 consent、apiKeyRef、输入/输出路径和输出策略。
- Adapter 边界覆盖 `local-ocrmypdf`、`legal-skills`、`paddleocr`、`mineru`。
- 默认输出 `*-ocr.pdf`，不覆盖原始 PDF。
- Tauri command 当前只返回 queued job，不执行真实 OCR、不生成双层 PDF、不发起联网请求。
