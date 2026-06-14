import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { ReaderController } from "../../reader";
import type {
  PdfBatesNumberOperation,
  PdfCompressionOperation,
  PdfCompressionPreset,
  PdfExportOperation,
  PdfOutputPlacement,
  PdfPageNumberOperation,
  PdfWatermarkOperation,
} from "../../../shared";
import { createPdfOperationEngine, type PdfOperationEngine } from "../pdfOperationEngine";
import "./ExportDeliveryPanel.css";

export type ExportDeliveryTool =
  | "text-watermark"
  | "image-watermark"
  | "header-footer"
  | "page-number"
  | "bates"
  | "compress";

interface ExportDeliveryPanelProps {
  reader: ReaderController;
  selectedTool: ExportDeliveryTool;
  onSelectedToolChange: (tool: ExportDeliveryTool) => void;
  operationEngine?: PdfOperationEngine;
}

type HeaderFooterPageScope = "all" | "odd" | "even";
type HeaderFooterHorizontalPosition = "left" | "center" | "right";

type ExportStatus =
  | { kind: "idle"; message: null }
  | { kind: "running"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const PLACEMENT_OPTIONS: Array<{ value: PdfOutputPlacement; label: string }> = [
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "居中" },
  { value: "bottom-right", label: "右下" },
  { value: "center", label: "页面中央" },
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中" },
  { value: "top-right", label: "右上" },
];

const FORMAT_OPTIONS = [
  { value: "{page}", label: "1" },
  { value: "第 {page} 页", label: "第 1 页" },
  { value: "{page} / {total}", label: "1 / 总页数" },
];

const COMPRESSION_PRESET_OPTIONS: Array<{
  value: PdfCompressionPreset;
  label: string;
  preview: string;
}> = [
  { value: "court-5mb", label: "法院 5MB", preview: "目标 5MB · 高压缩" },
  { value: "court-10mb", label: "法院 10MB", preview: "目标 10MB · 均衡压缩" },
  { value: "court-20mb", label: "法院 20MB", preview: "目标 20MB · 清晰优先" },
  { value: "court-50mb", label: "法院 50MB", preview: "目标 50MB · 低压缩" },
  { value: "screen", label: "屏幕阅读", preview: "轻量预览 · 高压缩" },
  { value: "ebook", label: "电子归档", preview: "归档副本 · 均衡压缩" },
  { value: "print", label: "打印优先", preview: "保留清晰度 · 低压缩" },
];

const HEADER_FOOTER_SCOPE_OPTIONS: Array<{ value: HeaderFooterPageScope; label: string }> = [
  { value: "all", label: "全部页面" },
  { value: "odd", label: "奇数页" },
  { value: "even", label: "偶数页" },
];

const HEADER_FOOTER_POSITION_OPTIONS: Array<{ value: HeaderFooterHorizontalPosition; label: string }> = [
  { value: "left", label: "左" },
  { value: "center", label: "中" },
  { value: "right", label: "右" },
];

const HEADER_PLACEMENTS: Record<HeaderFooterHorizontalPosition, PdfOutputPlacement> = {
  left: "top-left",
  center: "top-center",
  right: "top-right",
};

const FOOTER_PLACEMENTS: Record<HeaderFooterHorizontalPosition, PdfOutputPlacement> = {
  left: "bottom-left",
  center: "bottom-center",
  right: "bottom-right",
};

