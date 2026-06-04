import type { PdfAnnotationStamp, PdfStampName } from "../../shared/pdf/annotation";

/**
 * 图章 SVG 模板。
 *
 * - shape: 视觉形态（rectangle / rounded / ellipse）
 * - defaultColor: 预设颜色，用户未指定时回退到这个颜色
 * - defaultLabel: 模板默认显示的文字
 * - render: 在指定 viewBox 内把模板绘制为 SVG 子树（不包含外层 <svg>）
 */
export interface StampTemplate {
  id: PdfStampName;
  label: string;
  defaultLabel: string;
  defaultColor: string;
  shape: "rectangle" | "rounded" | "ellipse" | "banner";
}

export const STAMP_TEMPLATES: Record<PdfStampName, StampTemplate> = {
  reviewed: {
    id: "reviewed",
    label: "已阅",
    defaultLabel: "已阅",
    defaultColor: "#1f7a3a",
    shape: "rectangle",
  },
  important: {
    id: "important",
    label: "重点",
    defaultLabel: "重点",
    defaultColor: "#b03030",
    shape: "ellipse",
  },
  todo: {
    id: "todo",
    label: "待核",
    defaultLabel: "待核",
    defaultColor: "#b7791f",
    shape: "rounded",
  },
  evidence: {
    id: "evidence",
    label: "证据",
    defaultLabel: "证据",
    defaultColor: "#2a4d8f",
    shape: "banner",
  },
  custom: {
    id: "custom",
    label: "自定义",
    defaultLabel: "CUSTOM",
    defaultColor: "#1f2937",
    shape: "rounded",
  },
};

export const STAMP_TEMPLATE_LIST: StampTemplate[] = [
  STAMP_TEMPLATES.reviewed,
  STAMP_TEMPLATES.important,
  STAMP_TEMPLATES.todo,
  STAMP_TEMPLATES.evidence,
  STAMP_TEMPLATES.custom,
];

/** 解析 stamp 字段，缺失时根据 name 在 STAMP_TEMPLATES 兜底填充 */
export function resolveStampTemplate(stamp: PdfAnnotationStamp | undefined, name: PdfStampName): StampTemplate & {
  label: string;
  color: string;
} {
  const template = STAMP_TEMPLATES[name];
  const label = stamp?.label?.trim() || template.defaultLabel;
  return {
    ...template,
    label,
    color: template.defaultColor,
  };
}

export interface RenderStampOptions {
  /** 图章占位宽，render 会按 4:1 的 viewBox 等比缩放 */
  width: number;
  height: number;
  color?: string;
  label?: string;
}

/**
 * 渲染一个图章的 SVG 字符串（不包含外层 <svg>），可用于 React dangerouslySetInnerHTML
 * 或 innerHTML 注入。viewBox 固定为 0 0 400 100。
 */
export function renderStampSvg(name: PdfStampName, options: RenderStampOptions): string {
  const template = STAMP_TEMPLATES[name];
  const color = options.color || template.defaultColor;
  const label = options.label?.trim() || template.defaultLabel;

  switch (template.shape) {
    case "rectangle":
      return renderRectangleStamp(label, color);
    case "rounded":
      return renderRoundedStamp(label, color);
    case "ellipse":
      return renderEllipseStamp(label, color);
    case "banner":
      return renderBannerStamp(label, color);
    default:
      return renderRectangleStamp(label, color);
  }
}

function renderRectangleStamp(label: string, color: string): string {
  return [
    `<rect x="6" y="6" width="388" height="88" fill="none" stroke="${color}" stroke-width="6" rx="2" ry="2"/>`,
    `<rect x="14" y="14" width="372" height="72" fill="none" stroke="${color}" stroke-width="1.5"/>`,
    `<text x="200" y="64" font-family="serif" font-size="44" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="6">${escapeXml(label)}</text>`,
  ].join("");
}

function renderRoundedStamp(label: string, color: string): string {
  return [
    `<rect x="8" y="8" width="384" height="84" fill="none" stroke="${color}" stroke-width="6" rx="14" ry="14"/>`,
    `<text x="200" y="64" font-family="serif" font-size="44" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="4">${escapeXml(label)}</text>`,
  ].join("");
}

function renderEllipseStamp(label: string, color: string): string {
  return [
    `<ellipse cx="200" cy="50" rx="190" ry="44" fill="none" stroke="${color}" stroke-width="6"/>`,
    `<ellipse cx="200" cy="50" rx="178" ry="32" fill="none" stroke="${color}" stroke-width="1.5"/>`,
    `<text x="200" y="64" font-family="serif" font-size="40" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="4">${escapeXml(label)}</text>`,
  ].join("");
}

