import type { PdfAnnotationStrokeStyle, PdfAnnotationType, PdfStampName } from "../../shared/pdf/annotation";
import { STAMP_TEMPLATES } from "./stamps";

/** 批注工具的视觉模式 */
export type AnnotationToolInteraction = "click" | "drag" | "ink";

/** 批注工具的元信息：用于工具条渲染、键盘提示、armed 模式判定 */
export interface AnnotationToolDescriptor {
  type: PdfAnnotationType;
  /** 中文标签 */
  label: string;
  /** 工具交互模式：单击放置、拖拽生成矩形、连续点为墨迹 */
  interaction: AnnotationToolInteraction;
  /** 工具条按钮上的简短描述 */
  hint: string;
  /** 默认占位尺寸（PDF 坐标系），用于 click 工具 */
  defaultSize?: { width: number; height: number };
  /** 仅在 stamp 工具下使用 */
  stampName?: PdfStampName;
  /** 是否为需要选择图章类型的 stamp 工具 */
  requiresStampSelection?: boolean;
}

export const ANNOTATION_TOOL_LIST: AnnotationToolDescriptor[] = [
  { type: "highlight", label: "高亮", interaction: "drag", hint: "拖拽选区", defaultSize: { width: 200, height: 18 } },
  { type: "underline", label: "下划线", interaction: "drag", hint: "拖拽选区", defaultSize: { width: 200, height: 14 } },
  { type: "strikeout", label: "删除线", interaction: "drag", hint: "拖拽选区", defaultSize: { width: 200, height: 14 } },
  { type: "note", label: "备注", interaction: "click", hint: "点击放置", defaultSize: { width: 28, height: 28 } },
  { type: "textbox", label: "文本框", interaction: "click", hint: "点击放置", defaultSize: { width: 180, height: 48 } },
  { type: "rectangle", label: "矩形", interaction: "drag", hint: "拖拽选区", defaultSize: { width: 160, height: 90 } },
  // ISS-NEW-D 阶段 3（2026-06-23）：形状 submenu 3 补（PDF 渲染 AnnotationOverlay 留 v0.2 占位）。
  { type: "ellipse", label: "椭圆", interaction: "drag", hint: "拖拽选区", defaultSize: { width: 160, height: 90 } },
  { type: "arrow", label: "箭头", interaction: "drag", hint: "拖拽方向" },
  { type: "double-arrow", label: "双向箭头", interaction: "drag", hint: "拖拽方向" },
  { type: "line", label: "直线", interaction: "drag", hint: "拖拽方向" },
  { type: "ink", label: "手写", interaction: "ink", hint: "按住绘制" },
  {
    type: "stamp",
    label: "图章",
    interaction: "click",
    hint: "选择图章后点击放置",
    defaultSize: { width: 120, height: 36 },
    requiresStampSelection: true,
  },
];

export const ANNOTATION_TOOL_MAP: Record<PdfAnnotationType, AnnotationToolDescriptor> = ANNOTATION_TOOL_LIST.reduce(
  (acc, tool) => {
    acc[tool.type] = tool;
    return acc;
  },
  {} as Record<PdfAnnotationType, AnnotationToolDescriptor>,
);

/** 工具条上展示的默认色板（覆盖 highlight/underline/strikeout/rectangle/arrow/ink/note/textbox） */
export interface AnnotationColorSwatch {
  id: string;
  label: string;
  value: string;
}

export const ANNOTATION_COLOR_SWATCHES: AnnotationColorSwatch[] = [
  { id: "yellow", label: "黄", value: "#f6d66f" },
  { id: "blue", label: "蓝", value: "#2f80ed" },
  { id: "red", label: "红", value: "#d14d4d" },
  { id: "green", label: "绿", value: "#2c8a4a" },
  { id: "purple", label: "紫", value: "#6c5ce7" },
  { id: "ink", label: "黑", value: "#1f2937" },
];

export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLOR_SWATCHES[0].value;

export type AnnotationShapeToolType = "rectangle" | "ellipse" | "arrow" | "double-arrow" | "line" | "ink";

