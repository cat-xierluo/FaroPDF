import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type {
  PdfAnnotation,
  PdfAnnotationInk,
  PdfAnnotationLine,
  PdfAnnotationStyle,
  PdfAnnotationType,
  PdfPoint,
  PdfRect,
  PdfStampName,
} from "../../shared/pdf/annotation";
import { annotationBoundingRect, inkStrokesToRect, normalizeRect, pointsToRect } from "../../modules/annotation";
import { renderStampSvg, resolveStampTemplate } from "../../modules/annotation";

/** 批注 overlay 接收的 viewport 信息（PDF 坐标系，pt） */
export interface AnnotationOverlayViewport {
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
}

export interface AnnotationOverlayPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AnnotationOverlayProps {
  pageIndex: number;
  viewport: AnnotationOverlayViewport;
  /** 当前 PDF 页容器相对 workspace 的实际像素位置。 */
  placement?: AnnotationOverlayPlacement;
  /** 当前页上的批注（pageIndex 已匹配） */
  annotations: ReadonlyArray<PdfAnnotation>;
  /** 当前选中的批注 id（高亮） */
  activeAnnotationId?: string | null;
  /** 当前 armed 工具类型；null 表示"select"模式，不画新批注 */
  activeToolType?: PdfAnnotationType | null;
  /** 当前 armed 工具的颜色 */
  activeColor?: string;
  /** 当前 armed 形状的不透明度（0..1）。 */
  activeOpacity?: number;
  /** 当前 armed 形状的线宽、线型和填充。 */
  activeStyle?: PdfAnnotationStyle;
  /** 当前 armed stamp 工具的图章 */
  activeStampName?: PdfStampName;
  /** 当前 armed stamp 工具的图章文字 */
  activeStampLabel?: string;
  /** ISS-062 阶段 3：customStamp 图章图片 base64 dataURL（透传到 annotation.stamp.image） */
  activeStampImage?: string;
  /** 用户在 overlay 上完成一次新建（click/drag/ink）后回调，参数是已经规整好的 PdfAnnotationInput */
  onAnnotationDraft?: (input: AnnotationDraftInput) => void;
  /** 已有批注被点击的回调（用于列表跳转、弹窗等） */
  onAnnotationClick?: (annotationId: string) => void;
}

export interface AnnotationDraftInput {
  type: PdfAnnotationType;
  rects: PdfRect[];
  color: string;
  opacity?: number;
  style?: PdfAnnotationStyle;
  content?: string;
  quote?: string;
  line?: PdfAnnotationLine;
  ink?: PdfAnnotationInk;
  stamp?: { label: string; name: PdfStampName };
}

/**
 * 在 PDF 页面之上叠加批注：负责渲染已有批注 + 处理"armed"工具的拖拽/绘制。
 * 所有坐标都使用 PDF 视口空间（未缩放），外层用 `width: 100%; height: 100%` 容器，
 * 内部用百分比定位，让 overlay 跟随父容器尺寸缩放。
 */
