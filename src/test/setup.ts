import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// testing-library 的 auto-cleanup 不在 vitest 默认行为里；
// 每个 test 结束后手动 cleanup，防止前一个 render 残留导致跨测试污染。
afterEach(() => {
  cleanup();
});

// jsdom 不实现 window.matchMedia；为 SettingsPanel 等使用 matchMedia 的组件兜底。
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
