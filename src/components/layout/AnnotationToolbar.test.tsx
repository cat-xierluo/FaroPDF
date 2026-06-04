import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { createInitialAnnotationToolState, type AnnotationToolState } from "../../modules/annotation";

/**
 * Toolbar 是受控组件，外部传入 state 并接收 onStateChange。
 * 真实使用场景是父组件持有 state 并把更新回填给 Toolbar；测试需要同样的行为，
 * 因此用一个 Harness 组件把 onStateChange 桥接到 setState，让渲染结果可见地跟随用户操作。
 */
function ToolbarHarness({
  initial,
  onStateChange,
}: {
  initial?: AnnotationToolState;
  onStateChange: (next: AnnotationToolState) => void;
}) {
  const [state, setState] = useState(initial ?? createInitialAnnotationToolState());
  return (
    <AnnotationToolbar
      onStateChange={(next) => {
        onStateChange(next);
        setState(next);
      }}
      state={state}
    />
  );
}

function renderToolbar(initial?: AnnotationToolState) {
  const initialState = initial ?? createInitialAnnotationToolState();
  const onStateChange = vi.fn();
  const utils = render(<ToolbarHarness initial={initialState} onStateChange={onStateChange} />);
  return { initialState, onStateChange, ...utils };
}

describe("AnnotationToolbar", () => {
  test("渲染 9 个工具按钮", () => {
    renderToolbar();

    const toolsBar = screen.getByRole("toolbar", { name: "批注工具" });
    for (const label of ["高亮", "下划线", "删除线", "备注", "文本框", "矩形", "箭头", "手写", "图章"]) {
      expect(within(toolsBar).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  test("默认状态下没有任何工具被按下", () => {
    renderToolbar();

    expect(screen.queryByRole("button", { name: "高亮", pressed: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
  });

  test("点击工具按钮 arm 该工具并显示取消按钮", async () => {
    const user = userEvent.setup();
    const { onStateChange } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "高亮" }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    const next = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(next.activeToolType).toBe("highlight");
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  test("armed 状态下再次点击同工具不会自动 disarm（由用户点击取消按钮 disarm）", async () => {
    const user = userEvent.setup();
    const { onStateChange, initialState } = renderToolbar({ ...createInitialAnnotationToolState(), activeToolType: "highlight" });

    await user.click(screen.getByRole("button", { name: "高亮" }));

    const next = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(next.activeToolType).toBeNull();
    expect(initialState.activeToolType).toBe("highlight");
  });

  test("切换工具时直接把 activeToolType 切到新工具", async () => {
    const user = userEvent.setup();
    const { onStateChange } = renderToolbar({ ...createInitialAnnotationToolState(), activeToolType: "highlight" });

    await user.click(screen.getByRole("button", { name: "下划线" }));

    const next = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(next.activeToolType).toBe("underline");
  });

  test("点击色板更新 color", async () => {
    const user = userEvent.setup();
    const { onStateChange } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "颜色 蓝" }));

    const next = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(next.color).toBe("#2f80ed");
  });

  test("激活图章工具时显示图章模板与文字输入框", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByRole("button", { name: "图章" }));

    const stampGroup = screen.getByRole("group", { name: "图章选项" });
    for (const label of ["已阅", "重点", "待核", "证据", "自定义"]) {
      expect(within(stampGroup).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(stampGroup).getByLabelText("图章文字")).toBeInTheDocument();
  });

  test("非 stamp 工具时不显示图章选项", () => {
    renderToolbar({ ...createInitialAnnotationToolState(), activeToolType: "highlight" });
    expect(screen.queryByRole("group", { name: "图章选项" })).not.toBeInTheDocument();
  });

  test("修改图章文字会同步写入 state", async () => {
    const user = userEvent.setup();
    const { onStateChange } = renderToolbar({ ...createInitialAnnotationToolState(), activeToolType: "stamp" });

    const input = screen.getByLabelText("图章文字");
    await user.clear(input);
    await user.type(input, "复核");

    const lastCall = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(lastCall.stampLabel).toBe("复核");
  });

  test("切换图章模板回填默认文字", async () => {
    const user = userEvent.setup();
    const { onStateChange } = renderToolbar({ ...createInitialAnnotationToolState(), activeToolType: "stamp" });

    await user.click(screen.getByRole("button", { name: "重点" }));

    const next = (onStateChange.mock.calls.at(-1) as [AnnotationToolState])[0];
    expect(next.stampName).toBe("important");
    expect(next.stampLabel).toBe("重点");
  });

  test("disabled=true 时所有按钮都禁用", () => {
    render(
      <AnnotationToolbar disabled={true} onStateChange={() => undefined} state={createInitialAnnotationToolState()} />,
    );

    expect(screen.getByRole("button", { name: "高亮" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "颜色 黄" })).toBeDisabled();
  });
});

describe("AnnotationToolbar stamp 模板预览（ISS-026 stage 4 milestone 3）", () => {
  test("激活图章工具时，每个 stamp 按钮内嵌 SVG 预览节点", () => {
    render(
      <AnnotationToolbar
        onStateChange={() => undefined}
        state={{ ...createInitialAnnotationToolState(), activeToolType: "stamp" }}
      />,
    );

    const stampGroup = screen.getByRole("group", { name: "图章选项" });
    for (const id of ["reviewed", "important", "todo", "evidence", "custom"]) {
      expect(within(stampGroup).getByTestId(`stamp-preview-${id}`)).toBeInTheDocument();
    }
  });

  test("stamp 预览 viewBox 与 renderStampPreview 子树 0 0 400 100 兼容", () => {
    render(
      <AnnotationToolbar
        onStateChange={() => undefined}
        state={{ ...createInitialAnnotationToolState(), activeToolType: "stamp" }}
      />,
    );
    const preview = screen.getByTestId("stamp-preview-reviewed");
    // closest('svg') 拿到外层 svg 元素，确认 viewBox 已正确写入
    const svg = preview.closest("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 100");
  });

  test("stamp 预览的 SVG 包含模板默认色 + 标签文字", () => {
    render(
      <AnnotationToolbar
        onStateChange={() => undefined}
        state={{ ...createInitialAnnotationToolState(), activeToolType: "stamp" }}
      />,
    );
    const reviewedPreview = screen.getByTestId("stamp-preview-reviewed");
    // innerHTML 包含默认绿色 #1f7a3a + "已阅"
    expect(reviewedPreview.innerHTML).toContain("#1f7a3a");
    expect(reviewedPreview.innerHTML).toContain("已阅");
  });
});
