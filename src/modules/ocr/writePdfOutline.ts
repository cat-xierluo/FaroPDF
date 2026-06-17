import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
} from "pdf-lib";
import type { ChapterHeadingNode } from "./autoToc";

/**
 * ISS-069 阶段 1：把 outline 树写入 PDF（pdf-lib 低级 API）。
 *
 * pdf-lib 1.17.1 没有公开的 addOutline API，需要直接操作 catalog
 * 与 PDFDict / PDFArray / PDFRef / PDFName。
 *
 * PDF outline 数据结构（PDF 1.7 spec §12.3.3）：
 *   Catalog.Outlines → outline root dict ref
 *   outline root: { /Type /Outlines, /First, /Last, /Count }
 *   item: { /Title (text), /Parent, /Dest [page XYZ x y zoom],
 *           /Prev, /Next, /First (child), /Last (child), /Count (child) }
 *
 * 输出：保留原 PDF 内容，新增 outline。新 PDF 副本由调用方写盘。
 */

/** writePdfOutline 选项。 */
export interface WriteOutlineOptions {
  /** 默认起始 Y 坐标（无 heading.y 时使用），用于 outline 跳转锚点 */
  fallbackY?: number;
  /** outline 项数上限（防恶意超大输入撑爆 PDF） */
  maxItems?: number;
}

/** 内部栈节点：跟踪递归遍历中的 prev 引用，用于链式链接。 */
interface OutlineStackEntry {
  parent: PDFRef;
  prev: PDFRef | null;
  count: number;
  first: PDFRef | null;
  last: PDFRef | null;
}

/**
 * 把 outline 树写入新 PDF bytes。
 *
 * @param bytes 源 PDF bytes
 * @param tree outline 树（来自 buildOutlineTree / buildOutlineTreeFromPages）
 * @param options 写入选项
 * @returns 写入 outline 的新 PDF bytes
 */
export async function writePdfOutline(
  bytes: Uint8Array,
  tree: ReadonlyArray<ChapterHeadingNode>,
  options: WriteOutlineOptions = {},
): Promise<Uint8Array> {
  const maxItems = options.maxItems ?? 5000;
  const fallbackY = options.fallbackY ?? 0;

  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();

  if (pages.length === 0 || tree.length === 0) {
    // 空卷宗 / 空 outline：直接返回原 PDF bytes
    return await pdf.save();
  }

  // 创建 outline root dict
  const outlineRoot = pdf.context.obj({
    Type: "Outlines",
  }) as PDFDict;
  const outlineRootRef = pdf.context.register(outlineRoot);

  // 维护栈式遍历
  const stack: OutlineStackEntry[] = [
    { parent: outlineRootRef, prev: null, count: 0, first: null, last: null },
  ];
  let totalCount = 0;

  // 深度优先遍历 tree，扁平化为 item 列表
  const flat: Array<{ node: ChapterHeadingNode; depth: number }> = [];
  function visit(nodes: ReadonlyArray<ChapterHeadingNode>, depth: number) {
    for (const n of nodes) {
      flat.push({ node: n, depth });
      visit(n.children, depth + 1);
    }
  }
  visit(tree, 1);

  for (const { node, depth } of flat) {
    if (totalCount >= maxItems) {
      break;
    }
    totalCount += 1;

    // 选择目标页：pageIndex 0-based
    const pageIndex = Math.max(0, Math.min(pages.length - 1, node.pageIndex));
    const page = pages[pageIndex];
    const pageRef = page.ref;
    // Y 坐标：textItem.y，PDF 用户空间是 bottom-up；Y 越大越靠上
    const y = node.y !== 0 ? node.y : fallbackY;

    // 构造 item dict
    const titleStr = PDFString.of(node.text);
    const destArray = pdf.context.obj([
      pageRef,
      PDFName.of("XYZ"),
      PDFNumber.of(node.x),
      PDFNumber.of(y),
      PDFNumber.of(0),
    ]) as PDFArray;

    const itemDict = pdf.context.obj({
      Title: titleStr,
      Parent: stack[depth - 1].parent,
      Dest: destArray,
    }) as PDFDict;
    const itemRef = pdf.context.register(itemDict);

    // 链式链接：在当前层维护 prev / next
    const currentLayer = stack[depth - 1];
    if (currentLayer.prev !== null) {
      const prevDict = pdf.context.lookup(currentLayer.prev);
      if (prevDict instanceof PDFDict) {
        prevDict.set(PDFName.of("Next"), itemRef);
      }
      // Prev 链回上一个同级
      itemDict.set(PDFName.of("Prev"), currentLayer.prev);
    } else {
      // 第一个同级：作为父级的 /First
      currentLayer.first = itemRef;
    }
    currentLayer.prev = itemRef;
    currentLayer.last = itemRef;

    // 父级 /Last 同步（最末一个同级）
    const parentDict = pdf.context.lookup(currentLayer.parent);
    if (parentDict instanceof PDFDict) {
      parentDict.set(PDFName.of("Last"), itemRef);
    }

    // 入栈作为下一级父
    stack[depth] = {
      parent: itemRef,
      prev: null,
      count: 0,
      first: null,
      last: null,
    };
  }

  // 收尾：每层 /Count 折叠
  for (let i = 1; i < stack.length; i += 1) {
    const layer = stack[i];
    if (!layer) continue;
    const parentDict = pdf.context.lookup(layer.parent);
    if (!(parentDict instanceof PDFDict)) continue;
    if (layer.first) {
      parentDict.set(PDFName.of("First"), layer.first);
    }
    if (layer.last) {
      parentDict.set(PDFName.of("Last"), layer.last);
    }
    // /Count 包含所有后代（开式 = 总展开数）
    let descendantCount = 0;
    function countDescendants(nodes: ReadonlyArray<ChapterHeadingNode>) {
      for (const n of nodes) {
        descendantCount += 1;
        countDescendants(n.children);
      }
    }
    // 计算当前 item 自己的后代数（不含自己）
    const myNode = findNodeAtDepth(tree, i);
    if (myNode) {
      countDescendants(myNode.children);
      parentDict.set(PDFName.of("Count"), PDFNumber.of(descendantCount));
    }
  }

  // 顶层 /First /Last /Count
  const topLayer = stack[0]!;
  outlineRoot.set(PDFName.of("First"), topLayer.first ?? outlineRootRef);
  outlineRoot.set(PDFName.of("Last"), topLayer.last ?? outlineRootRef);
  outlineRoot.set(PDFName.of("Count"), PDFNumber.of(totalCount));

  // Catalog.Outlines 指向 root
  pdf.catalog.set(PDFName.of("Outlines"), outlineRootRef);
  pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  return await pdf.save();
}

/** 找到第 N 层（depth = N）第一个 heading 节点。 */
function findNodeAtDepth(
  tree: ReadonlyArray<ChapterHeadingNode>,
  depth: number,
): ChapterHeadingNode | null {
  // depth 1 = root
  if (depth === 1) {
    return tree[0] ?? null;
  }
  // depth >= 2：递归找路径
  let current: ChapterHeadingNode | null = null;
  function walk(nodes: ReadonlyArray<ChapterHeadingNode>, currentDepth: number): boolean {
    if (currentDepth === depth) {
      current = nodes[0] ?? null;
      return current !== null;
    }
    for (const n of nodes) {
      if (walk(n.children, currentDepth + 1)) return true;
    }
    return false;
  }
  walk(tree, 1);
  return current;
}
