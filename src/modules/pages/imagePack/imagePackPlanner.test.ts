import { describe, expect, test } from "vitest";
import { A4_LANDSCAPE_SIZE_PT, A4_PORTRAIT_SIZE_PT } from "../../../shared";
import {
  createImagePackPlan,
  suggestImagePackOutputPath,
} from "./imagePackPlanner";

const FIXED_TIME = "2026-06-02T00:00:00.000Z";

function portraitItem(id: string, overrides: Partial<{ width: number; height: number; sourcePath: string }> = {}) {
  return {
    id,
    source: "image" as const,
    width: overrides.width ?? 600,
    height: overrides.height ?? 800,
    ...(overrides.sourcePath ? { sourcePath: overrides.sourcePath } : {}),
  };
}

function landscapeItem(id: string, overrides: Partial<{ width: number; height: number; sourcePath: string }> = {}) {
  return {
    id,
    source: "image" as const,
    width: overrides.width ?? 800,
    height: overrides.height ?? 600,
    ...(overrides.sourcePath ? { sourcePath: overrides.sourcePath } : {}),
  };
}

function pdfPageItem(id: string, sourcePath: string, width: number, height: number, sourcePageIndex = 0) {
  return {
    id,
    source: "pdf-page" as const,
    sourcePath,
    sourcePageIndex,
    width,
    height,
  };
}

describe("imagePackPlanner - auto per-page", () => {
  test("portrait-majority items with auto per-page default to 3 items per A4 page", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), portraitItem("p2"), portraitItem("p3"), portraitItem("p4"), portraitItem("p5"), portraitItem("p6"), portraitItem("p7")],
      options: { itemsPerPage: "auto", orientation: "auto", margin: 25 },
      outputPath: "/case/evidence/portrait-pack.pdf",
      id: "pack-portrait-auto",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.itemsPerPage).toBe(3);
    expect(plan.options.itemsPerPageOption).toBe("auto");
    expect(plan.summary.itemsPerPage).toBe(3);
    expect(plan.summary.inputItemCount).toBe(7);
    expect(plan.summary.outputPageCount).toBe(3);
    expect(plan.summary.portraitItemCount).toBe(7);
    expect(plan.pages).toHaveLength(3);
    expect(plan.pages[0].cells).toHaveLength(3);
    expect(plan.pages[1].cells).toHaveLength(3);
    expect(plan.pages[2].cells).toHaveLength(1);
    expect(plan.pages[0].width).toBe(842);
    expect(plan.pages[0].height).toBe(595);
    expect(plan.pages[0].orientation).toBe("landscape");
  });

  test("landscape-majority items with auto per-page default to 1 item per A4 page", () => {
    const plan = createImagePackPlan({
      items: [landscapeItem("l1"), landscapeItem("l2"), landscapeItem("l3"), portraitItem("p1")],
      options: { itemsPerPage: "auto", orientation: "auto", margin: 25 },
      outputPath: "/case/evidence/landscape-pack.pdf",
      id: "pack-landscape-auto",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.itemsPerPage).toBe(1);
    expect(plan.summary.itemsPerPage).toBe(1);
    expect(plan.summary.outputPageCount).toBe(4);
    expect(plan.summary.landscapeItemCount).toBe(3);
    expect(plan.summary.portraitItemCount).toBe(1);
    expect(plan.pages).toHaveLength(4);
    expect(plan.pages[0].cells).toHaveLength(1);
    expect(plan.pages[0].width).toBe(842);
    expect(plan.pages[0].height).toBe(595);
    expect(plan.pages[0].orientation).toBe("landscape");
  });

  test("auto per-page with even portrait/landscape split falls back to portrait 3 per page", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), landscapeItem("l1")],
      options: { itemsPerPage: "auto" },
      outputPath: "/case/evidence/tie-pack.pdf",
      id: "pack-tie-auto",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.itemsPerPage).toBe(3);
    expect(plan.summary.itemsPerPage).toBe(3);
  });
});

