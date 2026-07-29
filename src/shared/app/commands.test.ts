import { describe, expect, test } from "vitest";
import {
  APP_COMMANDS,
  APP_TOOL_LAUNCHER_SECTIONS,
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

  test("ISS-064: 设置 / 移除密码命令进入导出模式 + security 面板", () => {
    const setCommand = getCommandById("export-set-password");
    expect(setCommand?.group).toBe("export");
    expect(setCommand?.layer).toBe("tertiary");
    expect(setCommand?.targetMode).toBe("export");
    expect(setCommand?.targetUtilityPanel).toBe("security");
    expect(setCommand?.requiresDocument).toBe(true);
    expect(setCommand?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));

    const removeCommand = getCommandById("export-remove-password");
    expect(removeCommand?.group).toBe("export");
    expect(removeCommand?.layer).toBe("tertiary");
    expect(removeCommand?.targetMode).toBe("export");
    expect(removeCommand?.targetUtilityPanel).toBe("security");
    expect(removeCommand?.requiresDocument).toBe(true);
    expect(removeCommand?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
  });

  test("ISS-067: 涂黑矩形命令进入 annotate 模式 + 标注侧栏", () => {
    const redact = getCommandById("redact-region");
    expect(redact?.group).toBe("annotation");
    expect(redact?.layer).toBe("tertiary");
    expect(redact?.targetMode).toBe("annotate");
    expect(redact?.targetUtilityPanel).toBe("annotation");
    expect(redact?.requiresDocument).toBe(true);
    expect(redact?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
    // 进入「标注填写」分组
    expect(
      APP_TOOL_LAUNCHER_SECTIONS.find((s) => s.id === "markup")?.commandIds.includes("redact-region"),
    ).toBe(true);
  });

  test("ISS-072: 文档属性命令进入 read 模式 + 交付导出分组", () => {
    const props = getCommandById("document-properties");
    expect(props?.group).toBe("export");
    expect(props?.layer).toBe("tertiary");
    expect(props?.targetMode).toBe("read");
    expect(props?.requiresDocument).toBe(true);
    expect(props?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
    // 进入「交付导出」分组
    expect(
      APP_TOOL_LAUNCHER_SECTIONS.find((s) => s.id === "deliver")?.commandIds.includes("document-properties"),
    ).toBe(true);
  });

  test("ISS-069: 自动生成目录命令进入 read 模式 + 交付导出分组", () => {
    const toc = getCommandById("auto-generate-toc");
    expect(toc).toBeDefined();
    expect(toc?.group).toBe("export");
    expect(toc?.layer).toBe("tertiary");
    expect(toc?.targetMode).toBe("read");
    expect(toc?.requiresDocument).toBe(true);
    expect(toc?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
    expect(toc?.label).toBe("自动生成目录");
    // 进入「交付导出」分组
    expect(
      APP_TOOL_LAUNCHER_SECTIONS.find((s) => s.id === "deliver")?.commandIds.includes("auto-generate-toc"),
    ).toBe(true);
  });

  test("ISS-061 阶段 2: 翻译 / 朗读命令进入 annotate + 标注侧栏 + markup 分组", () => {
    const translate = getCommandById("annotation-translate");
    expect(translate?.group).toBe("annotation");
    expect(translate?.targetMode).toBe("annotate");
    expect(translate?.targetUtilityPanel).toBe("annotation");
    expect(translate?.requiresDocument).toBe(true);
    const tts = getCommandById("annotation-tts");
    expect(tts?.group).toBe("annotation");
    expect(tts?.targetMode).toBe("annotate");
    expect(tts?.requiresDocument).toBe(true);
    const markup = APP_TOOL_LAUNCHER_SECTIONS.find((s) => s.id === "markup")?.commandIds ?? [];
    expect(markup).toEqual(expect.arrayContaining(["annotation-translate", "annotation-tts"]));
  });

  test("ISS-070 阶段 3: 手写签名命令进入 forms + markup 分组", () => {
    const sign = getCommandById("forms-sign-handwrite");
    expect(sign?.group).toBe("forms");
    expect(sign?.targetMode).toBe("forms");
    expect(sign?.targetUtilityPanel).toBe("forms");
    expect(sign?.requiresDocument).toBe(true);
    expect(sign?.entryPoints).toEqual(expect.arrayContaining(["more-menu", "native-menu"]));
    const markup = APP_TOOL_LAUNCHER_SECTIONS.find((s) => s.id === "markup")?.commandIds ?? [];
    expect(markup).toContain("forms-sign-handwrite");
  });

  test("PDF 内容编辑五个原生命令统一进入独立 edit mode", () => {
    for (const id of [
      "pdf-edit-content",
      "pdf-add-image",
      "pdf-add-link",
      "pdf-add-text",
      "pdf-redact",
    ] as const) {
      const command = getCommandById(id);
      expect(command?.group).toBe("mode");
      expect(command?.targetMode).toBe("edit");
      expect(command?.requiresDocument).toBe(true);
      expect(command?.entryPoints).toContain("native-menu");
    }
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
      "export-set-password",
      "export-remove-password",
      "annotations-flatten",
      "forms-flatten",
      "help-about",
    ]));
    expect(nativeIds).not.toContain("file-new-window");
    expect(nativeIds).not.toContain("view-fullscreen");
    expect(getCommandById("help-about")?.feedback).toBeUndefined();
    expect(getCommandById("help-about")?.targetUtilityPanel).toBe("settings");
  });

  test("ISS-NEW-H: 视图菜单命令显式区分 ready 与 planned", () => {
    const readyZoomIds: AppCommandId[] = [
      "view-zoom-in",
      "view-zoom-out",
      "view-actual-size",
      "view-fit-page",
    ];
    const thumbnailIds: AppCommandId[] = ["view-thumbnails-single", "view-thumbnails-double"];
    const readyIds: AppCommandId[] = [...readyZoomIds, ...thumbnailIds, "view-go-current-page"];
    const plannedIds: AppCommandId[] = ["view-zoom-tool", "view-reload", "view-add-bookmark"];
    const allNewIds: AppCommandId[] = [...readyIds, ...plannedIds];

    for (const id of allNewIds) {
      const command = getCommandById(id);
      expect(command, `command ${id} must be registered in APP_COMMANDS`).toBeDefined();
      expect(command?.group, `${id} must be in view group`).toBe("view");
      expect(command?.layer, `${id} must be tertiary`).toBe("tertiary");
      expect(command?.entryPoints, `${id} must be native-menu only`).toEqual(["native-menu"]);
      expect(command?.requiresDocument, `${id} requiresDocument`).toBe(true);
    }

    for (const id of readyIds) {
      expect(getCommandById(id)?.feedback, `${id} should not declare feedback`).toBeUndefined();
      expect(getCommandById(id)?.availability, `${id} should default to ready`).not.toBe("planned");
    }

    for (const id of plannedIds) {
      expect(getCommandById(id)?.availability, `${id} must fail closed`).toBe("planned");
    }

    // native-menu 视图命令必须包含全部 10 个新 id（与 lib.rs 视图 SubmenuBuilder 对齐）。
    const nativeIds = getNativeMenuCommands().map((command) => command.id);
    for (const id of allNewIds) {
      expect(nativeIds, `native-menu must expose ${id}`).toContain(id);
    }
  });

  test("ISS-NEW-H: view 顶层菜单 submenu 不污染原有的视图主命令", () => {
    // 现有 view-summary / view-pages / view-settings 仍然是 primary 层（toolbar 入口）。
    for (const id of ["view-summary", "view-pages", "view-settings"] as AppCommandId[]) {
      expect(getCommandById(id)?.layer).toBe("primary");
      expect(getCommandById(id)?.entryPoints).toEqual(expect.arrayContaining(["toolbar"]));
    }
    // 新增 10 个命令都是 tertiary 层（不进 toolbar）。
    for (const id of [
      "view-zoom-in",
      "view-zoom-out",
      "view-actual-size",
      "view-fit-page",
      "view-zoom-tool",
      "view-thumbnails-single",
      "view-thumbnails-double",
      "view-go-current-page",
      "view-reload",
      "view-add-bookmark",
    ] as AppCommandId[]) {
      expect(getCommandById(id)?.layer).toBe("tertiary");
      expect(getCommandById(id)?.entryPoints).not.toContain("toolbar");
    }
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
      "export-set-password",
      "export-remove-password",
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
