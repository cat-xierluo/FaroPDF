import { Maximize2, RotateCcw, RotateCw } from "lucide-react";
import { registerModeTools, type ToolbarToolItem } from "../../components/layout/toolbarRegistry";

/**
 * 阅读模式工具集：通过 toolbarRegistry 注册到 "read" mode，
 * 工具会自动出现在 Toolbar.tsx 的 ModeActiveTools 区域。
 *
 * 缩放 +/-、视图模式切换已经在 Toolbar.tsx 内置，这里只注册
 * 旋转按钮（顺/逆时针）和「适合页面」快捷按钮。
 */
export const READ_MODE_TOOL_IDS = {
  rotateCounterClockwise: "read.rotate.counter-clockwise",
  rotateClockwise: "read.rotate.clockwise",
  fitPage: "read.fit-page",
} as const;

export function registerReadModeTools(): void {
  const items: ToolbarToolItem[] = [
    {
      id: READ_MODE_TOOL_IDS.rotateCounterClockwise,
      icon: RotateCcw,
      isActive: () => false,
      isDisabled: ({ reader }) => !reader.state.document,
      label: "逆时针",
      modeId: "read",
      onClick: ({ reader }) => reader.rotateCounterClockwise(),
      order: 10,
    },
    {
      id: READ_MODE_TOOL_IDS.rotateClockwise,
      icon: RotateCw,
      isActive: () => false,
      isDisabled: ({ reader }) => !reader.state.document,
      label: "顺时针",
      modeId: "read",
      onClick: ({ reader }) => reader.rotateClockwise(),
      order: 11,
    },
    {
      id: READ_MODE_TOOL_IDS.fitPage,
      icon: Maximize2,
      isActive: ({ reader }) => reader.state.document?.viewMode === "single" && reader.state.document.zoom === 1,
      isDisabled: ({ reader }) => !reader.state.document,
      label: "适合页面",
      modeId: "read",
      onClick: ({ reader }) => reader.setZoomPreset("fit-page"),
      order: 20,
    },
  ];
  registerModeTools("read", items);
}
