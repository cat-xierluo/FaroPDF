import { PDFDocument } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { A4_PORTRAIT_SIZE_PT } from "../../../shared";
import { createMemoryPdfExportStorage } from "../../export";
import { createImagePackPlan } from "./imagePackPlanner";
import { createImagePackExecutor } from "./imagePackExecutor";
import type { ImagePackFileReader, ImagePackRenderer } from "./imagePackRenderer";

function makePng(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = wrapChunk(new TextEncoder().encode("IHDR"), ihdr);
  const rowSize = 1 + width * 3;
  const raw = new Uint8Array(rowSize * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * rowSize] = 0;
  }
  const compressed = deflateSync(raw);
  const idatChunk = wrapChunk(new TextEncoder().encode("IDAT"), compressed);
  const iendChunk = wrapChunk(new TextEncoder().encode("IEND"), new Uint8Array(0));

  const out = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  out.set(signature, 0);
  out.set(ihdrChunk, signature.length);
  out.set(idatChunk, signature.length + ihdrChunk.length);
  out.set(iendChunk, signature.length + ihdrChunk.length + idatChunk.length);
  return out;
}

function wrapChunk(type: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out[0] = (data.length >>> 24) & 0xff;
  out[1] = (data.length >>> 16) & 0xff;
  out[2] = (data.length >>> 8) & 0xff;
  out[3] = data.length & 0xff;
  out.set(type, 4);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  out[8 + data.length] = (crc >>> 24) & 0xff;
  out[9 + data.length] = (crc >>> 16) & 0xff;
  out[10 + data.length] = (crc >>> 8) & 0xff;
  out[11 + data.length] = crc & 0xff;
  return out;
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ (bytes[index] ?? 0)) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function makePdfBytes(pageCount: number, pageSize: { width: number; height: number }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont("Helvetica");
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    page.drawText(`page-${index}`, { x: 20, y: 20, size: 12, font });
  }
  return pdf.save();
}

function createMemoryReader(files: Record<string, Uint8Array>): ImagePackFileReader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async readFile(path: string): Promise<Uint8Array> {
      reads.push(path);
      const bytes = files[path];
      if (!bytes) {
        throw new Error(`文件不存在：${path}`);
      }
      return bytes;
    },
  };
}

function createFailingRenderer(): ImagePackRenderer {
  return {
    async renderPlan() {
      throw new Error("forced renderer failure");
    },
  };
}

describe("imagePackExecutor - 端到端", () => {
  test("真实拾取 PNG bytes + 渲染 + 写入 storage,产出可读 PDF", async () => {
    const photo1 = makePng(640, 480);
    const photo2 = makePng(800, 600);
    const photo3 = makePng(1024, 768);
    const reader = createMemoryReader({
      "/case/evidence/a.png": photo1,
      "/case/evidence/b.png": photo2,
      "/case/evidence/c.png": photo3,
    });
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({ reader, storage });

    const plan = createImagePackPlan({
      items: [
        { id: "a", source: "image", sourcePath: "/case/evidence/a.png", width: 640, height: 480 },
        { id: "b", source: "image", sourcePath: "/case/evidence/b.png", width: 800, height: 600 },
        { id: "c", source: "image", sourcePath: "/case/evidence/c.png", width: 1024, height: 768 },
      ],
      options: { itemsPerPage: 1, orientation: "auto" },
      outputPath: "/case/evidence/out.pdf",
      id: "pack-execute-1",
      createdAt: "2026-06-03T00:00:00.000Z",
    });

    const result = await executor.execute({
      plan,
      outputPath: "/case/evidence/out.pdf",
    });

    expect(result.outputPath).toBe("/case/evidence/out.pdf");
    expect(result.inputItemCount).toBe(3);
    expect(result.outputPageCount).toBe(3);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.completedAt).toBeTruthy();

    // 写入的 PDF 能被 pdf-lib 重新解析
    const written = await storage.readFile("/case/evidence/out.pdf");
    const parsed = await PDFDocument.load(written);
    expect(parsed.getPageCount()).toBe(3);

    // 渲染器按需读取了 3 个文件
    expect(reader.reads).toEqual([
      "/case/evidence/a.png",
      "/case/evidence/b.png",
      "/case/evidence/c.png",
    ]);
  });

  test("真实拾取 PDF 页面 + 写入新 PDF,保留 A4 编排", async () => {
    const sourcePdf = await makePdfBytes(2, { width: 200, height: 300 });
    const reader = createMemoryReader({
      "/case/source.pdf": sourcePdf,
    });
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({ reader, storage });

    const plan = createImagePackPlan({
      items: [
        { id: "pdf-a", source: "pdf-page", sourcePath: "/case/source.pdf", sourcePageIndex: 0, width: 200, height: 300 },
        { id: "pdf-b", source: "pdf-page", sourcePath: "/case/source.pdf", sourcePageIndex: 1, width: 200, height: 300 },
      ],
      options: { itemsPerPage: 1, orientation: "portrait" },
      outputPath: "/case/evidence/pdf-pack.pdf",
      id: "pack-execute-pdf",
      createdAt: "2026-06-03T00:00:00.000Z",
    });

    const result = await executor.execute({ plan, outputPath: "/case/evidence/pdf-pack.pdf" });
    const written = await storage.readFile("/case/evidence/pdf-pack.pdf");
    const parsed = await PDFDocument.load(written);

    // 1 item per A4 portrait page → 2 A4 portrait pages
    expect(parsed.getPageCount()).toBe(2);
    expect(parsed.getPage(0).getWidth()).toBe(A4_PORTRAIT_SIZE_PT.width);
    expect(parsed.getPage(0).getHeight()).toBe(A4_PORTRAIT_SIZE_PT.height);
    expect(parsed.getPage(1).getWidth()).toBe(A4_PORTRAIT_SIZE_PT.width);
    expect(parsed.getPage(1).getHeight()).toBe(A4_PORTRAIT_SIZE_PT.height);
    expect(result.outputPageCount).toBe(2);
  });
});

