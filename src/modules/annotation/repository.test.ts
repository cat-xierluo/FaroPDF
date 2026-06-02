import { describe, expect, test } from "vitest";
import { AnnotationRepository, createMemoryAnnotationStorage } from "./repository";
import { AnnotationService } from "./service";
import type { AnnotationDocumentRef, PdfAnnotationInput } from "../../shared/pdf/annotation";

const documentRef: AnnotationDocumentRef = {
  path: "/Users/lawyer/cases/source.pdf",
  fingerprint: "source-fingerprint",
  pageCount: 3,
};

const fixedClock = () => "2026-06-02T11:00:00.000Z";
const fixedIds = () => "ann-fixed";

describe("annotation repository and service", () => {
  test("adds, updates, lists, and deletes annotations through a sidecar repository", async () => {
    const storage = createMemoryAnnotationStorage();
    const repository = new AnnotationRepository({ storage, now: fixedClock });
    const service = new AnnotationService({ repository, createId: fixedIds, now: fixedClock });

    const input: PdfAnnotationInput = {
      type: "note",
      pageIndex: 1,
      rects: [{ x: 20, y: 30, width: 24, height: 24 }],
      color: "#f2b84b",
      content: "核对原件。",
      author: { id: "user-1", displayName: "Reviewer" },
    };

    const created = await service.addAnnotation(documentRef, input);
    const updated = await service.updateAnnotation(documentRef, created.id, {
      content: "核对原件与扫描件。",
      color: "#d97706",
    });
    const afterUpdate = await service.listAnnotations(documentRef);
    const deleted = await service.deleteAnnotation(documentRef, created.id);
    const afterDelete = await service.listAnnotations(documentRef);

    expect(created).toMatchObject({
      id: "ann-fixed",
      type: "note",
      pageIndex: 1,
      content: "核对原件。",
      createdAt: "2026-06-02T11:00:00.000Z",
      updatedAt: "2026-06-02T11:00:00.000Z",
    });
    expect(updated.content).toBe("核对原件与扫描件。");
    expect(updated.color).toBe("#d97706");
    expect(afterUpdate).toHaveLength(1);
    expect(deleted).toBe(true);
    expect(afterDelete).toEqual([]);
  });

  test("sorts annotations by page and update time for list display", async () => {
    const storage = createMemoryAnnotationStorage();
    const repository = new AnnotationRepository({ storage, now: fixedClock });
    const service = new AnnotationService({
      repository,
      createId: (() => {
        const ids = ["ann-page-2", "ann-page-1", "ann-page-1-later"];
        return () => ids.shift() ?? "ann-extra";
      })(),
      now: (() => {
        const times = [
          "2026-06-02T11:00:00.000Z",
          "2026-06-02T11:01:00.000Z",
          "2026-06-02T11:02:00.000Z",
        ];
        return () => times.shift() ?? "2026-06-02T11:03:00.000Z";
      })(),
    });

    await service.addAnnotation(documentRef, {
      type: "highlight",
      pageIndex: 2,
      rects: [{ x: 1, y: 1, width: 10, height: 10 }],
      color: "#f7d46a",
    });
    await service.addAnnotation(documentRef, {
      type: "underline",
      pageIndex: 0,
      rects: [{ x: 1, y: 1, width: 10, height: 10 }],
      color: "#2f80ed",
    });
    await service.addAnnotation(documentRef, {
      type: "stamp",
      pageIndex: 0,
      rects: [{ x: 1, y: 1, width: 40, height: 18 }],
      color: "#b7791f",
      stamp: { label: "待核", name: "todo" },
    });

    const annotations = await service.listAnnotations(documentRef);

    expect(annotations.map((annotation) => annotation.id)).toEqual(["ann-page-1", "ann-page-1-later", "ann-page-2"]);
  });

  test("treats an empty sidecar file as invalid JSON instead of missing", async () => {
    const storage = createMemoryAnnotationStorage({
      "/Users/lawyer/cases/.faropdf/annotations/source-fingerprint.annotations.json": "",
    });
    const repository = new AnnotationRepository({ storage, now: fixedClock });

    await expect(repository.load(documentRef)).rejects.toThrow("Invalid annotation sidecar JSON");
  });

  test("rejects invalid annotation data before writing sidecar content", async () => {
    const storage = createMemoryAnnotationStorage();
    const repository = new AnnotationRepository({ storage, now: fixedClock });
    const service = new AnnotationService({ repository, createId: fixedIds, now: fixedClock });

    await expect(
      service.addAnnotation(documentRef, {
        type: "note",
        pageIndex: -1,
        rects: [{ x: 20, y: 30, width: 24, height: 24 }],
        color: "#f2b84b",
      }),
    ).rejects.toThrow("annotation.pageIndex must be a non-negative integer");

    expect(storage.files.size).toBe(0);
  });
});
