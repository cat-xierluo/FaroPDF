# FaroPDF 架构文档

> Last updated: 2026-06-02

## 技术栈

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 桌面壳 | Tauri v2 | 文件打开、保存、系统窗口、文件关联、后台命令 bridge |
| 前端 | React + TypeScript + Vite | 应用界面、状态管理、渲染调度 |
| PDF 渲染 | PDF.js | 页面渲染、文本层、目录、缩略图、搜索基础 |
| PDF 操作 | pdf-lib | 页面复制、删除、重排、表单、元数据、导出保存 |
| PDF 操作引擎 | `pdfOperationEngine` 抽象 + pdf-lib 起步 | 水印、页码、Bates 编号、压缩预设、扁平化导出 |
| OCR bridge | 本地命令 / Legal Skills / OCR API | 双层 PDF、扫描件预处理、质量检查 |
| 扫描预处理 | OpenCV / PyMuPDF / OCR bridge | 清洁校正、方向检测、倾斜校正、裁边、预处理输出 |
| 设置与凭证 | Tauri command + 本地持久化 / 系统凭证预留 | 最近文件、默认保存策略、OCR provider 配置 |

## 系统架构

```text
┌─────────────────────────────────────────────┐
│ Tauri v2                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ React App                               │ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │ Main Toolbar                         │ │ │
│ │ │ Summary / Page / View / Mode / Search│ │ │
│ │ └──────────────────────────────────────┘ │ │
│ │ ┌──────────────┬──────────────────────┐ │ │
│ │ │ Utility Pane │ PDF Reader Canvas    │ │ │
│ │ │ Summary/View │ or Task Workspace    │ │ │
│ │ │ Settings     │ Page grid / PDF.js   │ │ │
│ │ └──────────────┴──────────────────────┘ │ │
│ │ Context Toolbar for annotate/OCR/export  │ │
│ └─────────────────────────────────────────┘ │
│ Tauri commands: fs / dialog / OCR bridge    │
└─────────────────────────────────────────────┘
```

## 数据流

```text
打开 PDF
  ↓
Tauri fs 读取二进制
  ↓
PdfDocumentState 写入前端状态
  ↓
PDF.js getDocument(Uint8Array)
  ↓
读取页数、目录、页面尺寸和初始文字层状态
  ↓
虚拟化阅读区只请求可见页和邻近页
  ↓
PDF.js page.render(canvas) + text layer + annotation overlay
  ↓
用户搜索、批注、页面操作、水印、压缩、表单或 OCR
  ↓
搜索按需读取页文本并建立内存索引；批注/页面/导出/OCR 写入各自队列
  ↓
search state / sidecar / page operation queue / export job queue / OCR job queue
  ↓
导出时由 pdf-lib + OCR 输出文件生成新 PDF
```

## 核心接口

### PdfDocumentState

```ts
export type TextLayerStatus = 'unknown' | 'available' | 'partial' | 'missing' | 'poor';
export type OcrStatus = 'not-needed' | 'needed' | 'running' | 'completed' | 'failed';

export interface PdfDocumentState {
  path: string;
  name: string;
  fingerprint?: string;
  pageCount: number;
  currentPage: number;
  zoom: number;
  viewMode: 'continuous' | 'single' | 'double';
  dirty: boolean;
  textLayerStatus: TextLayerStatus;
  ocrStatus: OcrStatus;
  lastSavedAt?: string;
}
```

### PdfPageViewport

```ts
export interface PdfPageViewport {
  pageIndex: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  scale: number;
}
```

### PdfPageText

```ts
export interface PdfPageText {
  pageIndex: number;
  text: string;
  status: TextLayerStatus;
  itemCount: number;
  charCount: number;
}
```

搜索模块通过阅读服务按页获取 `PdfPageText`。当前第一版只在用户输入搜索词后按批次索引页面，不在打开 PDF 时同步扫描全卷；搜索词、结果和索引都只保留在前端内存中，不写入最近记录或日志。

### TextSearchState

```ts
export interface TextSearchState {
  query: string;
  status: 'idle' | 'indexing' | 'ready' | 'empty' | 'needs-ocr' | 'error';
  hits: Array<{
    id: string;
    pageIndex: number;
    pageNumber: number;
    matchIndex: number;
    snippet: string;
  }>;
  activeHitId?: string;
  pendingPageCount: number;
  textLayerStatus: TextLayerStatus;
  ocrHint: null | {
    visible: boolean;
    reason: 'missing-text-layer' | 'partial-text-layer' | 'poor-text-layer';
    message: string;
    actionLabel: string;
  };
}
```

