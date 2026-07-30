import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isActiveOcrStatus, type OcrCommandJob } from "../../../shared/ocr/jobQueue";
import type {
  OcrOutputStrategy,
  OcrProviderConfig,
  OcrQualityCheckRequest,
  OcrRequest,
} from "../../../shared/ocr/types";
import {
  createOcrBridgeService,
  type OcrBridgeService,
} from "../service/bridge";
import {
  createTauriOcrJobController,
  type OcrJobController,
} from "../service/ocrJobController";

/**
 * OCR 工作区控制器：把后端 OcrJobController / OcrBridgeService + 当前文档元信息
 * 聚合成 AppShell 友好的状态 + 动作。AppShell 在 ocr 模式下把控制器的状态喂给
 * `OcrModeToolbar` / `OcrJobList` / `OcrQualityReportView`，并消费 start/cancel
 * / select 回调。
 *
 * 数据流：
 * - mount → listOcrJobs() 拉一次，填充 jobs
 * - 任意 active job → 启动 setInterval 轮询
 * - startOcr 走 OcrBridgeService（带 provider 校验 + 隐私 consent），完成后 listOcrJobs 刷新
 * - cancelJob 走 OcrJobController.cancelOcrJob
 *
 * 设计边界（v0.1 wiring）：
 * - 不修改 `OcrJobController` / `OcrBridgeService` 签名；仅消费。
 * - 默认 OcrJobController 走 Tauri `invoke`；测试可通过 `options.controller` 注入 mock。
 * - 默认 OcrBridgeService 走 `createOcrBridgeService()`（无 invoker 时同样不连 Tauri）。
 * - `networkConsentGranted` 未授权时云端 provider 会被 privacy guard 拒绝，
 *   `errorMessage` 会展示具体原因（前端不做 confirm 弹窗，留给后续 consent flow）。
 */

export interface OcrWorkspaceParameters {
  /** 当前选中的 provider（resolved）；无 provider 时为 null */
  activeProvider: {
    id: string;
    label: string;
    kind: "local" | "cloud";
    requiresNetworkConsent: boolean;
  } | null;
  /** 输出策略（new-layered-pdf 等） */
  outputStrategy: OcrOutputStrategy;
  /** 质量检查摘要：未启用 / 已启用（带关键词） */
  qualityCheck: {
    enabled: boolean;
    keywords: ReadonlyArray<string>;
    description: string;
  };
  /** 是否需要联网授权（云端 provider + requireNetworkConsent + 未授权） */
  networkConsentRequired: boolean;
}

/**
 * Provider 类别归一化：根据 id / endpoint / known provider 列表推断 "local" vs "cloud"。
 * 本地 provider（local-ocrmypdf / legal-skills）走本机二进制；云端 provider
 * （paddleocr / mineru / 其他 endpoint 形式）需要网络。
 */
function classifyProviderKind(provider: OcrProviderConfig | null | undefined): "local" | "cloud" {
  if (!provider) {
    return "local";
  }
  const id = provider.id.toLowerCase();
  if (id.startsWith("local-") || id === "legal-skills") {
    return "local";
  }
  if (provider.endpoint && /^https?:\/\//.test(provider.endpoint) && !/localhost|127\.|::1/.test(provider.endpoint)) {
    return "cloud";
  }
  return "cloud";
}

export interface OcrWorkspaceController {
  jobs: ReadonlyArray<OcrCommandJob>;
  currentJob: OcrCommandJob | undefined;
  selectedJobId: string | null;
  busy: boolean;
  hasDocument: boolean;
  hasProvider: boolean;
  errorMessage: string | null;
  /** 当前任务参数区展示用的只读摘要（ISS-009 收口用） */
  parameters: OcrWorkspaceParameters;
  startOcr: (options?: { pageRange?: string }) => Promise<void>;
  outputLayeredPdf: () => Promise<void>;
  cancelJob: (job: OcrCommandJob) => Promise<void>;
  selectJob: (job: OcrCommandJob) => void;
  openQualityReport: (job: OcrCommandJob) => void;
  openJobList: () => void;
  refresh: () => Promise<void>;
}

