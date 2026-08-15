import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/layout/AppShell";
import type { AnnotationDraftSubmission, AppModeId, UtilityPanelId } from "./components/layout/types";
import {
  AnnotationService,
  createLocalStorageAnnotationStorage,
  createInitialAnnotationToolState,
  type AnnotationToolState,
} from "./modules/annotation";
import { createMemoryAnnotationStorage } from "./modules/annotation";
import { AnnotationRepository } from "./modules/annotation";
import type { AnnotationStorage } from "./modules/annotation/repository";
import { useReaderController, type ReaderController } from "./modules/reader";
import { registerReadModeTools } from "./modules/reader/readerModeTools";
import { openNativePdfFileDialog, readPdfFileFromPath } from "./modules/reader/tauriPdfFileService";
import { useTextSearchController } from "./modules/search";
import { useOcrWorkspaceController } from "./modules/ocr";
import type { PdfAnnotation } from "./shared";
import type { AppCommandSignal } from "./shared/app/commands";
import { subscribeNativeMenuCommands } from "./shared/app/nativeMenuBridge";
import { normalizeError } from "./shared/error";
import { friendlyMessageForCode } from "./shared/errorMessages";
import type { AppSettings } from "./shared/settings/types";
import { createDefaultAppSettings } from "./shared/settings/defaults";
import "./styles/app.css";
import { TabProvider, useTabStore } from "./state/tabStore";

/** ISS-NEW-F 第 3 步（2026-06-24）步 3：源窗口 tab 拖离后写入 localStorage 的待恢复 payload。 */
interface PendingDetachPayload {
  filePath: string;
  fileName: string;
  lastPage: number;
}

const PENDING_DETACH_STORAGE_KEY = "faropdf:pending-detach";

/**
 * ISS-NEW-F 第 3 步（2026-06-24）步 3：新窗口 mount 时尝试恢复源窗口拖离的 tab。
 *
 * 流程：
 * 1. 读 localStorage `faropdf:pending-detach`；命中即尝试恢复
 * 2. 调 Rust `read_pdf_file_from_path` 拿 bytes（避免在 localStorage 存大对象）
 * 3. 调 `tabStore.openTab` 在新窗口的 tab store 注册该 tab（沿用源 filePath / fileName）
 * 4. 调 `reader.openNativeFile` 加载文档，load 完成后调 `reader.setCurrentPage(lastPage)` 跳页
 * 5. 完成后清掉 localStorage key（无论成功失败），避免下次启动误恢复
 *
 * 实现位置：作为 TabProvider 子节点，确保能调 `useTabStore()`。
 * 仅运行一次（restoredRef 守卫 + React StrictMode 双调用安全）。
 */