### PdfAnnotation

```ts
export type PdfAnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'note'
  | 'textbox'
  | 'rectangle'
  | 'arrow'
  | 'ink'
  | 'stamp';

export interface PdfAnnotation {
  id: string;
  type: PdfAnnotationType;
  pageIndex: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  color: string;
  opacity?: number;
  content?: string;
  quote?: string;
  author?: { id?: string; displayName?: string };
  style?: { strokeWidth?: number; fontSize?: number; fontFamily?: string; fillColor?: string };
  line?: { start: { x: number; y: number }; end: { x: number; y: number } };
  ink?: { strokes: Array<Array<{ x: number; y: number }>> };
  stamp?: { label: string; name: 'reviewed' | 'important' | 'todo' | 'evidence' | 'custom' };
  createdAt: string;
  updatedAt: string;
}
```

### AnnotationSidecar

批注第一版采用可编辑 sidecar，不直接写回原始 PDF。默认路径为原 PDF 所在目录下的 `.faropdf/annotations/<document-key>.annotations.json`：

- 有 PDF fingerprint 时使用 fingerprint 派生安全文件名。
- 无 fingerprint 时使用源路径哈希兜底，不把真实文件名写进 sidecar 文件名。
- sidecar 内容只保存 `fingerprint`、`pageCount`、schema version、时间戳和批注数组，不保存源 PDF 文件名。
- Markdown / HTML 批注摘要使用 `PDF <fingerprint>` 或通用标签，不包含真实用户文件名。

```ts
export interface AnnotationSidecar {
  schemaVersion: 1;
  document: {
    fingerprint?: string;
    pageCount?: number;
  };
  annotations: PdfAnnotation[];
  createdAt: string;
  updatedAt: string;
}
```

### PdfPageOperation

```ts
export type PdfPageOperationType =
  | 'rotate'
  | 'delete'
  | 'reorder'
  | 'insert'
  | 'extract'
  | 'merge'
  | 'crop'
  | 'split-scan'
  | 'number';

export interface PdfPageOperation {
  id: string;
  type: PdfPageOperationType;
  pageIndexes: number[];
  payload: Record<string, unknown>;
  createdAt: string;
}
```

### PdfExportJob

