import { useState } from "react";

const placeholderPages = [1, 2, 3];
const summaryTabs = ["书签", "大纲", "批注列表", "缩略图"] as const;
type SummaryTab = (typeof summaryTabs)[number];

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

export function ViewSettingsPanel() {
  return (
    <aside className="utility-panel view-settings" aria-label="视图设置">
      <h2>布局选项</h2>
      <section aria-label="页面布局">
        <p className="utility-label">页面布局</p>
        <div className="choice-grid">
          <button aria-pressed="true" type="button">
            单页
          </button>
          <button aria-pressed="false" type="button">
            双页
          </button>
        </div>
      </section>
      <section aria-label="分屏视图">
        <p className="utility-label">分屏视图</p>
        <div className="choice-grid choice-grid--three">
          <button aria-pressed="true" type="button">
            无拆分
          </button>
          <button aria-pressed="false" type="button">
            垂直
          </button>
          <button aria-pressed="false" type="button">
            水平
          </button>
        </div>
      </section>
    </aside>
  );
}
