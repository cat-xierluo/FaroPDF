import { beforeEach, describe, expect, test } from "vitest";
import {
  MAX_USER_SIGNATURES,
  _clearSignatures,
  deleteSignature,
  listSignatures,
  saveSignature,
} from "./signatureStore";

const SAMPLE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

describe("signatureStore (ISS-070 阶段 2)", () => {
  beforeEach(() => {
    _clearSignatures();
  });

  test("saveSignature 写入并返回完整对象", () => {
    const record = saveSignature("张律师签名", SAMPLE_PNG);
    expect(record.id).toMatch(/^sig-/);
    expect(record.name).toBe("张律师签名");
    expect(record.image).toBe(SAMPLE_PNG);
    expect(record.createdAt).toBeDefined();
  });

  test("listSignatures 按 createdAt 升序", async () => {
    const a = saveSignature("a", SAMPLE_PNG);
    await new Promise((r) => setTimeout(r, 2));
    const b = saveSignature("b", SAMPLE_PNG);
    const list = listSignatures();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a.id);
    expect(list[1].id).toBe(b.id);
  });

  test("deleteSignature 移除指定 id", () => {
    const a = saveSignature("a", SAMPLE_PNG);
    saveSignature("b", SAMPLE_PNG);
    deleteSignature(a.id);
    expect(listSignatures()).toHaveLength(1);
    expect(listSignatures()[0].name).toBe("b");
  });

  test("deleteSignature id 不存在静默 noop", () => {
    saveSignature("a", SAMPLE_PNG);
    deleteSignature("nonexistent-id");
    expect(listSignatures()).toHaveLength(1);
  });

  test("MAX_USER_SIGNATURES = 4，超过抛错", () => {
    expect(MAX_USER_SIGNATURES).toBe(4);
    for (let i = 0; i < 4; i += 1) {
      saveSignature(`s${i}`, SAMPLE_PNG);
    }
    expect(() => saveSignature("over", SAMPLE_PNG)).toThrow(/上限/);
  });

  test("空 name 自动生成 '签名 N'", () => {
    const a = saveSignature("", SAMPLE_PNG);
    expect(a.name).toMatch(/^签名 \d+$/);
  });

  test("localStorage 损坏 → 返回 []", () => {
    window.localStorage.setItem("faropdf-signatures", "not-json");
    expect(listSignatures()).toEqual([]);
  });

  test("过滤非 SignatureRecord 结构", () => {
    window.localStorage.setItem("faropdf-signatures", JSON.stringify([
      { id: "ok-1", name: "n", image: "x", createdAt: "2026-01-01" },
      null,
      "garbage",
      { only: "name" },
    ]));
    const list = listSignatures();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("ok-1");
  });

  test("跨调用持久化", () => {
    saveSignature("persistent", SAMPLE_PNG);
    const list = listSignatures();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("persistent");
  });
});
