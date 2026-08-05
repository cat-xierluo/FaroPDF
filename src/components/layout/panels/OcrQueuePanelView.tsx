import type { ReactElement } from "react";
import type { OcrCommandJob } from "../../../shared/ocr/jobQueue";
import { formatOcrStatusLabel } from "../../../shared/ocr/jobQueue";

/**
 * ISS-NEW-C 阶段 2 后续（2026-06-22 收口）：右栏「OCR 队列」面板。
 *
 * 范围：OCR 模式右栏「队列速览」——status dot + job name + status label + cancel 按钮。
 * ISS-QA-11：主区域 OcrWorkspace 已是权威任务列表（带质量报告），本 panel 是
 * right-pane 速览版，标题刻意叫「队列速览」并提示「完整任务与质量报告见主区域」，
 * 避免与主区域任务列表形成两个互相竞争的「任务列表」。
 *
 * 设计要点：
 *   1. 接收 jobs（OcrWorkspaceController.jobs）+ onCancelJob 可选回调
 *   2. jobs 为空时显示「无 OCR 任务」提示
 *   3. status label 走共享 formatOcrStatusLabel（zh-CN 兜底，i18n 后续可切换）
 *   4. cancel 按钮仅在 isActiveOcrStatus 状态时 enabled
 */

export interface OcrQueuePanelViewProps {
  jobs: ReadonlyArray<OcrCommandJob>;
  onCancelJob?: (jobId: string) => void;
}

function isActiveOcrStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

function shortJobName(inputPath: string): string {
  return inputPath.split("/").pop() ?? inputPath;
}

export function OcrQueuePanelView({ jobs, onCancelJob }: OcrQueuePanelViewProps): ReactElement {
  if (jobs.length === 0) {
    return (
      <div data-testid="ocr-queue-empty" className="ocr-queue-empty">
        无 OCR 任务。
      </div>
    );
  }

  return (
    <section className="ocr-queue" aria-label="OCR 任务队列" data-testid="ocr-queue">
      <div className="ocr-queue__head">
        <h3 className="ocr-queue__title">队列速览（{jobs.length}）</h3>
        <p className="ocr-queue__hint">完整任务与质量报告见主区域</p>
      </div>
      <ul className="ocr-queue__list" data-testid="ocr-queue-list">
        {jobs.map((job) => {
          const active = isActiveOcrStatus(job.status);
          return (
            <li className="ocr-queue__item" data-testid="ocr-queue-item" key={job.id}>
              <span
                aria-label={`status-${job.status}`}
                className={`ocr-queue__dot ocr-queue__dot--${job.status}`}
                data-testid="ocr-queue-dot"
              />
              <span className="ocr-queue__name" data-testid="ocr-queue-name">
                {shortJobName(job.inputPath)}
              </span>
              <span className="ocr-queue__status" data-testid="ocr-queue-status">
                {formatOcrStatusLabel(job.status)}
              </span>
              {onCancelJob ? (
                <button
                  className="ocr-queue__cancel"
                  data-testid="ocr-queue-cancel"
                  disabled={!active}
                  onClick={() => onCancelJob(job.id)}
                  type="button"
                >
                  取消
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
