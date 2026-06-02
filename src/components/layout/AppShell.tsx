import type { AppSettings } from "../../shared";
import type { ReaderController } from "../../modules/reader";
import { ReaderCanvas } from "./ReaderCanvas";
import { DocumentSummaryPanel, ViewSettingsPanel } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { SettingsPanel } from "../../modules/settings/SettingsPanel";
import type { AppModeId, UtilityPanelId } from "./types";

interface AppShellProps {
  activeMode: AppModeId;
  onModeChange: (mode: AppModeId) => void;
  onUtilityPanelChange: (panel: UtilityPanelId) => void;
  reader: ReaderController;
  settings: AppSettings;
  utilityPanel: UtilityPanelId;
}

const contextualTools: Partial<Record<Exclude<AppModeId, "read" | "pages">, string[]>> = {
  annotate: ["高亮", "下划线", "删除线", "笔", "橡皮擦", "文本", "形状", "笔记", "图章", "签名", "内容选定", "裁剪"],
  forms: ["文本", "签名", "日期", "钩号", "叉号", "图章", "图像", "导出为压平"],
  ocr: ["增强扫描", "拆分页面", "裁剪页面", "清除空白边", "识别文本", "内容选定", "裁剪"],
};

const exportToolGroups = [
  {
    label: "格式转换",
    tools: ["转成 Word", "转成 Excel", "转成 PowerPoint", "转成文本", "转成图片"],
  },
  {
    label: "交付工具",
    tools: ["文字水印", "图片水印", "页码", "Bates 编号", "压缩", "批注摘要"],
  },
];

const contextualToolbarLabels: Record<Exclude<AppModeId, "read" | "pages">, string> = {
  annotate: "批注工具条",
  export: "导出工具条",
  forms: "填写和签名工具条",
  ocr: "OCR 工具条",
};

export function AppShell({
  activeMode,
  onModeChange,
  onUtilityPanelChange,
  reader,
  settings,
  utilityPanel,
}: AppShellProps) {
  const showContextToolbar = activeMode !== "read" && activeMode !== "pages";
  const showUtilityPanel = utilityPanel !== "none" && activeMode !== "pages";

  return (
    <div className="app-shell" role="application" aria-label="FaroPDF PDF 工作台">
      <Toolbar
        activeMode={activeMode}
        onModeChange={onModeChange}
        onUtilityPanelChange={onUtilityPanelChange}
        reader={reader}
        utilityPanel={utilityPanel}
      />
      {showContextToolbar ? <ContextToolbar mode={activeMode} /> : null}
      <div className={showUtilityPanel ? "workspace" : "workspace workspace--full"}>
        {showUtilityPanel ? <UtilityPanel panel={utilityPanel} settings={settings} /> : null}
        {activeMode === "pages" ? (
          <PageOrganizerWorkspace reader={reader} />
        ) : (
          <ReaderCanvas onOpenFile={reader.openFile} readerState={reader.state} />
        )}
      </div>
      <StatusBar readerState={reader.state} />
    </div>
  );
}

function UtilityPanel({ panel, settings }: { panel: Exclude<UtilityPanelId, "none">; settings: AppSettings }) {
  if (panel === "view") {
    return <ViewSettingsPanel />;
  }

  if (panel === "settings") {
    return (
      <aside className="utility-panel utility-panel--settings" aria-label="设置面板">
        <SettingsPanel settings={settings} />
      </aside>
    );
  }

  return <DocumentSummaryPanel />;
}

function ContextToolbar({ mode }: { mode: Exclude<AppModeId, "read" | "pages"> }) {
  if (mode === "export") {
    return (
      <div className="context-toolbar context-toolbar--grouped" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
        {exportToolGroups.map((group) => (
          <div className="context-tool-group" role="group" aria-label={group.label} key={group.label}>
            <span>{group.label}</span>
            {group.tools.map((tool) => (
              <button className="context-tool" key={tool} type="button">
                {tool}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="context-toolbar" role="toolbar" aria-label={contextualToolbarLabels[mode]}>
      {contextualTools[mode]?.map((tool) => (
        <button className="context-tool" key={tool} type="button">
          {tool}
        </button>
      ))}
    </div>
  );
}

function PageOrganizerWorkspace({ reader }: { reader: ReaderController }) {
  const pageCount = reader.state.document?.pageCount ?? 5;
  const pages = Array.from({ length: Math.min(pageCount, 12) }, (_, index) => index + 1);

  return (
    <main className="page-organizer" aria-label="页面管理工作台">
      <div className="page-organizer__toolbar" role="toolbar" aria-label="页面管理工具条">
        {["插入页", "附加文件", "旋转", "复制", "粘贴", "摘录", "删除"].map((action) => (
          <button className="context-tool" disabled={action === "粘贴"} key={action} type="button">
            {action}
          </button>
        ))}
        <button className="context-tool context-tool--primary" type="button">
          另存为新 PDF
        </button>
      </div>
      <ol className="page-grid" aria-label="页面网格">
        {pages.map((page) => (
          <li className="page-card" key={page}>
            <div className="page-card__sheet" aria-hidden="true" />
            <span>第 {page} 页</span>
            <small>A4 (210 x 297 毫米)</small>
          </li>
        ))}
      </ol>
    </main>
  );
}
