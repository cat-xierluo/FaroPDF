/**
 * forms mode 浮层面板
 *
 * 渲染在 activeMode === "forms" 时挂在 reader canvas 右侧的浮层。提供：
 * - 头部：标题、关闭按钮、错误/成功提示条
 * - 字段列表：按 type 分组（text / checkbox / radio / dropdown / button）展示 id / name / page / 必填
 * - 填值面板：选中字段后输入 draftValue + 应用按钮
 * - 签名面板：选中字段后选择 PNG / JPG 图片 + 应用按钮
 *
 * 样式遵循 docs/DESIGN.md 视觉系统（暖白 / 低噪音 / 单一强调色）。
 * 不修改全局 app.css——所有新样式都通过本组件的内联类名（class 形式）复用既有 .tool-button / .context-tool。
 */

import { useId, useRef, type ChangeEvent, type ReactNode } from "react";
import type { PdfFormField } from "../../../shared/pdf/form";
import type { FormController } from "../useFormController";
import "./FormsPanel.css";

interface FormsPanelProps {
  controller: FormController;
}

const FIELD_TYPE_LABELS: Record<PdfFormField["type"], string> = {
  text: "文本",
  checkbox: "复选框",
  radio: "单选",
  dropdown: "下拉",
  button: "按钮",
};

export function FormsPanel({ controller }: FormsPanelProps) {
  const {
    formState,
    loading,
    errorMessage,
    successMessage,
    panelMode,
    selectedFieldId,
    draftValue,
    signatureImageBytes,
    signatureImageType,
    refreshFormState,
    closePanel,
    selectField,
    setDraftValue,
    setSignatureImage,
    clearSignatureImage,
    applyFieldEdit,
    applySignature,
    flattenAndSave,
    setErrorMessage,
    clearMessages,
  } = controller;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftValueId = useId();

  const fields = formState?.fields ?? [];
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;

  function handleSignatureFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const detectedType: "png" | "jpg" | null = file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : null;
    if (!detectedType) {
      setErrorMessage("签名图片必须是 PNG 或 JPG 格式。");
      event.target.value = "";
      return;
    }
    file.arrayBuffer().then((buffer) => {
      setSignatureImage(new Uint8Array(buffer), detectedType);
    });
    event.target.value = "";
  }

  return (
    <aside className="forms-panel" aria-label="填写和签名面板" data-testid="forms-panel">
      <header className="forms-panel__header">
        <div>
          <h2>填写和签名</h2>
          <p>
            {formState
              ? `共 ${formState.fieldCount} 个字段${formState.fillable ? "（可填写）" : "（无填写项）"}`
              : "尚未读取表单字段"}
          </p>
        </div>
        <button
          aria-label="关闭填写和签名面板"
          className="compact-button"
          onClick={closePanel}
          type="button"
        >
          ×
        </button>
      </header>

      {errorMessage ? (
        <div className="forms-panel__error" role="alert">
          <span>{errorMessage}</span>
          <button className="compact-button" onClick={clearMessages} type="button">
            知道了
          </button>
        </div>
      ) : null}
      {successMessage ? (
        <div className="forms-panel__success" role="status">
          <span>{successMessage}</span>
          <button className="compact-button" onClick={clearMessages} type="button">
            知道了
          </button>
        </div>
      ) : null}

      <div className="forms-panel__actions">
        <button
          className="context-tool context-tool--primary"
          disabled={loading}
          onClick={() => void refreshFormState()}
          type="button"
        >
          {loading ? "处理中..." : formState ? "刷新字段" : "读取表单字段"}
        </button>
        <button
          className="context-tool"
          disabled={loading || !formState || formState.fieldCount === 0}
          onClick={() => void flattenAndSave()}
          type="button"
        >
          扁平化导出
        </button>
      </div>

      {fields.length > 0 ? (
        <FormFieldList
          fields={fields}
          selectedFieldId={selectedFieldId}
          onSelect={selectField}
        />
      ) : (
        <p className="forms-panel__empty">读取表单后，字段会按类型分组显示在这里。</p>
      )}

      {panelMode === "fill" && selectedField ? (
        <FillEditor
          draftValueId={draftValueId}
          field={selectedField}
          loading={loading}
          draftValue={draftValue}
          onDraftValueChange={setDraftValue}
          onApply={() => void applyFieldEdit()}
        />
      ) : null}

      {panelMode === "sign" && selectedField ? (
        <SignatureEditor
          fileInputRef={fileInputRef}
          field={selectedField}
          loading={loading}
          signatureImageBytes={signatureImageBytes}
          signatureImageType={signatureImageType}
          onPickFile={() => fileInputRef.current?.click()}
          onFileChange={handleSignatureFileChange}
          onClear={clearSignatureImage}
          onApply={() => void applySignature()}
        />
      ) : null}
    </aside>
  );
}

interface FormFieldListProps {
  fields: PdfFormField[];
  selectedFieldId: string | null;
  onSelect: (fieldId: string) => void;
}

