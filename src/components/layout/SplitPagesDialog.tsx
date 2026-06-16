import { useState, type ChangeEvent, type ReactElement } from "react";
import { suggestOutputName } from "../../shared/naming";

export interface SplitPagesDialogProps {
  /** 当前文档文件名（用于默认输出名） */
  defaultFileName: string;
  /** 已选页码（1-based），非空时仅切这些页 */
  selectedPageNumbers?: number[];
  onClose: () => void;
  onConfirm: (options: {
    rows: number;
    cols: number;
    pageIndexes?: number[];
    outputName: string;
  }) => void;
}

export function SplitPagesDialog(props: SplitPagesDialogProps): ReactElement {
  const { defaultFileName, selectedPageNumbers, onClose, onConfirm } = props;
  const [rows, setRows] = useState("1");
  const [cols, setCols] = useState("2");
  const [outputName, setOutputName] = useState(() => suggestOutputName(defaultFileName, "cut"));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConfirm = (): void => {
    setLocalError(null);
    const rowsNum = Number.parseInt(rows, 10);
    if (!Number.isInteger(rowsNum) || rowsNum < 1) {
      setLocalError("行数必须是 ≥ 1 的整数。");
      return;
    }
    const colsNum = Number.parseInt(cols, 10);
    if (!Number.isInteger(colsNum) || colsNum < 1) {
      setLocalError("列数必须是 ≥ 1 的整数。");
      return;
    }
    const trimmed = outputName.trim();
    if (!trimmed) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    onConfirm({
      rows: rowsNum,
      cols: colsNum,
      ...(selectedPageNumbers && selectedPageNumbers.length > 0
        ? { pageIndexes: selectedPageNumbers.map((p) => p - 1) }
        : {}),
      outputName: trimmed,
    });
  };

  return (
    <div className="dialog-overlay" role="dialog" aria-label="扫描拆页">
      <div className="dialog-card">
        <h3 className="dialog-card__title">扫描拆页</h3>
        <p className="dialog-card__hint">
          把扫描拼图拆成 N×M 子页（如 1×2 拆双页，2×2 切 4 子页）。
          {selectedPageNumbers && selectedPageNumbers.length > 0
            ? `已选 ${selectedPageNumbers.length} 页，将仅切这些页。`
            : "将对整本 PDF 执行。"}
        </p>
        <p className="dialog-card__summary">
          {selectedPageNumbers && selectedPageNumbers.length > 0
            ? `将仅切 ${selectedPageNumbers.length} 页`
            : "将切全部页面"}
        </p>
        <div className="dialog-card__field">
          <label htmlFor="split-rows">行数</label>
          <input
            id="split-rows"
            type="number"
            min={1}
            value={rows}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setRows(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="split-cols">列数</label>
          <input
            id="split-cols"
            type="number"
            min={1}
            value={cols}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCols(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="split-output">输出文件名</label>
          <input
            id="split-output"
            type="text"
            value={outputName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setOutputName(event.target.value)}
          />
        </div>
        {localError ? <p className="dialog-card__error" role="alert">{localError}</p> : null}
        <div className="dialog-card__actions">
          <button type="button" onClick={onClose} className="context-tool">
            取消
          </button>
          <button type="button" onClick={handleConfirm} className="context-tool context-tool--primary">
            确认拆页
          </button>
        </div>
      </div>
    </div>
  );
}
