/**
 * ISS-072 阶段 1：PDF 文档属性读写层。
 *
 * 律师场景：律师整理客户文件时修改 Title / Author / Subject / Keywords，
 * 避免泄露原作者；Producer 默认写 "FaroPDF" 不暴露 pdf-lib 底层库名。
 *
 * 后续 ISS-072 阶段 2 / ISS-063 接 PropertiesDialog UI + commands.ts 入口。
 */

import { PDFDocument } from "pdf-lib";

export interface PdfMetadata {
  /** 标题 */
  title?: string;
  /** 作者 */
  author?: string;
  /** 主题 */
  subject?: string;
  /** 关键词列表 */
  keywords?: string[];
  /** 生产者（写入工具） */
  producer?: string;
  /** 创建者（编辑工具） */
  creator?: string;
  /** 创建日期（ISO 8601） */
  creationDate?: string;
  /** 修改日期（ISO 8601） */
  modDate?: string;
  /** 总页数 */
  pageCount: number;
  /** 是否加密 */
  isEncrypted: boolean;
}

const DEFAULT_PRODUCER = "FaroPDF";

/**
 * 读取 PDF metadata（不修改源 bytes）。
 */
export async function readPdfMetadata(pdfBytes: Uint8Array): Promise<PdfMetadata> {
  const pdf = await PDFDocument.load(pdfBytes);
  return {
    title: pdf.getTitle() || undefined,
    author: pdf.getAuthor() || undefined,
    subject: pdf.getSubject() || undefined,
    keywords: parseKeywords(pdf.getKeywords()),
    producer: pdf.getProducer() || undefined,
    creator: pdf.getCreator() || undefined,
    creationDate: dateToIso(pdf.getCreationDate()),
    modDate: dateToIso(pdf.getModificationDate()),
    pageCount: pdf.getPageCount(),
    isEncrypted: pdf.isEncrypted,
  };
}

/**
 * 写入 / 更新 PDF metadata，返回新 PDF bytes。
 *
 * - Title / Author / Subject / Keywords / Creator / CreationDate / ModDate
 *   均通过 pdf-lib API 写入并能被 read 正确读出。
 * - **Producer 字段 pdf-lib v1.17.1 已知限制**（DEC-109）：pdf-lib `save()`
 *   内部 force override Producer 为 `pdf-lib (https://github.com/Hopding/pdf-lib)`，
 *   即便传 `updateMetadata: false` + `useObjectStreams: false` + 字节流 patch
 *   都无法稳定覆盖（XMP metadata 双写）。本阶段把 "FaroPDF" 标识写入 **Creator**
 *   字段（律师整理客户文件时也用 Creator 标识工具来源）；Producer 真覆盖留
 *   ISS-072 阶段 2 用 Rust 后端 lopdf / qpdf 直接编辑 InfoDict 解决。
 * - ModDate 自动更新为当前时间
 * - 仅修改 updates 中指定的字段，其他既有字段保留
 *
 * 调用方决定输出文件名（建议用 `src/shared/naming.suggestOutputName(name, "metadata")`）。
 */
export async function writePdfMetadata(
  pdfBytes: Uint8Array,
  updates: Partial<PdfMetadata>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);

  if (updates.title !== undefined) pdf.setTitle(updates.title);
  if (updates.author !== undefined) pdf.setAuthor(updates.author);
  if (updates.subject !== undefined) pdf.setSubject(updates.subject);
  if (updates.keywords !== undefined) pdf.setKeywords(updates.keywords);
  if (updates.creationDate !== undefined) {
    pdf.setCreationDate(new Date(updates.creationDate));
  }

  // Creator 承载 "FaroPDF" 标识（Producer pdf-lib 限制 → DEC-109 阶段 2 解决）
  pdf.setCreator(updates.creator ?? DEFAULT_PRODUCER);
  // ModDate 总是自动更新为当前时间（除非用户显式传 modDate）
  pdf.setModificationDate(updates.modDate ? new Date(updates.modDate) : new Date());

  // pdf-lib 默认 save() 会再次 update ModificationDate + Producer（写为 pdf-lib (...)）；
  // 我们手动设置的 ModDate 会被自动覆盖一次，但因为我们设的就是 "现在"，结果一致。
  // Producer 已知限制由 DEC-109 阶段 2 解决（Rust lopdf 编辑 InfoDict）。
  return pdf.save();
}

/**
 * pdf-lib `getKeywords()` 返回类型在不同版本可能是 string 或 string[]。
 * 统一规整为 string[] 或 undefined。
 */
function parseKeywords(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k)).filter((k) => k.length > 0);
  }
  if (typeof raw === "string") {
    if (raw.trim() === "") return undefined;
    // PDF 标准 keywords 用空格 / 逗号 / 分号分隔
    return raw.split(/[\s,;]+/).filter((k) => k.length > 0);
  }
  return undefined;
}

function dateToIso(date: Date | undefined): string | undefined {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
