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
  /** ISS-NEW-D 前往浏览历史栈（DEC-171）：最近访问的 page 列表，按 reverse chronological order，
   * 不含当前页。上限 50 防 unbounded growth。
   * 测试 fixture 可省略（默认视为 []）。 */
  history?: number[];
  errorMessage?: string;
  /**
   * ISS-NEW-M M5：加密 PDF 打开时进入「等待密码」中间态。
   * `reason` 对齐 PDF.js PasswordResponses：1 = NEED_PASSWORD（未提供密码），
   * 2 = INCORRECT_PASSWORD（密码错误）。UI 据此渲染密码输入框与提示；未进入该态时为 undefined。
   * status 保持 loading，仅当 passwordChallenge 存在时 UI 优先渲染密码输入而非错误卡片。
   */
  passwordChallenge?: { reason: number };
  defaults: {
    zoom: number;
    viewMode: PdfViewMode;
  };
}

export type ReaderAction =
  | { type: "reader/loadStarted"; payload: { fileName: string } }
  | { type: "reader/loadSucceeded"; payload: { documentId: string; metadata: ReaderLoadedMetadata } }
  | { type: "reader/loadFailed"; payload: { errorMessage: string } }
  | { type: "reader/passwordPrompt"; payload: { reason: number } }
  | { type: "reader/passwordCancel" }
  | { type: "reader/setCurrentPage"; payload: { currentPage: number; skipHistoryPush?: boolean } }
  | { type: "reader/setZoom"; payload: { zoom: number } }
  | { type: "reader/setViewMode"; payload: { viewMode: PdfViewMode } }
  | { type: "reader/setRotation"; payload: { rotation: PageRotation } }
  | { type: "reader/rotate"; payload: { direction: "clockwise" | "counter-clockwise" } }
  | { type: "reader/applySession"; payload: { session: ReaderSession } }
  | { type: "reader/setTextLayerStatus"; payload: { textLayerStatus: TextLayerStatus } }
  | { type: "reader/goBack" }
  | { type: "reader/clearHistory" };

export interface ReaderStateDefaults {
  defaultZoom?: number;
  defaultViewMode?: PdfViewMode;
}

const HISTORY_LIMIT = 50;

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
    history: [],
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
        passwordChallenge: undefined,
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

      // ISS-NEW-D 前往浏览历史栈（DEC-171）：新文档加载清空历史栈，避免跨文档串台。
      return {
        ...state,
        status: "ready",
        document,
        pageViewports: [metadata.initialViewport],
        renderRange: updateRenderRange(document),
        history: [],
        errorMessage: undefined,
        passwordChallenge: undefined,
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
        passwordChallenge: undefined,
      };
    case "reader/passwordPrompt":
      // 加密 PDF：保留 status=loading 语义（文档仍在尝试打开），UI 据此渲染密码输入。
      return {
        ...state,
        passwordChallenge: { reason: action.payload.reason },
        errorMessage: undefined,
      };
    case "reader/passwordCancel":
      // 用户放弃输入密码：回到 error 态，提示需要密码。
      return {
        ...state,
        status: "error",
        passwordChallenge: undefined,
        document: null,
        pageViewports: [],
        errorMessage: "已取消密码输入，无法打开加密 PDF。",
      };
    case "reader/setCurrentPage": {
      if (!state.document) {
        return state;
      }

      const newPage = clampPage(action.payload.currentPage, state.document.pageCount);
      if (newPage === state.document.currentPage) {
        return state;
      }

      const oldPage = state.document.currentPage;
      const document = { ...state.document, currentPage: newPage };

      // ISS-NEW-D 前往浏览历史栈（DEC-171）：跳页前把旧页 push 到 history 顶部。
      // goToHistory 等「直接跳到历史项」场景传 skipHistoryPush=true，避免循环。
      const newHistory = action.payload.skipHistoryPush
        ? (state.history ?? [])
        : [oldPage, ...(state.history ?? [])].slice(0, HISTORY_LIMIT);

      return { ...state, document, history: newHistory, renderRange: updateRenderRange(document) };
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
    case "reader/goBack": {
      // ISS-NEW-D 前往浏览历史栈（DEC-171）：弹 history[0] 作为新 currentPage；
      // 不再 push（避免循环）。
      if (!state.document || !state.history || state.history.length === 0) {
        return state;
      }
      const [previousPage, ...rest] = state.history;
      const document = {
        ...state.document,
        currentPage: clampPage(previousPage, state.document.pageCount),
      };
      return { ...state, document, history: rest, renderRange: updateRenderRange(document) };
    }
    case "reader/clearHistory": {
      return { ...state, history: [] };
    }
    default:
      return state;
  }
}
