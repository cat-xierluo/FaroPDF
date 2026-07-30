import { describe, expect, test } from "vitest";
import { decodeSignatureDataUrl } from "./signatureImage";

describe("decodeSignatureDataUrl", () => {
  test("解码 PNG 签名 data URL", () => {
    const result = decodeSignatureDataUrl(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    );

    expect(result.type).toBe("png");
    expect(Array.from(result.bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test("把 JPEG 归一化为 jpg", () => {
    const result = decodeSignatureDataUrl("data:image/jpeg;base64,/9j/2Q==");

    expect(result.type).toBe("jpg");
    expect(Array.from(result.bytes)).toEqual([0xff, 0xd8, 0xff, 0xd9]);
  });

  test("拒绝损坏或不支持的签名内容", () => {
    expect(() => decodeSignatureDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toThrow(/PNG 或 JPG/);
    expect(() => decodeSignatureDataUrl("data:image/png;base64,")).toThrow(/PNG 或 JPG/);
    expect(() => decodeSignatureDataUrl("data:image/png;base64,AQID")).toThrow(/内容损坏/);
  });
});
