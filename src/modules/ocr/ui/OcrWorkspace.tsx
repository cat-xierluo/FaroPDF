import { useEffect, useMemo, useRef } from "react";
import { isActiveOcrStatus, type OcrCommandJob } from "../../../shared/ocr/jobQueue";
import {
  OcrJobList,
  OcrQualityReportView,
  type OcrJobListProps,
  type OcrQualityReportViewProps,
} from "./OcrModeToolbar";
import type { OcrWorkspaceController } from "./useOcrWorkspaceController";
import "./ocrModeToolbar.css";
import "./ocrWorkspace.css";

/**
 * OCR 工作区：左侧任务列表（OcrJobList）+ 右侧选中任务的质量报告（OcrQualityReportView）。
 *
 * 与 OcrModeToolbar（context toolbar 上的动作条）配合，组成 OCR 模式的两块主 UI：
 * - 上方工具条负责"启动 / 取消 / 切到双层 PDF 模式 / 打开报告"。
 * - 本组件负责"展示任务队列与选中任务的报告"。
 *
 * 选择 / 取消等动作通过 OcrWorkspaceController 回调；controller 内部统一维护
 * jobs / selectedJobId / busy 状态并轮询。
 */

export interface OcrWorkspaceProps {
  controller: OcrWorkspaceController;
}

export function OcrWorkspace({ controller }: OcrWorkspaceProps) {
  const jobListRef = useRef<HTMLDivElement | null>(null);
  const {
    cancelJob,
    currentJob,
    errorMessage,
    jobs,
    openQualityReport,
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
      <section className="ocr-workspace__jobs" aria-label="OCR 任务">
        <header className="ocr-workspace__section-header">
          <h2>OCR 任务</h2>
          <p className="ocr-workspace__hint">
            {jobs.length === 0
              ? "尚未启动任何 OCR 任务。"
              : `共 ${jobs.length} 个任务 · ${jobs.filter((job) => isActiveOcrStatus(job.status)).length} 个进行中`}
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
        {errorMessage ? (
          <p className="ocr-workspace__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
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