export function PendingDetachRestore({ reader }: { reader: ReaderController }): null {
  const tabStore = useTabStore();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) {
      return;
    }
    restoredRef.current = true;

    let raw: string | null;
    try {
      raw = window.localStorage.getItem(PENDING_DETACH_STORAGE_KEY);
    } catch (error) {
      console.error("[ISS-NEW-F] localStorage read failed:", error);
      return;
    }

    if (!raw) {
      return;
    }

    let payload: PendingDetachPayload;
    try {
      const parsed = JSON.parse(raw) as Partial<PendingDetachPayload>;
      if (
        typeof parsed.filePath !== "string" ||
        typeof parsed.fileName !== "string" ||
        typeof parsed.lastPage !== "number" ||
        !Number.isInteger(parsed.lastPage) ||
        parsed.lastPage < 1
      ) {
        console.error("[ISS-NEW-F] pending-detach payload 字段缺失或类型错误", parsed);
        window.localStorage.removeItem(PENDING_DETACH_STORAGE_KEY);
        return;
      }
      payload = {
        filePath: parsed.filePath,
        fileName: parsed.fileName,
        lastPage: parsed.lastPage,
      };
    } catch (error) {
      console.error("[ISS-NEW-F] pending-detach JSON 解析失败:", error);
      window.localStorage.removeItem(PENDING_DETACH_STORAGE_KEY);
      return;
    }

    const { filePath, fileName, lastPage } = payload;
    tabStore.openTab(filePath, fileName);

    void readPdfFileFromPath(filePath)
      .then((file) => reader.openNativeFile(file).then(() => reader.setCurrentPage(lastPage)))
      .catch((error: unknown) => {
        // ISS-NEW-M M5：Tauri 读文件失败（权限不足 / 文件不存在等）走归一化中文错误态，
        // 不再只 console.error。Rust 返回 AppError（含 code），normalizeError 识别后
        // friendlyMessageForCode 按 code（PermissionDenied/FileNotFound/...）给中文文案。
        console.error("[ISS-NEW-F] pending-detach restore failed:", error);
        reader.reportOpenError(friendlyMessageForCode(normalizeError(error)));
      })
      .finally(() => {
        try {
          window.localStorage.removeItem(PENDING_DETACH_STORAGE_KEY);
        } catch (error) {
          console.error("[ISS-NEW-F] localStorage cleanup failed:", error);
        }
      });
  }, [reader, tabStore]);

  return null;
}

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

  // 批注服务实例：Tauri webview 的 localStorage 持久化 sidecar，键使用路径哈希，
  // 不覆盖原 PDF；localStorage 不可用时才回退到当前会话内存。
  const annotationServiceRef = useRef<AnnotationService | null>(null);

  function getAnnotationService(): AnnotationService {
    if (!annotationServiceRef.current) {
      let storage: AnnotationStorage = createMemoryAnnotationStorage();
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          storage = createLocalStorageAnnotationStorage(window.localStorage);
        }
      } catch {
        // 隐私模式或禁用 DOM storage 时保留可用的内存 sidecar。
      }
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
    if (nextMode === "edit") {
      // G05 measured reference shows the outline sidebar alongside the edit canvas.
      // Keep that state explicit instead of inheriting whichever utility panel happened
      // to be open in read/annotate mode.
      setUtilityPanel("summary");
    } else if (nextMode === "pages") {
      setUtilityPanel("none");
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
          .catch((error: unknown) => {
            // ISS-NEW-M M5：选文件对话框 / 读文件失败（权限不足 / 文件不存在等）走归一化
            // 中文错误态，不再吞掉。用户取消对话框（无错误）不会进 catch。
            readerRef.current.reportOpenError(friendlyMessageForCode(normalizeError(error)));
          });
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

  // ISS-QA-01：系统 Finder 拖入 PDF 打开。
  // Tauri v2 webview 中系统文件拖拽不进入 HTML5 `dataTransfer.files`，故由 Rust 监听
  // `WindowEvent::DragDrop`（过滤首个 `.pdf`）emit `faropdf://file-drop`（payload { path }）。
  // 这里顶层 listen，取 path → readPdfFileFromPath（路径→bytes）→ reader.openNativeFile。
  // tab 注册由 AppShell 监听 reader.state.document 的 effect 自动处理，无需此处 openTab。
  // HTML5 onDrop（ReaderCanvas/WelcomeScreen/ReaderErrorScreen）保留作 web 降级，不动。
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<{ path: string }>("faropdf://file-drop", (event) => {
      const path = event.payload?.path;
      if (!path) {
        return;
      }
      void readPdfFileFromPath(path)
        .then((file) => {
          void readerRef.current.openNativeFile(file);
        })
        .catch((error: unknown) => {
          // 与 native-menu file-open 同：读文件失败（权限不足/不存在/损坏）走归一化中文错误态。
          readerRef.current.reportOpenError(friendlyMessageForCode(normalizeError(error)));
        });
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
      } else {
        unlisten = nextUnlisten;
      }
    }).catch(() => undefined);
    // ^ 非 Tauri 运行时（浏览器 dev / vitest jsdom）无 __TAURI_INTERNALS__，
    //   listen 会 reject（transformCallback undefined）——静默降级到 HTML5
    //   onDrop（上方注释的 web 降级路径），不留 unhandled rejection 噪音。

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

  // 侧栏删除批注（ISS-QA-22，2026-08-15）：service.deleteAnnotation + 列表刷新。
  const handleDeleteAnnotation = useCallback(
    (annotationId: string) => {
      const document = reader.state.document;
      if (!document) {
        return;
      }
      const service = getAnnotationService();
      void service
        .deleteAnnotation(
          { path: document.path, fingerprint: document.fingerprint, pageCount: document.pageCount },
          annotationId,
        )
        .then((ok) => {
          if (ok) {
            setLoadedAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
          }
        })
        .catch(() => undefined);
    },
    [reader.state.document],
  );

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
            ...(input.opacity !== undefined ? { opacity: input.opacity } : {}),
            ...(input.style ? { style: input.style } : {}),
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
      <PendingDetachRestore reader={reader} />
      <ActiveTabPageSync reader={reader} />
      <AppShell
        activeMode={activeMode}
        annotationArmed={{ state: annotationToolState, onStateChange: setAnnotationToolState }}
        annotations={loadedAnnotations}
        commandSignal={commandSignal}
        ocr={ocrController}
        onAnnotationDraft={handleAnnotationDraft}
        onDeleteAnnotation={handleDeleteAnnotation}
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
