import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RightPanel } from "./RightPanel";

describe("RightPanel (ISS-060 skeleton)", () => {
  test("read 模式 + rightPanel=none → 折叠不渲染", () => {
    const { container } = render(
      <RightPanel activeMode="read" rightPanel="none" />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("annotate 模式 + stamps → 渲染「图章」 + 接入统一 StampPanel", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    expect(screen.getByRole("heading", { name: "图章" })).toBeTruthy();
    expect(screen.getByTestId("stamp-panel")).toBeTruthy();
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

  test("forms 模式 + stamps → 也渲染统一 StampPanel（让表单签字时也能盖业务章）", () => {
    render(<RightPanel activeMode="forms" rightPanel="stamps" />);
    expect(screen.getByTestId("stamp-panel")).toBeTruthy();
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

  test("none 或 edit 默认组合始终折叠", () => {
    expect(render(<RightPanel activeMode="annotate" rightPanel="none" />).container).toBeEmptyDOMElement();
    expect(render(<RightPanel activeMode="edit" rightPanel="shape" />).container).toBeEmptyDOMElement();
  });

  test("pages 模式 + ocr-queue → 强制折叠", () => {
    const { container } = render(<RightPanel activeMode="pages" rightPanel="ocr-queue" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("RightPanel 显式 tab 切换（ISS-060 阶段 2 后续）", () => {
  test("annotate 模式渲染 [图章][签名] 两个 tab", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    const tabs = screen.getAllByRole("tab");
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["图章", "签名"]));
  });

  test("当前 rightPanel=stamps → 图章 tab 标记为激活（aria-selected=true）", () => {
    render(<RightPanel activeMode="annotate" rightPanel="stamps" />);
    const stampTab = screen.getByRole("tab", { name: "图章" });
    const signTab = screen.getByRole("tab", { name: "签名" });
    expect(stampTab.getAttribute("aria-selected")).toBe("true");
    expect(signTab.getAttribute("aria-selected")).toBe("false");
  });

  test("点击签名 tab → 调用 onPanelChange(\"signatures\")", () => {
    const onPanelChange = vi.fn();
    render(
      <RightPanel activeMode="annotate" rightPanel="stamps" onPanelChange={onPanelChange} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "签名" }));
    expect(onPanelChange).toHaveBeenCalledTimes(1);
    expect(onPanelChange.mock.calls[0][0]).toBe("signatures");
  });

  test("forms 模式也渲染 [图章][签名] tab", () => {
    render(<RightPanel activeMode="forms" rightPanel="signatures" />);
    expect(screen.getByRole("tab", { name: "图章" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "签名" })).toBeTruthy();
  });

  test("ocr 模式不渲染图章/签名 tab（OCR 队列单一面板）", () => {
    render(<RightPanel activeMode="ocr" rightPanel="ocr-queue" />);
    expect(screen.queryByRole("tab", { name: "图章" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "签名" })).toBeNull();
  });

  test("export 模式不渲染图章/签名 tab", () => {
    render(<RightPanel activeMode="export" rightPanel="export-preview" />);
    expect(screen.queryByRole("tab", { name: "图章" })).toBeNull();
  });
});
