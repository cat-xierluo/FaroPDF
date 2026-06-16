import { beforeEach, describe, expect, test } from "vitest";
import {
  MAX_CUSTOM_STAMPS,
  _clearCustomStamps,
  deleteCustomStamp,
  listCustomStamps,
  saveCustomStamp,
  type CustomStamp,
} from "./customStampStore";

const SAMPLE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

describe("customStampStore (ISS-062 阶段 2)", () => {
  beforeEach(() => {
    _clearCustomStamps();
  });

  test("saveCustomStamp 写入并返回完整对象", () => {
    const stamp = saveCustomStamp("李四律师印章", SAMPLE_PNG);
    expect(stamp.id).toMatch(/^custom-/);
    expect(stamp.name).toBe("李四律师印章");
    expect(stamp.image).toBe(SAMPLE_PNG);
    expect(stamp.createdAt).toBeDefined();
    expect(() => new Date(stamp.createdAt)).not.toThrow();
  });

  test("listCustomStamps 按 createdAt 升序返回", async () => {
    const a = saveCustomStamp("a", SAMPLE_PNG);
    // 等 1ms 让 createdAt 有差异（避免同 ms 同序）
    await new Promise((r) => setTimeout(r, 2));
    const b = saveCustomStamp("b", SAMPLE_PNG);
    const list = listCustomStamps();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a.id);
    expect(list[1].id).toBe(b.id);
  });

  test("deleteCustomStamp 移除指定 id", () => {
    const a = saveCustomStamp("a", SAMPLE_PNG);
    saveCustomStamp("b", SAMPLE_PNG);
    deleteCustomStamp(a.id);
    const list = listCustomStamps();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("b");
  });

  test("deleteCustomStamp id 不存在静默 noop", () => {
    saveCustomStamp("a", SAMPLE_PNG);
    deleteCustomStamp("nonexistent-id");
    expect(listCustomStamps()).toHaveLength(1);
  });

  test(`MAX_CUSTOM_STAMPS = ${4}，超过抛错`, () => {
    expect(MAX_CUSTOM_STAMPS).toBe(4);
    for (let i = 0; i < MAX_CUSTOM_STAMPS; i += 1) {
      saveCustomStamp(`stamp${i}`, SAMPLE_PNG);
    }
    expect(() => saveCustomStamp("over-limit", SAMPLE_PNG)).toThrow(/上限/);
  });

  test("空 name 自动生成 '图章 N'", () => {
    const a = saveCustomStamp("", SAMPLE_PNG);
    expect(a.name).toMatch(/^图章 \d+$/);
    const b = saveCustomStamp("   ", SAMPLE_PNG);
    expect(b.name).toMatch(/^图章 \d+$/);
  });

  test("localStorage 损坏（非 JSON）→ listCustomStamps 返回 []", () => {
    window.localStorage.setItem("faropdf-custom-stamps", "not-valid-json");
    expect(listCustomStamps()).toEqual([]);
  });

  test("listCustomStamps 过滤非 CustomStamp 结构", () => {
    window.localStorage.setItem("faropdf-custom-stamps", JSON.stringify([
      { id: "ok-1", name: "n", image: "x", createdAt: "2026-01-01" },
      "garbage-string",
      { only: "name" },
      null,
    ]));
    const list = listCustomStamps();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("ok-1");
  });

  test("跨调用持久化：第二次 listCustomStamps 仍能拿到", () => {
    saveCustomStamp("persistent", SAMPLE_PNG);
    // 再次 list（模拟页面刷新）
    const list = listCustomStamps();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("persistent");
  });

  test("CustomStamp 类型契约：id + name + image + createdAt", () => {
    const stamp: CustomStamp = saveCustomStamp("x", SAMPLE_PNG);
    expect(stamp).toHaveProperty("id");
    expect(stamp).toHaveProperty("name");
    expect(stamp).toHaveProperty("image");
    expect(stamp).toHaveProperty("createdAt");
  });
});
