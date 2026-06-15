import { useId } from "react";
import type { AppModeId, RightPanelId } from "./types";

/**
 * ISS-060：右栏模式驱动面板（v0.2 候选）。
 *
 * 当前为 skeleton：只按 activeMode / rightPanel 切换标题与占位提示，
 * 等后续 ISS 把各 mode 的 right-panel 真实内容接入：
 * - annotate 模式 → 图章 / 签名的选中态面板
 * - export 模式 → 导出任务预览
 * - ocr 模式 → OCR 任务队列
 * - forms 模式 → 字段 / 签名区列表（v0.1 留空）
 * - read 模式 → 折叠
 */
export interface RightPanelProps {
  activeMode: AppModeId;
  rightPanel: RightPanelId;
}

interface PanelDescriptor {
  title: string;
  hint: string;
}

const PANELS_BY_MODE: Record<AppModeId, Record<Exclude<RightPanelId, "none">, PanelDescriptor>> = {
  annotate: {
    stamps: { title: "图章", hint: "在批注侧栏选 stamp 后回到画布点按" },
    signatures: { title: "签名", hint: "签名模板将作为 PDF 资源加载" },
    "export-preview": { title: "导出预览", hint: "在导出模式下，右栏展示导出文件预览" },
    "ocr-queue": { title: "OCR 队列", hint: "OCR 模式不进入批注流程" },
  },
  export: {
    stamps: { title: "图章", hint: "在导出过程中复用已保存的图章模板" },
    signatures: { title: "签名", hint: "导入或选择签名图作为导出附加" },
    "export-preview": { title: "导出预览", hint: "v0.2 落地的导出 PDF 实时预览" },
    "ocr-queue": { title: "OCR 队列", hint: "导出模式下不需要 OCR 队列" },
  },
  forms: {
    stamps: { title: "图章", hint: "在表单填充后加盖业务图章" },
    signatures: { title: "签名", hint: "可直接拖入签名 PNG 到签名区" },
    "export-preview": { title: "导出预览", hint: "表单填写 + 扁平的合并预览" },
    "ocr-queue": { title: "OCR 队列", hint: "扫描表单可走 OCR 后再补填" },
  },
  ocr: {
    stamps: { title: "图章", hint: "OCR 完成后可对识别结果盖戳" },
    signatures: { title: "签名", hint: "OCR 后用签名手签批注" },
    "export-preview": { title: "导出预览", hint: "OCR 报告导出预览" },
    "ocr-queue": { title: "OCR 队列", hint: "v0.2 接入：显示任务列表 / 进度 / 报告跳转" },
  },
  read: {
    stamps: { title: "图章", hint: "阅读态不活跃，右栏折叠" },
    signatures: { title: "签名", hint: "阅读态不活跃" },
    "export-preview": { title: "导出预览", hint: "阅读态不活跃" },
    "ocr-queue": { title: "OCR 队列", hint: "阅读态不活跃" },
  },
  pages: {
    stamps: { title: "图章", hint: "页面管理态不显示右栏" },
    signatures: { title: "签名", hint: "页面管理态不显示右栏" },
    "export-preview": { title: "导出预览", hint: "页面管理态不显示右栏" },
    "ocr-queue": { title: "OCR 队列", hint: "页面管理态不显示右栏" },
  },
};

const READ_INACTIVE_IDS: ReadonlyArray<RightPanelId> = ["stamps", "signatures", "export-preview", "ocr-queue"];

export function RightPanel({ activeMode, rightPanel }: RightPanelProps) {
  const headingId = useId();

  if (activeMode === "read" || activeMode === "pages") {
    if (rightPanel === "none" || READ_INACTIVE_IDS.includes(rightPanel)) {
      return null;
    }
  }

  const descriptor = PANELS_BY_MODE[activeMode]?.[rightPanel as Exclude<RightPanelId, "none">];
  const title = descriptor?.title ?? "右栏";
  const hint = descriptor?.hint ?? "v0.2 候选";

  return (
    <aside aria-labelledby={headingId} className="right-pane" data-active-mode={activeMode} data-panel={rightPanel}>
      <header className="right-pane__header">
        <h2 id={headingId} className="right-pane__title">{title}</h2>
        <span aria-hidden="true" className="right-pane__mode-pill">{activeMode}</span>
      </header>
      <div className="right-pane__body" data-testid="right-pane-body">
        <p className="right-pane__hint">{hint}</p>
        <p className="right-pane__placeholder" data-testid="right-pane-placeholder">
          （v0.1 skeleton — 真实内容将在后续 ISS 中接入。）
        </p>
      </div>
    </aside>
  );
}
