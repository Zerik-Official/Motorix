import { describe, expect, it } from "vitest";

import { isActiveParam, pageEntries, readActiveFilter, readPageNumber } from "./pagination";

describe("pageEntries", () => {
  it("lists every page when there are few", () => {
    expect(pageEntries(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps the first, the last and the neighbours of the current page", () => {
    expect(pageEntries(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("shows a single skipped page instead of a gap", () => {
    expect(pageEntries(4, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10]);
  });
});

describe("address readers", () => {
  it("falls back to the first page on invalid numbers", () => {
    expect(readPageNumber("3")).toBe(3);
    expect(readPageNumber("0")).toBe(1);
    expect(readPageNumber("dos")).toBe(1);
    expect(readPageNumber(null)).toBe(1);
  });

  it("shows active records unless another filter is asked for", () => {
    expect(readActiveFilter(null)).toBe("active");
    expect(readActiveFilter("inactive")).toBe("inactive");
    expect(readActiveFilter("all")).toBe("all");
    expect(readActiveFilter("otro")).toBe("active");
  });

  it("only sends is_active when the filter narrows the list", () => {
    expect(isActiveParam("active")).toBe(true);
    expect(isActiveParam("inactive")).toBe(false);
    expect(isActiveParam("all")).toBeUndefined();
  });
});
