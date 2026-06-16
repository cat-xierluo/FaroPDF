/**
 * ISS-062 阶段 2：自定义图章上传 + 缩略图管理 React 组件。
 *
 * 律师场景：律师上传公章/私章/印鉴 PNG/JPG 扫描，缩略图列表 + 删除 X +
 * 点击触发 onSelectStamp（后续接入批注插入流程）。
 *
 * 上传校验：仅 PNG/JPG + ≤ 1MB；超出抛错 + UI 提示用户。
 * 上限 4 张/用户（由 customStampStore 强制）。
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  MAX_CUSTOM_STAMPS,
  deleteCustomStamp,
  listCustomStamps,
  saveCustomStamp,
  type CustomStamp,
} from "../customStampStore";
import "./CustomStampPanel.css";

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB
const ACCEPT_MIME = ["image/png", "image/jpeg"];

export interface CustomStampPanelProps {
  onSelectStamp: (stamp: CustomStamp) => void;
}

export function CustomStampPanel({ onSelectStamp }: CustomStampPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stamps, setStamps] = useState<CustomStamp[]>(() => listCustomStamps());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 跨组件 / 跨窗口同步：localStorage event（如果其他 tab 改了）
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === "faropdf-custom-stamps") {
        setStamps(listCustomStamps());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleUploadClick = useCallback(() => {
    setErrorMessage(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    if (!ACCEPT_MIME.includes(file.type)) {
      setErrorMessage(`仅支持 PNG / JPG 格式，当前文件类型: ${file.type || "未知"}`);
      event.target.value = ""; // reset input 允许同名重选
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`文件过大（${(file.size / 1024).toFixed(1)} KB），上限 1 MB`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result ?? "");
        const stamp = saveCustomStamp(file.name.replace(/\.[^/.]+$/, ""), dataUrl);
        setStamps(listCustomStamps());
        onSelectStamp(stamp);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "保存图章失败");
      }
    };
    reader.onerror = () => {
      setErrorMessage("读取文件失败");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }, [onSelectStamp]);

  const handleDelete = useCallback((id: string) => {
    deleteCustomStamp(id);
    setStamps(listCustomStamps());
  }, []);

  const slotsAvailable = Math.max(0, MAX_CUSTOM_STAMPS - stamps.length);
  const slotPlaceholders = Array.from({ length: slotsAvailable }, (_, i) => i);

  return (
    <div className="custom-stamp-panel" data-testid="custom-stamp-panel">
      <header className="custom-stamp-panel__header">
        <h3>自定义图章</h3>
        <span className="custom-stamp-panel__count">{stamps.length} / {MAX_CUSTOM_STAMPS}</span>
      </header>

      {errorMessage ? (
        <div className="custom-stamp-panel__error" role="alert" data-testid="custom-stamp-panel-error">
          <span>{errorMessage}</span>
          <button className="compact-button" onClick={() => setErrorMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}

      <div className="custom-stamp-panel__grid">
        {stamps.map((stamp) => (
          <div className="custom-stamp-panel__item" key={stamp.id} data-testid={`custom-stamp-${stamp.id}`}>
            <button
              aria-label={`选择图章: ${stamp.name}`}
              className="custom-stamp-panel__thumbnail"
              onClick={() => onSelectStamp(stamp)}
              type="button"
            >
              <img alt={stamp.name} src={stamp.image} />
            </button>
            <div className="custom-stamp-panel__item-meta">
              <span className="custom-stamp-panel__item-name" title={stamp.name}>
                {stamp.name}
              </span>
              <button
                aria-label={`删除图章: ${stamp.name}`}
                className="custom-stamp-panel__delete"
                onClick={() => handleDelete(stamp.id)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {slotPlaceholders.map((i) => (
          <div className="custom-stamp-panel__slot custom-stamp-panel__slot--empty" key={`slot-${i}`}>
            <span>空位</span>
          </div>
        ))}
      </div>

      <input
        accept={ACCEPT_MIME.join(",")}
        className="custom-stamp-panel__file-input"
        data-testid="custom-stamp-panel-file-input"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: "none" }}
        type="file"
      />
      <button
        className="custom-stamp-panel__upload"
        data-testid="custom-stamp-panel-upload"
        disabled={stamps.length >= MAX_CUSTOM_STAMPS}
        onClick={handleUploadClick}
        type="button"
      >
        {stamps.length >= MAX_CUSTOM_STAMPS ? `已达上限 (${MAX_CUSTOM_STAMPS})` : "+ 上传 PNG / JPG"}
      </button>
    </div>
  );
}