export interface UseOcrWorkspaceControllerOptions {
  /** 当前打开 PDF 的绝对路径；空表示尚未通过 Tauri 打开带路径的文档。 */
  documentPath?: string;
  /** 已配置的 OCR provider 列表（来自 settings.ocrProviders）。 */
  providers: ReadonlyArray<OcrProviderConfig>;
  /** 默认 provider id；缺省时取第一个 enabled 的 provider。 */
  providerId?: string;
  /** startOcr 默认输出策略；outputLayeredPdf 强制走 "new-layered-pdf"。 */
  outputStrategy?: OcrOutputStrategy;
  /** 质量检查请求；缺省时 OcrBridgeService 会回退到默认空请求。 */
  qualityCheck?: OcrQualityCheckRequest;
  /** 是否要求联网 OCR 显式确认；缺省 true（沿用 settings 默认）。 */
  requireNetworkConsent?: boolean;
  /** 用户是否已对当前 provider 授权网络；缺省 false。 */
  networkConsentGranted?: boolean;
  /** 注入 controller；测试用。缺省时调用 createTauriOcrJobController()。 */
  controller?: OcrJobController;
  /** 注入 bridge service；测试用。缺省时调用 createOcrBridgeService()。 */
  bridge?: OcrBridgeService;
  /** 轮询间隔毫秒；缺省 1500。 */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 1500;

/**
 * 生成 OCR 双层 PDF 默认输出路径：把 `inputPath` 的最后一段 basename 去掉 `.pdf`
 * 后追加 `-ocr.pdf`，与原文件同目录。
 */
export function deriveLayeredOutputPath(inputPath: string): string {
  const slash = Math.max(inputPath.lastIndexOf("/"), inputPath.lastIndexOf("\\"));
  const dir = slash >= 0 ? inputPath.slice(0, slash) : "";
  const tail = slash >= 0 ? inputPath.slice(slash + 1) : inputPath;
  const base = tail.replace(/\.pdf$/i, "");
  return dir.length > 0 ? `${dir}/${base}-ocr.pdf` : `${base}-ocr.pdf`;
}

export function useOcrWorkspaceController(
  options: UseOcrWorkspaceControllerOptions,
): OcrWorkspaceController {
  const {
    documentPath,
    providers,
    providerId,
    outputStrategy = "new-layered-pdf",
    qualityCheck,
    requireNetworkConsent: _requireNetworkConsent = true,
    networkConsentGranted = false,
    controller: controllerOption,
    bridge: bridgeOption,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = options;

  // 选 provider
  const resolvedProviderId = useMemo(() => {
    if (providerId) {
      return providerId;
    }
    const enabled = providers.find((p) => p.enabled);
    return enabled?.id ?? providers[0]?.id ?? "";
  }, [providerId, providers]);

  const provider = useMemo(
    () => providers.find((p) => p.id === resolvedProviderId) ?? null,
    [providers, resolvedProviderId],
  );

  const hasProvider = Boolean(provider && provider.enabled);
  const hasDocument = typeof documentPath === "string" && documentPath.trim().length > 0;

  // 注入 controller / bridge（仅在首次挂载时锁定）
  const controllerRef = useRef<OcrJobController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = controllerOption ?? createTauriOcrJobController();
  }
  const bridgeRef = useRef<OcrBridgeService | null>(null);
  if (bridgeRef.current === null) {
    bridgeRef.current = bridgeOption ?? createOcrBridgeService();
  }

  const [jobs, setJobs] = useState<ReadonlyArray<OcrCommandJob>>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    try {
      const next = await controller.listOcrJobs();
      setJobs(next);
      // 不在 refresh 成功时清空 errorMessage：避免把 startOcr 等主动动作设置的
      // 错误信息被并发 mount refresh 覆盖；startOcr / outputLayeredPdf / cancelJob
      // 自身在 try 开头会先 setErrorMessage(null)。
    } catch (error) {
      setErrorMessage(toMessage(error));
    }
  }, []);

  // 初始加载
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 轮询：仅在有活跃任务时
  useEffect(() => {
    const hasActive = jobs.some((j) => isActiveOcrStatus(j.status));
    if (!hasActive) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [jobs, pollIntervalMs, refresh]);

  // selectedJobId 跟随：用户已选且仍存在则保留；否则回退到最新任务
  useEffect(() => {
    if (selectedJobId && jobs.some((j) => j.id === selectedJobId)) {
      return;
    }
    const fallback = jobs[0]?.id ?? null;
    if (fallback !== selectedJobId) {
      setSelectedJobId(fallback);
    }
  }, [jobs, selectedJobId]);

  // currentJob 解析：优先 active；否则 selectedJobId
  const currentJob = useMemo<OcrCommandJob | undefined>(() => {
    const active = jobs.find((j) => isActiveOcrStatus(j.status));
    if (active) {
      return active;
    }
    if (selectedJobId) {
      return jobs.find((j) => j.id === selectedJobId);
    }
    return undefined;
  }, [jobs, selectedJobId]);

  const startOcr = useCallback(async (options?: { pageRange?: string }) => {
    if (!hasDocument) {
      setErrorMessage("请先打开一个带路径的 PDF 文档再启动 OCR。");
      return;
    }
    if (!hasProvider || !provider) {
      setErrorMessage("请先在设置中启用 OCR 后端。");
      return;
    }
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const request: OcrRequest = {
        inputPath: documentPath!,
        outputPath: deriveLayeredOutputPath(documentPath!),
        ...(options?.pageRange ? { pageRange: options.pageRange } : {}),
        providerId: provider.id,
        outputStrategy,
        ...(qualityCheck ? { qualityCheck } : {}),
        networkConsentGranted: !provider.requiresNetworkConsent || networkConsentGranted,
      };
      await bridge.startOcr(request, { providers: providers as OcrProviderConfig[] });
      await refresh();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }, [
    hasDocument,
    hasProvider,
    provider,
    documentPath,
    outputStrategy,
    qualityCheck,
    networkConsentGranted,
    providers,
    refresh,
  ]);

  const outputLayeredPdf = useCallback(async () => {
    if (!hasDocument) {
      setErrorMessage("请先打开一个带路径的 PDF 文档再启动 OCR。");
      return;
    }
    if (!hasProvider || !provider) {
      setErrorMessage("请先在设置中启用 OCR 后端。");
      return;
    }
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const request: OcrRequest = {
        inputPath: documentPath!,
        outputPath: deriveLayeredOutputPath(documentPath!),
        providerId: provider.id,
        outputStrategy: "new-layered-pdf",
        ...(qualityCheck ? { qualityCheck } : {}),
        networkConsentGranted: !provider.requiresNetworkConsent || networkConsentGranted,
      };
      await bridge.startOcr(request, { providers: providers as OcrProviderConfig[] });
      await refresh();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }, [
    hasDocument,
    hasProvider,
    provider,
    documentPath,
    qualityCheck,
    networkConsentGranted,
    providers,
    refresh,
  ]);

  const cancelJob = useCallback(async (job: OcrCommandJob) => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      await controller.cancelOcrJob(job.id);
      await refresh();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const selectJob = useCallback((job: OcrCommandJob) => {
    setSelectedJobId(job.id);
  }, []);

  const openQualityReport = useCallback((job: OcrCommandJob) => {
    setSelectedJobId(job.id);
  }, []);

  // 当前 workspace 已常驻展示 job list；保留接口以备后续切换为模态/侧栏。
  const openJobList = useCallback(() => {
    /* no-op for v0.1：job list 已是常驻面板 */
  }, []);

  return {
    jobs,
    currentJob,
    selectedJobId,
    busy,
    hasDocument,
    hasProvider,
    errorMessage,
    parameters: {
      activeProvider: provider
        ? {
            id: provider.id,
            label: provider.displayName,
            kind: classifyProviderKind(provider),
            requiresNetworkConsent: provider.requiresNetworkConsent,
          }
        : null,
      outputStrategy,
      qualityCheck: {
        enabled: Boolean(qualityCheck),
        keywords: qualityCheck?.keywords ?? [],
        description: qualityCheck ? "已启用" : "未启用",
      },
      networkConsentRequired:
        Boolean(provider && provider.requiresNetworkConsent) && !networkConsentGranted,
    },
    startOcr,
    outputLayeredPdf,
    cancelJob,
    selectJob,
    openQualityReport,
    openJobList,
    refresh,
  };
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