```ts
export type PdfExportJobType =
  | 'flatten-annotations'
  | 'flatten-form'
  | 'watermark'
  | 'page-number'
  | 'bates-number'
  | 'compress'
  | 'page-operations';

export type PdfExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PdfExportJob {
  id: string;
  type: PdfExportJobType;
  inputPath: string;
  outputPath?: string;
  status: PdfExportJobStatus;
  payload: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

### OcrJob

```ts
export type OcrBackend = 'local-ocrmypdf' | 'legal-skills' | 'paddleocr' | 'mineru';
export type OcrJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface OcrJob {
  id: string;
  inputPath: string;
  pageRange?: string;
  backend: OcrBackend;
  status: OcrJobStatus;
  outputPath?: string;
  quality?: {
    searchedKeywords: string[];
    matchedKeywords: string[];
    textPages: number;
    emptyTextPages: number;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

### ScanPreprocessJob

```ts
export type ScanPreprocessJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScanPreprocessOutputMode = 'preprocess-only';

export interface ScanPreprocessOptions {
  enhanceScans: boolean;
  detectOrientation: boolean;
  deskew: boolean;
  splitPages: boolean;
  cropPages: boolean;
  trimBlankEdges: boolean;
  outputMode: ScanPreprocessOutputMode;
  dpi: number;
  jpegQuality: number;
  skewThresholdDegrees: number;
  rotationConfidence: number;
  maxDeskewDegrees: number;
  blankEdgeMarginPx: number;
  blankEdgeThreshold: number;
  parallelJobs: number;
  chunkPages: number;
  preserveOriginalPageSize: boolean;
}

export interface ScanPreprocessJob {
  id: string;
  inputPath: string;
  outputPath: string;
  pageRange?: string;
  status: ScanPreprocessJobStatus;
  options: ScanPreprocessOptions;
  progress: {
    stage: 'queued' | 'validating' | 'preprocessing' | 'writing-output' | 'completed' | 'failed';
    completedPages: number;
    totalPages: number;
    message?: string;
  };
  summary?: {
    totalPages: number;
    processedPages: number;
    rotatedPages: number;
    deskewedPages: number;
    splitPages: number;
    croppedPages: number;
    blankEdgesClearedPages: number;
    elapsedMs: number;
    outputPath: string;
    preprocessOnly: boolean;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

### AppSettings 与 OcrProviderConfig

```ts
export type OcrProviderType = 'local-ocrmypdf' | 'legal-skills' | 'paddleocr' | 'mineru';

export interface OcrProviderConfig {
  id: string;
  type: OcrProviderType;
  displayName: string;
  endpoint?: string;
  apiKeyRef?: string;
  enabled: boolean;
  requiresNetworkConsent: boolean;
}

export interface AppSettings {
  defaultSaveDirectory?: string;
  defaultZoom: number;
  defaultViewMode: 'continuous' | 'single' | 'double';
  defaultSavePolicy: 'always-export-copy' | 'ask-each-time' | 'allow-overwrite-with-confirmation';
  recentFiles: Array<{ path: string; name: string; lastOpenedAt: string }>;
  defaultOcrProviderId?: string;
  ocrProviders: OcrProviderConfig[];
  requireNetworkOcrConfirmation: boolean;
}
```

## 已落地目录边界

Foundation Gate 已落地以下边界，后续 worker 默认只修改自己任务声明的模块目录：

| 目录 | 职责 |
| --- | --- |
| `src/components/layout/` | 基础阅读器 Shell、主工具栏、按需左侧工具区、上下文工具条、阅读区、页面管理工作台和状态栏 |
| `src/styles/` | 全局布局与设计 token |
| `src/shared/pdf/` | PDF 文档、页面视口、批注、页面操作和导出任务契约 |
| `src/shared/ocr/` | OCR provider、OCR job 和质量摘要契约 |
| `src/shared/preprocess/` | 扫描预处理参数、job、进度、统计、默认值和校验 |
| `src/shared/settings/` | AppSettings、默认设置和密钥遮罩 |
| `src/shared/foundation/` | 多 worktree worker 的模块边界声明 |
| `src/modules/*/README.md` | reader、search、annotation、pages、export、preprocess、ocr、forms、settings 的模块职责 |
| `tests/fixtures/` | 可提交测试夹具规则，不放真实法律材料 |

## 已落地服务

### Reader

`src/modules/reader/` 已建立 PDF.js 阅读底座：

- `pdfReaderService`：懒加载 `pdfjs-dist`，配置独立 PDF.js worker，读取 PDF 页数、指纹、首页尺寸和文字层初始状态。
- `readerState`：维护打开状态、页码、缩放、视图模式、文字层状态和错误信息。
- `virtualization`：按当前页、总页数、视图模式和 overscan 计算应渲染页范围。
- `useReaderController`：连接文件输入、PDF 加载和阅读状态。

当前 UI 使用阅读占位页展示虚拟化范围；真实 canvas 渲染、滚动驱动当前页和页级尺寸缓存继续由后续阅读深化任务完成。

### Settings

`src/shared/settings/` 与 `src/modules/settings/` 已建立设置和 OCR provider 配置底座：

- `createDefaultAppSettings`：提供默认保存策略、默认缩放、默认视图、最近文件数组、本地 OCR provider、PaddleOCR 和 MinerU provider。
- `validateAppSettings`：校验缩放范围、默认 OCR provider、联网 provider endpoint、apiKeyRef 和联网确认策略。
- `sanitizeAppSettingsForStorage` / `exportSafeAppSettings`：保存和展示前对 API Key 引用脱敏。
- `createSettingsService`：通过 Tauri command 读取、校验和写入设置。
- `SettingsPanel`：支持默认保存策略、默认缩放、阅读模式、OCR provider、联网 OCR 确认和外部 provider endpoint/apiKeyRef 编辑。

`src-tauri/src/lib.rs` 已提供 `read_app_settings` 与 `write_app_settings`，将设置写入应用配置目录下的 `settings.json`，不触碰用户 PDF 文件。

### Scan Preprocess

`src/shared/preprocess/` 与 `src/modules/preprocess/` 已建立扫描预处理第一版 job bridge：

- `createDefaultScanPreprocessOptions`：从 `pdf-processor` 脚本吸收保守默认值，默认 preprocess-only、300 DPI、JPEG 90、旋转置信度 0.5、倾斜阈值 0.3 度、最大微倾斜 5 度、串行处理、不分块、不默认裁剪。
- `validateScanPreprocessRequest`：校验 PDF 输入输出、页码范围、DPI、JPEG 质量、旋转置信度、倾斜阈值、并行数、分块页数和清边参数；错误信息不包含完整本地路径。
- `suggestScanPreprocessOutputPath`：默认生成 `*-preprocessed.pdf`，不覆盖原始 PDF。
- `createScanPreprocessService`：准备请求、调用 `start_scan_preprocess_job`，并脱敏 bridge 错误。
- `src-tauri/src/lib.rs`：提供 `start_scan_preprocess_job` command stub，返回 queued job、0 页进度和安全输出路径；真实 OpenCV/PyMuPDF/Python bridge 后续接入。

## 模块规划

| 模块 | 职责 |
| --- | --- |
| `fileService` | 打开、另存、导出 PDF 和 sidecar |
| `pdfDocumentService` | PDF.js 文档加载、页数、目录、页面尺寸 |
| `pdfRenderScheduler` | 页面虚拟化、渲染队列、取消不可见页渲染 |
| `pdfTextService` | 文本层检测、按需全文索引、搜索命中 |
| `annotationService` | sidecar 批注模型、编辑、导出摘要 |
| `pdfExportService` | pdf-lib 页面操作、批注扁平化、表单导出 |
| `pdfOperationEngine` | 抽象 PDF 写入能力，第一版用 pdf-lib 起步，预留更强引擎替换空间 |
| `pageOrganizerService` | 旋转、删除、重排、插入、提取、合并、编号 |
| `scanPreprocessService` | 扫描件清洁、90 度方向检测、微倾斜校正、裁边和预处理输出 |
| `compressionService` | PDF 图像资源重编码、降采样、压缩档位和压缩统计 |
| `ocrBridgeService` | 调用本地或云端 OCR 后端，管理任务状态 |
| `ocrQualityService` | OCR 可检索页比例、关键词命中、体积比、耗时和 CER 检查 |
| `documentOrganizerService` | 页级检查索引、文书边界 manifest、规范命名和 A4 标准化 |
| `imagePackService` | 图片或 PDF 页面按 A4 多图编排为证据 PDF |
| `settingsService` | 最近文件、默认缩放、阅读布局、默认保存策略、OCR provider 设置 |

## 性能策略

- 首屏只加载应用 shell、文件服务和阅读容器。
- PDF.js worker、缩略图、全文搜索、批注列表、页面整理和 OCR bridge 按需加载。
- 阅读区只保留可见页和邻近页 canvas；远离视口的页面释放 canvas。
- 缩略图低分辨率渲染，并按滚动位置懒加载。
- 全文索引按页分批建立，优先索引当前页附近。
- OCR、合并、压缩、水印和导出等后台任务不得阻塞主线程和阅读滚动。

## 保存策略

- 原始 PDF 默认不可变。
- 批注默认保存到 sidecar，导出时再写入新 PDF。
- 页面整理、OCR、压缩、扁平化表单默认输出新 PDF。
- 水印、Bates 编号、页码和批注扁平化默认输出新 PDF。
- 覆盖原文件必须由用户显式选择并二次确认。

## OCR bridge

OCR 不直接内置到前端。第一版 bridge 支持：

- 本地 Legal Skills 的 PDF Processor / Legal OCR。
- 本地 `ocrmypdf` 兜底。
- PaddleOCR / MinerU 云端后端，但必须用户确认后使用。

外部 OCR provider 的 endpoint、模型参数和密钥引用由设置页管理。API Key 不写入公开仓库，不在 UI 中完整展示，不在日志或错误报告中输出。

任务输出必须记录：

- 使用的后端。
- 输入文件和页码范围。
- 输出文件路径。
- 错误原因或回退路径。
- OCR 后搜索质量检查结果。

## PDF 算法来源

FaroPDF 可复用本机 `legal-skills` 中成熟 PDF 脚本的算法，但不直接把 Agent skill 工作流当作产品实现。具体算法素材、候选议题和任务归属以 `docs/TASKS.md` 为唯一来源。

当前吸收范围：

- `pdf-processor`：扫描预处理、纠偏、压缩、OCR provider、OCR 质量检查。
- `pdf-organizer`：文字层检测、页级检查、文书边界 manifest、A4 标准化。
- `img2pdf`：证据图片和 PDF 页面 A4 多图编排。

产品实现上，UI 只调用统一 job model；Python 脚本或外部命令只能作为 Tauri 后台 bridge、sidecar 或未来算法移植来源。
