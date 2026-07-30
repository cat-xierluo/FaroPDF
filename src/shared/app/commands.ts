export type AppCommandLayer = "primary" | "secondary" | "tertiary";

export type AppCommandEntryPoint = "toolbar" | "context-toolbar" | "more-menu" | "native-menu" | "panel";

export type AppCommandGroup =
  | "file"
  | "view"
  | "mode"
  | "annotation"
  | "export"
  | "forms"
  | "ocr"
  | "settings"
  | "help";

export type AppCommandTargetMode = "read" | "annotate" | "edit" | "export" | "forms" | "ocr" | "pages";

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
  | "view-scroll-mode"
  | "view-page-mode"
  | "view-toolbar-toggle"
  | "view-sidebar-toggle"
  | "view-fit-screen"
  | "annotation-highlight"
  | "annotation-underline"
  | "annotation-strikeout"
  | "annotation-text"
  | "annotation-pen"
  | "annotation-eraser"
  | "annotation-note"
  | "annotation-shape-rectangle"
  | "annotation-shape-ellipse"
  | "annotation-shape-arrow"
  | "annotation-shape-double-arrow"
  | "annotation-shape-line"
  | "annotation-shape-pen"
  | "annotation-add-link"
  | "annotation-outline"
  | "annotation-delete"
  | "annotation-delete-all"
  | "annotation-jump-to"
  | "annotation-previous"
  | "annotation-next"
  | "annotation-collapse-all"
  | "annotation-expand-all"
  | "ocr-quality-original"
  | "ocr-quality-standard"
  | "ocr-quality-advanced"
  | "ocr-quality-custom"
  | "ocr-scan-to-searchable"
  | "ocr-recognize-text"
  | "ocr-make-searchable"
  | "ocr-enhance-all"
  | "pdf-edit-content"
  | "pdf-add-image"
  | "pdf-add-link"
  | "pdf-add-text"
  | "pdf-redact"
  | "go-first-page"
  | "go-last-page"
  | "go-previous-page"
  | "go-next-page"
  | "go-history-1"
  | "go-history-2"
  | "go-history-3"
  | "go-history-4"
  | "go-history-5"
  | "go-back"
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
  /** `planned` 表示命令只保留在功能地图中，执行层必须 fail-closed，不能伪装成已接线。 */
  availability?: "ready" | "planned";
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
    availability: "planned",
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
    description: "把阅读焦点定位到当前激活页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
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
    availability: "planned",
  },
  {
    id: "view-add-bookmark",
    label: "添加书签",
    description: "为当前页添加个人页面书签，并保存到按文档隔离的 sidecar。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  // ISS-NEW-D 阶段 1（2026-06-22）：批注菜单 8 工具 + 形状 submenu 6 形状。
  // 全部 tertiary / native-menu / annotation group，与 macOS 批注 SubmenuBuilder 一一对应。
  // 形状 submenu 项暂为占位（实际形状绘制由 AnnotationOverlay 接 armAnnotationTool）。
  {
    id: "annotation-highlight",
    label: "高亮",
    description: "arm 高亮批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-underline",
    label: "下划线",
    description: "arm 下划线批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-strikeout",
    label: "删除线",
    description: "arm 删除线批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-text",
    label: "文本",
    description: "arm 文本框批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-pen",
    label: "笔",
    description: "arm 自由笔批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-eraser",
    label: "橡皮擦",
    description: "disarm 当前批注工具（清空 activeToolType）。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: false,
  },
  {
    id: "annotation-note",
    label: "便签",
    description: "arm 便签批注工具。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-rectangle",
    label: "矩形",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-ellipse",
    label: "椭圆",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-arrow",
    label: "箭头",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-double-arrow",
    label: "双向箭头",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-line",
    label: "直线",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "annotation-shape-pen",
    label: "铅笔",
    description: "v0.2 占位：形状绘制由 AnnotationOverlay 接 armAnnotationTool。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  // ISS-NEW-D 阶段 2（2026-06-22）：批注菜单补 9 辅助 command。
  // 全部 v0.2 占位（依赖未实装的 history 栈 / 选中批注栈 / AnnotationSidebar 操作）。
  {
    id: "annotation-add-link",
    label: "链接",
    description: "v0.2 占位：在选中文本区域添加超链接。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-outline",
    label: "内容表",
    description: "v0.2 占位：打开 PDF 内容表（outline / bookmarks）。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-delete",
    label: "删除",
    description: "v0.2 占位：删除当前选中的批注。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-delete-all",
    label: "删除全部",
    description: "v0.2 占位：删除当前 PDF 所有批注。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-jump-to",
    label: "跳到批注",
    description: "v0.2 占位：跳到当前选中的批注。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-previous",
    label: "上一项",
    description: "v0.2 占位：跳到上一个批注。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-next",
    label: "下一项",
    description: "v0.2 占位：跳到下一个批注。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-collapse-all",
    label: "全部折叠",
    description: "v0.2 占位：折叠 AnnotationSidebar 列表。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  {
    id: "annotation-expand-all",
    label: "全部展开",
    description: "v0.2 占位：展开 AnnotationSidebar 列表。",
    layer: "tertiary",
    group: "annotation",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  // ISS-NEW-D 阶段 1（2026-06-22）：扫描菜单 4 档质量 submenu + 4 顶层动作。
  // 全部 tertiary / native-menu / ocr group，menu event handler 走 ocr 模式 entry point。
  {
    id: "ocr-quality-original",
    label: "原始",
    description: "OCR 质量档：原始（保留原图）。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-quality-standard",
    label: "标准",
    description: "OCR 质量档：标准。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-quality-advanced",
    label: "高级",
    description: "OCR 质量档：高级。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-quality-custom",
    label: "自定义",
    description: "OCR 质量档：自定义。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-scan-to-searchable",
    label: "扫描至可搜索",
    description: "v0.2 占位：调用 ocr.scanToSearchable()，由 OCR 控制器实现。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-recognize-text",
    label: "OCR 文字",
    description: "v0.2 占位：调用 ocr.recognizeText()，由 OCR 控制器实现。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-make-searchable",
    label: "调整为可搜索",
    description: "v0.2 占位：调用 ocr.makeSearchable()，由 OCR 控制器实现。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "ocr-enhance-all",
    label: "增强所有扫描页",
    description: "v0.2 占位：对当前 PDF 所有扫描页一次性跑增强 + OCR。",
    layer: "tertiary",
    group: "ocr",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    availability: "planned",
  },
  // ISS-NEW-D 阶段 1（2026-06-22）：编辑 PDF 菜单 5 动作。
  // 全部 tertiary / native-menu / edit mode，真实 PDF 内容编辑由后续阶段接入。
  {
    id: "pdf-edit-content",
    label: "编辑",
    description: "v0.2 占位：直接编辑 PDF 文字 / 图像内容。",
    layer: "tertiary",
    group: "mode",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    targetMode: "edit",
    availability: "planned",
  },
  {
    id: "pdf-add-image",
    label: "添加图像",
    description: "v0.2 占位：在 PDF 当前页插入外部图像。",
    layer: "tertiary",
    group: "mode",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    targetMode: "edit",
    availability: "planned",
  },
  {
    id: "pdf-add-link",
    label: "添加链接",
    description: "v0.2 占位：在 PDF 选中区域添加超链接。",
    layer: "tertiary",
    group: "mode",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    targetMode: "edit",
    availability: "planned",
  },
  {
    id: "pdf-add-text",
    label: "添加文字",
    description: "v0.2 占位：在 PDF 当前页插入文本框。",
    layer: "tertiary",
    group: "mode",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    targetMode: "edit",
    availability: "planned",
  },
  {
    id: "pdf-redact",
    label: "隐藏",
    description: "v0.2 占位：选中区域涂抹遮蔽（ISS-067 已有遮蔽 UI）。",
    layer: "tertiary",
    group: "mode",
    entryPoints: ["native-menu"],
    requiresDocument: true,
    targetMode: "edit",
    availability: "planned",
  },
  // ISS-NEW-D 阶段 1（2026-06-22）：前往菜单 5 顶层 + 5 历史 submenu 项。
  // 全部 tertiary / native-menu / view group（导航类）。
  {
    id: "go-first-page",
    label: "首页",
    description: "跳到文档第一页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-last-page",
    label: "末页",
    description: "跳到文档最后一页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-previous-page",
    label: "上一页",
    description: "跳到当前页的上一页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-next-page",
    label: "下一页",
    description: "跳到当前页的下一页。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-history-1",
    label: "最近 1",
    description: "v0.2 占位：跳到浏览历史最近 1。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-history-2",
    label: "最近 2",
    description: "v0.2 占位：跳到浏览历史最近 2。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-history-3",
    label: "最近 3",
    description: "v0.2 占位：跳到浏览历史最近 3。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-history-4",
    label: "最近 4",
    description: "v0.2 占位：跳到浏览历史最近 4。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-history-5",
    label: "最近 5",
    description: "v0.2 占位：跳到浏览历史最近 5。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "go-back",
    label: "返回",
    description: "返回上一个浏览位置（浏览历史栈）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  // ISS-NEW-H 第 3 阶段（2026-06-23）：视图菜单 7 项补。
  {
    id: "view-scroll-mode",
    label: "滚动模式",
    description: "把页面视图模式切换为 continuous（滚动）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-page-mode",
    label: "翻页模式",
    description: "把页面视图模式切换为 single（翻页）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
  },
  {
    id: "view-toolbar-toggle",
    label: "工具栏",
    description: "v0.2 占位：toggle L2/L3 工具条显示（ISS-NEW-A 5 段架构 + TitlebarTabs）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: false,
    availability: "planned",
  },
  {
    id: "view-sidebar-toggle",
    label: "左侧边栏",
    description: "v0.2 占位：toggle 左侧 utilityPanel（bookmark / summary / view）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: false,
    availability: "planned",
  },
  {
    id: "view-fit-screen",
    label: "适合屏幕",
    description: "把阅读区缩放调整为整页匹配屏幕（fit-page preset）。",
    layer: "tertiary",
    group: "view",
    entryPoints: ["native-menu"],
    requiresDocument: true,
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
    availability: "planned",
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
