import { useCallback, useMemo, type ReactElement } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  Circle,
  Minus as MinusIcon,
  PencilLine,
  Square,
} from "lucide-react";
import "./ShapeToolPanel.css";

/** ISS-NEW-I（W2 worker）：形状工具右栏 6 段。
 *
 * 设计参照：research/pdf-expert/FEATURE_CATALOG.md §3 + 截图 59。
 *
 * 段 1 形状选择 2×3 网格：矩形 / 椭圆 / 箭头 / 双向箭头 / 直线 / 铅笔
 * 段 2 线条工具：实线 / 虚线 二选一
 * 段 3 线条宽度：1-12 px 滑块
 * 段 4 不透明度：10-100 % 滑块
 * 段 5 边框色：7 色块（黑/红/橙/黄/绿/蓝/紫）
 * 段 6 填充色：7 色块 + 透明
 *
 * 真实绘制引擎（shape 拖到页面画布 → 写入 PDF annotation）由后续 worker 接入；
 * 本任务只做 UI 结构 + 受控 state + 占位 `onChange` 回调。
 */

export type ShapeKind = "rectangle" | "ellipse" | "arrow" | "double-arrow" | "line" | "pencil";
export type StrokeStyle = "solid" | "dashed";

export interface ShapeToolValue {
  shape: ShapeKind;
  strokeStyle: StrokeStyle;
  strokeWidth: number;
  opacity: number;
  strokeColor: string;
  fillColor: string;
}

export interface ShapeToolPanelProps {
  value?: ShapeToolValue;
  onChange?: (next: ShapeToolValue) => void;
}

const DEFAULT_VALUE: ShapeToolValue = {
  shape: "rectangle",
  strokeStyle: "solid",
  strokeWidth: 2,
  opacity: 100,
  strokeColor: "#000000",
  fillColor: "transparent",
};

const SHAPE_OPTIONS: ReadonlyArray<{ id: ShapeKind; label: string; icon: typeof Square }> = [
  { id: "rectangle", label: "矩形", icon: Square },
  { id: "ellipse", label: "椭圆", icon: Circle },
  { id: "arrow", label: "箭头", icon: ArrowRight },
  { id: "double-arrow", label: "双向箭头", icon: ArrowLeftRight },
  { id: "line", label: "直线", icon: MinusIcon },
  { id: "pencil", label: "铅笔", icon: PencilLine },
];

const STROKE_COLORS: ReadonlyArray<{ id: string; value: string; label: string }> = [
  { id: "black", value: "#000000", label: "黑" },
  { id: "red", value: "#d04444", label: "红" },
  { id: "orange", value: "#e89234", label: "橙" },
  { id: "yellow", value: "#f0c33c", label: "黄" },
  { id: "green", value: "#3aa55a", label: "绿" },
  { id: "blue", value: "#2a8df0", label: "蓝" },
  { id: "purple", value: "#8a4dba", label: "紫" },
];

const FILL_COLORS: ReadonlyArray<{ id: string; value: string; label: string }> = [
  { id: "transparent", value: "transparent", label: "透明" },
  { id: "black-fill", value: "#000000", label: "黑" },
  { id: "red-fill", value: "#d04444", label: "红" },
  { id: "orange-fill", value: "#e89234", label: "橙" },
  { id: "yellow-fill", value: "#f0c33c", label: "黄" },
  { id: "green-fill", value: "#3aa55a", label: "绿" },
  { id: "blue-fill", value: "#2a8df0", label: "蓝" },
];

