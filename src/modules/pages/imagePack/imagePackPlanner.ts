import {
  A4_LANDSCAPE_SIZE_PT,
  A4_PORTRAIT_SIZE_PT,
  type ImagePackCell,
  type ImagePackInputItem,
  type ImagePackItemsPerPage,
  type ImagePackLayoutOptions,
  type ImagePackOrientation,
  type ImagePackOrientationOption,
  type ImagePackPage,
  type ImagePackPerPageOption,
  type ImagePackPlan,
  type ImagePackPlanInput,
  type ImagePackSortStrategy,
  type ImagePackSummary,
} from "../../../shared";

const DEFAULT_MARGIN_PT = 25;
const DEFAULT_ITEMS_PER_PAGE: ImagePackPerPageOption = "auto";
const DEFAULT_ORIENTATION: ImagePackOrientationOption = "auto";
const DEFAULT_SORT: ImagePackSortStrategy = "name";
const FIXED_OUTPUT_STEM_SUFFIX = "-evidence-pack";

const VALID_PER_PAGE = new Set<number>([1, 2, 3, 4]);
const VALID_ORIENTATIONS = new Set<ImagePackOrientationOption>(["portrait", "landscape", "auto"]);
const VALID_SORTS = new Set<ImagePackSortStrategy>(["name", "time", "none"]);
const VALID_SOURCES = new Set(["image", "pdf-page"] as const);
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp", ".heic"];

export function createImagePackPlan(input: ImagePackPlanInput): ImagePackPlan {
  validateItems(input.items);

  const options = normalizeOptions(input.options);
  const sortedItems = sortItems(input.items, options.sort);
  const itemOrientationCounts = countItemOrientations(sortedItems);
  const resolvedPerPage = resolveItemsPerPage(options.itemsPerPage, itemOrientationCounts);

  const explicitOutputPath = normalizeOptionalString(input.outputPath);
  const firstSourcePathValue = firstAvailableSourcePath(sortedItems);
  const outputPath = resolveOutputPath(explicitOutputPath, firstSourcePathValue);

  validateMarginForLayout(options.margin, resolvedPerPage, options.orientation);
  validateOutputPath(outputPath, sortedItems);

  const pages = buildPages(sortedItems, resolvedPerPage, options.orientation, options.margin);
  const summary = buildSummary(sortedItems, pages, options, itemOrientationCounts, resolvedPerPage);
  const warnings = buildWarnings(options.sort);

  return {
    id: input.id ?? `image-pack-${input.createdAt ?? new Date().toISOString()}`,
    items: sortedItems.map(cloneItem),
    options: {
      itemsPerPage: resolvedPerPage,
      itemsPerPageOption: options.itemsPerPage,
      orientation: options.orientation,
      margin: options.margin,
      sort: options.sort,
    },
    outputPath,
    pages,
    summary,
    warnings,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function suggestImagePackOutputPath(firstItemPath: string | undefined): string {
  if (!firstItemPath || firstItemPath.trim().length === 0) {
    return "evidence-pack.pdf";
  }

  const trimmed = firstItemPath.trim();
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const directory = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex + 1) : "";
  const fileName = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
  const stem = stripKnownExtension(fileName) || "evidence";
  return `${directory}${stem}${FIXED_OUTPUT_STEM_SUFFIX}.pdf`;
}

interface NormalizedOptions {
  itemsPerPage: ImagePackPerPageOption;
  orientation: ImagePackOrientationOption;
  margin: number;
  sort: ImagePackSortStrategy;
}

interface ItemOrientationCounts {
  portrait: number;
  landscape: number;
  square: number;
}

function validateItems(items: ImagePackInputItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("证据图片编排至少需要一个条目。");
  }

  const seenIds = new Set<string>();
  items.forEach((item, index) => {
    if (!item || typeof item.id !== "string" || item.id.length === 0) {
      throw new Error(`第 ${index + 1} 个条目缺少 id。`);
    }
    if (seenIds.has(item.id)) {
      throw new Error(`证据图片条目 id 重复：${item.id}`);
    }
    seenIds.add(item.id);
    if (!VALID_SOURCES.has(item.source as (typeof VALID_SOURCES extends Set<infer T> ? T : never))) {
      throw new Error(`条目 ${item.id} 的 source 必须是 image 或 pdf-page。`);
    }
    if (!Number.isFinite(item.width) || !Number.isFinite(item.height)) {
      throw new Error(`条目 ${item.id} 的宽高必须是有限数字。`);
    }
    if (item.width <= 0 || item.height <= 0) {
      throw new Error(`条目 ${item.id} 的宽高必须大于 0。`);
    }
  });
}

