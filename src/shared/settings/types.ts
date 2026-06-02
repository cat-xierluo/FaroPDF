import type { OcrProviderConfig } from "../ocr/types";
import type { PdfViewMode } from "../pdf/types";

export type DefaultSavePolicy = "always-export-copy" | "ask-each-time" | "allow-overwrite-with-confirmation";

export interface RecentPdfFile {
  path: string;
  name: string;
  lastOpenedAt: string;
  lastPage?: number;
  lastZoom?: number;
}

export interface AppSettings {
  defaultSaveDirectory?: string;
  defaultZoom: number;
  defaultViewMode: PdfViewMode;
  defaultSavePolicy: DefaultSavePolicy;
  recentFiles: RecentPdfFile[];
  defaultOcrProviderId?: string;
  ocrProviders: OcrProviderConfig[];
  requireNetworkOcrConfirmation: boolean;
}
