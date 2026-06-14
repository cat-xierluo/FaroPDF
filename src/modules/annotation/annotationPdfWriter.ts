import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { AnnotationSidecar, PdfAnnotation, PdfRect } from "../../shared/pdf/annotation";
import { resolveStampFont } from "./annotationStampFont";
import { clampRectToBounds } from "./geometry";
import { sortAnnotations } from "./sidecar";

/**
 * 把批注 sidecar 真实绘制到 PDF 字节流上，输出 *新* PDF 字节。
 *
 * 设计目标：
 * - 不修改源 PDF bytes；输出是 in-memory 复制。
 * - 用 pdf-lib 提供的 drawRectangle / drawLine / drawText / drawSvgPath 绘制 9 种批注。
 * - 颜色接受 3/6 位 hex；非法颜色抛错并被记录为 skipped 警告，不影响其他批注。
 * - 越界 rect 自动 clamp 到页面 bounds（不抛错，遵守 DEC-031 几何裁剪语义）。
 * - 中文 / 非 Latin-1 文本按 WinAnsi 限制跳过该 textbox 批注，记录原因。
 * - 越界 pageIndex 抛错（在调用方层面尽早失败，不静默丢弃批注）。
 */

export interface WriteAnnotationPdfInput {
  sourceBytes: Uint8Array;
  sidecar: AnnotationSidecar;
  /** 可选 source PDF fingerprint；不提供则跳过指纹校验 */
  sourceFingerprint?: string;
}

export interface AnnotationPdfWriteSummary {
  inputPageCount: number;
  outputPageCount: number;
  annotationCount: number;
  drawnCount: number;
  skippedCount: number;
  skipped: Array<{ annotationId: string; type: string; reason: string }>;
  pageDrawCounts: Record<number, number>;
  fingerprintChecked: boolean;
}

export interface WriteAnnotationPdfResult {
  bytes: Uint8Array;
  summary: AnnotationPdfWriteSummary;
  /** 与 pdfOperationEngine 一致的安全输出路径建议：<name>-annotated.pdf */
  suggestedFileName: string;
}

const TEXTBOX_FONT_SIZE = 11;
const STAMP_FONT_SIZE = 22;
const ARROW_HEAD_SIZE = 8;
const STROKE_THICKNESS = 1.5;
const INK_THICKNESS = 2;
const DEFAULT_OPACITY = 0.35;
const STAMP_BORDER_OPACITY = 0.85;

export async function writeAnnotationPdf(input: WriteAnnotationPdfInput): Promise<WriteAnnotationPdfResult> {
  const { sidecar, sourceBytes, sourceFingerprint } = input;

  if (sourceBytes.length === 0) {
    throw new Error("PDF 源字节为空，无法绘制批注。");
  }

  if (sidecar.schemaVersion !== 1) {
    throw new Error(`批注 sidecar schema 版本不匹配：期望 1，实际 ${sidecar.schemaVersion}。`);
  }

  let workingPdf: PDFDocument;
  try {
    workingPdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  } catch (error) {
    throw sanitizePdfExportError(error, "无法解析源 PDF。");
  }

  const inputPageCount = workingPdf.getPageCount();

  if (sidecar.document.pageCount !== undefined && sidecar.document.pageCount !== inputPageCount) {
    throw new Error(
      `批注 sidecar 页数（${sidecar.document.pageCount}）与源 PDF 页数（${inputPageCount}）不一致。`,
    );
  }

  if (sourceFingerprint && sidecar.document.fingerprint && sidecar.document.fingerprint !== sourceFingerprint) {
    throw new Error("批注 sidecar 指纹与源 PDF 不一致。");
  }

  const sortedAnnotations = sortAnnotations(sidecar.annotations);
  for (const annotation of sortedAnnotations) {
    if (!Number.isInteger(annotation.pageIndex) || annotation.pageIndex < 0 || annotation.pageIndex >= inputPageCount) {
      throw new Error(
        `批注 ${annotation.id} 页码（${annotation.pageIndex}）超出源 PDF 范围（0-${inputPageCount - 1}）。`,
      );
    }
  }

  const font = await workingPdf.embedFont(StandardFonts.Helvetica);
  const skipped: AnnotationPdfWriteSummary["skipped"] = [];
  const pageDrawCounts: Record<number, number> = {};

  for (const annotation of sortedAnnotations) {
    const page = workingPdf.getPage(annotation.pageIndex);
    const pageSize = page.getSize();
    const bounds: PdfRect = { x: 0, y: 0, width: pageSize.width, height: pageSize.height };

    let result: { drawn: true } | { drawn: false; reason: string };
    try {
      result = await drawAnnotation(annotation, page, font, bounds, workingPdf);
    } catch (error) {
      result = { drawn: false, reason: getErrorMessage(error) };
    }

    if (result.drawn) {
      pageDrawCounts[annotation.pageIndex] = (pageDrawCounts[annotation.pageIndex] ?? 0) + 1;
    } else {
      skipped.push({ annotationId: annotation.id, type: annotation.type, reason: result.reason });
    }
  }

  const drawnCount = sortedAnnotations.length - skipped.length;
  const outputPdfBytes = await workingPdf.save({ useObjectStreams: false });
  workingPdf.setCreator("FaroPDF annotation writer");
  workingPdf.setProducer("FaroPDF pdf-lib annotation writer");
  workingPdf.setKeywords([
    "faropdf:annotation-flattened",
    `faropdf:annotation-count:${sortedAnnotations.length}`,
    `faropdf:annotation-drawn:${drawnCount}`,
  ]);

  const summary: AnnotationPdfWriteSummary = {
    inputPageCount,
    outputPageCount: workingPdf.getPageCount(),
    annotationCount: sortedAnnotations.length,
    drawnCount,
    skippedCount: skipped.length,
    skipped,
    pageDrawCounts,
    fingerprintChecked: Boolean(sourceFingerprint && sidecar.document.fingerprint),
  };

  return {
    bytes: outputPdfBytes,
    summary,
    suggestedFileName: "*-annotated.pdf",
  };
}