export function ShapeToolPanel({ value, onChange }: ShapeToolPanelProps = {}): ReactElement {
  const current = useMemo<ShapeToolValue>(() => ({ ...DEFAULT_VALUE, ...(value ?? {}) }), [value]);

  const update = useCallback(
    (patch: Partial<ShapeToolValue>) => {
      onChange?.({ ...current, ...patch });
    },
    [current, onChange],
  );

  return (
    <section className="shape-panel" data-testid="shape-tool-panel" aria-label="形状工具">
      {/* 段 1：形状选择 2×3 网格（截图 59 第 1 段） */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">形状</span>
        <div className="shape-panel__grid" role="radiogroup" aria-label="形状选择">
          {SHAPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = current.shape === option.id;
            return (
              <button
                aria-checked={active}
                aria-label={option.label}
                className={
                  "shape-panel__shape" +
                  (active ? " shape-panel__shape--active" : "")
                }
                data-shape={option.id}
                data-testid={`shape-option-${option.id}`}
                key={option.id}
                onClick={() => update({ shape: option.id })}
                role="radio"
                type="button"
              >
                <Icon size={18} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 段 2：线条工具（实线/虚线 二选一） */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">线条</span>
        <div className="shape-panel__stroke-toggle" role="radiogroup" aria-label="线条样式">
          {(["solid", "dashed"] as const).map((style) => {
            const active = current.strokeStyle === style;
            return (
              <button
                aria-checked={active}
                aria-label={style === "solid" ? "实线" : "虚线"}
                className={
                  "shape-panel__stroke-option" +
                  (active ? " shape-panel__stroke-option--active" : "")
                }
                data-stroke-style={style}
                data-testid={`shape-stroke-${style}`}
                key={style}
                onClick={() => update({ strokeStyle: style })}
                role="radio"
                type="button"
              >
                <span className={`shape-panel__stroke-line shape-panel__stroke-line--${style}`} aria-hidden="true" />
                <span>{style === "solid" ? "实线" : "虚线"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 段 3：线条宽度 */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">线条宽度</span>
        <div className="shape-panel__slider-row">
          <label className="shape-panel__slider-label" htmlFor="shape-stroke-width">
            <span>1 — 12 px</span>
            <span data-testid="shape-stroke-width-value">{current.strokeWidth} px</span>
          </label>
          <input
            aria-label="线条宽度"
            className="shape-panel__slider"
            data-testid="shape-stroke-width"
            id="shape-stroke-width"
            max={12}
            min={1}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(next)) update({ strokeWidth: next });
            }}
            type="range"
            value={current.strokeWidth}
          />
        </div>
      </div>

      {/* 段 4：不透明度 */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">不透明度</span>
        <div className="shape-panel__slider-row">
          <label className="shape-panel__slider-label" htmlFor="shape-opacity">
            <span>10 — 100 %</span>
            <span data-testid="shape-opacity-value">{current.opacity} %</span>
          </label>
          <input
            aria-label="不透明度"
            className="shape-panel__slider"
            data-testid="shape-opacity"
            id="shape-opacity"
            max={100}
            min={10}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(next)) update({ opacity: next });
            }}
            type="range"
            value={current.opacity}
          />
        </div>
      </div>

      {/* 段 5：边框色（7 色块） */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">边框色</span>
        <div className="shape-panel__swatches" role="radiogroup" aria-label="边框色">
          {STROKE_COLORS.map((color) => {
            const active = current.strokeColor === color.value;
            return (
              <button
                aria-checked={active}
                aria-label={`边框色 ${color.id}`}
                className={
                  "shape-panel__swatch" +
                  (active ? " shape-panel__swatch--active" : "")
                }
                data-stroke-color={color.id}
                data-testid={`shape-stroke-color-${color.id}`}
                key={color.id}
                onClick={() => update({ strokeColor: color.value })}
                role="radio"
                type="button"
              >
                <span
                  className="shape-panel__swatch-fill"
                  style={{ backgroundColor: color.value }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 段 6：填充色（7 色块 + 透明） */}
      <div className="shape-panel__section">
        <span className="shape-panel__heading">填充色</span>
        <div className="shape-panel__swatches" role="radiogroup" aria-label="填充色">
          {FILL_COLORS.map((color) => {
            const active = current.fillColor === color.value;
            return (
              <button
                aria-checked={active}
                aria-label={`填充色 ${color.label ?? color.id}`}
                className={
                  "shape-panel__swatch" +
                  (active ? " shape-panel__swatch--active" : "")
                }
                data-fill-color={color.id}
                data-testid={`shape-fill-color-${color.id}`}
                key={color.id}
                onClick={() => update({ fillColor: color.value })}
                role="radio"
                type="button"
              >
                <span
                  className={
                    "shape-panel__swatch-fill" +
                    (color.value === "transparent" ? " shape-panel__swatch-fill--transparent" : "")
                  }
                  style={{ backgroundColor: color.value === "transparent" ? "transparent" : color.value }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}