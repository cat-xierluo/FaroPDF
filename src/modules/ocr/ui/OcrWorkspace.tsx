import { useEffect, useMemo, useRef } from "react";
import {
  formatOcrBackendLabel,
  formatOcrStatusLabel,
  isActiveOcrStatus,
  type OcrCommandJob,
} from "../../../shared/ocr/jobQueue";
import {
  OcrJobList,
  OcrQualityReportView,
  type OcrJobListProps,
  type OcrQualityReportViewProps,
} from "./OcrModeToolbar";
import type { OcrWorkspaceController } from "./useOcrWorkspaceController";
import { OcrWorkspaceHeader } from "./OcrWorkspaceHeader";
import "./ocrModeToolbar.css";
import "./ocrWorkspace.css";

/**
 * OCR 工作区：三块清晰分区（ISS-QA-11 理顺结构）。
 * 1. 任务参数（OcrWorkspaceHeader，全宽顶栏）——只读展示 provider / 页码范围 / 输出策略 / 质量检查。
 * 2. 状态（OcrStatusStrip，全宽）——整体状态 pill + 当前任务摘要 + 进度条 + 计数 + 错误，
 *    收口原本碎片化在工具条 / 任务 hint / 右栏 dot 的状态信息。
 * 3. 任务列表（OcrJobList，左列）+ 质量报告（OcrQualityReportView，右列）。
 *
 * 与 OcrModeToolbar（context toolbar 上的动作条）配合：工具条负责"启动 / 取消 /
 * 输出双层 PDF / 质量检查"动作，本组件负责"展示参数、状态、任务队列与报告"。
 * 选择 / 取消等动作通过 OcrWorkspaceController 回调；controller 内部统一维护
 * jobs / selectedJobId / busy 状态并轮询。
 */

export interface OcrWorkspaceProps {
  controller: OcrWorkspaceController;
  /** 当前打开文档名（脱敏） */
  documentLabel?: string;
  /** 当前文档页数（用于参数区显示） */
  pageCount?: number;
  /** 全部可用 OCR provider 列表（含 disabled），用于参数区摘要 */
  availableProviders?: Parameters<typeof OcrWorkspaceHeader>[0]["availableProviders"];
}

