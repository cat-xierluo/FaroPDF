export {
  ANNOTATION_SIDECAR_SCHEMA_VERSION,
  buildAnnotationSidecar,
  deriveAnnotationSidecarPath,
  parseAnnotationSidecar,
  serializeAnnotationSidecar,
} from "./sidecar";
export {
  AnnotationRepository,
  createLocalStorageAnnotationStorage,
  createMemoryAnnotationStorage,
} from "./repository";
export { AnnotationService } from "./service";
export {
  buildAnnotationSummary,
  exportAnnotationSummaryHtml,
  exportAnnotationSummaryMarkdown,
} from "./summary";
export {
  ANNOTATION_TOOL_LIST,
  ANNOTATION_TOOL_MAP,
  ANNOTATION_COLOR_SWATCHES,
  DEFAULT_ANNOTATION_COLOR,
  armAnnotationTool,
  createInitialAnnotationToolState,
  disarmAnnotationTool,
  setAnnotationColor,
  setAnnotationStampLabel,
  setAnnotationStampName,
} from "./toolbarModel";
export type { AnnotationColorSwatch, AnnotationToolDescriptor, AnnotationToolInteraction, AnnotationToolState } from "./toolbarModel";
export {
  annotationBoundingRect,
  clampRectToBounds,
  inkStrokesToRect,
  isRectWithinBounds,
  lineToRect,
  normalizeRect,
  pointsToRect,
  recomputeInkRects,
  recomputeLineRects,
  sanitizeRects,
  unionRects,
} from "./geometry";
export {
  collectAnnotationSearchHaystack,
  matchesColorFilter,
  matchesPageFilter,
  matchesQuery,
  matchesTypeFilter,
  searchAnnotations,
} from "./search";
export type { AnnotationSearchOptions } from "./search";
export { STAMP_TEMPLATES, STAMP_TEMPLATE_LIST, renderStampSvg, renderStampPreview, resolveStampTemplate, DEFAULT_STAMP_PREVIEW_HEIGHT, DEFAULT_STAMP_PREVIEW_WIDTH, STAMP_PREVIEW_VIEWBOX_WIDTH, STAMP_PREVIEW_VIEWBOX_HEIGHT } from "./stamps";
export type { StampTemplate, RenderStampPreviewOptions } from "./stamps";
export type { AnnotationSummary, AnnotationSummaryGroup, AnnotationSummaryItem } from "./summary";
export {
  ANNOTATION_SIDEBAR_COLOR_CHOICES,
  ANNOTATION_SIDEBAR_GROUP_BY_LABELS,
  ANNOTATION_SIDEBAR_GROUP_BY_LIST,
  ANNOTATION_SIDEBAR_TYPE_CHOICES,
  applyAnnotationSidebarFilters,
  collectAnnotationLabelChoices,
  deriveAnnotationLabel,
  filterAnnotationsByOptions,
  groupAnnotations,
  groupAnnotationsByColor,
  groupAnnotationsByLabel,
  groupAnnotationsByPage,
  groupAnnotationsByType,
  sidebarFiltersFromSearch,
  sidebarFiltersToSearch,
} from "./sidebarGroups";
export type {
  AnnotationSidebarFilterState,
  AnnotationSidebarGroup,
  AnnotationSidebarGroupBy,
} from "./sidebarGroups";
export {
  writeAnnotationPdf,
  degrees as annotationWriterDegrees,
} from "./annotationPdfWriter";
export type {
  AnnotationPdfWriteSummary,
  WriteAnnotationPdfInput,
  WriteAnnotationPdfResult,
} from "./annotationPdfWriter";
export { resolveStampFont } from "./annotationStampFont";
export type { ResolveStampFontOptions } from "./annotationStampFont";
export {
  AnnotationSummaryPanel,
  buildDimensionSummary,
  buildFullSummary,
  exportChecklistMarkdown,
  exportChecklistHtml,
  SUMMARY_DIMENSIONS,
  SUMMARY_DIMENSION_LABELS,
  useAnnotationSummary,
} from "../annotation-summary";
export type {
  AnnotationSummaryPanelProps,
  UseAnnotationSummaryResult,
  SummaryDimension,
  SummaryDimensionResult,
  SummaryGroupEntry,
  AnnotationSummaryResult,
} from "../annotation-summary";
