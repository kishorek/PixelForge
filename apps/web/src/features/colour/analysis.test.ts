import { describe, expect, it } from "vitest";
import {
  hexFromRgb,
  histogramFromPixels,
  paletteFromPixels,
  rgbToHsl,
  samplePixel,
} from "./analysis";

const pixels = (values: number[]) => new Uint8ClampedArray(values);

describe("histogramFromPixels", () => {
  it("counts channels and luminance", () => {
    const data = pixels([255, 0, 0, 255, 0, 0, 0, 255]);
    const histogram = histogramFromPixels(data, 2, 1);
    expect(histogram.r[255]).toBe(1);
    expect(histogram.g[0]).toBe(2);
    expect(histogram.b[0]).toBe(2);
    expect(histogram.luma[0]).toBe(1);
    expect(histogram.luma[54]).toBe(1);
  });
});

describe("paletteFromPixels", () => {
  it("returns dominant colours with shares", () => {
    const data = pixels([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]);
    const palette = paletteFromPixels(data, 2, 2, 3);
    expect(palette[0]?.hex).toBe("#ff0000");
    expect(palette[0]?.share).toBeCloseTo(2 / 3, 2);
    expect(palette[1]?.hex).toBe("#0000ff");
  });
});

describe("colour helpers", () => {
  it("formats hex values", () => {
    expect(hexFromRgb(176, 61, 22)).toBe("#b03d16");
  });

  it("converts RGB to HSL", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });

  it("samples a pixel", () => {
    const data = pixels([10, 20, 30, 255, 40, 50, 60, 128]);
    expect(samplePixel(data, 2, 1, 0)).toMatchObject({ r: 40, g: 50, b: 60, a: 128 });
    expect(samplePixel(data, 2, 5, 0)).toBeNull();
  });
});

describe("transparencyFromPixels", () => {
  it("reports alpha fractions and content bounds", async () => {
    const { transparencyFromPixels } = await import("./analysis");
    const data = pixels([10, 10, 10, 0, 20, 20, 20, 128, 30, 30, 30, 255, 40, 40, 40, 255]);
    const stats = transparencyFromPixels(data, 2, 2);
    expect(stats.transparentFraction).toBeCloseTo(0.25);
    expect(stats.partialFraction).toBeCloseTo(0.25);
    expect(stats.opaqueFraction).toBeCloseTo(0.5);
    expect(stats.minAlpha).toBe(0);
    expect(stats.maxAlpha).toBe(255);
    expect(stats.bounds).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  it("returns null bounds when the image is fully transparent", async () => {
    const { transparencyFromPixels } = await import("./analysis");
    const stats = transparencyFromPixels(pixels([0, 0, 0, 0, 0, 0, 0, 0]), 2, 1);
    expect(stats.transparentFraction).toBe(1);
    expect(stats.bounds).toBeNull();
  });
});
