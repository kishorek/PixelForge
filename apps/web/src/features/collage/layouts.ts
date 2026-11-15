export type CollageLayoutId = "2x1" | "1x2" | "2x2" | "1plus2" | "3x1" | "before-after";

export interface CollageCell {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface CollageLayout {
  id: CollageLayoutId;
  label: string;
  cells: CollageCell[];
  defaultWidth: number;
  defaultHeight: number;
  requiredImages: number;
}

export const COLLAGE_LAYOUTS: Record<CollageLayoutId, CollageLayout> = {
  "2x1": {
    id: "2x1",
    label: "2 × 1 — side by side",
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
    defaultWidth: 2400,
    defaultHeight: 1200,
    requiredImages: 2,
  },
  "1x2": {
    id: "1x2",
    label: "1 × 2 — stacked",
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
    defaultWidth: 1200,
    defaultHeight: 2400,
    requiredImages: 2,
  },
  "2x2": {
    id: "2x2",
    label: "2 × 2 — four up",
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
    defaultWidth: 2000,
    defaultHeight: 2000,
    requiredImages: 4,
  },
  "1plus2": {
    id: "1plus2",
    label: "1 + 2 — feature and pair",
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
    defaultWidth: 2400,
    defaultHeight: 1600,
    requiredImages: 3,
  },
  "3x1": {
    id: "3x1",
    label: "3 × 1 — strip",
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 1 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
    ],
    defaultWidth: 3000,
    defaultHeight: 1000,
    requiredImages: 3,
  },
  "before-after": {
    id: "before-after",
    label: "Before / after",
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1, label: "Before" },
      { x: 0.5, y: 0, width: 0.5, height: 1, label: "After" },
    ],
    defaultWidth: 2400,
    defaultHeight: 1200,
    requiredImages: 1,
  },
};

export const COLLAGE_LAYOUT_IDS: CollageLayoutId[] = ["2x1", "1x2", "2x2", "1plus2", "3x1"];

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cellRects(
  layout: CollageLayout,
  canvasWidth: number,
  canvasHeight: number,
  gap: number,
): CellRect[] {
  return normalizedCellRects(layout.cells, canvasWidth, canvasHeight, gap);
}

export function contactSheetCells(count: number, columns: number): CollageCell[] {
  if (count <= 0) return [];
  const safeColumns = Math.max(1, Math.min(8, Math.round(columns)));
  const rows = Math.max(1, Math.ceil(count / safeColumns));
  const cells: CollageCell[] = [];
  for (let index = 0; index < count; index += 1) {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    cells.push({
      x: column / safeColumns,
      y: row / rows,
      width: 1 / safeColumns,
      height: 1 / rows,
    });
  }
  return cells;
}

export function mergeCells(count: number, direction: "horizontal" | "vertical"): CollageCell[] {
  if (count <= 0) return [];
  const cells: CollageCell[] = [];
  for (let index = 0; index < count; index += 1) {
    if (direction === "horizontal") {
      cells.push({ x: index / count, y: 0, width: 1 / count, height: 1 });
    } else {
      cells.push({ x: 0, y: index / count, width: 1, height: 1 / count });
    }
  }
  return cells;
}

export function normalizedCellRects(
  cells: readonly CollageCell[],
  canvasWidth: number,
  canvasHeight: number,
  gap: number,
): CellRect[] {
  return cells.map((cell) => ({
    x: Math.round(cell.x * canvasWidth + gap),
    y: Math.round(cell.y * canvasHeight + gap),
    width: Math.max(1, Math.round(cell.width * canvasWidth - gap * 2)),
    height: Math.max(1, Math.round(cell.height * canvasHeight - gap * 2)),
  }));
}
