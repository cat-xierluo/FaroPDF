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

  test("parses keychain:providerId:keyName with whitelisted provider as resolvable", () => {
    const info = parseCredentialReference("keychain:paddleocr:api-key");
    expect(info.kind).toBe("keychain");
    expect(info.providerId).toBe("paddleocr");
    expect(info.slot).toBe("api-key");
    expect(info.backendResolvable).toBe(true);
    expect(info.hint).toContain("OS Keychain");
  });

  test("parses keychain:mineru:my-key as resolvable", () => {
    const info = parseCredentialReference("keychain:mineru:my-key");
    expect(info.kind).toBe("keychain");
    expect(info.providerId).toBe("mineru");
    expect(info.slot).toBe("my-key");
    expect(info.backendResolvable).toBe(true);
  });

  test("flags keychain: with unknown providerId as non-resolvable", () => {
    const info = parseCredentialReference("keychain:unknown-provider:mykey");
    expect(info.kind).toBe("keychain");
    expect(info.providerId).toBe("unknown-provider");
    expect(info.backendResolvable).toBe(false);
    expect(info.hint).toContain("白名单");
  });

  test("flags legacy keychain: single-segment as non-resolvable", () => {
    const info = parseCredentialReference("keychain:paddle");
    expect(info.kind).toBe("keychain");
    expect(info.backendResolvable).toBe(false);
    expect(info.hint).toContain("providerId");
  });

  test("treats credential: and api-key-ref: as opaque references", () => {
    expect(parseCredentialReference("credential:foo").backendResolvable).toBe(false);
    expect(parseCredentialReference("credential-ref:foo").backendResolvable).toBe(false);
    expect(parseCredentialReference("api-key-ref:foo").backendResolvable).toBe(false);
  });

  test("summarizes env references without leaking values", () => {
    expect(summarizeCredentialReference("env:OCR_PADDLE_TOKEN")).toBe("env:OCR_PADDLE_TOKEN");
  });

  test("summarizes valid keychain references", () => {
    expect(summarizeCredentialReference("keychain:paddleocr:api-key")).toBe("keychain:paddleocr:api-key");
  });

  test("summarizes invalid keychain references with note", () => {
    expect(summarizeCredentialReference("keychain:unknown:key")).toContain("不可解析");
  });

  test("summarizes legacy keychain as format invalid", () => {
    expect(summarizeCredentialReference("keychain:foo")).toContain("格式无效");
  });

  test("summarizes masked placeholders", () => {
    expect(summarizeCredentialReference("****")).toBe("脱敏占位");
  });

  test("summarizes unrecognized as not configured", () => {
    expect(summarizeCredentialReference("paddle-secret-123456")).toBe("未配置");
  });
});
