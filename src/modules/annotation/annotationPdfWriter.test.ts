import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AnnotationSidecar, PdfAnnotation } from "../../shared/pdf/annotation";
import { ANNOTATION_SIDECAR_SCHEMA_VERSION, buildAnnotationSidecar } from "./sidecar";
import { writeAnnotationPdf } from "./annotationPdfWriter";

async function makeBlankPdfBytes(pageCount: number, width = 595, height = 842): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([width, height]);
  }
  return pdf.save();
}

function makeAnnotation(overrides: Partial<PdfAnnotation> & { id: string; pageIndex: number }): PdfAnnotation {
  return {
    type: "highlight",
    rects: [{ x: 50, y: 50, width: 200, height: 18 }],
    color: "#f6d66f",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSidecar(annotations: PdfAnnotation[]): AnnotationSidecar {
  return buildAnnotationSidecar({
    document: { path: "test.pdf", fingerprint: "test-fingerprint" },
    annotations,
    now: "2026-01-01T00:00:00.000Z",
  });
}

describe("writeAnnotationPdf", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("空 sidecar 返回有效 PDF，字节与源大致一致", async () => {
    const source = await makeBlankPdfBytes(3);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([]),
    });
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPageCount()).toBe(3);
    expect(result.summary.drawnCount).toBe(0);
    expect(result.summary.skippedCount).toBe(0);
    expect(result.summary.annotationCount).toBe(0);
    expect(result.summary.inputPageCount).toBe(3);
    expect(result.summary.outputPageCount).toBe(3);
  });

  test("12 种批注全部成功绘制，形状样式进入 PDF", async () => {
    const source = await makeBlankPdfBytes(3);
    const annotations: PdfAnnotation[] = [
      makeAnnotation({ id: "hl", pageIndex: 0, type: "highlight", color: "#f6d66f" }),
      makeAnnotation({ id: "un", pageIndex: 0, type: "underline", color: "#2f80ed" }),
      makeAnnotation({ id: "so", pageIndex: 0, type: "strikeout", color: "#d14d4d" }),
      makeAnnotation({ id: "nt", pageIndex: 0, type: "note", color: "#2c8a4a", rects: [{ x: 20, y: 20, width: 28, height: 28 }] }),
      makeAnnotation({ id: "tb", pageIndex: 1, type: "textbox", content: "review me" }),
      makeAnnotation({
        id: "rc",
        pageIndex: 1,
        type: "rectangle",
        color: "#6c5ce7",
        opacity: 0.6,
        style: { strokeWidth: 4, strokeStyle: "dashed", fillColor: "#f0c33c" },
      }),
      makeAnnotation({ id: "el", pageIndex: 1, type: "ellipse", color: "#2a8df0", style: { fillColor: "#e89234" } }),
      makeAnnotation({
        id: "ar",
        pageIndex: 1,
        type: "arrow",
        color: "#1f2937",
        line: { start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
      }),
      makeAnnotation({
        id: "da",
        pageIndex: 1,
        type: "double-arrow",
        line: { start: { x: 120, y: 120 }, end: { x: 240, y: 180 } },
      }),
      makeAnnotation({
        id: "ln",
        pageIndex: 1,
        type: "line",
        line: { start: { x: 80, y: 200 }, end: { x: 260, y: 220 } },
        style: { strokeWidth: 3, strokeStyle: "dashed" },
      }),
      makeAnnotation({
        id: "ik",
        pageIndex: 2,
        type: "ink",
        color: "#1f2937",
        ink: { strokes: [[{ x: 50, y: 50 }, { x: 60, y: 60 }, { x: 70, y: 70 }]] },
      }),
      makeAnnotation({
        id: "st",
        pageIndex: 2,
        type: "stamp",
        stamp: { name: "reviewed", label: "已阅" },
      }),
    ];

    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar(annotations),
    });

    expect(result.summary.drawnCount).toBe(12);
    expect(result.summary.skippedCount).toBe(0);
    expect(result.summary.skipped).toEqual([]);
    expect(result.summary.annotationCount).toBe(12);
    expect(result.summary.pageDrawCounts).toEqual({ 0: 4, 1: 6, 2: 2 });

    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPageCount()).toBe(3);
    expect(loaded.getKeywords()).toContain("faropdf:annotation-drawn:12");
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  test("越界 rect 自动 clamp，不抛错", async () => {
    const source = await makeBlankPdfBytes(1, 200, 200);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({
          id: "out",
          pageIndex: 0,
          type: "highlight",
          rects: [{ x: 150, y: 150, width: 200, height: 50 }],
        }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
    expect(result.summary.skippedCount).toBe(0);
  });

  test("全越界 rect（clamp 后面积为 0）被跳过并记录原因", async () => {
    const source = await makeBlankPdfBytes(1, 100, 100);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({
          id: "far-away",
          pageIndex: 0,
          type: "rectangle",
          rects: [{ x: 5000, y: 5000, width: 1, height: 1 }],
        }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(0);
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.skipped[0]).toMatchObject({ annotationId: "far-away" });
  });

  test("无效颜色被跳过并记录原因", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "bad", pageIndex: 0, type: "highlight", color: "not-a-color" }),
        makeAnnotation({ id: "good", pageIndex: 0, type: "highlight", color: "#f6d66f" }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.skipped[0].annotationId).toBe("bad");
    expect(result.summary.skipped[0].reason).toContain("颜色无法解析");
  });

  test("3 位 hex 颜色被支持", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "short-hex", pageIndex: 0, type: "highlight", color: "#ff0" }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
  });

  test("空文本框被跳过", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "empty-tb", pageIndex: 0, type: "textbox", content: "   " }),
      ]),
    });
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.skipped[0].reason).toContain("文本框内容为空");
  });

  test("中文文本框被跳过并给出明确原因", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "cn", pageIndex: 0, type: "textbox", content: "需要复核" }),
      ]),
    });
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.skipped[0].reason).toMatch(/WinAnsi|不支持的字符/);
  });

  test("缺 line 字段的箭头被跳过", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "no-line", pageIndex: 0, type: "arrow" }),
      ]),
    });
    expect(result.summary.skippedCount).toBe(1);
    expect(result.summary.skipped[0].reason).toContain("line");
  });

  test("缺 ink 字段的手写被跳过", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "no-ink", pageIndex: 0, type: "ink" }),
      ]),
    });
    expect(result.summary.skippedCount).toBe(1);
  });

  test("pageIndex 越界抛错", async () => {
    const source = await makeBlankPdfBytes(1);
    await expect(
      writeAnnotationPdf({
        sourceBytes: source,
        sidecar: makeSidecar([
          makeAnnotation({ id: "out", pageIndex: 5, type: "highlight" }),
        ]),
      }),
    ).rejects.toThrow(/页码.*超出/);
  });

  test("sidecar pageCount 与源 PDF 不一致抛错", async () => {
    const source = await makeBlankPdfBytes(2);
    const sidecar = buildAnnotationSidecar({
      document: { path: "test.pdf", fingerprint: "test-fingerprint", pageCount: 5 },
      annotations: [],
    });
    await expect(
      writeAnnotationPdf({
        sourceBytes: source,
        sidecar,
      }),
    ).rejects.toThrow(/页数.*不一致/);
  });

  test("sidecar 指纹与源 PDF 不一致抛错", async () => {
    const source = await makeBlankPdfBytes(1);
    await expect(
      writeAnnotationPdf({
        sourceBytes: source,
        sidecar: makeSidecar([]),
        sourceFingerprint: "different-fingerprint",
      }),
    ).rejects.toThrow(/指纹/);
  });

  test("空 source bytes 抛错", async () => {
    await expect(
      writeAnnotationPdf({
        sourceBytes: new Uint8Array(0),
        sidecar: makeSidecar([]),
      }),
    ).rejects.toThrow(/源字节为空/);
  });

  test("非法 PDF 字节抛错并脱敏", async () => {
    const garbage = new TextEncoder().encode("not a pdf at all");
    await expect(
      writeAnnotationPdf({
        sourceBytes: garbage,
        sidecar: makeSidecar([]),
      }),
    ).rejects.toThrow(/无法解析源 PDF/);
  });

  test("schemaVersion 不匹配抛错", async () => {
    const source = await makeBlankPdfBytes(1);
    const sidecar: AnnotationSidecar = {
      ...makeSidecar([]),
      schemaVersion: 999,
    };
    await expect(
      writeAnnotationPdf({
        sourceBytes: source,
        sidecar,
      }),
    ).rejects.toThrow(/schema 版本/);
  });

  test("opacity 越界自动 clamp", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({ id: "huge-opacity", pageIndex: 0, type: "highlight", opacity: 5 }),
        makeAnnotation({ id: "neg-opacity", pageIndex: 0, type: "highlight", opacity: -1 }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(2);
  });

  test("suggestedFileName 推荐 *-annotated.pdf 格式", async () => {
    const source = await makeBlankPdfBytes(1);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([]),
    });
    expect(result.suggestedFileName).toBe("*-annotated.pdf");
  });

  test("summary.fingerprintChecked 反映指纹校验状态", async () => {
    const source = await makeBlankPdfBytes(1);
    const noFingerprintResult = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([]),
    });
    expect(noFingerprintResult.summary.fingerprintChecked).toBe(false);

    const withFingerprintResult = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([]),
      sourceFingerprint: "test-fingerprint",
    });
    expect(withFingerprintResult.summary.fingerprintChecked).toBe(true);
  });
});

