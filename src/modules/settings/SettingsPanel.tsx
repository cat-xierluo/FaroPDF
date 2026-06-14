import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exportSafeAppSettings } from "../../shared/settings/defaults";
import type { AppSettings } from "../../shared/settings/types";
import { GeneralSection, SECTION_LIST, type SectionId } from "./sections";
import {
  LazyAboutSection,
  LazyOcrProviderSection,
  LazyReaderSection,
  LazyShortcutSection,
} from "./sections/lazy";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  /** 打开时默认定位到的 section；原生“关于”菜单会直接进入 about。 */
  initialSection?: SectionId;
  /** 是否打开；为 false 时组件不渲染 portal。 */
  open: boolean;
  /** 关闭回调（Esc / 点遮罩 / 点关闭按钮）。 */
  onClose: () => void;
  /** 当前 AppSettings；面板不会在内部维护草稿，变更即向上传播。 */
  settings: AppSettings;
  /** 变更回调：参数为 exportSafe 后的 AppSettings。 */
  onSettingsChange?: (settings: AppSettings) => void;
}

const NARROW_BREAKPOINT = 768;

/**
 * 设置浮层：左侧导航 + 右侧内容，通过 createPortal 渲染到 document.body。
 *
 * 设计要点：
 * - 5 个 section（常规 / 阅读 / OCR provider / 快捷键 / 关于）由 sections/ 子模块提供；
 * - Esc 与点遮罩关闭；
 * - 打开时把焦点送到关闭按钮，便于键盘用户；
 * - 窄屏（< NARROW_BREAKPOINT）时左侧导航折叠为顶部 tab。
 */
export function SettingsPanel({ initialSection = "general", open, onClose, settings, onSettingsChange }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < NARROW_BREAKPOINT,
  );
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 每次打开或外部入口变化时，定位到对应 section。
  useEffect(() => {
    if (open) {
      setActiveSection(initialSection);
    }
  }, [initialSection, open]);

  // 每次打开时恢复 / 抢占焦点。
  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    // portal 挂载后 useEffect 同步触发，ref 已可用；直接 focus 即可。
    closeButtonRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // 监听窗口宽度，窄屏自动切换为顶部 tab 形式
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    setIsNarrow(mediaQuery.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Esc 关闭
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleChange(next: AppSettings) {
    onSettingsChange?.(exportSafeAppSettings(next));
  }

  const activeSectionDescriptor = SECTION_LIST.find((section) => section.id === activeSection) ?? SECTION_LIST[0];

  return createPortal(
    <div
      aria-label="设置对话框"
      aria-modal="true"
      className="settings-overlay"
      data-testid="settings-overlay"
      role="dialog"
    >
      <button
        aria-label="关闭"
        className="settings-overlay__backdrop"
        data-testid="settings-backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="settings-overlay__panel" data-testid="settings-panel" data-view={isNarrow ? "narrow" : "wide"}>
        <header className="settings-overlay__header">
          <h1 className="settings-overlay__title">设置</h1>
          <button
            aria-label="关闭设置"
            className="settings-overlay__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>

        {isNarrow ? (
          <nav aria-label="设置分类（顶部 tab）" className="settings-overlay__topnav" role="tablist">
            {SECTION_LIST.map((section) => (
              <button
                aria-selected={activeSection === section.id}
                className="settings-overlay__topnav-item"
                data-active={activeSection === section.id}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                role="tab"
                type="button"
              >
                {section.label}
              </button>
            ))}
          </nav>
        ) : (
          <nav aria-label="设置分类" className="settings-overlay__nav" role="tablist">
            {SECTION_LIST.map((section) => (
              <button
                aria-selected={activeSection === section.id}
                className="settings-overlay__nav-item"
                data-active={activeSection === section.id}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                role="tab"
                type="button"
              >
                {section.label}
              </button>
            ))}
          </nav>
        )}

        <section
          aria-label={activeSectionDescriptor.label}
          className="settings-overlay__content"
          key={activeSectionDescriptor.id}
          role="tabpanel"
        >
          {activeSectionDescriptor.id === "general" ? (
            <GeneralSection onChange={handleChange} settings={settings} />
          ) : null}
          {activeSectionDescriptor.id === "reader" ? (
            <Suspense fallback={<div className="settings-section-skeleton" />}>
              <LazyReaderSection onChange={handleChange} settings={settings} />
            </Suspense>
          ) : null}
          {activeSectionDescriptor.id === "ocr" ? (
            <Suspense fallback={<div className="settings-section-skeleton" />}>
              <LazyOcrProviderSection onChange={handleChange} settings={settings} />
            </Suspense>
          ) : null}
          {activeSectionDescriptor.id === "shortcuts" ? (
            <Suspense fallback={<div className="settings-section-skeleton" />}>
              <LazyShortcutSection onChange={handleChange} settings={settings} />
            </Suspense>
          ) : null}
          {activeSectionDescriptor.id === "about" ? (
            <Suspense fallback={<div className="settings-section-skeleton" />}>
              <LazyAboutSection onChange={handleChange} settings={settings} />
            </Suspense>
          ) : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}
