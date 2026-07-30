/**
 * forms 模式 controller hook
 *
 * 封装表单状态、字段列表、面板状态、填值/签名/扁平化操作的 React hook。
 * 依赖 ReaderController 暴露的 getFileBytes / saveUpdatedBytes 拿源 bytes 和保存导出。
 * 不持有任何 React 外部全局状态；多个 controller 并存时各管各的；module-level 桥由
 * activeFormController.ts 提供。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReaderController } from "../reader";
import type {
  PdfFormOperation,
  PdfFormState,
  PdfSignatureImageType,
} from "../../shared/pdf/form";
import { createPdfOperationEngine } from "../export/pdfOperationEngine";
import { createFormService, type FormService } from "./formService";

export type FormPanelMode = "none" | "fill" | "sign";

export interface FormController {
  /** 当前文档的表单状态；尚未读取时为 null */
  formState: PdfFormState | null;
  /** 加载 / 写入进行中 */
  loading: boolean;
  /** 最近一次失败的错误信息；成功或未触发时为 null */
  errorMessage: string | null;
  /** 面板模式：none 隐藏 / fill 文本填值 / sign 签名图片 */
  panelMode: FormPanelMode;
  /** 当前选中的字段 ID（用于 fill / sign 子操作） */
  selectedFieldId: string | null;
  /** 文本字段草稿值 */
  draftValue: string;
  /** 签名图片字节（用户上传的 PNG / JPG 原始字节） */
  signatureImageBytes: Uint8Array | null;
  /** 签名图片类型 */
  signatureImageType: PdfSignatureImageType | null;
  /** 最近一次成功的提示（导出完成 / 操作完成） */
  successMessage: string | null;

  /** 主动读取当前文档的表单字段（不打开面板） */
  refreshFormState: () => Promise<void>;
  /** 打开面板并预选第一个 fillable 字段 */
  openPanel: (mode: Exclude<FormPanelMode, "none">) => void;
  /** 关闭面板并清空草稿 */
  closePanel: () => void;
  /** 选中一个字段（用于填值 / 签名） */
  selectField: (fieldId: string) => void;
  /** 更新 draftValue */
  setDraftValue: (value: string) => void;
  /** 设置签名图片 */
  setSignatureImage: (bytes: Uint8Array, type: PdfSignatureImageType) => void;
  /** 清除签名图片 */
  clearSignatureImage: () => void;
  /** 对当前选中字段应用 draftValue（仅 text / dropdown） */
  applyFieldEdit: () => Promise<void>;
  /** 对当前选中字段应用签名图片 */
  applySignature: () => Promise<void>;
  /** 扁平化并保存为新 PDF */
  flattenAndSave: () => Promise<void>;
  /** 通用批量执行：填值/签名/扁平化按数组顺序 */
  applyBatchAndSave: (operations: PdfFormOperation[], suggestedSuffix: string) => Promise<void>;
  /** 主动写入一条错误提示（用于 UI 内部校验失败等场景） */
  setErrorMessage: (message: string | null) => void;
  /** 清除错误和成功提示 */
  clearMessages: () => void;
}

export interface UseFormControllerOptions {
  /** PDF 字段读取/写入的 service（测试时可注入 fake） */
  service?: FormService;
}

