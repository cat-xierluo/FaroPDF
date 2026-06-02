import { useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import type { InspectorPanelId } from "./components/layout/types";
import "./styles/app.css";

function App() {
  const settings = useMemo(() => createDefaultAppSettings(), []);
  const [activePanel, setActivePanel] = useState<InspectorPanelId>("search");

  return <AppShell activePanel={activePanel} onPanelChange={setActivePanel} settings={settings} />;
}

export default App;
