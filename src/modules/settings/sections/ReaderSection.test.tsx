import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createDefaultAppSettings } from "../../../shared/settings/defaults";
import type { AppSettings } from "../../../shared/settings/types";
import { ReaderSection } from "./ReaderSection";
import { ControlledHarness } from "./testUtils";

describe("ReaderSection", () => {
  test("renders default zoom and view mode controls", () => {
    render(<ReaderSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(screen.getByLabelText(/默认缩放/)).toBeInTheDocument();
    expect(screen.getByLabelText("默认阅读模式")).toBeInTheDocument();
  });

  test("emits zoom change as a number", () => {
    const onChange = vi.fn<(next: AppSettings) => void>();
    render(
      <ControlledHarness initial={createDefaultAppSettings()}>
        {(settings, setSettings) => (
          <ReaderSection
            settings={settings}
            onChange={(next) => {
              onChange(next);
              setSettings(next);
            }}
          />
        )}
      </ControlledHarness>,
    );

    const zoomInput = screen.getByLabelText(/默认缩放/) as HTMLInputElement;
    fireEvent.change(zoomInput, { target: { value: "1.25" } });

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.defaultZoom).toBe(1.25);
  });

  test("emits 0 when zoom input is cleared (number input may treat empty as 0)", () => {
    const onChange = vi.fn<(next: AppSettings) => void>();
    render(
      <ControlledHarness initial={createDefaultAppSettings()}>
        {(settings, setSettings) => (
          <ReaderSection
            settings={settings}
            onChange={(next) => {
              onChange(next);
              setSettings(next);
            }}
          />
        )}
      </ControlledHarness>,
    );

    const zoomInput = screen.getByLabelText(/默认缩放/) as HTMLInputElement;
    fireEvent.change(zoomInput, { target: { value: "" } });
    // 数字输入框清空时浏览器通常返回 0，section 透传该值
    // （SettingsService.validateAppSettings 会在提交时拦截越界值）。
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.defaultZoom).toBe(0);
  });

  test("emits view mode change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: AppSettings) => void>();
    render(
      <ControlledHarness initial={createDefaultAppSettings()}>
        {(settings, setSettings) => (
          <ReaderSection
            settings={settings}
            onChange={(next) => {
              onChange(next);
              setSettings(next);
            }}
          />
        )}
      </ControlledHarness>,
    );

    await user.selectOptions(screen.getByLabelText("默认阅读模式"), "fit-width");

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.defaultViewMode).toBe("fit-width");
  });
});
