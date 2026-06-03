import { beforeEach, describe, expect, test } from "vitest";
import { getActiveFormController, setActiveFormController } from "./activeFormController";
import type { FormController } from "./useFormController";

function makeStubController(): FormController {
  return {} as FormController;
}

describe("activeFormController 模块级桥", () => {
  beforeEach(() => {
    setActiveFormController(null);
  });

  test("初始无 controller", () => {
    expect(getActiveFormController()).toBeNull();
  });

  test("setActiveFormController 后 getActiveFormController 返回相同引用", () => {
    const controller = makeStubController();
    setActiveFormController(controller);
    expect(getActiveFormController()).toBe(controller);
  });

  test("setActiveFormController(null) 清空引用", () => {
    setActiveFormController(makeStubController());
    setActiveFormController(null);
    expect(getActiveFormController()).toBeNull();
  });

  test("setActiveFormController 多次调用保留最后一次", () => {
    const a = makeStubController();
    const b = makeStubController();
    setActiveFormController(a);
    setActiveFormController(b);
    expect(getActiveFormController()).toBe(b);
  });
});
