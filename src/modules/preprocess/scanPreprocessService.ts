import { invoke } from "@tauri-apps/api/core";
import {
  prepareScanPreprocessRequest,
  sanitizeScanPreprocessError,
  validateScanPreprocessRequest,
} from "../../shared/preprocess/defaults";
import type {
  ScanPreprocessJob,
  ScanPreprocessOptions,
  ScanPreprocessProgress,
  ScanPreprocessRequest,
  ScanPreprocessSummary,
} from "../../shared/preprocess/types";

export interface ScanPreprocessBackend {
  startScanPreprocess: (request: ScanPreprocessRequest) => Promise<unknown>;
  listScanPreprocessJobs: () => Promise<unknown>;
  pollScanPreprocessJob: (jobId: string) => Promise<unknown>;
  cancelScanPreprocessJob: (jobId: string) => Promise<unknown>;
}

export interface ScanPreprocessService {
  startPreprocess: (request: ScanPreprocessRequest) => Promise<ScanPreprocessJob>;
  listPreprocessJobs: () => Promise<ScanPreprocessJob[]>;
  pollPreprocessJob: (jobId: string) => Promise<ScanPreprocessJob | null>;
  cancelPreprocessJob: (jobId: string) => Promise<ScanPreprocessJob | null>;
  validateRequest: (request: ScanPreprocessRequest) => ReturnType<typeof validateScanPreprocessRequest>;
}

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriScanPreprocessBackend(invoker: TauriInvoker = invoke): ScanPreprocessBackend {
  return {
    startScanPreprocess: (request) => invoker<unknown>("start_scan_preprocess_job", { request }),
    listScanPreprocessJobs: () => invoker<unknown>("list_scan_preprocess_jobs"),
    pollScanPreprocessJob: (jobId) => invoker<unknown>("poll_scan_preprocess_job", { jobId }),
    cancelScanPreprocessJob: (jobId) => invoker<unknown>("cancel_scan_preprocess_job", { jobId }),
  };
}

