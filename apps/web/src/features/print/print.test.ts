import { describe, expect, it } from "vitest";
import {
  formatLength,
  fromInches,
  megapixels,
  pixelsForPrint,
  printSizeFromPixels,
  toInches,
} from "./print";

describe("print calculations", () => {
  it("converts physical lengths to and from inches", () => {
    expect(toInches(2.54, "cm")).toBeCloseTo(1);
    expect(fromInches(1, "mm")).toBeCloseTo(25.4);
  });

  it("calculates print size from pixels and DPI", () => {
    expect(printSizeFromPixels(3000, 300, "in")).toBeCloseTo(10);
    expect(printSizeFromPixels(3000, 300, "cm")).toBeCloseTo(25.4);
  });

  it("calculates pixels needed for a print size", () => {
    expect(pixelsForPrint(10, "in", 300)).toBe(3000);
    expect(pixelsForPrint(25.4, "cm", 300)).toBe(3000);
  });

  it("formats megapixels and lengths", () => {
    expect(megapixels(4000, 3000)).toBeCloseTo(12);
    expect(formatLength(10, "in")).toBe("10.00 in");
    expect(formatLength(25.4, "cm")).toBe("25.4 cm");
  });
});
