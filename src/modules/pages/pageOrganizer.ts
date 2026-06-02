import type {
  PdfExportFileRequest,
  PdfPageOperation,
  PdfPageOrganizerAction,
  PdfPageOrganizerDocument,
  PdfPageOrganizerPage,
  PdfPageOrganizerRotation,
  PdfPageOrganizerState,
} from "../../shared";

export interface CreatePageOrganizerStateInput {
  id?: string;
  pageCount: number;
  sourcePath?: string;
  fingerprint?: string;
  createdAt?: string;
}

export interface PageOrganizerSelectionInput {
  pageIds: string[];
  createdAt?: string;
}

export interface RotateOrganizerPagesInput extends PageOrganizerSelectionInput {
  angle: number;
}

export interface ReorderOrganizerPagesInput extends PageOrganizerSelectionInput {
  toIndex: number;
}

export interface PageOrganizerExportRequestInput {
  id?: string;
  inputPath?: string;
  outputPath?: string;
  requestedAt?: string;
  fingerprint?: string;
}

export function createPageOrganizerState(input: CreatePageOrganizerStateInput): PdfPageOrganizerState {
  if (!Number.isInteger(input.pageCount) || input.pageCount <= 0) {
    throw new Error("页面整理页数必须是正整数。");
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const document: PdfPageOrganizerDocument = {
    pageCount: input.pageCount,
  };

  if (input.sourcePath) {
    document.sourcePath = input.sourcePath;
  }
  if (input.fingerprint) {
    document.fingerprint = input.fingerprint;
  }

  return {
    id: input.id ?? `page-organizer-${createdAt}`,
    document,
    pages: Array.from({ length: input.pageCount }, (_, pageIndex) => ({
      id: `page-${pageIndex + 1}`,
      originalPageIndex: pageIndex,
      originalPageNumber: pageIndex + 1,
      orderIndex: pageIndex,
      rotation: 0,
      deleted: false,
    })),
    actions: [],
    undoStack: [],
    createdAt,
    updatedAt: createdAt,
  };
}

export function rotateOrganizerPages(
  state: PdfPageOrganizerState,
  input: RotateOrganizerPagesInput,
): PdfPageOrganizerState {
  const selectedPages = resolveSelectedPages(state, input.pageIds, { allowDeleted: false });
  const angle = normalizeRotationDelta(input.angle);
  const selectedIds = new Set(selectedPages.map((page) => page.id));
  const nextPages = normalizePageOrder(
    state.pages.map((page) =>
      selectedIds.has(page.id)
        ? {
            ...page,
            rotation: addRotation(page.rotation, angle),
          }
        : clonePage(page),
    ),
  );
  const rotatedPages = nextPages.filter((page) => selectedIds.has(page.id));
  const action = createAction(state, "rotate", rotatedPages, input.createdAt, {
    angle,
    rotation: rotatedPages[0]?.rotation ?? 0,
  });

  return commitStateChange(state, nextPages, action, input.createdAt);
}

export function deleteOrganizerPages(
  state: PdfPageOrganizerState,
  input: PageOrganizerSelectionInput,
): PdfPageOrganizerState {
  const selectedPages = resolveSelectedPages(state, input.pageIds, { allowDeleted: false });
  const selectedIds = new Set(selectedPages.map((page) => page.id));
  const nextPages = normalizePageOrder(
    state.pages.map((page) =>
      selectedIds.has(page.id)
        ? {
            ...page,
            deleted: true,
          }
        : clonePage(page),
    ),
  );
  const action = createAction(state, "delete", selectedPages, input.createdAt, { deleted: true });

  return commitStateChange(state, nextPages, action, input.createdAt);
}

export function restoreOrganizerPages(
  state: PdfPageOrganizerState,
  input: PageOrganizerSelectionInput,
): PdfPageOrganizerState {
  const selectedPages = resolveSelectedPages(state, input.pageIds, { allowDeleted: true });
  if (selectedPages.some((page) => !page.deleted)) {
    throw new Error("只能恢复已删除页面。");
  }

  const selectedIds = new Set(selectedPages.map((page) => page.id));
  const nextPages = normalizePageOrder(
    state.pages.map((page) =>
      selectedIds.has(page.id)
        ? {
            ...page,
            deleted: false,
          }
        : clonePage(page),
    ),
  );
  const action = createAction(state, "restore", selectedPages, input.createdAt, { restored: true });

  return commitStateChange(state, nextPages, action, input.createdAt);
}

export function reorderOrganizerPages(
  state: PdfPageOrganizerState,
  input: ReorderOrganizerPagesInput,
): PdfPageOrganizerState {
  const selectedPages = resolveSelectedPages(state, input.pageIds, { allowDeleted: false });
  const selectedIds = new Set(selectedPages.map((page) => page.id));
  const activePages = state.pages.filter((page) => !page.deleted);
  const remainingActivePages = activePages.filter((page) => !selectedIds.has(page.id));

  if (!Number.isInteger(input.toIndex) || input.toIndex < 0 || input.toIndex > remainingActivePages.length) {
    throw new Error("页面重排目标位置超出范围。");
  }

  const movingPages = activePages.filter((page) => selectedIds.has(page.id));
  const reorderedActivePages = [
    ...remainingActivePages.slice(0, input.toIndex),
    ...movingPages,
    ...remainingActivePages.slice(input.toIndex),
  ];
  const deletedPages = state.pages.filter((page) => page.deleted);
  const nextPages = normalizePageOrder(mergeActiveAndDeletedPages(reorderedActivePages, deletedPages));
  const action = createAction(state, "reorder", selectedPages, input.createdAt, {
    toIndex: input.toIndex,
    orderedPageIndexes: nextPages.map((page) => page.originalPageIndex),
  });

  return commitStateChange(state, nextPages, action, input.createdAt);
}

export function undoPageOrganizer(state: PdfPageOrganizerState): PdfPageOrganizerState {
  const previous = state.undoStack.at(-1);
  if (!previous) {
    return state;
  }

  return {
    ...state,
    pages: previous.pages.map(clonePage),
    actions: previous.actions.map(cloneAction),
    undoStack: state.undoStack.slice(0, -1).map(cloneHistoryEntry),
    updatedAt: previous.updatedAt,
  };
}

export function createPageOrganizerExportRequest(
  state: PdfPageOrganizerState,
  input: PageOrganizerExportRequestInput = {},
): PdfExportFileRequest {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const id = input.id ?? `page-organizer-export-${requestedAt}`;
  const inputPath = (input.inputPath ?? state.document.sourcePath ?? "").trim();

  if (!inputPath) {
    throw new Error("页面整理导出需要原始 PDF 路径。");
  }
  if (!isPdfPath(inputPath)) {
    throw new Error("页面整理输入文件必须是 PDF。");
  }
  validatePageOrganizerState(state);

  const outputPath = (input.outputPath ?? suggestPageOrganizerOutputPath(inputPath)).trim();
  validatePageOrganizerOutputPath(inputPath, outputPath);

  return {
    id,
    inputPath,
    outputPath,
    fingerprint: input.fingerprint ?? state.document.fingerprint,
    operations: [
      {
        id: `${id}-page-operations`,
        type: "page-operations",
        mode: "plan-only",
        operations: buildPageOperations(state, id, requestedAt),
      },
    ],
    requestedAt,
  };
}

export function suggestPageOrganizerOutputPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const directory = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex + 1) : "";
  const fileName = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
  const stem = fileName.toLowerCase().endsWith(".pdf") ? fileName.slice(0, -4) : fileName;
  const safeStem = stem.length > 0 ? stem : "document";

  return `${directory}${safeStem}-organized.pdf`;
}

