import { describe, expect, test } from "vitest";
import { resolveWorkspaceLayout } from "./workspaceLayout";

const widths = { leftWidth: 290, rightWidth: 320 };

describe("resolveWorkspaceLayout", () => {
  test("无侧栏时中央区独占唯一弹性列", () => {
    expect(resolveWorkspaceLayout({ ...widths, showLeftPanel: false, showRightPanel: false })).toEqual({
      id: "main-only",
      gridTemplateColumns: "minmax(0, 1fr)",
    });
  });

  test("只有左栏时顺序为 left → main", () => {
    expect(resolveWorkspaceLayout({ ...widths, showLeftPanel: true, showRightPanel: false })).toEqual({
      id: "left-main",
      gridTemplateColumns: "290px minmax(0, 1fr)",
    });
  });

  test("只有右栏时顺序为 main → right", () => {
    expect(resolveWorkspaceLayout({ ...widths, showLeftPanel: false, showRightPanel: true })).toEqual({
      id: "main-right",
      gridTemplateColumns: "minmax(0, 1fr) 320px",
    });
  });

  test("双栏时中央区保持在 left 与 right 之间", () => {
    expect(resolveWorkspaceLayout({ ...widths, showLeftPanel: true, showRightPanel: true })).toEqual({
      id: "left-main-right",
      gridTemplateColumns: "290px minmax(0, 1fr) 320px",
    });
  });
});
