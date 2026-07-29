import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

const BOUNDS = { bottom: 200, left: 100, right: 400, top: 150 };

/** jsdom 里 window.getSelection 是 stub；stub 一个可控版本让 click 路径读到选中文本 */
function mockSelection(text: string) {
  const original = window.getSelection;
  window.getSelection = (() => ({
    toString: () => text,
  })) as unknown as typeof window.getSelection;
  return () => {
    window.getSelection = original;
  };
}

/** 收集 floating-annotation-tool 事件 detail */
function captureFloatingToolEvents() {
  const captured: Array<{ toolType: string; text?: string; color?: string; content?: string }> = [];
  function handler(event: Event) {
    const detail = (event as CustomEvent).detail as { toolType: string; text?: string; color?: string; content?: string };
    captured.push(detail);
  }
  window.addEventListener("floating-annotation-tool", handler);
  return {
    captured,
    dispose: () => window.removeEventListener("floating-annotation-tool", handler),
  };
}

describe("TextSelectionToolbar (ISS-061 stage 1: render contract)", () => {
  test("bounds 为 null 时不渲染任何节点", () => {
    const { container } = render(
      <TextSelectionToolbar bounds={null} onAction={() => undefined} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test("bounds 提供时渲染 7 个动作，未接入的翻译明确 disabled", () => {
    const handler = () => undefined;
    render(
      <TextSelectionToolbar
        bounds={BOUNDS}
        onAction={handler}
        onClose={handler}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(7);
    const labels = buttons.map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "对选中文本应用高亮批注",
      "对选中文本应用下划线批注",
      "对选中文本应用删除线批注",
      "在选中文本旁添加便签",
      "复制选中文本到剪贴板",
      "翻译服务尚未接入",
      "朗读选中文本",
    ]);
    const disabled = buttons.filter((b) => b.hasAttribute("disabled"));
    expect(disabled).toHaveLength(1);
    expect(screen.getByText("翻译").closest("button")).toBeDisabled();
  });

  test("点击启用动作后回调正确（高亮）", () => {
    let captured: string | null = null;
    render(
      <TextSelectionToolbar
        bounds={BOUNDS}
        onAction={(a) => {
          captured = a;
        }}
        onClose={() => undefined}
      />,
    );
    const highlightButton = screen.getByText("高亮");
    highlightButton.click();
    expect(captured).toBe("annotate-highlight");
  });
});

describe("TextSelectionToolbar (ISS-061 stage 2: 自动 draft)", () => {
  test("高亮点击：dispatch floating-annotation-tool 携带 selectedText + color", () => {
    const restore = mockSelection("这是选区");
    const capture = captureFloatingToolEvents();
    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          color="#f6d66f"
          onAction={() => undefined}
          onClose={() => undefined}
        />,
      );
      screen.getByText("高亮").click();
      expect(capture.captured).toHaveLength(1);
      expect(capture.captured[0].toolType).toBe("annotate-highlight");
      expect(capture.captured[0].text).toBe("这是选区");
      expect(capture.captured[0].color).toBe("#f6d66f");
    } finally {
      capture.dispose();
      restore();
    }
  });

  test("下划线点击：dispatch 事件 toolType=annotate-underline + 文本", () => {
    const restore = mockSelection("下划线文本");
    const capture = captureFloatingToolEvents();
    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          color="#22c55e"
          onAction={() => undefined}
          onClose={() => undefined}
        />,
      );
      screen.getByText("下划线").click();
      expect(capture.captured).toHaveLength(1);
      expect(capture.captured[0].toolType).toBe("annotate-underline");
      expect(capture.captured[0].text).toBe("下划线文本");
      expect(capture.captured[0].color).toBe("#22c55e");
    } finally {
      capture.dispose();
      restore();
    }
  });

  test("删除线点击：dispatch 事件 toolType=annotate-strikeout + 文本", () => {
    const restore = mockSelection("待删除");
    const capture = captureFloatingToolEvents();
    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          color="#ef4444"
          onAction={() => undefined}
          onClose={() => undefined}
        />,
      );
      screen.getByText("删除线").click();
      expect(capture.captured).toHaveLength(1);
      expect(capture.captured[0].toolType).toBe("annotate-strikeout");
      expect(capture.captured[0].text).toBe("待删除");
      expect(capture.captured[0].color).toBe("#ef4444");
    } finally {
      capture.dispose();
      restore();
    }
  });

  test("便签点击：dispatch 事件携带 noteContent 作为 content + selectedText 作为 text", () => {
    const restore = mockSelection("原文段落");
    const capture = captureFloatingToolEvents();
    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          color="#facc15"
          noteContent="需要核对证据编号"
          onAction={() => undefined}
          onClose={() => undefined}
        />,
      );
      screen.getByText("便签").click();
      expect(capture.captured).toHaveLength(1);
      expect(capture.captured[0].toolType).toBe("annotate-note");
      expect(capture.captured[0].text).toBe("原文段落");
      expect(capture.captured[0].content).toBe("需要核对证据编号");
      expect(capture.captured[0].color).toBe("#facc15");
    } finally {
      capture.dispose();
      restore();
    }
  });
});

describe("TextSelectionToolbar (ISS-061 stage 2: 翻译 / 朗读)", () => {
  test("翻译未接入时不会写入伪翻译或触发 toast", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onToast = vi.fn();
    const restore = mockSelection("待翻译段落");

    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          onAction={() => undefined}
          onClose={() => undefined}
          onToast={onToast}
        />,
      );
      screen.getByText("翻译").click();
      expect(writeText).not.toHaveBeenCalled();
      expect(onToast).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  test("朗读点击：调用 speechSynthesis.speak(new SpeechSynthesisUtterance(text)) + toast", () => {
    const speak = vi.fn();
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak };
    // jsdom 没有 SpeechSynthesisUtterance，补一个最小构造器让 instanceof + .text 可断言
    class MockUtterance {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    const restore = mockSelection("朗读测试文本");
    const onToast = vi.fn();

    try {
      render(
        <TextSelectionToolbar
          bounds={BOUNDS}
          onAction={() => undefined}
          onClose={() => undefined}
          onToast={onToast}
        />,
      );
      screen.getByText("朗读").click();
      expect(speak).toHaveBeenCalledTimes(1);
      const utterance = speak.mock.calls[0][0] as MockUtterance;
      expect(utterance).toBeInstanceOf(MockUtterance);
      expect(utterance.text).toBe("朗读测试文本");
      expect(onToast).toHaveBeenCalledTimes(1);
      expect(onToast.mock.calls[0][0]).toMatch(/朗读/);
    } finally {
      delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
      delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
      restore();
    }
  });
});