async function drawAnnotation(
  annotation: PdfAnnotation,
  page: PDFPage,
  font: PDFFont,
  bounds: PdfRect,
  workingPdf: PDFDocument,
): Promise<{ drawn: true } | { drawn: false; reason: string }> {
  const color = parseColorOrWarn(annotation.color);
  if (!color) {
    return { drawn: false, reason: `颜色无法解析：${annotation.color}` };
  }
  const opacity = normalizeOpacity(annotation.opacity, defaultOpacityFor(annotation.type));

  switch (annotation.type) {
    case "highlight":
      return drawFilledRects(page, annotation.rects, bounds, color, opacity, "highlight");
    case "underline":
      return drawUnderlineOrStrike(page, annotation.rects, bounds, color, opacity, "underline");
    case "strikeout":
      return drawUnderlineOrStrike(page, annotation.rects, bounds, color, opacity, "strikeout");
    case "note":
      return drawNoteRect(page, annotation.rects, bounds, color, opacity);
    case "textbox":
      return drawTextbox(page, annotation.rects, bounds, annotation.content, color, opacity, font);
    case "rectangle":
      return drawBorderRect(page, annotation.rects, bounds, color, opacity);
    case "arrow":
      return drawArrow(page, annotation, bounds, color, opacity);
    case "ink":
      return drawInk(page, annotation, bounds, color, opacity);
    case "stamp":
      return drawStamp(page, annotation, bounds, color, workingPdf);
    default:
      return { drawn: false, reason: `暂不支持的批注类型：${(annotation as { type: string }).type}` };
  }
}

function defaultOpacityFor(type: PdfAnnotation["type"]): number {
  if (type === "highlight" || type === "note" || type === "textbox") {
    return DEFAULT_OPACITY;
  }
  return 1;
}

/** 透明填充矩形（高亮、note 兜底） */
function drawFilledRects(
  page: PDFPage,
  rects: ReadonlyArray<PdfRect>,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
  _kind: "highlight",
): { drawn: true } | { drawn: false; reason: string } {
  const clamped = clampRects(rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  for (const rect of clamped) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color,
      opacity,
      borderWidth: 0,
    });
  }
  return { drawn: true };
}

