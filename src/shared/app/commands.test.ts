import { describe, expect, test } from "vitest";
import {
  APP_COMMANDS,
  getCommandById,
  getCommandsByLayer,
  getNativeMenuCommands,
  getTertiaryCommands,
  getToolLauncherSections,
  type AppCommandId,
} from "./commands";

describe("app command catalog", () => {
  test("keeps command ids unique", () => {
    const ids = APP_COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps low-frequency delivery tools out of the primary toolbar layer", () => {
    const primaryIds = getCommandsByLayer("primary").map((command) => command.id);
    expect(primaryIds).not.toContain("export-bates");
    expect(primaryIds).not.toContain("export-page-number");
    expect(primaryIds).not.toContain("export-header-footer");
    expect(primaryIds).not.toContain("export-compress");
    expect(primaryIds).not.toContain("annotations-flatten");
    expect(primaryIds).not.toContain("forms-flatten");
  });

  test("keeps workflow mode switches out of the top toolbar entry point", () => {
    const workflowModeIds: AppCommandId[] = ["mode-annotate", "mode-export", "mode-forms", "mode-ocr"];

    for (const id of workflowModeIds) {
      const command = getCommandById(id);
      expect(command?.entryPoints).not.toContain("toolbar");
      expect(command?.entryPoints).toContain("more-menu");
    }
  });

  test("exposes low-frequency tools as tertiary commands", () => {
    const tertiaryIds = getTertiaryCommands().map((command) => command.id);
    expect(tertiaryIds).toEqual(expect.arrayContaining<AppCommandId>([
      "export-bates",
      "export-page-number",
      "export-header-footer",
      "export-compress",
      "annotations-flatten",
      "forms-flatten",
    ]));
  });

  test("marks document-bound commands explicitly", () => {
    expect(getCommandById("file-open")?.requiresDocument).toBe(false);
    expect(getCommandById("export-bates")?.requiresDocument).toBe(true);
    expect(getCommandById("annotations-flatten")?.requiresDocument).toBe(true);
    expect(getCommandById("forms-flatten")?.requiresDocument).toBe(true);
    expect(getCommandById("view-summary")?.requiresDocument).toBe(false);
  });

  test("routes annotation flattening to annotate mode utility panel", () => {
    const command = getCommandById("annotations-flatten");
    expect(command?.targetMode).toBe("annotate");
    expect(command?.targetUtilityPanel).toBe("annotation");
    expect(command?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
  });

  test("routes form flattening to the forms mode utility panel", () => {
    const command = getCommandById("forms-flatten");
    expect(command?.targetMode).toBe("forms");
    expect(command?.targetUtilityPanel).toBe("forms");
    expect(command?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
  });

  test("routes annotation summary to the annotation sidebar instead of the export panel", () => {
    const command = getCommandById("export-annotation-summary");
    expect(command?.group).toBe("annotation");
    expect(command?.targetMode).toBe("annotate");
    expect(command?.targetUtilityPanel).toBe("annotation");
    expect(command?.entryPoints).toEqual(expect.arrayContaining(["more-menu"]));
  });

  test("does not leave Save As as a feedback-only launcher command", () => {
    const command = getCommandById("file-save-as");
    expect(command?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
    expect(command?.feedback).toBeUndefined();
  });

  test("native menu entries are backed by the same command definitions", () => {
    const nativeIds = getNativeMenuCommands().map((command) => command.id);
    expect(nativeIds).toEqual(expect.arrayContaining<AppCommandId>([
      "file-open",
      "file-save-as",
      "view-summary",
      "view-pages",
      "view-settings",
      "export-watermark-text",
      "export-watermark-image",
      "export-page-number",
      "export-bates",
      "export-header-footer",
      "export-compress",
      "annotations-flatten",
      "forms-flatten",
      "help-about",
    ]));
    expect(nativeIds).not.toContain("file-new-window");
    expect(nativeIds).not.toContain("view-fullscreen");
    expect(getCommandById("help-about")?.feedback).toBeUndefined();
    expect(getCommandById("help-about")?.targetUtilityPanel).toBe("settings");
  });

  test("exposes a PDF Expert style tool launcher grouped by workflow", () => {
    const sections = getToolLauncherSections();
    expect(sections.map((section) => section.id)).toEqual([
      "organize",
      "deliver",
      "markup",
      "scan",
    ]);

    const commandIdsBySection = new Map(
      sections.map((section) => [section.id, section.commands.map((command) => command.id)]),
    );

    expect(commandIdsBySection.get("organize")).toEqual(expect.arrayContaining<AppCommandId>([
      "view-pages",
    ]));
    expect(commandIdsBySection.get("deliver")).toEqual(expect.arrayContaining<AppCommandId>([
      "mode-export",
      "file-save-as",
      "export-page-number",
      "export-bates",
      "export-compress",
    ]));
    expect(commandIdsBySection.get("markup")).toEqual(expect.arrayContaining<AppCommandId>([
      "mode-annotate",
      "export-annotation-summary",
      "annotations-flatten",
      "mode-forms",
      "forms-flatten",
    ]));
    expect(commandIdsBySection.get("deliver")).not.toContain("export-annotation-summary");
    expect(commandIdsBySection.get("scan")).toEqual(expect.arrayContaining<AppCommandId>([
      "mode-ocr",
    ]));
  });
});
