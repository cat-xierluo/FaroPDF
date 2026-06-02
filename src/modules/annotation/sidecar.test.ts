import { describe, expect, test } from "vitest";
import {
  ANNOTATION_SIDECAR_SCHEMA_VERSION,
  buildAnnotationSidecar,
  deriveAnnotationSidecarPath,
  parseAnnotationSidecar,
  serializeAnnotationSidecar,
  validateAnnotationSidecar,
} from "./sidecar";
import type { AnnotationDocumentRef } from "../../shared/pdf/annotation";

const documentRef: AnnotationDocumentRef = {
  path: "/Users/lawyer/Case Files/秘密卷宗.pdf",
  fingerprint: "PDF:fixture/2026",
  pageCount: 12,
};

describe("annotation sidecar", () => {
  test("derives a reversible sidecar path without overwriting the source PDF", () => {
    const sidecarPath = deriveAnnotationSidecarPath(documentRef);

    expect(sidecarPath).toBe("/Users/lawyer/Case Files/.faropdf/annotations/pdf-fixture-2026.annotations.json");
    expect(sidecarPath).not.toContain("秘密卷宗");
    expect(sidecarPath).not.toMatch(/\.pdf$/);
  });

  test("serializes and parses supported annotation kinds as schema versioned JSON", () => {
    const sidecar = buildAnnotationSidecar({
      document: documentRef,
      now: "2026-06-02T10:00:00.000Z",
      annotations: [
        {
          id: "ann-highlight",
          type: "highlight",
          pageIndex: 0,
          rects: [{ x: 12, y: 24, width: 160, height: 18 }],
          color: "#f7d46a",
          opacity: 0.45,
          content: "合同重点",
          createdAt: "2026-06-02T10:00:00.000Z",
          updatedAt: "2026-06-02T10:00:00.000Z",
        },
        {
          id: "ann-underline",
          type: "underline",
          pageIndex: 1,
          rects: [{ x: 30, y: 42, width: 140, height: 16 }],
          color: "#2f80ed",
          createdAt: "2026-06-02T10:01:00.000Z",
          updatedAt: "2026-06-02T10:01:00.000Z",
        },
        {
          id: "ann-strikeout",
          type: "strikeout",
          pageIndex: 2,
          rects: [{ x: 24, y: 38, width: 118, height: 16 }],
          color: "#d14d4d",
          createdAt: "2026-06-02T10:02:00.000Z",
          updatedAt: "2026-06-02T10:02:00.000Z",
        },
        {
          id: "ann-note",
          type: "note",
          pageIndex: 3,
          rects: [{ x: 88, y: 128, width: 24, height: 24 }],
          color: "#f2b84b",
          content: "请核对付款期限。",
          createdAt: "2026-06-02T10:03:00.000Z",
          updatedAt: "2026-06-02T10:03:00.000Z",
        },
        {
          id: "ann-textbox",
          type: "textbox",
          pageIndex: 4,
          rects: [{ x: 48, y: 72, width: 180, height: 64 }],
          color: "#2c6e49",
          content: "补充说明",
          style: { fontSize: 13 },
          createdAt: "2026-06-02T10:04:00.000Z",
          updatedAt: "2026-06-02T10:04:00.000Z",
        },
        {
          id: "ann-rectangle",
          type: "rectangle",
          pageIndex: 5,
          rects: [{ x: 60, y: 80, width: 200, height: 90 }],
          color: "#6c5ce7",
          style: { strokeWidth: 2 },
          createdAt: "2026-06-02T10:05:00.000Z",
          updatedAt: "2026-06-02T10:05:00.000Z",
        },
        {
          id: "ann-arrow",
          type: "arrow",
          pageIndex: 6,
          rects: [{ x: 10, y: 20, width: 110, height: 48 }],
          color: "#0b7285",
          line: { start: { x: 10, y: 20 }, end: { x: 120, y: 68 } },
          createdAt: "2026-06-02T10:06:00.000Z",
          updatedAt: "2026-06-02T10:06:00.000Z",
        },
        {
          id: "ann-ink",
          type: "ink",
          pageIndex: 7,
          rects: [{ x: 30, y: 30, width: 80, height: 50 }],
          color: "#111827",
          ink: { strokes: [[{ x: 30, y: 30 }, { x: 64, y: 52 }]] },
          createdAt: "2026-06-02T10:07:00.000Z",
          updatedAt: "2026-06-02T10:07:00.000Z",
        },
        {
          id: "ann-stamp",
          type: "stamp",
          pageIndex: 8,
          rects: [{ x: 72, y: 96, width: 84, height: 32 }],
          color: "#b7791f",
          stamp: { label: "已阅", name: "reviewed" },
          createdAt: "2026-06-02T10:08:00.000Z",
          updatedAt: "2026-06-02T10:08:00.000Z",
        },
      ],
    });

    const parsed = parseAnnotationSidecar(serializeAnnotationSidecar(sidecar));

    expect(parsed.schemaVersion).toBe(ANNOTATION_SIDECAR_SCHEMA_VERSION);
    expect(parsed.document).toEqual({ fingerprint: "PDF:fixture/2026", pageCount: 12 });
    expect(parsed.annotations.map((annotation) => annotation.type)).toEqual([
      "highlight",
      "underline",
      "strikeout",
      "note",
      "textbox",
      "rectangle",
      "arrow",
      "ink",
      "stamp",
    ]);
  });

  test("rejects unsupported sidecar schema versions", () => {
    const unsupportedJson = JSON.stringify({
      schemaVersion: 999,
      document: { fingerprint: "PDF:fixture/2026", pageCount: 12 },
      annotations: [],
      createdAt: "2026-06-02T10:00:00.000Z",
      updatedAt: "2026-06-02T10:00:00.000Z",
    });

    expect(() => parseAnnotationSidecar(unsupportedJson)).toThrow("Unsupported annotation sidecar schema version");
  });

  test("validates nested annotation fields before serializing", () => {
    const invalidSidecar = buildAnnotationSidecar({
      document: documentRef,
      now: "2026-06-02T10:00:00.000Z",
      annotations: [
        {
          id: "ann-invalid",
          type: "stamp",
          pageIndex: 0,
          rects: [{ x: 1, y: 2, width: 3, height: 4 }],
          color: "#f7d46a",
          stamp: { label: "Bad", name: "unsupported" as "custom" },
          createdAt: "2026-06-02T10:00:00.000Z",
          updatedAt: "2026-06-02T10:00:00.000Z",
        },
      ],
    });

    expect(() => validateAnnotationSidecar(invalidSidecar)).toThrow("unsupported stamp name");
    expect(() => serializeAnnotationSidecar(invalidSidecar)).toThrow("unsupported stamp name");
  });
});
