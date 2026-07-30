import { describe, expect, test } from "vitest";
import type { BookmarkDocumentRef } from "../../shared/pdf/bookmark";
import {
  addPageBookmark,
  createBookmarkStorageKey,
  createEmptyBookmarkSidecar,
  createMemoryBookmarkStorage,
  loadBookmarkSidecar,
  removePageBookmark,
  saveBookmarkSidecar,
} from "./bookmarkStore";

const documentA: BookmarkDocumentRef = {
  path: "/Users/lawyer/cases/客户甲/证据.pdf",
  fingerprint: "fixture-a",
  pageCount: 5,
};

describe("bookmarkStore", () => {
  test("storage key 只暴露稳定哈希，不包含路径、文件名或 fingerprint", () => {
    const key = createBookmarkStorageKey(documentA);

    expect(key).toMatch(/^faropdf:bookmark-sidecar:v1:[a-z0-9]+$/);
    expect(key).not.toContain("客户甲");
    expect(key).not.toContain("证据.pdf");
    expect(key).not.toContain("fixture-a");
  });

  test("添加书签按页码排序，重复添加同页保持幂等", () => {
    const empty = createEmptyBookmarkSidecar(documentA, "2026-07-30T01:00:00.000Z");
    const page4 = addPageBookmark(empty, 3, "2026-07-30T01:01:00.000Z");
    const page2 = addPageBookmark(page4.sidecar, 1, "2026-07-30T01:02:00.000Z");
    const duplicate = addPageBookmark(page2.sidecar, 3, "2026-07-30T01:03:00.000Z");

    expect(page2.sidecar.bookmarks.map((bookmark) => bookmark.pageIndex)).toEqual([1, 3]);
    expect(duplicate.changed).toBe(false);
    expect(duplicate.sidecar).toBe(page2.sidecar);
    expect(duplicate.bookmark.id).toBe("page-4");
  });

  test("保存后可按文档恢复，不同 fingerprint 互不串台", () => {
    const storage = createMemoryBookmarkStorage();
    const documentB = { ...documentA, path: "/tmp/other.pdf", fingerprint: "fixture-b" };
    const aBookmark = addPageBookmark(createEmptyBookmarkSidecar(documentA), 2).sidecar;
    const bBookmark = addPageBookmark(createEmptyBookmarkSidecar(documentB), 4).sidecar;

    saveBookmarkSidecar(storage, documentA, aBookmark, "2026-07-30T02:00:00.000Z");
    saveBookmarkSidecar(storage, documentB, bBookmark, "2026-07-30T02:00:00.000Z");

    expect(loadBookmarkSidecar(storage, documentA).bookmarks.map((item) => item.pageIndex)).toEqual([2]);
    expect(loadBookmarkSidecar(storage, documentB).bookmarks.map((item) => item.pageIndex)).toEqual([4]);
    expect(storage.entries.size).toBe(2);
  });

  test("损坏 JSON 与 fingerprint 不匹配时 fail closed 为空 sidecar", () => {
    const storage = createMemoryBookmarkStorage();
    storage.setItem(createBookmarkStorageKey(documentA), "not-json");
    expect(loadBookmarkSidecar(storage, documentA).bookmarks).toEqual([]);

    storage.setItem(createBookmarkStorageKey(documentA), JSON.stringify({
      ...createEmptyBookmarkSidecar(documentA),
      document: { fingerprint: "stale", pageCount: 5 },
      bookmarks: [addPageBookmark(createEmptyBookmarkSidecar(documentA), 0).bookmark],
    }));
    expect(loadBookmarkSidecar(storage, documentA).bookmarks).toEqual([]);
  });

  test("加载时剔除超出当前 PDF 页数的旧书签", () => {
    const storage = createMemoryBookmarkStorage();
    const largerDocument = { ...documentA, pageCount: 8 };
    let sidecar = createEmptyBookmarkSidecar(largerDocument);
    sidecar = addPageBookmark(sidecar, 1).sidecar;
    sidecar = addPageBookmark(sidecar, 7).sidecar;
    storage.setItem(createBookmarkStorageKey(documentA), JSON.stringify(sidecar));

    expect(loadBookmarkSidecar(storage, documentA).bookmarks.map((item) => item.pageIndex)).toEqual([1]);
  });

  test("删除指定书签并保留其他页面", () => {
    let sidecar = createEmptyBookmarkSidecar(documentA);
    sidecar = addPageBookmark(sidecar, 0).sidecar;
    sidecar = addPageBookmark(sidecar, 2).sidecar;

    const next = removePageBookmark(sidecar, "page-1", "2026-07-30T03:00:00.000Z");

    expect(next.bookmarks.map((item) => item.id)).toEqual(["page-3"]);
    expect(next.updatedAt).toBe("2026-07-30T03:00:00.000Z");
  });
});
