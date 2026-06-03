import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { AppModeId, UtilityPanelId } from "./components/layout/types";
import { AnnotationService } from "./modules/annotation";
import { createMemoryAnnotationStorage } from "./modules/annotation";
import { AnnotationRepository } from "./modules/annotation";
import { useReaderController } from "./modules/reader";
import { useTextSearchController } from "./modules/search";
import type { PdfAnnotation } from "./shared";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import "./styles/app.css";

function App() {
  const settings = useMemo(() => createDefaultAppSettings(), []);
  const [activeMode, setActiveMode] = useState<AppModeId>("read");
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanelId>("summary");
  const [loadedAnnotations, setLoadedAnnotations] = useState<PdfAnnotation[]>([]);
  const reader = useReaderController(settings);
  const search = useTextSearchController({
    document: reader.state.document,
    readPageText: reader.getPageText,
    onRequestOcr: () => setActiveMode("ocr"),
    onSelectPage: reader.setCurrentPage,
  });

  // 批注服务实例：使用内存存储，后续可替换为文件存储
  const annotationServiceRef = useRef<AnnotationService | null>(null);

  function getAnnotationService(): AnnotationService {
    if (!annotationServiceRef.current) {
      const storage = createMemoryAnnotationStorage();
      const repository = new AnnotationRepository({ storage });
      annotationServiceRef.current = new AnnotationService({ repository });
    }
    return annotationServiceRef.current;
  }

  // 文档加载成功后加载批注列表
  useEffect(() => {
    if (reader.state.status === "ready" && reader.state.document) {
      const document = reader.state.document;
      const service = getAnnotationService();

      service
        .listAnnotations({
          path: document.path,
          fingerprint: document.fingerprint,
          pageCount: document.pageCount,
        })
        .then((annotations) => {
          setLoadedAnnotations(annotations);
        })
        .catch(() => {
          setLoadedAnnotations([]);
        });
    } else if (reader.state.status !== "ready") {
      setLoadedAnnotations([]);
    }
  }, [reader.state.status, reader.state.document?.documentId]);

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
      annotations={loadedAnnotations}
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
