export const A4_PORTRAIT_SIZE_PT = { width: 595, height: 842 } as const;
export const A4_LANDSCAPE_SIZE_PT = { width: 842, height: 595 } as const;

export type ImagePackSourceKind = "image" | "pdf-page";

export type ImagePackItemsPerPage = 1 | 2 | 3 | 4;
export type ImagePackPerPageOption = ImagePackItemsPerPage | "auto";
export type ImagePackOrientationOption = "portrait" | "landscape" | "auto";
export type ImagePackOrientation = "portrait" | "landscape";
export type ImagePackSortStrategy = "name" | "time" | "none";

export interface ImagePackInputItem {
  id: string;
  source: ImagePackSourceKind;
  sourcePath?: string;
  sourcePageIndex?: number;
  width: number;
  height: number;
  label?: string;
}

export interface ImagePackLayoutOptions {
  itemsPerPage?: ImagePackPerPageOption;
  orientation?: ImagePackOrientationOption;
  margin?: number;
  sort?: ImagePackSortStrategy;
}

export interface ImagePackCell {
  itemId: string;
  col: number;
  row: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ImagePackPage {
  pageNumber: number;
  width: number;
  height: number;
  orientation: ImagePackOrientation;
  cells: ImagePackCell[];
}

export interface ImagePackSummary {
  inputItemCount: number;
  outputPageCount: number;
  itemsPerPage: ImagePackItemsPerPage;
  portraitItemCount: number;
  landscapeItemCount: number;
  squareItemCount: number;
  orientationPageCounts: {
    portrait: number;
    landscape: number;
  };
  selectedOrientation: ImagePackOrientationOption;
  selectedItemsPerPageOption: ImagePackPerPageOption;
}

export interface ImagePackPlan {
  id: string;
  items: ImagePackInputItem[];
  options: {
    itemsPerPage: ImagePackItemsPerPage;
    itemsPerPageOption: ImagePackPerPageOption;
    orientation: ImagePackOrientationOption;
    margin: number;
    sort: ImagePackSortStrategy;
  };
  outputPath: string;
  pages: ImagePackPage[];
  summary: ImagePackSummary;
  warnings: string[];
  createdAt: string;
}

export interface ImagePackPlanInput {
  items: ImagePackInputItem[];
  options?: ImagePackLayoutOptions;
  outputPath?: string;
  id?: string;
  createdAt?: string;
}
