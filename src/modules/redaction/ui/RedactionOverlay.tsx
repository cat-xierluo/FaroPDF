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
  const { active, viewport, pageIndex = 0, onApply, onCancel } = props;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [regions, setRegions] = useState<RedactionRegionDraft[]>([]);

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
      // 透传屏幕坐标；PDF 用户空间 Y 翻转（PDF 原点左下 vs 屏幕原点左上）
      // 由 AppShell 在调用 applyRedaction 前根据 canvas getBoundingClientRect 完成。
      const newRegion: RedactionRegionDraft = {
        pageIndex,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      setRegions([...regions, newRegion]);
    }
    setDrag(null);
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
        position: "absolute",
        left: 0,
        top: 0,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <div className="redaction-overlay__panel">
        <h3 className="redaction-overlay__title">涂黑矩形</h3>
        <p className="redaction-overlay__hint">
          在下方页面拖动鼠标画出遮蔽矩形；点击「应用遮蔽」调用 pdf-lib 写入不透明矩形覆盖原文。
        </p>
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
            background: "rgba(255, 0, 0, 0.35)",
            border: "2px solid #ff0000",
            pointerEvents: "none",
          }}
        />
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
            border: "2px dashed #ff0000",
            background: "rgba(255, 0, 0, 0.1)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
