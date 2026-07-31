import type { OcrCommandJob, OcrStoredQualitySummary } from "../../../shared/ocr/jobQueue";
import {
  formatOcrBackendLabel,
  formatOcrStatusLabel,
  isActiveOcrStatus,
} from "../../../shared/ocr/jobQueue";
import "./ocrModeToolbar.css";

/**
 * OCR 模式工具条组件。
 *
 * 当前任务约束：`src/App.tsx`、全局样式、路由不可改。本组件作为
 * 可独立挂载的工具条交付，供后续 layout worker 在 context toolbar
 * 槽位接入。组件实现"识别文本"、"输出双层 PDF"、
 * "质量检查"三组核心动作，外加"任务列表"按钮供 UI 切换。
 *
 * Props 由调用方提供，不直接依赖 settings / 文件输入；OCR 模式工具
 * 条只负责"展示 + 触发事件"。
 */

export interface OcrModeToolbarProps {
  currentJob?: OcrCommandJob;
  hasDocument: boolean;
  hasProvider: boolean;
  busy: boolean;
  onStartOcr: () => void;
  onOutputLayeredPdf: () => void;
  onOpenQualityReport: (job: OcrCommandJob) => void;
  onOpenJobList: () => void;
  onCancelJob: (job: OcrCommandJob) => void;
}

export function OcrModeToolbar({
  currentJob,
  hasDocument,
  hasProvider,
  busy,
  onStartOcr,
  onOutputLayeredPdf,
  onOpenQualityReport,
  onOpenJobList,
  onCancelJob,
}: OcrModeToolbarProps) {
  const status = currentJob?.status;
  const isActive = status ? isActiveOcrStatus(status) : false;
  const isCompleted = status === "completed";
  const hasQuality = isCompleted && Boolean(currentJob?.quality);

  return (
    <div className="context-toolbar ocr-mode-toolbar" role="toolbar" aria-label="OCR 工具条">
      <div className="context-tool-group" role="group" aria-label="OCR 任务">
        <button
          type="button"
          className="context-tool context-tool--primary"
          disabled={!hasDocument || !hasProvider || busy || isActive}
          onClick={onStartOcr}
        >
          {isActive ? "识别中…" : "识别文本"}
        </button>
        <button
          type="button"
          className="context-tool"
          disabled={!hasDocument || !hasProvider || busy || (!isActive && !isCompleted)}
          onClick={onOutputLayeredPdf}
          title="把当前 OCR 结果保存为新的双层 PDF；默认输出 *-ocr.pdf。"
        >
          输出双层 PDF
        </button>
        <button
          type="button"
          className="context-tool"
          disabled={!hasQuality}
          onClick={() => currentJob && onOpenQualityReport(currentJob)}
          title="基于 OCR 后页面文本生成可检索页比例、关键词命中和文件体积比报告。"
        >
          质量检查
        </button>
      </div>

      <div className="context-tool-group" role="group" aria-label="OCR 任务状态">
        {currentJob ? (
          <>
            <span className="ocr-mode-toolbar__status" aria-live="polite">
              {formatOcrBackendLabel(currentJob.backend)} · {formatOcrStatusLabel(currentJob.status)}
              {currentJob.progress.completedPages > 0
                ? ` · ${currentJob.progress.completedPages} 页`
                : ""}
            </span>
            {isActive ? (
              <button
                type="button"
                className="context-tool context-tool--danger"
                onClick={() => onCancelJob(currentJob)}
              >
                取消
              </button>
            ) : null}
          </>
        ) : (
          <span className="ocr-mode-toolbar__status ocr-mode-toolbar__status--idle" aria-live="polite">
            未启动 OCR 任务
          </span>
        )}
        <button
          type="button"
          className="context-tool"
          onClick={onOpenJobList}
          title="查看历史 OCR 任务与质量报告。"
        >
          任务列表
        </button>
      </div>
    </div>
  );
}

export interface OcrJobListProps {
  jobs: ReadonlyArray<OcrCommandJob>;
  onSelect: (job: OcrCommandJob) => void;
  onOpenQualityReport: (job: OcrCommandJob) => void;
  onCancel: (job: OcrCommandJob) => void;
  selectedJobId?: string;
}

