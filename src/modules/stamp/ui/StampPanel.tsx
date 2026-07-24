/**
 * ISS-NEW-N-P04 统一图章面板：标准 / 自定义 tab + 响应式网格。
 *
 * 证据：raw-Aminus R11（标准/自定义 tab + 2×2 preset 网格；首张蓝描边）。
 * 说明：R11 粗估看到 2×2 共 4 张，但代码 STAMP_TEMPLATE_LIST 有 9 个标准模板；
 * 不擅自砍模板，改用响应式网格展示全部标准模板。严格 2×2 只是 R11 在某窗口
 * 宽度下的巧合呈现，不是合同（manifest 已标 raw-Aminus 不能推导精确断点）。
 *
 * 结构：
 * - 顶部 tab：标准 / 自定义
 * - 标准 tab：STAMP_TEMPLATE_LIST map 成网格，renderStampPreview 渲染 SVG 缩略图，
 *   点击 onSelectStandardStamp(template.id)，选中态用 --selection 蓝
 * - 自定义 tab：嵌入现有 CustomStampPanel（复用其 store + 上传逻辑，最小改动）
 *
 * 显式不推导：custom tab 上传完整闭环（已有 CustomStampPanel 底座）、
 * stamp 落点到 PDF 的几何、精确 2×2 断点。
 * 交付等级：wired + geometry-coarse-verified（禁止 visually-verified）。
 */

import { useState } from "react";
import {
  STAMP_TEMPLATE_LIST,
  renderStampPreview,
} from "../../annotation";
import type { PdfStampName } from "../../../shared/pdf/annotation";
import { CustomStampPanel } from "../../annotation/ui/CustomStampPanel";
import type { CustomStamp } from "../../annotation/customStampStore";
import "./StampPanel.css";

export interface StampPanelProps {
  /** 选择标准模板时触发 */
  onSelectStandardStamp: (name: PdfStampName) => void;
  /** 选择自定义图章时触发（透传给内嵌 CustomStampPanel） */
  onSelectCustomStamp: (stamp: CustomStamp) => void;
  /** 当前已选中的标准模板 id（用于高亮），可选 */
  selectedStandardName?: PdfStampName | null;
}

type Tab = "standard" | "custom";

export function StampPanel({
  onSelectStandardStamp,
  onSelectCustomStamp,
  selectedStandardName = null,
}: StampPanelProps) {
  const [tab, setTab] = useState<Tab>("standard");

  return (
    <div className="stamp-panel" data-testid="stamp-panel">
      <div className="stamp-panel__tabs" role="tablist" aria-label="图章类型切换">
        <button
          aria-selected={tab === "standard"}
          className={"stamp-panel__tab" + (tab === "standard" ? " stamp-panel__tab--active" : "")}
          onClick={() => setTab("standard")}
          role="tab"
          type="button"
        >
          标准
        </button>
        <button
          aria-selected={tab === "custom"}
          className={"stamp-panel__tab" + (tab === "custom" ? " stamp-panel__tab--active" : "")}
          onClick={() => setTab("custom")}
          role="tab"
          type="button"
        >
          自定义
        </button>
      </div>

      {tab === "standard" ? (
        <div className="stamp-panel__grid" data-testid="stamp-panel-standard-grid">
          {STAMP_TEMPLATE_LIST.map((template) => {
            const isSelected = selectedStandardName === template.id;
            const previewInner = renderStampPreview(template.id, {
              label: template.label,
              color: template.defaultColor,
            });
            return (
              <button
                aria-label={`选择图章: ${template.label}`}
                aria-pressed={isSelected}
                className={
                  "stamp-panel__preset" +
                  (isSelected ? " stamp-panel__preset--selected" : "")
                }
                key={template.id}
                onClick={() => onSelectStandardStamp(template.id)}
                title={template.label}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="stamp-panel__preview"
                  preserveAspectRatio="xMidYMid meet"
                  viewBox="0 0 400 100"
                >
                  <g dangerouslySetInnerHTML={{ __html: previewInner }} />
                </svg>
                <span className="stamp-panel__preset-label">{template.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <CustomStampPanel onSelectStamp={onSelectCustomStamp} />
      )}
    </div>
  );
}
