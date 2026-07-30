export type PdfPageOrganizerRotation = 0 | 90 | 180 | 270;

export type PdfPageOrganizerActionType = "rotate" | "delete" | "reorder" | "restore" | "paste";

export interface PdfPageOrganizerDocument {
  pageCount: number;
  sourcePath?: string;
  fingerprint?: string;
}

export interface PdfPageOrganizerPage {
  id: string;
  originalPageIndex: number;
  originalPageNumber: number;
  orderIndex: number;
  rotation: PdfPageOrganizerRotation;
  deleted: boolean;
}

export interface PdfPageOrganizerAction {
  id: string;
  type: PdfPageOrganizerActionType;
  pageIds: string[];
  pageIndexes: number[];
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface PdfPageOrganizerHistoryEntry {
  pages: PdfPageOrganizerPage[];
  actions: PdfPageOrganizerAction[];
  updatedAt: string;
}

export interface PdfPageOrganizerState {
  id: string;
  document: PdfPageOrganizerDocument;
  pages: PdfPageOrganizerPage[];
  actions: PdfPageOrganizerAction[];
  undoStack: PdfPageOrganizerHistoryEntry[];
  /**
   * ISS-NEW-M M3：页面剪贴板。复制时写入源页索引与旋转角；粘贴时按此克隆页插入。
   * 同文档内复制：存 originalPageIndex 引用 + rotation，不缓存字节（导出时 copyPages 支持
   * 重复索引）。空剪贴板时为 undefined。
   */
  clipboard?: {
    sourcePageIndexes: number[];
    rotations: PdfPageOrganizerRotation[];
    copiedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}
