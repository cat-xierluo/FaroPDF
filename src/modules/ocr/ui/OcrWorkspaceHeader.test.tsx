import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { OcrWorkspaceController } from "./useOcrWorkspaceController";
import { OcrWorkspaceHeader } from "./OcrWorkspaceHeader";

function makeParameters(
  overrides: Partial<OcrWorkspaceController["parameters"]> = {},
): OcrWorkspaceController["parameters"] {
  return {
    activeProvider: null,
    outputStrategy: "new-layered-pdf",
    qualityCheck: { enabled: false, keywords: [], description: "未启用" },
    networkConsentRequired: false,
    ...overrides,
  };
}

describe("OcrWorkspaceHeader 参数区", () => {
  test("无 provider 时显示警告", () => {
    render(<OcrWorkspaceHeader parameters={makeParameters()} />);
    expect(screen.getByText("未配置可用 OCR 后端")).toBeInTheDocument();
  });

  test("本地 provider 渲染本地 tag", () => {
    render(
      <OcrWorkspaceHeader
        parameters={makeParameters({
          activeProvider: {
            id: "local-ocrmypdf",
            label: "本机 ocrmypdf",
            kind: "local",
            requiresNetworkConsent: false,
          },
        })}
      />,
    );
    expect(screen.getByText("本机 ocrmypdf")).toBeInTheDocument();
    expect(screen.getByText("本地")).toBeInTheDocument();
  });

  test("云端 provider 未授权时显示联网授权警告", () => {
    render(
      <OcrWorkspaceHeader
        parameters={makeParameters({
          activeProvider: {
            id: "paddleocr",
            label: "PaddleOCR 云端",
            kind: "cloud",
            requiresNetworkConsent: true,
          },
          networkConsentRequired: true,
        })}
      />,
    );
    expect(screen.getByText("云端")).toBeInTheDocument();
    expect(screen.getByText("需联网")).toBeInTheDocument();
    expect(screen.getByText(/云端 OCR 需要联网授权/)).toBeInTheDocument();
  });

  test("云端 provider 已授权时显示已授权", () => {
    render(
      <OcrWorkspaceHeader
        parameters={makeParameters({
          activeProvider: {
            id: "paddleocr",
            label: "PaddleOCR",
            kind: "cloud",
            requiresNetworkConsent: true,
          },
          networkConsentRequired: false,
        })}
      />,
    );
    expect(screen.getByText("已授权")).toBeInTheDocument();
  });

  test("质量检查已启用且带关键词时显示关键词", () => {
    render(
      <OcrWorkspaceHeader
        parameters={makeParameters({
          qualityCheck: { enabled: true, keywords: ["合同", "甲方"], description: "" },
        })}
      />,
    );
    expect(screen.getByText("已启用")).toBeInTheDocument();
    expect(screen.getByText(/合同、甲方/)).toBeInTheDocument();
  });

  test("多个 provider 时显示 provider 计数", () => {
    render(
      <OcrWorkspaceHeader
        availableProviders={[
          { id: "local-ocrmypdf", label: "本机", kind: "local", enabled: true } as never,
          { id: "paddleocr", label: "PaddleOCR", kind: "cloud", enabled: false } as never,
        ]}
        parameters={makeParameters({
          activeProvider: {
            id: "local-ocrmypdf",
            label: "本机 ocrmypdf",
            kind: "local",
            requiresNetworkConsent: false,
          },
        })}
      />,
    );
    expect(screen.getByText(/共 2 个 provider/)).toBeInTheDocument();
    expect(screen.getByText(/1 已启用/)).toBeInTheDocument();
  });

  test("pageCount 传入时显示页码范围", () => {
    render(<OcrWorkspaceHeader parameters={makeParameters()} pageCount={12} />);
    expect(screen.getByText(/全部页面（共 12 页）/)).toBeInTheDocument();
  });
});