export function ExportDeliveryPanel({ reader, selectedTool, onSelectedToolChange, operationEngine }: ExportDeliveryPanelProps) {
  const document = reader.state.document;
  const engine = useMemo(() => createPdfOperationEngine(), []);
  const activeEngine = operationEngine ?? engine;
  const [textWatermark, setTextWatermark] = useState("仅供核对");
  const [textWatermarkPlacement, setTextWatermarkPlacement] = useState<PdfOutputPlacement>("center");
  const [textWatermarkFontSize, setTextWatermarkFontSize] = useState("32");
  const [textWatermarkOpacity, setTextWatermarkOpacity] = useState("18");
  const [textWatermarkRotation, setTextWatermarkRotation] = useState("-35");
  const [imageWatermark, setImageWatermark] = useState<{
    bytes: Uint8Array;
    fileName: string;
    type: "png" | "jpg";
  } | null>(null);
  const [imageWatermarkPlacement, setImageWatermarkPlacement] = useState<PdfOutputPlacement>("center");
  const [imageWatermarkWidth, setImageWatermarkWidth] = useState("120");
  const [imageWatermarkOpacity, setImageWatermarkOpacity] = useState("25");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("仅供内部核对");
  const [headerPosition, setHeaderPosition] = useState<HeaderFooterHorizontalPosition>("center");
  const [footerPosition, setFooterPosition] = useState<HeaderFooterHorizontalPosition>("center");
  const [headerFooterScope, setHeaderFooterScope] = useState<HeaderFooterPageScope>("all");
  const [headerFooterFontSize, setHeaderFooterFontSize] = useState("10");
  const [headerFooterOpacity, setHeaderFooterOpacity] = useState("80");
  const [pageFormat, setPageFormat] = useState("{page}");
  const [pageStartNumber, setPageStartNumber] = useState("1");
  const [pagePlacement, setPagePlacement] = useState<PdfOutputPlacement>("bottom-center");
  const [batesPrefix, setBatesPrefix] = useState("CASE-");
  const [batesSuffix, setBatesSuffix] = useState("");
  const [batesStartNumber, setBatesStartNumber] = useState("1");
  const [batesDigits, setBatesDigits] = useState("5");
  const [batesPlacement, setBatesPlacement] = useState<PdfOutputPlacement>("bottom-right");
  const [compressionPreset, setCompressionPreset] = useState<PdfCompressionPreset>("court-10mb");
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle", message: null });

  useEffect(() => {
    setStatus({ kind: "idle", message: null });
  }, [document?.documentId, selectedTool]);

  const pagePreview = formatPageNumberPreview(pageFormat, parseIntegerDraft(pageStartNumber, 1), document?.pageCount ?? 1);
  const textWatermarkPreview = textWatermark.trim() || "文字水印";
  const imageWatermarkPreview = imageWatermark?.fileName ?? "选择 PNG / JPG";
  const headerFooterPreview = formatHeaderFooterPreview(headerText, footerText, headerFooterScope, headerPosition, footerPosition);
  const batesPreview = formatBatesPreview(
    batesPrefix,
    parseIntegerDraft(batesStartNumber, 1),
    parseIntegerDraft(batesDigits, 5),
    batesSuffix,
  );
  const compressionPreview = COMPRESSION_PRESET_OPTIONS.find((option) => option.value === compressionPreset)?.preview ?? "生成压缩副本";

  const handleExport = useCallback(async () => {
    if (!document) {
      setStatus({ kind: "error", message: "请先打开 PDF 文档。" });
      return;
    }

    try {
      const operations = createOperationsForTool(selectedTool, {
        batesDigits,
        batesPlacement,
        batesPrefix,
        batesStartNumber,
        batesSuffix,
        compressionPreset,
        footerText,
        footerPosition,
        headerFooterFontSize,
        headerFooterOpacity,
        headerFooterScope,
        headerPosition,
        headerText,
        imageWatermark,
        imageWatermarkOpacity,
        imageWatermarkPlacement,
        imageWatermarkWidth,
        pageCount: document.pageCount,
        pageFormat,
        pagePlacement,
        pageStartNumber,
        textWatermark,
        textWatermarkFontSize,
        textWatermarkOpacity,
        textWatermarkPlacement,
        textWatermarkRotation,
      });

      setStatus({
        kind: "running",
        message: runningMessageFor(selectedTool),
      });

      const sourceBytes = await reader.getFileBytes();
      if (!sourceBytes) {
        throw new Error("未找到当前 PDF 的源文件字节。");
      }

      const requestedAt = new Date().toISOString();
      const result = await activeEngine.exportPdf({
        id: `delivery-${selectedTool}-${document.documentId}-${Date.now()}`,
        source: {
          bytes: new Uint8Array(sourceBytes),
          ...(document.path ? { path: document.path } : {}),
          ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
        },
        destination: { type: "bytes" },
        operations,
        requestedAt,
      });

      await reader.saveUpdatedBytes(
        result.bytes,
        suggestOutputName(reader.getCurrentFileName() ?? document.name, suffixFor(selectedTool)),
      );
      const warning = result.summary.warnings?.[0];
      setStatus({
        kind: "success",
        message: successMessageFor(selectedTool, result.summary.outputPageCount, warning),
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "导出失败。",
      });
    }
  }, [
    batesDigits,
    batesPlacement,
    batesPrefix,
    batesStartNumber,
    batesSuffix,
    compressionPreset,
    document,
    activeEngine,
    footerText,
    footerPosition,
    headerFooterFontSize,
    headerFooterOpacity,
    headerFooterScope,
    headerPosition,
    headerText,
    imageWatermark,
    imageWatermarkOpacity,
    imageWatermarkPlacement,
    imageWatermarkWidth,
    pageFormat,
    pagePlacement,
    pageStartNumber,
    reader,
    selectedTool,
    textWatermark,
    textWatermarkFontSize,
    textWatermarkOpacity,
    textWatermarkPlacement,
    textWatermarkRotation,
  ]);

  const handleImageWatermarkChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setStatus({ kind: "idle", message: null });
    if (!file) {
      return;
    }
    const type = detectImageWatermarkType(file);
    if (!type) {
      setImageWatermark(null);
      setStatus({ kind: "error", message: "图片水印必须是 PNG 或 JPG。" });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setImageWatermark({ bytes, fileName: file.name, type });
  }, []);

  return (
    <aside className="export-delivery-panel" aria-label="交付设置面板">
      <header className="export-delivery-panel__header">
        <h2>交付设置</h2>
        <div className="export-delivery-panel__switch" role="group" aria-label="交付工具类型">
          <button
            aria-pressed={selectedTool === "text-watermark"}
            onClick={() => onSelectedToolChange("text-watermark")}
            type="button"
          >
            文字水印
          </button>
          <button
            aria-pressed={selectedTool === "image-watermark"}
            onClick={() => onSelectedToolChange("image-watermark")}
            type="button"
          >
            图片水印
          </button>
          <button
            aria-pressed={selectedTool === "page-number"}
            onClick={() => onSelectedToolChange("page-number")}
            type="button"
          >
            普通编号
          </button>
          <button
            aria-pressed={selectedTool === "header-footer"}
            onClick={() => onSelectedToolChange("header-footer")}
            type="button"
          >
            页眉页脚
          </button>
          <button
            aria-pressed={selectedTool === "bates"}
            onClick={() => onSelectedToolChange("bates")}
            type="button"
          >
            证据编号
          </button>
          <button
            aria-pressed={selectedTool === "compress"}
            onClick={() => onSelectedToolChange("compress")}
            type="button"
          >
            压缩
          </button>
        </div>
      </header>

      {selectedTool === "text-watermark" ? (
        <section className="export-delivery-panel__section" aria-label="文字水印设置">
          <label>
            <span>内容</span>
            <input
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTextWatermark(event.target.value)}
              type="text"
              value={textWatermark}
            />
          </label>
          <label>
            <span>位置</span>
            <PlacementSelect value={textWatermarkPlacement} onChange={setTextWatermarkPlacement} />
          </label>
          <label>
            <span>字号</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTextWatermarkFontSize(event.target.value)}
              type="number"
              value={textWatermarkFontSize}
            />
          </label>
          <label>
            <span>透明度</span>
            <input
              inputMode="numeric"
              max={100}
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTextWatermarkOpacity(event.target.value)}
              type="number"
              value={textWatermarkOpacity}
            />
          </label>
          <label>
            <span>旋转</span>
            <input
              inputMode="numeric"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTextWatermarkRotation(event.target.value)}
              type="number"
              value={textWatermarkRotation}
            />
          </label>
          <PreviewStrip label="预览" value={textWatermarkPreview} />
        </section>
      ) : null}

      {selectedTool === "image-watermark" ? (
        <section className="export-delivery-panel__section" aria-label="图片水印设置">
          <label>
            <span>图片文件</span>
            <input
              accept="image/png,image/jpeg"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void handleImageWatermarkChange(event);
              }}
              type="file"
            />
          </label>
          <label>
            <span>位置</span>
            <PlacementSelect value={imageWatermarkPlacement} onChange={setImageWatermarkPlacement} />
          </label>
          <label>
            <span>宽度</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setImageWatermarkWidth(event.target.value)}
              type="number"
              value={imageWatermarkWidth}
            />
          </label>
          <label>
            <span>透明度</span>
            <input
              inputMode="numeric"
              max={100}
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setImageWatermarkOpacity(event.target.value)}
              type="number"
              value={imageWatermarkOpacity}
            />
          </label>
          <PreviewStrip label="预览" value={imageWatermarkPreview} />
        </section>
      ) : null}

      {selectedTool === "page-number" ? (
        <section className="export-delivery-panel__section" aria-label="普通页码设置">
          <label>
            <span>样式</span>
            <select value={pageFormat} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPageFormat(event.target.value)}>
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>起始号</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPageStartNumber(event.target.value)}
              type="number"
              value={pageStartNumber}
            />
          </label>
          <label>
            <span>位置</span>
            <PlacementSelect value={pagePlacement} onChange={setPagePlacement} />
          </label>
          <PreviewStrip label="预览" value={pagePreview} />
        </section>
      ) : null}

      {selectedTool === "header-footer" ? (
        <section className="export-delivery-panel__section" aria-label="页眉页脚设置">
          <label>
            <span>页眉</span>
            <input onChange={(event: ChangeEvent<HTMLInputElement>) => setHeaderText(event.target.value)} type="text" value={headerText} />
          </label>
          <label>
            <span>页脚</span>
            <input onChange={(event: ChangeEvent<HTMLInputElement>) => setFooterText(event.target.value)} type="text" value={footerText} />
          </label>
          <HeaderFooterPositionPicker label="页眉位置" value={headerPosition} onChange={setHeaderPosition} />
          <HeaderFooterPositionPicker label="页脚位置" value={footerPosition} onChange={setFooterPosition} />
          <label>
            <span>应用范围</span>
            <select
              value={headerFooterScope}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setHeaderFooterScope(event.target.value as HeaderFooterPageScope)}
            >
              {HEADER_FOOTER_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>字号</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setHeaderFooterFontSize(event.target.value)}
              type="number"
              value={headerFooterFontSize}
            />
          </label>
          <label>
            <span>透明度</span>
            <input
              inputMode="numeric"
              max={100}
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setHeaderFooterOpacity(event.target.value)}
              type="number"
              value={headerFooterOpacity}
            />
          </label>
          <PreviewStrip label="预览" value={headerFooterPreview} />
        </section>
      ) : null}

      {selectedTool === "bates" ? (
        <section className="export-delivery-panel__section" aria-label="Bates 编号设置">
          <label>
            <span>前缀</span>
            <input onChange={(event: ChangeEvent<HTMLInputElement>) => setBatesPrefix(event.target.value)} type="text" value={batesPrefix} />
          </label>
          <label>
            <span>起始号</span>
            <input
              inputMode="numeric"
              min={0}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBatesStartNumber(event.target.value)}
              type="number"
              value={batesStartNumber}
            />
          </label>
          <label>
            <span>位数</span>
            <input
              inputMode="numeric"
              max={12}
              min={0}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBatesDigits(event.target.value)}
              type="number"
              value={batesDigits}
            />
          </label>
          <label>
            <span>后缀</span>
            <input onChange={(event: ChangeEvent<HTMLInputElement>) => setBatesSuffix(event.target.value)} type="text" value={batesSuffix} />
          </label>
          <label>
            <span>位置</span>
            <PlacementSelect value={batesPlacement} onChange={setBatesPlacement} />
          </label>
          <PreviewStrip label="预览" value={batesPreview} />
        </section>
      ) : null}

      {selectedTool === "compress" ? (
        <section className="export-delivery-panel__section" aria-label="压缩设置">
          <label>
            <span>预设</span>
            <select
              value={compressionPreset}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setCompressionPreset(event.target.value as PdfCompressionPreset)}
            >
              {COMPRESSION_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <PreviewStrip label="影响" value={compressionPreview} />
        </section>
      ) : null}

      <button
        className="context-tool context-tool--primary export-delivery-panel__submit"
        disabled={!document || status.kind === "running"}
        onClick={handleExport}
        type="button"
      >
        导出副本
      </button>
      {status.message ? (
        <div className={`export-delivery-panel__status export-delivery-panel__status--${status.kind}`} role={status.kind === "error" ? "alert" : "status"} aria-live="polite">
          {status.message}
        </div>
      ) : null}
    </aside>
  );
}

