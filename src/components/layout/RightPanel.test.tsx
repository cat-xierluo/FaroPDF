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

  test("annotate 模式 + stamps → 渲染「图章」", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    expect(screen.getByRole("heading", { name: "图章" })).toBeTruthy();
    expect(screen.getByTestId("right-pane-placeholder").textContent).toContain("v0.1 skeleton");
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
});
