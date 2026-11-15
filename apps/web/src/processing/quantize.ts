import { type Rgb, paletteFromPixels } from "../features/colour/analysis";

export type DitherMode = "none" | "floyd-steinberg" | "ordered";

export interface QuantizeOptions {
  colors: number;
  dither: DitherMode;
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function nearestColour(palette: readonly Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0] ?? { r: 0, g: 0, b: 0 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const colour of palette) {
    const dr = r - colour.r;
    const dg = g - colour.g;
    const db = b - colour.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = colour;
    }
  }
  return best;
}

export function quantizePixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: QuantizeOptions,
): Uint8ClampedArray {
  const total = width * height;
  const palette = paletteFromPixels(data, width, height, Math.max(2, Math.min(64, options.colors)));
  if (palette.length === 0) return new Uint8ClampedArray(data.length);
  const output = new Uint8ClampedArray(data.length);
  const errors = new Float32Array(total * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      let r = data[offset] ?? 0;
      let g = data[offset + 1] ?? 0;
      let b = data[offset + 2] ?? 0;
      const errorOffset = pixel * 3;

      if (options.dither === "ordered") {
        const threshold = ((BAYER_4[(y % 4) * 4 + (x % 4)] ?? 0) / 16 - 0.5) * 64;
        r += threshold;
        g += threshold;
        b += threshold;
      } else if (options.dither === "floyd-steinberg") {
        r += errors[errorOffset] ?? 0;
        g += errors[errorOffset + 1] ?? 0;
        b += errors[errorOffset + 2] ?? 0;
      }

      const chosen = nearestColour(palette, r, g, b);
      output[offset] = chosen.r;
      output[offset + 1] = chosen.g;
      output[offset + 2] = chosen.b;
      output[offset + 3] = data[offset + 3] ?? 255;

      if (options.dither === "floyd-steinberg") {
        const redError = r - chosen.r;
        const greenError = g - chosen.g;
        const blueError = b - chosen.b;
        const distribute = (target: number, factor: number) => {
          if (target < 0 || target >= total) return;
          const targetOffset = target * 3;
          errors[targetOffset] = (errors[targetOffset] ?? 0) + redError * factor;
          errors[targetOffset + 1] = (errors[targetOffset + 1] ?? 0) + greenError * factor;
          errors[targetOffset + 2] = (errors[targetOffset + 2] ?? 0) + blueError * factor;
        };
        if (x + 1 < width) distribute(pixel + 1, 7 / 16);
        if (y + 1 < height) {
          if (x > 0) distribute(pixel + width - 1, 3 / 16);
          distribute(pixel + width, 5 / 16);
          if (x + 1 < width) distribute(pixel + width + 1, 1 / 16);
        }
      }
    }
  }

  return output;
}
