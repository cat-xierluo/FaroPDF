import { describe, expect, test } from "vitest";
import { calculateReaderRenderRange } from "./virtualization";

describe("calculateReaderRenderRange", () => {
  test("keeps continuous reading to the current page and nearby pages", () => {
    expect(
      calculateReaderRenderRange({
        pageCount: 300,
        currentPage: 40,
        viewMode: "continuous",
        overscanPages: 2,
      }),
    ).toEqual({
      startPage: 38,
      endPage: 42,
      pageNumbers: [38, 39, 40, 41, 42],
    });
  });

  test("clamps the range at document boundaries", () => {
    expect(
      calculateReaderRenderRange({
        pageCount: 3,
        currentPage: 1,
        viewMode: "single",
        overscanPages: 5,
      }),
    ).toEqual({
      startPage: 1,
      endPage: 3,
      pageNumbers: [1, 2, 3],
    });
  });

  test("includes the second page in a double-page spread before overscan", () => {
    expect(
      calculateReaderRenderRange({
        pageCount: 50,
        currentPage: 9,
        viewMode: "double",
        overscanPages: 1,
      }),
    ).toEqual({
      startPage: 8,
      endPage: 11,
      pageNumbers: [8, 9, 10, 11],
    });
  });

  test("returns an empty range for an unopened document", () => {
    expect(
      calculateReaderRenderRange({
        pageCount: 0,
        currentPage: 1,
        viewMode: "continuous",
        overscanPages: 2,
      }),
    ).toEqual({
      startPage: 0,
      endPage: 0,
      pageNumbers: [],
    });
  });
});
