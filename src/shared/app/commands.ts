export type AppCommandLayer = "primary" | "secondary" | "tertiary";

export type AppCommandEntryPoint = "toolbar" | "context-toolbar" | "more-menu" | "native-menu" | "panel";

export type AppCommandGroup =
  | "file"
  | "view"
  | "mode"
  | "annotation"
  | "export"
  | "forms"
  | "settings"
  | "help";

export type AppCommandTargetMode = "read" | "annotate" | "export" | "forms" | "ocr" | "pages";

export type AppCommandTargetUtilityPanel =
  | "summary"
  | "view"
  | "settings"
  | "annotation"
  | "forms"
  | "security"
  | "none";

export type AppCommandId =
  | "file-open"
  | "file-save-as"
  | "view-summary"
  | "view-pages"
  | "view-settings"
  | "view-zoom-in"
  | "view-zoom-out"
  | "view-actual-size"
  | "view-fit-page"
  | "view-zoom-tool"
  | "view-thumbnails-single"
  | "view-thumbnails-double"
  | "view-go-current-page"
  | "view-reload"
  | "view-add-bookmark"
  | "settings-open"
  | "mode-annotate"
  | "mode-export"
  | "mode-forms"
  | "mode-ocr"
  | "export-watermark-text"
  | "export-watermark-image"
  | "export-page-number"
  | "export-bates"
  | "export-header-footer"
  | "export-compress"
  | "export-set-password"
  | "export-remove-password"
  | "export-annotation-summary"
  | "annotations-flatten"
  | "forms-flatten"
  | "forms-sign-handwrite"
  | "redact-region"
  | "auto-generate-toc"
  | "annotation-translate"
  | "annotation-tts"
  | "document-properties"
  | "help-about";

export interface AppCommandDefinition {
  id: AppCommandId;
  label: string;
  description?: string;
  layer: AppCommandLayer;
  group: AppCommandGroup;
  entryPoints: ReadonlyArray<AppCommandEntryPoint>;
  requiresDocument: boolean;
  targetMode?: AppCommandTargetMode;
  targetUtilityPanel?: AppCommandTargetUtilityPanel;
  feedback?: string;
}

export type AppToolLauncherSectionId = "organize" | "deliver" | "markup" | "scan";

export interface AppToolLauncherSectionDefinition {
  id: AppToolLauncherSectionId;
  label: string;
  summary: string;
  commandIds: ReadonlyArray<AppCommandId>;
}

export interface AppToolLauncherSection {
  id: AppToolLauncherSectionId;
  label: string;
  summary: string;
  commands: AppCommandDefinition[];
}

export interface AppCommandSignal {
  id: AppCommandId;
  nonce: number;
}

