import { describe, expect, it } from "vitest";
import {
  COLLAGE_LAYOUTS,
  COLLAGE_LAYOUT_IDS,
  cellRects,
  contactSheetCells,
  mergeCells,
} from "./layouts";

describe("collage layouts", () => {
  it("covers the full canvas when the gap is zero", () => {
    for (const id of COLLAGE_LAYOUT_IDS) {
      const layout = COLLAGE_LAYOUTS[id];
      const area = layout.cells.reduce((total, cell) => total + cell.width * cell.height, 0);
      expect(area, id).toBeCloseTo(1, 6);
    }
  });

  it("applies an even gap around every cell", () => {
    const rects = cellRects(COLLAGE_LAYOUTS["2x1"], 2000, 1000, 20);
    expect(rects).toEqual([
      { x: 20, y: 20, width: 960, height: 960 },
      { x: 1020, y: 20, width: 960, height: 960 },
    ]);
  });

  it("labels before and after cells", () => {
    const layout = COLLAGE_LAYOUTS["before-after"];
    expect(layout.cells.map((cell) => cell.label)).toEqual(["Before", "After"]);
    expect(layout.requiredImages).toBe(1);
  });
});

describe("contact sheet and merge cells", () => {
  it("builds a contact sheet grid for every image", () => {
    const cells = contactSheetCells(5, 3);
    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 1 / 3, height: 1 / 2 });
    expect(cells[3]).toEqual({ x: 0, y: 0.5, width: 1 / 3, height: 1 / 2 });
    expect(cells[4]).toEqual({ x: 1 / 3, y: 0.5, width: 1 / 3, height: 1 / 2 });
  });

  it("builds horizontal and vertical merge cells", () => {
    expect(mergeCells(2, "horizontal")).toEqual([
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ]);
    expect(mergeCells(2, "vertical")).toEqual([
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ]);
  });
});