describe("imagePackPlanner - explicit per-page and orientation", () => {
  test("explicit 2 items per page lays out 2 columns of 1 row", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), portraitItem("p2"), portraitItem("p3"), portraitItem("p4")],
      options: { itemsPerPage: 2, orientation: "portrait", margin: 25 },
      outputPath: "/case/evidence/2pack.pdf",
      id: "pack-2",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.itemsPerPage).toBe(2);
    expect(plan.summary.outputPageCount).toBe(2);
    expect(plan.pages[0].width).toBe(595);
    expect(plan.pages[0].height).toBe(842);
    expect(plan.pages[0].orientation).toBe("portrait");
    expect(plan.pages[0].cells).toHaveLength(2);
    expect(plan.pages[1].cells).toHaveLength(2);
  });

  test("explicit 4 items per page lays out 4 columns in a single row", () => {
    const plan = createImagePackPlan({
      items: [
        portraitItem("p1"),
        portraitItem("p2"),
        portraitItem("p3"),
        portraitItem("p4"),
        portraitItem("p5"),
        portraitItem("p6"),
        portraitItem("p7"),
        portraitItem("p8"),
      ],
      options: { itemsPerPage: 4, orientation: "landscape", margin: 20 },
      outputPath: "/case/evidence/4pack.pdf",
      id: "pack-4",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.itemsPerPage).toBe(4);
    expect(plan.summary.outputPageCount).toBe(2);
    expect(plan.pages[0].cells).toHaveLength(4);
    expect(plan.pages[0].width).toBe(842);
    expect(plan.pages[0].height).toBe(595);
    expect(plan.pages[0].orientation).toBe("landscape");
  });

  test("orientation auto with itemsPerPage=1 picks orientation per item", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), landscapeItem("l1")],
      options: { itemsPerPage: 1, orientation: "auto", margin: 25, sort: "none" },
      outputPath: "/case/evidence/per-item.pdf",
      id: "pack-per-item",
      createdAt: FIXED_TIME,
    });

    expect(plan.pages[0].orientation).toBe("portrait");
    expect(plan.pages[0].width).toBe(A4_PORTRAIT_SIZE_PT.width);
    expect(plan.pages[0].height).toBe(A4_PORTRAIT_SIZE_PT.height);
    expect(plan.pages[1].orientation).toBe("landscape");
    expect(plan.pages[1].width).toBe(A4_LANDSCAPE_SIZE_PT.width);
    expect(plan.pages[1].height).toBe(A4_LANDSCAPE_SIZE_PT.height);
    expect(plan.summary.orientationPageCounts).toEqual({ portrait: 1, landscape: 1 });
  });

  test("orientation auto with itemsPerPage>=2 uses a single fixed orientation for every page", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), portraitItem("p2"), portraitItem("p3"), portraitItem("p4")],
      options: { itemsPerPage: 3, orientation: "auto", margin: 25 },
      outputPath: "/case/evidence/auto-multi.pdf",
      id: "pack-auto-multi",
      createdAt: FIXED_TIME,
    });

    const orientations = new Set(plan.pages.map((page) => page.orientation));
    expect(orientations.size).toBe(1);
    expect(plan.summary.orientationPageCounts.portrait + plan.summary.orientationPageCounts.landscape).toBe(
      plan.summary.outputPageCount,
    );
  });
});

describe("imagePackPlanner - cell layout and margins", () => {
  test("cells preserve item aspect ratio and stay inside the page margin", () => {
    const margin = 25;
    const plan = createImagePackPlan({
      items: [portraitItem("p1", { width: 600, height: 800 }), portraitItem("p2", { width: 1200, height: 1600 })],
      options: { itemsPerPage: 2, orientation: "portrait", margin },
      outputPath: "/case/evidence/layout.pdf",
      id: "pack-layout",
      createdAt: FIXED_TIME,
    });

    const cell = plan.pages[0].cells[0];
    const inputItem = plan.items[0];
    const expectedRatio = inputItem.width / inputItem.height;
    const actualRatio = cell.width / cell.height;
    expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(1e-9);

    expect(cell.x).toBeGreaterThanOrEqual(margin - 1e-9);
    expect(cell.y).toBeGreaterThanOrEqual(margin - 1e-9);
    expect(cell.x + cell.width).toBeLessThanOrEqual(plan.pages[0].width - margin + 1e-9);
    expect(cell.y + cell.height).toBeLessThanOrEqual(plan.pages[0].height - margin + 1e-9);
  });

  test("default margin is 25pt when none is provided", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1")],
      outputPath: "/case/evidence/default-margin.pdf",
      id: "pack-default-margin",
      createdAt: FIXED_TIME,
    });

    expect(plan.options.margin).toBe(25);
  });
});

