/**
 * forms 模块级 controller 注册器
 *
 * Toolbar 通过 `registerModeTools("forms", [...])` 注册的 mode 工具按钮在闭包内
 * 只能拿到 `ToolbarState = { activeMode, reader, search }`，拿不到 controller 引用。
 * 这里提供 module-level 引用桥：FormProvider 挂载时调 setActiveFormController，
 * mode 工具按钮的 onClick 调 getActiveFormController() 拿到当前 controller。
 *
 * 这是简单的"最近一个 controller"语义；同一时刻只允许一个 controller 处于活跃状态。
 */

import type { FormController } from "./useFormController";

let activeFormController: FormController | null = null;

export function setActiveFormController(controller: FormController | null): void {
  activeFormController = controller;
}

export function getActiveFormController(): FormController | null {
  return activeFormController;
}
