import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightPanel } from "./RightPanel";

describe("RightPanel (ISS-060 skeleton)", () => {
  test("read 模式 + rightPanel=none → 折叠不渲染", () => {
    const { container } = render(
      <RightPanel activeMode="read" rightPanel="none" />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("annotate 模式 + stamps → 渲染「图章」 + 接入 CustomStampPanel（DEC-112）", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    expect(screen.getByRole("heading", { name: "图章" })).toBeTruthy();
    // ISS-060 阶段 2 接入 CustomStampPanel
    expect(screen.getByTestId("custom-stamp-panel")).toBeTruthy();
    expect(screen.queryByTestId("right-pane-placeholder")).toBeNull();
  });

  test("annotate 模式 + signatures → 渲染「签名」 + 接入 SignaturePanel（DEC-113）", () => {
    render(<RightPanel activeMode="annotate" rightPanel="signatures" />);
    expect(screen.getByRole("heading", { name: "签名" })).toBeTruthy();
    expect(screen.getByTestId("signature-panel")).toBeTruthy();
  });

  test("forms 模式 + signatures → 渲染 SignaturePanel", () => {
    render(<RightPanel activeMode="forms" rightPanel="signatures" />);
    expect(screen.getByTestId("signature-panel")).toBeTruthy();
  });

  test("forms 模式 + stamps → 也渲染 CustomStampPanel（让表单签字时也能盖业务章）", () => {
    render(<RightPanel activeMode="forms" rightPanel="stamps" />);
    expect(screen.getByTestId("custom-stamp-panel")).toBeTruthy();
  });

  test("非 annotate / forms / export 模式不渲染 CustomStampPanel / SignaturePanel", () => {
    render(<RightPanel activeMode="ocr" rightPanel="ocr-queue" />);
    expect(screen.queryByTestId("custom-stamp-panel")).toBeNull();
    expect(screen.queryByTestId("signature-panel")).toBeNull();
  });

  test("ocr 模式 + ocr-queue → 渲染「OCR 队列」", () => {
    render(<RightPanel activeMode="ocr" rightPanel="ocr-queue" />);
    expect(screen.getByRole("heading", { name: "OCR 队列" })).toBeTruthy();
  });

  test("export 模式 + export-preview → 渲染「导出预览」", () => {
    render(<RightPanel activeMode="export" rightPanel="export-preview" />);
    expect(screen.getByRole("heading", { name: "导出预览" })).toBeTruthy();
  });

  test("forms 模式 + signatures → 渲染「签名」", () => {
    render(<RightPanel activeMode="forms" rightPanel="signatures" />);
    expect(screen.getByRole("heading", { name: "签名" })).toBeTruthy();
  });

  test("右栏标注 activeMode pill 文本", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    const pill = screen.getByText("annotate");
    expect(pill.className).toContain("right-pane__mode-pill");
  });

  test("read 模式 + stamps（非法组合）→ 强制折叠（READ_INACTIVE_IDS）", () => {
    // P2-7：read / pages 模式不应展示模式驱动栏，即便 rightPanel 字段被错传
    const { container } = render(<RightPanel activeMode="read" rightPanel="stamps" />);
    expect(container.firstChild).toBeNull();
  });

  test("pages 模式 + ocr-queue → 强制折叠", () => {
    const { container } = render(<RightPanel activeMode="pages" rightPanel="ocr-queue" />);
    expect(container.firstChild).toBeNull();
  });
});