describe("imagePackPlanner - output path safety", () => {
  test("suggestImagePackOutputPath adds -evidence-pack.pdf next to the first input", () => {
    expect(suggestImagePackOutputPath("/case/evidence/photo-1.png")).toBe("/case/evidence/photo-1-evidence-pack.pdf");
    expect(suggestImagePackOutputPath("/case/evidence/photo-1.PDF")).toBe("/case/evidence/photo-1-evidence-pack.pdf");
    expect(suggestImagePackOutputPath("/case/evidence/source.pdf")).toBe("/case/evidence/source-evidence-pack.pdf");
  });

  test("rejects output path equal to any input source path", () => {
    const items = [portraitItem("p1", { sourcePath: "/case/evidence/photo-1.png" }), portraitItem("p2")];
    expect(() =>
      createImagePackPlan({
        items,
        options: { itemsPerPage: 2 },
        outputPath: "/case/evidence/photo-1.png",
        id: "pack-unsafe",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });

  test("rejects non-absolute output path", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 1 },
        outputPath: "relative/evidence-pack.pdf",
        id: "pack-relative",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });

  test("rejects output path that is not a PDF", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 1 },
        outputPath: "/case/evidence/result.docx",
        id: "pack-docx",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });
});

describe("imagePackPlanner - invalid inputs", () => {
  test("rejects empty items", () => {
    expect(() =>
      createImagePackPlan({
        items: [],
        options: { itemsPerPage: 1 },
        outputPath: "/case/evidence/empty.pdf",
        id: "pack-empty",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });

  test("rejects itemsPerPage outside 1..4", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 5 as never },
        outputPath: "/case/evidence/5pack.pdf",
        id: "pack-5",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();

    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 0 as never },
        outputPath: "/case/evidence/0pack.pdf",
        id: "pack-0",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });

  test("rejects negative margin", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 1, margin: -1 },
        outputPath: "/case/evidence/neg.pdf",
        id: "pack-neg",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });

  test("rejects items with non-positive or non-finite width/height", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1", { width: 0 })],
        options: { itemsPerPage: 1 },
        outputPath: "/case/evidence/zero.pdf",
        id: "pack-zero",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();

    expect(() =>
      createImagePackPlan({
        items: [{ ...portraitItem("p1"), height: Number.NaN }],
        options: { itemsPerPage: 1 },
        outputPath: "/case/evidence/nan.pdf",
        id: "pack-nan",
        createdAt: FIXED_TIME,
      }),
    ).toThrow();
  });
});

describe("imagePackPlanner - output path derivation when no source path is available", () => {
  test("suggestImagePackOutputPath(undefined) returns 'evidence-pack.pdf' without a leading dash", () => {
    expect(suggestImagePackOutputPath(undefined)).toBe("evidence-pack.pdf");
    expect(suggestImagePackOutputPath("")).toBe("evidence-pack.pdf");
    expect(suggestImagePackOutputPath("   ")).toBe("evidence-pack.pdf");
  });

  test("createImagePackPlan throws a clear error when no sourcePath is available and no outputPath is provided", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1"), portraitItem("p2")],
        options: { itemsPerPage: 2 },
        id: "pack-no-source",
        createdAt: FIXED_TIME,
      }),
    ).toThrow(/证据图片输出路径无法自动推导/);
  });
});