export function OcrJobList({
  jobs,
  onSelect,
  onOpenQualityReport,
  onCancel,
  selectedJobId,
}: OcrJobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="ocr-job-list ocr-job-list--empty" role="status">
        暂无 OCR 任务，启动识别后将在此显示。
      </div>
    );
  }

  return (
    <ol className="ocr-job-list" role="list" aria-label="OCR 任务列表">
      {jobs.map((job) => {
        const quality: OcrStoredQualitySummary | undefined = job.quality;
        const isActive = isActiveOcrStatus(job.status);
        const isSelected = job.id === selectedJobId;
        return (
          <li
            key={job.id}
            className={
              "ocr-job-list__item" +
              (isSelected ? " ocr-job-list__item--selected" : "") +
              (isActive ? " ocr-job-list__item--active" : "")
            }
          >
            <button
              type="button"
              className="ocr-job-list__summary"
              onClick={() => onSelect(job)}
              aria-current={isSelected ? "true" : undefined}
            >
              <span className="ocr-job-list__title">
                {formatOcrBackendLabel(job.backend)} · {formatOcrStatusLabel(job.status)}
              </span>
              <span className="ocr-job-list__sub">
                {job.inputPathSummary.redacted} → {job.outputPathSummary.redacted}
              </span>
              {job.progress.message ? (
                <span className="ocr-job-list__message">{job.progress.message}</span>
              ) : null}
            </button>
            <div className="ocr-job-list__actions" role="group" aria-label="任务操作">
              {quality ? (
                <button
                  type="button"
                  className="context-tool"
                  onClick={() => onOpenQualityReport(job)}
                >
                  质量报告
                </button>
              ) : null}
              {isActive ? (
                <button
                  type="button"
                  className="context-tool context-tool--danger"
                  onClick={() => onCancel(job)}
                >
                  取消
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface OcrQualityReportViewProps {
  job: OcrCommandJob;
}

export function OcrQualityReportView({ job }: OcrQualityReportViewProps) {
  const quality = job.quality;
  if (!quality) {
    return (
      <div className="ocr-quality-report ocr-quality-report--missing" role="status">
        <p>
          任务 <strong>{job.id}</strong> 尚未生成质量报告。
        </p>
        <p>
          可在 OCR 任务完成且开启了"质量检查"后重新打开本视图，或在设置中调整关键词。
        </p>
      </div>
    );
  }

  const ratioText =
    typeof quality.fileSizeRatio === "number"
      ? `体积比 ${quality.fileSizeRatio.toFixed(2)}`
      : "体积比 —";
  const elapsedText =
    typeof quality.elapsedMs === "number" ? `${(quality.elapsedMs / 1000).toFixed(1)} 秒` : "—";

  return (
    <div className="ocr-quality-report" role="region" aria-label="OCR 质量报告">
      <header className="ocr-quality-report__header">
        <h3>OCR 质量报告</h3>
        <p>
          {formatOcrBackendLabel(job.backend)} · {formatOcrStatusLabel(job.status)} · 任务{" "}
          <code>{job.id}</code>
        </p>
      </header>
      <dl className="ocr-quality-report__metrics">
        <div>
          <dt>可检索页</dt>
          <dd>
            {quality.textPages} / {quality.textPages + quality.emptyTextPages}
          </dd>
        </div>
        <div>
          <dt>关键词命中</dt>
          <dd>
            {quality.matchedKeywords.length} / {quality.searchedKeywords.length || 0}
          </dd>
        </div>
        <div>
          <dt>{ratioText}</dt>
          <dd>{elapsedText}</dd>
        </div>
      </dl>
      {quality.matchedKeywords.length > 0 ? (
        <section className="ocr-quality-report__section">
          <h4>命中关键词</h4>
          <ul>
            {quality.matchedKeywords.map((keyword) => (
              <li key={keyword}>{keyword}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {quality.searchedKeywords.length > quality.matchedKeywords.length ? (
        <section className="ocr-quality-report__section">
          <h4>未命中关键词</h4>
          <ul>
            {quality.searchedKeywords
              .filter((keyword) => !quality.matchedKeywords.includes(keyword))
              .map((keyword) => (
                <li key={keyword}>{keyword}</li>
              ))}
          </ul>
        </section>
      ) : null}
      {job.errorMessage ? (
        <section className="ocr-quality-report__section ocr-quality-report__section--warning">
          <h4>错误信息</h4>
          <p>{job.errorMessage}</p>
        </section>
      ) : null}
    </div>
  );
}
