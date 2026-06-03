import type { ComponentType } from "react";
import type { ReaderController } from "../../modules/reader";
import type { TextSearchController } from "../../modules/search";
import type { AppModeId } from "./types";

export interface ToolbarState {
  activeMode: AppModeId;
  reader: ReaderController;
  search: TextSearchController;
}

export interface ToolbarToolItem {
  id: string;
  modeId: AppModeId;
  order: number;
  icon: ComponentType<{ size?: number }>;
  label: string;
  isActive: (state: ToolbarState) => boolean;
  onClick: (state: ToolbarState) => void;
  isDisabled?: (state: ToolbarState) => boolean;
}

const registry = new Map<AppModeId, ToolbarToolItem[]>();

export function registerModeTools(modeId: AppModeId, items: ToolbarToolItem[]): void {
  const existing = registry.get(modeId) ?? [];
  registry.set(modeId, [...existing, ...items]);
}

export function getModeTools(modeId: AppModeId): ToolbarToolItem[] {
  return registry.get(modeId) ?? [];
}

export function _resetToolbarRegistry(): void {
  registry.clear();
}
