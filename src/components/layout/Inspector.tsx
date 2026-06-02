import type { AppSettings } from "../../shared";
import { SettingsPanel } from "../../modules/settings/SettingsPanel";
import type { InspectorPanelId } from "./types";

interface InspectorProps {
  activePanel: InspectorPanelId;
  onPanelChange: (panel: InspectorPanelId) => void;
  settings: AppSettings;
}

const panelLabels: Record<Exclude<InspectorPanelId, "settings">, string> = {
  search: "搜索",
  annotation: "批注",
  ocr: "OCR",
  pages: "页面",
  forms: "表单",
};

export function Inspector({ activePanel, onPanelChange, settings }: InspectorProps) {
  if (activePanel === "settings") {
    return (
      <aside className="inspector" aria-label="任务面板">
        <SettingsPanel settings={settings} />
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="任务面板">
      <div className="inspector__tabs" role="tablist" aria-label="任务面板">
        {(Object.keys(panelLabels) as Array<Exclude<InspectorPanelId, "settings">>).map((panel) => (
          <button
            aria-selected={activePanel === panel}
            key={panel}
            onClick={() => onPanelChange(panel)}
            role="tab"
            type="button"
          >
            {panelLabels[panel]}
          </button>
        ))}
      </div>
      <section className="inspector__content" aria-label={panelLabels[activePanel]}>
        <h2>{panelLabels[activePanel]}</h2>
        {activePanel === "search" ? (
          <label className="field">
            <span>关键词</span>
            <input placeholder="输入后搜索" type="search" />
          </label>
        ) : (
          <p className="panel-placeholder">等待打开 PDF</p>
        )}
      </section>
    </aside>
  );
}
