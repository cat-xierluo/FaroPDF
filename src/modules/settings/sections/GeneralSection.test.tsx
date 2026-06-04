import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { createDefaultAppSettings } from "../../../shared/settings/defaults";
import type { AppSettings } from "../../../shared/settings/types";
import { GeneralSection } from "./GeneralSection";
import { ControlledHarness } from "./testUtils";

describe("GeneralSection", () => {
  test("renders default save policy and recent files placeholder", () => {
    render(<GeneralSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(screen.getByLabelText("默认保存策略")).toBeInTheDocument();
    expect(screen.getByText("暂无最近文件")).toBeInTheDocument();
  });

  test("emits save policy change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: AppSettings) => void>();
    render(
      <ControlledHarness initial={createDefaultAppSettings()}>
        {(settings, setSettings) => (
          <GeneralSection
            settings={settings}
            onChange={(next) => {
              onChange(next);
              setSettings(next);
            }}
          />
        )}
      </ControlledHarness>,
    );

    await user.selectOptions(screen.getByLabelText("默认保存策略"), "ask-each-time");

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.defaultSavePolicy).toBe("ask-each-time");
  });

  test("commits default save directory on blur and clears on empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(next: AppSettings) => void>();
    render(
      <ControlledHarness initial={createDefaultAppSettings()}>
        {(settings, setSettings) => (
          <GeneralSection
            settings={settings}
            onChange={(next) => {
              onChange(next);
              setSettings(next);
            }}
          />
        )}
      </ControlledHarness>,
    );

    const dirInput = screen.getByLabelText(/默认保存目录/);
    await user.type(dirInput, "/tmp/faropdf");
    await user.tab();
    const lastWithDir = onChange.mock.calls.at(-1)?.[0];
    expect(lastWithDir?.defaultSaveDirectory).toBe("/tmp/faropdf");

    await user.clear(dirInput);
    await user.tab();
    const lastCleared = onChange.mock.calls.at(-1)?.[0];
    expect(lastCleared?.defaultSaveDirectory).toBeUndefined();
  });

  test("lists recent files when present", () => {
    const settings = createDefaultAppSettings();
    settings.recentFiles = [
      { path: "/tmp/a.pdf", name: "案件 A.pdf", lastOpenedAt: "2026-06-04 09:00" },
      { path: "/tmp/b.pdf", name: "卷宗 B.pdf", lastOpenedAt: "2026-06-03 17:30", lastPage: 12 },
    ];
    render(<GeneralSection settings={settings} onChange={() => undefined} />);
    expect(screen.getByText("案件 A.pdf")).toBeInTheDocument();
    expect(screen.getByText("卷宗 B.pdf")).toBeInTheDocument();
    expect(screen.getByText(/第 12 页/)).toBeInTheDocument();
  });
});
