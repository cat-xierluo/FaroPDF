import { type ReactElement } from "react";
import { listSignatures } from "../signatureStore";

export interface SignatureLibraryPickerProps {
  /** 用户选中某条历史签名时回调，传入 base64 data URL */
  onSelect: (imageDataUrl: string) => void;
}

/**
 * ISS-070 阶段 3：从签名库选历史签名插入表单。
 *
 * 渲染 signatureStore 里的所有签名为缩略图；空态提示用户先去 SignaturePanel 新画。
 * 嵌入 FormsPanel 的签名行，让律师填表时直接选已保存的签名，不必每次重新上传文件。
 */
export function SignatureLibraryPicker({ onSelect }: SignatureLibraryPickerProps): ReactElement {
  const signatures = listSignatures();

  if (signatures.length === 0) {
    return (
      <p className="signature-library-picker__empty" data-testid="signature-library-empty">
        还没有签名。请先在「签名」面板新建签名。
      </p>
    );
  }

  return (
    <div className="signature-library-picker" role="group" aria-label="签名库">
      {signatures.map((sig) => (
        <button
          type="button"
          key={sig.id}
          className="signature-library-picker__item"
          data-testid="signature-library-item"
          onClick={() => onSelect(sig.image)}
          title={sig.name}
        >
          <img src={sig.image} alt={sig.name} className="signature-library-picker__thumb" />
        </button>
      ))}
    </div>
  );
}
