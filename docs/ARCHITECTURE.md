# FaroPDF 架构文档

> Last updated: 2026-06-09

## 技术栈

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 桌面壳 | Tauri v2 | 文件打开、保存、系统窗口、原生菜单、文件关联、后台命令 bridge |
| 前端 | React + TypeScript + Vite | 应用界面、状态管理、渲染调度 |
| PDF 渲染 | PDF.js | 页面渲染、文本层、目录、缩略图、搜索基础 |
| PDF 操作 | pdf-lib | 页面复制、删除、重排、表单、元数据、导出保存 |
| PDF 操作引擎 | `pdfOperationEngine` 抽象 + pdf-lib 起步 | 表单扁平化、批注导出计划、页面操作真实改写、水印、页眉页脚、页码、Bates 和压缩副本 |
| OCR bridge | 本地命令 / Legal Skills / OCR API | 双层 PDF、扫描件预处理、质量检查 |
| 扫描预处理 | OpenCV / PyMuPDF / OCR bridge | 清洁校正、方向检测、倾斜校正、裁边、预处理输出 |
| 设置与凭证 | Tauri command + 本地持久化 / 系统凭证预留 | 最近文件、默认保存策略、外观偏好、OCR provider 配置 |

## 系统架构

```text
┌─────────────────────────────────────────────┐
│ Tauri v2                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ React App                               │ │
│ │ ┌──────────────────────────────────────┐ │ │
│ │ │ Main Toolbar                         │ │ │
│ │ │ Summary / Page / View / Open / Tools │ │ │
│ │ └──────────────────────────────────────┘ │ │
│ │ ┌──────────────┬──────────────────────┐ │ │
│ │ │ Utility Pane │ PDF Reader Canvas    │ │ │
│ │ │ Summary/View/Forms │ or Task Workspace│ │ │
│ │ │ Settings     │ Page grid / PDF.js   │ │ │
│ │ └──────────────┴──────────────────────┘ │ │
│ │ Context Toolbar after workflow selection │ │
│ └─────────────────────────────────────────┘ │
│ Tauri commands/events: menu / dialog / OCR  │
└─────────────────────────────────────────────┘
```

## 数据流

```text
打开 PDF
  ↓
浏览器 File 或 Tauri dialog 选择路径
  ↓
浏览器 File.arrayBuffer 或 Tauri read_pdf_file_from_path 读取二进制
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
导出时由 pdfOperationEngine 读取 PDF bytes，用 pdf-lib 生成新 PDF bytes；路径型导出再写入新输出路径
```

### 原生菜单桥接

macOS 原生菜单由 `src-tauri/src/lib.rs` 使用 Tauri v2 `MenuBuilder` / `SubmenuBuilder` 创建。需要进入 PDF 业务工作流的自定义菜单项 id 与 `src/shared/app/commands.ts` 的 `AppCommandId` 保持一致；系统窗口动作留在 Rust 侧直接处理：

- `file-new-window`：Rust 菜单事件直接用 `WebviewWindowBuilder` 创建新的 FaroPDF 窗口，不进入前端 command catalog。
- `file-open`：Rust 菜单事件发出 `faropdf://command`，前端 `nativeMenuBridge` 转给 `App.tsx`，再通过 Tauri dialog 选择 PDF，并调用 `read_pdf_file_from_path` 专用 command 读取 bytes。
- `file-save-as`：前端复用当前 reader 缓存的源 PDF bytes，通过 `reader.saveUpdatedBytes` 保存 `*-copy.pdf` 新副本，不覆盖原始 PDF。
- `export-page-number` / `export-bates` / `export-header-footer` / 水印 / 压缩：Rust 只发 `{ id }` 事件，前端复用同一 command model 进入导出模式和 `ExportDeliveryPanel`。
- `export-annotation-summary`：工具启动器复用同一 command model 进入批注模式和 `AnnotationSidebar` 摘要视图，不进入导出面板。
- `forms-flatten`：Rust 只发 `{ id }` 事件，前端复用同一 command model 进入填写和签名模式并打开 `FormsPanel`，由面板承载字段读取和扁平化导出确认。
- `help-about`：Rust 发出 `faropdf://command`，前端打开设置浮层并定位到 `关于` section，不显示占位 feedback。
- `view-fullscreen` / `close-window`：由 Rust 直接调用窗口 API 处理，不进入前端业务状态。

该桥接避免在 Rust 菜单、右侧工具启动器和 AppShell 之间维护三套命令分支。

### 工具启动器与上下文工具条

