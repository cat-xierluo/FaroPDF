export {
  ANNOTATION_SIDECAR_SCHEMA_VERSION,
  buildAnnotationSidecar,
  deriveAnnotationSidecarPath,
  parseAnnotationSidecar,
  serializeAnnotationSidecar,
} from "./sidecar";
export { AnnotationRepository, createMemoryAnnotationStorage } from "./repository";
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
export { STAMP_TEMPLATES, STAMP_TEMPLATE_LIST, renderStampSvg, resolveStampTemplate } from "./stamps";
export type { StampTemplate } from "./stamps";
export type { AnnotationSummary, AnnotationSummaryGroup, AnnotationSummaryItem } from "./summary";
