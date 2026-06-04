import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { AppModeId, UtilityPanelId } from "./components/layout/types";
import { AnnotationService } from "./modules/annotation";
import { createMemoryAnnotationStorage } from "./modules/annotation";
import { AnnotationRepository } from "./modules/annotation";
import { useReaderController } from "./modules/reader";
import { registerReadModeTools } from "./modules/reader/readerModeTools";
import { useTextSearchController } from "./modules/search";
import { useOcrWorkspaceController } from "./modules/ocr";
import type { PdfAnnotation } from "./shared";
import type { AppSettings } from "./shared/settings/types";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import "./styles/app.css";

/** 在应用启动时一次性注册阅读模式工具集（旋转 + 适合页面）。 */
registerReadModeTools();

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => createDefaultAppSettings());
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

  // OCR 工作区控制器：把当前文档路径 + settings.ocrProviders 喂给 hook，
  // 让 ocr 模式的工具条与左侧任务列表共享 jobs / currentJob / busy 状态。
  // 仅在 activeMode 切换到 ocr 时再创建，避免每个模式都持有 Tauri 资源。
  const ocrDocumentPath = reader.state.document?.path;
  const ocrController = useOcrWorkspaceController(
    useMemo(
      () => ({
        documentPath: ocrDocumentPath,
        providers: settings.ocrProviders,
        providerId: settings.defaultOcrProviderId,
        requireNetworkConsent: settings.requireNetworkOcrConfirmation,
      }),
      [ocrDocumentPath, settings.ocrProviders, settings.defaultOcrProviderId, settings.requireNetworkOcrConfirmation],
    ),
  );

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

    if (nextMode === "annotate") {
      setUtilityPanel("annotation");
      return;
    }

    if (utilityPanel === "annotation" || utilityPanel === "none") {
      setUtilityPanel("summary");
    }
  }

  function handleUtilityPanelChange(nextPanel: UtilityPanelId) {
    setUtilityPanel(nextPanel);
    if (activeMode === "pages" && nextPanel !== "none") {
      setActiveMode("read");
    }
  }

  const handleSettingsChange = useCallback((next: AppSettings) => {
    // 设置面板通过 Portal 浮层即时更新 App 状态；后续接入 SettingsService 做
    // 持久化与校验失败回滚时，只需在这里替换 setSettings 为 service.updateSettings。
    setSettings(next);
  }, []);

  return (
    <AppShell
      activeMode={activeMode}
      annotations={loadedAnnotations}
      ocr={ocrController}
      onModeChange={handleModeChange}
      onSettingsChange={handleSettingsChange}
      onUtilityPanelChange={handleUtilityPanelChange}
      reader={reader}
      search={search}
      settings={settings}
      utilityPanel={utilityPanel}
    />
  );
}

export default App;
