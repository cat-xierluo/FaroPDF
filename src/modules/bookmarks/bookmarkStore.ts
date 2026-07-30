import type {
  BookmarkDocumentRef,
  BookmarkSidecar,
  PdfPageBookmark,
} from "../../shared/pdf/bookmark";

export const BOOKMARK_SIDECAR_SCHEMA_VERSION = 1;
export const BOOKMARK_STORAGE_KEY_PREFIX = "faropdf:bookmark-sidecar:v1:";

export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BookmarkMutationResult {
  sidecar: BookmarkSidecar;
  bookmark: PdfPageBookmark;
  changed: boolean;
}

const memoryBookmarkStorage = createMemoryBookmarkStorage();

export function createBookmarkStorageKey(document: BookmarkDocumentRef): string {
  const identity = document.fingerprint
    ? `fingerprint:${document.fingerprint}`
    : `path:${document.path}`;
  return `${BOOKMARK_STORAGE_KEY_PREFIX}${hashIdentity(identity)}`;
}

export function createEmptyBookmarkSidecar(
  document: BookmarkDocumentRef,
  now = new Date().toISOString(),
): BookmarkSidecar {
  return {
    schemaVersion: BOOKMARK_SIDECAR_SCHEMA_VERSION,
    document: {
      ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
      pageCount: document.pageCount,
    },
    bookmarks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function parseBookmarkSidecar(
  raw: string,
  document: BookmarkDocumentRef,
): BookmarkSidecar | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.schemaVersion !== BOOKMARK_SIDECAR_SCHEMA_VERSION) {
      return null;
    }
    if (!isRecord(value.document) || !Array.isArray(value.bookmarks)) {
      return null;
    }
    if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
      return null;
    }
    const storedFingerprint = typeof value.document.fingerprint === "string"
      ? value.document.fingerprint
      : undefined;
    if (document.fingerprint !== storedFingerprint) {
      return null;
    }

    const bookmarks = value.bookmarks
      .map(readBookmark)
      .filter((bookmark): bookmark is PdfPageBookmark =>
        bookmark !== null && bookmark.pageIndex < document.pageCount,
      );

    return {
      schemaVersion: BOOKMARK_SIDECAR_SCHEMA_VERSION,
      document: {
        ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
        pageCount: document.pageCount,
      },
      bookmarks: sortBookmarks(dedupeBookmarks(bookmarks)),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

export function loadBookmarkSidecar(
  storage: BookmarkStorage,
  document: BookmarkDocumentRef,
  now = new Date().toISOString(),
): BookmarkSidecar {
  const raw = storage.getItem(createBookmarkStorageKey(document));
  if (!raw) {
    return createEmptyBookmarkSidecar(document, now);
  }
  return parseBookmarkSidecar(raw, document) ?? createEmptyBookmarkSidecar(document, now);
}

export function saveBookmarkSidecar(
  storage: BookmarkStorage,
  document: BookmarkDocumentRef,
  sidecar: BookmarkSidecar,
  now = new Date().toISOString(),
): BookmarkSidecar {
  const normalized: BookmarkSidecar = {
    ...sidecar,
    schemaVersion: BOOKMARK_SIDECAR_SCHEMA_VERSION,
    document: {
      ...(document.fingerprint ? { fingerprint: document.fingerprint } : {}),
      pageCount: document.pageCount,
    },
    bookmarks: sortBookmarks(
      dedupeBookmarks(sidecar.bookmarks).filter(
        (bookmark) => bookmark.pageIndex >= 0 && bookmark.pageIndex < document.pageCount,
      ),
    ),
    updatedAt: now,
  };
  storage.setItem(createBookmarkStorageKey(document), JSON.stringify(normalized));
  return normalized;
}

export function addPageBookmark(
  sidecar: BookmarkSidecar,
  pageIndex: number,
  now = new Date().toISOString(),
): BookmarkMutationResult {
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= sidecar.document.pageCount) {
    throw new Error("书签页码超出当前文档范围。");
  }

  const existing = sidecar.bookmarks.find((bookmark) => bookmark.pageIndex === pageIndex);
  if (existing) {
    return { sidecar, bookmark: existing, changed: false };
  }

  const bookmark: PdfPageBookmark = {
    id: `page-${pageIndex + 1}`,
    pageIndex,
    label: `第 ${pageIndex + 1} 页`,
    createdAt: now,
    updatedAt: now,
  };
  return {
    sidecar: {
      ...sidecar,
      bookmarks: sortBookmarks([...sidecar.bookmarks, bookmark]),
      updatedAt: now,
    },
    bookmark,
    changed: true,
  };
}

export function removePageBookmark(
  sidecar: BookmarkSidecar,
  bookmarkId: string,
  now = new Date().toISOString(),
): BookmarkSidecar {
  const bookmarks = sidecar.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId);
  if (bookmarks.length === sidecar.bookmarks.length) {
    return sidecar;
  }
  return { ...sidecar, bookmarks, updatedAt: now };
}

export function createMemoryBookmarkStorage(
  initialEntries: Record<string, string> = {},
): BookmarkStorage & { entries: Map<string, string> } {
  const entries = new Map(Object.entries(initialEntries));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

export function createDefaultBookmarkStorage(): BookmarkStorage {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // 隐私模式或 storage 权限受限时回退到当前进程内存，不阻塞阅读。
    }
  }
  return memoryBookmarkStorage;
}

function readBookmark(value: unknown): PdfPageBookmark | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.pageIndex !== "number" ||
    !Number.isInteger(value.pageIndex) ||
    value.pageIndex < 0 ||
    typeof value.label !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    pageIndex: value.pageIndex,
    label: value.label,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function dedupeBookmarks(bookmarks: PdfPageBookmark[]): PdfPageBookmark[] {
  const byPage = new Map<number, PdfPageBookmark>();
  for (const bookmark of bookmarks) {
    if (!byPage.has(bookmark.pageIndex)) {
      byPage.set(bookmark.pageIndex, bookmark);
    }
  }
  return [...byPage.values()];
}

function sortBookmarks(bookmarks: PdfPageBookmark[]): PdfPageBookmark[] {
  return [...bookmarks].sort((left, right) =>
    left.pageIndex - right.pageIndex || left.createdAt.localeCompare(right.createdAt),
  );
}

function hashIdentity(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