export const APP_COMMANDS: AppCommandDefinition[] = [
  {
    id: "file-open",
    label: "打开",
    layer: "primary",
    group: "file",
    entryPoints: ["toolbar", "native-menu"],
    requiresDocument: false,
  },
  {
    id: "file-save-as",
    label: "另存为",
    description: "保存当前 PDF 的副本，不覆盖原文件。",
    layer: "tertiary",
    group: "file",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-summary",
    label: "文档摘要",
    layer: "primary",
    group: "view",
    entryPoints: ["toolbar", "native-menu"],
    requiresDocument: false,
    targetMode: "read",
    targetUtilityPanel: "summary",
  },
  {
    id: "view-pages",
    label: "页面管理",
    description: "独立页面网格，适合旋转、删除和重排。",
    layer: "primary",
    group: "view",
    entryPoints: ["toolbar", "more-menu", "native-menu"],
    requiresDocument: false,
    targetMode: "pages",
  },
  {
    id: "view-settings",
    label: "视图设置",
    layer: "primary",
    group: "view",
    entryPoints: ["toolbar", "native-menu"],
    requiresDocument: false,
    targetMode: "read",
    targetUtilityPanel: "view",
  },
  // ISS-NEW-H：macOS 视图菜单 submenu 补全（缩放 / 缩略图 / 3 顶层命令）。
  // 当前菜单 id 与 src-tauri/src/lib.rs 视图 SubmenuBuilder 一一对应。
  {
    id: "view-zoom-in",
    label: "放大",
    description: "按 0.1 步进放大阅读区缩放。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-zoom-out",
    label: "缩小",
    description: "按 0.1 步进缩小阅读区缩放。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-actual-size",
    label: "实际大小",
    description: "把阅读区缩放重置为 100%。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-fit-page",
    label: "适合页面",
    description: "应用 fit-page 缩放预设，整页匹配阅读区。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-zoom-tool",
    label: "缩放工具",
    description: "v0.2 占位：复用实际大小命令，后续接入独立工具模式。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-thumbnails-single",
    label: "单列",
    description: "把页面视图模式切换为 single。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-thumbnails-double",
    label: "双列",
    description: "把页面视图模式切换为 double（双页并排）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-go-current-page",
    label: "跳到当前页",
    description: "v0.2 占位：把阅读焦点定位到当前激活页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    feedback: "视图功能开发中，等待后续 worker 接入。",
  },
  {
    id: "view-reload",
    label: "重新载入",
    description: "v0.2 占位：从磁盘重新读取当前 PDF。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    feedback: "视图功能开发中，等待后续 worker 接入。",
  },
  {
    id: "view-add-bookmark",
    label: "添加书签",
    description: "v0.2 占位：在当前页添加书签。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    feedback: "视图功能开发中，等待后续 worker 接入。",
  },
  {
    id: "settings-open",
    label: "设置",
    layer: "primary",
    group: "settings",
    entryPoints: ["toolbar"],
    requiresDocument: false,
    targetMode: "read",
    targetUtilityPanel: "settings",
  },
  {
    id: "mode-annotate",
    label: "批注",
    description: "高亮、备注、图章和批注侧栏。",
    layer: "primary",
    group: "mode",
    entryPoints: ["more-menu"],
    requiresDocument: false,
    targetMode: "annotate",
  },
  {
    id: "mode-export",
    label: "导出",
    description: "水印、压缩、页码和交付导出。",
    layer: "primary",
    group: "mode",
    entryPoints: ["more-menu"],
    requiresDocument: false,
    targetMode: "export",
  },
  {
    id: "mode-forms",
    label: "填写和签名",
    description: "填写字段、签名和表单输出。",
    layer: "primary",
    group: "mode",
    entryPoints: ["more-menu"],
    requiresDocument: false,
    targetMode: "forms",
  },
  {
    id: "mode-ocr",
    label: "OCR",
    description: "扫描件识别和质量检查。",
    layer: "primary",
    group: "mode",
    entryPoints: ["more-menu"],
    requiresDocument: false,
    targetMode: "ocr",
  },
  {
    id: "export-watermark-text",
    label: "文字水印",
    description: "给交付件叠加文字说明。",
    layer: "secondary",
    group: "export",
    entryPoints: ["context-toolbar", "more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
  },
  {
    id: "export-watermark-image",
    label: "图片水印",
    description: "给交付件叠加图片标识。",
    layer: "secondary",
    group: "export",
    entryPoints: ["context-toolbar", "more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
  },
  {
    id: "export-page-number",
    label: "添加页码",
    description: "为副本添加普通页码。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
    feedback: "页码属于导出模式的低频交付工具，进入导出后继续设置位置和样式。",
  },
  {
    id: "export-bates",
    label: "Bates 编号",
    description: "给证据材料添加连续编号。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
    feedback: "Bates 编号属于导出模式的低频交付工具，进入导出后继续设置编号规则。",
  },
  {
    id: "export-header-footer",
    label: "页眉页脚",
    description: "为交付副本添加固定说明。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
    feedback: "页眉页脚属于导出模式的低频交付工具，进入导出后继续设置内容。",
  },
  {
    id: "export-compress",
    label: "压缩",
    description: "按法院上传限制生成轻量副本。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
  },
  {
    id: "export-set-password",
    label: "设置密码",
    description: "为当前 PDF 副本设置用户/拥有者密码，另存 -secured.pdf。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
    targetUtilityPanel: "security",
    feedback: "已打开文档安全面板，请输入拥有者密码并确认。",
  },
  {
    id: "export-remove-password",
    label: "移除密码",
    description: "用原密码解密当前 PDF，另存 -unsecured.pdf。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "export",
    targetUtilityPanel: "security",
    feedback: "已打开文档安全面板，请输入原密码并确认。",
  },
  {
    id: "export-annotation-summary",
    label: "批注摘要",
    description: "导出批注核查清单。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["more-menu"],
    requiresDocument: true,
    targetMode: "annotate",
    targetUtilityPanel: "annotation",
    feedback: "已打开批注摘要，可在侧栏内导出 Markdown / HTML。",
  },
  {
    id: "annotations-flatten",
    label: "批注扁平化",
    description: "把可编辑批注固化到新 PDF 副本。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "annotate",
    targetUtilityPanel: "annotation",
    feedback: "已打开批注侧栏，请在侧栏内确认扁平化导出。",
  },
  {
    id: "forms-flatten",
    label: "表单扁平化",
    description: "把填写内容固化到新 PDF。",
    layer: "tertiary",
    group: "forms",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "forms",
    targetUtilityPanel: "forms",
    feedback: "已进入填写和签名面板，请在面板内读取字段并确认扁平化导出。",
  },
  {
    id: "forms-sign-handwrite",
    label: "手写签名",
    description: "进入表单签名模式，可上传图片或从签名库选历史签名嵌入字段。",
    layer: "tertiary",
    group: "forms",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "forms",
    targetUtilityPanel: "forms",
    feedback: "已进入签名模式，请在侧栏选签名字段后上传或从签名库选择。",
  },
  {
    id: "redact-region",
    label: "涂黑矩形",
    description: "在阅读区拖矩形遮蔽原文（不可恢复，用于证据遮蔽）。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "annotate",
    targetUtilityPanel: "annotation",
    feedback: "已进入涂黑模式，请在阅读区拖出矩形遮蔽区域，点击「应用遮蔽」导出 -redacted.pdf。",
  },
  {
    id: "annotation-translate",
    label: "翻译",
    description: "把选中文本翻译占位写入剪贴板（v0.2 占位，待接入翻译 API）。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "annotate",
    targetUtilityPanel: "annotation",
    feedback: "已进入批注模式，选中文本后点击浮动工具条的「翻译」。",
  },
  {
    id: "annotation-tts",
    label: "朗读",
    description: "用 Web Speech 朗读选中文本。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "annotate",
    targetUtilityPanel: "annotation",
    feedback: "已进入批注模式，选中文本后点击浮动工具条的「朗读」。",
  },
  {
    id: "document-properties",
    label: "文档属性",
    description: "编辑标题 / 作者 / 主题 / 关键词 / 创建日期，输出 *-metadata.pdf 新副本。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "read",
    feedback: "已打开文档属性对话框，请在表单内编辑后保存。",
  },
  {
    id: "auto-generate-toc",
    label: "自动生成目录",
    description: "扫描文字层识别章节，输出 *-auto-toc.pdf 新副本（带 PDF outline）。",
    layer: "tertiary",
    group: "export",
    entryPoints: ["more-menu", "native-menu"],
    requiresDocument: true,
    targetMode: "read",
    feedback: "已打开自动生成目录对话框，请在预览后确认导出。",
  },
  {
    id: "help-about",
    label: "关于 FaroPDF",
    layer: "tertiary",
    group: "help",
    entryPoints: ["native-menu"],
    requiresDocument: false,
    targetMode: "read",
    targetUtilityPanel: "settings",
  },
];

export const APP_TOOL_LAUNCHER_SECTIONS: AppToolLauncherSectionDefinition[] = [
  {
    id: "organize",
    label: "组织页面",
    summary: "页面顺序和证据材料整理。",
    commandIds: ["view-pages"],
  },
  {
    id: "deliver",
    label: "交付导出",
    summary: "另存副本、水印、页眉页脚、页码、证据编号、压缩和密码保护。",
    commandIds: [
      "mode-export",
      "file-save-as",
      "export-watermark-text",
      "export-watermark-image",
      "export-header-footer",
      "export-page-number",
      "export-bates",
      "export-compress",
      "export-set-password",
      "export-remove-password",
      "document-properties",
      "auto-generate-toc",
    ],
  },
  {
    id: "markup",
    label: "标注填写",
    summary: "批注、签名和表单交付。",
    commandIds: ["mode-annotate", "export-annotation-summary", "annotations-flatten", "redact-region", "annotation-translate", "annotation-tts", "mode-forms", "forms-flatten", "forms-sign-handwrite"],
  },
  {
    id: "scan",
    label: "扫描 OCR",
    summary: "扫描件文字识别和质量检查。",
    commandIds: ["mode-ocr"],
  },
];

export function getCommandById(id: AppCommandId): AppCommandDefinition | undefined {
  return APP_COMMANDS.find((command) => command.id === id);
}

export function getCommandsByLayer(layer: AppCommandLayer): AppCommandDefinition[] {
  return APP_COMMANDS.filter((command) => command.layer === layer);
}

export function getTertiaryCommands(): AppCommandDefinition[] {
  return APP_COMMANDS.filter((command) => command.layer === "tertiary" && command.entryPoints.includes("more-menu"));
}

export function getToolLauncherSections(): AppToolLauncherSection[] {
  return APP_TOOL_LAUNCHER_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    summary: section.summary,
    commands: section.commandIds
      .map((id) => getCommandById(id))
      .filter((command): command is AppCommandDefinition => command !== undefined),
  }));
}

export function getNativeMenuCommands(): AppCommandDefinition[] {
  return APP_COMMANDS.filter((command) => command.entryPoints.includes("native-menu"));
}
