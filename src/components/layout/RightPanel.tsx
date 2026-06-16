import { useId } from "react";
import { CustomStampPanel } from "../../modules/annotation/ui/CustomStampPanel";
import type { CustomStamp } from "../../modules/annotation/customStampStore";
import type { AppModeId, RightPanelId } from "./types";

/**
 * ISS-060：右栏模式驱动面板（v0.2）。
 *
 * 阶段 1 是 skeleton 占位；阶段 2（DEC-112）开始把 Wave A 已 ship 的真实模块接入：
 * - annotate + stamps → 渲染 CustomStampPanel（ISS-062 阶段 3 接入）
 * - annotate + signatures → SignaturePad 入口（ISS-070 阶段 2 待启动）
 * - export + export-preview → 导出预览（待启动）
 * - ocr + ocr-queue → OCR 任务队列（v0.2 follow-up）
 * - forms / read / pages → 折叠或简版
 */
export interface RightPanelProps {
  activeMode: AppModeId;
  rightPanel: RightPanelId;
  /** 用户从右栏选中自定义图章时的回调（PM 收口时由 AppShell 注入到 annotationArmed） */
  onSelectCustomStamp?: (stamp: CustomStamp) => void;
}

interface PanelDescriptor {
  title: string;
  hint: string;
}

const PANELS_BY_MODE: Record<AppModeId, Record<Exclude<RightPanelId, "none">, PanelDescriptor>> = {
  annotate: {
    stamps: { title: "图章", hint: "标准 9 个图章在批注工具条；下方自定义图章可上传 PNG / JPG。" },
    signatures: { title: "签名", hint: "签名手写板入口（ISS-070 阶段 2 接入）。" },
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

export function RightPanel({ activeMode, rightPanel, onSelectCustomStamp }: RightPanelProps) {
  const headingId = useId();

  if (activeMode === "read" || activeMode === "pages") {
    if (rightPanel === "none" || READ_INACTIVE_IDS.includes(rightPanel)) {
      return null;
    }
  }

  const descriptor = PANELS_BY_MODE[activeMode]?.[rightPanel as Exclude<RightPanelId, "none">];
  const title = descriptor?.title ?? "右栏";
  const hint = descriptor?.hint ?? "v0.2 候选";

  // annotate 模式 + stamps panel → 直接渲染 CustomStampPanel（DEC-112 第一个真实接入）
  const showCustomStamp = activeMode === "annotate" && rightPanel === "stamps";

  return (
    <aside aria-labelledby={headingId} className="right-pane" data-active-mode={activeMode} data-panel={rightPanel}>
      <header className="right-pane__header">
        <h2 id={headingId} className="right-pane__title">{title}</h2>
        <span aria-hidden="true" className="right-pane__mode-pill">{activeMode}</span>
      </header>
      <div className="right-pane__body" data-testid="right-pane-body">
        <p className="right-pane__hint">{hint}</p>
        {showCustomStamp ? (
          <CustomStampPanel onSelectStamp={onSelectCustomStamp ?? (() => undefined)} />
        ) : null}
      </div>
    </aside>
  );
}
