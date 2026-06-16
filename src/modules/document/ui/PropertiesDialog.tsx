import { useState, type ChangeEvent, type ReactElement } from "react";
import { suggestOutputName } from "../../../shared/naming";
import type { PdfMetadata } from "../properties";

export interface PropertiesDialogProps {
  metadata: PdfMetadata;
  defaultFileName: string;
  onClose: () => void;
  onConfirm: (options: {
    updates: Partial<PdfMetadata>;
    outputName: string;
  }) => void;
}

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
  const { metadata, defaultFileName, onClose, onConfirm } = props;
  const [title, setTitle] = useState(metadata.title ?? "");
  const [author, setAuthor] = useState(metadata.author ?? "");
  const [subject, setSubject] = useState(metadata.subject ?? "");
  const [keywords, setKeywords] = useState(keywordsToString(metadata.keywords));
  const [creationDate, setCreationDate] = useState(metadata.creationDate ?? "");
  const [outputName, setOutputName] = useState(() => suggestOutputName(defaultFileName, "metadata"));
  const [localError, setLocalError] = useState<string | null>(null);

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
