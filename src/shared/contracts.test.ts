import { describe, expect, test } from "vitest";
import { FAROPDF_MODULES, getModuleBoundary } from "./foundation/modules";
import type {
  AppSettings,
  ImagePackInputItem,
  ImagePackPlan,
  ImagePackSummary,
  OcrJobProgress,
  OcrOutputStrategy,
  OcrQualityCheckRequest,
  OcrJob,
  OcrProviderConfig,
  OcrRequest,
  PdfAnnotation,
  PdfDocumentState,
  PdfExportJob,
  PdfExportRequest,
  PdfExportResult,
  PdfPageOperation,
  PdfPageViewport,
  ScanPreprocessJob,
} from "./index";
import { A4_LANDSCAPE_SIZE_PT, A4_PORTRAIT_SIZE_PT } from "./index";

describe("shared contracts", () => {
  test("models PDF state, operations, OCR jobs, and settings as worker-safe data", () => {
    const documentState: PdfDocumentState = {
      documentId: "document-1",
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
    const exportRequest: PdfExportRequest = {
      id: "export-request-1",
      source: {
        bytes: new Uint8Array([37, 80, 68, 70]),
        path: "/case/file.pdf",
      },
      destination: {
        type: "bytes",
      },
      operations: [
        {
          id: "flatten-ann-1",
          type: "flatten-annotations",
          sidecar: {
            schemaVersion: 1,
            document: { fingerprint: "fixture", pageCount: 12 },
            annotations: [annotation],
            createdAt: "2026-06-02T00:00:00.000Z",
            updatedAt: "2026-06-02T00:00:00.000Z",
          },
          strategy: "plan-only",
        },
      ],
      requestedAt: "2026-06-02T00:00:00.000Z",
    };
    const exportResult: PdfExportResult = {
      id: exportRequest.id,
      bytes: new Uint8Array([37, 80, 68, 70]),
      destination: {
        type: "bytes",
      },
      summary: {
        inputPageCount: 12,
        outputPageCount: 12,
        operationCount: 1,
        annotationPlan: {
          strategy: "plan-only",
          annotationCount: 1,
          entries: [
            {
              annotationId: "ann-1",
              type: "highlight",
              pageIndex: 0,
              rectCount: 1,
              status: "planned",
            },
          ],
        },
      },
      completedAt: "2026-06-02T00:00:00.000Z",
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
      providerId: "paddle",
      status: "queued",
      outputStrategy: "new-layered-pdf",
      progress: {
        stage: "queued",
        completedPages: 0,
        totalPages: 0,
      },
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    const ocrOutputStrategy: OcrOutputStrategy = "new-layered-pdf";
    const ocrQualityCheck: OcrQualityCheckRequest = {
      enabled: true,
      samplePages: [1, 3],
      keywords: ["合同", "签章"],
    };
    const ocrRequest: OcrRequest = {
      inputPath: "/case/file.pdf",
      outputPath: "/case/file-ocr.pdf",
      providerId: "paddle",
      outputStrategy: ocrOutputStrategy,
      networkConsentGranted: true,
      qualityCheck: ocrQualityCheck,
    };
    const ocrProgress: OcrJobProgress = {
      stage: "queued",
      completedPages: 0,
      totalPages: 12,
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
    expect(exportRequest.destination.type).toBe("bytes");
    expect(exportResult.summary.annotationPlan?.strategy).toBe("plan-only");
    expect(ocrJob.backend).toBe("paddleocr");
    expect(ocrRequest.outputStrategy).toBe("new-layered-pdf");
    expect(ocrProgress.totalPages).toBe(12);
    expect(preprocessJob.options.outputMode).toBe("preprocess-only");
    expect(settings.defaultSavePolicy).toBe("always-export-copy");
  });

  test("models evidence image pack plans as worker-safe data", () => {
    const inputItems: ImagePackInputItem[] = [
      { id: "img-1", source: "image", sourcePath: "/case/photo-1.png", width: 600, height: 800 },
      { id: "img-2", source: "image", sourcePath: "/case/photo-2.png", width: 800, height: 600 },
    ];
    const summary: ImagePackSummary = {
      inputItemCount: 2,
      outputPageCount: 2,
      itemsPerPage: 1,
      portraitItemCount: 1,
      landscapeItemCount: 1,
      squareItemCount: 0,
      orientationPageCounts: { portrait: 1, landscape: 1 },
      selectedOrientation: "auto",
      selectedItemsPerPageOption: "auto",
    };
    const plan: ImagePackPlan = {
      id: "image-pack-contract",
      items: inputItems,
      options: {
        itemsPerPage: 1,
        itemsPerPageOption: "auto",
        orientation: "auto",
        margin: 25,
        sort: "name",
      },
      outputPath: "/case/photo-1-evidence-pack.pdf",
      pages: [
        {
          pageNumber: 1,
          width: A4_PORTRAIT_SIZE_PT.width,
          height: A4_PORTRAIT_SIZE_PT.height,
          orientation: "portrait",
          cells: [],
        },
        {
          pageNumber: 2,
          width: A4_LANDSCAPE_SIZE_PT.width,
          height: A4_LANDSCAPE_SIZE_PT.height,
          orientation: "landscape",
          cells: [],
        },
      ],
      summary,
      warnings: [],
      createdAt: "2026-06-02T00:00:00.000Z",
    };

    expect(plan.summary.inputItemCount).toBe(2);
    expect(plan.summary.itemsPerPage).toBe(1);
    expect(plan.pages[0].orientation).toBe("portrait");
    expect(plan.pages[1].orientation).toBe("landscape");
    expect(plan.options.itemsPerPageOption).toBe("auto");
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