function buildPageOperations(
  state: PdfPageOrganizerState,
  exportId: string,
  requestedAt: string,
): PdfPageOperation[] {
  const operations: PdfPageOperation[] = [];
  const deletedPageIndexes = state.pages
    .filter((page) => page.deleted)
    .map((page) => page.originalPageIndex)
    .sort((left, right) => left - right);
  const activePages = state.pages.filter((page) => !page.deleted);
  const orderedPageIndexes = activePages.map((page) => page.originalPageIndex);
  const naturalActiveOrder = Array.from({ length: state.document.pageCount }, (_, pageIndex) => pageIndex).filter(
    (pageIndex) => !deletedPageIndexes.includes(pageIndex),
  );

  if (!arraysEqual(orderedPageIndexes, naturalActiveOrder)) {
    operations.push({
      id: `${exportId}-reorder`,
      type: "reorder",
      pageIndexes: orderedPageIndexes,
      payload: {
        orderedPageIndexes,
        deletedPageIndexes,
      },
      createdAt: requestedAt,
    });
  }

  for (const page of activePages) {
    if (page.rotation === 0) {
      continue;
    }

    operations.push({
      id: `${exportId}-rotate-page-${page.originalPageNumber}`,
      type: "rotate",
      pageIndexes: [page.originalPageIndex],
      payload: {
        angle: page.rotation,
        rotation: page.rotation,
      },
      createdAt: requestedAt,
    });
  }

  if (deletedPageIndexes.length > 0) {
    operations.push({
      id: `${exportId}-delete`,
      type: "delete",
      pageIndexes: deletedPageIndexes,
      payload: {
        deleted: true,
      },
      createdAt: requestedAt,
    });
  }

  return operations;
}

