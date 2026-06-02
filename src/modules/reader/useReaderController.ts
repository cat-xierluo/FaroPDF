import { useCallback, useMemo, useReducer, useRef } from "react";
import type { AppSettings } from "../../shared/settings/types";
import type { PdfViewMode } from "../../shared/pdf/types";
import { loadPdfFromFile, type LoadedPdfDocument } from "./pdfReaderService";
import { createInitialReaderState, readerReducer } from "./readerState";

export function useReaderController(settings: AppSettings) {
  const loadedDocumentRef = useRef<LoadedPdfDocument | null>(null);
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
    dispatch({ type: "reader/loadStarted", payload: { fileName: file.name } });

    try {
      await loadedDocumentRef.current?.destroy();
      const loadedDocument = await loadPdfFromFile(file);
      loadedDocumentRef.current = loadedDocument;
      dispatch({ type: "reader/loadSucceeded", payload: loadedDocument.metadata });
    } catch (error) {
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

  return {
    state,
    openFile,
    setCurrentPage,
    setZoom,
    setViewMode,
  };
}

export type ReaderController = ReturnType<typeof useReaderController>;
