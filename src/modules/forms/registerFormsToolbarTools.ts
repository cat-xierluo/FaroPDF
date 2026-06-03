/**
 * forms 模式工具注册入口
 *
 * 按 DEC-032 §"W3 Forms 接入指南"调 `registerModeTools("forms", [...])` 注册 4 个 mode 工具
 * 按钮：读取表单字段、填写、签名、导出压平。onClick 闭包通过 activeFormController 模块级桥
 * 拿当前活跃 controller，避免修改 ToolbarState 类型。
 *
 * 多次调用是安全的（registerModeTools 内部追加），但通常在模块入口或单测 setup 调一次。
 */

import { FileCheck2, FormInput, PenLine, RefreshCw } from "lucide-react";
import { registerModeTools, type ToolbarToolItem } from "../../components/layout/toolbarRegistry";
import { getActiveFormController } from "./activeFormController";

/** 注册 forms mode 工具到 toolbarRegistry。返回注册的 items 数组，便于测试断言。 */
export function registerFormsToolbarTools(): ToolbarToolItem[] {
  const items: ToolbarToolItem[] = [
    {
      id: "forms.refresh",
      modeId: "forms",
      order: 10,
      icon: RefreshCw,
      label: "读取表单",
      isActive: (state) => state.activeMode === "forms",
      isDisabled: (state) => !state.reader.state.document,
      onClick: () => {
        const controller = getActiveFormController();
        if (controller) {
          void controller.refreshFormState();
        }
      },
    },
    {
      id: "forms.fill",
      modeId: "forms",
      order: 20,
      icon: FormInput,
      label: "填写",
      isActive: (state) => state.activeMode === "forms",
      isDisabled: (state) => !state.reader.state.document,
      onClick: () => {
        const controller = getActiveFormController();
        if (controller) {
          controller.openPanel("fill");
        }
      },
    },
    {
      id: "forms.signature",
      modeId: "forms",
      order: 30,
      icon: PenLine,
      label: "签名",
      isActive: (state) => state.activeMode === "forms",
      isDisabled: (state) => !state.reader.state.document,
      onClick: () => {
        const controller = getActiveFormController();
        if (controller) {
          controller.openPanel("sign");
        }
      },
    },
    {
      id: "forms.flatten",
      modeId: "forms",
      order: 40,
      icon: FileCheck2,
      label: "导出压平",
      isActive: (state) => state.activeMode === "forms",
      isDisabled: (state) => !state.reader.state.document,
      onClick: () => {
        const controller = getActiveFormController();
        if (controller) {
          void controller.flattenAndSave();
        }
      },
    },
  ];

  registerModeTools("forms", items);

  return items;
}