function PlacementSelect({ value, onChange }: { value: PdfOutputPlacement; onChange: (value: PdfOutputPlacement) => void }) {
  return (
    <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as PdfOutputPlacement)}>
      {PLACEMENT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function HeaderFooterPositionPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HeaderFooterHorizontalPosition;
  onChange: (value: HeaderFooterHorizontalPosition) => void;
}) {
  return (
    <div className="export-delivery-panel__choice-row" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="export-delivery-panel__position-picker">
        {HEADER_FOOTER_POSITION_OPTIONS.map((option) => (
          <button
            aria-pressed={value === option.value}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="export-delivery-panel__preview" aria-label={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function createPageNumberOperation(input: {
  format: string;
  placement: PdfOutputPlacement;
  startNumber: number;
}): PdfPageNumberOperation {
  return {
    id: "delivery-page-number",
    type: "page-number",
    format: input.format,
    placement: input.placement,
    startNumber: input.startNumber,
  };
}

interface ToolOperationInput {
  batesDigits: string;
  batesPlacement: PdfOutputPlacement;
  batesPrefix: string;
  batesStartNumber: string;
  batesSuffix: string;
  compressionPreset: PdfCompressionPreset;
  footerText: string;
  footerPosition: HeaderFooterHorizontalPosition;
  headerFooterFontSize: string;
  headerFooterOpacity: string;
  headerFooterScope: HeaderFooterPageScope;
  headerPosition: HeaderFooterHorizontalPosition;
  headerText: string;
  imageWatermark: { bytes: Uint8Array; fileName: string; type: "png" | "jpg" } | null;
  imageWatermarkOpacity: string;
  imageWatermarkPlacement: PdfOutputPlacement;
  imageWatermarkWidth: string;
  pageCount: number;
  pageFormat: string;
  pagePlacement: PdfOutputPlacement;
  pageStartNumber: string;
  textWatermark: string;
  textWatermarkFontSize: string;
  textWatermarkOpacity: string;
  textWatermarkPlacement: PdfOutputPlacement;
  textWatermarkRotation: string;
}

function createOperationsForTool(
  selectedTool: ExportDeliveryTool,
  input: ToolOperationInput,
): PdfExportOperation[] {
  if (selectedTool === "text-watermark") {
    return [createTextWatermarkOperation({
      color: "#404040",
      fontSize: parsePositiveNumber(input.textWatermarkFontSize, "文字水印字号必须是正数。"),
      opacity: parsePercent(input.textWatermarkOpacity, "文字水印透明度必须是 1 到 100。"),
      placement: input.textWatermarkPlacement,
      rotationDegrees: parseFiniteNumber(input.textWatermarkRotation, "文字水印旋转角度必须是数字。"),
      text: input.textWatermark,
    })];
  }

  if (selectedTool === "image-watermark") {
    if (!input.imageWatermark) {
      throw new Error("请先选择 PNG 或 JPG 图片。");
    }
    return [createImageWatermarkOperation({
      imageBytes: input.imageWatermark.bytes,
      imageType: input.imageWatermark.type,
      opacity: parsePercent(input.imageWatermarkOpacity, "图片水印透明度必须是 1 到 100。"),
      placement: input.imageWatermarkPlacement,
      width: parsePositiveNumber(input.imageWatermarkWidth, "图片水印宽度必须是正数。"),
    })];
  }

  if (selectedTool === "page-number") {
    return [createPageNumberOperation({
      format: input.pageFormat,
      placement: input.pagePlacement,
      startNumber: parsePositiveInteger(input.pageStartNumber, "页码起始号必须是正整数。"),
    })];
  }

  if (selectedTool === "header-footer") {
    return createHeaderFooterOperations({
      fontSize: parsePositiveNumber(input.headerFooterFontSize, "页眉页脚字号必须是正数。"),
      footerText: input.footerText,
      footerPosition: input.footerPosition,
      headerText: input.headerText,
      headerPosition: input.headerPosition,
      opacity: parsePercent(input.headerFooterOpacity, "页眉页脚透明度必须是 1 到 100。"),
      pageCount: input.pageCount,
      scope: input.headerFooterScope,
    });
  }

  if (selectedTool === "compress") {
    return [createCompressionOperation(input.compressionPreset)];
  }

  return [createBatesOperation({
    digits: parseBatesDigits(input.batesDigits),
    placement: input.batesPlacement,
    prefix: input.batesPrefix,
    startNumber: parseNonNegativeInteger(input.batesStartNumber, "Bates 起始号必须是非负整数。"),
    suffix: input.batesSuffix,
  })];
}

function createCompressionOperation(preset: PdfCompressionPreset): PdfCompressionOperation {
  return {
    id: "delivery-compress",
    type: "compress",
    preset,
    mode: "apply",
  };
}

function createHeaderFooterOperations(input: {
  fontSize: number;
  footerText: string;
  footerPosition: HeaderFooterHorizontalPosition;
  headerText: string;
  headerPosition: HeaderFooterHorizontalPosition;
  opacity: number;
  pageCount: number;
  scope: HeaderFooterPageScope;
}): PdfWatermarkOperation[] {
  const header = input.headerText.trim();
  const footer = input.footerText.trim();
  if (!header && !footer) {
    throw new Error("页眉和页脚至少填写一项。");
  }
  const pageIndexes = resolveHeaderFooterPageIndexes(input.scope, input.pageCount);

  const operations: PdfWatermarkOperation[] = [];
  if (header) {
    operations.push(createTextWatermarkOperation({
      color: "#404040",
      fontSize: input.fontSize,
      opacity: input.opacity,
      placement: HEADER_PLACEMENTS[input.headerPosition],
      rotationDegrees: 0,
      text: header,
      pageIndexes,
    }));
  }
  if (footer) {
    operations.push(createTextWatermarkOperation({
      color: "#404040",
      fontSize: input.fontSize,
      opacity: input.opacity,
      placement: FOOTER_PLACEMENTS[input.footerPosition],
      rotationDegrees: 0,
      text: footer,
      pageIndexes,
    }));
  }
  return operations;
}

function createTextWatermarkOperation(input: {
  color: string;
  fontSize: number;
  opacity: number;
  placement: PdfOutputPlacement;
  rotationDegrees: number;
  text: string;
  pageIndexes?: number[];
}): PdfWatermarkOperation {
  return {
    id: "delivery-text-watermark",
    type: "watermark",
    ...(input.pageIndexes ? { pageIndexes: input.pageIndexes } : {}),
    watermark: {
      kind: "text",
      color: input.color,
      fontSize: input.fontSize,
      opacity: input.opacity,
      placement: input.placement,
      rotationDegrees: input.rotationDegrees,
      text: input.text,
    },
  };
}

function resolveHeaderFooterPageIndexes(scope: HeaderFooterPageScope, pageCount: number): number[] | undefined {
  if (scope === "all") {
    return undefined;
  }

  const pageIndexes = Array.from({ length: pageCount }, (_, pageIndex) => pageIndex).filter((pageIndex) => {
    const displayPageNumber = pageIndex + 1;
    return scope === "odd" ? displayPageNumber % 2 === 1 : displayPageNumber % 2 === 0;
  });

  if (pageIndexes.length === 0) {
    throw new Error(scope === "odd" ? "当前文档没有奇数页。" : "当前文档没有偶数页。");
  }

  return pageIndexes;
}

function createImageWatermarkOperation(input: {
  imageBytes: Uint8Array;
  imageType: "png" | "jpg";
  opacity: number;
  placement: PdfOutputPlacement;
  width: number;
}): PdfWatermarkOperation {
  return {
    id: "delivery-image-watermark",
    type: "watermark",
    watermark: {
      kind: "image",
      imageBytes: input.imageBytes,
      imageType: input.imageType,
      opacity: input.opacity,
      placement: input.placement,
      width: input.width,
    },
  };
}

function createBatesOperation(input: {
  digits: number;
  placement: PdfOutputPlacement;
  prefix: string;
  startNumber: number;
  suffix: string;
}): PdfBatesNumberOperation {
  return {
    id: "delivery-bates-number",
    type: "bates-number",
    digits: input.digits,
    placement: input.placement,
    prefix: input.prefix,
    startNumber: input.startNumber,
    suffix: input.suffix,
  };
}

function parsePositiveInteger(value: string, message: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(message);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, message: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(message);
  }
  return parsed;
}

function parseBatesDigits(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 12) {
    throw new Error("Bates 编号位数必须是 0 到 12 的整数。");
  }
  return parsed;
}

function parsePositiveNumber(value: string, message: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(message);
  }
  return parsed;
}

function parseFiniteNumber(value: string, message: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(message);
  }
  return parsed;
}

function parsePercent(value: string, message: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(message);
  }
  return parsed / 100;
}

function parseIntegerDraft(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function formatPageNumberPreview(format: string, startNumber: number, pageCount: number): string {
  return format.replace(/\{page\}/g, String(startNumber)).replace(/\{total\}/g, String(pageCount));
}

function formatBatesPreview(prefix: string, startNumber: number, digits: number, suffix: string): string {
  const normalizedDigits = Number.isInteger(digits) && digits >= 0 ? digits : 0;
  const normalizedStart = Number.isInteger(startNumber) && startNumber >= 0 ? startNumber : 0;
  return `${prefix}${String(normalizedStart).padStart(normalizedDigits, "0")}${suffix}`;
}

function formatHeaderFooterPreview(
  header: string,
  footer: string,
  scope: HeaderFooterPageScope,
  headerPosition: HeaderFooterHorizontalPosition,
  footerPosition: HeaderFooterHorizontalPosition,
): string {
  const parts = [header.trim(), footer.trim()].filter(Boolean);
  const text = parts.length > 0 ? parts.join(" / ") : "填写页眉或页脚";
  const placementParts = [
    header.trim() ? `页眉${formatHorizontalPositionLabel(headerPosition)}` : null,
    footer.trim() ? `页脚${formatHorizontalPositionLabel(footerPosition)}` : null,
  ].filter(Boolean);
  const placement = placementParts.length > 0 ? `${placementParts.join(" / ")} · ` : "";
  if (scope === "all") {
    return `${placement}${text}`;
  }
  const scopeLabel = HEADER_FOOTER_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? "";
  return `${scopeLabel} · ${placement}${text}`;
}

function formatHorizontalPositionLabel(position: HeaderFooterHorizontalPosition): string {
  switch (position) {
    case "left":
      return "左侧";
    case "center":
      return "居中";
    case "right":
      return "右侧";
  }
}

function suggestOutputName(fileName: string | null, suffix: string): string {
  const fallback = "document.pdf";
  const name = (fileName?.trim() || fallback).replace(/[\\/]/g, "-");
  if (name.toLowerCase().endsWith(".pdf")) {
    return `${name.slice(0, -4)}-${suffix}.pdf`;
  }
  return `${name}-${suffix}.pdf`;
}

function detectImageWatermarkType(file: File): "png" | "jpg" | null {
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    return "png";
  }
  if (
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg")
  ) {
    return "jpg";
  }
  return null;
}

function runningMessageFor(tool: ExportDeliveryTool): string {
  switch (tool) {
    case "text-watermark":
      return "正在添加文字水印...";
    case "image-watermark":
      return "正在添加图片水印...";
    case "header-footer":
      return "正在添加页眉页脚...";
    case "page-number":
      return "正在添加页码...";
    case "bates":
      return "正在添加 Bates 编号...";
    case "compress":
      return "正在压缩 PDF...";
  }
}

function successMessageFor(tool: ExportDeliveryTool, pageCount: number, warning?: string): string {
  const suffix = warning ? ` ${warning}` : "";
  switch (tool) {
    case "text-watermark":
      return `已添加文字水印，共 ${pageCount} 页。${suffix}`;
    case "image-watermark":
      return `已添加图片水印，共 ${pageCount} 页。${suffix}`;
    case "header-footer":
      return `已添加页眉页脚，共 ${pageCount} 页。${suffix}`;
    case "page-number":
      return `已添加页码，共 ${pageCount} 页。${suffix}`;
    case "bates":
      return `已添加 Bates 编号，共 ${pageCount} 页。${suffix}`;
    case "compress":
      return `已压缩 PDF，共 ${pageCount} 页。${suffix}`;
  }
}

function suffixFor(tool: ExportDeliveryTool): string {
  switch (tool) {
    case "text-watermark":
      return "text-watermarked";
    case "image-watermark":
      return "image-watermarked";
    case "header-footer":
      return "header-footer";
    case "page-number":
      return "page-numbered";
    case "bates":
      return "bates";
    case "compress":
      return "compressed";
  }
}
