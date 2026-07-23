export type AppModeId = "read" | "annotate" | "export" | "forms" | "ocr" | "pages";

/** ISS-NEW-A 阶段 1：Toolbar 5 段 id（与 Toolbar.tsx data-section 一一对应）。
 *  - sidebar-toggles: 侧栏切换 4 个按钮（摘要 / 页面 / 视图设置 / 书签）
 *  - file:           打开按钮（隐藏 file input）
 *  - reading:        页码导航 + 缩放 +/- + 视图模式 4-icon toggle
 *  - mode:           A 批注 / T 编辑 按钮
 *  - right:          搜索框 + 工具 launcher + 设置
 */
export type AppToolbarSectionId =
  | "sidebar-toggles"
  | "file"
  | "reading"
  | "mode"
  | "right";

export type UtilityPanelId =
  | "summary"
  | "view"
  | "settings"
  | "annotation"
  | "forms"
  /** ISS-064：文档安全面板（设置 / 移除密码），从导出工具启动器入口进入 */
  | "security"
  /** ISS-NEW-A 阶段 2 收口（2026-06-22）：侧栏书签面板（占位 — 真实书签列表 + 添加 / 跳转 留后续）。 */
  | "bookmark"
  | "none";

/** 右侧模式驱动栏 id。
 *  - 由 AppShell 通过 activeMode 推导 + 显式 rightPanel 覆盖
 *  - 「none」= 右栏折叠
 *  DEC-173：shape/search 的现有分段只是历史 skeleton，不是可靠截图合同；
 *  具体层级待 ISS-NEW-M M1 重采量测。
 */
export type RightPanelId =
  | "stamps"
  | "signatures"
  | "export-preview"
  | "ocr-queue"
  /** 右栏文档摘要 skeleton；字段层级待 M1 验证。 */
  | "summary"
  /** 右栏 OCR 状态 skeleton；参考状态待 M1 重采。 */
  | "ocr-status"
  /** 右栏形状工具 skeleton；真实层级待 M1。 */
  | "shape"
  /** 右栏搜索结果 skeleton；真实层级待 M1。 */
  | "search"
  | "none";

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