function renderBannerStamp(label: string, color: string): string {
  return [
    `<path d="M14 14 L386 14 L386 86 L14 86 Z M386 14 L350 50 L386 86 M14 14 L50 50 L14 86" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="miter"/>`,
    `<text x="200" y="64" font-family="serif" font-size="40" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="4">${escapeXml(label)}</text>`,
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 图章模板缩略图统一 viewBox 尺寸（与 renderStampSvg 保持一致以便 preview 与正图同比例） */
export const STAMP_PREVIEW_VIEWBOX_WIDTH = 400;
export const STAMP_PREVIEW_VIEWBOX_HEIGHT = 100;
/** preview 默认色：未指定时回退到 template.defaultColor */
export const DEFAULT_STAMP_PREVIEW_WIDTH = 120;
export const DEFAULT_STAMP_PREVIEW_HEIGHT = 30;

export interface RenderStampPreviewOptions {
  /** 预览图章占位宽（CSS 像素） */
  width?: number;
  /** 预览图章占位高（CSS 像素） */
  height?: number;
  /** 自定义文字（缺省回退到 template.defaultLabel） */
  label?: string;
  /** 自定义颜色（缺省回退到 template.defaultColor） */
  color?: string;
}

/**
 * 渲染一个图章模板的「预览 SVG」字符串（不含外层 <svg>）。
 *
 * 与 renderStampSvg 的区别：
 * - renderStampSvg 是用于 PDF 内 drawText/drawRectangle 的"工程绘制"，文字与边框皆为 PDF 操作；
 * - renderStampPreview 是为工具条 / 模板选择面板提供视觉预览，使用与正图完全相同的 viewBox
 *   (0 0 400 100) 和几何参数（rectangle / rounded / ellipse / banner），但额外
 *   把字号按比例缩到 0.55×，让 120×30 CSS 像素的缩略图也能保持"印章感"。
 *
 * 同步在 stamps.test.ts 验证 shape × 默认 label 4×4 矩阵。
 */
export function renderStampPreview(name: PdfStampName, options: RenderStampPreviewOptions = {}): string {
  const template = STAMP_TEMPLATES[name];
  const color = options.color || template.defaultColor;
  const label = options.label?.trim() || template.defaultLabel;
  // 字号缩放因子：原图 44pt 在 100pt viewBox 高度下近乎满版；preview 缩到 0.55×
  const fontSize = 24;
  const letterSpacing = Math.max(2, Math.round((template.shape === "rectangle" ? 6 : 4) * 0.55));
  const safeLabel = escapeXml(label);
  const safeColor = escapeXml(color);

  switch (template.shape) {
    case "rectangle":
      return [
        `<rect x="6" y="6" width="388" height="88" fill="none" stroke="${safeColor}" stroke-width="6" rx="2" ry="2"/>`,
        `<rect x="14" y="14" width="372" height="72" fill="none" stroke="${safeColor}" stroke-width="1.5"/>`,
        `<text x="200" y="62" font-family="serif" font-size="${fontSize}" font-weight="700" fill="${safeColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${safeLabel}</text>`,
      ].join("");
    case "rounded":
      return [
        `<rect x="8" y="8" width="384" height="84" fill="none" stroke="${safeColor}" stroke-width="6" rx="14" ry="14"/>`,
        `<text x="200" y="62" font-family="serif" font-size="${fontSize}" font-weight="700" fill="${safeColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${safeLabel}</text>`,
      ].join("");
    case "ellipse":
      return [
        `<ellipse cx="200" cy="50" rx="190" ry="44" fill="none" stroke="${safeColor}" stroke-width="6"/>`,
        `<ellipse cx="200" cy="50" rx="178" ry="32" fill="none" stroke="${safeColor}" stroke-width="1.5"/>`,
        `<text x="200" y="62" font-family="serif" font-size="${fontSize - 4}" font-weight="700" fill="${safeColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${safeLabel}</text>`,
      ].join("");
    case "banner":
      return [
        `<path d="M14 14 L386 14 L386 86 L14 86 Z M386 14 L350 50 L386 86 M14 14 L50 50 L14 86" fill="none" stroke="${safeColor}" stroke-width="6" stroke-linejoin="miter"/>`,
        `<text x="200" y="62" font-family="serif" font-size="${fontSize - 4}" font-weight="700" fill="${safeColor}" text-anchor="middle" letter-spacing="${letterSpacing}">${safeLabel}</text>`,
      ].join("");
    default:
      return renderRectangleStamp(label, color);
  }
}