function normalizeOptions(options: ImagePackLayoutOptions | undefined): NormalizedOptions {
  if (!options) {
    return {
      itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
      orientation: DEFAULT_ORIENTATION,
      margin: DEFAULT_MARGIN_PT,
      sort: DEFAULT_SORT,
    };
  }

  const itemsPerPage = options.itemsPerPage ?? DEFAULT_ITEMS_PER_PAGE;
  if (itemsPerPage !== "auto" && !VALID_PER_PAGE.has(itemsPerPage)) {
    throw new Error("itemsPerPage 必须是 1、2、3、4 或 auto。");
  }

  const orientation = options.orientation ?? DEFAULT_ORIENTATION;
  if (!VALID_ORIENTATIONS.has(orientation)) {
    throw new Error("orientation 必须是 portrait、landscape 或 auto。");
  }

  const margin = options.margin ?? DEFAULT_MARGIN_PT;
  if (!Number.isFinite(margin) || margin < 0) {
    throw new Error("margin 必须是非负有限数。");
  }

  const sort = options.sort ?? DEFAULT_SORT;
  if (!VALID_SORTS.has(sort)) {
    throw new Error("sort 必须是 name、time 或 none。");
  }

  return { itemsPerPage, orientation, margin, sort };
}

function sortItems(items: ImagePackInputItem[], sort: ImagePackSortStrategy): ImagePackInputItem[] {
  const copy = items.map(cloneItem);
  if (sort === "none") {
    return copy;
  }
  if (sort === "name") {
    copy.sort(compareByName);
    return copy;
  }
  return copy;
}

function buildWarnings(sort: ImagePackSortStrategy): string[] {
  if (sort === "time") {
    return [
      "sort=time 当前保持输入顺序：plan-only 模型未携带 mtime，待真实文件扫描时再补 modifiedAt 排序。",
    ];
  }
  return [];
}

function compareByName(left: ImagePackInputItem, right: ImagePackInputItem): number {
  const leftKey = (left.label ?? left.sourcePath ?? left.id).toLowerCase();
  const rightKey = (right.label ?? right.sourcePath ?? right.id).toLowerCase();
  if (leftKey < rightKey) {
    return -1;
  }
  if (leftKey > rightKey) {
    return 1;
  }
  return 0;
}

function countItemOrientations(items: ImagePackInputItem[]): ItemOrientationCounts {
  let portrait = 0;
  let landscape = 0;
  let square = 0;
  for (const item of items) {
    if (item.width > item.height) {
      landscape += 1;
    } else if (item.height > item.width) {
      portrait += 1;
    } else {
      square += 1;
    }
  }
  return { portrait, landscape, square };
}

function resolveItemsPerPage(
  option: ImagePackPerPageOption,
  counts: ItemOrientationCounts,
): ImagePackItemsPerPage {
  if (option === "auto") {
    return counts.portrait >= counts.landscape ? 3 : 1;
  }
  return option;
}

function firstAvailableSourcePath(items: ImagePackInputItem[]): string | undefined {
  for (const item of items) {
    if (item.sourcePath) {
      return item.sourcePath;
    }
  }
  return undefined;
}

function resolveOutputPath(explicitPath: string | undefined, firstSource: string | undefined): string {
  if (explicitPath) {
    return explicitPath;
  }
  if (firstSource) {
    return suggestImagePackOutputPath(firstSource);
  }
  throw new Error(
    "证据图片输出路径无法自动推导：所有条目都没有 sourcePath，请显式提供 outputPath。",
  );
}

