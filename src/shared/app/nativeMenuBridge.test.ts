import { afterEach, describe, expect, test, vi } from "vitest";
import type { AppCommandId } from "./commands";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  mocks.listen.mockReset();
});

describe("native menu bridge", () => {
  test("does not register a listener outside the Tauri runtime", async () => {
    const { subscribeNativeMenuCommands } = await import("./nativeMenuBridge");
    const handler = vi.fn();

    const unlisten = await subscribeNativeMenuCommands(handler);
    unlisten();

    expect(mocks.listen).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  test("forwards only native-menu command ids", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    const { NATIVE_MENU_COMMAND_EVENT, subscribeNativeMenuCommands } = await import("./nativeMenuBridge");
    const unlisten = vi.fn();
    const seen: AppCommandId[] = [];

    mocks.listen.mockImplementation(async (_eventName: string, handler: (event: { payload: { id: string } }) => void) => {
      handler({ payload: { id: "export-bates" } });
      handler({ payload: { id: "mode-export" } });
      handler({ payload: { id: "unknown-command" } });
      return unlisten;
    });

    const cleanup = await subscribeNativeMenuCommands((commandId) => seen.push(commandId));
    cleanup();

    expect(mocks.listen).toHaveBeenCalledWith(NATIVE_MENU_COMMAND_EVENT, expect.any(Function));
    expect(seen).toEqual(["export-bates"]);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