export function useFormController(reader: ReaderController, options: UseFormControllerOptions = {}): FormController {
  const fallbackService = useMemo<FormService>(
    () => createFormService({ engine: createPdfOperationEngine() }),
    [],
  );
  const service = options.service ?? fallbackService;

  const [formState, setFormState] = useState<PdfFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<FormPanelMode>("none");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [signatureImageBytes, setSignatureImageBytes] = useState<Uint8Array | null>(null);
  const [signatureImageType, setSignatureImageType] = useState<PdfSignatureImageType | null>(null);

  const lastDocumentIdRef = useRef<string | null>(null);
  const workingBytesRef = useRef<Uint8Array | null>(null);

  // 文档切换时重置全部状态
  useEffect(() => {
    const documentId = reader.state.document?.documentId ?? null;
    if (documentId !== lastDocumentIdRef.current) {
      lastDocumentIdRef.current = documentId;
      setFormState(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPanelMode("none");
      setSelectedFieldId(null);
      setDraftValue("");
      setSignatureImageBytes(null);
      setSignatureImageType(null);
      workingBytesRef.current = null;
    }
  }, [reader.state.document?.documentId]);

  /**
   * 表单会话始终在同一份内存工作副本上累计操作。首次访问时才读取 reader 的原始
   * bytes；填写、签名或批量操作成功后由调用方把结果回写到 workingBytesRef。
   * 这里只返回副本，避免 pdf-lib 或测试替身意外改写缓存本身。
   */
  const getWorkingBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (workingBytesRef.current) {
      return new Uint8Array(workingBytesRef.current);
    }
    const sourceBytes = await reader.getFileBytes();
    if (!sourceBytes) {
      return null;
    }
    workingBytesRef.current = new Uint8Array(sourceBytes);
    return new Uint8Array(workingBytesRef.current);
  }, [reader.getFileBytes]);

  const updateWorkingBytes = useCallback((bytes: Uint8Array): Uint8Array => {
    const copy = new Uint8Array(bytes);
    workingBytesRef.current = copy;
    return new Uint8Array(copy);
  }, []);

  const refreshFormState = useCallback(async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setErrorMessage("尚未打开 PDF，无法读取表单字段。");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const state = await service.readFormFields(bytes);
      setFormState(state);
      if (state.fieldCount === 0) {
        setSuccessMessage("PDF 中没有可识别的表单字段。");
      } else {
        setSuccessMessage(`已读取 ${state.fieldCount} 个字段。`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [getWorkingBytes, service]);

  const openPanel = useCallback(
    (mode: Exclude<FormPanelMode, "none">) => {
      setPanelMode(mode);
      setErrorMessage(null);
      setSuccessMessage(null);
      // 自动选中第一个非 readOnly 字段
      if (formState && formState.fields.length > 0) {
        const firstEditable = formState.fields.find((field) => !field.readOnly) ?? formState.fields[0] ?? null;
        setSelectedFieldId(firstEditable?.id ?? null);
        const initialDraft = firstEditable && mode === "fill" ? firstEditable.value ?? "" : "";
        setDraftValue(initialDraft);
      } else {
        setSelectedFieldId(null);
        setDraftValue("");
      }
    },
    [formState],
  );

  const closePanel = useCallback(() => {
    setPanelMode("none");
    setSelectedFieldId(null);
    setDraftValue("");
    setErrorMessage(null);
  }, []);

  const selectField = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    const field = formState?.fields.find((entry) => entry.id === fieldId);
    setDraftValue(field?.value ?? "");
    setErrorMessage(null);
  }, [formState]);

  const clearSignatureImage = useCallback(() => {
    setSignatureImageBytes(null);
    setSignatureImageType(null);
  }, []);

  const setSignatureImage = useCallback((bytes: Uint8Array, type: PdfSignatureImageType) => {
    setSignatureImageBytes(bytes);
    setSignatureImageType(type);
  }, []);

  const applyFieldEdit = useCallback(async () => {
    if (!selectedFieldId) {
      setErrorMessage("请先选择要填写的字段。");
      return;
    }
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setErrorMessage("尚未打开 PDF，无法填写字段。");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updatedBytes = await service.fillFormField(bytes, { fieldId: selectedFieldId, value: draftValue });
      await reader.saveUpdatedBytes(updatedBytes, suggestOutputName(reader.getCurrentFileName(), "filled"));
      const workingBytes = updateWorkingBytes(updatedBytes);
      // 重新读取表单状态以反映新值
      const refreshed = await service.readFormFields(workingBytes);
      setFormState(refreshed);
      setSuccessMessage(`字段 "${selectedFieldId}" 已填写并导出。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [draftValue, getWorkingBytes, reader.getCurrentFileName, reader.saveUpdatedBytes, selectedFieldId, service, updateWorkingBytes]);

  const applySignature = useCallback(async () => {
    if (!selectedFieldId) {
      setErrorMessage("请先选择签名字段。");
      return;
    }
    if (!signatureImageBytes || !signatureImageType) {
      setErrorMessage("请先选择签名图片。");
      return;
    }
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setErrorMessage("尚未打开 PDF，无法签名。");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updatedBytes = await service.signField(bytes, {
        fieldId: selectedFieldId,
        imageBytes: signatureImageBytes,
        imageType: signatureImageType,
      });
      await reader.saveUpdatedBytes(updatedBytes, suggestOutputName(reader.getCurrentFileName(), "signed"));
      const workingBytes = updateWorkingBytes(updatedBytes);
      const refreshed = await service.readFormFields(workingBytes);
      setFormState(refreshed);
      setSuccessMessage(`签名字段 "${selectedFieldId}" 已嵌入图片并导出。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [getWorkingBytes, reader.getCurrentFileName, reader.saveUpdatedBytes, selectedFieldId, service, signatureImageBytes, signatureImageType, updateWorkingBytes]);

  const applyBatchAndSave = useCallback(
    async (operations: PdfFormOperation[], suggestedSuffix: string) => {
      const bytes = await getWorkingBytes();
      if (!bytes) {
        setErrorMessage("尚未打开 PDF，无法执行批量操作。");
        return;
      }
      if (operations.length === 0) {
        setErrorMessage("批量操作至少需要一条 operation。");
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const result = await service.applyFormOperations({
          id: `batch-${Date.now()}`,
          pdfBytes: bytes,
          operations,
          requestedAt: new Date().toISOString(),
        });
        await reader.saveUpdatedBytes(result.bytes, suggestOutputName(reader.getCurrentFileName(), suggestedSuffix));
        const workingBytes = updateWorkingBytes(result.bytes);
        const refreshed = await service.readFormFields(workingBytes);
        setFormState(refreshed);
        const failed = result.results.filter((entry) => entry.status === "failed");
        if (failed.length > 0) {
          setErrorMessage(`已应用 ${result.appliedCount} 条操作；${failed.length} 条失败：${failed.map((entry) => entry.errorMessage).join("；")}`);
        } else {
          setSuccessMessage(`已应用 ${result.appliedCount} 条操作并导出。`);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    },
    [getWorkingBytes, reader.getCurrentFileName, reader.saveUpdatedBytes, service, updateWorkingBytes],
  );

  const flattenAndSave = useCallback(async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setErrorMessage("尚未打开 PDF，无法扁平化。");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { bytes: flattenedBytes, summary } = await service.flattenForm(bytes);
      await reader.saveUpdatedBytes(flattenedBytes, suggestOutputName(reader.getCurrentFileName(), "flattened"));
      updateWorkingBytes(flattenedBytes);
      // 扁平化后字段全部消失
      setFormState({ fields: [], fieldCount: 0, fillable: false });
      setSuccessMessage(`已扁平化 ${summary.fieldCountBeforeFlatten} 个字段并导出。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [getWorkingBytes, reader.getCurrentFileName, reader.saveUpdatedBytes, service, updateWorkingBytes]);

  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const setErrorMessageDirect = useCallback((message: string | null) => {
    setErrorMessage(message);
    if (message !== null) {
      setSuccessMessage(null);
    }
  }, []);

  return {
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
    openPanel,
    closePanel,
    selectField,
    setDraftValue,
    setSignatureImage,
    clearSignatureImage,
    applyFieldEdit,
    applySignature,
    applyBatchAndSave,
    flattenAndSave,
    setErrorMessage: setErrorMessageDirect,
    clearMessages,
  };
}

/**
 * 根据原文件名生成 `<base>-<suffix>.pdf`。无原文件名时返回 `document-<suffix>.pdf`。
 * 强制以 .pdf 结尾（即便原名不是 .pdf）。
 */
function suggestOutputName(originalName: string | null, suffix: string): string {
  const base = (originalName ?? "document").replace(/\.pdf$/i, "");
  const safeSuffix = suffix.replace(/[^A-Za-z0-9_-]/g, "-");
  return `${base}-${safeSuffix}.pdf`;
}