function validateMarginForLayout(
  margin: number,
  itemsPerPage: ImagePackItemsPerPage,
  orientation: ImagePackOrientationOption,
): void {
  const layouts = layoutCasesFor(itemsPerPage, orientation);
  for (const layout of layouts) {
    const cellHeight = layout.height - 2 * margin;
    const cellWidth =
      itemsPerPage === 1
        ? layout.width - 2 * margin
        : (layout.width - (itemsPerPage + 1) * margin) / itemsPerPage;
    if (cellHeight <= 0 || cellWidth <= 0) {
      throw new Error(
        `margin ${margin} 过大：在 ${layout.label} + ${itemsPerPage}/页 的布局下，单元格宽高将非正。` +
          `请把 margin 调整为小于 ${maxSafeMargin(layout.width, layout.height, itemsPerPage)}。`,
      );
    }
  }
}

interface LayoutCase {
  width: number;
  height: number;
  label: string;
}

function layoutCasesFor(
  itemsPerPage: ImagePackItemsPerPage,
  orientation: ImagePackOrientationOption,
): LayoutCase[] {
  const portrait: LayoutCase = {
    width: A4_PORTRAIT_SIZE_PT.width,
    height: A4_PORTRAIT_SIZE_PT.height,
    label: "A4 portrait",
  };
  const landscape: LayoutCase = {
    width: A4_LANDSCAPE_SIZE_PT.width,
    height: A4_LANDSCAPE_SIZE_PT.height,
    label: "A4 landscape",
  };
  if (orientation === "portrait") {
    return [portrait];
  }
  if (orientation === "landscape") {
    return [landscape];
  }
  if (itemsPerPage === 1) {
    return [portrait, landscape];
  }
  return [landscape];
}

function maxSafeMargin(width: number, height: number, itemsPerPage: ImagePackItemsPerPage): number {
  const heightLimit = height / 2;
  const widthLimit = itemsPerPage === 1 ? width / 2 : width / (itemsPerPage + 1);
  return Math.min(heightLimit, widthLimit);
}

function buildPages(
  items: ImagePackInputItem[],
  itemsPerPage: ImagePackItemsPerPage,
  orientation: ImagePackOrientationOption,
  margin: number,
): ImagePackPage[] {
  const pages: ImagePackPage[] = [];
  for (let start = 0; start < items.length; start += itemsPerPage) {
    const chunk = items.slice(start, start + itemsPerPage);
    const pageSize = resolvePageSize(chunk, itemsPerPage, orientation);
    const cells = buildCellsForChunk(chunk, pageSize.width, pageSize.height, itemsPerPage, margin);
    pages.push({
      pageNumber: pages.length + 1,
      width: pageSize.width,
      height: pageSize.height,
      orientation: pageSize.orientation,
      cells,
    });
  }
  return pages;
}

interface PageSize {
  width: number;
  height: number;
  orientation: ImagePackOrientation;
}

function resolvePageSize(
  chunk: ImagePackInputItem[],
  itemsPerPage: ImagePackItemsPerPage,
  orientation: ImagePackOrientationOption,
): PageSize {
  if (orientation === "portrait") {
    return { width: A4_PORTRAIT_SIZE_PT.width, height: A4_PORTRAIT_SIZE_PT.height, orientation: "portrait" };
  }
  if (orientation === "landscape") {
    return { width: A4_LANDSCAPE_SIZE_PT.width, height: A4_LANDSCAPE_SIZE_PT.height, orientation: "landscape" };
  }
  // orientation === "auto"
  if (itemsPerPage === 1) {
    const item = chunk[0];
    return item.width > item.height
      ? { width: A4_LANDSCAPE_SIZE_PT.width, height: A4_LANDSCAPE_SIZE_PT.height, orientation: "landscape" }
      : { width: A4_PORTRAIT_SIZE_PT.width, height: A4_PORTRAIT_SIZE_PT.height, orientation: "portrait" };
  }
  // per_page >= 2 + auto: 单一固定方向；保留与 img2pdf 脚本一致：landscape
  return { width: A4_LANDSCAPE_SIZE_PT.width, height: A4_LANDSCAPE_SIZE_PT.height, orientation: "landscape" };
}

