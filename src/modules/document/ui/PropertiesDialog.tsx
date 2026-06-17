import { useState, type ChangeEvent, type ReactElement } from "react";
import { suggestOutputName } from "../../../shared/naming";
import type { PdfMetadata } from "../properties";

export interface ProducerOverrideMessage {
  type: "success" | "error";
  text: string;
}

export interface PropertiesDialogProps {
  metadata: PdfMetadata;
  defaultFileName: string;
  /**
   * 当前 PDF 在磁盘上的完整路径。Rust 后端 `set_pdf_producer` 需要此字段。
   * 浏览器拖拽打开（无 path）时为 null，Producer 真覆盖按钮自动禁用。
   * Ref: ISS-072 阶段 2 后续 / DEC-136
   */
  inputFilePath: string | null;
  onClose: () => void;
  onConfirm: (options: {
    updates: Partial<PdfMetadata>;
    outputName: string;
  }) => void;
  /**
   * 调用 Rust 后端 `set_pdf_producer` 真覆盖 Producer 字段。
   * 当 `inputFilePath === null` 或未传此回调时，UI 不显示对应按钮。
   * Ref: DEC-109 Producer pdf-lib 限制 / DEC-136 lopdf InfoDict 真覆盖
   */
  onProducerOverride?: (producer: string) => void | Promise<void>;
  /** Rust 调用进行中；用于禁用按钮与反馈状态展示。 */
  producerOverrideInFlight?: boolean;
  /** 上一次 Producer 真覆盖的反馈；展示在按钮下方直至用户关闭对话框。 */
  producerOverrideMessage?: ProducerOverrideMessage | null;
}

const DEFAULT_PRODUCER_NAME = "FaroPDF";

function keywordsToString(keywords: string[] | undefined): string {
  return keywords ? keywords.join(", ") : "";
}

function parseKeywordsInput(value: string): string[] {
  return value
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export function PropertiesDialog(props: PropertiesDialogProps): ReactElement {
  const {
    metadata,
    defaultFileName,
    inputFilePath,
    onClose,
    onConfirm,
    onProducerOverride,
    producerOverrideInFlight = false,
    producerOverrideMessage = null,
  } = props;
  const [title, setTitle] = useState(metadata.title ?? "");
  const [author, setAuthor] = useState(metadata.author ?? "");
  const [subject, setSubject] = useState(metadata.subject ?? "");
  const [keywords, setKeywords] = useState(keywordsToString(metadata.keywords));
  const [creationDate, setCreationDate] = useState(metadata.creationDate ?? "");
  const [outputName, setOutputName] = useState(() => suggestOutputName(defaultFileName, "metadata"));
  const [localError, setLocalError] = useState<string | null>(null);

  const canUseRustProducerOverride = inputFilePath !== null && typeof onProducerOverride === "function";

  const handleConfirm = (): void => {
    setLocalError(null);
    const trimmed = outputName.trim();
    if (!trimmed) {
      setLocalError("输出文件名不能为空。");
      return;
    }
    const updates: Partial<PdfMetadata> = {
      title,
      author,
      subject,
      keywords: parseKeywordsInput(keywords),
      creationDate,
    };
    onConfirm({ updates, outputName: trimmed });
  };

  const handleProducerOverride = (): void => {
    if (!canUseRustProducerOverride || !onProducerOverride || !inputFilePath) {
      return;
    }
    void onProducerOverride(DEFAULT_PRODUCER_NAME);
  };

  return (
    <div className="dialog-overlay" role="dialog" aria-label="文档属性">
      <div className="dialog-card dialog-card--wide">
        <h3 className="dialog-card__title">文档属性</h3>
        <p className="dialog-card__hint">
          编辑 PDF 元数据。Producer / Creator / 页数 / 加密状态为只读信息；
          修改后导出 <code>*-metadata.pdf</code> 新副本，不覆盖原始 PDF。
        </p>
        <div className="dialog-card__field">
          <label htmlFor="props-title">标题</label>
          <input
            id="props-title"
            type="text"
            value={title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="props-author">作者</label>
          <input
            id="props-author"
            type="text"
            value={author}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAuthor(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="props-subject">主题</label>
          <input
            id="props-subject"
            type="text"
            value={subject}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSubject(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="props-keywords">关键词（逗号分隔）</label>
          <input
            id="props-keywords"
            type="text"
            value={keywords}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setKeywords(event.target.value)}
          />
        </div>
        <div className="dialog-card__field">
          <label htmlFor="props-creation-date">创建日期</label>
          <input
            id="props-creation-date"
            type="text"
            value={creationDate}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCreationDate(event.target.value)}
          />
        </div>
        <fieldset className="dialog-card__readonly">
          <legend>只读</legend>
          <div className="dialog-card__field">
            <label htmlFor="props-producer">生产者</label>
            <input
              id="props-producer"
              type="text"
              value={metadata.producer ?? ""}
              disabled
            />
          </div>
          {canUseRustProducerOverride ? (
            <div className="dialog-card__field dialog-card__field--inline">
              <button
                type="button"
                className="context-tool"
                onClick={handleProducerOverride}
                disabled={producerOverrideInFlight}
                data-testid="props-producer-override"
              >
                {producerOverrideInFlight ? "正在真覆盖..." : `用 ${DEFAULT_PRODUCER_NAME} 真覆盖 Producer (Rust 后端)`}
              </button>
            </div>
          ) : null}
          {producerOverrideMessage ? (
            <p
              className={producerOverrideMessage.type === "error" ? "dialog-card__error" : "dialog-card__readonly-tag"}
              role={producerOverrideMessage.type === "error" ? "alert" : "status"}
            >
              {producerOverrideMessage.text}
            </p>
          ) : null}
          <div className="dialog-card__field">
            <label htmlFor="props-creator">创建者</label>
            <input
              id="props-creator"
              type="text"
              value={metadata.creator ?? ""}
              disabled
            />
          </div>
          <div className="dialog-card__field">
            <label htmlFor="props-page-count">页数</label>
            <input
              id="props-page-count"
              type="number"
              value={metadata.pageCount}
              disabled
            />
          </div>
          <p className="dialog-card__readonly-tag">
            加密状态：{metadata.isEncrypted ? "已加密" : "未加密"}
          </p>
        </fieldset>
        <div className="dialog-card__field">
          <label htmlFor="props-output">输出文件名</label>
          <input
            id="props-output"
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
            保存元数据
          </button>
        </div>
      </div>
    </div>
  );
}
