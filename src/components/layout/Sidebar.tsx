import { useState } from "react";
import type { PdfViewMode } from "../../shared/pdf/types";

const placeholderPages = [1, 2, 3];
const summaryTabs = ["书签", "大纲", "批注列表", "缩略图"] as const;
type SummaryTab = (typeof summaryTabs)[number];
const viewModeOptions: Array<{ id: PdfViewMode; label: string }> = [
  { id: "continuous", label: "连续" },
  { id: "single", label: "单页" },
  { id: "double", label: "双页" },
];

export function DocumentSummaryPanel() {
  const [activeTab, setActiveTab] = useState<SummaryTab>("缩略图");

  return (
    <aside className="utility-panel document-summary" aria-label="文档摘要">
      <div className="summary-tabs" role="tablist" aria-label="文档摘要视图">
        {summaryTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "缩略图" ? (
        <ol className="thumbnail-list" aria-label="页面缩略图">
          {placeholderPages.map((page) => (
            <li className="thumbnail-item thumbnail-item--large" key={page}>
              <div className="thumbnail-page" aria-hidden="true" />
              <span>第 {page} 页</span>
              <small>A4 (210 x 297 毫米)</small>
            </li>
          ))}
        </ol>
      ) : (
        <div className="summary-empty" role="tabpanel">
          <p>{activeTab}会在打开 PDF 后显示。</p>
        </div>
      )}
    </aside>
  );
}

interface ViewSettingsPanelProps {
  canChangeViewMode: boolean;
  onViewModeChange: (viewMode: PdfViewMode) => void;
  viewMode: PdfViewMode;
}

export function ViewSettingsPanel({ canChangeViewMode, onViewModeChange, viewMode }: ViewSettingsPanelProps) {
  return (
    <aside className="utility-panel view-settings" aria-label="视图设置">
      <h2>布局选项</h2>
      <section aria-label="页面布局">
        <p className="utility-label">页面布局</p>
        <div className="choice-grid choice-grid--three">
          {viewModeOptions.map((option) => (
            <button
              aria-pressed={viewMode === option.id}
              disabled={!canChangeViewMode}
              key={option.id}
              onClick={() => onViewModeChange(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="分屏视图">
        <p className="utility-label">分屏视图</p>
        <div className="choice-grid choice-grid--three">
          <button aria-pressed="true" disabled type="button">
            无拆分
          </button>
          <button aria-pressed="false" disabled type="button">
            垂直
          </button>
          <button aria-pressed="false" disabled type="button">
            水平
          </button>
        </div>
      </section>
    </aside>
  );
}
