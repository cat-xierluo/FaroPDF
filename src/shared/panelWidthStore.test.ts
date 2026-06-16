import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  MAX_RIGHT_WIDTH,
  getPanelWidth,
  setPanelWidth,
} from "./panelWidthStore";

const STORAGE_KEY = "faropdf-panel-widths";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe("panelWidthStore (ISS-060 后续宽度持久化)", () => {
  test("localStorage 空 → getPanelWidth 返回默认值", () => {
    expect(getPanelWidth("left")).toBe(DEFAULT_LEFT_WIDTH);
    expect(getPanelWidth("right")).toBe(DEFAULT_RIGHT_WIDTH);
  });

  test("setPanelWidth → 写入 localStorage JSON", () => {
    setPanelWidth("left", 350);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as Record<string, number>;
    expect(parsed.left).toBe(350);
  });

  test("setPanelWidth → getPanelWidth 读回一致", () => {
    setPanelWidth("right", 400);
    expect(getPanelWidth("right")).toBe(400);
  });

  test("左右宽度独立持久化", () => {
    setPanelWidth("left", 300);
    setPanelWidth("right", 360);
    expect(getPanelWidth("left")).toBe(300);
    expect(getPanelWidth("right")).toBe(360);
  });

  test("localStorage 损坏 JSON → 返回默认值不抛", () => {
    localStorage.setItem(STORAGE_KEY, "{not json}");
    expect(getPanelWidth("left")).toBe(DEFAULT_LEFT_WIDTH);
  });

  test("负数或 0 → clamp 到最小合理值（160px）", () => {
    setPanelWidth("left", -100);
    expect(getPanelWidth("left")).toBe(160);
    setPanelWidth("left", 0);
    expect(getPanelWidth("left")).toBe(160);
  });

  test("右栏超过 MAX_RIGHT_WIDTH → clamp", () => {
    setPanelWidth("right", MAX_RIGHT_WIDTH + 500);
    expect(getPanelWidth("right")).toBe(MAX_RIGHT_WIDTH);
  });

  test("非数字字符串 → 返回默认值", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: "abc", right: null }));
    expect(getPanelWidth("left")).toBe(DEFAULT_LEFT_WIDTH);
    expect(getPanelWidth("right")).toBe(DEFAULT_RIGHT_WIDTH);
  });
});
