import { describe, expect, test, beforeEach } from "vitest";
import type { ComponentType } from "react";
import { Download } from "lucide-react";
import {
  _resetToolbarRegistry,
  getModeTools,
  registerModeTools,
  type ToolbarState,
  type ToolbarToolItem,
} from "./toolbarRegistry";

function createStubIcon(): ComponentType<{ size?: number }> {
  return Download as unknown as ComponentType<{ size?: number }>;
}

function makeItem(overrides: Partial<ToolbarToolItem>): ToolbarToolItem {
  return {
    id: "item-1",
    modeId: "annotate",
    order: 0,
    icon: createStubIcon(),
    label: "示例",
    isActive: () => false,
    onClick: () => undefined,
    ...overrides,
  };
}

const stubState = {} as ToolbarState;

describe("toolbarRegistry", () => {
  beforeEach(() => {
    _resetToolbarRegistry();
  });

  test("getModeTools returns an empty array for an unregistered mode", () => {
    expect(getModeTools("annotate")).toEqual([]);
  });

  test("registerModeTools stores items for a mode", () => {
    const item = makeItem({ id: "highlight" });
    registerModeTools("annotate", [item]);

    expect(getModeTools("annotate")).toEqual([item]);
  });

  test("registerModeTools appends items when called multiple times for the same mode", () => {
    const a = makeItem({ id: "a", order: 1 });
    const b = makeItem({ id: "b", order: 0 });

    registerModeTools("annotate", [a]);
    registerModeTools("annotate", [b]);

    expect(getModeTools("annotate")).toEqual([a, b]);
  });

  test("registerModeTools replaces existing items with the same id", () => {
    const initial = makeItem({ id: "same", label: "旧工具", order: 1 });
    const replacement = makeItem({ id: "same", label: "新工具", order: 2 });

    registerModeTools("annotate", [initial]);
    registerModeTools("annotate", [replacement]);

    expect(getModeTools("annotate")).toEqual([replacement]);
  });

  test("registerModeTools keeps registrations across distinct modes isolated", () => {
    const annotateItem = makeItem({ id: "annotate-item", modeId: "annotate" });
    const ocrItem = makeItem({ id: "ocr-item", modeId: "ocr" });

    registerModeTools("annotate", [annotateItem]);
    registerModeTools("ocr", [ocrItem]);

    expect(getModeTools("annotate")).toEqual([annotateItem]);
    expect(getModeTools("ocr")).toEqual([ocrItem]);
  });

  test("getModeTools returns items in registration order without sorting", () => {
    const a = makeItem({ id: "a", order: 99 });
    const b = makeItem({ id: "b", order: -10 });
    const c = makeItem({ id: "c", order: 5 });

    registerModeTools("annotate", [a, b, c]);

    expect(getModeTools("annotate").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("isActive receives the toolbar state passed in by the caller", () => {
    let received: ToolbarState | null = null;
    const item = makeItem({
      id: "check-active",
      isActive: (state) => {
        received = state;
        return false;
      },
    });
    registerModeTools("annotate", [item]);

    item.isActive(stubState);

    expect(received).toBe(stubState);
  });

  test("onClick receives the toolbar state passed in by the caller", () => {
    let received: ToolbarState | null = null;
    const item = makeItem({
      id: "check-click",
      onClick: (state) => {
        received = state;
      },
    });
    registerModeTools("annotate", [item]);

    item.onClick(stubState);

    expect(received).toBe(stubState);
  });

  test("isDisabled is optional and defaults to false when omitted", () => {
    const item = makeItem({ id: "no-disabled-fn" });
    delete (item as { isDisabled?: unknown }).isDisabled;
    registerModeTools("annotate", [item]);

    expect(item.isDisabled).toBeUndefined();
  });

  test("_resetToolbarRegistry clears all registered items", () => {
    registerModeTools("annotate", [makeItem({ id: "a" })]);
    registerModeTools("ocr", [makeItem({ id: "b", modeId: "ocr" })]);

    _resetToolbarRegistry();

    expect(getModeTools("annotate")).toEqual([]);
    expect(getModeTools("ocr")).toEqual([]);
  });
});
