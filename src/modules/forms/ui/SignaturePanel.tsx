/**
 * ISS-070 阶段 2 / ISS-060 阶段 2 第二步：签名面板（包 SignaturePad + 历史签名缩略图）。
 *
 * 设计与 src/modules/annotation/ui/CustomStampPanel 同款：
 * - 顶部：标题 + 计数 (n/4) + 错误带
 * - 中部：缩略图列表（已保存的签名）+ 删除 × + 点击触发 onSelectSignature
 * - 底部：「+ 新画签名」按钮 → 弹出 SignaturePad → 画完后 saveSignature + 刷新列表
 *
 * 用户场景：律师在客户文件 / 和解协议上签字，"我的签名"列表里点选历史签名直接落入文档。
 */

import { useCallback, useEffect, useState } from "react";
import { SignaturePad } from "./SignaturePad";
import {
  MAX_USER_SIGNATURES,
  deleteSignature,
  listSignatures,
  saveSignature,
  type SignatureRecord,
} from "../signatureStore";
import "./SignaturePanel.css";

export interface SignaturePanelProps {
  onSelectSignature: (signature: SignatureRecord) => void;
}

export function SignaturePanel({ onSelectSignature }: SignaturePanelProps) {
  const [records, setRecords] = useState<SignatureRecord[]>(() => listSignatures());
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 跨 tab 同步
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === "faropdf-signatures") {
        setRecords(listSignatures());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleStartDrawing = useCallback(() => {
    setErrorMessage(null);
    setIsDrawing(true);
  }, []);

  const handleSaveSignature = useCallback((pngDataUrl: string) => {
    try {
      const record = saveSignature("", pngDataUrl);
      setRecords(listSignatures());
      setIsDrawing(false);
      onSelectSignature(record);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存签名失败");
    }
  }, [onSelectSignature]);

  const handleCancelDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteSignature(id);
    setRecords(listSignatures());
    if (selectedId === id) {
      setSelectedId(null);
    }
  }, [selectedId]);

  const handleSelect = useCallback(
    (record: SignatureRecord) => {
      setSelectedId(record.id);
      onSelectSignature(record);
    },
    [onSelectSignature],
  );

  const slotsAvailable = Math.max(0, MAX_USER_SIGNATURES - records.length);

  return (
    <div className="signature-panel" data-testid="signature-panel">
      <header className="signature-panel__header">
        <h3>我的签名</h3>
        <span className="signature-panel__count">{records.length} / {MAX_USER_SIGNATURES}</span>
      </header>

      {errorMessage ? (
        <div className="signature-panel__error" role="alert" data-testid="signature-panel-error">
          <span>{errorMessage}</span>
          <button className="compact-button" onClick={() => setErrorMessage(null)} type="button">
            知道了
          </button>
        </div>
      ) : null}

      <div className="signature-panel__list">
        {records.map((record) => (
          <div className="signature-panel__item" key={record.id} data-testid={`signature-${record.id}`}>
            <button
              aria-label={`选择签名: ${record.name}`}
              aria-pressed={selectedId === record.id}
              className={
                "signature-panel__thumbnail" +
                (selectedId === record.id ? " signature-panel__thumbnail--selected" : "")
              }
              onClick={() => handleSelect(record)}
              type="button"
            >
              <img alt={record.name} src={record.image} />
            </button>
            <div className="signature-panel__item-meta">
              <span className="signature-panel__item-name" title={record.name}>
                {record.name}
              </span>
              <button
                aria-label={`删除签名: ${record.name}`}
                className="signature-panel__delete"
                onClick={() => handleDelete(record.id)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 ? (
          <p className="signature-panel__empty" data-testid="signature-panel-empty">
            还没有保存的签名，点下方按钮开始画。
          </p>
        ) : null}
      </div>

      {isDrawing ? (
        <div className="signature-panel__drawing" data-testid="signature-panel-drawing">
          <SignaturePad
            onCancel={handleCancelDrawing}
            onSave={handleSaveSignature}
            width={280}
            height={120}
          />
        </div>
      ) : (
        <button
          className="signature-panel__add"
          data-testid="signature-panel-add"
          disabled={slotsAvailable === 0}
          onClick={handleStartDrawing}
          type="button"
        >
          {slotsAvailable === 0 ? `已达上限 (${MAX_USER_SIGNATURES})` : "+ 新画签名"}
        </button>
      )}
    </div>
  );
}
