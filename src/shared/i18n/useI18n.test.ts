import { afterEach, describe, expect, test } from "vitest";
import { renderHook } from "@testing-library/react";
import { getCurrentLanguage, setCurrentLanguage, useI18n } from "./useI18n";
import { dictionaries } from "./dictionaries";

describe("i18n runtime（ISS-NEW-G 2026-06-22 收口）", () => {
  afterEach(() => {
    setCurrentLanguage("zh-CN");
  });

  test("默认 language=zh-CN", () => {
    setCurrentLanguage("zh-CN");
    expect(getCurrentLanguage()).toBe("zh-CN");
    const { result } = renderHook(() => useI18n());
    expect(result.current.statusBar.zoom("50%")).toBe("缩放：50%");
  });

  test("setCurrentLanguage(en) 后 useI18n 切到 en 字典", () => {
    setCurrentLanguage("en");
    expect(getCurrentLanguage()).toBe("en");
    const { result } = renderHook(() => useI18n());
    expect(result.current.statusBar.zoom("50%")).toBe("Zoom: 50%");
    expect(result.current.welcome.convertImagesTitle).toBe("Images to PDF");
  });

  test("setCurrentLanguage(同值) 不触发 listener（idempotent）", () => {
    setCurrentLanguage("zh-CN");
    const { result } = renderHook(() => useI18n());
    const before = result.current;
    setCurrentLanguage("zh-CN");
    expect(result.current).toBe(before);
  });

  test("两套字典都存在且键集合一致（结构对齐防漂移）", () => {
    const zh = dictionaries["zh-CN"];
    const en = dictionaries.en;
    const collectKeys = (obj: unknown, prefix = ""): string[] => {
      if (obj === null || typeof obj !== "object") return [prefix];
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        collectKeys(v, prefix ? `${prefix}.${k}` : k),
      );
    };
    const zhKeys = collectKeys(zh).sort();
    const enKeys = collectKeys(en).sort();
    expect(zhKeys).toEqual(enKeys);
  });
});
