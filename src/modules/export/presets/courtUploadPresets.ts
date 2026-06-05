export type CourtUploadPresetId = "court-5mb" | "court-10mb" | "court-20mb" | "court-50mb";

export interface CourtUploadPresetConfig {
  id: CourtUploadPresetId;
  targetSizeBytes: number;
  imageQuality: number;
  maxDPI: number;
  label: string;
}

export const COURT_UPLOAD_PRESET_TINY: CourtUploadPresetConfig = {
  id: "court-5mb",
  targetSizeBytes: 5 * 1024 * 1024,
  imageQuality: 0.4,
  maxDPI: 150,
  label: "法院上传 5MB",
};

export const COURT_UPLOAD_PRESET_SMALL: CourtUploadPresetConfig = {
  id: "court-10mb",
  targetSizeBytes: 10 * 1024 * 1024,
  imageQuality: 0.55,
  maxDPI: 200,
  label: "法院上传 10MB",
};

export const COURT_UPLOAD_PRESET_MEDIUM: CourtUploadPresetConfig = {
  id: "court-20mb",
  targetSizeBytes: 20 * 1024 * 1024,
  imageQuality: 0.7,
  maxDPI: 300,
  label: "法院上传 20MB",
};

export const COURT_UPLOAD_PRESET_LARGE: CourtUploadPresetConfig = {
  id: "court-50mb",
  targetSizeBytes: 50 * 1024 * 1024,
  imageQuality: 0.85,
  maxDPI: 600,
  label: "法院上传 50MB",
};

export const COURT_UPLOAD_PRESETS: Record<CourtUploadPresetId, CourtUploadPresetConfig> = {
  "court-5mb": COURT_UPLOAD_PRESET_TINY,
  "court-10mb": COURT_UPLOAD_PRESET_SMALL,
  "court-20mb": COURT_UPLOAD_PRESET_MEDIUM,
  "court-50mb": COURT_UPLOAD_PRESET_LARGE,
};

export const COURT_UPLOAD_PRESET_ORDER: CourtUploadPresetId[] = [
  "court-5mb",
  "court-10mb",
  "court-20mb",
  "court-50mb",
];

export function isCourtUploadPreset(preset: string): preset is CourtUploadPresetId {
  return preset in COURT_UPLOAD_PRESETS;
}
