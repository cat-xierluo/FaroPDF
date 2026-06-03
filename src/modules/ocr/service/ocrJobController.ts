import { invoke } from "@tauri-apps/api/core";
import {
  isActiveOcrStatus,
  isTerminalOcrStatus,
  type OcrCommandJob,
  type OcrTextExtractionResponse,
} from "../../../shared/ocr/jobQueue";
import { sanitizeOcrError } from "../../../shared/ocr/defaults";
import type { OcrJob } from "../../../shared/ocr/types";

/**
 * Controller for the persistent OCR job queue.
 *
 * The Tauri side owns the on-disk `ocr-jobs.json` and runs the actual
 * `ocrmypdf` / `curl` dispatch in a background task. This controller
 * just polls the Rust state and exposes high-level operations:
 *
 * - `startOcrJob` triggers `start_ocr_job` (which spawns the task and
 *   returns the job in `running` state).
 * - `pollOcrJob` / `listOcrJobs` query the latest queue snapshot.
 * - `cancelOcrJob` asks the backend to mark a queued or running job
 *   as cancelled.
 * - `extractOcrText` shells out to `pdftotext` to read the layered
 *   PDF, so the front-end can compute the quality report.
 *
 * The controller itself never persists state — that's the Tauri
 * queue's responsibility — so a refresh across tabs / windows always
 * shows the same view.
 */

export interface OcrBackendInvocationOptions {
  invoker?: TauriInvoker;
}

export interface OcrJobController {
  startOcrJob: (request: OcrCommandJob) => Promise<OcrCommandJob>;
  listOcrJobs: () => Promise<OcrCommandJob[]>;
  pollOcrJob: (jobId: string) => Promise<OcrCommandJob | null>;
  cancelOcrJob: (jobId: string) => Promise<OcrCommandJob | null>;
  extractText: (pdfPath: string) => Promise<OcrTextExtractionResponse>;
}

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const DEFAULT_INVOKER: TauriInvoker = <T>(command: string, args?: Record<string, unknown>) =>
  invoke<T>(command, args);

export function createTauriOcrJobController(
  options: OcrBackendInvocationOptions = {},
): OcrJobController {
  const invoker = options.invoker ?? DEFAULT_INVOKER;

  return {
    async startOcrJob(request) {
      try {
        const job = await invoker<OcrCommandJob>("start_ocr_job", { request });
        return job;
      } catch (error) {
        throw sanitizeBackendError(error);
      }
    },

    async listOcrJobs() {
      try {
        const jobs = await invoker<OcrCommandJob[]>("list_ocr_jobs");
        return Array.isArray(jobs) ? jobs : [];
      } catch (error) {
        throw sanitizeBackendError(error);
      }
    },

    async pollOcrJob(jobId) {
      try {
        const job = await invoker<OcrCommandJob | null>("poll_ocr_job", { jobId });
        return job ?? null;
      } catch (error) {
        throw sanitizeBackendError(error);
      }
    },

    async cancelOcrJob(jobId) {
      try {
        const job = await invoker<OcrCommandJob | null>("cancel_ocr_job", { jobId });
        return job ?? null;
      } catch (error) {
        throw sanitizeBackendError(error);
      }
    },

    async extractText(pdfPath) {
      try {
        const result = await invoker<OcrTextExtractionResponse>("extract_ocr_text", { pdfPath });
        return {
          pages: Array.isArray(result?.pages) ? result.pages : [],
          totalPages: result?.totalPages ?? 0,
          searchablePages: result?.searchablePages ?? 0,
        };
      } catch (error) {
        throw sanitizeBackendError(error);
      }
    },
  };
}

/**
 * Convert a Tauri-side stored job into the front-end `OcrJob` model
 * used by UI components. The mapping is deliberately tolerant: the
 * back-end may add new optional fields without breaking the UI.
 */
export function commandJobToOcrJob(stored: OcrCommandJob): OcrJob {
  return {
    id: stored.id,
    inputPath: stored.inputPath,
    outputPath: stored.outputPath,
    pageRange: stored.pageRange,
    backend: stored.backend as OcrJob["backend"],
    providerId: stored.providerId,
    status: stored.status as OcrJob["status"],
    outputStrategy: stored.outputStrategy as OcrJob["outputStrategy"],
    progress: {
      stage: stored.progress.stage as OcrJob["progress"]["stage"],
      completedPages: stored.progress.completedPages,
      totalPages: stored.progress.totalPages,
      message: stored.progress.message,
      providerMessage: stored.progress.message,
    },
    qualityCheck: stored.qualityCheck,
    quality: stored.quality,
    errorMessage: stored.errorMessage,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * 在内存中按状态筛选任务；不修改原数组。
 */
export function filterOcrJobs(
  jobs: ReadonlyArray<OcrCommandJob>,
  options: { activeOnly?: boolean; backend?: string } = {},
): OcrCommandJob[] {
  return jobs.filter((job) => {
    if (options.activeOnly && !isActiveOcrStatus(job.status) && !isTerminalOcrStatus(job.status)) {
      return false;
    }
    if (!options.activeOnly && isActiveOcrStatus(job.status) === false && isTerminalOcrStatus(job.status)) {
      // 包含全部；继续判断 backend。
    }
    if (options.backend && job.backend !== options.backend) {
      return false;
    }
    return true;
  });
}

function sanitizeBackendError(error: unknown): Error {
  if (error instanceof Error) {
    return Object.assign(new Error(sanitizeOcrError(error.message) || "OCR 后台调用失败"), {
      cause: error,
    });
  }
  return new Error(sanitizeOcrError(String(error)) || "OCR 后台调用失败");
}