export interface AnnotationShapeStyle {
  toolType: AnnotationShapeToolType;
  strokeStyle: PdfAnnotationStrokeStyle;
  strokeWidth: number;
  opacity: number;
  strokeColor: string;
  fillColor: string;
}

export const DEFAULT_ANNOTATION_SHAPE_STYLE: AnnotationShapeStyle = {
  toolType: "rectangle",
  strokeStyle: "solid",
  strokeWidth: 2,
  opacity: 1,
  strokeColor: "#000000",
  fillColor: "transparent",
};

export function isAnnotationShapeTool(type: PdfAnnotationType | null | undefined): type is AnnotationShapeToolType {
  return type === "rectangle" || type === "ellipse" || type === "arrow" || type === "double-arrow" || type === "line" || type === "ink";
}

/** 当前已选中的工具和样式偏好 */
export interface AnnotationToolState {
  /** 当前 arm 的工具类型；null 表示"select"模式，不画新批注 */
  activeToolType: PdfAnnotationType | null;
  /** 当前画笔颜色 */
  color: string;
  /** 形状右栏与画布共用的样式状态；opacity 使用 0..1。 */
  shapeStyle: AnnotationShapeStyle;
  /** stamp 工具下选中的图章模板 */
  stampName: PdfStampName;
  /** stamp 工具下用户输入的图章文字 */
  stampLabel: string;
  /** stamp 工具下自定义图章的 base64 image data URL（仅 stampName="custom" 时使用，ISS-062 阶段 3 / DEC-112） */
  stampImage?: string;
}

export function createInitialAnnotationToolState(): AnnotationToolState {
  return {
    activeToolType: null,
    color: DEFAULT_ANNOTATION_COLOR,
    shapeStyle: { ...DEFAULT_ANNOTATION_SHAPE_STYLE },
    stampName: "reviewed",
    stampLabel: STAMP_TEMPLATES.reviewed.defaultLabel,
  };
}

export function armAnnotationTool(
  state: AnnotationToolState,
  type: PdfAnnotationType,
): AnnotationToolState {
  const descriptor = ANNOTATION_TOOL_MAP[type];
  if (!descriptor) {
    return state;
  }

  const isAlreadyActive = state.activeToolType === type;
  const nextStampLabel = descriptor.requiresStampSelection
    ? state.stampLabel?.trim() || STAMP_TEMPLATES[state.stampName].defaultLabel
    : state.stampLabel;

  return {
    ...state,
    activeToolType: isAlreadyActive ? null : type,
    ...(isAnnotationShapeTool(type)
      ? { shapeStyle: { ...(state.shapeStyle ?? DEFAULT_ANNOTATION_SHAPE_STYLE), toolType: type } }
      : {}),
    ...(descriptor.requiresStampSelection ? { stampLabel: nextStampLabel } : {}),
  };
}

export function disarmAnnotationTool(state: AnnotationToolState): AnnotationToolState {
  return { ...state, activeToolType: null };
}

export function setAnnotationColor(state: AnnotationToolState, color: string): AnnotationToolState {
  return {
    ...state,
    color,
    ...(isAnnotationShapeTool(state.activeToolType)
      ? { shapeStyle: { ...(state.shapeStyle ?? DEFAULT_ANNOTATION_SHAPE_STYLE), strokeColor: color } }
      : {}),
  };
}

export function setAnnotationShapeStyle(
  state: AnnotationToolState,
  shapeStyle: AnnotationShapeStyle,
): AnnotationToolState {
  return {
    ...state,
    activeToolType: shapeStyle.toolType,
    color: shapeStyle.strokeColor,
    shapeStyle: {
      ...shapeStyle,
      strokeWidth: Math.min(12, Math.max(1, shapeStyle.strokeWidth)),
      opacity: Math.min(1, Math.max(0.1, shapeStyle.opacity)),
    },
  };
}

export function setAnnotationStampName(state: AnnotationToolState, stampName: PdfStampName): AnnotationToolState {
  return {
    ...state,
    stampName,
    stampLabel: STAMP_TEMPLATES[stampName].defaultLabel,
  };
}

export function setAnnotationStampLabel(state: AnnotationToolState, label: string): AnnotationToolState {
  return { ...state, stampLabel: label };
}
