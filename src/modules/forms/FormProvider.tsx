/**
 * forms 模块顶层 Provider
 *
 * 负责：
 * 1. 持有 useFormController 返回的 controller
 * 2. 通过 activeFormController 模块级桥把 controller 暴露给 mode 工具按钮
 * 3. 激活 forms mode 时确保 mode 工具已注册到 toolbarRegistry
 * 4. 渲染 FormsPanel（仅在 activeMode === "forms" 时挂载）
 *
 * 使用方式：放在 ReaderCanvas 之外的固定挂载点（AppShell 在阅读器 layout 末尾挂一次），
 * 接受 reader + activeMode prop；FormsPanel 自带绝对定位浮在阅读区右侧。
 */

import { useEffect, type ReactNode } from "react";
import type { ReaderController } from "../reader";
import { useFormController } from "./useFormController";
import { setActiveFormController } from "./activeFormController";
import { registerFormsToolbarTools } from "./registerFormsToolbarTools";
import { FormsPanel } from "./ui/FormsPanel";

interface FormProviderProps {
  reader: ReaderController;
  /** 当前激活的 mode（由 AppShell 传入） */
  activeMode: string;
  /** 渲染子节点（让 Provider 能包裹阅读器/工具条，不阻断 layout） */
  children?: ReactNode;
}

export function FormProvider({ reader, activeMode, children }: FormProviderProps) {
  const controller = useFormController(reader);

  // 模块级桥：mode 工具按钮 onClick 通过 getActiveFormController 拿到此 controller
  useEffect(() => {
    setActiveFormController(controller);
    return () => {
      setActiveFormController(null);
    };
  }, [controller]);

  // 激活 forms mode 时确保 toolbar tools 已注册
  useEffect(() => {
    if (activeMode === "forms") {
      registerFormsToolbarTools();
    }
  }, [activeMode]);

  const isFormsMode = activeMode === "forms";

  return (
    <>
      {children}
      {isFormsMode ? <FormsPanel controller={controller} /> : null}
    </>
  );
}