function FormFieldList({ fields, selectedFieldId, onSelect }: FormFieldListProps): ReactNode {
  const grouped = groupFieldsByType(fields);

  return (
    <ol className="forms-panel__list" aria-label="表单字段列表">
      {(["text", "checkbox", "radio", "dropdown", "button"] as const).map((type) => {
        const group = grouped[type];
        if (group.length === 0) return null;
        return (
          <li className="forms-panel__group" key={type}>
            <h3>{FIELD_TYPE_LABELS[type]}（{group.length}）</h3>
            <ul>
              {group.map((field) => {
                const isSelected = field.id === selectedFieldId;
                return (
                  <li key={field.id}>
                    <button
                      aria-pressed={isSelected}
                      className={`forms-panel__field${isSelected ? " is-selected" : ""}`}
                      onClick={() => onSelect(field.id)}
                      type="button"
                    >
                      <span className="forms-panel__field-name">{field.name || field.id}</span>
                      <span className="forms-panel__field-meta">
                        第 {field.pageIndex + 1} 页
                        {field.required ? " · 必填" : ""}
                        {field.readOnly ? " · 只读" : ""}
                      </span>
                      {field.value ? (
                        <span className="forms-panel__field-value" title={field.value}>
                          {truncate(field.value, 28)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function groupFieldsByType(fields: PdfFormField[]): Record<PdfFormField["type"], PdfFormField[]> {
  const grouped: Record<PdfFormField["type"], PdfFormField[]> = {
    text: [],
    checkbox: [],
    radio: [],
    dropdown: [],
    button: [],
  };
  for (const field of fields) {
    grouped[field.type].push(field);
  }
  return grouped;
}

interface FillEditorProps {
  draftValueId: string;
  field: PdfFormField;
  loading: boolean;
  draftValue: string;
  onDraftValueChange: (value: string) => void;
  onApply: () => void;
}

function FillEditor({
  draftValueId,
  field,
  loading,
  draftValue,
  onDraftValueChange,
  onApply,
}: FillEditorProps): ReactNode {
  const isText = field.type === "text";
  const isDropdown = field.type === "dropdown";
  const isCheckbox = field.type === "checkbox";
  const isRadio = field.type === "radio";

  return (
    <section className="forms-panel__editor" aria-label="填值编辑器">
      <h3>填值：{field.name || field.id}</h3>
      {isText ? (
        <label className="forms-panel__input-row" htmlFor={draftValueId}>
          <span>文本</span>
          <input
            id={draftValueId}
            onChange={(event) => onDraftValueChange(event.target.value)}
            type="text"
            value={draftValue}
          />
        </label>
      ) : null}
      {isDropdown ? (
        <label className="forms-panel__input-row" htmlFor={draftValueId}>
          <span>选项</span>
          <select
            id={draftValueId}
            onChange={(event) => onDraftValueChange(event.target.value)}
            value={draftValue}
          >
            {(field.choices.length > 0 ? field.choices : [draftValue]).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isCheckbox ? (
        <label className="forms-panel__input-row">
          <span>勾选</span>
          <input
            checked={draftValue === "true"}
            onChange={(event) => onDraftValueChange(event.target.checked ? "true" : "false")}
            type="checkbox"
          />
        </label>
      ) : null}
      {isRadio ? (
        <fieldset className="forms-panel__input-row">
          <legend>选项</legend>
          {field.choices.map((choice) => (
            <label key={choice}>
              <input
                checked={draftValue === choice}
                name={field.id}
                onChange={() => onDraftValueChange(choice)}
                type="radio"
                value={choice}
              />
              {choice}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button
        className="context-tool context-tool--primary"
        disabled={loading || field.readOnly}
        onClick={onApply}
        type="button"
      >
        {loading ? "处理中..." : "应用到字段并导出"}
      </button>
      {field.readOnly ? <p className="forms-panel__hint">此字段为只读，无法程序化填写。</p> : null}
    </section>
  );
}

interface SignatureEditorProps {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  field: PdfFormField;
  loading: boolean;
  signatureImageBytes: Uint8Array | null;
  signatureImageType: "png" | "jpg" | null;
  onPickFile: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onApply: () => void;
}

function SignatureEditor({
  fileInputRef,
  field,
  loading,
  signatureImageBytes,
  signatureImageType,
  onPickFile,
  onFileChange,
  onClear,
  onApply,
}: SignatureEditorProps): ReactNode {
  return (
    <section className="forms-panel__editor" aria-label="签名编辑器">
      <h3>签名：{field.name || field.id}</h3>
      <p className="forms-panel__hint">选择 PNG 或 JPG 图片作为签名，将嵌入到字段所在位置。</p>
      <input
        accept="image/png,image/jpeg"
        onChange={onFileChange}
        ref={fileInputRef}
        style={{ display: "none" }}
        type="file"
      />
      <div className="forms-panel__signature-row">
        <button className="context-tool" disabled={loading} onClick={onPickFile} type="button">
          选择签名图片
        </button>
        {signatureImageBytes && signatureImageType ? (
          <>
            <span className="forms-panel__signature-meta">
              {signatureImageType.toUpperCase()} · {signatureImageBytes.length} bytes
            </span>
            <button className="compact-button" onClick={onClear} type="button">
              清除
            </button>
          </>
        ) : (
          <span className="forms-panel__signature-meta">未选择</span>
        )}
      </div>
      <button
        className="context-tool context-tool--primary"
        disabled={loading || !signatureImageBytes}
        onClick={onApply}
        type="button"
      >
        {loading ? "处理中..." : "嵌入签名并导出"}
      </button>
    </section>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
