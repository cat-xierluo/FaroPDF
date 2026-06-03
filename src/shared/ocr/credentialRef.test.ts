import { describe, expect, test } from "vitest";
import {
  parseCredentialReference,
  summarizeCredentialReference,
} from "./credentialRef";

describe("OCR credential reference parser", () => {
  test("returns unknown for empty input", () => {
    const info = parseCredentialReference("");
    expect(info.kind).toBe("unknown");
    expect(info.backendResolvable).toBe(false);
  });

  test("treats masked placeholders as non-resolvable", () => {
    expect(parseCredentialReference("****").kind).toBe("placeholder");
    expect(parseCredentialReference("abcd...wxyz").kind).toBe("placeholder");
    expect(parseCredentialReference("abcd...wxyz").backendResolvable).toBe(false);
  });

  test("parses env: references as backend resolvable", () => {
    const info = parseCredentialReference("env:OCR_PADDLE_TOKEN");
    expect(info.kind).toBe("env");
    expect(info.slot).toBe("OCR_PADDLE_TOKEN");
    expect(info.backendResolvable).toBe(true);
  });

  test("flags keychain: references as not yet integrated", () => {
    const info = parseCredentialReference("keychain:paddle");
    expect(info.kind).toBe("keychain");
    expect(info.backendResolvable).toBe(false);
    expect(info.hint).toContain("未集成");
  });

  test("treats credential: and api-key-ref: as opaque references", () => {
    expect(parseCredentialReference("credential:foo").backendResolvable).toBe(false);
    expect(parseCredentialReference("credential-ref:foo").backendResolvable).toBe(false);
    expect(parseCredentialReference("api-key-ref:foo").backendResolvable).toBe(false);
  });

  test("summarizes references for UI without leaking values", () => {
    expect(summarizeCredentialReference("env:OCR_PADDLE_TOKEN")).toBe("env:OCR_PADDLE_TOKEN");
    expect(summarizeCredentialReference("keychain:foo")).toContain("未集成");
    expect(summarizeCredentialReference("****")).toBe("脱敏占位");
    expect(summarizeCredentialReference("paddle-secret-123456")).toBe("未配置");
  });
});
