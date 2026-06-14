import { listen } from "@tauri-apps/api/event";
import { getCommandById, type AppCommandId } from "./commands";

export const NATIVE_MENU_COMMAND_EVENT = "faropdf://command";

interface NativeMenuCommandPayload {
  id?: unknown;
}

export type NativeMenuCommandHandler = (commandId: AppCommandId) => void;

export async function subscribeNativeMenuCommands(handler: NativeMenuCommandHandler): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  return listen<NativeMenuCommandPayload>(NATIVE_MENU_COMMAND_EVENT, (event) => {
    const commandId = parseNativeMenuCommand(event.payload);
    if (commandId) {
      handler(commandId);
    }
  });
}

function parseNativeMenuCommand(payload: NativeMenuCommandPayload): AppCommandId | null {
  if (typeof payload.id !== "string") {
    return null;
  }

  const command = getCommandById(payload.id as AppCommandId);
  if (!command || !command.entryPoints.includes("native-menu")) {
    return null;
  }

  return command.id;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
