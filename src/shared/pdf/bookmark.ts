export interface BookmarkDocumentRef {
  path: string;
  fingerprint?: string;
  pageCount: number;
}

export interface BookmarkSidecarDocumentRef {
  fingerprint?: string;
  pageCount: number;
}

export interface PdfPageBookmark {
  id: string;
  pageIndex: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkSidecar {
  schemaVersion: 1;
  document: BookmarkSidecarDocumentRef;
  bookmarks: PdfPageBookmark[];
  createdAt: string;
  updatedAt: string;
}
