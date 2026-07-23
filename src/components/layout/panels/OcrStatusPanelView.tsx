import { useId, useState, type ReactElement } from "react";

/** 右栏「OCR 状态」历史 skeleton；R10 只能证明 OCR 对话框，不能证明本面板层级。
 *  - state: idle / running / completed / failed
 *  - message: 状态文字（自由文案）
 *  - progress: 0..1（仅在 running / completed 显式渲染）
 *  - error: 仅 failed 显示
 *
 *  本视图不发起真实 OCR 调用；onStart 由调用方实现，当前为 placeholder。
 *  目标状态与真实 controller 接线分别等待 M1 与 M5。 */
export type OcrJobStatusState = "idle" | "running" | "completed" | "failed";

export interface OcrJobStatus {
  state: OcrJobStatusState;
  message: string;
  progress: number;
  error?: string;
}

export interface OcrStartOptions {
  pageRange?: string;
}

export interface OcrStatusPanelViewProps {
  status: OcrJobStatus;
  onStart: (options: OcrStartOptions) => void;
}

export function OcrStatusPanelView({ status, onStart }: OcrStatusPanelViewProps): ReactElement {
  const rangeId = useId();
  const [pageRange, setPageRange] = useState<string>("");

  const isActionable = status.state === "idle";
  const isInFlight = status.state === "running";

  return (
    <section className="ocr-status" aria-label="OCR 状态" data-state={status.state}>
      <div className="ocr-status__head">
        <span
          className={"ocr-status__pill ocr-status__pill--" + status.state}
          role="status"
          aria-live="polite"
        >
          {status.state === "idle"
            ? "待处理"
            : status.state === "running"
              ? "进行中"
              : status.state === "completed"
                ? "已完成"
                : "失败"}
        </span>
        <p className="ocr-status__message">{status.message}</p>
        {status.state === "failed" && status.error ? (
          <p className="ocr-status__error">{status.error}</p>
        ) : null}
      </div>
      {(status.state === "running" || status.state === "completed") ? (
        <div className="ocr-status__progress" aria-label="OCR 进度">
          <div
            className="ocr-status__progress-bar"
            style={{ width: `${Math.round(Math.max(0, Math.min(1, status.progress)) * 100)}%` }}
          />
        </div>
      ) : null}
      {isActionable || isInFlight ? (
        <div className="ocr-status__form">
          <label htmlFor={rangeId} className="ocr-status__range-label">
            页码范围（可选，留空 = 全部）
          </label>
          <input
            className="ocr-status__range-input"
            disabled={isInFlight}
            id={rangeId}
            onChange={(e) => setPageRange(e.target.value)}
            placeholder="如 1-5, 12, 18-20"
            type="text"
            value={pageRange}
          />
          <button
            className="ocr-status__start"
            disabled={isInFlight}
            onClick={() => onStart({ pageRange: pageRange.trim() === "" ? undefined : pageRange })}
            type="button"
          >
            开始 OCR
          </button>
        </div>
      ) : null}
    </section>
  );
}
