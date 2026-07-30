export {
  addPageBookmark,
  BOOKMARK_SIDECAR_SCHEMA_VERSION,
  BOOKMARK_STORAGE_KEY_PREFIX,
  createBookmarkStorageKey,
  createDefaultBookmarkStorage,
  createEmptyBookmarkSidecar,
  createMemoryBookmarkStorage,
  loadBookmarkSidecar,
  parseBookmarkSidecar,
  removePageBookmark,
  saveBookmarkSidecar,
  type BookmarkMutationResult,
  type BookmarkStorage,
} from "./bookmarkStore";
export {
  useBookmarkController,
  type AddBookmarkResult,
  type BookmarkController,
  type BookmarkControllerDocument,
} from "./useBookmarkController";
