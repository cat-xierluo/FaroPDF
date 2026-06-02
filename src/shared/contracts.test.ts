import { describe, expect, test } from "vitest";
import { FAROPDF_MODULES, getModuleBoundary } from "./foundation/modules";
import type {
  AppSettings,
  OcrJob,
  OcrProviderConfig,
  PdfAnnotation,
  PdfDocumentState,
  PdfExportJob,
  PdfPageOperation,
  PdfPageViewport,
  ScanPreprocessJob,
} from "./index";

describe("shared contracts", () => {
  test("models PDF state, operations, OCR jobs, and settings as worker-safe data", () => {
    const documentState: PdfDocumentState = {
      path: "/case/file.pdf",
      name: "file.pdf",
      fingerprint: "fixture",
      pageCount: 12,
      currentPage: 1,
      zoom: 1,
      viewMode: "continuous",
      dirty: false,
      textLayerStatus: "unknown",
      ocrStatus: "needed",
    };
    const viewport: PdfPageViewport = {
      pageIndex: 0,
      width: 595,
      height: 842,
      rotation: 0,
      scale: 1,
    };
    const annotation: PdfAnnotation = {
      id: "ann-1",
      type: "highlight",
      pageIndex: 0,
      rects: [{ x: 12, y: 24, width: 160, height: 18 }],
      color: "#f7d46a",
      content: "合同重点",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    const operation: PdfPageOperation = {
      id: "op-1",
      type: "rotate",
      pageIndexes: [0],
      payload: { angle: 90 },
      createdAt: "2026-06-02T00:00:00.000Z",
    };
    const exportJob: PdfExportJob = {
      id: "export-1",
      type: "page-operations",
      inputPath: "/case/file.pdf",
      status: "queued",
      payload: { operations: [operation.id] },
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    const provider: OcrProviderConfig = {
      id: "paddle",
      type: "paddleocr",
      displayName: "PaddleOCR",
      enabled: false,
      requiresNetworkConsent: true,
    };
    const ocrJob: OcrJob = {
      id: "ocr-1",
      inputPath: "/case/file.pdf",
      backend: "paddleocr",
      status: "queued",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    const preprocessJob: ScanPreprocessJob = {
      id: "preprocess-1",
      inputPath: "/case/file.pdf",
      outputPath: "/case/file-preprocessed.pdf",
      status: "queued",
      options: {
        enhanceScans: true,
        detectOrientation: true,
        deskew: true,
        splitPages: false,
        cropPages: false,
        trimBlankEdges: false,
        outputMode: "preprocess-only",
        dpi: 300,
        jpegQuality: 90,
        skewThresholdDegrees: 0.3,
        rotationConfidence: 0.5,
        maxDeskewDegrees: 5,
        blankEdgeMarginPx: 10,
        blankEdgeThreshold: 254,
        parallelJobs: 1,
        chunkPages: 0,
        preserveOriginalPageSize: true,
      },
      progress: {
        stage: "queued",
        completedPages: 0,
        totalPages: 0,
      },
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    const settings: AppSettings = {
      defaultZoom: 1,
      defaultViewMode: "continuous",
      defaultSavePolicy: "always-export-copy",
      recentFiles: [],
      ocrProviders: [provider],
      requireNetworkOcrConfirmation: true,
    };

    expect(documentState.pageCount).toBe(12);
    expect(viewport.height).toBe(842);
    expect(annotation.type).toBe("highlight");
    expect(exportJob.status).toBe("queued");
    expect(ocrJob.backend).toBe("paddleocr");
    expect(preprocessJob.options.outputMode).toBe("preprocess-only");
    expect(settings.defaultSavePolicy).toBe("always-export-copy");
  });

  test("declares stable module boundaries for future worktrees", () => {
    expect(FAROPDF_MODULES.map((module) => module.id)).toEqual([
      "reader",
      "search",
      "annotation",
      "pages",
      "export",
      "preprocess",
      "ocr",
      "forms",
      "settings",
    ]);
    expect(getModuleBoundary("preprocess").sharedContracts).toContain("src/shared/preprocess");
    expect(getModuleBoundary("ocr").sharedContracts).toContain("src/shared/ocr");
    expect(getModuleBoundary("reader").ownedPaths).toContain("src/modules/reader");
  });
});
