export const PDF_ANNOTATION_TYPES = [
  "highlight",
  "underline",
  "strikeout",
  "note",
  "textbox",
  "rectangle",
  "arrow",
  "ink",
  "stamp",
] as const;

export type PdfAnnotationType = (typeof PDF_ANNOTATION_TYPES)[number];

export interface PdfPoint {
  x: number;
  y: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfAnnotationAuthor {
  id?: string;
  displayName?: string;
}

export interface PdfAnnotationStyle {
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fillColor?: string;
}

export interface PdfAnnotationLine {
  start: PdfPoint;
  end: PdfPoint;
}

export interface PdfAnnotationInk {
  strokes: PdfPoint[][];
}

/** 标准 PDF 图章模板集合 v0.2：扩到 8 个常用印章。v0.1 仅有 5 个。 */
export type PdfStampName =
  | "reviewed"
  | "important"
  | "todo"
  | "evidence"
  | "forReview"
  | "notForDistribution"
  | "internalOnly"
  | "proprietary"
  | "custom";

export const PDF_STAMP_NAMES: PdfStampName[] = [
  "reviewed",
  "important",
  "todo",
  "evidence",
  "forReview",
  "notForDistribution",
  "internalOnly",
  "proprietary",
  "custom",
];

/**
 * 图章视觉形态。
 * - rectangle / rounded / ellipse / banner 已有
 * - diagonal 是 v0.2 新增的「对角斜条带」形态（左侧下 → 右侧上），
 *   模拟"NOT FOR DISTRIBUTION" / "FOR REVIEW ONLY" 常用的带状对角印章。
 */
export type PdfStampShape =
  | "rectangle"
  | "rounded"
  | "ellipse"
  | "banner"
  | "diagonal";

export interface PdfAnnotationStamp {
  label: string;
  name: PdfStampName;
  /** 自定义图章的 base64 资源或 URL；非 custom 模板可为空。 */
  image?: string;
}

export interface PdfAnnotation {
  id: string;
  type: PdfAnnotationType;
  pageIndex: number;
  rects: PdfRect[];
  color: string;
  opacity?: number;
  content?: string;
  quote?: string;
  author?: PdfAnnotationAuthor;
  style?: PdfAnnotationStyle;
  line?: PdfAnnotationLine;
  ink?: PdfAnnotationInk;
  stamp?: PdfAnnotationStamp;
  createdAt: string;
  updatedAt: string;
}

export interface PdfAnnotationInput {
  type: PdfAnnotationType;
  pageIndex: number;
  rects: PdfRect[];
  color: string;
  opacity?: number;
  content?: string;
  quote?: string;
  author?: PdfAnnotationAuthor;
  style?: PdfAnnotationStyle;
  line?: PdfAnnotationLine;
  ink?: PdfAnnotationInk;
  stamp?: PdfAnnotationStamp;
}

export type PdfAnnotationPatch = Partial<Omit<PdfAnnotationInput, "type">> & {
  type?: PdfAnnotationType;
};

export interface AnnotationDocumentRef {
  path: string;
  fingerprint?: string;
  pageCount?: number;
}

export interface AnnotationSidecarDocumentRef {
  fingerprint?: string;
  pageCount?: number;
}

export interface AnnotationSidecar {
  schemaVersion: number;
  document: AnnotationSidecarDocumentRef;
  annotations: PdfAnnotation[];
  createdAt: string;
  updatedAt: string;
}