export function AnnotationOverlay({
  activeAnnotationId,
  activeColor,
  activeOpacity,
  activeStyle,
  activeStampImage,
  activeStampLabel,
  activeStampName,
  activeToolType,
  annotations,
  onAnnotationClick,
  onAnnotationDraft,
  pageIndex,
  placement,
  viewport,
}: AnnotationOverlayProps) {
  const draftRef = useRef<DraftState | null>(null);
  const inkStrokesRef = useRef<PdfPoint[][]>([]);
  const currentStrokeRef = useRef<PdfPoint[] | null>(null);

  const interaction = activeToolType
    ? ANNOTATION_TOOL_INTERACTION[activeToolType] ?? null
    : null;

  const overlayStyle: CSSProperties = {
    ...(placement
      ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height }
      : { inset: 0, width: "100%", height: "100%" }),
    position: "absolute",
    pointerEvents: "auto",
    zIndex: 4,
  };

  const interactive = interaction !== null && onAnnotationDraft !== undefined;

  function localPoint(event: ReactPointerEvent<HTMLDivElement>): PdfPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = viewport.width / Math.max(1, rect.width);
    const scaleY = viewport.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      // 批注模型使用 PDF 用户空间（原点左下）；DOM 事件使用左上原点。
      y: viewport.height - (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction || !onAnnotationDraft) {
      return;
    }

    const point = localPoint(event);

    if (interaction === "click") {
      event.preventDefault();
      onAnnotationDraft(buildClickDraft(activeToolType, point, viewport, activeColor, activeStampName, activeStampLabel, activeStampImage));
      return;
    }

    if (interaction === "drag") {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      draftRef.current = { start: point, current: point, kind: "drag" };
      return;
    }

    if (interaction === "ink") {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      currentStrokeRef.current = [point];
      inkStrokesRef.current = [...inkStrokesRef.current, currentStrokeRef.current];
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction || !onAnnotationDraft) {
      return;
    }

    const point = localPoint(event);

    if (interaction === "drag" && draftRef.current?.kind === "drag") {
      draftRef.current = { ...draftRef.current, current: point };
    } else if (interaction === "ink" && currentStrokeRef.current) {
      currentStrokeRef.current.push(point);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction || !onAnnotationDraft) {
      return;
    }

    const point = localPoint(event);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (interaction === "drag" && draftRef.current?.kind === "drag") {
      const { start } = draftRef.current;
      draftRef.current = null;
      onAnnotationDraft(buildDragDraft(activeToolType, start, point, viewport, activeColor, activeOpacity, activeStyle, activeStampName && activeStampLabel ? { name: activeStampName, label: activeStampLabel, ...(activeStampImage ? { image: activeStampImage } : {}) } : undefined));
      return;
    }

    if (interaction === "ink") {
      currentStrokeRef.current = null;
      const strokes = inkStrokesRef.current;
      inkStrokesRef.current = [];
      if (strokes.some((stroke) => stroke.length > 0)) {
        onAnnotationDraft(buildInkDraft(strokes, viewport, activeColor, activeOpacity, activeStyle));
      }
    }
  }

  function handlePointerLeave() {
    draftRef.current = null;
    currentStrokeRef.current = null;
  }

  function handleAnnotationClick(annotationId: string) {
    if (interaction) {
      return;
    }
    onAnnotationClick?.(annotationId);
  }

  const previewDraft = computePreview(draftRef.current, inkStrokesRef.current, interaction, activeToolType, viewport, activeColor, activeOpacity, activeStyle, activeStampName, activeStampLabel);

  return (
    <div
      aria-label={`第 ${pageIndex + 1} 页批注叠加层`}
      data-testid={`annotation-overlay-${pageIndex}`}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerLeave={handlePointerLeave}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      style={{
        ...overlayStyle,
        cursor: interaction ? "crosshair" : "default",
      }}
    >
      {annotations.map((annotation) => (
        <AnnotationGlyph
          annotation={annotation}
          isActive={annotation.id === activeAnnotationId}
          key={annotation.id}
          onSelect={() => handleAnnotationClick(annotation.id)}
          viewport={viewport}
        />
      ))}
      {previewDraft ? <AnnotationGlyph annotation={previewDraft} isActive={false} viewport={viewport} /> : null}
    </div>
  );
}

/** 工具与 overlay 交互模式的对应表 */
const ANNOTATION_TOOL_INTERACTION: Record<PdfAnnotationType, "click" | "drag" | "ink"> = {
  highlight: "drag",
  ellipse: "drag",
  "double-arrow": "drag",
  line: "drag",
  underline: "drag",
  strikeout: "drag",
  note: "click",
  textbox: "click",
  rectangle: "drag",
  arrow: "drag",
  ink: "ink",
  stamp: "drag",
};

interface DraftState {
  start: PdfPoint;
  current: PdfPoint;
  kind: "drag";
}

function buildClickDraft(
  type: PdfAnnotationType | null | undefined,
  point: PdfPoint,
  viewport: AnnotationOverlayViewport,
  color: string | undefined,
  stampName: PdfStampName | undefined,
  stampLabel: string | undefined,
  stampImage?: string,
): AnnotationDraftInput {
  const resolvedColor = color ?? "#f6d66f";
  const defaultSize: Record<string, PdfRect> = {
    note: { x: point.x - 14, y: point.y - 14, width: 28, height: 28 },
    textbox: { x: point.x - 90, y: point.y - 24, width: 180, height: 48 },
    stamp: { x: point.x - 60, y: point.y - 18, width: 120, height: 36 },
  };
  const rect = defaultSize[type ?? ""] ?? { x: point.x - 50, y: point.y - 10, width: 100, height: 20 };
  const clamped = clampRect(rect, viewport);

  if (type === "stamp") {
    return {
      type: "stamp",
      rects: [clamped],
      color: resolvedColor,
      stamp: {
        label: stampLabel?.trim() || "已阅",
        name: stampName ?? "reviewed",
        // ISS-062 阶段 3 / DEC-122：customStamp 图片透传到 annotation.stamp.image
        // drawStamp（annotationPdfWriter）读 image 字段调 pdf-lib embedPng/Jpg + drawImage。
        ...(stampImage ? { image: stampImage } : {}),
      },
    };
  }

  return {
    type: type ?? "highlight",
    rects: [clamped],
    color: resolvedColor,
  };
}

