import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignaturePanel } from "./SignaturePanel";
import { _clearSignatures, saveSignature } from "../signatureStore";

describe("SignaturePanel (ISS-070 阶段 2)", () => {
  beforeEach(() => {
    _clearSignatures();
  });

  test("空状态：空提示 + 计数 0/4 + 「+ 新画签名」按钮", () => {
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    expect(screen.getByText("我的签名")).toBeInTheDocument();
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    expect(screen.getByTestId("signature-panel-empty")).toBeInTheDocument();
    expect(screen.getByTestId("signature-panel-add")).toHaveTextContent(/新画签名/);
  });

  test("已有签名：渲染缩略图 + 计数更新", () => {
    saveSignature("张三签名", "data:image/png;base64,iVBORw0KGgo=");
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /选择签名: 张三签名/ })).toBeInTheDocument();
  });

  test("点击缩略图触发 onSelectSignature", () => {
    const record = saveSignature("李四签名", "data:image/png;base64,xxx");
    const onSelectSignature = vi.fn();
    render(<SignaturePanel onSelectSignature={onSelectSignature} />);
    fireEvent.click(screen.getByRole("button", { name: /选择签名: 李四签名/ }));
    expect(onSelectSignature).toHaveBeenCalledWith(expect.objectContaining({ id: record.id, name: "李四签名" }));
  });

  test("删除按钮：从 store 移除 + UI 刷新", () => {
    saveSignature("待删", "data:image/png;base64,xxx");
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /删除签名: 待删/ }));
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
  });

  test("达 4 上限：「+ 新画签名」按钮 disabled + 文案变化", () => {
    for (let i = 0; i < 4; i += 1) {
      saveSignature(`s${i}`, `data:image/png;base64,${i}`);
    }
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    const addButton = screen.getByTestId("signature-panel-add");
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveTextContent(/已达上限/);
  });

  test("「+ 新画签名」按钮 → 弹出 SignaturePad，按钮消失", () => {
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    expect(screen.queryByTestId("signature-pad")).toBeNull();
    fireEvent.click(screen.getByTestId("signature-panel-add"));
    expect(screen.getByTestId("signature-panel-drawing")).toBeInTheDocument();
    expect(screen.getByTestId("signature-pad")).toBeInTheDocument();
    expect(screen.queryByTestId("signature-panel-add")).toBeNull();
  });

  test("SignaturePad 取消 → 回到空态", () => {
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    fireEvent.click(screen.getByTestId("signature-panel-add"));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByTestId("signature-panel-drawing")).toBeNull();
    expect(screen.getByTestId("signature-panel-add")).toBeInTheDocument();
  });

  test("SignaturePad 保存 → saveSignature + onSelectSignature + 列表刷新", () => {
    const onSelectSignature = vi.fn();
    // Mock canvas toDataURL（jsdom 默认返回空 string）
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,FAKE_NEW");

    render(<SignaturePanel onSelectSignature={onSelectSignature} />);
    fireEvent.click(screen.getByTestId("signature-panel-add"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSelectSignature).toHaveBeenCalledWith(expect.objectContaining({ image: "data:image/png;base64,FAKE_NEW" }));
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.queryByTestId("signature-panel-drawing")).toBeNull();
  });

  test("达上限时点 + 触发错误（保险机制）", () => {
    for (let i = 0; i < 4; i += 1) {
      saveSignature(`s${i}`, `data:image/png;base64,${i}`);
    }
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,EXTRA");
    render(<SignaturePanel onSelectSignature={() => undefined} />);
    // 按钮 disabled，点击没反应
    const addButton = screen.getByTestId("signature-panel-add");
    expect(addButton).toBeDisabled();
    fireEvent.click(addButton);
    expect(screen.queryByTestId("signature-panel-drawing")).toBeNull();
  });
});
