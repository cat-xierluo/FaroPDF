import { describe, expect, test } from "vitest";
import { suggestOutputName } from "./naming";

describe("ISS-071 m3: suggestOutputName", () => {
  test("普通文件 + 各种 suffix", () => {
    expect(suggestOutputName("contract.pdf", "secured")).toBe("contract-secured.pdf");
    expect(suggestOutputName("contract.pdf", "compressed")).toBe("contract-compressed.pdf");
    expect(suggestOutputName("contract.pdf", "redacted")).toBe("contract-redacted.pdf");
    expect(suggestOutputName("contract.pdf", "signed")).toBe("contract-signed.pdf");
  });

  test("无 .pdf 后缀也工作", () => {
    expect(suggestOutputName("contract", "secured")).toBe("contract-secured.pdf");
    expect(suggestOutputName("memo", "watermarked")).toBe("memo-watermarked.pdf");
  });

  test("大小写不敏感 strip .pdf", () => {
    expect(suggestOutputName("Contract.PDF", "secured")).toBe("Contract-secured.pdf");
    expect(suggestOutputName("FILE.Pdf", "compressed")).toBe("FILE-compressed.pdf");
  });

  test("空 / 仅空白 → fallback document-{suffix}.pdf", () => {
    expect(suggestOutputName("", "secured")).toBe("document-secured.pdf");
    expect(suggestOutputName("   ", "secured")).toBe("document-secured.pdf");
    expect(suggestOutputName(null, "secured")).toBe("document-secured.pdf");
    expect(suggestOutputName(undefined, "secured")).toBe("document-secured.pdf");
  });

  test("路径字符替换：/ \\ → -", () => {
    expect(suggestOutputName("foo/bar.pdf", "secured")).toBe("foo-bar-secured.pdf");
    expect(suggestOutputName("foo\\bar.pdf", "secured")).toBe("foo-bar-secured.pdf");
    expect(suggestOutputName("a/b/c.pdf", "compressed")).toBe("a-b-c-compressed.pdf");
  });

  test("仅 .pdf 没有 stem → fallback", () => {
    expect(suggestOutputName(".pdf", "secured")).toBe("document-secured.pdf");
  });

  test("非中文 + 中文 stem 都保留", () => {
    expect(suggestOutputName("合同.pdf", "redacted")).toBe("合同-redacted.pdf");
    expect(suggestOutputName("证据材料2.pdf", "bates")).toBe("证据材料2-bates.pdf");
  });

  test("常用 suffix 全枚举", () => {
    expect(suggestOutputName("a.pdf", "copy")).toBe("a-copy.pdf");
    expect(suggestOutputName("a.pdf", "unsecured")).toBe("a-unsecured.pdf");
    expect(suggestOutputName("a.pdf", "text-watermarked")).toBe("a-text-watermarked.pdf");
    expect(suggestOutputName("a.pdf", "image-watermarked")).toBe("a-image-watermarked.pdf");
    expect(suggestOutputName("a.pdf", "organized")).toBe("a-organized.pdf");
    expect(suggestOutputName("a.pdf", "annotations-flattened")).toBe("a-annotations-flattened.pdf");
    expect(suggestOutputName("a.pdf", "flattened")).toBe("a-flattened.pdf");
    expect(suggestOutputName("a.pdf", "header-footer")).toBe("a-header-footer.pdf");
    expect(suggestOutputName("a.pdf", "page-numbered")).toBe("a-page-numbered.pdf");
    expect(suggestOutputName("a.pdf", "metadata")).toBe("a-metadata.pdf");
    expect(suggestOutputName("a.pdf", "cut")).toBe("a-cut.pdf");
    expect(suggestOutputName("a.pdf", "no-watermark")).toBe("a-no-watermark.pdf");
  });
});
