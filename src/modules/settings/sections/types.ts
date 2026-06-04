import type { AppSettings } from "../../../shared/settings/types";

/** 设置页左侧导航 5 个 section id。 */
export type SectionId = "general" | "reader" | "ocr" | "shortcuts" | "about";

export interface SectionDescriptor {
  id: SectionId;
  label: string;
}

/** 导航顺序与展示顺序保持一致，供 SettingsPanel 渲染左侧导航。 */
export const SECTION_LIST: ReadonlyArray<SectionDescriptor> = [
  { id: "general", label: "常规" },
  { id: "reader", label: "阅读" },
  { id: "ocr", label: "OCR provider" },
  { id: "shortcuts", label: "快捷键" },
  { id: "about", label: "关于" },
];

/** 窄屏顶部 tab 形式：返回 SECTION_LIST 中前 5 个，按现有顺序渲染。 */
export const TOP_TAB_LIST: ReadonlyArray<SectionDescriptor> = SECTION_LIST;

/** section 组件统一 props：当前 AppSettings 草稿 + 必填的变更回调。
 *  即便 section 内部不修改 settings（如只读的「快捷键」、「关于」），
 *  也需接收 onChange 保持组件接口一致；容器 SettingsPanel 始终传同一引用。 */
export interface SectionProps {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}
