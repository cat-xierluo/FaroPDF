import { describe, expect, test } from "vitest";
import type { PdfPageOperationsExportOperation } from "../../shared";
import {
  createPageOrganizerExportRequest,
  createPageOrganizerState,
  deleteOrganizerPages,
  reorderOrganizerPages,
  restoreOrganizerPages,
  rotateOrganizerPages,
  suggestPageOrganizerOutputPath,
  undoPageOrganizer,
} from "./pageOrganizer";

const FIXED_TIME = "2026-06-02T00:00:00.000Z";

describe("page organizer", () => {
  test("creates page state with original page numbers and current order", () => {
    const state = createPageOrganizerState({
      id: "organizer-1",
      pageCount: 3,
      sourcePath: "/case/source.pdf",
      fingerprint: "fixture",
      createdAt: FIXED_TIME,
    });

    expect(state.document).toEqual({
      pageCount: 3,
      sourcePath: "/case/source.pdf",
      fingerprint: "fixture",
    });
    expect(state.pages).toEqual([
      {
        id: "page-1",
        originalPageIndex: 0,
        originalPageNumber: 1,
        orderIndex: 0,
        rotation: 0,
        deleted: false,
      },
      {
        id: "page-2",
        originalPageIndex: 1,
        originalPageNumber: 2,
        orderIndex: 1,
        rotation: 0,
        deleted: false,
      },
      {
        id: "page-3",
        originalPageIndex: 2,
        originalPageNumber: 3,
        orderIndex: 2,
        rotation: 0,
        deleted: false,
      },
    ]);
    expect(state.actions).toEqual([]);
    expect(state.undoStack).toEqual([]);
  });

  test("rotates selected pages and can undo the rotation", () => {
    const initial = createPageOrganizerState({ pageCount: 2, createdAt: FIXED_TIME });
    const rotated = rotateOrganizerPages(initial, {
      pageIds: ["page-2"],
      angle: 90,
      createdAt: FIXED_TIME,
    });

    expect(initial.pages[1].rotation).toBe(0);
    expect(rotated.pages[1].rotation).toBe(90);
    expect(rotated.actions).toEqual([
      expect.objectContaining({
        type: "rotate",
        pageIds: ["page-2"],
        pageIndexes: [1],
        payload: { angle: 90, rotation: 90 },
      }),
    ]);

    const undone = undoPageOrganizer(rotated);

    expect(undone.pages.map((page) => page.rotation)).toEqual([0, 0]);
    expect(undone.actions).toEqual([]);
  });

  test("marks deleted pages and restores them without losing order", () => {
    const initial = createPageOrganizerState({ pageCount: 3, createdAt: FIXED_TIME });
    const reordered = reorderOrganizerPages(initial, {
      pageIds: ["page-3"],
      toIndex: 0,
      createdAt: FIXED_TIME,
    });
    const deleted = deleteOrganizerPages(reordered, {
      pageIds: ["page-1"],
      createdAt: FIXED_TIME,
    });
    const restored = restoreOrganizerPages(deleted, {
      pageIds: ["page-1"],
      createdAt: FIXED_TIME,
    });

    expect(deleted.pages.map((page) => ({ id: page.id, deleted: page.deleted }))).toEqual([
      { id: "page-3", deleted: false },
      { id: "page-1", deleted: true },
      { id: "page-2", deleted: false },
    ]);
    expect(restored.pages.map((page) => ({ id: page.id, deleted: page.deleted }))).toEqual([
      { id: "page-3", deleted: false },
      { id: "page-1", deleted: false },
      { id: "page-2", deleted: false },
    ]);
    expect(restored.actions.at(-1)).toEqual(
      expect.objectContaining({
        type: "restore",
        pageIds: ["page-1"],
        pageIndexes: [0],
      }),
    );
  });

  test("reorders active pages by stable ids and can undo the move", () => {
    const initial = createPageOrganizerState({ pageCount: 4, createdAt: FIXED_TIME });
    const reordered = reorderOrganizerPages(initial, {
      pageIds: ["page-4"],
      toIndex: 1,
      createdAt: FIXED_TIME,
    });

    expect(reordered.pages.map((page) => page.originalPageNumber)).toEqual([1, 4, 2, 3]);
    expect(reordered.pages.map((page) => page.orderIndex)).toEqual([0, 1, 2, 3]);
    expect(reordered.actions.at(-1)).toEqual(
      expect.objectContaining({
        type: "reorder",
        pageIds: ["page-4"],
        pageIndexes: [3],
        payload: {
          toIndex: 1,
          orderedPageIndexes: [0, 3, 1, 2],
        },
      }),
    );

    const undone = undoPageOrganizer(reordered);

    expect(undone.pages.map((page) => page.originalPageNumber)).toEqual([1, 2, 3, 4]);
    expect(undone.actions).toEqual([]);
  });

  test("preserves deleted page position when active pages are reordered and later restored", () => {
    const initial = createPageOrganizerState({ pageCount: 4, createdAt: FIXED_TIME });
    const deleted = deleteOrganizerPages(initial, {
      pageIds: ["page-2"],
      createdAt: FIXED_TIME,
    });
    const reordered = reorderOrganizerPages(deleted, {
      pageIds: ["page-4"],
      toIndex: 0,
      createdAt: FIXED_TIME,
    });
    const restored = restoreOrganizerPages(reordered, {
      pageIds: ["page-2"],
      createdAt: FIXED_TIME,
    });

    expect(reordered.pages.map((page) => ({ id: page.id, deleted: page.deleted }))).toEqual([
      { id: "page-4", deleted: false },
      { id: "page-1", deleted: false },
      { id: "page-2", deleted: true },
      { id: "page-3", deleted: false },
    ]);
    expect(restored.pages.map((page) => ({ id: page.id, deleted: page.deleted }))).toEqual([
      { id: "page-4", deleted: false },
      { id: "page-1", deleted: false },
      { id: "page-2", deleted: false },
      { id: "page-3", deleted: false },
    ]);
  });

  test("rejects restoring pages that are not currently deleted", () => {
    const initial = createPageOrganizerState({ pageCount: 2, createdAt: FIXED_TIME });

    expect(() =>
      restoreOrganizerPages(initial, {
        pageIds: ["page-1"],
        createdAt: FIXED_TIME,
      }),
    ).toThrow("只能恢复已删除页面。");
  });

  test("builds a plan-only export request with a safe organized output path", () => {
    const initial = createPageOrganizerState({
      id: "organizer-1",
      pageCount: 3,
      sourcePath: "/case/source.pdf",
      fingerprint: "fixture",
      createdAt: FIXED_TIME,
    });
    const rotated = rotateOrganizerPages(initial, {
      pageIds: ["page-2"],
      angle: 90,
      createdAt: FIXED_TIME,
    });
    const deleted = deleteOrganizerPages(rotated, {
      pageIds: ["page-1"],
      createdAt: FIXED_TIME,
    });
    const reordered = reorderOrganizerPages(deleted, {
      pageIds: ["page-3"],
      toIndex: 0,
      createdAt: FIXED_TIME,
    });

    const request = createPageOrganizerExportRequest(reordered, {
      id: "export-pages-1",
      requestedAt: FIXED_TIME,
    });

    expect(request).toEqual({
      id: "export-pages-1",
      inputPath: "/case/source.pdf",
      outputPath: "/case/source-organized.pdf",
      fingerprint: "fixture",
      requestedAt: FIXED_TIME,
      operations: [
        expect.objectContaining({
          id: "export-pages-1-page-operations",
          type: "page-operations",
          mode: "plan-only",
        }),
      ],
    });

    const pageOperation = request.operations[0] as PdfPageOperationsExportOperation;
    expect(pageOperation.operations.map((operation) => operation.type)).toEqual(["reorder", "rotate", "delete"]);
    expect(pageOperation.operations.map((operation) => operation.pageIndexes)).toEqual([[2, 1], [1], [0]]);
    expect(pageOperation.operations.map((operation) => operation.payload)).toEqual([
      { orderedPageIndexes: [2, 1], deletedPageIndexes: [0] },
      { angle: 90, rotation: 90 },
      { deleted: true },
    ]);
  });

  test("rejects destructive export paths that resolve to the source PDF", () => {
    const state = createPageOrganizerState({
      pageCount: 1,
      sourcePath: "/case/source.pdf",
      createdAt: FIXED_TIME,
    });

    expect(suggestPageOrganizerOutputPath("/case/source.pdf")).toBe("/case/source-organized.pdf");
    expect(() =>
      createPageOrganizerExportRequest(state, {
        id: "export-pages-unsafe",
        outputPath: "/case/nested/../source.pdf",
        requestedAt: FIXED_TIME,
      }),
    ).toThrow("页面整理输出 PDF 必须是不同于原始 PDF 的新文件。");
  });

  test("rejects unsafe export paths before creating export requests", () => {
    const state = createPageOrganizerState({
      pageCount: 1,
      sourcePath: "/case/source.pdf",
      createdAt: FIXED_TIME,
    });

    expect(() =>
      createPageOrganizerExportRequest(state, {
        id: "export-pages-relative",
        outputPath: "source-organized.pdf",
        requestedAt: FIXED_TIME,
      }),
    ).toThrow("页面整理输出路径必须是绝对路径。");

    expect(() =>
      createPageOrganizerExportRequest(state, {
        id: "export-pages-docx",
        outputPath: "/case/source-organized.docx",
        requestedAt: FIXED_TIME,
      }),
    ).toThrow("页面整理输出文件必须是 PDF。");
  });

  test("rejects corrupted organizer state before generating page operations", () => {
    const duplicatePageState = createPageOrganizerState({
      pageCount: 2,
      sourcePath: "/case/source.pdf",
      createdAt: FIXED_TIME,
    });
    duplicatePageState.pages[1] = {
      ...duplicatePageState.pages[1],
      originalPageIndex: 0,
    };

    expect(() =>
      createPageOrganizerExportRequest(duplicatePageState, {
        id: "export-pages-duplicate",
        requestedAt: FIXED_TIME,
      }),
    ).toThrow("页面整理状态页码必须唯一且覆盖源 PDF。");

    const outOfRangePageState = createPageOrganizerState({
      pageCount: 2,
      sourcePath: "/case/source.pdf",
      createdAt: FIXED_TIME,
    });
    outOfRangePageState.pages[1] = {
      ...outOfRangePageState.pages[1],
      originalPageIndex: 2,
    };

    expect(() =>
      createPageOrganizerExportRequest(outOfRangePageState, {
        id: "export-pages-out-of-range",
        requestedAt: FIXED_TIME,
      }),
    ).toThrow("页面整理状态页码必须唯一且覆盖源 PDF。");
  });
});
