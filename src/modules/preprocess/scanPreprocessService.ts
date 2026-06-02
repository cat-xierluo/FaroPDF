import { invoke } from "@tauri-apps/api/core";
import {
  prepareScanPreprocessRequest,
  sanitizeScanPreprocessError,
  validateScanPreprocessRequest,
} from "../../shared/preprocess/defaults";
import type {
  ScanPreprocessJob,
  ScanPreprocessProgress,
  ScanPreprocessRequest,
  ScanPreprocessSummary,
} from "../../shared/preprocess/types";

export interface ScanPreprocessBackend {
  startScanPreprocess: (request: ScanPreprocessRequest) => Promise<unknown>;
}

export interface ScanPreprocessService {
  startPreprocess: (request: ScanPreprocessRequest) => Promise<ScanPreprocessJob>;
  validateRequest: (request: ScanPreprocessRequest) => ReturnType<typeof validateScanPreprocessRequest>;
}

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriScanPreprocessBackend(invoker: TauriInvoker = invoke): ScanPreprocessBackend {
  return {
    startScanPreprocess: (request) => invoker<unknown>("start_scan_preprocess_job", { request }),
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
        throw Object.assign(new Error(`扫描预处理 bridge 调用失败：${sanitizeScanPreprocessError(message)}`), {
          cause: error,
        });
      }
    },

    validateRequest(request) {
      return validateScanPreprocessRequest(prepareScanPreprocessRequest(request));
    },
  };
}

function normalizeScanPreprocessJob(input: unknown, request: ScanPreprocessRequest): ScanPreprocessJob {
  const now = new Date().toISOString();
  if (!isRecord(input)) {
    return createFallbackQueuedJob(request, now);
  }

  const progress = normalizeProgress(input.progress);
  const summary = normalizeSummary(input.summary);

  return {
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : `scan-preprocess-${now}`,
    inputPath: typeof input.inputPath === "string" ? input.inputPath : request.inputPath,
    outputPath: typeof input.outputPath === "string" && input.outputPath.length > 0 ? input.outputPath : request.outputPath ?? "",
    pageRange: typeof input.pageRange === "string" ? input.pageRange : request.pageRange,
    status: isJobStatus(input.status) ? input.status : "queued",
    options: request.options,
    progress,
    summary,
    errorMessage: typeof input.errorMessage === "string" ? sanitizeScanPreprocessError(input.errorMessage) : undefined,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now,
  };
}

function createFallbackQueuedJob(request: ScanPreprocessRequest, now: string): ScanPreprocessJob {
  return {
    id: `scan-preprocess-${now}`,
    inputPath: request.inputPath,
    outputPath: request.outputPath ?? "",
    pageRange: request.pageRange,
    status: "queued",
    options: request.options,
    progress: {
      stage: "queued",
      completedPages: 0,
      totalPages: 0,
    },
    createdAt: now,
    updatedAt: now,
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
