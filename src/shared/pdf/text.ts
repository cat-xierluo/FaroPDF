import type { TextLayerStatus } from "./types";

export interface PdfPageText {
  pageIndex: number;
  text: string;
  status: TextLayerStatus;
  itemCount: number;
  charCount: number;
}
