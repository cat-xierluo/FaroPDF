import { useMemo } from "react";
import type { OcrProviderConfig } from "../../../shared/ocr/types";
import type { OcrWorkspaceController } from "./useOcrWorkspaceController";

/**
 * OCR 任务参数区（只读展示）。
 *
 * 设计目标：让用户启动 OCR 前清楚看到当前用的 provider、页码范围、输出策略、
 * 质量检查状态，以及云端 provider 是否需要联网授权。**不**修改 controller 的
 * 内部状态；所有字段从 `controller.parameters` 派生。
 */
export interface OcrWorkspaceHeaderProps {
  parameters: OcrWorkspaceController["parameters"];
  /** 提供 provider 列表以便显示「可用 provider」摘要；可选 */
  availableProviders?: ReadonlyArray<OcrProviderConfig>;
  /** 总页数；用于显示「页码范围」默认占位（"全部页面"） */
  pageCount?: number;
  /** 文档名（脱敏） */
  documentLabel?: string;
}

const OUTPUT_STRATEGY_LABELS: Record<string, string> = {
  "new-layered-pdf": "输出新双层 PDF（*-ocr.pdf）",
  "in-place": "就地写入（不推荐）",
};

export function OcrWorkspaceHeader({
  parameters,
  availableProviders,
  pageCount,
  documentLabel,
}: OcrWorkspaceHeaderProps) {
  const { activeProvider, outputStrategy, qualityCheck, networkConsentRequired } = parameters;

  const enabledProviderCount = useMemo(
    () => (availableProviders ?? []).filter((p) => p.enabled).length,
    [availableProviders],
  );

  const pageRangeLabel = pageCount && pageCount > 0 ? `全部页面（共 ${pageCount} 页）` : "全部页面";
  const outputLabel = OUTPUT_STRATEGY_LABELS[outputStrategy] ?? outputStrategy;

  return (
    <section className="ocr-workspace__parameters" aria-label="OCR 任务参数">
      <h3 className="ocr-workspace__parameters-title">任务参数</h3>
      <dl className="ocr-workspace__parameters-list">
        <div className="ocr-workspace__parameters-row">
          <dt>文档</dt>
          <dd>{documentLabel ?? "未选择文档"}</dd>
        </div>
        <div className="ocr-workspace__parameters-row">
          <dt>OCR 后端</dt>
          <dd>
            {activeProvider ? (
              <>
                <strong>{activeProvider.label}</strong>
                <span className={`ocr-workspace__parameters-tag ocr-workspace__parameters-tag--${activeProvider.kind}`}>
                  {activeProvider.kind === "local" ? "本地" : "云端"}
                </span>
                {activeProvider.requiresNetworkConsent ? (
                  <span className="ocr-workspace__parameters-tag ocr-workspace__parameters-tag--network">需联网</span>
                ) : null}
              </>
            ) : (
              <span className="ocr-workspace__parameters-warning">未配置可用 OCR 后端</span>
            )}
            {availableProviders && availableProviders.length > 1 ? (
              <small className="ocr-workspace__parameters-hint">
                共 {availableProviders.length} 个 provider（{enabledProviderCount} 已启用）
              </small>
            ) : null}
          </dd>
        </div>
        <div className="ocr-workspace__parameters-row">
          <dt>页码范围</dt>
          <dd>{pageRangeLabel}</dd>
        </div>
        <div className="ocr-workspace__parameters-row">
          <dt>输出策略</dt>
          <dd>{outputLabel}</dd>
        </div>
        <div className="ocr-workspace__parameters-row">
          <dt>质量检查</dt>
          <dd>
            {qualityCheck.enabled ? (
              <>
                <span className="ocr-workspace__parameters-tag ocr-workspace__parameters-tag--ok">已启用</span>
                {qualityCheck.keywords.length > 0 ? (
                  <small className="ocr-workspace__parameters-hint">
                    关键词：{qualityCheck.keywords.join("、")}
                  </small>
                ) : (
                  <small className="ocr-workspace__parameters-hint">{qualityCheck.description}</small>
                )}
              </>
            ) : (
              <span className="ocr-workspace__parameters-tag ocr-workspace__parameters-tag--idle">未启用</span>
            )}
          </dd>
        </div>
        {activeProvider?.requiresNetworkConsent ? (
          <div className="ocr-workspace__parameters-row ocr-workspace__parameters-row--network">
            <dt>联网授权</dt>
            <dd>
              {networkConsentRequired ? (
                <span className="ocr-workspace__parameters-warning" role="status">
                  云端 OCR 需要联网授权；启动前请在「设置 → OCR provider」勾选「允许上传当前文档」。
                </span>
              ) : (
                <span className="ocr-workspace__parameters-tag ocr-workspace__parameters-tag--ok">已授权</span>
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
