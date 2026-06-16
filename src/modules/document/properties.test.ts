import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { readPdfMetadata, writePdfMetadata, type PdfMetadata } from "./properties";

/**
 * ISS-072 阶段 1：PDF 文档属性读写层测试。
 *
 * 律师场景：律师整理客户文件，需要修改 Title / Author / Subject / Keywords，
 * 避免泄露原作者；Producer 默认写 "FaroPDF" 不暴露 pdf-lib 底层库名。
 */

async function makeFixturePdf(opts: { title?: string; author?: string; subject?: string; pageCount?: number } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  if (opts.title !== undefined) pdf.setTitle(opts.title);
  if (opts.author !== undefined) pdf.setAuthor(opts.author);
  if (opts.subject !== undefined) pdf.setSubject(opts.subject);
  for (let i = 0; i < (opts.pageCount ?? 2); i += 1) {
    pdf.addPage([595, 842]);
  }
  return pdf.save();
}

describe("readPdfMetadata", () => {
  test("空 metadata PDF：所有字段 undefined + pageCount + isEncrypted", async () => {
    const bytes = await makeFixturePdf({ pageCount: 3 });
    const meta = await readPdfMetadata(bytes);
    expect(meta.pageCount).toBe(3);
    expect(meta.isEncrypted).toBe(false);
    // pdf-lib 默认会设置 producer/creator/dates；只 assert 我们关注的字段
    expect(meta.title).toBeUndefined();
    expect(meta.author).toBeUndefined();
    expect(meta.subject).toBeUndefined();
  });

  test("含 title / author / subject 的 PDF：字段正确读取", async () => {
    const bytes = await makeFixturePdf({
      title: "案件材料 2025-001",
      author: "张三律师",
      subject: "合同审查意见",
    });
    const meta = await readPdfMetadata(bytes);
    expect(meta.title).toBe("案件材料 2025-001");
    expect(meta.author).toBe("张三律师");
    expect(meta.subject).toBe("合同审查意见");
    expect(meta.pageCount).toBe(2);
  });
});

describe("writePdfMetadata", () => {
  test("写 title → 读取确认更新", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, { title: "新标题" });
    const meta = await readPdfMetadata(updated);
    expect(meta.title).toBe("新标题");
  });

  test("写 author + keywords → 读取确认", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, {
      author: "李四律师",
      keywords: ["证据", "合同", "诉讼"],
    });
    const meta = await readPdfMetadata(updated);
    expect(meta.author).toBe("李四律师");
    expect(meta.keywords).toEqual(["证据", "合同", "诉讼"]);
  });

  test("写 subject 同时保留其他既有字段", async () => {
    const bytes = await makeFixturePdf({ title: "原标题", author: "原作者" });
    const updated = await writePdfMetadata(bytes, { subject: "补充主题" });
    const meta = await readPdfMetadata(updated);
    expect(meta.subject).toBe("补充主题");
    expect(meta.title).toBe("原标题");
    expect(meta.author).toBe("原作者");
  });

  test("Creator 默认写 'FaroPDF'（Producer pdf-lib 限制，DEC-109）", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, { title: "x" });
    const meta = await readPdfMetadata(updated);
    // Producer 由 pdf-lib 强制覆盖为 "pdf-lib (...)"，无法稳定覆盖；
    // Creator 字段承载 "FaroPDF" 标识。ISS-072 阶段 2 用 Rust lopdf 真覆盖 Producer。
    expect(meta.creator).toBe("FaroPDF");
  });

  test("Creator 可被用户显式覆盖", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, { creator: "Custom Creator" });
    const meta = await readPdfMetadata(updated);
    expect(meta.creator).toBe("Custom Creator");
  });

  test("ModDate 自动更新为当前时间", async () => {
    const bytes = await makeFixturePdf({});
    const beforeWrite = new Date();
    const updated = await writePdfMetadata(bytes, { title: "x" });
    const meta = await readPdfMetadata(updated);
    expect(meta.modDate).toBeDefined();
    const modDate = new Date(meta.modDate!);
    // 允许 5 秒误差
    expect(modDate.getTime()).toBeGreaterThanOrEqual(beforeWrite.getTime() - 1000);
    expect(modDate.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test("空 updates 对象 → 仍写入 Creator + ModDate", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, {});
    const meta = await readPdfMetadata(updated);
    expect(meta.creator).toBe("FaroPDF");
    expect(meta.modDate).toBeDefined();
  });

  test("返回值是合法 PDF（可被重新 load）", async () => {
    const bytes = await makeFixturePdf({});
    const updated = await writePdfMetadata(bytes, { title: "x" });
    const reopened = await PDFDocument.load(updated);
    expect(reopened.getPageCount()).toBe(2);
  });
});

// 类型导出检查（仅编译时）
const _typeCheck: PdfMetadata = {
  pageCount: 1,
  isEncrypted: false,
};
void _typeCheck;