export function createScanPreprocessService(
  backend: ScanPreprocessBackend = createTauriScanPreprocessBackend(),
): ScanPreprocessService {
  return {
    async startPreprocess(request) {
      const preparedRequest = prepareScanPreprocessRequest(request);
      const validation = validateScanPreprocessRequest(preparedRequest);
      if (!validation.valid) {
        throw new Error(`扫描预处理参数校验失败：${validation.errors.join("；")}`);
      }

      try {
        const backendJob = await backend.startScanPreprocess(preparedRequest);
        return normalizeScanPreprocessJob(backendJob, preparedRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw createSanitizedBridgeError(message);
      }
    },

    async listPreprocessJobs() {
      try {
        const result = await backend.listScanPreprocessJobs();
        return normalizeScanPreprocessJobList(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw createSanitizedBridgeError(message);
      }
    },

    async pollPreprocessJob(jobId) {
      if (typeof jobId !== "string" || jobId.length === 0) {
        throw new Error("扫描预处理 jobId 不能为空。");
      }
      try {
        const result = await backend.pollScanPreprocessJob(jobId);
        if (result === null || result === undefined) {
          return null;
        }
        return normalizeScanPreprocessJob(result, undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw createSanitizedBridgeError(message);
      }
    },

    async cancelPreprocessJob(jobId) {
      if (typeof jobId !== "string" || jobId.length === 0) {
        throw new Error("扫描预处理 jobId 不能为空。");
      }
      try {
        const result = await backend.cancelScanPreprocessJob(jobId);
        if (result === null || result === undefined) {
          return null;
        }
        return normalizeScanPreprocessJob(result, undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw createSanitizedBridgeError(message);
      }
    },

    validateRequest(request) {
      return validateScanPreprocessRequest(prepareScanPreprocessRequest(request));
    },
  };
}

function createSanitizedBridgeError(message: string): Error {
  const sanitizedMessage = sanitizeScanPreprocessError(message);
  return Object.assign(new Error(`扫描预处理 bridge 调用失败：${sanitizedMessage}`), {
    cause: new Error(sanitizedMessage),
  });
}

function normalizeScanPreprocessJob(
  input: unknown,
  request: ScanPreprocessRequest | undefined,
): ScanPreprocessJob {
  const now = new Date().toISOString();
  if (!isRecord(input)) {
    return createFallbackQueuedJob(request, now);
  }

  const progress = normalizeProgress(input.progress);
  const summary = normalizeSummary(input.summary);
  const options: ScanPreprocessOptions = normalizeOptions(input.options, request?.options);

  return {
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : `scan-preprocess-${now}`,
    inputPath: typeof input.inputPath === "string" ? input.inputPath : request?.inputPath ?? "",
    outputPath:
      typeof input.outputPath === "string" && input.outputPath.length > 0
        ? input.outputPath
        : request?.outputPath ?? "",
    pageRange: typeof input.pageRange === "string" ? input.pageRange : request?.pageRange,
    status: isJobStatus(input.status) ? input.status : "queued",
    options,
    progress,
    summary,
    errorMessage: typeof input.errorMessage === "string" ? sanitizeScanPreprocessError(input.errorMessage) : undefined,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now,
  };
}

function normalizeOptions(
  input: unknown,
  fallback: ScanPreprocessOptions | undefined,
): ScanPreprocessOptions {
  if (fallback) {
    return fallback;
  }
  if (isRecord(input)) {
    return {
      enhanceScans: booleanOr(input.enhanceScans, true),
      detectOrientation: booleanOr(input.detectOrientation, true),
      deskew: booleanOr(input.deskew, true),
      splitPages: booleanOr(input.splitPages, false),
      cropPages: booleanOr(input.cropPages, false),
      trimBlankEdges: booleanOr(input.trimBlankEdges, false),
      outputMode: "preprocess-only",
      dpi: numberOr(input.dpi, 300),
      jpegQuality: numberOr(input.jpegQuality, 90),
      skewThresholdDegrees: numberOr(input.skewThresholdDegrees, 0.3),
      rotationConfidence: numberOr(input.rotationConfidence, 0.5),
      maxDeskewDegrees: numberOr(input.maxDeskewDegrees, 5),
      blankEdgeMarginPx: numberOr(input.blankEdgeMarginPx, 10),
      blankEdgeThreshold: numberOr(input.blankEdgeThreshold, 254),
      parallelJobs: numberOr(input.parallelJobs, 1),
      chunkPages: numberOr(input.chunkPages, 0),
      preserveOriginalPageSize: booleanOr(input.preserveOriginalPageSize, true),
    };
  }
  return defaultOptions();
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeScanPreprocessJobList(input: unknown): ScanPreprocessJob[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => normalizeScanPreprocessJob(item, undefined))
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

function createFallbackQueuedJob(request: ScanPreprocessRequest | undefined, now: string): ScanPreprocessJob {
  return {
    id: `scan-preprocess-${now}`,
    inputPath: request?.inputPath ?? "",
    outputPath: request?.outputPath ?? "",
    pageRange: request?.pageRange,
    status: "queued",
    options: request?.options ?? defaultOptions(),
    progress: {
      stage: "queued",
      completedPages: 0,
      totalPages: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function defaultOptions(): ScanPreprocessJob["options"] {
  return {
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
  };
}

function normalizeProgress(input: unknown): ScanPreprocessProgress {
  if (!isRecord(input)) {
    return {
      stage: "queued",
      completedPages: 0,
      totalPages: 0,
    };
  }

  return {
    stage: isProgressStage(input.stage) ? input.stage : "queued",
    completedPages: typeof input.completedPages === "number" ? input.completedPages : 0,
    totalPages: typeof input.totalPages === "number" ? input.totalPages : 0,
    message: typeof input.message === "string" ? sanitizeScanPreprocessError(input.message) : undefined,
  };
}

function normalizeSummary(input: unknown): ScanPreprocessSummary | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  return {
    totalPages: numberOrZero(input.totalPages),
    processedPages: numberOrZero(input.processedPages),
    rotatedPages: numberOrZero(input.rotatedPages),
    deskewedPages: numberOrZero(input.deskewedPages),
    splitPages: numberOrZero(input.splitPages),
    croppedPages: numberOrZero(input.croppedPages),
    blankEdgesClearedPages: numberOrZero(input.blankEdgesClearedPages),
    elapsedMs: numberOrZero(input.elapsedMs),
    outputPath: typeof input.outputPath === "string" ? input.outputPath : "",
    preprocessOnly: typeof input.preprocessOnly === "boolean" ? input.preprocessOnly : true,
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJobStatus(value: unknown): value is ScanPreprocessJob["status"] {
  return ["queued", "running", "completed", "failed", "cancelled"].includes(String(value));
}

function isProgressStage(value: unknown): value is ScanPreprocessProgress["stage"] {
  return ["queued", "validating", "preprocessing", "writing-output", "completed", "failed"].includes(String(value));
}