export function OcrWorkspace({ controller, documentLabel, pageCount, availableProviders }: OcrWorkspaceProps) {
  const jobListRef = useRef<HTMLDivElement | null>(null);
  const {
    cancelJob,
    currentJob,
    errorMessage,
    jobs,
    openQualityReport,
    parameters,
    refresh,
    selectJob,
    selectedJobId,
  } = controller;

  // 暴露 refresh：保留给后续手动刷新按钮（v0.1 仅依赖轮询）。
  useEffect(() => {
    return () => {
      /* no-op cleanup; reserved for future manual refresh button */
    };
  }, []);

  const selectedJob = useMemo<OcrCommandJob | undefined>(() => {
    if (!selectedJobId) {
      return undefined;
    }
    return jobs.find((job) => job.id === selectedJobId);
  }, [jobs, selectedJobId]);

  // 若 currentJob 已是 active（运行中），把列表锚到它身上
  useEffect(() => {
    if (!currentJob || !isActiveOcrStatus(currentJob.status)) {
      return;
    }
    if (currentJob.id === selectedJobId) {
      return;
    }
    selectJob(currentJob);
  }, [currentJob, selectJob, selectedJobId]);

  // 错误提示用 ref 让外层能滚动（jsdom 不实现 scrollIntoView，链式可选调用兜底）
  useEffect(() => {
    if (!errorMessage) {
      return;
    }
    jobListRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [errorMessage]);

  const onSelect: OcrJobListProps["onSelect"] = (job) => {
    selectJob(job);
    // refresh 后让 selectedJob 立刻反映新选择
    void refresh();
  };

  const onCancel: OcrJobListProps["onCancel"] = (job) => {
    void cancelJob(job);
  };

  const onOpenQualityReport: OcrJobListProps["onOpenQualityReport"] = (job) => {
    openQualityReport(job);
  };

  const reportProps: OcrQualityReportViewProps | null = selectedJob
    ? { job: selectedJob }
    : null;

  return (
    <main className="ocr-workspace" aria-label="OCR 工作区">
      <OcrWorkspaceHeader
        availableProviders={availableProviders}
        documentLabel={documentLabel}
        pageCount={pageCount}
        parameters={parameters}
      />
      <OcrStatusStrip currentJob={currentJob} errorMessage={errorMessage} jobs={jobs} />
      <section className="ocr-workspace__jobs" aria-label="OCR 任务">
        <header className="ocr-workspace__section-header">
          <h2>OCR 任务</h2>
          <p className="ocr-workspace__hint">
            {jobs.length === 0
              ? "尚未启动任何 OCR 任务。"
              : "选择任务以在右侧查看状态与质量报告"}
          </p>
        </header>
        <div ref={jobListRef}>
          <OcrJobList
            jobs={jobs}
            onCancel={onCancel}
            onOpenQualityReport={onOpenQualityReport}
            onSelect={onSelect}
            selectedJobId={selectedJobId ?? undefined}
          />
        </div>
      </section>
      <section className="ocr-workspace__report" aria-label="OCR 任务详情">
        <header className="ocr-workspace__section-header">
          <h2>质量报告</h2>
          <p className="ocr-workspace__hint">
            {reportProps ? "查看选中任务的可检索页与关键词命中" : "选中左侧任务后查看质量报告"}
          </p>
        </header>
        {reportProps ? <OcrQualityReportView {...reportProps} /> : <OcrEmptyReport />}
      </section>
    </main>
  );
}

function OcrEmptyReport() {
  return (
    <div className="ocr-quality-report ocr-quality-report--missing" role="status">
      <p>尚未选中 OCR 任务。</p>
      <p>启动识别或从左侧列表选择任务后，报告将出现在此区域。</p>
    </div>
  );
}

type OcrStatusState = "idle" | "running" | "completed" | "failed";

const OCR_STATE_LABELS: Record<OcrStatusState, string> = {
  idle: "待处理",
  running: "进行中",
  completed: "已完成",
  failed: "失败",
};

/**
 * OCR 状态区（ISS-QA-11）：把原本碎片化在工具条 / 任务 hint / 右栏 dot 的状态
 * 收口成一块独立分区，显示整体状态 pill、当前任务摘要与进度条、任务计数和错误。
 *
 * 状态派生：以 currentJob 为锚（active→running / completed / failed），无任务时
 * 若有 errorMessage 视为 failed，否则 idle。这样进入 OCR 模式后用户一眼能看到
 * 「现在在干什么、进行到哪、有没有出错」，而不必扫三个 surface。
 */
function OcrStatusStrip({
  currentJob,
  errorMessage,
  jobs,
}: {
  currentJob: OcrCommandJob | undefined;
  errorMessage: string | null;
  jobs: ReadonlyArray<OcrCommandJob>;
}) {
  const activeCount = jobs.filter((job) => isActiveOcrStatus(job.status)).length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;

  const state: OcrStatusState = currentJob
    ? isActiveOcrStatus(currentJob.status)
      ? "running"
      : currentJob.status === "completed"
        ? "completed"
        : currentJob.status === "failed"
          ? "failed"
          : "idle"
    : errorMessage
      ? "failed"
      : "idle";

  const showProgress =
    !!currentJob && (currentJob.status === "running" || currentJob.status === "completed");
  const completedPages = currentJob?.progress.completedPages ?? 0;
  const totalPages = currentJob?.progress.totalPages ?? 0;
  const pct =
    totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : state === "completed" ? 100 : 0;

  return (
    <section className="ocr-workspace__status" aria-label="OCR 状态" data-state={state}>
      <header className="ocr-workspace__section-header">
        <h2>状态</h2>
        <p className="ocr-workspace__hint">
          {jobs.length === 0
            ? "暂无任务"
            : `共 ${jobs.length} 个任务 · ${activeCount} 进行中 · ${completedCount} 已完成`}
        </p>
      </header>
      <div className="ocr-workspace__status-body">
        <span
          className={`ocr-workspace__status-pill ocr-workspace__status-pill--${state}`}
          role="status"
          aria-live="polite"
        >
          {OCR_STATE_LABELS[state]}
        </span>
        <span className="ocr-workspace__status-text">
          {currentJob
            ? `${formatOcrBackendLabel(currentJob.backend)} · ${formatOcrStatusLabel(currentJob.status)}${completedPages > 0 ? ` · ${completedPages} 页` : ""}`
            : "未启动 OCR 任务"}
        </span>
        {showProgress ? (
          <div
            className="ocr-workspace__status-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="OCR 进度"
          >
            <div className="ocr-workspace__status-progress-bar" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="ocr-workspace__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
