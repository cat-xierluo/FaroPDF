import { useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { useReaderController } from "./modules/reader";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import type { InspectorPanelId } from "./components/layout/types";
import "./styles/app.css";

function App() {
  const settings = useMemo(() => createDefaultAppSettings(), []);
  const [activePanel, setActivePanel] = useState<InspectorPanelId>("search");
  const reader = useReaderController(settings);

  return <AppShell activePanel={activePanel} onPanelChange={setActivePanel} reader={reader} settings={settings} />;
}

export default App;
