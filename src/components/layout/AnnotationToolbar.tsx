import { useId } from "react";
import {
  ANNOTATION_COLOR_SWATCHES,
  ANNOTATION_TOOL_LIST,
  STAMP_TEMPLATES,
  STAMP_TEMPLATE_LIST,
  armAnnotationTool,
  disarmAnnotationTool,
  renderStampPreview,
  setAnnotationColor,
  setAnnotationStampLabel,
  setAnnotationStampName,
  type AnnotationToolState,
} from "../../modules/annotation";
import type { PdfAnnotationType, PdfStampName } from "../../shared/pdf/annotation";
import "./AnnotationToolbar.css";

interface AnnotationToolbarProps {
  state: AnnotationToolState;
  onStateChange: (nextState: AnnotationToolState) => void;
  disabled?: boolean;
}

/** 批注模式上下文工具条：选择 9 种工具 + 6 色色板 + 图章细分 */
export function AnnotationToolbar({ state, onStateChange, disabled }: AnnotationToolbarProps) {
  const stampLabelId = useId();

  function handleArm(type: PdfAnnotationType) {
    onStateChange(armAnnotationTool(state, type));
  }

  function handleDisarm() {
    onStateChange(disarmAnnotationTool(state));
  }

  function handleColorChange(value: string) {
    onStateChange(setAnnotationColor(state, value));
  }

  function handleStampNameChange(value: PdfStampName) {
    onStateChange(setAnnotationStampName(state, value));
  }

  function handleStampLabelChange(value: string) {
    onStateChange(setAnnotationStampLabel(state, value));
  }

  const activeType = state.activeToolType;
  const isStampActive = activeType === "stamp";
  const stampDescriptor = ANNOTATION_TOOL_LIST.find((tool) => tool.type === "stamp");
  const stampTemplate = STAMP_TEMPLATES[state.stampName];

  return (
    <div
      aria-label="批注工具选项"
      className="annotation-toolbar-options"
      role="group"
    >
      <div aria-label="批注工具" className="annotation-toolbar-tools" role="toolbar">
        {ANNOTATION_TOOL_LIST.map((tool) => {
          const isActive = activeType === tool.type;
          return (
            <button
              aria-pressed={isActive}
              className={
                "annotation-tool-button" + (isActive ? " annotation-tool-button--active" : "")
              }
              disabled={disabled}
              key={tool.type}
              onClick={() => handleArm(tool.type)}
              title={tool.hint}
              type="button"
            >
              {tool.label}
            </button>
          );
        })}
        {activeType !== null ? (
          <button
            className="annotation-tool-button annotation-tool-button--disarm"
            disabled={disabled}
            onClick={handleDisarm}
            type="button"
          >
            取消
          </button>
        ) : null}
      </div>
      <div aria-label="批注颜色" className="annotation-toolbar-swatches" role="group">
        {ANNOTATION_COLOR_SWATCHES.map((swatch) => {
          const isActive = state.color === swatch.value;
          return (
            <button
              aria-label={`颜色 ${swatch.label}`}
              aria-pressed={isActive}
              className={
                "annotation-color-swatch" +
                (isActive ? " annotation-color-swatch--active" : "")
              }
              disabled={disabled}
              key={swatch.id}
              onClick={() => handleColorChange(swatch.value)}
              style={{ backgroundColor: swatch.value }}
              title={swatch.label}
              type="button"
            />
          );
        })}
      </div>
      {isStampActive && stampDescriptor ? (
        <div aria-label="图章选项" className="annotation-toolbar-stamp" role="group">
          <div className="annotation-toolbar-stamp__templates">
            {STAMP_TEMPLATE_LIST.map((template) => {
              const isActive = state.stampName === template.id;
              const previewInner = renderStampPreview(template.id, {
                label: template.label,
                color: template.defaultColor,
              });
              return (
                <button
                  aria-pressed={isActive}
                  className={
                    "annotation-stamp-button" +
                    (isActive ? " annotation-stamp-button--active" : "")
                  }
                  disabled={disabled}
                  key={template.id}
                  onClick={() => handleStampNameChange(template.id)}
                  title={template.label}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="annotation-stamp-button__preview"
                    data-testid={`stamp-preview-${template.id}`}
                    preserveAspectRatio="xMidYMid meet"
                    viewBox={`0 0 400 100`}
                    width="100%"
                    height="32"
                  >
                    <g dangerouslySetInnerHTML={{ __html: previewInner }} />
                  </svg>
                  <span className="annotation-stamp-button__label">{template.label}</span>
                </button>
              );
            })}
          </div>
          <label className="annotation-toolbar-stamp__label" htmlFor={stampLabelId}>
            图章文字
            <input
              disabled={disabled}
              id={stampLabelId}
              maxLength={12}
              onChange={(event) => handleStampLabelChange(event.target.value)}
              placeholder={stampTemplate.label}
              type="text"
              value={state.stampLabel}
            />
          </label>
          <p className="annotation-toolbar-stamp__hint">{stampDescriptor.hint}</p>
        </div>
      ) : null}
    </div>
  );
}
