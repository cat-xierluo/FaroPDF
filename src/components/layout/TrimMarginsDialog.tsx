import { useState, type ChangeEvent, type ReactElement } from "react";
import { suggestOutputName } from "../../shared/naming";

export interface TrimMarginsDialogProps {
  /** 当前文档文件名（用于默认输出名） */
  defaultFileName: string;
  /** 已选页码（1-based），非空时仅裁剪这些页 */
  selectedPageNumbers?: number[];
  onClose: () => void;
  onConfirm: (options: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    pageIndexes?: number[];
    outputName: string;
  }) => void;
}

/** ISS-066 阶段 2 后续：扫描件裁边对话框
 *
 * 用户场景：扫描卷宗边缘有白边 / 黑边 / 装订痕，按 pt 单位输入上下左右 margin，
 * 输出 PDF 裁掉这些边（每页用 setCropbox + setMediaBox，详见 trimMargins.ts）。
 *
 * 不做"auto-detect 白边"（需要像素级扫描，超 PM 单 session TDD 范围），
 * 用户传入明确 margin 是 v0.2 实用版本，auto-detect 留 v0.3。
 */
export function TrimMarginsDialog(props: TrimMarginsDialogProps): ReactElement {
  const { defaultFileName, selectedPageNumbers, onClose, onConfirm } = props;
  const [top, setTop] = useState("0");
  const [right, setRight] = useState("0");
  const [bottom, setBottom] = useState("0");
  const [left, setLeft] = useState("0");
  const [outputName, setOutputName] = useState(() => suggestOutputName(defaultFileName, "trimmed"));
  const [localError, setLocalError] = useState<string | null>(null);

  const parseMargin = (raw: string, name: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setLocalError(`${name} 不能为空。`);
      return null;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      setLocalError(`${name} 必须是有效数字。`);
      return null;
    }
    if (value < 0) {
      setLocalError(`${name} 必须 ≥ 0。`);
      return null;
    }
    return value;
  };

  const handleConfirm = (): void => {
    setLocalError(null);
    const topNum = parseMargin(top, "顶 margin");
    if (topNum === null) {
      return;
    }
    const rightNum = parseMargin(right, "右 margin");
    if (rightNum === null) {
      return;
    }
    const bottomNum = parseMargin(bottom, "底 margin");
    if (bottomNum === null) {
      return;
    }
    const leftNum = parseMargin(left, "左 margin");
    if (leftNum === null) {
      return;
    }
    const trimmed = outputName.trim();
    if (!trimmed) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    onConfirm({
      top: topNum,
      right: rightNum,
      bottom: bottomNum,
      left: leftNum,
      ...(selectedPageNumbers && selectedPageNumbers.length > 0
        ? { pageIndexes: selectedPageNumbers.map((p) => p - 1) }
        : {}),
      outputName: trimmed,
    });
  };

  return (
    <div className="dialog-overlay" role="dialog" aria-label="裁边切">
      <div className="dialog-card">
        <h3 className="dialog-card__title">裁边切</h3>
        <p className="dialog-card__hint">
          按 pt 单位输入上下左右 margin，裁掉扫描件边缘的白边 / 黑边 / 装订痕。
          输出 PDF 每页用 setCropbox + setMediaBox 缩小内容。
          {selectedPageNumbers && selectedPageNumbers.length > 0
            ? `已选 ${selectedPageNumbers.length} 页，将仅裁这些页。`
            : "将对整本 PDF 执行。"}
        </p>
        <p className="dialog-card__summary">
          {selectedPageNumbers && selectedPageNumbers.length > 0
            ? `将仅裁 ${selectedPageNumbers.length} 页`
            : "将裁全部页面"}
        </p>
        <div className="dialog-card__field">
          <label htmlFor="trim-top">顶 margin (pt)</label>
          <input
            id="trim-top"
            type="number"
            min={0}
            step="0.1"
            value={top}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTop(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="trim-right">右 margin (pt)</label>
          <input
            id="trim-right"
            type="number"
            min={0}
            step="0.1"
            value={right}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setRight(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="trim-bottom">底 margin (pt)</label>
          <input
            id="trim-bottom"
            type="number"
            min={0}
            step="0.1"
            value={bottom}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBottom(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="trim-left">左 margin (pt)</label>
          <input
            id="trim-left"
            type="number"
            min={0}
            step="0.1"
            value={left}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setLeft(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="trim-output">输出文件名</label>
          <input
            id="trim-output"
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
            确认裁边
          </button>
        </div>
      </div>
    </div>
  );
}