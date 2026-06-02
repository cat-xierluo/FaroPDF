# PDF 算法融入计划

> Last updated: 2026-06-02

本文记录 FaroPDF 如何吸收本机 `legal-skills` 中 PDF 处理脚本的算法能力。目标不是把 Agent skill 原样搬进软件，而是将成熟脚本拆成可测试、可配置、可回退的产品模块。

## 来源

| 来源 | 重点脚本 | 可复用能力 |
| --- | --- | --- |
| `pdf-processor` | `pdf-preprocess-core.py`、`pdf-preprocess-ocr.py`、`pdf-compress.py`、`pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf-ocr-quality-check.py` | 扫描预处理、倾斜校正、裁边、压缩、OCR 后端调度、质量检查 |
| `pdf-organizer` | `pdf_organizer.py` | 文字层检测、页级证据、文书边界信号、manifest、A4 标准化、拆分/合并/命名 |
| `img2pdf` | `img_to_pdf.py` | 图片/PDF 页面按 A4 1/2/3/4 张每页编排 |

这些来源脚本均以“不修改原始文件”为默认策略，符合 FaroPDF 的 PDF 安全边界。

## 产品化原则

- 不把 CLI 脚本作为 UI 功能的唯一实现；核心算法应拆成服务函数、任务模型和可测试模块。
- 第一版允许 Tauri command 调用 Python bridge 或本地命令兜底，但 UI 和状态层必须通过统一 job model，不直接依赖脚本文字输出。
- 纯算法能力优先内化：压缩、A4 编排、页码/Bates、水印、文字层检测、页级 manifest。
- 重依赖能力走后台 bridge：OpenCV 预处理、`ocrmypdf`、PaddleOCR API、MinerU API。
- 所有输出默认为新 PDF，保留原始文件；覆盖原文件必须二次确认。
- API Key、Token、endpoint 通过设置页和安全存储管理，不进入日志和仓库。

## 关键算法映射

### 扫描预处理

来源：`pdf-processor/scripts/pdf-preprocess-core.py`、`pdf_preprocess_skew.py`

可产品化为 `scanPreprocessService`：

- PDF 类型检测：按文本量区分扫描件、原生 PDF 和混合 PDF。
- 粗方向检测：Tesseract OSD 优先，Hough 线检测和宽高比启发式兜底。
- 微倾斜检测：Hough 线段 + 水平投影方差双判定。
- 倾斜阈值：默认 `0.3` 度；超过合理上限时视为误检。
- 裁边：白边阈值 + 边距保护，旋转后可使用更激进裁边。
- 分块和并行：支持 `preprocessJobs` 和 `chunkPages`，避免大卷宗一次性占用过多内存。
- 输出策略：将页面重新编码为 PDF，可与压缩档位合并输出。

产品 UI 应暴露为“扫描清洁/校正”任务，而不是 OCR 附属选项。OCR 可以引用预处理输出，但用户也应能只做预处理。

### 压缩

来源：`pdf-processor/scripts/pdf-compress.py`

可产品化为 `compressionService`：

- 使用 PyMuPDF 遍历页面图像资源，按 xref 去重处理。
- 跳过 alpha image、mask image 和小图，避免破坏透明度和低收益资源。
- 按档位重编码 JPEG，并可对超大图片降采样。
- 保留文字层、批注、书签和多数对象结构；批注存在时降低垃圾回收级别。
- 可选择移除元数据。
- 输出统计：原始大小、压缩后大小、压缩率、处理图片数量、跳过图片数量。

第一版压缩档位沿用脚本经验值：

| 档位 | 质量 | 最大边长 | 适用 |
| --- | --- | --- | --- |
| low | 85 | 4200 | 打印、保真 |
| medium | 65 | 2000 | 日常阅读、法院上传 |
| high | 45 | 1600 | 严格体积限制 |

### OCR 后端

来源：`pdf-processor/scripts/pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py`