function commitStateChange(
  state: PdfPageOrganizerState,
  nextPages: PdfPageOrganizerPage[],
  action: PdfPageOrganizerAction,
  updatedAtInput?: string,
): PdfPageOrganizerState {
  const updatedAt = updatedAtInput ?? new Date().toISOString();

  return {
    ...state,
    pages: nextPages,
    actions: [...state.actions.map(cloneAction), action],
    undoStack: [
      ...state.undoStack.map(cloneHistoryEntry),
      {
        pages: state.pages.map(clonePage),
        actions: state.actions.map(cloneAction),
        updatedAt: state.updatedAt,
      },
    ],
    updatedAt,
  };
}

function createAction(
  state: PdfPageOrganizerState,
  type: PdfPageOrganizerAction["type"],
  pages: PdfPageOrganizerPage[],
  createdAtInput: string | undefined,
  payload: Record<string, unknown>,
): PdfPageOrganizerAction {
  return {
    id: `page-organizer-action-${state.actions.length + 1}-${type}`,
    type,
    pageIds: pages.map((page) => page.id),
    pageIndexes: pages.map((page) => page.originalPageIndex),
    payload,
    createdAt: createdAtInput ?? new Date().toISOString(),
  };
}

function resolveSelectedPages(
  state: PdfPageOrganizerState,
  pageIds: string[],
  options: { allowDeleted: boolean },
): PdfPageOrganizerPage[] {
  const uniquePageIds = Array.from(new Set(pageIds));
  if (uniquePageIds.length === 0) {
    throw new Error("页面整理操作至少需要选择一页。");
  }

  const pagesById = new Map(state.pages.map((page) => [page.id, page]));
  const pages = uniquePageIds.map((pageId) => {
    const page = pagesById.get(pageId);
    if (!page) {
      throw new Error("页面整理操作包含不存在的页面。");
    }
    if (!options.allowDeleted && page.deleted) {
      throw new Error("不能操作已删除页面，请先恢复。");
    }
    return page;
  });

  return pages;
}

function normalizePageOrder(pages: PdfPageOrganizerPage[]): PdfPageOrganizerPage[] {
  return pages.map((page, orderIndex) => ({
    ...page,
    orderIndex,
  }));
}

function normalizeRotationDelta(angle: number): PdfPageOrganizerRotation {
  if (!Number.isFinite(angle)) {
    throw new Error("页面旋转角度必须是 90 度的倍数。");
  }

  const normalized = ((angle % 360) + 360) % 360;
  if (![90, 180, 270].includes(normalized)) {
    throw new Error("页面旋转角度必须是 90、180 或 270 度。");
  }

  return normalized as PdfPageOrganizerRotation;
}

function addRotation(current: PdfPageOrganizerRotation, angle: PdfPageOrganizerRotation): PdfPageOrganizerRotation {
  return (((current + angle) % 360) as PdfPageOrganizerRotation) || 0;
}