前端业务命令统一由 `src/shared/app/commands.ts` 描述。阅读态顶栏只保留布局、打开、阅读控制、全文搜索、`工具` 和设置入口；`mode-annotate` / `mode-export` / `mode-forms` / `mode-ocr` 不再作为顶栏 entry point 暴露，而是通过 `工具` 工作流启动器进入。

进入任务模式后，`AppShell` 按 `activeMode` 渲染第二行上下文工具条或独立工作台：

- `annotate`：显示批注上下文工具条和批注 overlay。
- `export`：显示导出上下文工具条，并挂右侧 `ExportDeliveryPanel`。
- `forms`：显示填写和签名上下文工具条，扁平化等低频动作进入 FormsPanel。
- `ocr`：独占主工作区，显示 OCR 工具条和 OCR 任务 / 质量报告工作台。

阅读辅助工具仍通过 `toolbarRegistry` 注册到 `read` mode，但只在已打开 PDF 时以图标按钮追加到阅读控制区，避免空态或阅读态顶栏重新堆叠任务模式文字。

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

### PdfPageOrganizerState

页面整理第一版在 `src/shared/pdf/pageOrganizer.ts` 记录可回退的页面工作台状态，不直接改写原始 PDF。`src/modules/pages/pageOrganizer.ts` 以纯函数方式更新状态，供后续 UI、导出服务和后台任务复用。

```ts
export interface PdfPageOrganizerPage {
  id: string;
  originalPageIndex: number;
  originalPageNumber: number;
  orderIndex: number;
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
}

export interface PdfPageOrganizerState {
  id: string;
  document: {
    pageCount: number;
    sourcePath?: string;
    fingerprint?: string;
  };
  pages: PdfPageOrganizerPage[];
  actions: Array<{
    id: string;
    type: 'rotate' | 'delete' | 'reorder' | 'restore';
    pageIds: string[];
    pageIndexes: number[];
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  undoStack: Array<{
    pages: PdfPageOrganizerPage[];
    actions: PdfPageOrganizerState['actions'];
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

当前导出入口生成 `PdfPageOperationsExportOperation`、`PdfExportFileRequest`，页面管理工作台也可直接复用 operation 进行 bytes 另存：

- 默认输出路径为 `*-organized.pdf`。
- 输出路径必须不同于原始 PDF，`../` 等等价路径会被归一化后拒绝。
- `execute` 模式通过 `pdfOperationEngine` 真实改写页面顺序、旋转和删除；`plan-only` 仅作为显式兼容模式保留。

### PdfExportJob

`PdfExportJob` 记录队列型任务状态；实际导出执行使用 `PdfExportRequest` / `PdfExportResult`，确保目标是 bytes 结果或不同于原始文件的新输出路径。

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

### PdfExportRequest

```ts
export type PdfExportDestination =
  | { type: 'bytes' }
  | { type: 'file'; outputPath: string };

export type PdfExportOperation =
  | { id: string; type: 'flatten-annotations'; sidecar: AnnotationSidecar; strategy?: 'plan-only' | 'draw' }
  | { id: string; type: 'flatten-form' }
  | { id: string; type: 'page-operations'; operations: PdfPageOperation[]; mode?: 'plan-only' | 'execute' }
  | { id: string; type: 'watermark'; pageIndexes?: number[]; watermark: TextOrImageWatermark }
  | { id: string; type: 'page-number'; pageIndexes?: number[]; format?: string; startNumber?: number }
  | { id: string; type: 'bates-number'; pageIndexes?: number[]; prefix?: string; suffix?: string; startNumber: number; digits?: number }
  | { id: string; type: 'compress'; pageIndexes?: number[]; preset: 'screen' | 'ebook' | 'print' | 'court-upload' | 'court-5mb' | 'court-10mb' | 'court-20mb' | 'court-50mb'; mode?: 'plan-only' | 'apply' };

export interface PdfExportRequest {
  id: string;
  source: {
    bytes: Uint8Array;
    path?: string;
    fingerprint?: string;
  };
  destination: PdfExportDestination;
  operations: PdfExportOperation[];
  requestedAt: string;
}

