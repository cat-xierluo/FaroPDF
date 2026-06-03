import { describe, expect, test } from "vitest";
import {
  createEmptyManifest,
  createEmptyManifestPage,
  createManifestId,
  createTextSnippet,
  isBlankPage,
  normalizeManifestInput,
  validateManifestInput,
} from "./defaults";

describe("organizer defaults", () => {
  test("creates text snippets by collapsing whitespace and truncating", () => {
    expect(createTextSnippet("")).toBe("");
    expect(createTextSnippet("  hello   world  ")).toBe("hello world");
    expect(createTextSnippet("a".repeat(100))).toBe("a".repeat(80) + "...");
    expect(createTextSnippet("short")).toBe("short");
  });

  test("detects blank pages by text length threshold", () => {
    expect(isBlankPage(0)).toBe(true);
    expect(isBlankPage(4)).toBe(true);
    expect(isBlankPage(5)).toBe(false);
    expect(isBlankPage(100)).toBe(false);
  });

  test("creates empty manifest page with zero values", () => {
    const page = createEmptyManifestPage(3);
    expect(page).toEqual({
      pageIndex: 3,
      textSnippet: "",
      textLength: 0,
      detectedBoundaries: [],
    });
  });

  test("creates manifest id with prefix and timestamp", () => {
    expect(createManifestId("2026-06-03T00:00:00.000Z")).toBe("doc-manifest-2026-06-03T00:00:00.000Z");
  });

  test("creates empty manifest with no pages or boundaries", () => {
    const manifest = createEmptyManifest("test-id", "2026-06-03T00:00:00.000Z");
    expect(manifest).toEqual({
      id: "test-id",
      pages: [],
      suggestedBoundaries: [],
      suggestedNames: [],
      createdAt: "2026-06-03T00:00:00.000Z",
    });
  });

  test("validates correct manifest input", () => {
    const result = validateManifestInput({ pageTexts: ["page 1", "page 2"] });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects non-object input", () => {
    const result = validateManifestInput(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("manifest 输入必须是对象。");
  });

  test("rejects missing or invalid pageTexts", () => {
    expect(validateManifestInput({}).valid).toBe(false);
    expect(validateManifestInput({ pageTexts: [] }).valid).toBe(false);
    expect(validateManifestInput({ pageTexts: [123] }).valid).toBe(false);
  });

  test("normalizes input with default values", () => {
    expect(normalizeManifestInput(null)).toEqual({ pageTexts: [] });
    expect(normalizeManifestInput({ pageTexts: ["a", null, "b"] })).toEqual({ pageTexts: ["a", "", "b"] });
    expect(normalizeManifestInput({ pageTexts: ["a"], id: "x", createdAt: "t" })).toEqual({
      pageTexts: ["a"],
      id: "x",
      createdAt: "t",
    });
  });
});
