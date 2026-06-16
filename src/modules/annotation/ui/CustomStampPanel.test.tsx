import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomStampPanel } from "./CustomStampPanel";
import { _clearCustomStamps, saveCustomStamp } from "../customStampStore";

const SAMPLE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = "x".repeat(sizeBytes);
  return new File([content], name, { type });
}

describe("CustomStampPanel (ISS-062 阶段 2)", () => {
  beforeEach(() => {
    _clearCustomStamps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("空状态：渲染标题 + 0/4 计数 + 4 个空位 slot + 上传按钮", () => {
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    expect(screen.getByText("自定义图章")).toBeInTheDocument();
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    expect(screen.getAllByText("空位")).toHaveLength(4);
    expect(screen.getByTestId("custom-stamp-panel-upload")).toBeInTheDocument();
    expect(screen.getByTestId("custom-stamp-panel-upload")).toHaveTextContent("+ 上传 PNG / JPG");
  });

  test("已有 stamp：渲染缩略图 + 计数更新 + 空位数减少", () => {
    saveCustomStamp("公章", SAMPLE_PNG);
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /选择图章: 公章/ })).toBeInTheDocument();
    expect(screen.getAllByText("空位")).toHaveLength(3);
  });

  test("点击缩略图触发 onSelectStamp", () => {
    const stamp = saveCustomStamp("印鉴", SAMPLE_PNG);
    const onSelectStamp = vi.fn();
    render(<CustomStampPanel onSelectStamp={onSelectStamp} />);
    fireEvent.click(screen.getByRole("button", { name: /选择图章: 印鉴/ }));
    expect(onSelectStamp).toHaveBeenCalledWith(expect.objectContaining({ id: stamp.id, name: "印鉴" }));
  });

  test("删除按钮：从 store 移除 + UI 刷新", () => {
    saveCustomStamp("待删", SAMPLE_PNG);
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /删除图章: 待删/ }));
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
  });

  test("达到 4 张上限：上传按钮 disabled + 文案变化", () => {
    for (let i = 0; i < 4; i += 1) {
      saveCustomStamp(`s${i}`, SAMPLE_PNG);
    }
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    const uploadButton = screen.getByTestId("custom-stamp-panel-upload");
    expect(uploadButton).toBeDisabled();
    expect(uploadButton).toHaveTextContent(/已达上限/);
  });

  test("文件类型非 PNG/JPG → 错误提示", async () => {
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    const input = screen.getByTestId("custom-stamp-panel-file-input") as HTMLInputElement;
    const badFile = makeFile("evil.txt", "text/plain", 100);
    Object.defineProperty(input, "files", { value: [badFile], configurable: true });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId("custom-stamp-panel-error")).toBeInTheDocument();
      expect(screen.getByTestId("custom-stamp-panel-error")).toHaveTextContent(/仅支持 PNG \/ JPG/);
    });
  });

  test("文件 > 1MB → 错误提示", async () => {
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    const input = screen.getByTestId("custom-stamp-panel-file-input") as HTMLInputElement;
    const bigFile = makeFile("big.png", "image/png", 2 * 1024 * 1024);
    Object.defineProperty(input, "files", { value: [bigFile], configurable: true });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByTestId("custom-stamp-panel-error")).toHaveTextContent(/上限 1 MB/);
    });
  });

  test("合法文件上传：FileReader 读取 → saveCustomStamp + onSelectStamp 触发", async () => {
    const onSelectStamp = vi.fn();
    // Mock FileReader.prototype.readAsDataURL：同步设 result + 触发 onload
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (this: FileReader, _file: Blob) {
      // 用 Object.defineProperty 设 readonly 的 result
      Object.defineProperty(this, "result", { value: SAMPLE_PNG, configurable: true });
      // setTimeout 让 onload 在异步回调里触发（与真实 FileReader 行为一致）
      setTimeout(() => {
        const evt = new Event("load");
        this.onload?.(evt as unknown as ProgressEvent<FileReader>);
      }, 0);
    };

    render(<CustomStampPanel onSelectStamp={onSelectStamp} />);
    const input = screen.getByTestId("custom-stamp-panel-file-input") as HTMLInputElement;
    const goodFile = makeFile("印章.png", "image/png", 500);
    Object.defineProperty(input, "files", { value: [goodFile], configurable: true });

    fireEvent.change(input);
    await waitFor(() => {
      expect(onSelectStamp).toHaveBeenCalledWith(expect.objectContaining({ name: "印章" }));
    });
    // 还原
    FileReader.prototype.readAsDataURL = originalReadAsDataURL;
  });

  test("「知道了」按钮关闭错误提示", async () => {
    render(<CustomStampPanel onSelectStamp={() => undefined} />);
    const input = screen.getByTestId("custom-stamp-panel-file-input") as HTMLInputElement;
    const badFile = makeFile("bad.txt", "text/plain", 10);
    Object.defineProperty(input, "files", { value: [badFile], configurable: true });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByTestId("custom-stamp-panel-error")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByTestId("custom-stamp-panel-error")).toBeNull();
  });
});
