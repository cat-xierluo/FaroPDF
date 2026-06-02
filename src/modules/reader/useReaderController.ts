import { useCallback, useMemo, useReducer, useRef } from "react";
import type { AppSettings } from "../../shared/settings/types";
import type { PdfPageText } from "../../shared/pdf/text";
import type { PdfViewMode } from "../../shared/pdf/types";
import { loadPdfFromFile, type LoadedPdfDocument } from "./pdfReaderService";
import { createInitialReaderState, readerReducer } from "./readerState";

export function useReaderController(settings: AppSettings) {
  const loadedDocumentRef = useRef<LoadedPdfDocument | null>(null);
  const loadRequestIdRef = useRef(0);
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
    dispatch({ type: "reader/loadStarted", payload: { fileName: file.name } });

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

      dispatch({
        type: "reader/loadFailed",
        payload: { errorMessage: error instanceof Error ? error.message : "无法打开 PDF" },
      });
    }
  }, []);

  const setCurrentPage = useCallback((currentPage: number) => {
    dispatch({ type: "reader/setCurrentPage", payload: { currentPage } });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: "reader/setZoom", payload: { zoom } });
  }, []);

  const setViewMode = useCallback((viewMode: PdfViewMode) => {
    dispatch({ type: "reader/setViewMode", payload: { viewMode } });
  }, []);

  const getPageText = useCallback(async (pageIndex: number): Promise<PdfPageText> => {
    const loadedDocument = loadedDocumentRef.current;

    if (!loadedDocument) {
      throw new Error("尚未打开 PDF");
    }

    return loadedDocument.getPageText(pageIndex);
  }, []);

  return {
    state,
    openFile,
    setCurrentPage,
    setZoom,
    setViewMode,
    getPageText,
  };
}

export type ReaderController = ReturnType<typeof useReaderController>;
