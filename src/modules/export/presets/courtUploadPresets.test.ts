import { describe, expect, test } from "vitest";
import {
  COURT_UPLOAD_PRESETS,
  COURT_UPLOAD_PRESET_TINY,
  COURT_UPLOAD_PRESET_SMALL,
  COURT_UPLOAD_PRESET_MEDIUM,
  COURT_UPLOAD_PRESET_LARGE,
  COURT_UPLOAD_PRESET_ORDER,
  isCourtUploadPreset,
} from "./courtUploadPresets";
import type { CourtUploadPresetId } from "./courtUploadPresets";

describe("courtUploadPresets", () => {
  test("4 court upload presets have correct parameters", () => {
    expect(COURT_UPLOAD_PRESET_TINY).toEqual({
      id: "court-5mb",
      targetSizeBytes: 5 * 1024 * 1024,
      imageQuality: 0.4,
      maxDPI: 150,
      label: "法院上传 5MB",
    });
    expect(COURT_UPLOAD_PRESET_SMALL).toEqual({
      id: "court-10mb",
      targetSizeBytes: 10 * 1024 * 1024,
      imageQuality: 0.55,
      maxDPI: 200,
      label: "法院上传 10MB",
    });
    expect(COURT_UPLOAD_PRESET_MEDIUM).toEqual({
      id: "court-20mb",
      targetSizeBytes: 20 * 1024 * 1024,
      imageQuality: 0.7,
      maxDPI: 300,
      label: "法院上传 20MB",
    });
    expect(COURT_UPLOAD_PRESET_LARGE).toEqual({
      id: "court-50mb",
      targetSizeBytes: 50 * 1024 * 1024,
      imageQuality: 0.85,
      maxDPI: 600,
      label: "法院上传 50MB",
    });
  });

  test("COURT_UPLOAD_PRESETS record maps all 4 preset IDs", () => {
    const ids = Object.keys(COURT_UPLOAD_PRESETS) as CourtUploadPresetId[];
    expect(ids).toHaveLength(4);
    expect(ids).toContain("court-5mb");
    expect(ids).toContain("court-10mb");
    expect(ids).toContain("court-20mb");
    expect(ids).toContain("court-50mb");
  });

  test("imageQuality increases with target size", () => {
    expect(COURT_UPLOAD_PRESET_TINY.imageQuality).toBeLessThan(COURT_UPLOAD_PRESET_SMALL.imageQuality);
    expect(COURT_UPLOAD_PRESET_SMALL.imageQuality).toBeLessThan(COURT_UPLOAD_PRESET_MEDIUM.imageQuality);
    expect(COURT_UPLOAD_PRESET_MEDIUM.imageQuality).toBeLessThan(COURT_UPLOAD_PRESET_LARGE.imageQuality);
  });

  test("maxDPI increases with target size", () => {
    expect(COURT_UPLOAD_PRESET_TINY.maxDPI).toBeLessThan(COURT_UPLOAD_PRESET_SMALL.maxDPI);
    expect(COURT_UPLOAD_PRESET_SMALL.maxDPI).toBeLessThan(COURT_UPLOAD_PRESET_MEDIUM.maxDPI);
    expect(COURT_UPLOAD_PRESET_MEDIUM.maxDPI).toBeLessThan(COURT_UPLOAD_PRESET_LARGE.maxDPI);
  });

  test("COURT_UPLOAD_PRESET_ORDER lists presets from smallest to largest", () => {
    expect(COURT_UPLOAD_PRESET_ORDER).toEqual(["court-5mb", "court-10mb", "court-20mb", "court-50mb"]);
  });

  test("isCourtUploadPreset narrows type for valid court presets", () => {
    expect(isCourtUploadPreset("court-5mb")).toBe(true);
    expect(isCourtUploadPreset("court-10mb")).toBe(true);
    expect(isCourtUploadPreset("court-20mb")).toBe(true);
    expect(isCourtUploadPreset("court-50mb")).toBe(true);
    expect(isCourtUploadPreset("screen")).toBe(false);
    expect(isCourtUploadPreset("court-upload")).toBe(false);
    expect(isCourtUploadPreset("unknown")).toBe(false);
  });
});