describe("imagePackExecutor - 路径与 plan 校验", () => {
  const validPlan = createImagePackPlan({
    items: [
      { id: "a", source: "image", sourcePath: "/case/in/a.png", width: 100, height: 200 },
    ],
    options: { itemsPerPage: 1, orientation: "portrait" },
    outputPath: "/case/out/valid.pdf",
    id: "pack-valid",
    createdAt: "2026-06-03T00:00:00.000Z",
  });

  test("拒绝非 PDF 输出文件", async () => {
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({
      reader: createMemoryReader({ "/case/in/a.png": new Uint8Array([1, 2, 3]) }),
      storage,
    });

    await expect(
      executor.execute({ plan: validPlan, outputPath: "/case/out/result.docx" }),
    ).rejects.toThrow(/证据图片输出文件必须是 PDF/);
  });

  test("拒绝相对路径", async () => {
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({
      reader: createMemoryReader({ "/case/in/a.png": new Uint8Array([1, 2, 3]) }),
      storage,
    });

    await expect(
      executor.execute({ plan: validPlan, outputPath: "out/result.pdf" }),
    ).rejects.toThrow(/证据图片输出路径必须是绝对路径/);
  });

  test("拒绝已存在的输出文件", async () => {
    const storage = createMemoryPdfExportStorage({ "/case/out/result.pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46]) });
    const executor = createImagePackExecutor({
      reader: createMemoryReader({ "/case/in/a.png": new Uint8Array([1, 2, 3]) }),
      storage,
    });

    await expect(
      executor.execute({ plan: validPlan, outputPath: "/case/out/result.pdf" }),
    ).rejects.toThrow(/证据图片输出路径已存在/);
  });

  test("拒绝与输入同路径的输出（planner 阶段已拦截）", async () => {
    // planner 在创建 plan 时就拒绝 outputPath 与 sourcePath 相同,executor 不会拿到这种 plan
    expect(() =>
      createImagePackPlan({
        items: [
          { id: "a", source: "pdf-page", sourcePath: "/case/in/source.pdf", sourcePageIndex: 0, width: 100, height: 200 },
        ],
        options: { itemsPerPage: 1, orientation: "portrait" },
        outputPath: "/case/in/source.pdf",
        id: "pack-self",
        createdAt: "2026-06-03T00:00:00.000Z",
      }),
    ).toThrow(/证据图片输出 PDF 必须是不同于输入材料的新文件/);
  });

  test("executor 拒绝与输入同路径但 planner 阶段没拦的输出路径", async () => {
    // 通过显式分两步构造:plan 用合法 outputPath,executor.execute() 改用 sourcePath 触发兜底检查
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({
      reader: createMemoryReader({ "/case/in/source.pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46]) }),
      storage,
    });
    const plan = createImagePackPlan({
      items: [
        { id: "a", source: "pdf-page", sourcePath: "/case/in/source.pdf", sourcePageIndex: 0, width: 100, height: 200 },
      ],
      options: { itemsPerPage: 1, orientation: "portrait" },
      outputPath: "/case/out/legal-pack.pdf",
      id: "pack-self-exec",
      createdAt: "2026-06-03T00:00:00.000Z",
    });

    await expect(
      executor.execute({ plan, outputPath: "/case/in/source.pdf" }),
    ).rejects.toThrow(/证据图片输出 PDF 必须是不同于输入材料的新文件/);
  });

  test("拒绝空 plan", async () => {
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({
      reader: createMemoryReader({}),
      storage,
    });
    const emptyPlan = {
      ...validPlan,
      items: [],
      pages: [],
      summary: { ...validPlan.summary, inputItemCount: 0, outputPageCount: 0 },
    } as typeof validPlan;

    await expect(
      executor.execute({ plan: emptyPlan, outputPath: "/case/out/empty.pdf" }),
    ).rejects.toThrow(/至少需要一个条目/);
  });

  test("renderer 抛错时返回 sanitized 错误", async () => {
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({
      reader: createMemoryReader({}),
      storage,
      renderer: createFailingRenderer(),
    });

    await expect(
      executor.execute({ plan: validPlan, outputPath: "/case/out/result.pdf" }),
    ).rejects.toThrow(/证据图片渲染失败/);
  });
});

describe("imagePackExecutor - 校验后不再发起渲染(在路径错误时)", () => {
  test("输出路径非法时不应触发文件读取", async () => {
    const reader = createMemoryReader({});
    const storage = createMemoryPdfExportStorage();
    const executor = createImagePackExecutor({ reader, storage });
    const plan = createImagePackPlan({
      items: [
        { id: "a", source: "image", sourcePath: "/case/in/a.png", width: 100, height: 200 },
      ],
      options: { itemsPerPage: 1, orientation: "portrait" },
      outputPath: "/case/out/plan.pdf",
      id: "pack-no-read",
      createdAt: "2026-06-03T00:00:00.000Z",
    });

    await expect(
      executor.execute({ plan, outputPath: "relative.pdf" }),
    ).rejects.toThrow();
    expect(reader.reads).toEqual([]);
  });
});