function buildCellsForChunk(
  chunk: ImagePackInputItem[],
  pageWidth: number,
  pageHeight: number,
  itemsPerPage: ImagePackItemsPerPage,
  margin: number,
): ImagePackCell[] {
  if (itemsPerPage === 1) {
    return chunk.map((item) => buildSingleCell(item, pageWidth, pageHeight, margin));
  }

  const cols = itemsPerPage;
  const gap = margin;
  const cellWidth = (pageWidth - (cols + 1) * gap) / cols;
  const cellHeight = pageHeight - 2 * margin;
  return chunk.map((item, colIdx) => {
    const scale = Math.min(cellWidth / item.width, cellHeight / item.height);
    const scaledWidth = item.width * scale;
    const scaledHeight = item.height * scale;
    const x = gap + colIdx * (cellWidth + gap) + (cellWidth - scaledWidth) / 2;
    const y = margin + (cellHeight - scaledHeight) / 2;
    return {
      itemId: item.id,
      col: colIdx,
      row: 0,
      width: scaledWidth,
      height: scaledHeight,
      x,
      y,
    };
  });
}

function buildSingleCell(
  item: ImagePackInputItem,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): ImagePackCell {
  const cellWidth = pageWidth - 2 * margin;
  const cellHeight = pageHeight - 2 * margin;
  const scale = Math.min(cellWidth / item.width, cellHeight / item.height);
  const scaledWidth = item.width * scale;
  const scaledHeight = item.height * scale;
  return {
    itemId: item.id,
    col: 0,
    row: 0,
    width: scaledWidth,
    height: scaledHeight,
    x: margin + (cellWidth - scaledWidth) / 2,
    y: margin + (cellHeight - scaledHeight) / 2,
  };
}

function buildSummary(
  items: ImagePackInputItem[],
  pages: ImagePackPage[],
  options: NormalizedOptions,
  counts: ItemOrientationCounts,
  resolvedPerPage: ImagePackItemsPerPage,
): ImagePackSummary {
  const orientationPageCounts = pages.reduce(
    (acc, page) => {
      acc[page.orientation] += 1;
      return acc;
    },
    { portrait: 0, landscape: 0 },
  );

  return {
    inputItemCount: items.length,
    outputPageCount: pages.length,
    itemsPerPage: resolvedPerPage,
    portraitItemCount: counts.portrait,
    landscapeItemCount: counts.landscape,
    squareItemCount: counts.square,
    orientationPageCounts,
    selectedOrientation: options.orientation,
    selectedItemsPerPageOption: options.itemsPerPage,
  };
}

function validateOutputPath(outputPath: string, items: ImagePackInputItem[]): void {
  if (!outputPath) {
    throw new Error("证据图片输出 PDF 路径不能为空。");
  }
  if (!isAbsolutePath(outputPath)) {
    throw new Error("证据图片输出路径必须是绝对路径。");
  }
  if (!outputPath.toLowerCase().endsWith(".pdf")) {
    throw new Error("证据图片输出文件必须是 PDF。");
  }
  for (const item of items) {
    if (item.sourcePath && samePath(item.sourcePath, outputPath)) {
      throw new Error("证据图片输出 PDF 必须是不同于输入材料的新文件。");
    }
  }
}

function isAbsolutePath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
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

function stripKnownExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return fileName.slice(0, -ext.length);
    }
  }
  if (lower.endsWith(".pdf")) {
    return fileName.slice(0, -4);
  }
  return fileName;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cloneItem(item: ImagePackInputItem): ImagePackInputItem {
  return {
    id: item.id,
    source: item.source,
    width: item.width,
    height: item.height,
    ...(item.sourcePath !== undefined ? { sourcePath: item.sourcePath } : {}),
    ...(item.sourcePageIndex !== undefined ? { sourcePageIndex: item.sourcePageIndex } : {}),
    ...(item.label !== undefined ? { label: item.label } : {}),
  };
}
