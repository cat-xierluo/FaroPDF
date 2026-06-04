import type { AppSettings } from "../../../shared/settings/types";
import type { PdfViewMode } from "../../../shared/pdf/types";
import type { SectionProps } from "./types";

const viewModeLabels: Record<PdfViewMode, string> = {
  continuous: "连续",
  single: "单页",
  double: "双页",
  "fit-width": "适合宽度",
};

interface ReaderSectionProps extends SectionProps {
  onChange: (next: AppSettings) => void;
}

/** 默认缩放的合法范围与 SettingsService.validateAppSettings 保持一致。 */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

/**
 * 「阅读」section：默认缩放 + 默认阅读模式。
 * 仅展示无副作用控件，提交即落 AppSettings 草稿。
 */
export function ReaderSection({ settings, onChange }: ReaderSectionProps) {
  return (
    <section className="settings-section" aria-label="阅读">
      <h2 className="settings-section__title">阅读</h2>
      <p className="settings-section__hint">新打开 PDF 时使用的缩放和阅读模式。</p>

      <label className="settings-field" htmlFor="default-zoom">
        <span>默认缩放（{ZOOM_MIN} – {ZOOM_MAX}）</span>
        <input
          id="default-zoom"
          max={ZOOM_MAX}
          min={ZOOM_MIN}
          onChange={(event) => {
            const parsed = Number(event.currentTarget.value);
            if (Number.isNaN(parsed)) {
              return;
            }
            onChange({ ...settings, defaultZoom: parsed });
          }}
          step="0.05"
          type="number"
          value={settings.defaultZoom}
        />
      </label>

      <label className="settings-field" htmlFor="default-view-mode">
        <span>默认阅读模式</span>
        <select
          id="default-view-mode"
          onChange={(event) =>
            onChange({ ...settings, defaultViewMode: event.currentTarget.value as PdfViewMode })
          }
          value={settings.defaultViewMode}
        >
          {(Object.keys(viewModeLabels) as PdfViewMode[]).map((viewMode) => (
            <option key={viewMode} value={viewMode}>
              {viewModeLabels[viewMode]}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
