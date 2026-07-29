import { PDFDocument } from "pdf-lib";
import { describe, expect, test } from "vitest";
import { createMemoryPdfExportStorage, createPdfExportService } from "../export";
import {
  createPageOrganizerExportRequest,
  createPageOrganizerState,
  deleteOrganizerPages,
  reorderOrganizerPages,
  rotateOrganizerPages,
  suggestPageOrganizerOutputPath,
} from "./pageOrganizer";

const FIXED_TIME = "2026-06-03T00:00:00.000Z";
const SOURCE_PATH = "/case/evidence/source.pdf";
const OUTPUT_PATH = "/case/evidence/source-organized.pdf";

async function createLabeledPdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const width = 200 + pageIndex * 10;
    pdf.addPage([width, 200]);
  }

  return pdf.save();
}

async function loadOutputPdf(storage: ReturnType<typeof createMemoryPdfExportStorage>): Promise<PDFDocument> {
  const exists = await storage.exists(OUTPUT_PATH);
  if (!exists) {
    throw new Error(`output pdf not written: ${OUTPUT_PATH}`);
  }
  const bytes = await storage.readFile(OUTPUT_PATH);

  return PDFDocument.load(bytes);
}

describe("pageOrganizer export - execute mode 真实改写 PDF", () => {
  test("默认 execute 模式：旋转 + 重排 + 删除 真实落到新 PDF 字节", async () => {
    const inputBytes = await createLabeledPdf(4);
    const storage = createMemoryPdfExportStorage({ [SOURCE_PATH]: inputBytes });
    const service = createPdfExportService({ storage });

    const initial = createPageOrganizerState({
      pageCount: 4,
      sourcePath: SOURCE_PATH,
      fingerprint: "fixture",
      createdAt: FIXED_TIME,
    });
    const rotated = rotateOrganizerPages(initial, {
      pageIds: ["page-1"],
      angle: 90,
      createdAt: FIXED_TIME,
    });
    const deleted = deleteOrganizerPages(rotated, {
      pageIds: ["page-2"],
      createdAt: FIXED_TIME,
    });
    const reordered = reorderOrganizerPages(deleted, {
      pageIds: ["page-3", "page-4"],
      toIndex: 0,
      createdAt: FIXED_TIME,
    });

    const request = createPageOrganizerExportRequest(reordered, {
      id: "export-organizer-execute-1",
      requestedAt: FIXED_TIME,
    });

    expect(request.operations[0]).toMatchObject({ type: "page-operations", mode: "execute" });
    expect(suggestPageOrganizerOutputPath(SOURCE_PATH)).toBe(OUTPUT_PATH);

    const result = await service.exportToPath(request);
    const outputPdf = await loadOutputPdf(storage);

    // 删除了一页 (page-2 -> 原始 index 1)，剩 3 页
    expect(outputPdf.getPageCount()).toBe(3);
    // 期望页序（原始 index）：reorder 把 [page-3, page-4] 插到 active = [page-1] 之前 → [page-3, page-4, page-1] = idx [2, 3, 0]
    // 原始 index i 的宽度是 200 + i*10；page-2 (idx=1) 被删
    expect(outputPdf.getPage(0).getWidth()).toBe(220);
    expect(outputPdf.getPage(1).getWidth()).toBe(230);
    expect(outputPdf.getPage(2).getWidth()).toBe(200);
    // page-1 (idx=0) 在重排后位于最后一页，旋转角应为 90 度
    expect(outputPdf.getPage(2).getRotation().angle).toBe(90);
    // summary 标记为 applied
    expect(result.summary.pageOperationPlan?.mode).toBe("execute");
    expect(result.summary.pageOperationPlan?.entries.every((entry) => entry.status === "applied")).toBe(true);
    expect(outputPdf.getKeywords()).toContain("faropdf:page-operations-applied");
    expect(outputPdf.getKeywords()).not.toContain("faropdf:page-operations-plan-only");
  });

  test("空状态：没有 rotate/delete/reorder 时只输出空操作，PDF 内容不变", async () => {
    const inputBytes = await createLabeledPdf(2);
    const storage = createMemoryPdfExportStorage({ [SOURCE_PATH]: inputBytes });
    const service = createPdfExportService({ storage });

    const state = createPageOrganizerState({
      pageCount: 2,
      sourcePath: SOURCE_PATH,
      createdAt: FIXED_TIME,
    });

    const request = createPageOrganizerExportRequest(state, {
      id: "export-organizer-noop-1",
      requestedAt: FIXED_TIME,
    });

    await service.exportToPath(request);
    const outputPdf = await loadOutputPdf(storage);

    expect(outputPdf.getPageCount()).toBe(2);
    expect(outputPdf.getPage(0).getWidth()).toBe(200);
    expect(outputPdf.getPage(1).getWidth()).toBe(210);
  });

  test("plan-only override：调用方显式传 plan-only 时只生成计划，不真实改写", async () => {
    const inputBytes = await createLabeledPdf(2);
    const storage = createMemoryPdfExportStorage({ [SOURCE_PATH]: inputBytes });
    const service = createPdfExportService({ storage });

    const state = createPageOrganizerState({ pageCount: 2, sourcePath: SOURCE_PATH, createdAt: FIXED_TIME });
    const rotated = rotateOrganizerPages(state, {
      pageIds: ["page-1"],
      angle: 90,
      createdAt: FIXED_TIME,
    });

    const request = createPageOrganizerExportRequest(rotated, {
      id: "export-organizer-plan-only-1",
      mode: "plan-only",
      requestedAt: FIXED_TIME,
    });

    const result = await service.exportToPath(request);
    const outputPdf = await loadOutputPdf(storage);

    // plan-only 模式下输出 PDF 仍是原始字节（仅表单扁平化/水印等其它 op 可能影响）
    // 这里只跑了 page-operations 单一 op，因此输出应与输入完全一致
    expect(outputPdf.getPageCount()).toBe(2);
    expect(outputPdf.getPage(0).getWidth()).toBe(200);
    expect(outputPdf.getPage(0).getRotation().angle).toBe(0);
    expect(result.summary.pageOperationPlan?.mode).toBe("plan-only");
    expect(result.summary.warnings).toContain("页面操作当前仅生成导出计划，尚未改写页面几何或顺序。");
    expect(outputPdf.getKeywords()).toContain("faropdf:page-operations-plan-only");
    expect(outputPdf.getKeywords()).not.toContain("faropdf:page-operations-applied");
  });

  test("execute 模式：源 PDF 缺页（index 越界）时导出引擎明确报错", async () => {
    const inputBytes = await createLabeledPdf(2);
    const storage = createMemoryPdfExportStorage({ [SOURCE_PATH]: inputBytes });
    const service = createPdfExportService({ storage });

    // 手工伪造一个 pageIndexes 越界的 PdfExportFileRequest
    const corruptRequest = {
      id: "export-organizer-corrupt-1",
      inputPath: SOURCE_PATH,
      outputPath: OUTPUT_PATH,
      fingerprint: "fixture",
      requestedAt: FIXED_TIME,
      operations: [
        {
          id: "page-ops-corrupt",
          type: "page-operations" as const,
          mode: "execute" as const,
          operations: [
            {
              id: "rotate-oob",
              type: "rotate" as const,
              pageIndexes: [5],
              payload: { angle: 90 },
              createdAt: FIXED_TIME,
            },
          ],
        },
      ],
    };

    await expect(service.exportToPath(corruptRequest)).rejects.toThrow(/页面操作页码超出源 PDF 页数/);
  });
});
