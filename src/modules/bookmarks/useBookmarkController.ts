import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BookmarkDocumentRef,
  BookmarkSidecar,
  PdfPageBookmark,
} from "../../shared/pdf/bookmark";
import {
  addPageBookmark,
  createBookmarkStorageKey,
  createDefaultBookmarkStorage,
  loadBookmarkSidecar,
  removePageBookmark,
  saveBookmarkSidecar,
  type BookmarkStorage,
} from "./bookmarkStore";

export interface BookmarkControllerDocument extends BookmarkDocumentRef {
  currentPage: number;
}

export type AddBookmarkResult =
  | { status: "added"; bookmark: PdfPageBookmark }
  | { status: "exists"; bookmark: PdfPageBookmark }
  | { status: "no-document" }
  | { status: "error"; message: string };

export interface BookmarkController {
  bookmarks: PdfPageBookmark[];
  errorMessage: string | null;
  addCurrentPage: () => AddBookmarkResult;
  removeBookmark: (bookmarkId: string) => boolean;
}

interface BookmarkSnapshot {
  documentKey: string;
  sidecar: BookmarkSidecar;
}

export function useBookmarkController(
  document: BookmarkControllerDocument | null,
  storageOverride?: BookmarkStorage,
): BookmarkController {
  const storage = useMemo(
    () => storageOverride ?? createDefaultBookmarkStorage(),
    [storageOverride],
  );
  const documentKey = document ? createBookmarkStorageKey(document) : null;
  const [snapshot, setSnapshot] = useState<BookmarkSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!document || !documentKey) {
      setSnapshot(null);
      setErrorMessage(null);
      return;
    }
    try {
      setSnapshot({ documentKey, sidecar: loadBookmarkSidecar(storage, document) });
      setErrorMessage(null);
    } catch (error) {
      setSnapshot(null);
      setErrorMessage(getErrorMessage(error));
    }
  }, [documentKey, document?.pageCount, storage]);

  const addCurrentPage = useCallback((): AddBookmarkResult => {
    if (!document || !documentKey) {
      return { status: "no-document" };
    }
    try {
      const current = loadBookmarkSidecar(storage, document);
      const mutation = addPageBookmark(current, document.currentPage - 1);
      const sidecar = mutation.changed
        ? saveBookmarkSidecar(storage, document, mutation.sidecar)
        : current;
      setSnapshot({ documentKey, sidecar });
      setErrorMessage(null);
      return {
        status: mutation.changed ? "added" : "exists",
        bookmark: mutation.bookmark,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      return { status: "error", message };
    }
  }, [document, documentKey, storage]);

  const removeBookmark = useCallback((bookmarkId: string): boolean => {
    if (!document || !documentKey) {
      return false;
    }
    try {
      const current = loadBookmarkSidecar(storage, document);
      const next = removePageBookmark(current, bookmarkId);
      if (next === current) {
        return false;
      }
      const saved = saveBookmarkSidecar(storage, document, next);
      setSnapshot({ documentKey, sidecar: saved });
      setErrorMessage(null);
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return false;
    }
  }, [document, documentKey, storage]);

  return {
    bookmarks: snapshot?.documentKey === documentKey ? snapshot.sidecar.bookmarks : [],
    errorMessage,
    addCurrentPage,
    removeBookmark,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "书签保存失败。";
}