function validatePageOrganizerOutputPath(inputPath: string, outputPath: string): void {
  if (!outputPath) {
    throw new Error("页面整理输出 PDF 路径不能为空。");
  }
  if (!isPdfPath(outputPath)) {
    throw new Error("页面整理输出文件必须是 PDF。");
  }
  if (!isAbsolutePath(outputPath)) {
    throw new Error("页面整理输出路径必须是绝对路径。");
  }
  if (samePath(inputPath, outputPath)) {
    throw new Error("页面整理输出 PDF 必须是不同于原始 PDF 的新文件。");
  }
}

function validatePageOrganizerState(state: PdfPageOrganizerState): void {
  if (!Number.isInteger(state.document.pageCount) || state.document.pageCount <= 0) {
    throw new Error("页面整理状态页数必须是正整数。");
  }
  if (state.pages.length !== state.document.pageCount) {
    throw new Error("页面整理状态页码必须唯一且覆盖源 PDF。");
  }

  const indexes = state.pages.map((page) => page.originalPageIndex);
  const uniqueIndexes = new Set(indexes);
  const coversSourcePdf = indexes.every((pageIndex) => isPageIndexInRange(pageIndex, state.document.pageCount));
  if (uniqueIndexes.size !== state.document.pageCount || !coversSourcePdf) {
    throw new Error("页面整理状态页码必须唯一且覆盖源 PDF。");
  }
}

function mergeActiveAndDeletedPages(
  activePages: PdfPageOrganizerPage[],
  deletedPages: PdfPageOrganizerPage[],
): PdfPageOrganizerPage[] {
  const mergedPages = activePages.map(clonePage);
  const sortedDeletedPages = [...deletedPages].sort(
    (left, right) => left.originalPageIndex - right.originalPageIndex,
  );

  for (const deletedPage of sortedDeletedPages) {
    let insertAfterIndex = -1;
    for (let pageIndex = 0; pageIndex < mergedPages.length; pageIndex += 1) {
      const page = mergedPages[pageIndex];
      if (page.originalPageIndex < deletedPage.originalPageIndex) {
        insertAfterIndex = pageIndex;
      }
    }

    mergedPages.splice(insertAfterIndex + 1, 0, clonePage(deletedPage));
  }

  return mergedPages;
}

function isPdfPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith(".pdf");
}

function isAbsolutePath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
}

function isPageIndexInRange(pageIndex: number, pageCount: number): boolean {
  return Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < pageCount;
}

function samePath(left: string, right: string): boolean {
  return normalizePathForComparison(left) === normalizePathForComparison(right);
}

function normalizePathForComparison(path: string): string {
  const normalizedSeparators = path.trim().replace(/\\/g, "/");
  const driveMatch = /^([A-Za-z]:)(.*)$/.exec(normalizedSeparators);
  const drivePrefix = driveMatch?.[1]?.toLowerCase() ?? "";
  const pathBody = driveMatch ? driveMatch[2] : normalizedSeparators;
  const isAbsolute = pathBody.startsWith("/");
  const parts: string[] = [];

  for (const part of pathBody.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      const lastPart = parts.at(-1);
      if (lastPart && lastPart !== "..") {
        parts.pop();
      } else if (!isAbsolute) {
        parts.push(part);
      }
      continue;
    }

    parts.push(part);
  }

  const prefix = `${drivePrefix}${isAbsolute ? "/" : ""}`;
  return `${prefix}${parts.join("/")}`.replace(/\/+$/, "").toLowerCase();
}

function arraysEqual(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function clonePage(page: PdfPageOrganizerPage): PdfPageOrganizerPage {
  return { ...page };
}

function cloneAction(action: PdfPageOrganizerAction): PdfPageOrganizerAction {
  return {
    ...action,
    pageIds: [...action.pageIds],
    pageIndexes: [...action.pageIndexes],
    payload: { ...action.payload },
  };
}

function cloneHistoryEntry(entry: PdfPageOrganizerState["undoStack"][number]): PdfPageOrganizerState["undoStack"][number] {
  return {
    pages: entry.pages.map(clonePage),
    actions: entry.actions.map(cloneAction),
    updatedAt: entry.updatedAt,
  };
}
