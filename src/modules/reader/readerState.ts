import type { ReaderLoadedMetadata } from "../../shared/pdf/reader";
import type {
  PageRotation,
  PdfDocumentState,
  PdfPageViewport,
  PdfViewMode,
  ReaderSession,
  TextLayerStatus,
} from "../../shared/pdf/types";
import { calculateReaderRenderRange, type ReaderRenderRange } from "./virtualization";

export type ReaderStatus = "idle" | "loading" | "ready" | "error";

export interface ReaderState {
  status: ReaderStatus;
  document: PdfDocumentState | null;
  pageViewports: PdfPageViewport[];
  renderRange: ReaderRenderRange;
  errorMessage?: string;
  defaults: {
    zoom: number;
    viewMode: PdfViewMode;
  };
}

export type ReaderAction =
  | { type: "reader/loadStarted"; payload: { fileName: string } }
  | { type: "reader/loadSucceeded"; payload: { documentId: string; metadata: ReaderLoadedMetadata } }
  | { type: "reader/loadFailed"; payload: { errorMessage: string } }
  | { type: "reader/setCurrentPage"; payload: { currentPage: number } }
  | { type: "reader/setZoom"; payload: { zoom: number } }
  | { type: "reader/setViewMode"; payload: { viewMode: PdfViewMode } }
  | { type: "reader/setRotation"; payload: { rotation: PageRotation } }
  | { type: "reader/rotate"; payload: { direction: "clockwise" | "counter-clockwise" } }
  | { type: "reader/applySession"; payload: { session: ReaderSession } }
  | { type: "reader/setTextLayerStatus"; payload: { textLayerStatus: TextLayerStatus } };

export interface ReaderStateDefaults {
  defaultZoom?: number;
  defaultViewMode?: PdfViewMode;
}

export function createInitialReaderState({
  defaultZoom = 1,
  defaultViewMode = "continuous",
}: ReaderStateDefaults = {}): ReaderState {
  return {
    status: "idle",
    document: null,
    pageViewports: [],
    renderRange: calculateReaderRenderRange({
      pageCount: 0,
      currentPage: 1,
      viewMode: defaultViewMode,
    }),
    defaults: {
      zoom: defaultZoom,
      viewMode: defaultViewMode,
    },
  };
}

function clampPage(currentPage: number, pageCount: number) {
  return Math.min(Math.max(Math.trunc(currentPage), 1), Math.max(pageCount, 1));
}

function clampZoom(zoom: number) {
  return Math.min(Math.max(zoom, 0.25), 4);
}

function rotateBy(currentRotation: PageRotation, direction: "clockwise" | "counter-clockwise"): PageRotation {
  const step = direction === "clockwise" ? 90 : -90;
  const next = ((currentRotation + step) % 360 + 360) % 360;
  return next as PageRotation;
}

function updateRenderRange(document: PdfDocumentState | null): ReaderRenderRange {
  return calculateReaderRenderRange({
    pageCount: document?.pageCount ?? 0,
    currentPage: document?.currentPage ?? 1,
    viewMode: document?.viewMode ?? "continuous",
  });
}

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "reader/loadStarted":
      return {
        ...state,
        status: "loading",
        errorMessage: undefined,
        document: null,
        pageViewports: [],
        renderRange: calculateReaderRenderRange({
          pageCount: 0,
          currentPage: 1,
          viewMode: state.defaults.viewMode,
        }),
      };
    case "reader/loadSucceeded": {
      const { documentId, metadata } = action.payload;
      const document: PdfDocumentState = {
        documentId,
        path: metadata.filePath ?? "",
        name: metadata.fileName,
        fingerprint: metadata.fingerprint,
        pageCount: metadata.pageCount,
        currentPage: 1,
        zoom: state.defaults.zoom,
        viewMode: state.defaults.viewMode,
        rotation: 0,
        dirty: false,
        textLayerStatus: metadata.textLayerStatus,
        ocrStatus: metadata.textLayerStatus === "missing" ? "needed" : "not-needed",
      };

      return {
        ...state,
        status: "ready",
        document,
        pageViewports: [metadata.initialViewport],
        renderRange: updateRenderRange(document),
        errorMessage: undefined,
      };
    }
    case "reader/loadFailed":
      return {
        ...state,
        status: "error",
        document: null,
        pageViewports: [],
        renderRange: calculateReaderRenderRange({
          pageCount: 0,
          currentPage: 1,
          viewMode: state.defaults.viewMode,
        }),
        errorMessage: action.payload.errorMessage,
      };
    case "reader/setCurrentPage": {
      if (!state.document) {
        return state;
      }

      const document = {
        ...state.document,
        currentPage: clampPage(action.payload.currentPage, state.document.pageCount),
      };

      return { ...state, document, renderRange: updateRenderRange(document) };
    }
    case "reader/setZoom": {
      if (!state.document) {
        return state;
      }

      const document = {
        ...state.document,
        zoom: clampZoom(action.payload.zoom),
      };

      return { ...state, document };
    }
    case "reader/setViewMode": {
      if (!state.document) {
        return state;
      }

      const document = {
        ...state.document,
        viewMode: action.payload.viewMode,
      };

      return { ...state, document, renderRange: updateRenderRange(document) };
    }
    case "reader/setRotation": {
      if (!state.document) {
        return state;
      }

      return {
        ...state,
        document: { ...state.document, rotation: action.payload.rotation },
      };
    }
    case "reader/rotate": {
      if (!state.document) {
        return state;
      }

      return {
        ...state,
        document: { ...state.document, rotation: rotateBy(state.document.rotation, action.payload.direction) },
      };
    }
    case "reader/applySession": {
      if (!state.document) {
        return state;
      }
      const { session } = action.payload;
      // 仅当 fingerprint 匹配才应用，防止跨文档串台
      if (state.document.fingerprint && state.document.fingerprint !== session.fingerprint) {
        return state;
      }

      const document = {
        ...state.document,
        currentPage: clampPage(session.currentPage, state.document.pageCount),
        zoom: clampZoom(session.zoom),
        viewMode: session.viewMode,
        rotation: session.rotation,
      };

      return { ...state, document, renderRange: updateRenderRange(document) };
    }
    case "reader/setTextLayerStatus": {
      if (!state.document) {
        return state;
      }

      return {
        ...state,
        document: {
          ...state.document,
          textLayerStatus: action.payload.textLayerStatus,
          ocrStatus: action.payload.textLayerStatus === "missing" ? "needed" : state.document.ocrStatus,
        },
      };
    }
    default:
      return state;
  }
}
