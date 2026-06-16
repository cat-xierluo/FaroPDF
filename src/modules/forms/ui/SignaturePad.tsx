/**
 * ISS-070 阶段 1：手写签名板 React 组件（纯 Canvas API，无外部库）。
 *
 * 律师签字材料场景：律师在客户文件 / 和解协议 / 授权委托书上签字。
 * 弥补 v0.1 表单签名只支持上传 PNG/JPG 静态图片的缺口。
 *
 * 流程：
 * 1. 用户在 canvas 上鼠标按下 → 开始一条 stroke
 * 2. 拖拽 → 把鼠标轨迹连线绘制（lineCap=round / lineJoin=round / 2px 黑色）
 * 3. 抬起 → stroke 结束，下次按下是新 stroke
 * 4. 按「清空」清除所有 strokes
 * 5. 按「保存」→ 把白底像素 alpha 置 0（粗略阈值 R/G/B > 250）→ toDataURL("image/png") → onSave
 * 6. 按「取消」→ onCancel
 *
 * 后续 ISS-070 阶段 2 接入 FormsPanel + 签名持久化 store + commands.ts 入口。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import "./SignaturePad.css";

export interface SignaturePadProps {
  /** 用户点保存后回调，参数是 `data:image/png;base64,...` data URL */
  onSave: (pngDataUrl: string) => void;
  /** 用户点取消后回调 */
  onCancel: () => void;
  /** Canvas 宽度（CSS px），默认 600 */
  width?: number;
  /** Canvas 高度（CSS px），默认 200 */
  height?: number;
}

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 200;
const STROKE_COLOR = "#000000";
const STROKE_WIDTH = 2;
const WHITE_THRESHOLD = 250; // R/G/B > 250 视为白底，alpha 置 0

export function SignaturePad({
  onSave,
  onCancel,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  // 初始化 canvas 白底（每次 width/height 变化 reset）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [width, height]);

  const getCanvasPoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(event);
      if (!point) return;
      drawingRef.current = true;
      lastPointRef.current = point;
      setStrokeCount((count) => count + 1);
    },
    [getCanvasPoint],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const point = getCanvasPoint(event);
      const last = lastPointRef.current;
      if (!point || !last) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
    },
    [getCanvasPoint],
  );

  const handleMouseUp = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const handleClear = useCallback(() => {
    // 总是 reset strokeCount（即便 jsdom 下 ctx 为 null，状态机也要清零）
    setStrokeCount(0);
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // jsdom 等环境 ctx 为 null，直接 toDataURL 当 fallback
      onSave(canvas.toDataURL("image/png"));
      return;
    }
    // 白底变透明：getImageData → 把 R/G/B 都 > 250 的像素 alpha 设 0 → putImageData
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > WHITE_THRESHOLD && data[i + 1] > WHITE_THRESHOLD && data[i + 2] > WHITE_THRESHOLD) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      // jsdom 等环境 getImageData 可能 throw，跳过透明处理
      void error;
    }
    onSave(canvas.toDataURL("image/png"));
  }, [onSave]);

  return (
    <div className="signature-pad" data-testid="signature-pad">
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        data-testid="signature-pad-canvas"
        data-stroke-count={strokeCount}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="signature-pad__actions" role="group" aria-label="签名操作">
        <button
          className="signature-pad__action signature-pad__action--secondary"
          data-testid="signature-pad-clear"
          onClick={handleClear}
          type="button"
        >
          清空
        </button>
        <button
          className="signature-pad__action signature-pad__action--primary"
          data-testid="signature-pad-save"
          onClick={handleSave}
          type="button"
        >
          保存
        </button>
        <button
          className="signature-pad__action signature-pad__action--secondary"
          data-testid="signature-pad-cancel"
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
      </div>
    </div>
  );
}
