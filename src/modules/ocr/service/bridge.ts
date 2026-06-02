import { invoke } from "@tauri-apps/api/core";
import {
  prepareOcrRequest,
  sanitizeOcrError,
  validateOcrRequest,
  type OcrValidationResult,
} from "../../../shared/ocr/defaults";
import { isAllowedOcrEndpoint, isSafeApiKeyRef } from "../../../shared/ocr/providerSecurity";
import type {
  OcrJob,
  OcrJobProgress,
  OcrJobProgressStage,
  OcrJobStatus,
  OcrOutputStrategy,
  OcrProviderBridgeRequest,
  OcrProviderConfig,
  OcrProviderType,
  OcrQualityCheckRequest,
  OcrQualitySummary,
  OcrRequest,
  PreparedOcrRequest,
} from "../../../shared/ocr/types";

export interface OcrBridgeBackend {
  startOcr: (request: OcrProviderBridgeRequest) => Promise<unknown>;
}

export interface OcrBridgeContext {
  providers: OcrProviderConfig[];
}

export interface OcrBridgeService {
  startOcr: (request: OcrRequest, context: OcrBridgeContext) => Promise<OcrJob>;
  validateRequest: (request: OcrRequest, context: OcrBridgeContext) => OcrValidationResult;
  getAdapter: (providerType: OcrProviderType) => OcrProviderAdapter;
}

export interface OcrProviderAdapter {
  type: OcrProviderType;
  transport: "local-command" | "cloud-api";
  validate: (request: PreparedOcrRequest, provider: OcrProviderConfig) => string[];
  createJobModel: (request: OcrProviderBridgeRequest, status: "queued" | "running") => OcrJob;
}

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const cloudProviderTypes = new Set<OcrProviderType>(["paddleocr", "mineru"]);
const jobStatuses = new Set<OcrJobStatus>(["queued", "running", "completed", "failed", "cancelled"]);
const progressStages = new Set<OcrJobProgressStage>([
  "queued",
  "validating",
  "dispatching-provider",
  "running-provider",
  "writing-output",
  "quality-check",
  "completed",
  "failed",
]);
const outputStrategies = new Set<OcrOutputStrategy>(["new-layered-pdf", "text-sidecar", "quality-check-only"]);

const adapters: Record<OcrProviderType, OcrProviderAdapter> = {
  "local-ocrmypdf": createProviderAdapter("local-ocrmypdf", "local-command"),
  "legal-skills": createProviderAdapter("legal-skills", "local-command"),
  paddleocr: createProviderAdapter("paddleocr", "cloud-api"),
  mineru: createProviderAdapter("mineru", "cloud-api"),
};

export function createTauriOcrBridgeBackend(invoker: TauriInvoker = invoke): OcrBridgeBackend {
  return {
    startOcr: (request) => invoker<unknown>("start_ocr_job", { request }),
  };
}

export function createOcrBridgeService(backend: OcrBridgeBackend = createTauriOcrBridgeBackend()): OcrBridgeService {
  return {
    async startOcr(request, context) {
      const validation = validateOcrRequest(request);
      if (!validation.valid) {
        throw createValidationError("OCR 参数校验失败", validation.errors);
      }

      const preparedRequest = prepareOcrRequest(request);
      const provider = resolveProvider(preparedRequest.providerId, context.providers);
      const adapter = adapters[provider.type];
      const providerErrors = adapter.validate(preparedRequest, provider);
      if (providerErrors.length > 0) {
        throw createValidationError("OCR Provider 校验失败", providerErrors);
      }

      const bridgeRequest: OcrProviderBridgeRequest = {
        ...preparedRequest,
        provider,
        networkConsentGranted: preparedRequest.networkConsentGranted === true,
      };

      try {
        const backendJob = await backend.startOcr(bridgeRequest);
        return normalizeOcrJob(backendJob, bridgeRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw createSanitizedBridgeError(message);
      }
    },

    validateRequest(request, context) {
      const validation = validateOcrRequest(request);
      if (!validation.valid) {
        return validation;
      }

      const preparedRequest = prepareOcrRequest(request);
      const provider = context.providers.find((candidate) => candidate.id === preparedRequest.providerId);
      if (!provider) {
        return {
          valid: false,
          errors: ["OCR Provider 不存在或未配置。"],
        };
      }

      const errors = adapters[provider.type].validate(preparedRequest, provider);
      return {
        valid: errors.length === 0,
        errors,
      };
    },

    getAdapter(providerType) {
      return adapters[providerType];
    },
  };
}

export function createOcrJobModel(
  request: OcrProviderBridgeRequest,
  status: "queued" | "running" = "queued",
  now = new Date().toISOString(),
): OcrJob {
  return {
    id: `ocr-${status}-${now}`,
    inputPath: request.inputPath,
    outputPath: request.outputPath,
    pageRange: request.pageRange,
    backend: request.provider.type,
    providerId: request.provider.id,
    status,
    outputStrategy: request.outputStrategy,
    progress: createProgressForStatus(status),
    qualityCheck: request.qualityCheck,
    createdAt: now,
    updatedAt: now,
  };
}

function createProviderAdapter(
  type: OcrProviderType,
  transport: OcrProviderAdapter["transport"],
): OcrProviderAdapter {
  return {
    type,
    transport,
    validate(request, provider) {
      const errors: string[] = [];
      if (!provider.enabled) {
        errors.push(`${provider.displayName} 未启用。`);
      }
      if (provider.id.trim().length === 0) {
        errors.push("OCR Provider 缺少 id。");
      }
      if (provider.type !== type) {
        errors.push("OCR Provider 类型与 adapter 不匹配。");
      }

      if (isNetworkOcrProvider(provider)) {
        if (request.networkConsentGranted !== true) {
          errors.push("联网 OCR 需要用户明确确认。");
        }
        if (!provider.apiKeyRef || provider.apiKeyRef.trim().length === 0) {
          errors.push(`${provider.displayName} 需要配置 apiKeyRef。`);
        }
        if (provider.apiKeyRef && !isSafeApiKeyRef(provider.apiKeyRef)) {
          errors.push(`${provider.displayName} 的 apiKeyRef 必须使用凭证引用或脱敏占位。`);
        }
        if (!isAllowedOcrEndpoint(provider.endpoint)) {
          errors.push(`${provider.displayName} 需要配置 HTTPS endpoint，本机调试可使用 localhost HTTP。`);
        }
      }

      return errors;
    },
    createJobModel: createOcrJobModel,
  };
}

function resolveProvider(providerId: string, providers: OcrProviderConfig[]): OcrProviderConfig {
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw createValidationError("OCR Provider 校验失败", ["OCR Provider 不存在或未配置。"]);
  }

  return provider;
}

