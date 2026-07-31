import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { PdfAnnotation } from "../../shared/pdf/annotation";
import { AnnotationOverlay } from "./AnnotationOverlay";

const viewport = { width: 600, height: 800 } as const;

describe("AnnotationOverlay shape workflow", () => {
  test("矩形草稿携带右栏的 opacity / stroke / fill 样式", () => {
    const onAnnotationDraft = vi.fn();
    render(
      <AnnotationOverlay
        activeColor="#d04444"
        activeOpacity={0.5}
        activeStyle={{ strokeWidth: 6, strokeStyle: "dashed", fillColor: "#2a8df0" }}
        activeToolType="rectangle"
        annotations={[]}
        onAnnotationDraft={onAnnotationDraft}
        pageIndex={0}
        viewport={viewport}
      />,
    );
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 600,
      top: 0,
      width: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 300, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 300, clientY: 260, pointerId: 1 });

    expect(onAnnotationDraft).toHaveBeenCalledWith({
      type: "rectangle",
      rects: [{ x: 100, y: 540, width: 200, height: 140 }],
      color: "#d04444",
      opacity: 0.5,
      style: { strokeWidth: 6, strokeStyle: "dashed", fillColor: "#2a8df0" },
    });
  });

  test("椭圆与双向箭头按真实 glyph 回显", () => {
    const now = "2026-07-30T00:00:00.000Z";
    const annotations: PdfAnnotation[] = [
      {
        id: "ellipse-1",
        type: "ellipse",
        pageIndex: 0,
        rects: [{ x: 40, y: 60, width: 120, height: 80 }],
        color: "#d04444",
        opacity: 0.5,
        style: { strokeWidth: 4, strokeStyle: "dashed", fillColor: "#2a8df0" },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "double-1",
        type: "double-arrow",
        pageIndex: 0,
        rects: [{ x: 100, y: 200, width: 180, height: 80 }],
        color: "#000000",
        style: { strokeWidth: 3 },
        line: { start: { x: 100, y: 200 }, end: { x: 280, y: 280 } },
        createdAt: now,
        updatedAt: now,
      },
    ];

    render(<AnnotationOverlay annotations={annotations} pageIndex={0} viewport={viewport} />);
    const ellipse = screen.getByLabelText("椭圆");
    expect(ellipse).toHaveStyle({ borderRadius: "50%", border: "4px dashed rgba(208, 68, 68, 0.5)" });
    const doubleArrow = screen.getByLabelText("双向箭头");
    const line = doubleArrow.querySelector("line");
    expect(line).toHaveAttribute("stroke-width", "3");
    expect(doubleArrow.querySelectorAll("polyline")).toHaveLength(2);
  });
});

describe("AnnotationOverlay stamp drag 落点（ISS-NEW-M / ROADMAP L111）", () => {
  test("stamp 工具 drag 出矩形作为签名落点，携带 image/label/name", () => {
    const onAnnotationDraft = vi.fn();
    render(
      <AnnotationOverlay
        activeColor="#f6d66f"
        activeStampName="custom"
        activeStampLabel="我的签名"
        activeStampImage="data:image/png;base64,SGVsbG8="
        activeToolType="stamp"
        annotations={[]}
        onAnnotationDraft={onAnnotationDraft}
        pageIndex={0}
        viewport={viewport}
      />,
    );
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      bottom: 800, height: 800, left: 0, right: 600, top: 0, width: 600, x: 0, y: 0, toJSON: () => ({}),
    });
    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 300, clientY: 320, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 300, clientY: 320, pointerId: 1 });

    expect(onAnnotationDraft).toHaveBeenCalledTimes(1);
    const draft = onAnnotationDraft.mock.calls[0][0];
    expect(draft.type).toBe("stamp");
    // drag 矩形作为落点（200×120，Y 翻转）
    expect(draft.rects[0]).toMatchObject({ x: 100, width: 200 });
    expect(draft.stamp).toMatchObject({
      label: "我的签名",
      name: "custom",
      image: "data:image/png;base64,SGVsbG8=",
    });
  });

  test("stamp drag 太小时给最小尺寸（避免签名不可见）", () => {
    const onAnnotationDraft = vi.fn();
    render(
      <AnnotationOverlay
        activeStampName="reviewed"
        activeStampLabel="已阅"
        activeToolType="stamp"
        annotations={[]}
        onAnnotationDraft={onAnnotationDraft}
        pageIndex={0}
        viewport={viewport}
      />,
    );
    const overlay = screen.getByLabelText("第 1 页批注叠加层");
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      bottom: 800, height: 800, left: 0, right: 600, top: 0, width: 600, x: 0, y: 0, toJSON: () => ({}),
    });
    // 只拖 5×5 像素（极小）
    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 105, clientY: 205, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 105, clientY: 205, pointerId: 1 });

    const draft = onAnnotationDraft.mock.calls[0][0];
    expect(draft.type).toBe("stamp");
    expect(draft.rects[0].width).toBeGreaterThanOrEqual(80);
    expect(draft.rects[0].height).toBeGreaterThanOrEqual(24);
  });
});
