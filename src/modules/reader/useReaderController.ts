import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { AppSettings } from "../../shared/settings/types";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PageRotation, PdfViewMode, ReaderSession, ZoomPresetId } from "../../shared/pdf/types";
import { loadPdfFromBytes, loadPdfFromFile, type LoadedPdfDocument } from "./pdfReaderService";
import { normalizeError } from "../../shared/error";
import { friendlyMessageForCode } from "../../shared/errorMessages";

/**
 * ISS-NEW-M M5：识别 PDF.js 密码异常。
 * PDF.js PasswordException 带 name="PasswordException" + code（1=NEED, 2=INCORRECT）。
 * 命中返回 reason，否则 null（交由通用错误归一化处理，如损坏 PDF）。
 */
function readPasswordReason(error: unknown): number | null {
  if (error instanceof Error && error.name === "PasswordException") {
    const code = (error as Error & { code?: number }).code;
    return typeof code === "number" ? code : 1;
  }
  return null;
}
import {
  createDefaultReaderSessionStorage,
  type ReaderSessionStorage,
} from "./readerSessionStorage";
import { createInitialReaderState, readerReducer } from "./readerState";
import { applyZoomPresetId, clampZoom } from "./viewMode";

interface CachedFile {
  name: string;
  bytesPromise: Promise<Uint8Array>;
}

interface NativeReaderFile {
  bytes: Uint8Array;
  name: string;
  path: string;
}

export interface UseReaderControllerOptions {
  /** 注入 session 存储；测试时可传内存版 */
  sessionStorage?: ReaderSessionStorage;
}

