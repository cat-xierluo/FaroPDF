export type AppModeId = "read" | "annotate" | "export" | "forms" | "ocr" | "pages";

export type UtilityPanelId = "summary" | "view" | "settings" | "annotation" | "forms" | "none";

/** 批注 overlay 停靠位置。
 *  当前 stage 4 只实现 "workspace-main"（覆盖 ReaderCanvas 的主区域）；
 *  保留联合类型便于后续扩展（如 "above-toolbar" 浮层）。 */
export type AnnotationOverlayAnchor = "workspace-main";

/** 透传给 AppShell 的批注 armed 状态形状。
 *  state 由 App.tsx 持有，setter 回填——保持单一真相源。
 *  类型来源是 annotation 模块的 AnnotationToolState；这里用 type 形
 *  式重新声明，方便在不引入新模块依赖的情况下被 AppShellProps 引用。 */
export interface AnnotationArmedStateBundle {
  state: import("../../modules/annotation").AnnotationToolState;
  onStateChange: (next: import("../../modules/annotation").AnnotationToolState) => void;
}

/** 用户在 overlay 上完成一次新建后回调的输入形状（与 AnnotationDraftInput 对齐 + pageIndex）。 */
export interface AnnotationDraftSubmission {
  type: import("../../shared/pdf/annotation").PdfAnnotationType;
  pageIndex: number;
  rects: import("../../shared/pdf/annotation").PdfRect[];
  color: string;
  content?: string;
  quote?: string;
  line?: import("../../shared/pdf/annotation").PdfAnnotationLine;
  ink?: import("../../shared/pdf/annotation").PdfAnnotationInk;
  stamp?: { label: string; name: import("../../shared/pdf/annotation").PdfStampName };
}
