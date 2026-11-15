import { describe, expect, it } from "vitest";
import { quantizePixels } from "./quantize";

function uniqueColours(data: Uint8ClampedArray): Set<string> {
  const colours = new Set<string>();
  for (let index = 0; index < data.length; index += 4) {
    colours.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
  }
  return colours;
}

describe("quantizePixels", () => {
  it("reduces a gradient to the requested palette size", () => {
    const width = 8;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      data[offset] = (index * 31) % 256;
      data[offset + 1] = (index * 67) % 256;
      data[offset + 2] = (index * 97) % 256;
      data[offset + 3] = 255;
    }
    const output = quantizePixels(data, width, height, { colors: 2, dither: "none" });
    expect(uniqueColours(output).size).toBeLessThanOrEqual(2);
    expect(output[3]).toBe(255);
  });

  it("preserves alpha and uses palette colours with dithering", () => {
    const width = 6;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      data[offset] = (index * 40) % 256;
      data[offset + 1] = (index * 20) % 256;
      data[offset + 2] = 128;
      data[offset + 3] = index === 0 ? 100 : 255;
    }
    const output = quantizePixels(data, width, height, {
      colors: 4,
      dither: "floyd-steinberg",
    });
    expect(output[3]).toBe(100);
    expect(uniqueColours(output).size).toBeLessThanOrEqual(4);
  });

  it("returns a solid colour unchanged in practice", () => {
    const data = new Uint8ClampedArray([
      30, 60, 90, 255, 30, 60, 90, 255, 30, 60, 90, 255, 30, 60, 90, 255,
    ]);
    const output = quantizePixels(data, 2, 2, { colors: 2, dither: "ordered" });
    expect([...output.slice(0, 4)]).toEqual([30, 60, 90, 255]);
  });
});