/** 下划线 / 删除线：在每个 rect 底部或中部画一条线 */
function drawUnderlineOrStrike(
  page: PDFPage,
  rects: ReadonlyArray<PdfRect>,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
  kind: "underline" | "strikeout",
): { drawn: true } | { drawn: false; reason: string } {
  const clamped = clampRects(rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  for (const rect of clamped) {
    const y = kind === "underline" ? rect.y + 1 : rect.y + rect.height / 2;
    page.drawLine({
      start: { x: rect.x, y },
      end: { x: rect.x + rect.width, y },
      thickness: STROKE_THICKNESS,
      color,
      opacity,
    });
  }
  return { drawn: true };
}

/** 备注：画一个带边框的小方块（无填充） */
function drawNoteRect(
  page: PDFPage,
  rects: ReadonlyArray<PdfRect>,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
): { drawn: true } | { drawn: false; reason: string } {
  const clamped = clampRects(rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  for (const rect of clamped) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderColor: color,
      borderOpacity: opacity,
      borderWidth: STROKE_THICKNESS,
      color: rgb(1, 1, 1),
      opacity: 0,
    });
  }
  return { drawn: true };
}

/** 矩形（无填充、纯边框） */
function drawBorderRect(
  page: PDFPage,
  rects: ReadonlyArray<PdfRect>,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
): { drawn: true } | { drawn: false; reason: string } {
  const clamped = clampRects(rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  for (const rect of clamped) {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderColor: color,
      borderOpacity: opacity,
      borderWidth: STROKE_THICKNESS,
      color: rgb(1, 1, 1),
      opacity: 0,
    });
  }
  return { drawn: true };
}

/** 文本框：用 Helvetica 在 rect 范围内居中绘制；中文 / 非 Latin-1 抛错被捕获并跳过 */
function drawTextbox(
  page: PDFPage,
  rects: ReadonlyArray<PdfRect>,
  bounds: PdfRect,
  content: string | undefined,
  color: ReturnType<typeof rgb>,
  opacity: number,
  font: PDFFont,
): { drawn: true } | { drawn: false; reason: string } {
  const text = content?.trim();
  if (!text) {
    return { drawn: false, reason: "文本框内容为空" };
  }
  const clamped = clampRects(rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  try {
    for (const rect of clamped) {
      const textWidth = safeTextWidth(font, text, TEXTBOX_FONT_SIZE);
      const textHeight = font.heightAtSize(TEXTBOX_FONT_SIZE);
      const x = rect.x + Math.max(0, (rect.width - textWidth) / 2);
      const y = rect.y + Math.max(0, (rect.height - textHeight) / 2);
      page.drawText(text, {
        x,
        y,
        size: TEXTBOX_FONT_SIZE,
        font,
        color,
        opacity,
      });
    }
    return { drawn: true };
  } catch (error) {
    return { drawn: false, reason: sanitizeFontError(error) };
  }
}

/** 箭头：从 line.start → line.end 画主线 + 三角箭头 */
function drawArrow(
  page: PDFPage,
  annotation: PdfAnnotation,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
): { drawn: true } | { drawn: false; reason: string } {
  if (!annotation.line) {
    return { drawn: false, reason: "箭头批注缺少 line 字段" };
  }
  const start = clampPoint(annotation.line.start, bounds);
  const end = clampPoint(annotation.line.end, bounds);
  page.drawLine({
    start,
    end,
    thickness: STROKE_THICKNESS,
    color,
    opacity,
  });
  const head = computeArrowHead(start, end, ARROW_HEAD_SIZE);
  page.drawLine({ start: end, end: head.left, thickness: STROKE_THICKNESS, color, opacity });
  page.drawLine({ start: end, end: head.right, thickness: STROKE_THICKNESS, color, opacity });
  return { drawn: true };
}

/** 墨迹：把每个 stroke 串联为 svg path，drawSvgPath 一次绘出 */
function drawInk(
  page: PDFPage,
  annotation: PdfAnnotation,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  opacity: number,
): { drawn: true } | { drawn: false; reason: string } {
  if (!annotation.ink) {
    return { drawn: false, reason: "墨迹批注缺少 ink 字段" };
  }
  const filtered = annotation.ink.strokes.filter((stroke) => stroke.length > 0);
  if (filtered.length === 0) {
    return { drawn: false, reason: "墨迹无有效笔画" };
  }
  const d = filtered
    .map((stroke) =>
      stroke
        .map((point, index) => {
          const clamped = clampPoint(point, bounds);
          return `${index === 0 ? "M" : "L"}${clamped.x.toFixed(2)} ${clamped.y.toFixed(2)}`;
        })
        .join(" "),
    )
    .join(" ");
  page.drawSvgPath(d, {
    x: 0,
    y: 0,
    color,
    opacity,
    borderColor: color,
    borderOpacity: opacity,
    borderWidth: INK_THICKNESS,
  });
  return { drawn: true };
}

/** 图章：把 stamp.label 居中绘制为文字（避免画真实 SVG 复杂形状）
 *  文字字体走 resolveStampFont：CJK 字符用思源黑体 SC（OFL 1.1），Latin-only 用 Helvetica。
 *  字体加载失败 → 计入 skipped；字体编码失败 → 保留边框（静默吞 drawText 错误）。 */
async function drawStamp(
  page: PDFPage,
  annotation: PdfAnnotation,
  bounds: PdfRect,
  color: ReturnType<typeof rgb>,
  workingPdf: PDFDocument,
): Promise<{ drawn: true } | { drawn: false; reason: string }> {
  if (!annotation.stamp) {
    return { drawn: false, reason: "图章批注缺少 stamp 字段" };
  }
  const label = annotation.stamp.label?.trim();
  if (!label) {
    return { drawn: false, reason: "图章文字为空" };
  }
  const clamped = clampRects(annotation.rects, bounds);
  if (clamped.length === 0) {
    return { drawn: false, reason: "rect 全部越界或为空" };
  }
  const rect = clamped[0];
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: color,
    borderOpacity: STAMP_BORDER_OPACITY,
    borderWidth: 2,
    color: rgb(1, 1, 1),
    opacity: 0,
  });

  let font: PDFFont | null;
  try {
    font = await resolveStampFont(workingPdf, label);
  } catch {
    // 字体加载失败时保留边框（与原行为一致：不计入 skipped）
    font = null;
  }

  if (font) {
    try {
      const textWidth = safeTextWidth(font, label, STAMP_FONT_SIZE);
      const x = rect.x + Math.max(0, (rect.width - textWidth) / 2);
      const y = rect.y + Math.max(0, (rect.height - STAMP_FONT_SIZE) / 2);
      page.drawText(label, {
        x,
        y,
        size: STAMP_FONT_SIZE,
        font,
        color,
        opacity: STAMP_BORDER_OPACITY,
      });
    } catch {
      // 字体编码异常（极端字符）时保留边框，不计入 skipped
    }
  }
  return { drawn: true };
}

