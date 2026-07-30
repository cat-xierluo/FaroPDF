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