export interface PdfExportResult {
  id: string;
  bytes: Uint8Array;
  destination: PdfExportDestination;
  summary: PdfExportSummary;
  completedAt: string;
}
```

导出引擎第一版边界：

- `pdfOperationEngine` 不写文件，只返回新 PDF bytes；`pdfExportService` 在路径型导出时拒绝 `outputPath === inputPath`。
- `flatten-form` 使用 pdf-lib `form.flatten()`，可生成不可编辑表单提交版 bytes；UI 入口归属填写和签名面板，不进入导出二级工具条。
- `flatten-annotations` 支持 `plan-only` 摘要模式和 `draw` 真实绘制模式；批注侧栏的 `扁平化导出` 走 `draw`，默认保存 `*-annotations-flattened.pdf` 新副本，不覆盖原始 PDF。
- `page-operations` 支持 `execute` 真实改写页面顺序、旋转和删除；裁剪、插入和合并仍待后续导出深化接入。
- `watermark`、`page-number`、`bates-number` 使用 pdf-lib 写入新 PDF bytes；CJK 文本通过 Source Han Sans 字体路径嵌入。页眉页脚复用两个 text watermark operation，页眉映射到 `top-left` / `top-center` / `top-right`，页脚映射到 `bottom-left` / `bottom-center` / `bottom-right`，应用范围通过 `PdfWatermarkOperation.pageIndexes` 支持全部页面 / 奇数页 / 偶数页。
- 导出模式 UI 通过 `ExportDeliveryPanel` 复用 `reader.getFileBytes()` 和 `reader.saveUpdatedBytes()` 调用 `watermark` / `page-number` / `bates-number` / `compress` operation，默认下载 `*-text-watermarked.pdf` / `*-image-watermarked.pdf` / `*-header-footer.pdf` / `*-page-numbered.pdf` / `*-bates.pdf` / `*-compressed.pdf`，不覆盖原始 PDF。
- `compress mode=apply` 调用 `compressionService` 生成压缩后 PDF，并把返回 bytes 重新加载为后续导出工作副本；当前支持对象流保存、JPEG DCTDecode 图像重编码和目标体积检查，DPI 降采样仍留给后续后台 bridge。

### OcrJob

```ts
export type OcrBackend = 'local-ocrmypdf' | 'legal-skills' | 'paddleocr' | 'mineru';
export type OcrJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OcrOutputStrategy = 'new-layered-pdf' | 'text-sidecar' | 'quality-check-only';

export interface OcrQualityCheckRequest {
  enabled: boolean;
  samplePages: number[];
  keywords: string[];
  minTextPageRatio?: number;
  maxFileSizeRatio?: number;
}

export interface OcrJobProgress {
  stage:
    | 'queued'
    | 'validating'
    | 'dispatching-provider'
    | 'running-provider'
    | 'writing-output'
    | 'quality-check'
    | 'completed'
    | 'failed';
  completedPages: number;
  totalPages: number;
  message?: string;
}

