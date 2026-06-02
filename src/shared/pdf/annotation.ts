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

export type PdfStampName = "reviewed" | "important" | "todo" | "evidence" | "custom";
export const PDF_STAMP_NAMES: PdfStampName[] = ["reviewed", "important", "todo", "evidence", "custom"];

export interface PdfAnnotationStamp {
  label: string;
  name: PdfStampName;
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
