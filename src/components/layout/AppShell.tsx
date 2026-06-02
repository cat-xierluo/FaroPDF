import type { AppSettings } from "../../shared";
import { Inspector } from "./Inspector";
import { ReaderCanvas } from "./ReaderCanvas";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import type { InspectorPanelId } from "./types";

interface AppShellProps {
  activePanel: InspectorPanelId;
  onPanelChange: (panel: InspectorPanelId) => void;
  settings: AppSettings;
}

export function AppShell({ activePanel, onPanelChange, settings }: AppShellProps) {
  return (
    <div className="app-shell" role="application" aria-label="FaroPDF PDF 工作台">
      <Toolbar activePanel={activePanel} onPanelChange={onPanelChange} />
      <div className="workspace">
        <Sidebar />
        <ReaderCanvas />
        <Inspector activePanel={activePanel} onPanelChange={onPanelChange} settings={settings} />
      </div>
      <StatusBar />
    </div>
  );
}