export interface OcrJob {
  id: string;
  inputPath: string;
  pageRange?: string;
  backend: OcrBackend;
  providerId?: string;
  status: OcrJobStatus;
  outputStrategy?: OcrOutputStrategy;
  outputPath?: string;
  progress: OcrJobProgress;
  qualityCheck?: OcrQualityCheckRequest;
  quality?: {
    searchedKeywords: string[];
    matchedKeywords: string[];
    textPages: number;
    emptyTextPages: number;
    fileSizeRatio?: number;
    elapsedMs?: number;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

OCR 质量检查第一版单独提供纯逻辑报告模型：

```ts
export interface OcrQualityReport {
  totalPages: number;
  searchablePages: number;
  searchablePageRatio: number;
  keywordTotal: number;
  keywordHitRate: number | null;
  cer: number | null;
  fileSizeRatio: number | null;
  elapsedMs: number | null;
  checks: OcrQualityCheckResult[];
  problemPages: OcrQualityProblemPage[];
  passed: boolean;
  summary: OcrQualitySummary;
}
```

`OcrQualityReport` 的输入来自 OCR 后页面文本、关键词、输入/输出文件体积、耗时和可选参考文本。当前不直接解析真实 PDF，也不执行 OCR provider；后续真实 OCR 任务完成后把提取出的页面文本和统计数据传入 `ocrQualityCheckService`。

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
  defaultViewMode: 'continuous' | 'single' | 'double' | 'fit-width';
  defaultSavePolicy: 'always-export-copy' | 'ask-each-time' | 'allow-overwrite-with-confirmation';
  themePreference: 'light' | 'dark';
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
| `src/shared/pdf/` | PDF 文档、页面视口、批注、页面整理、页面操作和导出任务契约 |
| `src/shared/ocr/` | OCR provider、OCR job 和质量摘要契约 |
| `src/shared/security/` | 联网 OCR 隐私提示、consent decision、脱敏路径摘要、API key 引用脱敏和审计记录契约 |
| `src/shared/preprocess/` | 扫描预处理参数、job、进度、统计、默认值和校验 |
| `src/shared/settings/` | AppSettings、默认设置和密钥遮罩 |
| `src/shared/foundation/` | 多 worktree worker 的模块边界声明 |
| `src/modules/*/README.md` | reader、search、annotation、pages、export、preprocess、ocr、forms、settings 的模块职责 |
| `tests/fixtures/` | 可提交测试夹具规则，不放真实法律材料 |

## 已落地服务

### Reader

`src/modules/reader/` 已建立 PDF.js 阅读底座：

- `pdfReaderService`：懒加载 `pdfjs-dist`，配置独立 PDF.js worker，读取 PDF 页数、指纹、首页尺寸和文字层初始状态。
- `renderPageToCanvas`：接收可选 `AbortSignal`，在页面重新渲染、模式切换或卸载时取消 PDF.js render task，避免同一 canvas 并发渲染。
- `readerState`：维护打开状态、页码、缩放、视图模式、文字层状态和错误信息。
- `virtualization`：按当前页、总页数、视图模式和 overscan 计算应渲染页范围。
- `useReaderController`：连接文件输入、PDF 加载和阅读状态。

当前 UI 已使用 PDF.js canvas 渲染阅读页；滚动驱动当前页和页级尺寸缓存已在阅读深化中接入，后续重点是大卷宗渲染调度和页级资源释放。

### Settings

`src/shared/settings/` 与 `src/modules/settings/` 已建立设置和 OCR provider 配置底座：

- `createDefaultAppSettings`：提供默认保存策略、默认缩放、默认视图、浅色外观偏好、最近文件数组、本地 OCR provider、PaddleOCR 和 MinerU provider。
- `validateAppSettings`：校验缩放范围、外观偏好、默认 OCR provider、联网 provider endpoint、apiKeyRef 和联网确认策略。
- `sanitizeAppSettingsForStorage` / `exportSafeAppSettings`：保存和展示前对 API Key 引用脱敏。
- `createSettingsService`：通过 Tauri command 读取、校验和写入设置。
- `SettingsPanel`：支持外观偏好、默认保存策略、默认缩放、阅读模式、OCR provider、联网 OCR 确认和外部 provider endpoint/apiKeyRef 编辑。

`src-tauri/src/lib.rs` 已提供 `read_app_settings` 与 `write_app_settings`，将设置写入应用配置目录下的 `settings.json`，不触碰用户 PDF 文件。

### Scan Preprocess

`src/shared/preprocess/` 与 `src/modules/preprocess/` 已建立扫描预处理第一版 job bridge：

- `createDefaultScanPreprocessOptions`：从 `pdf-processor` 脚本吸收保守默认值，默认 preprocess-only、300 DPI、JPEG 90、旋转置信度 0.5、倾斜阈值 0.3 度、最大微倾斜 5 度、串行处理、不分块、不默认裁剪。
- `validateScanPreprocessRequest`：校验 PDF 输入输出、页码范围、DPI、JPEG 质量、旋转置信度、倾斜阈值、并行数、分块页数和清边参数；错误信息不包含完整本地路径。
- `suggestScanPreprocessOutputPath`：默认生成 `*-preprocessed.pdf`，不覆盖原始 PDF。
- `createScanPreprocessService`：准备请求、调用 `start_scan_preprocess_job`，并脱敏 bridge 错误。
- `src-tauri/src/lib.rs`：提供 `start_scan_preprocess_job` command stub，返回 queued job、0 页进度和安全输出路径；真实 OpenCV/PyMuPDF/Python bridge 后续接入。

### Pages

`src/shared/pdf/pageOrganizer.ts` 与 `src/modules/pages/` 已建立页面整理状态底座：

- `createPageOrganizerState`：按 PDF 页数创建页面项，记录原始页码、当前顺序、旋转角和删除状态。
- `rotateOrganizerPages` / `deleteOrganizerPages` / `reorderOrganizerPages` / `restoreOrganizerPages`：以稳定 page id 更新页面状态，并为每次高风险操作压入撤销栈。
- `undoPageOrganizer`：恢复上一个页面整理快照，确保旋转、删除和重排都可回退。
- `createPageOrganizerExportOperation`：生成可供前端 bytes 另存复用的 `page-operations execute` operation。
- `createPageOrganizerExportRequest`：生成路径型页面整理导出请求，默认 `*-organized.pdf` 新输出路径，并拒绝等价覆盖原始 PDF 的路径。

页面管理工作台已接入状态机：上移 / 下移重排、旋转、删除和撤销会更新页面网格，另存时调用 `pdfOperationEngine` 输出新 PDF bytes。插入/合并/裁剪、A4 标准化和页级 manifest 后续接入。

### 证据图片 A4 编排（imagePack）

`src/shared/pdf/imagePack.ts` 与 `src/modules/pages/imagePack/imagePackPlanner.ts` 已建立证据图片 A4 编排第一版 plan-only 底座（ISS-018）：

- 共享契约：`ImagePackInputItem`（`image` / `pdf-page` 两种 source，含 `width` / `height` / `sourcePath` / `sourcePageIndex` / `label`）、`ImagePackLayoutOptions`（`itemsPerPage` / `orientation` / `margin` / `sort`）、`ImagePackPlan`（含 `pages` / `cells` / `summary` / `warnings`），以及 A4 尺寸常量 `A4_PORTRAIT_SIZE_PT` / `A4_LANDSCAPE_SIZE_PT`。
- `createImagePackPlan`：纯函数规划器，校验条目、归一化选项、按 `sort` 排序、解析 `itemsPerPage=auto`、生成单元格布局、建议 `*-evidence-pack.pdf` 输出路径并拒绝与输入 `sourcePath` 等价的输出。
- `suggestImagePackOutputPath`：根据第一个输入 `sourcePath` 生成 `*-evidence-pack.pdf`，无路径时回退 `evidence-pack.pdf`。
- 边界：当前是 plan-only，不读取真实图片或 PDF、不渲染像素、不向 `pdfOperationEngine` 提交 operation、不引入新依赖；不修改 `package.json` / 锁文件 / `src-tauri/` / `src/App.tsx` / `src/styles/`。

## 模块规划

| 模块 | 职责 |
| --- | --- |
| `fileService` | 打开、另存、导出 PDF 和 sidecar |
| `pdfDocumentService` | PDF.js 文档加载、页数、目录、页面尺寸 |
| `pdfRenderScheduler` | 页面虚拟化、渲染队列、取消不可见页渲染 |
| `pdfTextService` | 文本层检测、按需全文索引、搜索命中 |
| `annotationService` | sidecar 批注模型、编辑、导出摘要 |
| `pdfExportService` | 路径型导出安全校验、仅新建写入、批注/页面操作计划和表单导出 |
| `pdfOperationEngine` | 抽象 PDF 写入能力，第一版用 pdf-lib 起步复制 PDF、扁平化表单、写入水印/页码/Bates 并生成导出计划，预留更强引擎替换空间 |
| `formService` | AcroForm 字段读取、填写、签名图片写入、表单扁平化和批量表单操作 |
| `pageOrganizerService` | 页面整理状态、旋转、删除、重排、恢复、撤销和 plan-only 导出请求 |
| `scanPreprocessService` | 扫描件清洁、90 度方向检测、微倾斜校正、裁边和预处理输出 |
| `compressionService` | PDF 图像资源重编码、法院上传压缩档位、目标体积检查和压缩统计；由 `compress mode=apply` 在导出引擎内调用 |
| `ocrBridgeService` | 调用本地或云端 OCR 后端，管理任务状态 |
| `ocrPrivacyConsentGuard` | 校验联网 OCR 本次 consent，生成脱敏隐私审计记录 |
| `ocrQualityCheckService` | OCR 可检索页比例、关键词命中、体积比、耗时、CER、阈值结果和问题页报告 |
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

OCR 不直接内置到前端。前端 `src/modules/ocr/service/bridge.ts` 通过 `createTauriOcrBridgeBackend()` 调 `invoke("start_ocr_job", { request })`；后端 `src-tauri/src/ocr_dispatch.rs` 真实 spawn `ocrmypdf` 子进程（`OcrDispatchBackend::LocalOcrMyPdf`）并按 provider 分发到 PaddleOCR / MinerU HTTPS endpoint（DEC-095 / 修订自 DEC-050 之前的 bridge/stub 描述）。已落地边界：

- `src/shared/ocr/` 定义 `OcrRequest`、页码范围、`new-layered-pdf` 输出策略、任务进度和质量抽查入口；`text-sidecar`、`quality-check-only` 仅作为后续策略类型，第一版校验会拒绝执行。
- `src/shared/security/` 定义联网 OCR notice、consent decision、脱敏路径摘要和 `OcrPrivacyAuditRecord`；提示可展示 provider、页码范围、输出路径、是否联网、不会覆盖原 PDF 和 API key 引用，audit/consent 不保留完整本地 PDF 路径或真实密钥。notice 带一次性 nonce、签发时间和有效期，consent 绑定输入文件指纹、输出路径指纹、provider、页码范围、输出策略和 API key 引用。
- `src/modules/ocr/privacy/consentGuard.ts` 负责校验云端 OCR 的本次 notice/consent 是否与当前输入文件、provider、页码范围、输出路径、输出策略和有效期匹配；本地 provider 不要求联网 consent，旧布尔 consent 标记不能绕过 guard。
- `src/modules/ocr/service/bridge.ts` 负责准备请求、校验输入/输出 PDF、拒绝覆盖原始 PDF、查找 provider，并通过 adapter 边界区分本地命令和云端 API；`createTauriOcrBridgeBackend` 调 `invoke("start_ocr_job")`。
- `src/modules/ocr/quality/qualityCheckService.ts` 负责把 OCR 后页面文本和统计数据转换为质量报告，覆盖可检索页比例、关键词命中率、文件体积比、耗时和可选 CER；输入为空或页数无效时直接拒绝，避免把空结果误判为通过。
- Adapter 覆盖 `local-ocrmypdf`、`legal-skills`、`paddleocr`、`mineru`；云端 provider 必须有用户本次明确 consent、安全 apiKeyRef 和 HTTPS endpoint，本机调试仅允许 `localhost`、真实 127.0.0.0/8 IPv4 和 `::1` loopback HTTP；真实密钥串、远端明文 HTTP、伪装成 `127.*` 的域名和非法 endpoint 不会调用 Tauri command。bridge 请求会携带脱敏 `privacyAuditRecord`。
- 端到端覆盖：`tests/e2e/ocr-e2e.test.ts`（前端 fixture + 真实 ocrmypdf + 真实 pdftotext + 真实质量报告）+ `src-tauri/src/lib.rs` `mod ocr_bridge_tests`（Rust 集成测试 + 真实 OCR + 任务队列持久化）。缺工具时静默跳过。
- 历史（不再适用）：`docs/ARCHITECTURE.md` 之前表述 "当前第一版只建立 bridge/stub，不执行真实 OCR"，与代码实情不符（ISS-007 E2E 联调 worker 已在 0.1.0-alpha.10 落实真实接入，DEC-050 / PR #27）。DEC-095 修订此处。
- `src-tauri/src/lib.rs` 提供 `start_ocr_job` command stub，Rust 侧重复校验 provider、页码范围、输出策略、默认 `*-ocr.pdf` 新输出路径和云端 OCR 的 `privacyAuditRecord.consentStatus=granted`，返回 queued job。
- 错误信息不包含完整敏感 PDF 路径，带逗号或中文标点的 PDF 路径也会在展示前脱敏；API Key 只使用引用或脱敏占位，不写入日志或错误报告。

外部 OCR provider 的 endpoint、模型参数和密钥引用由设置页管理。API Key 不写入公开仓库，不在 UI 中完整展示，不在日志或错误报告中输出。

任务输出必须记录：

- 使用的后端。
- 输入文件摘要和页码范围。
- 输出文件路径；审计记录只保留脱敏路径摘要和指纹。
- 错误原因或回退路径。
- OCR 后搜索质量检查结果，包括阈值结果和问题页原因。

后续真实执行阶段再接入本地 `ocrmypdf` / Legal Skills、PaddleOCR/MinerU 请求、双层 PDF 写入，并把真实 PDF 文本提取、文件体积和耗时统计接入 ISS-017 质量检查报告。

## PDF 算法来源

FaroPDF 可复用本机 `legal-skills` 中成熟 PDF 脚本的算法，但不直接把 Agent skill 工作流当作产品实现。具体算法素材、候选议题和任务归属以 `docs/TASKS.md` 为唯一来源。

当前吸收范围：

- `pdf-processor`：扫描预处理、纠偏、压缩、OCR provider、OCR 质量检查。
- `pdf-organizer`：文字层检测、页级检查、文书边界 manifest、A4 标准化。
- `img2pdf`：证据图片和 PDF 页面 A4 多图编排。

### 复用脚本与归属

下表列出每个来源提供的关键脚本、可复用能力和当前归属的 ISS。脚本不直接进产品，只作为 Tauri 后台 bridge、sidecar 或未来算法移植来源；UI 只调用统一 job model。

| 来源 | 重点脚本 | 可复用能力 | 当前归属 |
| --- | --- | --- | --- |
| `pdf-processor` | `pdf-preprocess-core.py`、`pdf_preprocess_skew.py`、`pdf-preprocess-ocr.py` | 扫描清洁、90 度方向检测、微倾斜校正、裁边、分块/并行预处理 | ISS-016 |
| `pdf-processor` | `pdf-compress.py` | PyMuPDF 图像资源重编码、降采样、保留文字层/批注/书签的压缩统计 | ISS-013 |
| `pdf-processor` | `pdf-ocr.py`、`pdf_ocr_paddle_api.py`、`pdf_ocr_mineru.py`、`pdf_ocr_layered.py` | PaddleOCR / MinerU / ocrmypdf provider、双层 PDF 叠层、API fallback | ISS-007、ISS-014 |
| `pdf-processor` | `pdf-ocr-quality-check.py` | 可检索页比例、关键词命中率、体积比、耗时、可选 CER | ISS-017 |
| `pdf-organizer` | `pdf_organizer.py` | 文字层检测、页级检查、文书边界信号、manifest、A4 标准化、拆分/合并/命名 | ISS-006、ISS-019 |
| `img2pdf` | `img_to_pdf.py` | 图片或 PDF 页面按 A4 1/2/3/4 张每页编排 | ISS-018 |

产品化原则：

- 纯算法能力优先拆入 FaroPDF 模块，例如压缩、A4 编排、页码/Bates、水印、文字层检测、页级 manifest。
- 重依赖能力走后台 bridge，例如 OpenCV 预处理、`ocrmypdf`、PaddleOCR API、MinerU API。
- UI 层只调用统一 job model，不直接解析脚本 stdout。
- 外部 API 和密钥由设置页管理；联网 OCR 必须主动确认。
- 所有处理默认输出新 PDF，不覆盖原始材料。

## PDF Expert 视觉与架构对照（v0.2 起点）

参考 `research/pdf-expert/FEATURE_CATALOG.md` 与 `docs/DESIGN.md §18` 的素材池，逐模块总结 PDF Expert 与 FaroPDF 之间的功能差异与可借鉴的工程做法，驱动 ISS-059..065 的任务卡。

### A. Window / Shell

| 维度 | PDF Expert | FaroPDF | 差距 |
| --- | --- | --- | --- |
| 窗口 chrome | macOS 标准 traffic lights + 自绘 toolbar，Big Sur+ 圆角 | 自绘 48px toolbar，无 traffic lights | 保持现状（自绘更稳） |
| Tab 行为 | 顶栏多文件 tab 含 inline rename / 拖排序 / 拖出窗口 | 单 PDF / 窗口 | **ISS-059**（P0） |

### B. 模式驱动侧栏

PDF Expert 在工具 / 批注 / 编辑 / OCR 切换时浮出**右栏**展示对应内容（签章缩略图、图章模板、OCR 状态），避免顶栏堆 8 类工具。FaroPDF 现行 v0.1 仅有左 4-tab Sidebar 与 2 级工具条。**ISS-060**（P1）：引入右栏 + 模式驱动切换。

### C. 浮动工具条

PDF Expert 选中即弹出 6-7 按钮（高亮/下划线/删除线/便签/复制/翻译/朗读）。FaroPDF `TextSelectionOverlay` 仅 4 色调色板。**ISS-061**（P1）：补齐 Ul/St/Note/Copy + 翻译/朗读占位。

### D. 图章与签名

- 图章：标准 4 个 + 自定义 N 个 tab + 缩略图渲染。FaroPDF 标准 5 个、无自定义。**ISS-062**（P1）。
- 签名：手写签名缩略图列表 + 单击激活。FaroPDF 仅 PNG/JPG 静态导入，无手写板。**v0.3 候选**。

### E. 对话框

| 模态 | 关键交互 | FaroPDF 现状 | 差距 |
| --- | --- | --- | --- |
| 合并文件 | 拖放 + 蓝主按钮 + 缩略图横排 | ✅ PDFOperationEngine | 已对齐 |
| 设置密码 | 密码 + 确认输入 | ❌ | **ISS-064** |
| 拆分页面 | 缩略图横排 + 中央拆分线 | ❌ | v0.3 候选 |
| 文档属性 | 设置页右栏 | ❌ | **ISS-063** |

### F. 视觉与交互对比小结

- 工具栏：双行 48px PDF Expert vs 单层 48px FaroPDF；FaroPDF 已收口任务模式入口。
- 视图模式：FaroPDF 已实现 4 种 + `getModeTools()`（DEC-032）。
- 状态栏：FaroPDF 已有 `ReaderStatusBar` 指示页码 / 缩放 / 文字层 / 脏。
- 左 utility pane：FaroPDF 已 4-tab（书签/大纲/批注/缩略图）。
- 右 utility pane：FaroPDF v0.1 不存在，**ISS-060** 候选。
- 浮动文本工具条：FaroPDF v0.1 简化，**ISS-061** 候选。
- 图章：5 内置 + 无自定义，**ISS-062** 候选。
- 签名：PNG/JPG 静态，无手写板，**v0.3 候选**。
- 密码保护：未实现，**ISS-064** 候选。
- 文档属性：未实现，**ISS-063** 候选。

## 文档健康监控（doc-curator）

FaroPDF 的项目级文档（`docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `CHANGELOG.md` / `README.md` / `AGENTS.md`）在多 ISS 并行推进时容易膨胀：进度日志堆叠、归档条目散落、ISS 与 DEC 编号跳号、活跃任务与已完成任务边界模糊。`doc-curator` 是部署在 `.claude/skills/doc-curator/` 的项目级文档瘦身 subagent。

### 角色

- **体检**：定期扫描上述文件，输出 JSON 行 + markdown 报告；覆盖硬性（hard）、自适应（adaptive）、软提示（soft）三档。
- **维护**：发现 `docs/TASKS.md` 进度日志 > 5 条、ISS 归档条目未升序、DEC 编号跳号、各文件行数超过基线 × 1.5 等情况，自动 trim / 补指针 / 提 maintenance PR。
- **隔离**：不修改 `src/` / `src-tauri/` / `tests/`；不写 `CHANGELOG.md`（由 `release-workflow` 维护）；不直接 push 到 main。

### 触发流程

```text
Agent 流程（git-workflow）
  ↓
gh pr create / gh pr merge 成功
  ↓
Agent 主动调起 doc-curator subagent
  ↓
scan.sh → JSON 行 + markdown 报告
  ↓
解析报告：
  ├─ 全部 ok → 结束
  ├─ soft 提示 → 写入 PR 描述跟进项，不动作
  └─ hard / adaptive 告警 →
       ├─ 工作区干净 → maintenance-pr.sh
       │     ├─ 创建 chore/doc-curator-<date> 分支
       │     ├─ 机械 trim / 补指针
       │     ├─ 推 + gh pr create（标签 automated,docs,maintenance）
       │     └─ 结束
       └─ 工作区不干净 → 仅报告，让用户处理
```

触发时机（详见 `.claude/skills/git-workflow/SKILL.md` v1.3.0「## 4. PR 工作流」末尾两个小节）：

- `gh pr create` 成功后：调起 subagent 关注「本次变更带来的影响」。
- `gh pr merge` 成功后：调起 subagent 关注「main 整体健康度」。

### 阈值与基线

- **硬性规则**（不缩）：进度日志 ≤ 5、ISS 归档条目升序、DEC 编号连续、归档指针必须指向 `DECISIONS.md`。
- **自适应规则**：`docs/TASKS.md` 活跃任务数、`docs/TASKS.md` / `docs/DECISIONS.md` / `docs/ROADMAP.md` / `docs/DESIGN.md` / `docs/ARCHITECTURE.md` / `AGENTS.md` 的总行数；阈值 = 首跑基线 × 1.5。
- **软提示**：`CHANGELOG.md` 最近 release entry 是否存在、`README.md`「当前状态」段是否同步。
- 首跑由 `first-baseline.sh` 测量各文件大小并写入 `state.json`；后续 scan 自动按新基线判定。

### 与其他 Skill 的关系

| Skill | 关系 |
| --- | --- |
| `git-workflow` v1.3.0 | 在 `gh pr create` / `gh pr merge` 成功后由 Agent 主动调起 doc-curator；不依赖 hooks。 |
| `release-workflow` | `CHANGELOG.md` 由该 Skill 维护；doc-curator 对 CHANGELOG 只做软提示。 |
| `cross-agent-coordination` / `multi-agent-orchestration` | maintenance PR 的归属和状态由这些 Skill 协调。 |
| `git-batch-commit` | maintenance PR 的 commit 标题和拆分粒度遵循该 Skill 的 `chore` 规则。 |

### 退出码

| 退出码 | 含义 | 调用方处理 |
| --- | --- | --- |
| 0 | 全部 ok | 不动作 |
| 1 | hard 失败 | 必须提 maintenance PR |
| 2 | adaptive 警告 | 建议提 maintenance PR |
| 3 | soft 提示 | 可忽略 |

### 配置文件

- 监控文件清单与阈值：`.claude/skills/doc-curator/config/faropdf.yaml`。
- 基线与历史：`.claude/skills/doc-curator/state.json`。
- 修改阈值：编辑 `config/faropdf.yaml`，下次 scan 自动生效。
- 重置基线：删除 `state.json` 的 `baselines` 字段后跑 `first-baseline.sh`。
