# OCR Module

负责 OCR job model、后端选择、任务进度、双层 PDF 输出和 OCR 质量检查入口。

联网 OCR 只允许在用户确认后运行，API Key 不进入日志、仓库或错误报告。

## 当前实现状态（2026-06-14 修订）

OCR 真实接入实际已就位（ISS-FIX-7 / DEC-095）：

- `service/bridge.ts` 准备 OCR 请求、校验 provider、联网 consent、apiKeyRef、输入/输出路径和输出策略；通过 `createTauriOcrBridgeBackend()` 调 `invoke("start_ocr_job", { request })`。
- `src-tauri/src/ocr_dispatch.rs` 真实 spawn `ocrmypdf` 子进程（`OcrDispatchBackend::LocalOcrMyPdf`）+ 调用 PaddleOCR / MinerU HTTPS endpoint（`paddleocr` / `mineru`）。
- `src-tauri/src/ocr_queue.rs` 持久化任务到 `app_config_dir/ocr-jobs.json`，启动时回收残留 running 任务为 cancelled。
- `src-tauri/src/ocr_text_extract.rs` OCR 后用 `pdftotext` 抽取页面文本。
- `src-tauri/src/ocr_credentials.rs` 解析 `env:VAR_NAME` 和 `keychain:providerId:keyName` 凭证引用。
- 4 个 Tauri command：`list_ocr_jobs` / `poll_ocr_job` / `cancel_ocr_job` / `extract_ocr_text`（定义在 `src-tauri/src/lib.rs`）。
- 端到端覆盖：`tests/e2e/ocr-e2e.test.ts`（前端 fixture + 真实 ocrmypdf + 真实 pdftotext + 真实质量报告）+ `src-tauri/src/lib.rs` `mod ocr_bridge_tests`（Rust 集成测试 + 真实 OCR + 任务队列持久化）。缺工具时静默跳过。
- 默认输出 `*-ocr.pdf`，不覆盖原始 PDF。
- Adapter 边界覆盖 `local-ocrmypdf`、`legal-skills`、`paddleocr`、`mineru`。

## 历史（不再适用，2026-06-14 之前）

README 之前表述 "当前第一版只提供 bridge/stub" 和 "Tauri command 当前只返回 queued job"，与代码实情不符（ISS-007 E2E 联调 worker 已在 0.1.0-alpha.10 落实真实接入，DEC-050 / PR #27）。DEC-095 修订此处。
