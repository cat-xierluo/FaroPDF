export type FaroPdfModuleId =
  | "reader"
  | "search"
  | "annotation"
  | "pages"
  | "export"
  | "preprocess"
  | "ocr"
  | "forms"
  | "settings";

export interface ModuleBoundary {
  id: FaroPdfModuleId;
  label: string;
  ownedPaths: string[];
  sharedContracts: string[];
  verification: string[];
}

export const FAROPDF_MODULES: ModuleBoundary[] = [
  {
    id: "reader",
    label: "PDF 阅读",
    ownedPaths: ["src/modules/reader"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "search",
    label: "文本搜索",
    ownedPaths: ["src/modules/search"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "annotation",
    label: "批注",
    ownedPaths: ["src/modules/annotation"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "pages",
    label: "页面整理",
    ownedPaths: ["src/modules/pages"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "export",
    label: "PDF 导出",
    ownedPaths: ["src/modules/export"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "preprocess",
    label: "扫描预处理",
    ownedPaths: ["src/modules/preprocess"],
    sharedContracts: ["src/shared/preprocess", "src/shared/pdf"],
    verification: ["npm run typecheck", "npm test", "cd src-tauri && cargo check"],
  },
  {
    id: "ocr",
    label: "OCR",
    ownedPaths: ["src/modules/ocr"],
    sharedContracts: ["src/shared/ocr", "src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "forms",
    label: "表单签署",
    ownedPaths: ["src/modules/forms"],
    sharedContracts: ["src/shared/pdf"],
    verification: ["npm run typecheck", "npm test"],
  },
  {
    id: "settings",
    label: "设置",
    ownedPaths: ["src/modules/settings"],
    sharedContracts: ["src/shared/settings", "src/shared/ocr"],
    verification: ["npm run typecheck", "npm test"],
  },
];

export function getModuleBoundary(id: FaroPdfModuleId): ModuleBoundary {
  const boundary = FAROPDF_MODULES.find((module) => module.id === id);

  if (!boundary) {
    throw new Error(`Unknown FaroPDF module: ${id}`);
  }

  return boundary;
}
