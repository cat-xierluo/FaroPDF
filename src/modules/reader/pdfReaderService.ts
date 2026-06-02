import type { ReaderByteLoadInput, ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PdfPageViewport, TextLayerStatus } from "../../shared/pdf/types";
import { configurePdfjsWorker } from "./pdfjsWorker";

type PdfJsDist = typeof import("pdfjs-dist");
type PdfDocumentInit = NonNullable<Parameters<PdfJsDist["getDocument"]>[0]>;

interface PdfJsViewportLike {
  width: number;
  height: number;
  rotation?: number;
}

interface PdfJsTextContentLike {
  items?: unknown[];
}

interface PdfJsPageLike {
  rotate: number;
  getViewport(params: { scale: number }): PdfJsViewportLike;
  getTextContent?: () => Promise<PdfJsTextContentLike>;
}

interface PdfJsDocumentLike {
  numPages: number;
  fingerprints?: Array<string | null>;
  getPage(pageNumber: number): Promise<PdfJsPageLike>;
}

interface PdfJsLoadingTaskLike {
  promise: Promise<PdfJsDocumentLike>;
  destroy?: () => Promise<void>;
}

export interface PdfJsReaderAdapter {
  configureWorker: () => string | Promise<string>;
  getDocument: (params: PdfDocumentInit) => PdfJsLoadingTaskLike | Promise<PdfJsLoadingTaskLike>;
}

export interface LoadedPdfDocument {
  metadata: ReaderLoadedMetadata;
  getPageViewport: (pageIndex: number, scale?: number) => Promise<PdfPageViewport>;
  getPageText: (pageIndex: number) => Promise<PdfPageText>;
  destroy: () => Promise<void>;
}

const defaultAdapter: PdfJsReaderAdapter = {
  configureWorker: configurePdfjsWorker,
  getDocument: async (params) => {
    const { getDocument } = await import("pdfjs-dist");
    return getDocument(params) as unknown as PdfJsLoadingTaskLike;
  },
};

function normalizeRotation(rotation: number): PdfPageViewport["rotation"] {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  return 0;
}

async function readTextLayerStatus(page: PdfJsPageLike): Promise<TextLayerStatus> {
  if (!page.getTextContent) {
    return "unknown";
  }

  try {
    const textContent = await page.getTextContent();
    return extractTextItems(textContent).length > 0 ? "available" : "missing";
  } catch {
    return "unknown";
  }
}

async function readPageViewport(document: PdfJsDocumentLike, pageIndex: number, scale = 1): Promise<PdfPageViewport> {
  const page = await document.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    rotation: normalizeRotation(viewport.rotation ?? page.rotate),
    scale,
  };
}

async function readPageText(document: PdfJsDocumentLike, pageIndex: number): Promise<PdfPageText> {
  const page = await document.getPage(pageIndex + 1);

  if (!page.getTextContent) {
    return {
      pageIndex,
      text: "",
      status: "unknown",
      itemCount: 0,
      charCount: 0,
    };
  }

  try {
    const textItems = extractTextItems(await page.getTextContent());
    const text = textItems.join("");

    return {
      pageIndex,
      text,
      status: textItems.length > 0 && text.length > 0 ? "available" : "missing",
      itemCount: textItems.length,
      charCount: text.length,
    };
  } catch {
    return {
      pageIndex,
      text: "",
      status: "unknown",
      itemCount: 0,
      charCount: 0,
    };
  }
}

function extractTextItems(textContent: PdfJsTextContentLike) {
  return (textContent.items ?? [])
    .map((item) => {
      if (typeof item === "object" && item !== null && "str" in item && typeof item.str === "string") {
        return item.str;
      }

      return "";
    })
    .filter((text) => text.length > 0);
}

export async function loadPdfFromBytes(
  input: ReaderByteLoadInput,
  adapter: PdfJsReaderAdapter = defaultAdapter,
): Promise<LoadedPdfDocument> {
  await adapter.configureWorker();
  const loadingTask = await adapter.getDocument({ data: input.data });
  const document = await loadingTask.promise;
  const firstPage = await document.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const initialViewport: PdfPageViewport = {
    pageIndex: 0,
    width: firstViewport.width,
    height: firstViewport.height,
    rotation: normalizeRotation(firstViewport.rotation ?? firstPage.rotate),
    scale: 1,
  };
  const textLayerStatus = await readTextLayerStatus(firstPage);

  return {
    metadata: {
      fileName: input.fileName,
      filePath: input.filePath,
      fingerprint: document.fingerprints?.[0] ?? undefined,
      pageCount: document.numPages,
      initialViewport,
      textLayerStatus,
    },
    getPageViewport: (pageIndex, scale = 1) => readPageViewport(document, pageIndex, scale),
    getPageText: (pageIndex) => readPageText(document, pageIndex),
    destroy: () => loadingTask.destroy?.() ?? Promise.resolve(),
  };
}

export async function loadPdfFromFile(
  file: File,
  adapter: PdfJsReaderAdapter = defaultAdapter,
): Promise<LoadedPdfDocument> {
  const data = new Uint8Array(await file.arrayBuffer());

  return loadPdfFromBytes(
    {
      data,
      fileName: file.name,
    },
    adapter,
  );
}
