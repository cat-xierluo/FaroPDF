export {
  OcrJobList,
  OcrModeToolbar,
  OcrQualityReportView,
  type OcrJobListProps,
  type OcrModeToolbarProps,
  type OcrQualityReportViewProps,
} from "./ui/OcrModeToolbar";

export { OcrWorkspace, type OcrWorkspaceProps } from "./ui/OcrWorkspace";
export {
  deriveLayeredOutputPath,
  useOcrWorkspaceController,
  type OcrWorkspaceController,
  type UseOcrWorkspaceControllerOptions,
} from "./ui/useOcrWorkspaceController";

export {
  commandJobToOcrJob,
  createTauriOcrJobController,
  filterOcrJobs,
  type OcrJobController,
} from "./service/ocrJobController";

export {
  createOcrPostProcessor,
  type OcrPostProcessInput,
  type OcrPostProcessor,
} from "./quality/ocrPostProcessor";

export { createOcrBridgeService, createTauriOcrBridgeBackend } from "./service/bridge";
export type { OcrBridgeBackend, OcrBridgeService, OcrProviderAdapter } from "./service/bridge";

export { createOcrPrivacyConsentGuard } from "./privacy/consentGuard";
export type {
  OcrPrivacyConsentGuard,
  OcrPrivacyConsentGuardInput,
  OcrPrivacyConsentGuardResult,
} from "./privacy/consentGuard";

export { createOcrQualityCheckService } from "./quality/qualityCheckService";
export type { OcrQualityCheckService } from "./quality/qualityCheckService";

// ISS-069 阶段 1：OCR 后自动生成目录（纯函数 + pdf-lib 写 outline）
export {
  buildOutlineTree,
  buildOutlineTreeFromPages,
  clusterBySizeAndFont,
  detectChapterHeadings,
  extractTextItems,
  type ChapterHeading,
  type ChapterHeadingNode,
  type ExtractTextItemsOptions,
  type PdfJsTextContentLike,
  type TextItemCluster,
  type TextItemFeature,
} from "./autoToc";

export { writePdfOutline, type WriteOutlineOptions } from "./writePdfOutline";
