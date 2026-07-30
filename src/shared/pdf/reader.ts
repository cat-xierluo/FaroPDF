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

/**
 * ISS-NEW-M M4：PDF 大纲（outline / bookmark destination）树节点。
 * 从 PDF.js `getOutline()` 读取并归一化：`pageNumber` 为 1-based 目标页（解析 destination 得到）；
 * 解析失败的节点 `pageNumber` 为 undefined（仍展示标题，点击禁用）。`depth` 用于缩进层级。
 */
export interface OutlineNode {
  title: string;
  pageNumber?: number;
  depth: number;
  children: OutlineNode[];
}
