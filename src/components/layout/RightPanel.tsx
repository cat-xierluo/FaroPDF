import { useId } from "react";
import { CustomStampPanel } from "../../modules/annotation/ui/CustomStampPanel";
import type { CustomStamp } from "../../modules/annotation/customStampStore";
import { SignaturePanel } from "../../modules/forms/ui/SignaturePanel";
import type { SignatureRecord } from "../../modules/forms/signatureStore";
import type { AppModeId, RightPanelId } from "./types";

/**
 * ISS-060：右栏模式驱动面板（v0.2）。
 *
 * 阶段 1 是 skeleton 占位；阶段 2（DEC-112 / DEC-113）真实模块接入：
 * - annotate / forms / export + stamps → 渲染 CustomStampPanel（DEC-112）
 * - annotate / forms / export + signatures → 渲染 SignaturePanel（DEC-113）
 * - export + export-preview → 导出预览（待启动）
 * - ocr + ocr-queue → OCR 任务队列（v0.2 follow-up）
 * - read / pages → 折叠或简版
 */
export interface RightPanelProps {
  activeMode: AppModeId;
  rightPanel: RightPanelId;
  /** 用户从右栏选中自定义图章时的回调（接到 annotationArmed） */
  onSelectCustomStamp?: (stamp: CustomStamp) => void;
  /** 用户从右栏选中签名时的回调（接到 FormsPanel / annotationArmed） */
  onSelectSignature?: (signature: SignatureRecord) => void;
  /** ISS-060 阶段 2 后续：用户点击 tab 显式切换面板内容（annotate/forms 模式有效） */
  onPanelChange?: (panel: RightPanelId) => void;
}

interface PanelDescriptor {
  title: string;
  hint: string;
}

const PANELS_BY_MODE: Record<AppModeId, Record<Exclude<RightPanelId, "none">, PanelDescriptor>> = {
  annotate: {
    stamps: { title: "图章", hint: "标准 9 个图章在批注工具条；下方自定义图章可上传 PNG / JPG。" },
    signatures: { title: "签名", hint: "右栏画手写签名或选历史签名，落入文档" },
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
    signatures: { title: "签名", hint: "我的签名缩略图，点击选用或新画签名" },
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

export function RightPanel({ activeMode, rightPanel, onSelectCustomStamp, onSelectSignature, onPanelChange }: RightPanelProps) {
  const headingId = useId();

  if (activeMode === "read" || activeMode === "pages") {
    if (rightPanel === "none" || READ_INACTIVE_IDS.includes(rightPanel)) {
      return null;
    }
  }

  const descriptor = PANELS_BY_MODE[activeMode]?.[rightPanel as Exclude<RightPanelId, "none">];
  const title = descriptor?.title ?? "右栏";
  const hint = descriptor?.hint ?? "v0.2 候选";

  // 真实模块接入条件（DEC-112 / DEC-113）：
  // - stamps panel：annotate / forms / export 模式都可以叠加自定义图章
  // - signatures panel：annotate / forms 模式都可以叠加签名
  const showCustomStamp = rightPanel === "stamps" && (activeMode === "annotate" || activeMode === "forms" || activeMode === "export");
  const showSignaturePanel = rightPanel === "signatures" && (activeMode === "annotate" || activeMode === "forms");

  // ISS-060 阶段 2 后续：annotate / forms 模式有 2 个可选面板（图章/签名），渲染显式 tab
  // 让用户主动切换，不依赖 mode 派生。其他模式（ocr/export 单一面板）不显示 tab。
  const showTabs = activeMode === "annotate" || activeMode === "forms";

  return (
    <aside aria-labelledby={headingId} className="right-pane" data-active-mode={activeMode} data-panel={rightPanel}>
      <header className="right-pane__header">
        <h2 id={headingId} className="right-pane__title">{title}</h2>
        <span aria-hidden="true" className="right-pane__mode-pill">{activeMode}</span>
      </header>
      {showTabs ? (
        <div className="right-pane__tabs" role="tablist" aria-label="右栏面板切换">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanel === "stamps"}
            className={"right-pane__tab" + (rightPanel === "stamps" ? " right-pane__tab--active" : "")}
            onClick={() => onPanelChange?.("stamps")}
          >
            图章
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanel === "signatures"}
            className={"right-pane__tab" + (rightPanel === "signatures" ? " right-pane__tab--active" : "")}
            onClick={() => onPanelChange?.("signatures")}
          >
            签名
          </button>
        </div>
      ) : null}
      <div className="right-pane__body" data-testid="right-pane-body">
        <p className="right-pane__hint">{hint}</p>
        {showCustomStamp ? (
          <CustomStampPanel onSelectStamp={onSelectCustomStamp ?? (() => undefined)} />
        ) : null}
        {showSignaturePanel ? (
          <SignaturePanel onSelectSignature={onSelectSignature ?? (() => undefined)} />
        ) : null}
      </div>
    </aside>
  );
}