function computeArrowHead(
  start: { x: number; y: number },
  end: { x: number; y: number },
  size: number,
): { left: { x: number; y: number }; right: { x: number; y: number } } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;
  const baseX = end.x - ux * size;
  const baseY = end.y - uy * size;
  const perpX = -uy;
  const perpY = ux;
  const half = size * 0.5;
  return {
    left: { x: baseX + perpX * half, y: baseY + perpY * half },
    right: { x: baseX - perpX * half, y: baseY - perpY * half },
  };
}

function clampRects(rects: ReadonlyArray<PdfRect>, bounds: PdfRect): PdfRect[] {
  const result: PdfRect[] = [];
  for (const rect of rects) {
    const clamped = clampRectToBounds(rect, bounds);
    if (clamped.width > 0 && clamped.height > 0) {
      result.push(clamped);
    }
  }
  return result;
}

function clampPoint(
  point: { x: number; y: number },
  bounds: PdfRect,
): { x: number; y: number } {
  const x = Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.width));
  const y = Math.max(bounds.y, Math.min(point.y, bounds.y + bounds.height));
  return { x, y };
}

function parseColorOrWarn(value: string): ReturnType<typeof rgb> | null {
  const trimmed = value.trim();
  const sixDigitMatch = /^#?([a-fA-F0-9]{6})$/.exec(trimmed);
  if (sixDigitMatch) {
    return hexToRgb(sixDigitMatch[1]);
  }
  const threeDigitMatch = /^#?([a-fA-F0-9]{3})$/.exec(trimmed);
  if (threeDigitMatch) {
    const hex = threeDigitMatch[1];
    return hexToRgb(hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]);
  }
  return null;
}

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  return rgb(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function normalizeOpacity(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function safeTextWidth(font: PDFFont, text: string, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch (error) {
    throw sanitizeFontError(error);
  }
}

function sanitizeFontError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("WinAnsi") || message.includes("encode")) {
    return "批注内容含 PDF 内置字体不支持的字符（中文 / 非 Latin-1），已跳过绘制。";
  }
  return `绘制失败：${message}`;
}

function sanitizePdfExportError(error: unknown, prefix: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${prefix}（${message}）`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { degrees };
