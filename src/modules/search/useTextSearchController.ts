import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfDocumentState } from "../../shared/pdf/types";
import type { PdfPageText } from "../../shared/pdf/text";
import {
  createIdleSearchState,
  createTextSearchSession,
  normalizeSearchQuery,
  type TextSearchSession,
  type TextSearchState,
} from "./textSearchService";

interface TextSearchControllerOptions {
  document: PdfDocumentState | null;
  readPageText: (pageIndex: number) => Promise<PdfPageText>;
  onRequestOcr: () => void;
  onSelectPage: (pageNumber: number) => void;
}

export interface TextSearchController {
  state: TextSearchState;
  setQuery: (query: string) => void;
  indexMore: () => void;
  selectHit: (hitId: string) => void;
  selectNextHit: () => void;
  selectPreviousHit: () => void;
  requestOcr: () => void;
  reset: () => void;
}

const SEARCH_BATCH_SIZE = 8;

export function useTextSearchController({
  document,
  readPageText,
  onRequestOcr,
  onSelectPage,
}: TextSearchControllerOptions): TextSearchController {
  const pageCount = document?.pageCount ?? 0;
  const currentPageIndex = Math.max((document?.currentPage ?? 1) - 1, 0);
  const documentId = document?.documentId ?? "no-document";
  const activeDocumentIdRef = useRef(documentId);
  const sessionRef = useRef<TextSearchSession | null>(null);
  const requestIdRef = useRef(0);
  const [state, setState] = useState(() => createIdleSearchState(pageCount));

  activeDocumentIdRef.current = documentId;

  useEffect(() => {
    requestIdRef.current += 1;

    if (pageCount === 0) {
      sessionRef.current = null;
      setState(createIdleSearchState(0));
      return;
    }

    const sessionDocumentId = documentId;
    sessionRef.current = createTextSearchSession({
      pageCount,
      readPageText: async (pageIndex) => {
        if (activeDocumentIdRef.current !== sessionDocumentId) {
          throw new Error("文档已切换，搜索索引已重置。");
        }

        return readPageText(pageIndex);
      },
    });
    setState(createIdleSearchState(pageCount));
  }, [documentId, pageCount, readPageText]);

  const setQuery = useCallback(
    (query: string) => {
      const session = sessionRef.current;

      if (!session) {
        setState(createIdleSearchState(0));
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const normalizedQuery = normalizeSearchQuery(query);
      setState((currentState) => ({
        ...currentState,
        query,
        normalizedQuery,
        status: normalizedQuery ? "indexing" : "idle",
      }));

      void session
        .search(query, {
          batchSize: SEARCH_BATCH_SIZE,
          startPageIndex: currentPageIndex,
        })
        .then((nextState) => {
          if (requestIdRef.current === requestId) {
            setState(nextState);
          }
        });
    },
    [currentPageIndex],
  );

  const indexMore = useCallback(() => {
    const session = sessionRef.current;

    if (!session) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void session.indexNextBatch({ batchSize: SEARCH_BATCH_SIZE }).then((nextState) => {
      if (requestIdRef.current === requestId) {
        setState(nextState);
      }
    });
  }, []);

  const activateState = useCallback(
    (nextState: TextSearchState) => {
      setState(nextState);

      if (nextState.activeHit) {
        onSelectPage(nextState.activeHit.pageNumber);
      }
    },
    [onSelectPage],
  );

  const selectHit = useCallback(
    (hitId: string) => {
      const nextState = sessionRef.current?.selectHit(hitId);

      if (nextState) {
        activateState(nextState);
      }
    },
    [activateState],
  );

  const selectNextHit = useCallback(() => {
    const nextState = sessionRef.current?.selectNextHit();

    if (nextState) {
      activateState(nextState);
    }
  }, [activateState]);

  const selectPreviousHit = useCallback(() => {
    const nextState = sessionRef.current?.selectPreviousHit();

    if (nextState) {
      activateState(nextState);
    }
  }, [activateState]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    const nextState = sessionRef.current?.reset() ?? createIdleSearchState(pageCount);
    setState(nextState);
  }, [pageCount]);

  return {
    state,
    setQuery,
    indexMore,
    selectHit,
    selectNextHit,
    selectPreviousHit,
    requestOcr: onRequestOcr,
    reset,
  };
}