function buildDragDraft(
  type: PdfAnnotationType | null | undefined,
  start: PdfPoint,
  end: PdfPoint,
  viewport: AnnotationOverlayViewport,
  color: string | undefined,
  opacity?: number,
  style?: PdfAnnotationStyle,
  stamp?: { name: PdfStampName; label: string; image?: string },
): AnnotationDraftInput {
  const resolvedColor = color ?? "#f6d66f";
  const rect = clampRect(pointsToRect(start, end), viewport);

  // ISS-NEW-M / ROADMAP L111：签名/图章 drag 落点——拖出的矩形作为落点位置与尺寸。
  // drag 太小时给一个最小尺寸（避免签名小到不可见），以 drag 起点-中心对齐。
  if (type === "stamp" && stamp) {
    const minW = 80;
    const minH = 24;
    const stampRect =
      rect.width < minW || rect.height < minH
        ? { x: rect.x, y: rect.y, width: Math.max(rect.width, minW), height: Math.max(rect.height, minH) }
        : rect;
    return {
      type: "stamp",
      rects: [stampRect],
      color: resolvedColor,
      stamp: {
        label: stamp.label.trim() || "已阅",
        name: stamp.name,
        ...(stamp.image ? { image: stamp.image } : {}),
      },
    };
  }

  if (type === "arrow" || type === "double-arrow" || type === "line") {
    return {
      type,
      rects: [rect],
      color: resolvedColor,
      ...(opacity !== undefined ? { opacity } : {}),
      ...(style ? { style } : {}),
      line: { start, end },
    };
  }

  if (rect.width < 1 || rect.height < 1) {
    return { type: type ?? "highlight", rects: [rect], color: resolvedColor };
  }

  return {
    type: type ?? "highlight",
    rects: [rect],
    color: resolvedColor,
    ...(opacity !== undefined ? { opacity } : {}),
    ...(style ? { style } : {}),
  };
}

function buildInkDraft(
  strokes: PdfPoint[][],
  viewport: AnnotationOverlayViewport,
  color: string | undefined,
  opacity?: number,
  style?: PdfAnnotationStyle,
): AnnotationDraftInput {
  const filtered = strokes.filter((stroke) => stroke.length > 0);
  const bounds = inkStrokesToRect(filtered);
  const rects = bounds ? [clampRect(bounds, viewport)] : [];

  return {
    type: "ink",
    rects,
    color: color ?? "#1f2937",
    ...(opacity !== undefined ? { opacity } : {}),
    ...(style ? { style } : {}),
    ink: { strokes: filtered },
  };
}

function computePreview(
  dragDraft: DraftState | null,
  inkStrokes: PdfPoint[][],
  interaction: "click" | "drag" | "ink" | null,
  activeToolType: PdfAnnotationType | null | undefined,
  viewport: AnnotationOverlayViewport,
  color: string | undefined,
  opacity: number | undefined,
  style: PdfAnnotationStyle | undefined,
  _stampName: PdfStampName | undefined,
  _stampLabel: string | undefined,
): PdfAnnotation | null {
  if (!interaction || !activeToolType) {
    return null;
  }

  const baseColor = color ?? "#f6d66f";

  if (interaction === "drag" && dragDraft) {
    const draft = buildDragDraft(activeToolType, dragDraft.start, dragDraft.current, viewport, baseColor, opacity, style);
    return previewFromDraft(draft, viewport);
  }

  if (interaction === "ink") {
    const filtered = inkStrokes.filter((stroke) => stroke.length > 0);
    if (filtered.length === 0) {
      return null;
    }
    const draft = buildInkDraft(filtered, viewport, baseColor, opacity, style);
    return previewFromDraft(draft, viewport);
  }

  return null;
}