function createValidationError(prefix: string, errors: string[]): Error {
  return new Error(`${prefix}：${errors.map(sanitizeOcrError).join("；")}`);
}

function createSanitizedBridgeError(message: string): Error {
  const sanitizedMessage = sanitizeOcrError(message);
  return Object.assign(new Error(`OCR bridge 调用失败：${sanitizedMessage}`), {
    cause: new Error(sanitizedMessage),
  });
}

function normalizeOcrJob(input: unknown, request: OcrProviderBridgeRequest): OcrJob {
  const now = new Date().toISOString();
  if (!isRecord(input)) {
    return createOcrJobModel(request, "queued", now);
  }

  const status = isJobStatus(input.status) ? input.status : "queued";

  return {
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : `ocr-${now}`,
    inputPath: typeof input.inputPath === "string" ? input.inputPath : request.inputPath,
    outputPath: typeof input.outputPath === "string" && input.outputPath.length > 0 ? input.outputPath : request.outputPath,
    pageRange: typeof input.pageRange === "string" ? input.pageRange : request.pageRange,
    backend: isProviderType(input.backend) ? input.backend : request.provider.type,
    providerId: typeof input.providerId === "string" ? input.providerId : request.provider.id,
    status,
    outputStrategy: isOutputStrategy(input.outputStrategy) ? input.outputStrategy : request.outputStrategy,
    progress: normalizeProgress(input.progress, status),
    qualityCheck: normalizeQualityCheck(input.qualityCheck, request.qualityCheck),
    quality: normalizeQualitySummary(input.quality),
    errorMessage: typeof input.errorMessage === "string" ? sanitizeOcrError(input.errorMessage) : undefined,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : now,
  };
}

function normalizeProgress(input: unknown, status: OcrJobStatus): OcrJobProgress {
  const fallback = createProgressForStatus(status === "running" ? "running" : "queued");
  if (!isRecord(input)) {
    return fallback;
  }

  return {
    stage: isProgressStage(input.stage) ? input.stage : fallback.stage,
    completedPages: numberOrZero(input.completedPages),
    totalPages: numberOrZero(input.totalPages),
    message: typeof input.message === "string" ? sanitizeOcrError(input.message) : undefined,
    providerMessage: typeof input.providerMessage === "string" ? sanitizeOcrError(input.providerMessage) : undefined,
  };
}

function createProgressForStatus(status: "queued" | "running"): OcrJobProgress {
  return {
    stage: status === "running" ? "running-provider" : "queued",
    completedPages: 0,
    totalPages: 0,
  };
}

function normalizeQualityCheck(
  input: unknown,
  fallback: OcrQualityCheckRequest,
): OcrQualityCheckRequest {
  if (!isRecord(input)) {
    return fallback;
  }

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : fallback.enabled,
    samplePages: Array.isArray(input.samplePages) ? input.samplePages.filter(isPositiveInteger) : fallback.samplePages,
    keywords: Array.isArray(input.keywords)
      ? input.keywords
          .filter((keyword): keyword is string => typeof keyword === "string")
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0)
      : fallback.keywords,
    minTextPageRatio:
      typeof input.minTextPageRatio === "number" ? input.minTextPageRatio : fallback.minTextPageRatio,
    maxFileSizeRatio:
      typeof input.maxFileSizeRatio === "number" ? input.maxFileSizeRatio : fallback.maxFileSizeRatio,
  };
}

function normalizeQualitySummary(input: unknown): OcrQualitySummary | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  return {
    searchedKeywords: stringArray(input.searchedKeywords),
    matchedKeywords: stringArray(input.matchedKeywords),
    textPages: numberOrZero(input.textPages),
    emptyTextPages: numberOrZero(input.emptyTextPages),
    fileSizeRatio: typeof input.fileSizeRatio === "number" ? input.fileSizeRatio : undefined,
    elapsedMs: typeof input.elapsedMs === "number" ? input.elapsedMs : undefined,
  };
}

function isNetworkOcrProvider(provider: OcrProviderConfig): boolean {
  return cloudProviderTypes.has(provider.type) || provider.requiresNetworkConsent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProviderType(value: unknown): value is OcrProviderType {
  return ["local-ocrmypdf", "legal-skills", "paddleocr", "mineru"].includes(String(value));
}

function isJobStatus(value: unknown): value is OcrJobStatus {
  return jobStatuses.has(String(value) as OcrJobStatus);
}

function isOutputStrategy(value: unknown): value is OcrOutputStrategy {
  return outputStrategies.has(String(value) as OcrOutputStrategy);
}

function isProgressStage(value: unknown): value is OcrJobProgressStage {
  return progressStages.has(String(value) as OcrJobProgressStage);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
