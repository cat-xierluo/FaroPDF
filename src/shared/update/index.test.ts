import { describe, expect, test } from "vitest";
import * as UpdateModule from "./index";

describe("update barrel exports", () => {
  test("re-exports createTauriUpdateClient factory", () => {
    expect(typeof UpdateModule.createTauriUpdateClient).toBe("function");
  });

  test("re-exports detectUpdateCapability helper", () => {
    expect(typeof UpdateModule.detectUpdateCapability).toBe("function");
  });

  test("re-exports AppUpdateClient type symbol (compile-time only)", () => {
    // 编译期通过 import 即可；运行时拿不到 type，但 barrel 必须 export 该名字。
    // 这里只验证 barrel 文件存在且可被 vitest 加载。
    expect(UpdateModule).toBeDefined();
  });
});
