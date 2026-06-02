import { useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { AppModeId, UtilityPanelId } from "./components/layout/types";
import { useReaderController } from "./modules/reader";
import { useTextSearchController } from "./modules/search";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import "./styles/app.css";

function App() {
  const settings = useMemo(() => createDefaultAppSettings(), []);
  const [activeMode, setActiveMode] = useState<AppModeId>("read");
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanelId>("summary");
  const reader = useReaderController(settings);
  const search = useTextSearchController({
    document: reader.state.document,
    readPageText: reader.getPageText,
    onRequestOcr: () => setActiveMode("ocr"),
    onSelectPage: reader.setCurrentPage,
  });

  function handleModeChange(nextMode: AppModeId) {
    setActiveMode(nextMode);
    if (nextMode === "pages") {
      setUtilityPanel("none");
      return;
    }

    if (utilityPanel === "none") {
      setUtilityPanel("summary");
    }
  }

  function handleUtilityPanelChange(nextPanel: UtilityPanelId) {
    setUtilityPanel(nextPanel);
    if (activeMode === "pages" && nextPanel !== "none") {
      setActiveMode("read");
    }
  }

  return (
    <AppShell
      activeMode={activeMode}
      onModeChange={handleModeChange}
      onUtilityPanelChange={handleUtilityPanelChange}
      reader={reader}
      search={search}
      settings={settings}
      utilityPanel={utilityPanel}
    />
  );
}

export default App;
