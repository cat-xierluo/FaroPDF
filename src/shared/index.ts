export type {
  BookmarkDocumentRef,
  BookmarkSidecar,
  BookmarkSidecarDocumentRef,
  PdfPageBookmark,
} from "./pdf/bookmark";
export type {
  OcrStatus,
  PdfDocumentState,
  PdfExportJob,
  PdfExportJobStatus,
  PdfExportJobType,
  PdfPageOperation,
  PdfPageOperationType,
  PdfPageViewport,
  PdfViewMode,
  TextLayerStatus,
} from "./pdf/types";
export type {
  PdfPageOrganizerAction,
  PdfPageOrganizerActionType,
  PdfPageOrganizerDocument,
  PdfPageOrganizerHistoryEntry,
  PdfPageOrganizerPage,
  PdfPageOrganizerRotation,
  PdfPageOrganizerState,
} from "./pdf/pageOrganizer";
export type {
  ImagePackCell,
  ImagePackInputItem,
  ImagePackItemsPerPage,
  ImagePackLayoutOptions,
  ImagePackOrientation,
  ImagePackOrientationOption,
  ImagePackPage,
  ImagePackPerPageOption,
  ImagePackPlan,
  ImagePackPlanInput,
  ImagePackSortStrategy,
  ImagePackSourceKind,
  ImagePackSummary,
} from "./pdf/imagePack";
export { A4_LANDSCAPE_SIZE_PT, A4_PORTRAIT_SIZE_PT } from "./pdf/imagePack";
export type {
  PdfAnnotationFlattenPlan,
  PdfAnnotationFlattenPlanEntry,
  PdfAnnotationFlattenStrategy,
  PdfExportDestination,
  PdfExportFileRequest,
  PdfExportOperation,
  PdfExportOperationType,
  PdfExportRequest,
  PdfExportResult,
  PdfExportSource,
  PdfExportSummary,
  PdfBatesNumberOperation,
  PdfCompressionMode,
  PdfCompressionOperation,
  PdfCompressionPreset,
  PdfExtractPagesOperation,
  PdfFlattenAnnotationsOperation,
  PdfFlattenFormOperation,
  PdfInsertPagesOperation,
  PdfInsertBlankPagesOperation,
  PdfMergePdfsOperation,
  PdfFormFlatteningSummary,
  PdfImageWatermarkSpec,
  PdfOutputPlacement,
  PdfOutputToolOperationType,
  PdfOutputToolPlan,
  PdfOutputToolPlanEntry,
  PdfOutputToolStatus,
  PdfPageOperationExportMode,
  PdfPageOperationPlan,
  PdfPageOperationPlanEntry,
  PdfPageOperationsExportOperation,
  PdfPageNumberOperation,
  PdfTextWatermarkSpec,
  PdfWatermarkOperation,
  PdfWatermarkSpec,
} from "./pdf/export";
export type { PdfPageText } from "./pdf/text";
export type {
  PdfFormFieldType,
  PdfFormField,
  PdfFormState,
  PdfFormFillingInput,
  PdfSignatureField,
  PdfSignatureImageType,
  PdfSignatureInput,
  PdfFormFlattenSummary,
  PdfFormOperation,
  PdfFormOperationType,
  PdfFormFillOperation,
  PdfFormSignatureOperation,
  PdfFormFlattenOperation,
  PdfFormOperationResult,
  PdfFormBatchRequest,
  PdfFormBatchResult,
} from "./pdf/form";
export {
  PDF_FORM_FIELD_TYPES,
  PDF_FORM_OPERATION_TYPES,
  isPdfFormFieldType,
  isPdfFormOperationType,
  isPdfFormOperation,
  validateFormFillingInput,
  validateFormBatchRequest,
  validateSignatureInput,
} from "./pdf/form";
export type {
  AnnotationDocumentRef,
  AnnotationSidecar,
  AnnotationSidecarDocumentRef,
  PdfAnnotation,
  PdfAnnotationAuthor,
  PdfAnnotationInk,
  PdfAnnotationInput,
  PdfAnnotationLine,
  PdfAnnotationPatch,
  PdfAnnotationStamp,
  PdfAnnotationStyle,
  PdfAnnotationStrokeStyle,
  PdfAnnotationType,
  PdfPoint,
  PdfRect,
  PdfStampName,
} from "./pdf/annotation";
export type {
  OcrBackend,
  OcrJob,
  OcrJobProgress,
  OcrJobProgressStage,
  OcrJobStatus,
  OcrOutputStrategy,
  OcrPageRange,
  OcrPageRangeSegment,
  OcrProviderBridgeRequest,
  OcrProviderConfig,
  OcrProviderType,
  OcrQualityCheckRequest,
  OcrQualitySummary,
  OcrRequest,
  PreparedOcrRequest,
} from "./ocr/types";
export type {
  OcrQualityCheckInput,
  OcrQualityCheckName,
  OcrQualityCheckResult,
  OcrQualityKeywordHit,
  OcrQualityPageInput,
  OcrQualityProblemPage,
  OcrQualityReport,
  OcrQualityThresholds,
} from "./ocr/quality";
export {
  createDefaultOcrQualityThresholds,
  normalizeOcrQualityThresholds,
  validateOcrQualityInput,
} from "./ocr/quality";
export type {
  OcrCommandJob,
  OcrJobFilter,
  OcrStoredJob,
  OcrStoredProgress,
  OcrStoredQualityCheck,
  OcrStoredQualitySummary,
  OcrStoredRedactedPathSummary,
  OcrTextExtractionPage,
  OcrTextExtractionResponse,
} from "./ocr/jobQueue";
export {
  formatOcrBackendLabel,
  formatOcrStatusLabel,
  isActiveOcrStatus,
  isTerminalOcrStatus,
} from "./ocr/jobQueue";
export type {
  CredentialReferenceInfo,
  CredentialReferenceKind,
} from "./ocr/credentialRef";
export {
  parseCredentialReference,
  summarizeCredentialReference,
} from "./ocr/credentialRef";
export type {
  OcrNetworkConsentDecision,
  OcrPrivacyAuditRecord,
  OcrPrivacyConsentStatus,
  OcrPrivacyNotice,
  OcrPrivacyNoticeVersion,
  RedactedPathSummary,
} from "./security";
export type {
  ScanPreprocessJob,
  ScanPreprocessJobStatus,
  ScanPreprocessOptions,
  ScanPreprocessOutputMode,
  ScanPreprocessProgress,
  ScanPreprocessProgressStage,
  ScanPreprocessRequest,
  ScanPreprocessSummary,
} from "./preprocess/types";
export type { AppSettings, DefaultSavePolicy, RecentPdfFile } from "./settings/types";
export type {
  CreateDocumentManifestInput,
  DocumentBoundary,
  DocumentManifest,
  DocumentManifestPage,
  DocumentNamingSuggestion,
} from "./organizer/types";
export {
  BLANK_PAGE_BOUNDARY_CONFIDENCE,
  BLANK_PAGE_TEXT_THRESHOLD,
  DEFAULT_DOCUMENT_NAME,
  MANIFEST_ID_PREFIX,
  MAX_TEXT_SNIPPET_LENGTH,
  NAMING_CONFIDENCE_EMPTY,
  NAMING_CONFIDENCE_WITH_CONTENT,
  TEXT_LENGTH_CHANGE_CONFIDENCE,
  TEXT_LENGTH_CHANGE_RATIO,
} from "./organizer/types";
export {
  createEmptyManifest,
  createEmptyManifestPage,
  createManifestId,
  createTextSnippet,
  isBlankPage,
  normalizeManifestInput,
  validateManifestInput,
  type ManifestValidationResult,
} from "./organizer/defaults";


/** ISS-064 文档密码保护：复用现有 PdfBytes Source + 输出新副本 */
export interface PasswordChangeRequest {
  input_path: string;
  /** 用户密码：留空 = 沿用旧用户密码（只设置 owner 时） */
  user_password?: string | null;
  /** 拥有者密码：移除时必传；设置时建议与 user 不同 */
  owner_password?: string | null;
}

export interface NativePasswordChangeResult {
  /** 输出 PDF 路径：通常是 "<原名>-secured.pdf" 或 "<原名>-unsecured.pdf" */
  path: string;
  /** 输出文件字节数（用于 UI 显示） */
  size_bytes: number;
}
