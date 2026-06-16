import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignatureLibraryPicker } from "./SignatureLibraryPicker";
import * as signatureStore from "../signatureStore";

describe("SignatureLibraryPicker (ISS-070 阶段 3)", () => {
  test("空签名库 → 渲染空态提示，无缩略图", () => {
    vi.spyOn(signatureStore, "listSignatures").mockReturnValue([]);
    render(<SignatureLibraryPicker onSelect={vi.fn()} />);
    expect(screen.getByText(/还没有签名/)).toBeTruthy();
    expect(screen.queryAllByTestId("signature-library-item")).toHaveLength(0);
  });

  test("签名库有 2 条 → 渲染 2 个缩略图（data-testid signature-library-item）", () => {
    vi.spyOn(signatureStore, "listSignatures").mockReturnValue([
      { id: "s1", name: "签名一", image: "data:image/png;base64,AAA", createdAt: "2026-06-16T00:00:00.000Z" },
      { id: "s2", name: "签名二", image: "data:image/png;base64,BBB", createdAt: "2026-06-16T00:00:00.000Z" },
    ]);
    render(<SignatureLibraryPicker onSelect={vi.fn()} />);
    expect(screen.getAllByTestId("signature-library-item")).toHaveLength(2);
    expect(screen.getByAltText("签名一")).toBeTruthy();
    expect(screen.getByAltText("签名二")).toBeTruthy();
  });

  test("点击缩略图 → onSelect 传入该签名的 image data URL", () => {
    const onSelect = vi.fn();
    vi.spyOn(signatureStore, "listSignatures").mockReturnValue([
      { id: "s1", name: "签名一", image: "data:image/png;base64,AAA", createdAt: "2026-06-16T00:00:00.000Z" },
    ]);
    render(<SignatureLibraryPicker onSelect={onSelect} />);
    fireEvent.click(screen.getAllByTestId("signature-library-item")[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe("data:image/png;base64,AAA");
  });
});
