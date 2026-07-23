export type WorkspacePanelLayout = "main-only" | "left-main" | "main-right" | "left-main-right";

export interface WorkspaceLayoutInput {
  leftWidth: number;
  rightWidth: number;
  showLeftPanel: boolean;
  showRightPanel: boolean;
}

export interface WorkspaceLayout {
  gridTemplateColumns: string;
  id: WorkspacePanelLayout;
}

/**
 * L5 workspace 的单一列顺序合同：left (L5a) → main (L5c) → right (L5b)。
 */
export function resolveWorkspaceLayout({
  leftWidth,
  rightWidth,
  showLeftPanel,
  showRightPanel,
}: WorkspaceLayoutInput): WorkspaceLayout {
  if (showLeftPanel && showRightPanel) {
    return {
      id: "left-main-right",
      gridTemplateColumns: `${leftWidth}px minmax(0, 1fr) ${rightWidth}px`,
    };
  }

  if (showLeftPanel) {
    return {
      id: "left-main",
      gridTemplateColumns: `${leftWidth}px minmax(0, 1fr)`,
    };
  }

  if (showRightPanel) {
    return {
      id: "main-right",
      gridTemplateColumns: `minmax(0, 1fr) ${rightWidth}px`,
    };
  }

  return {
    id: "main-only",
    gridTemplateColumns: "minmax(0, 1fr)",
  };
}
