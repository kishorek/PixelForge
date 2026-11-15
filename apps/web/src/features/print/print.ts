export type LengthUnit = "in" | "cm" | "mm";

const INCHES_PER_UNIT: Record<LengthUnit, number> = {
  in: 1,
  cm: 2.54,
  mm: 25.4,
};

export function toInches(value: number, unit: LengthUnit): number {
  return value / INCHES_PER_UNIT[unit];
}

export function fromInches(inches: number, unit: LengthUnit): number {
  return inches * INCHES_PER_UNIT[unit];
}

export function printSizeFromPixels(pixels: number, dpi: number, unit: LengthUnit): number {
  if (dpi <= 0 || pixels <= 0) return 0;
  return fromInches(pixels / dpi, unit);
}

export function pixelsForPrint(length: number, unit: LengthUnit, dpi: number): number {
  if (dpi <= 0 || length <= 0) return 0;
  return Math.round(toInches(length, unit) * dpi);
}

export function megapixels(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / 1_000_000;
}

export function formatLength(value: number, unit: LengthUnit): string {
  const precision = unit === "in" ? 2 : 1;
  return `${value.toFixed(precision)} ${unit}`;
}
