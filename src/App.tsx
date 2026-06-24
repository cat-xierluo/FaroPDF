import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { AnnotationDraftSubmission, AppModeId, UtilityPanelId } from "./components/layout/types";
import {
  AnnotationService,
  createInitialAnnotationToolState,
  type AnnotationToolState,
} from "./modules/annotation";
import { createMemoryAnnotationStorage } from "./modules/annotation";
import { AnnotationRepository } from "./modules/annotation";
import { useReaderController, type ReaderController } from "./modules/reader";
import { registerReadModeTools } from "./modules/reader/readerModeTools";
import { openNativePdfFileDialog } from "./modules/reader/tauriPdfFileService";
import { useTextSearchController } from "./modules/search";
import { useOcrWorkspaceController } from "./modules/ocr";
import type { PdfAnnotation } from "./shared";
import type { AppCommandSignal } from "./shared/app/commands";
import { subscribeNativeMenuCommands } from "./shared/app/nativeMenuBridge";
import type { AppSettings } from "./shared/settings/types";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import "./styles/app.css";
import { TabProvider, useTabStore } from "./state/tabStore";

/**
 * ISS-NEW-F 第 3 步（2026-06-24）步 2：把 reader 的当前页码同步到 active tab 的 lastPage。
 *
 * 当前架构里 reader 单例在 App.tsx，tabStore 在 TabProvider 内。两个组件各持一份 state，
 * 这里用 useEffect + tabStoreRef 解耦：reader.currentPage 或 document.path 变化时，
 * 找到 active tab 并 dispatch SET_LAST_PAGE，让 TitlebarTabs.handleDragEnd 拿到的
 * tab.lastPage 始终是真实页码。
 *
 * 边界：
 * - document 为 null → 不动（无 PDF 可同步）
 * - active tab.filePath !== document.path → 不动（用户在别的 tab，不能写错位置）
 * - active tab 未找到 → 不动
 * - 当前 lastPage === currentPage → 不动（避免无意义 dispatch）
 */
export function ActiveTabPageSync({ reader }: { reader: ReaderController }): null {
  const tabStore = useTabStore();

  // 直接读 tabStore（不走 ref）。tabStore.state 变化（开 / 关 tab / setLastPage）会让 effect 重跑，
  // 内部 `if (lastPage !== currentPage)` 守卫确保不会无限循环。
  useEffect(() => {
    const document = reader.state.document;
    if (!document) {
      return;
    }
    const activeTab = tabStore.state.tabs.find((tab) => tab.id === tabStore.state.activeTabId);
    if (!activeTab || activeTab.filePath !== document.path) {
      return;
    }
    if (activeTab.lastPage !== document.currentPage) {
      tabStore.setLastPage(activeTab.id, document.currentPage);
    }
  }, [
    reader,
    reader.state.document?.currentPage,
    reader.state.document?.path,
    tabStore,
    tabStore.state.activeTabId,
    tabStore.state.tabs,
  ]);

  return null;
}

/** 在应用启动时一次性注册阅读模式工具集（旋转 + 适合页面）。 */
registerReadModeTools();

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => createDefaultAppSettings());
  const [activeMode, setActiveMode] = useState<AppModeId>("read");
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanelId>("none");
  const [commandSignal, setCommandSignal] = useState<AppCommandSignal | null>(null);
  const [loadedAnnotations, setLoadedAnnotations] = useState<PdfAnnotation[]>([]);
  const commandNonceRef = useRef(0);
  // 批注 armed 状态（单一真相源），由 ContextToolbar 工具条 + AnnotationOverlay 共享
  const [annotationToolState, setAnnotationToolState] = useState<AnnotationToolState>(() => createInitialAnnotationToolState());
  const reader = useReaderController(settings);
  const readerRef = useRef(reader);
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

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themePreference;
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [settings.themePreference]);

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

  useEffect(() => {
    readerRef.current = reader;
  }, [reader]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void subscribeNativeMenuCommands((id) => {
      if (id === "file-open") {
        void openNativePdfFileDialog()
          .then((file) => {
            if (file) {
              void readerRef.current.openNativeFile(file);
            }
          })
          .catch(() => undefined);
        return;
      }

      commandNonceRef.current += 1;
      setCommandSignal({ id, nonce: commandNonceRef.current });
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
      } else {
        unlisten = nextUnlisten;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleSettingsChange = useCallback((next: AppSettings) => {
    // 设置面板通过 Portal 浮层即时更新 App 状态；后续接入 SettingsService 做
    // 持久化与校验失败回滚时，只需在这里替换 setSettings 为 service.updateSettings。
    setSettings(next);
  }, []);

  // 切换 mode 时若离开 annotate 模式，自动 disarm 工具（避免 overlay 在 read 模式还捕获事件）
  useEffect(() => {
    if (activeMode !== "annotate" && annotationToolState.activeToolType !== null) {
      setAnnotationToolState((prev) => ({ ...prev, activeToolType: null }));
    }
  }, [activeMode, annotationToolState.activeToolType]);

  // 用户在 overlay 上完成一次新建 → 调 service.addAnnotation 并刷新本地列表
  const handleAnnotationDraft = useCallback(
    (input: AnnotationDraftSubmission) => {
      const document = reader.state.document;
      if (!document) {
        return;
      }
      const service = getAnnotationService();
      void service
        .addAnnotation(
          { path: document.path, fingerprint: document.fingerprint, pageCount: document.pageCount },
          {
            type: input.type,
            pageIndex: input.pageIndex,
            rects: input.rects,
            color: input.color,
            ...(input.content ? { content: input.content } : {}),
            ...(input.quote ? { quote: input.quote } : {}),
            ...(input.line ? { line: input.line } : {}),
            ...(input.ink ? { ink: input.ink } : {}),
            ...(input.stamp ? { stamp: input.stamp } : {}),
          },
        )
        .then((created) => {
          setLoadedAnnotations((prev) => [...prev, created]);
        })
        .catch(() => undefined);
    },
    [reader.state.document],
  );

  return (
    <TabProvider>
      <ActiveTabPageSync reader={reader} />
      <AppShell
        activeMode={activeMode}
        annotationArmed={{ state: annotationToolState, onStateChange: setAnnotationToolState }}
        annotations={loadedAnnotations}
        commandSignal={commandSignal}
        ocr={ocrController}
        onAnnotationDraft={handleAnnotationDraft}
        onModeChange={handleModeChange}
        onRequestOcr={() => setActiveMode("ocr")}
        onSettingsChange={handleSettingsChange}
        onUtilityPanelChange={handleUtilityPanelChange}
        reader={reader}
      search={search}
      settings={settings}
      utilityPanel={utilityPanel}
    />
    </TabProvider>
  );
}

export default App;