function previewFromDraft(draft: AnnotationDraftInput, _viewport: AnnotationOverlayViewport): PdfAnnotation {
  const now = new Date().toISOString();
  return {
    id: "preview",
    type: draft.type,
    pageIndex: 0,
    rects: draft.rects,
    color: draft.color,
    ...(draft.opacity !== undefined ? { opacity: draft.opacity } : {}),
    ...(draft.style ? { style: draft.style } : {}),
    ...(draft.line ? { line: draft.line } : {}),
    ...(draft.ink ? { ink: draft.ink } : {}),
    ...(draft.stamp ? { stamp: draft.stamp } : {}),
    ...(draft.content ? { content: draft.content } : {}),
    ...(draft.quote ? { quote: draft.quote } : {}),
    createdAt: now,
    updatedAt: now,
  } as PdfAnnotation & { opacity?: number; viewport: AnnotationOverlayViewport; isPreview?: boolean };
}

function clampRect(rect: PdfRect, viewport: AnnotationOverlayViewport): PdfRect {
  const x = Math.max(0, Math.min(rect.x, viewport.width));
  const y = Math.max(0, Math.min(rect.y, viewport.height));
  const right = Math.max(0, Math.min(rect.x + rect.width, viewport.width));
  const bottom = Math.max(0, Math.min(rect.y + rect.height, viewport.height));
  return normalizeRect({ x, y, width: right - x, height: bottom - y });
}

interface AnnotationGlyphProps {
  annotation: PdfAnnotation;
  isActive: boolean;
  onSelect?: () => void;
  viewport: AnnotationOverlayViewport;
}

function AnnotationGlyph({ annotation, isActive, onSelect, viewport }: AnnotationGlyphProps) {
  const common = {
    color: annotation.color,
    opacity: annotation.opacity,
    isPreview: annotation.id === "preview",
  };

  if (annotation.type === "stamp" && annotation.stamp) {
    return <StampGlyph annotation={annotation} isActive={isActive} onSelect={onSelect} viewport={viewport} />;
  }

  if (annotation.type === "ink" && annotation.ink) {
    return <InkGlyph annotation={annotation} isActive={isActive} onSelect={onSelect} viewport={viewport} />;
  }

  if ((annotation.type === "arrow" || annotation.type === "double-arrow" || annotation.type === "line") && annotation.line) {
    return <LineGlyph annotation={annotation} isActive={isActive} onSelect={onSelect} viewport={viewport} />;
  }

  return <RectGlyph annotation={annotation} isActive={isActive} onSelect={onSelect} viewport={viewport} {...common} />;
}

interface RectGlyphProps {
  annotation: PdfAnnotation;
  isActive: boolean;
  onSelect?: () => void;
  viewport: AnnotationOverlayViewport;
  color: string;
  opacity?: number;
  isPreview?: boolean;
}

function RectGlyph({ annotation, color, isActive, isPreview, onSelect, opacity, viewport }: RectGlyphProps) {
  const bounds = annotationBoundingRect(annotation);
  if (!bounds) {
    return null;
  }

  const base = {
    backgroundColor: typeBackground(annotation, color, opacity),
    border: typeBorder(annotation, color, isActive),
    borderRadius: annotation.type === "ellipse" ? "50%" : undefined,
    boxShadow: isActive ? "0 0 0 2px var(--accent)" : undefined,
    cursor: onSelect ? "pointer" : "default",
    left: `${(bounds.x / viewport.width) * 100}%`,
    pointerEvents: isPreview ? ("none" as const) : ("auto" as const),
    position: "absolute" as const,
    top: `${((viewport.height - bounds.y - bounds.height) / viewport.height) * 100}%`,
    width: `${(bounds.width / viewport.width) * 100}%`,
    height: `${(bounds.height / viewport.height) * 100}%`,
  };

  if (annotation.type === "underline" || annotation.type === "strikeout") {
    const lineY = annotation.type === "underline" ? bounds.y + 1 : bounds.y + bounds.height / 2;
    return (
      <div
        aria-label={describeAnnotation(annotation)}
        className={"annotation-glyph annotation-glyph--line" + (isActive ? " is-active" : "")}
        onClick={onSelect}
        role="button"
        style={{
          ...base,
          background: "transparent",
          borderTop: `2px solid ${color}`,
          height: "0",
          left: `${(bounds.x / viewport.width) * 100}%`,
          top: `${((viewport.height - lineY) / viewport.height) * 100}%`,
          width: `${(bounds.width / viewport.width) * 100}%`,
        }}
        tabIndex={onSelect ? 0 : -1}
      />
    );
  }

  return (
    <div
      aria-label={describeAnnotation(annotation)}
      className={
        "annotation-glyph" +
        (isActive ? " is-active" : "") +
        (isPreview ? " is-preview" : "")
      }
      onClick={onSelect}
      role="button"
      style={base}
      tabIndex={onSelect ? 0 : -1}
    />
  );
}