export function useReaderController(settings: AppSettings, options: UseReaderControllerOptions = {}) {
  const loadedDocumentRef = useRef<LoadedPdfDocument | null>(null);
  const cachedFileRef = useRef<CachedFile | null>(null);
  const loadRequestIdRef = useRef(0);
  const sessionStorageRef = useRef<ReaderSessionStorage>(options.sessionStorage ?? createDefaultReaderSessionStorage());
  const sessionRestoredRef = useRef<string | null>(null);
  const initialState = useMemo(
    () =>
      createInitialReaderState({
        defaultZoom: settings.defaultZoom,
        defaultViewMode: settings.defaultViewMode,
      }),
    [settings.defaultViewMode, settings.defaultZoom],
  );
  const [state, dispatch] = useReducer(readerReducer, initialState);

  const openFile = useCallback(async (file: File) => {
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;
    sessionRestoredRef.current = null;
    dispatch({ type: "reader/loadStarted", payload: { fileName: file.name } });

    // 在发起 PDF.js 加载之前缓存 file bytes 引用，便于 forms 模式工具等场景复用同一份源 bytes。
    const bytesPromise = file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
    cachedFileRef.current = { name: file.name, bytesPromise };

    try {
      await loadedDocumentRef.current?.destroy();
      const loadedDocument = await loadPdfFromFile(file);
      if (loadRequestIdRef.current !== loadRequestId) {
        await loadedDocument.destroy();
        return;
      }

      loadedDocumentRef.current = loadedDocument;
      dispatch({
        type: "reader/loadSucceeded",
        payload: { documentId: `document-${loadRequestId}`, metadata: loadedDocument.metadata },
      });
    } catch (error) {
      if (loadRequestIdRef.current !== loadRequestId) {
        return;
      }

      // ISS-NEW-M M5：加密 PDF 进入密码提示态（保留 cachedFileRef 供重试），其余失败归一化为中文错误。
      const passwordReason = readPasswordReason(error);
      if (passwordReason !== null) {
        dispatch({ type: "reader/passwordPrompt", payload: { reason: passwordReason } });
        return;
      }

      cachedFileRef.current = null;
      dispatch({
        type: "reader/loadFailed",
        payload: { errorMessage: friendlyMessageForCode(normalizeError(error)) },
      });
    }
  }, []);

  const openNativeFile = useCallback(async (file: NativeReaderFile) => {
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;
    sessionRestoredRef.current = null;
    dispatch({ type: "reader/loadStarted", payload: { fileName: file.name } });

    const sourceBytes = new Uint8Array(file.bytes);
    const bytesPromise = Promise.resolve(sourceBytes);
    cachedFileRef.current = { name: file.name, bytesPromise };

    try {
      await loadedDocumentRef.current?.destroy();
      const loadedDocument = await loadPdfFromBytes({
        data: new Uint8Array(sourceBytes),
        fileName: file.name,
        filePath: file.path,
      });
      if (loadRequestIdRef.current !== loadRequestId) {
        await loadedDocument.destroy();
        return;
      }

      loadedDocumentRef.current = loadedDocument;
      dispatch({
        type: "reader/loadSucceeded",
        payload: { documentId: `document-${loadRequestId}`, metadata: loadedDocument.metadata },
      });
    } catch (error) {
      if (loadRequestIdRef.current !== loadRequestId) {
        return;
      }

      // ISS-NEW-M M5：加密 PDF 进入密码提示态（保留 cachedFileRef 供重试），其余失败归一化为中文错误。
      const passwordReason = readPasswordReason(error);
      if (passwordReason !== null) {
        dispatch({ type: "reader/passwordPrompt", payload: { reason: passwordReason } });
        return;
      }

      cachedFileRef.current = null;
      dispatch({
        type: "reader/loadFailed",
        payload: { errorMessage: friendlyMessageForCode(normalizeError(error)) },
      });
    }
  }, []);

  // ISS-NEW-M M5：用户提交密码后，复用 cachedFileRef 缓存的源 bytes 带密码重试加载。
  // 成功 → loadSucceeded；密码错（code=2）→ 再次 passwordPrompt（循环重试）；
  // 其他失败 → loadFailed。未处于 passwordChallenge 态或无缓存时 no-op。
  const submitPassword = useCallback(async (password: string) => {
    const cached = cachedFileRef.current;
    if (!cached) {
      return;
    }
    const loadRequestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = loadRequestId;
    dispatch({ type: "reader/loadStarted", payload: { fileName: cached.name } });

    try {
      await loadedDocumentRef.current?.destroy();
      const bytes = await cached.bytesPromise;
      const loadedDocument = await loadPdfFromBytes(
        { data: new Uint8Array(bytes), fileName: cached.name },
        undefined,
        { password },
      );
      if (loadRequestIdRef.current !== loadRequestId) {
        await loadedDocument.destroy();
        return;
      }

      loadedDocumentRef.current = loadedDocument;
      dispatch({
        type: "reader/loadSucceeded",
        payload: { documentId: `document-${loadRequestId}`, metadata: loadedDocument.metadata },
      });
    } catch (error) {
      if (loadRequestIdRef.current !== loadRequestId) {
        return;
      }
      const passwordReason = readPasswordReason(error);
      if (passwordReason !== null) {
        // 密码错误：再次提示，保留 cachedFileRef 继续重试。
        dispatch({ type: "reader/passwordPrompt", payload: { reason: passwordReason } });
        return;
      }
      cachedFileRef.current = null;
      dispatch({
        type: "reader/loadFailed",
        payload: { errorMessage: friendlyMessageForCode(normalizeError(error)) },
      });
    }
  }, []);

  const cancelPassword = useCallback(() => {
    cachedFileRef.current = null;
    dispatch({ type: "reader/passwordCancel" });
  }, []);

  // 文档加载成功后恢复上次的阅读会话
  useEffect(() => {
    const document = state.document;
    if (!document || !document.fingerprint) {
      return;
    }
    if (sessionRestoredRef.current === document.fingerprint) {
      return;
    }
    const session = sessionStorageRef.current.load(document.fingerprint);
    if (session) {
      dispatch({ type: "reader/applySession", payload: { session } });
    }
    sessionRestoredRef.current = document.fingerprint;
  }, [state.document?.fingerprint, state.document?.documentId]);

  // 阅读状态变化后持久化（currentPage/zoom/viewMode/rotation 任意变化触发）
  useEffect(() => {
    const document = state.document;
    if (!document || !document.fingerprint) {
      return;
    }
    // 仅在 restore 完成后再保存，避免初次加载时把默认值写回
    if (sessionRestoredRef.current !== document.fingerprint) {
      return;
    }
    const session: ReaderSession = {
      fingerprint: document.fingerprint,
      currentPage: document.currentPage,
      zoom: document.zoom,
      viewMode: document.viewMode,
      rotation: document.rotation,
      savedAt: new Date().toISOString(),
    };
    sessionStorageRef.current.save(session);
  }, [
    state.document?.fingerprint,
    state.document?.currentPage,
    state.document?.zoom,
    state.document?.viewMode,
    state.document?.rotation,
  ]);

  const setCurrentPage = useCallback((currentPage: number) => {
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage } });
  }, []);

  // ISS-NEW-D 前往浏览历史栈（DEC-171）步 2：
  // 弹 history[0] 作为新 currentPage；不再 push（避免循环）。
  // 无历史时 no-op。
  const goBack = useCallback(() => {
    dispatch({ type: "reader/goBack" });
  }, []);

  // 直接跳到 history[N-1]（1-indexed），不改变 history 栈（避免循环）。
  // N 越界（>= history.length）时 no-op。
  const goToHistory = useCallback(
    (oneBasedIndex: number) => {
      const history = state.history ?? [];
      if (!state.document) {
        return;
      }
      if (!Number.isInteger(oneBasedIndex) || oneBasedIndex < 1 || oneBasedIndex > history.length) {
        return;
      }
      const target = history[oneBasedIndex - 1];
      if (target === undefined) {
        return;
      }
      dispatch({
        type: "reader/setCurrentPage",
        payload: { currentPage: target, skipHistoryPush: true },
      });
    },
    [state.document, state.history],
  );

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: "reader/setZoom", payload: { zoom: clampZoom(zoom) } });
  }, []);

  const zoomIn = useCallback(() => {
    dispatch({ type: "reader/setZoom", payload: { zoom: clampZoom((state.document?.zoom ?? 1) + 0.1) } });
  }, [state.document?.zoom]);

  const zoomOut = useCallback(() => {
    dispatch({ type: "reader/setZoom", payload: { zoom: clampZoom((state.document?.zoom ?? 1) - 0.1) } });
  }, [state.document?.zoom]);

  const setViewMode = useCallback((viewMode: PdfViewMode) => {
    dispatch({ type: "reader/setViewMode", payload: { viewMode } });
  }, []);

  const setRotation = useCallback((rotation: PageRotation) => {
    dispatch({ type: "reader/setRotation", payload: { rotation } });
  }, []);

  const rotateClockwise = useCallback(() => {
    dispatch({ type: "reader/rotate", payload: { direction: "clockwise" } });
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    dispatch({ type: "reader/rotate", payload: { direction: "counter-clockwise" } });
  }, []);

  /** 应用缩放预设：固定值直接设置 zoom；fit-width 切换 viewMode；fit-page 切换 viewMode 并请求重算。 */
  const setZoomPreset = useCallback(
    (presetId: ZoomPresetId) => {
      const document = state.document;
      const result = applyZoomPresetId(presetId, document?.viewMode ?? "continuous", document?.zoom ?? 1);
      if (result.viewMode !== document?.viewMode) {
        dispatch({ type: "reader/setViewMode", payload: { viewMode: result.viewMode } });
      }
      if (!result.needsRecompute) {
        dispatch({ type: "reader/setZoom", payload: { zoom: result.zoom } });
      }
    },
    [state.document?.viewMode, state.document?.zoom],
  );

  const goToNextPage = useCallback(() => {
    const document = state.document;
    if (!document) {
      return;
    }
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage: document.currentPage + 1 } });
  }, [state.document]);

  const goToPreviousPage = useCallback(() => {
    const document = state.document;
    if (!document) {
      return;
    }
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage: document.currentPage - 1 } });
  }, [state.document]);

  const goToFirstPage = useCallback(() => {
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage: 1 } });
  }, []);

  const goToLastPage = useCallback(() => {
    const document = state.document;
    if (!document) {
      return;
    }
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage: document.pageCount } });
  }, [state.document]);

  const getPageText = useCallback(async (pageIndex: number): Promise<PdfPageText> => {
    const loadedDocument = loadedDocumentRef.current;

    if (!loadedDocument) {
      throw new Error("尚未打开 PDF");
    }

    return loadedDocument.getPageText(pageIndex);
  }, []);

  /** 将 PDF 页面渲染到 canvas 元素 */
  const renderPageToCanvas = useCallback(async (
    pageIndex: number,
    canvas: HTMLCanvasElement,
    zoom: number,
    options?: { signal?: AbortSignal },
  ) => {
    const loadedDocument = loadedDocumentRef.current;

    if (!loadedDocument) {
      return;
    }

    return loadedDocument.renderPageToCanvas(pageIndex, canvas, zoom, options);
  }, []);

  /** 将指定页以缩略图尺寸渲染到 canvas，maxWidth 约束最长边像素。文档未打开时 no-op。 */
  const renderThumbnail = useCallback(async (pageIndex: number, canvas: HTMLCanvasElement, maxWidth: number) => {
    const loadedDocument = loadedDocumentRef.current;

    if (!loadedDocument) {
      return;
    }

    return loadedDocument.renderThumbnail(pageIndex, canvas, maxWidth);
  }, []);

  /**
   * 返回当前打开的 PDF 源字节副本。无文档时返回 null；底层使用 openFile 时缓存的 arrayBuffer，
   * 避免再次读取 file。同一文件被多次调用时共用同一 bytesPromise 但消费方各自 copy 出独立 Uint8Array。
   */
  const getFileBytes = useCallback(async (): Promise<Uint8Array | null> => {
    const cached = cachedFileRef.current;
    if (!cached) {
      return null;
    }
    return cached.bytesPromise;
  }, []);

  /** 返回当前打开的源文件名（仅用于导出时的默认命名），无文档时返回 null。 */
  const getCurrentFileName = useCallback((): string | null => {
    return cachedFileRef.current?.name ?? null;
  }, []);

  /**
   * 把处理后的 PDF 字节保存为新文件。默认走浏览器 `<a download>`，不依赖 Tauri；
   * 调用方负责提供 suggestedFileName（建议形如 `<原名>-<操作>.pdf`）。
   */
  const saveUpdatedBytes = useCallback(async (bytes: Uint8Array, suggestedFileName: string): Promise<void> => {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      throw new Error("当前环境不支持浏览器下载，无法保存更新后的 PDF。");
    }
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedFileName;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  return {
    state,
    openFile,
    openNativeFile,
    submitPassword,
    cancelPassword,
    setCurrentPage,
    goBack,
    goToHistory,
    setZoom,
    zoomIn,
    zoomOut,
    setViewMode,
    setRotation,
    rotateClockwise,
    rotateCounterClockwise,
    setZoomPreset,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    getPageText,
    renderPageToCanvas,
    renderThumbnail,
    getFileBytes,
    getCurrentFileName,
    saveUpdatedBytes,
  };
}

export type ReaderController = ReturnType<typeof useReaderController>;