可产品化为 `ocrBridgeService`：

- `auto` 策略：按用户设置中的 provider 顺序尝试外部 API，失败后按策略回退本地 `ocrmypdf`。
- PaddleOCR API：支持异步 job 提交、轮询、JSONL 结果下载、本地双层 PDF 叠层。
- PaddleOCR-VL：可用于版面分析，但第一版先作为 OCR provider，不承担 Markdown 导出主链路。
- MinerU API：支持创建任务、上传、轮询、ZIP 解析、本地双层 PDF 叠层。
- 本地兜底：`ocrmypdf`，保留 `skip`、`redo`、`force` 模式。
- 质量检查：可检索页比例、关键词命中率、体积比、耗时、可选 CER。

设置页必须包含 endpoint、provider 顺序、timeout、重试、是否允许本地回退、联网 OCR 确认策略。

### 文书整理与页面 manifest

来源：`pdf-organizer/scripts/pdf_organizer.py`

可产品化为 `documentOrganizerService`：

- 文字层抽样检测：判断可搜索、缺失或低文本量页面。
- 页级检查：首行、标题候选、文书类型候选、页码标签、日期、主体候选、边界信号。
- manifest 草稿：按标题、页码重置、落款、表单信号猜测文书边界。
- 拆分/合并/规范命名：第一版可先实现 manifest 驱动，AI/人工复核后执行。
- A4 标准化：横向页面适配 A4 横版，竖向页面适配 A4 竖版，等比缩放居中。

这部分适合后续法律增强，但页级 manifest 可以提前进入 v0.1，因为页面整理、批注摘要和证据目录都会复用。

### 图片与 PDF 页面编排

来源：`img2pdf/scripts/img_to_pdf.py`

可产品化为 `imagePackService`：

- 支持图片目录、多个图片文件或已有 PDF 页面。
- 自动判断竖图/横图，竖图默认 3 张/页，横图默认 1 张/页。
- 支持 1/2/3/4 张每页、页边距、横竖版和排序。
- 输出 A4 PDF，不修改原始图片或 PDF。

这应作为“证据图片编排”进入页面整理工作台，而不是 OCR 模块。

## 推荐模块边界

| 模块 | 责任 |
| --- | --- |
| `scanPreprocessService` | 扫描件清洁、纠偏、裁边、预处理输出 |
| `compressionService` | PDF 图像资源压缩、压缩统计和预设 |
| `ocrBridgeService` | OCR provider 调度、任务进度、双层 PDF 输出 |
| `ocrQualityService` | OCR 后质量抽查、关键词命中和体积比报告 |
| `documentOrganizerService` | 页级 manifest、文书边界、规范命名、拆分合并建议 |
| `imagePackService` | 图片/PDF 页面 A4 多图编排 |
| `pdfOperationEngine` | 水印、页码、Bates、扁平化和页面操作输出 |

## 后续实现顺序

1. Foundation Gate 先建立共享 job model、设置页、后台 command 和输出安全策略。
2. 移植压缩和页码/Bates 这类依赖较少的纯处理能力。
3. 接入扫描预处理 pipeline，先支持只预处理，再与 OCR 任务串联。
4. 接入 PaddleOCR / MinerU provider 设置和后台任务。
5. 接入 OCR 质量检查，并在 OCR 完成页展示结果。
6. 接入文书整理 manifest 和证据图片 A4 编排。

## 风险

- Python/OpenCV/PyMuPDF 依赖重，不适合打包进前端主线程；需要 Tauri sidecar、外部 Python bridge 或 Rust/Node 替代实现。
- PaddleOCR 服务端方向/去畸变会改变坐标空间，双层 PDF 叠层必须同步页面尺寸和坐标映射。
- 压缩通过图像 xref 替换资源，必须保留文字层和批注；每个档位都需要 fixture 验证。
- 文书边界识别只能作为建议，不能自动拆分高风险法律材料；需要 manifest 预览和人工确认。