describe("imagePackPlanner - margin must keep cells positive for the chosen layout", () => {
  test("rejects margin that makes 4-per-page landscape cells non-positive", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1"), portraitItem("p2"), portraitItem("p3"), portraitItem("p4")],
        options: { itemsPerPage: 4, orientation: "landscape", margin: 200 },
        outputPath: "/case/evidence/margin4land.pdf",
        id: "pack-margin-4-land",
        createdAt: FIXED_TIME,
      }),
    ).toThrow(/margin 200 过大/);
  });

  test("rejects margin that makes 1-per-page portrait cells non-positive", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 1, orientation: "portrait", margin: 300 },
        outputPath: "/case/evidence/margin1port.pdf",
        id: "pack-margin-1-port",
        createdAt: FIXED_TIME,
      }),
    ).toThrow(/margin 300 过大/);
  });

  test("rejects margin that would break orientation=auto per_page=1 across both A4 dimensions", () => {
    expect(() =>
      createImagePackPlan({
        items: [portraitItem("p1")],
        options: { itemsPerPage: 1, orientation: "auto", margin: 300 },
        outputPath: "/case/evidence/margin-auto.pdf",
        id: "pack-margin-auto",
        createdAt: FIXED_TIME,
      }),
    ).toThrow(/margin 300 过大/);
  });
});

describe("imagePackPlanner - sort=time warning", () => {
  test("includes a warning when sort='time' is used because the plan model has no mtime", () => {
    const plan = createImagePackPlan({
      items: [portraitItem("p1"), portraitItem("p2"), portraitItem("p3")],
      options: { itemsPerPage: 3, sort: "time" },
      outputPath: "/case/evidence/time-pack.pdf",
      id: "pack-time",
      createdAt: FIXED_TIME,
    });

    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toMatch(/sort=time/);
    expect(plan.warnings[0]).toMatch(/保持输入顺序/);
    expect(plan.items.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
  });

  test("does not warn for sort='name' or sort='none'", () => {
    const namePlan = createImagePackPlan({
      items: [portraitItem("p1")],
      options: { itemsPerPage: 1, sort: "name" },
      outputPath: "/case/evidence/name-pack.pdf",
      id: "pack-name",
      createdAt: FIXED_TIME,
    });
    const nonePlan = createImagePackPlan({
      items: [portraitItem("p1")],
      options: { itemsPerPage: 1, sort: "none" },
      outputPath: "/case/evidence/none-pack.pdf",
      id: "pack-none",
      createdAt: FIXED_TIME,
    });

    expect(namePlan.warnings).toEqual([]);
    expect(nonePlan.warnings).toEqual([]);
  });
});

describe("imagePackPlanner - sort strategies and mixed sources", () => {
  test("sort=name orders items by their label or id when labels are present", () => {
    const plan = createImagePackPlan({
      items: [
        { ...portraitItem("p1"), label: "Charlie" },
        { ...portraitItem("p2"), label: "Alpha" },
        { ...portraitItem("p3"), label: "Bravo" },
      ],
      options: { itemsPerPage: 3, sort: "name" },
      outputPath: "/case/evidence/sorted.pdf",
      id: "pack-sorted",
      createdAt: FIXED_TIME,
    });

    expect(plan.items.map((item) => item.label)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  test("accepts mixed image and pdf-page items", () => {
    const plan = createImagePackPlan({
      items: [
        portraitItem("img-1"),
        pdfPageItem("pdf-1", "/case/source.pdf", 612, 792, 0),
        pdfPageItem("pdf-2", "/case/source.pdf", 612, 792, 1),
      ],
      options: { itemsPerPage: "auto" },
      outputPath: "/case/evidence/mixed.pdf",
      id: "pack-mixed",
      createdAt: FIXED_TIME,
    });

    expect(plan.items).toHaveLength(3);
    expect(plan.summary.portraitItemCount).toBe(3);
    expect(plan.items.filter((item) => item.source === "pdf-page")).toHaveLength(2);
  });
});
