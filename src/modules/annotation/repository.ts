import type { AnnotationDocumentRef, AnnotationSidecar, PdfAnnotation } from "../../shared/pdf/annotation";
import {
  buildAnnotationSidecar,
  buildSidecarDocumentRef,
  deriveAnnotationSidecarPath,
  parseAnnotationSidecar,
  serializeAnnotationSidecar,
  sortAnnotations,
  validateAnnotationSidecar,
} from "./sidecar";

export interface AnnotationStorage {
  readText(path: string): Promise<string | undefined>;
  writeText(path: string, content: string): Promise<void>;
}

interface AnnotationRepositoryOptions {
  storage: AnnotationStorage;
  now?: () => string;
}

export class AnnotationRepository {
  private readonly storage: AnnotationStorage;
  private readonly now: () => string;

  constructor(options: AnnotationRepositoryOptions) {
    this.storage = options.storage;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  getSidecarPath(document: AnnotationDocumentRef): string {
    return deriveAnnotationSidecarPath(document);
  }

  async load(document: AnnotationDocumentRef): Promise<AnnotationSidecar> {
    const sidecarPath = this.getSidecarPath(document);
    const content = await this.storage.readText(sidecarPath);

    if (content === undefined) {
      return buildAnnotationSidecar({
        document,
        now: this.now(),
      });
    }

    return parseAnnotationSidecar(content);
  }

  async save(document: AnnotationDocumentRef, sidecar: AnnotationSidecar): Promise<AnnotationSidecar> {
    const nextSidecar = validateAnnotationSidecar({
      ...sidecar,
      document: buildSidecarDocumentRef(document),
      annotations: sortAnnotations(sidecar.annotations),
      updatedAt: this.now(),
    });
    const sidecarPath = this.getSidecarPath(document);

    await this.storage.writeText(sidecarPath, serializeAnnotationSidecar(nextSidecar));

    return nextSidecar;
  }

  async replaceAnnotations(document: AnnotationDocumentRef, annotations: PdfAnnotation[]): Promise<AnnotationSidecar> {
    const sidecar = await this.load(document);

    return this.save(document, {
      ...sidecar,
      annotations,
    });
  }
}

export function createMemoryAnnotationStorage(initialFiles?: Record<string, string>): AnnotationStorage & {
  files: Map<string, string>;
} {
  const files = new Map<string, string>(Object.entries(initialFiles ?? {}));

  return {
    files,
    async readText(path: string) {
      return files.get(path);
    },
    async writeText(path: string, content: string) {
      files.set(path, content);
    },
  };
}
