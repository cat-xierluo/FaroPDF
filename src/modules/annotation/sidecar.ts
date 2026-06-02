import {
  PDF_ANNOTATION_TYPES,
  type AnnotationDocumentRef,
  type AnnotationSidecar,
  type AnnotationSidecarDocumentRef,
  type PdfAnnotation,
  type PdfAnnotationType,
  type PdfRect,
} from "../../shared/pdf/annotation";

export const ANNOTATION_SIDECAR_SCHEMA_VERSION = 1;

interface BuildAnnotationSidecarOptions {
  document: AnnotationDocumentRef;
  annotations?: PdfAnnotation[];
  now?: string;
}

export function deriveAnnotationSidecarPath(document: AnnotationDocumentRef): string {
  const directory = getDocumentDirectory(document.path);
  const documentKey = document.fingerprint
    ? sanitizePathToken(document.fingerprint)
    : `path-${hashPath(document.path)}`;

  return `${directory}/.faropdf/annotations/${documentKey}.annotations.json`;
}

export function buildAnnotationSidecar(options: BuildAnnotationSidecarOptions): AnnotationSidecar {
  const now = options.now ?? new Date().toISOString();

  return {
    schemaVersion: ANNOTATION_SIDECAR_SCHEMA_VERSION,
    document: buildSidecarDocumentRef(options.document),
    annotations: sortAnnotations(options.annotations ?? []),
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeAnnotationSidecar(sidecar: AnnotationSidecar): string {
  return `${JSON.stringify(
    {
      ...sidecar,
      annotations: sortAnnotations(sidecar.annotations),
    },
    null,
    2,
  )}\n`;
}

export function parseAnnotationSidecar(json: string): AnnotationSidecar {
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch (error) {
    throw Object.assign(new Error(`Invalid annotation sidecar JSON: ${getErrorMessage(error)}`), { cause: error });
  }

  if (!isRecord(value)) {
    throw new Error("Invalid annotation sidecar: expected object");
  }

  if (value.schemaVersion !== ANNOTATION_SIDECAR_SCHEMA_VERSION) {
    throw new Error("Unsupported annotation sidecar schema version");
  }

  const document = readDocumentRef(value.document);
  const annotations = readAnnotations(value.annotations);
  const createdAt = readString(value.createdAt, "createdAt");
  const updatedAt = readString(value.updatedAt, "updatedAt");

  return {
    schemaVersion: ANNOTATION_SIDECAR_SCHEMA_VERSION,
    document,
    annotations: sortAnnotations(annotations),
    createdAt,
    updatedAt,
  };
}

export function buildSidecarDocumentRef(document: AnnotationDocumentRef): AnnotationSidecarDocumentRef {
  return {
    ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
    ...(typeof document.pageCount === "number" ? { pageCount: document.pageCount } : {}),
  };
}

export function sortAnnotations(annotations: PdfAnnotation[]): PdfAnnotation[] {
  return [...annotations].sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }

    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt.localeCompare(right.updatedAt);
    }

    return left.id.localeCompare(right.id);
  });
}

function getDocumentDirectory(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const separatorIndex = normalizedPath.lastIndexOf("/");

  if (separatorIndex <= 0) {
    return ".";
  }

  return normalizedPath.slice(0, separatorIndex);
}

function sanitizePathToken(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "document";
}

function hashPath(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function readDocumentRef(value: unknown): AnnotationSidecarDocumentRef {
  if (!isRecord(value)) {
    throw new Error("Invalid annotation sidecar: document must be an object");
  }

  const document: AnnotationSidecarDocumentRef = {};

  if (typeof value.fingerprint === "string") {
    document.fingerprint = value.fingerprint;
  }

  if (typeof value.pageCount === "number") {
    document.pageCount = value.pageCount;
  }

  return document;
}

function readAnnotations(value: unknown): PdfAnnotation[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid annotation sidecar: annotations must be an array");
  }

  return value.map(readAnnotation);
}

function readAnnotation(value: unknown): PdfAnnotation {
  if (!isRecord(value)) {
    throw new Error("Invalid annotation sidecar: annotation must be an object");
  }

  const type = readAnnotationType(value.type);
  const rects = readRects(value.rects);

  return {
    id: readString(value.id, "annotation.id"),
    type,
    pageIndex: readNonNegativeInteger(value.pageIndex, "annotation.pageIndex"),
    rects,
    color: readString(value.color, "annotation.color"),
    ...(typeof value.opacity === "number" ? { opacity: value.opacity } : {}),
    ...(typeof value.content === "string" ? { content: value.content } : {}),
    ...(typeof value.quote === "string" ? { quote: value.quote } : {}),
    ...(isRecord(value.author) ? { author: value.author } : {}),
    ...(isRecord(value.style) ? { style: value.style } : {}),
    ...(isRecord(value.line) ? { line: value.line } : {}),
    ...(isRecord(value.ink) ? { ink: value.ink } : {}),
    ...(isRecord(value.stamp) ? { stamp: value.stamp } : {}),
    createdAt: readString(value.createdAt, "annotation.createdAt"),
    updatedAt: readString(value.updatedAt, "annotation.updatedAt"),
  } as PdfAnnotation;
}

function readAnnotationType(value: unknown): PdfAnnotationType {
  if (typeof value === "string" && PDF_ANNOTATION_TYPES.includes(value as PdfAnnotationType)) {
    return value as PdfAnnotationType;
  }

  throw new Error("Invalid annotation sidecar: unsupported annotation type");
}

function readRects(value: unknown): PdfRect[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid annotation sidecar: annotation.rects must be an array");
  }

  return value.map((rect) => {
    if (!isRecord(rect)) {
      throw new Error("Invalid annotation sidecar: annotation rect must be an object");
    }

    return {
      x: readNumber(rect.x, "rect.x"),
      y: readNumber(rect.y, "rect.y"),
      width: readNumber(rect.width, "rect.width"),
      height: readNumber(rect.height, "rect.height"),
    };
  });
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid annotation sidecar: ${fieldName} must be a string`);
  }

  return value;
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid annotation sidecar: ${fieldName} must be a number`);
  }

  return value;
}

function readNonNegativeInteger(value: unknown, fieldName: string): number {
  const number = readNumber(value, fieldName);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid annotation sidecar: ${fieldName} must be a non-negative integer`);
  }

  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
