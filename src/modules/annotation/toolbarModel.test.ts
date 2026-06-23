import { describe, expect, test } from "vitest";
import {
  ANNOTATION_TOOL_LIST,
  ANNOTATION_TOOL_MAP,
  DEFAULT_ANNOTATION_COLOR,
  armAnnotationTool,
  createInitialAnnotationToolState,
  disarmAnnotationTool,
  setAnnotationColor,
  setAnnotationStampLabel,
  setAnnotationStampName,
} from "./toolbarModel";

describe("annotation toolbar model", () => {
  test("ANNOTATION_TOOL_LIST 列出 12 种工具（ISS-NEW-D 阶段 3 加 ellipse / double-arrow / line）", () => {
    expect(ANNOTATION_TOOL_LIST.map((tool) => tool.type)).toEqual([
      "highlight",
      "underline",
      "strikeout",
      "note",
      "textbox",
      "rectangle",
      "ellipse",
      "arrow",
      "double-arrow",
      "line",
      "ink",
      "stamp",
    ]);
  });

  test("ANNOTATION_TOOL_MAP 索引所有工具", () => {
    for (const tool of ANNOTATION_TOOL_LIST) {
      expect(ANNOTATION_TOOL_MAP[tool.type]).toBe(tool);
    }
  });

  test("createInitialAnnotationToolState 默认无工具，黄色色板，已阅图章", () => {
    const initial = createInitialAnnotationToolState();
    expect(initial.activeToolType).toBeNull();
    expect(initial.color).toBe(DEFAULT_ANNOTATION_COLOR);
    expect(initial.stampName).toBe("reviewed");
    expect(initial.stampLabel.length).toBeGreaterThan(0);
  });

  test("armAnnotationTool 切换 armed 状态，再点同工具就 disarm", () => {
    const initial = createInitialAnnotationToolState();
    const armed = armAnnotationTool(initial, "highlight");
    expect(armed.activeToolType).toBe("highlight");

    const disarmed = armAnnotationTool(armed, "highlight");
    expect(disarmed.activeToolType).toBeNull();
  });

  test("armAnnotationTool 在切换到 stamp 工具时回填默认 stampLabel", () => {
    const initial = createInitialAnnotationToolState();
    const armed = armAnnotationTool(initial, "stamp");
    expect(armed.activeToolType).toBe("stamp");
    expect(armed.stampLabel).toBe("已阅");
  });

  test("disarmAnnotationTool 总是清空 activeToolType", () => {
    const initial = armAnnotationTool(createInitialAnnotationToolState(), "ink");
    expect(initial.activeToolType).toBe("ink");
    expect(disarmAnnotationTool(initial).activeToolType).toBeNull();
  });

  test("setAnnotationColor / setAnnotationStampName / setAnnotationStampLabel 互不干扰", () => {
    const initial = createInitialAnnotationToolState();

    const recolored = setAnnotationColor(initial, "#2f80ed");
    expect(recolored.color).toBe("#2f80ed");

    const stampChanged = setAnnotationStampName(initial, "important");
    expect(stampChanged.stampName).toBe("important");
    expect(stampChanged.stampLabel).toBe("重点");

    const stampLabelChanged = setAnnotationStampLabel(initial, "再核实");
    expect(stampLabelChanged.stampLabel).toBe("再核实");
    expect(stampLabelChanged.stampName).toBe(initial.stampName);
  });
});
