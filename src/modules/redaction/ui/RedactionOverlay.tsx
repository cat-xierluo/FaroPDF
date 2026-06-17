import { useState, type ReactElement } from "react";
import type { RedactionRegion } from "../redactionEngine";
import "./RedactionOverlay.css";

export type RedactionRegionDraft = RedactionRegion;

export interface RedactionOverlayProps {
  /** 是否激活；非激活时不渲染任何内容 */
  active: boolean;
  /** 当前覆盖层视口（与 canvas 同尺寸） */
  viewport: { width: number; height: number };
  /** 当前 PDF 页索引（0-based），用于给 region 标记 pageIndex */
  pageIndex?: number;
  /** 应用遮蔽回调 */
  onApply: (regions: RedactionRegionDraft[]) => void;
  /** 取消回调 */
  onCancel: () => void;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MIN_DRAG_SIZE = 5; // px

/** 颜色选择器：黑（默认）/ 白 / 灰。律师场景：白色覆盖用于"擦除"，灰色用于"模糊"。 */
const COLOR_OPTIONS: ReadonlyArray<{ label: string; value: string; preview: string }> = [
  { label: "黑", value: "#000000", preview: "#000000" },
  { label: "白", value: "#ffffff", preview: "#ffffff" },
  { label: "灰", value: "#808080", preview: "#808080" },
];

function rectFromDrag(drag: DragState): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const x = Math.min(drag.startX, drag.currentX);
  const y = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);
  return { x, y, width, height };
}

export function RedactionOverlay(props: RedactionOverlayProps): ReactElement | null {
  const { active, pageIndex = 0, onApply, onCancel } = props;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [regions, setRegions] = useState<RedactionRegionDraft[]>([]);
  // ISS-067 阶段 2 后续：选中的填充颜色，仅作用于后续新增的 region（已 commit 的不变）。
  const [nextColor, setNextColor] = useState<string>("#000000");

  if (!active) {
    return null;
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    setDrag({
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!drag) {
      return;
    }
    setDrag({ ...drag, currentX: event.clientX, currentY: event.clientY });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!drag) {
      return;
    }
    const finalDrag = { ...drag, currentX: event.clientX, currentY: event.clientY };
    const rect = rectFromDrag(finalDrag);
    if (rect.width >= MIN_DRAG_SIZE && rect.height >= MIN_DRAG_SIZE) {
      const newRegion: RedactionRegionDraft = {
        pageIndex,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: nextColor,
      };
      setRegions([...regions, newRegion]);
    }
    setDrag(null);
  };

  // ISS-067 阶段 2 后续：移除单个已 commit region
  const handleRemoveRegion = (idx: number): void => {
    setRegions(regions.filter((_, i) => i !== idx));
  };

  // ISS-067 阶段 2 后续：撤销最后一个 region（比逐个删快）
  const handleUndoLast = (): void => {
    if (regions.length === 0) {
      return;
    }
    setRegions(regions.slice(0, -1));
  };

  const handleApply = (): void => {
    onApply(regions);
  };

  const handleCancel = (): void => {
    setRegions([]);
    setDrag(null);
    onCancel();
  };

  const draftRect = drag ? rectFromDrag(drag) : null;

  return (
    <div
      className="redaction-overlay"
      data-testid="redaction-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
      }}
    >
      <div className="redaction-overlay__panel">
        <h3 className="redaction-overlay__title">涂黑矩形</h3>
        <p className="redaction-overlay__hint">
          在下方页面拖动鼠标画出遮蔽矩形；点击「应用遮蔽」调用 pdf-lib 写入不透明矩形覆盖原文。
        </p>
        <div className="redaction-overlay__color-row" role="radiogroup" aria-label="填充颜色">
          <span className="redaction-overlay__color-label">颜色：</span>
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={nextColor === opt.value}
              aria-label={`填充颜色 ${opt.label}`}
              data-testid={`redaction-color-${opt.value}`}
              onClick={() => setNextColor(opt.value)}
              className={`redaction-overlay__color-chip${nextColor === opt.value ? " redaction-overlay__color-chip--active" : ""}`}
              style={{ background: opt.preview }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="redaction-overlay__count">已选 {regions.length} 个矩形</p>
        <div className="redaction-overlay__actions">
          <button
            type="button"
            onClick={handleApply}
            disabled={regions.length === 0}
            className="compact-button"
          >
            应用遮蔽
          </button>
          <button
            type="button"
            onClick={handleUndoLast}
            disabled={regions.length === 0}
            className="compact-button compact-button--ghost"
            data-testid="redaction-undo-last"
            aria-label="撤销最后一个矩形"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="compact-button compact-button--ghost"
          >
            取消
          </button>
        </div>
      </div>
      {regions.map((region, idx) => (
        <div
          key={idx}
          className="redaction-overlay__region"
          data-region-index={idx}
          style={{
            position: "absolute",
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
            background: region.color
              ? `rgba(${parseInt(region.color.slice(1, 3), 16)}, ${parseInt(region.color.slice(3, 5), 16)}, ${parseInt(region.color.slice(5, 7), 16)}, 0.35)`
              : "rgba(255, 0, 0, 0.35)",
            border: `2px solid ${region.color ?? "#ff0000"}`,
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            className="redaction-overlay__region-delete"
            data-testid={`redaction-remove-${idx}`}
            aria-label={`删除第 ${idx + 1} 个矩形`}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveRegion(idx);
            }}
          >
            ×
          </button>
        </div>
      ))}
      {draftRect ? (
        <div
          className="redaction-overlay__draft"
          style={{
            position: "absolute",
            left: draftRect.x,
            top: draftRect.y,
            width: draftRect.width,
            height: draftRect.height,
            border: `2px dashed ${nextColor}`,
            background: nextColor === "#000000"
              ? "rgba(255, 0, 0, 0.1)"
              : nextColor === "#ffffff"
                ? "rgba(200, 200, 200, 0.2)"
                : "rgba(128, 128, 128, 0.15)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