describe("writeAnnotationPdf schemaVersion", () => {
  test("ANNOTATION_SIDECAR_SCHEMA_VERSION 等于 1（保护测试）", () => {
    expect(ANNOTATION_SIDECAR_SCHEMA_VERSION).toBe(1);
  });
});

// 1x1 红色 PNG（最小有效 fixture，DEC-122 customStamp 真实嵌入测试用）
const ONE_PX_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABXvMqOgAAAABJRU5ErkJggg==";

describe("writeAnnotationPdf customStamp image (ISS-062 阶段 3 / DEC-122)", () => {
  test("stamp.image 是 data:image/png → drawn=true，PDF 含图像 XObject（Subtype/Image）", async () => {
    const source = await makeBlankPdfBytes(1, 400, 400);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({
          id: "cs",
          pageIndex: 0,
          type: "stamp",
          stamp: {
            label: "公司业务章",
            name: "custom",
            image: ONE_PX_PNG_DATA_URL,
          },
          rects: [{ x: 100, y: 100, width: 200, height: 100 }],
        }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
    expect(result.summary.skippedCount).toBe(0);
    // PDF raw bytes 必须含图像 XObject 标识（/Subtype/Image）—— 证明 drawStamp 真嵌入图，不是 fallback 文字
    const decoder = new TextDecoder("latin1");
    const pdfText = decoder.decode(result.bytes);
    expect(pdfText).toMatch(/\/Subtype\s*\/Image/);
    // 重新 load 验证 PDF 合法
    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  test("stamp.image 是非法 base64 → 不抛错，drawn=true（fallback 到文字矩形）", async () => {
    const source = await makeBlankPdfBytes(1, 400, 400);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({
          id: "bad",
          pageIndex: 0,
          type: "stamp",
          stamp: {
            label: "fallback",
            name: "custom",
            image: "data:image/png;base64,!!!NOT_BASE64!!!",
          },
          rects: [{ x: 50, y: 50, width: 100, height: 50 }],
        }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
    expect(result.summary.skippedCount).toBe(0);
  });

  test("stamp.image 是非 image/ 前缀 → 忽略 image，按文字 stamp 处理", async () => {
    const source = await makeBlankPdfBytes(1, 400, 400);
    const result = await writeAnnotationPdf({
      sourceBytes: source,
      sidecar: makeSidecar([
        makeAnnotation({
          id: "txt",
          pageIndex: 0,
          type: "stamp",
          stamp: {
            label: "文字章",
            name: "reviewed",
            image: "https://example.com/not-image.png", // 非 data: 前缀 → 忽略
          },
          rects: [{ x: 50, y: 50, width: 100, height: 50 }],
        }),
      ]),
    });
    expect(result.summary.drawnCount).toBe(1);
    expect(result.summary.skippedCount).toBe(0);
  });
});
