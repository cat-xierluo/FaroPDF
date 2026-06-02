import type { PdfPageViewport, TextLayerStatus } from "./types";

export interface ReaderLoadedMetadata {
  fileName: string;
  filePath?: string;
  fingerprint?: string;
  pageCount: number;
  initialViewport: PdfPageViewport;
  textLayerStatus: TextLayerStatus;
}

export interface ReaderByteLoadInput {
  data: Uint8Array;
  fileName: string;
  filePath?: string;
}
