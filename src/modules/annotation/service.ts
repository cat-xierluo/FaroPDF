import type {
  AnnotationDocumentRef,
  PdfAnnotation,
  PdfAnnotationInput,
  PdfAnnotationPatch,
} from "../../shared/pdf/annotation";
import { sortAnnotations } from "./sidecar";
import type { AnnotationRepository } from "./repository";
import { buildAnnotationSummary } from "./summary";

interface AnnotationServiceOptions {
  repository: AnnotationRepository;
  createId?: () => string;
  now?: () => string;
}

export class AnnotationService {
  private readonly repository: AnnotationRepository;
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(options: AnnotationServiceOptions) {
    this.repository = options.repository;
    this.createId = options.createId ?? createDefaultAnnotationId;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async addAnnotation(document: AnnotationDocumentRef, input: PdfAnnotationInput): Promise<PdfAnnotation> {
    const timestamp = this.now();
    const annotation: PdfAnnotation = {
      ...input,
      id: this.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const sidecar = await this.repository.load(document);

    await this.repository.save(document, {
      ...sidecar,
      annotations: [...sidecar.annotations, annotation],
    });

    return annotation;
  }

  async updateAnnotation(
    document: AnnotationDocumentRef,
    annotationId: string,
    patch: PdfAnnotationPatch,
  ): Promise<PdfAnnotation> {
    const sidecar = await this.repository.load(document);
    const existingAnnotation = sidecar.annotations.find((annotation) => annotation.id === annotationId);

    if (!existingAnnotation) {
      throw new Error(`Annotation not found: ${annotationId}`);
    }

    const updatedAnnotation: PdfAnnotation = {
      ...existingAnnotation,
      ...patch,
      id: existingAnnotation.id,
      createdAt: existingAnnotation.createdAt,
      updatedAt: this.now(),
    };
    const annotations = sidecar.annotations.map((annotation) =>
      annotation.id === annotationId ? updatedAnnotation : annotation,
    );

    await this.repository.save(document, {
      ...sidecar,
      annotations,
    });

    return updatedAnnotation;
  }

  async deleteAnnotation(document: AnnotationDocumentRef, annotationId: string): Promise<boolean> {
    const sidecar = await this.repository.load(document);
    const annotations = sidecar.annotations.filter((annotation) => annotation.id !== annotationId);

    if (annotations.length === sidecar.annotations.length) {
      return false;
    }

    await this.repository.save(document, {
      ...sidecar,
      annotations,
    });

    return true;
  }

  async listAnnotations(document: AnnotationDocumentRef): Promise<PdfAnnotation[]> {
    const sidecar = await this.repository.load(document);

    return sortAnnotations(sidecar.annotations);
  }

  async buildSummary(document: AnnotationDocumentRef, exportedAt = this.now()) {
    return buildAnnotationSummary({
      document,
      annotations: await this.listAnnotations(document),
      exportedAt,
    });
  }
}

function createDefaultAnnotationId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `ann-${globalThis.crypto.randomUUID()}`;
  }

  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