function InkGlyph({ annotation, isActive, onSelect, viewport }: AnnotationGlyphProps) {
  if (!annotation.ink) {
    return null;
  }

  const bounds = inkStrokesToRect(annotation.ink.strokes);
  if (!bounds) {
    return null;
  }

  const path = annotation.ink.strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => stroke.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${viewport.height - point.y}`).join(" "))
    .join(" ");

  return (
    <svg
      aria-label={describeAnnotation(annotation)}
      className={"annotation-glyph annotation-glyph--ink" + (isActive ? " is-active" : "")}
      onClick={onSelect}
      role="button"
      style={{
        cursor: onSelect ? "pointer" : "default",
        height: `${(bounds.height / viewport.height) * 100 + 2}%`,
        left: `${((bounds.x - 1) / viewport.width) * 100}%`,
        overflow: "visible",
        pointerEvents: onSelect ? "auto" : "none",
        position: "absolute",
        top: `${((viewport.height - bounds.y - bounds.height - 1) / viewport.height) * 100}%`,
        width: `${(bounds.width / viewport.width) * 100 + 2}%`,
        filter: isActive ? "drop-shadow(0 0 0 var(--accent))" : undefined,
      }}
      tabIndex={onSelect ? 0 : -1}
      viewBox={`${bounds.x - 1} ${viewport.height - bounds.y - bounds.height - 1} ${bounds.width + 2} ${bounds.height + 2}`}
    >
      <path
        d={path}
        fill="none"
        stroke={annotation.color}
        opacity={annotation.opacity ?? 1}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={annotation.style?.strokeStyle === "dashed" ? `${(annotation.style.strokeWidth ?? 2) * 3} ${(annotation.style.strokeWidth ?? 2) * 2}` : undefined}
        strokeWidth={annotation.style?.strokeWidth ?? 2}
      />
    </svg>
  );
}

function LineGlyph({ annotation, isActive, onSelect, viewport }: AnnotationGlyphProps) {
  if (!annotation.line) {
    return null;
  }

  const bounds = annotationBoundingRect(annotation);
  if (!bounds) {
    return null;
  }
  const strokeWidth = annotation.style?.strokeWidth ?? 2;
  const arrowHeadSize = Math.max(8, strokeWidth * 4);
  const arrowHeads = annotation.type === "line"
    ? []
    : annotation.type === "double-arrow"
      ? [
          computeLineArrowHead(annotation.line.start, annotation.line.end, arrowHeadSize),
          computeLineArrowHead(annotation.line.end, annotation.line.start, arrowHeadSize),
        ]
      : [computeLineArrowHead(annotation.line.start, annotation.line.end, arrowHeadSize)];

  return (
    <svg
      aria-label={describeAnnotation(annotation)}
      className={"annotation-glyph annotation-glyph--line-shape" + (isActive ? " is-active" : "")}
      onClick={onSelect}
      role="button"
      style={{
        cursor: onSelect ? "pointer" : "default",
        height: `${(bounds.height / viewport.height) * 100 + 2}%`,
        left: `${((bounds.x - 1) / viewport.width) * 100}%`,
        overflow: "visible",
        pointerEvents: onSelect ? "auto" : "none",
        position: "absolute",
        top: `${((viewport.height - bounds.y - bounds.height - 1) / viewport.height) * 100}%`,
        width: `${(bounds.width / viewport.width) * 100 + 2}%`,
      }}
      tabIndex={onSelect ? 0 : -1}
      viewBox={`${bounds.x - 1} ${viewport.height - bounds.y - bounds.height - 1} ${bounds.width + 2} ${bounds.height + 2}`}
    >
      <line
        opacity={annotation.opacity ?? 1}
        stroke={annotation.color}
        strokeLinecap="round"
        strokeDasharray={annotation.style?.strokeStyle === "dashed" ? `${strokeWidth * 3} ${strokeWidth * 2}` : undefined}
        strokeWidth={strokeWidth}
        x1={annotation.line.start.x}
        x2={annotation.line.end.x}
        y1={viewport.height - annotation.line.start.y}
        y2={viewport.height - annotation.line.end.y}
      />
      {arrowHeads.map((head, index) => (
        <polyline
          fill="none"
          key={index}
          opacity={annotation.opacity ?? 1}
          points={`${head.left.x},${viewport.height - head.left.y} ${head.tip.x},${viewport.height - head.tip.y} ${head.right.x},${viewport.height - head.right.y}`}
          stroke={annotation.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      ))}
    </svg>
  );
}

function computeLineArrowHead(start: PdfPoint, end: PdfPoint, size: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = end.x - ux * size;
  const baseY = end.y - uy * size;
  const perpX = -uy;
  const perpY = ux;
  const half = size * 0.5;
  return {
    tip: end,
    left: { x: baseX + perpX * half, y: baseY + perpY * half },
    right: { x: baseX - perpX * half, y: baseY - perpY * half },
  };
}

function StampGlyph({ annotation, isActive, onSelect, viewport }: AnnotationGlyphProps) {
  if (!annotation.stamp) {
    return null;
  }

  const bounds = annotationBoundingRect(annotation) ?? annotation.rects[0];
  if (!bounds) {
    return null;
  }

  const template = resolveStampTemplate(annotation.stamp, annotation.stamp.name);
  const viewBoxWidth = 400;
  const viewBoxHeight = 100;

  // ISS-NEW-M / ROADMAP L111：自定义签名/图章图片所见即所得。
  // 有 image（base64 dataURL，签名库或 customStamp）时渲染 <img>；否则回退模板印章 SVG。
  const hasImage = Boolean(annotation.stamp.image);

  return (
    <div
      aria-label={describeAnnotation(annotation)}
      className={"annotation-glyph annotation-glyph--stamp" + (isActive ? " is-active" : "")}
      onClick={onSelect}
      role="button"
      style={{
        cursor: onSelect ? "pointer" : "default",
        left: `${(bounds.x / viewport.width) * 100}%`,
        pointerEvents: onSelect ? "auto" : "none",
        position: "absolute",
        top: `${((viewport.height - bounds.y - bounds.height) / viewport.height) * 100}%`,
        width: `${(bounds.width / viewport.width) * 100}%`,
        height: `${(bounds.height / viewport.height) * 100}%`,
        transform: "rotate(-6deg)",
        transformOrigin: "center",
        filter: isActive ? "drop-shadow(0 0 0 var(--accent))" : undefined,
      }}
      tabIndex={onSelect ? 0 : -1}
    >
      {hasImage ? (
        <img
          alt={annotation.stamp.label || "签名"}
          src={annotation.stamp.image}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <svg
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          dangerouslySetInnerHTML={{
            __html: renderStampSvg(annotation.stamp.name, {
              width: bounds.width,
              height: bounds.height,
              color: template.color,
              label: template.label,
            }),
          }}
          width="100%"
          height="100%"
        />
      )}
    </div>
  );
}

function typeBackground(annotation: PdfAnnotation, color: string, opacity?: number): string {
  if (annotation.type === "highlight" || annotation.type === "note" || annotation.type === "textbox") {
    const alpha = opacity ?? 0.35;
    return hexWithAlpha(color, alpha);
  }

  if (annotation.type === "rectangle" || annotation.type === "ellipse") {
    const fillColor = annotation.style?.fillColor;
    if (fillColor && fillColor !== "transparent") {
      return hexWithAlpha(fillColor, opacity ?? 1);
    }
  }

  return "transparent";
}

function typeBorder(annotation: PdfAnnotation, color: string, isActive: boolean): string {
  if (annotation.type === "rectangle" || annotation.type === "ellipse" || annotation.type === "textbox" || annotation.type === "note") {
    const width = isActive ? Math.max(3, annotation.style?.strokeWidth ?? 2) : annotation.style?.strokeWidth ?? 2;
    const strokeStyle = annotation.style?.strokeStyle ?? "solid";
    return `${width}px ${strokeStyle} ${hexWithAlpha(color, annotation.opacity ?? 1)}`;
  }

  return "none";
}

function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function describeAnnotation(annotation: PdfAnnotation): string {
  const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type] ?? annotation.type;
  if (annotation.stamp?.label) {
    return `${typeLabel}：${annotation.stamp.label}`;
  }
  if (annotation.content) {
    return `${typeLabel}：${annotation.content}`;
  }
  return typeLabel;
}

const ANNOTATION_TYPE_LABELS: Record<PdfAnnotationType, string> = {
  highlight: "高亮",
  underline: "下划线",
  strikeout: "删除线",
  note: "备注",
  textbox: "文本框",
  rectangle: "矩形",
  ellipse: "椭圆",
  arrow: "箭头",
  "double-arrow": "双向箭头",
  line: "直线",
  ink: "手写",
  stamp: "图章",
};
