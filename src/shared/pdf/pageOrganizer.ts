export type PdfPageOrganizerRotation = 0 | 90 | 180 | 270;

export type PdfPageOrganizerActionType = "rotate" | "delete" | "reorder" | "restore";

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
  createdAt: string;
  updatedAt: string;
}
