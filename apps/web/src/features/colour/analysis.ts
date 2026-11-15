import type { HistogramData } from "../../wasm/loader";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface PaletteColor extends Rgb {
  hex: string;
  count: number;
  share: number;
}

export interface SampleColor extends Rgb {
  a: number;
  hex: string;
}

export interface TransparencyStats {
  transparentFraction: number;
  partialFraction: number;
  opaqueFraction: number;
  minAlpha: number;
  maxAlpha: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export function hexFromRgb(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rf) h = (gf - bf) / delta + (gf < bf ? 6 : 0);
  else if (max === gf) h = (bf - rf) / delta + 2;
  else h = (rf - gf) / delta + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function histogramFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): HistogramData {
  const counts = new Uint32Array(1024);
  const pixels = Math.min(width * height, Math.floor(data.length / 4));
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const luma = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
    counts[r] = (counts[r] ?? 0) + 1;
    counts[256 + g] = (counts[256 + g] ?? 0) + 1;
    counts[512 + b] = (counts[512 + b] ?? 0) + 1;
    counts[768 + luma] = (counts[768 + luma] ?? 0) + 1;
  }
  return {
    r: counts.slice(0, 256),
    g: counts.slice(256, 512),
    b: counts.slice(512, 768),
    luma: counts.slice(768, 1024),
  };
}

interface PaletteSample {
  r: number;
  g: number;
  b: number;
}

function distanceSquared(a: PaletteSample, b: PaletteSample): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function paletteFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  maxColors = 6,
): PaletteColor[] {
  const total = Math.min(width * height, Math.floor(data.length / 4));
  if (total === 0) return [];
  const stride = Math.max(1, Math.floor(total / 6000));
  const samples: PaletteSample[] = [];

  for (let index = 0; index < total; index += stride) {
    const offset = index * 4;
    const alpha = data[offset + 3] ?? 255;
    if (alpha < 16) continue;
    samples.push({
      r: data[offset] ?? 0,
      g: data[offset + 1] ?? 0,
      b: data[offset + 2] ?? 0,
    });
  }

  if (samples.length === 0) return [];
  const count = Math.min(maxColors, samples.length);
  const centroids: PaletteSample[] = [samples[0] as PaletteSample];

  while (centroids.length < count) {
    let bestIndex = -1;
    let bestDistance = -1;
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index] as PaletteSample;
      let nearest = Number.POSITIVE_INFINITY;
      for (const centroid of centroids) {
        nearest = Math.min(nearest, distanceSquared(sample, centroid));
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    if (bestIndex < 0 || bestDistance <= 1) break;
    centroids.push(samples[bestIndex] as PaletteSample);
  }

  const assignments = new Int32Array(samples.length).fill(-1);
  const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let changed = false;
    for (const sum of sums) {
      sum.r = 0;
      sum.g = 0;
      sum.b = 0;
      sum.count = 0;
    }
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index] as PaletteSample;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let centroidIndex = 0; centroidIndex < centroids.length; centroidIndex += 1) {
        const distance = distanceSquared(sample, centroids[centroidIndex] as PaletteSample);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = centroidIndex;
        }
      }
      if (assignments[index] !== best) {
        assignments[index] = best;
        changed = true;
      }
      const sum = sums[best];
      if (sum) {
        sum.r += sample.r;
        sum.g += sample.g;
        sum.b += sample.b;
        sum.count += 1;
      }
    }
    if (!changed && iteration > 0) break;
    for (let centroidIndex = 0; centroidIndex < centroids.length; centroidIndex += 1) {
      const sum = sums[centroidIndex];
      const centroid = centroids[centroidIndex];
      if (!sum || !centroid || sum.count === 0) continue;
      centroid.r = Math.round(sum.r / sum.count);
      centroid.g = Math.round(sum.g / sum.count);
      centroid.b = Math.round(sum.b / sum.count);
    }
  }

  return centroids
    .map((centroid, index) => {
      const sum = sums[index];
      return {
        r: centroid.r,
        g: centroid.g,
        b: centroid.b,
        hex: hexFromRgb(centroid.r, centroid.g, centroid.b),
        count: sum?.count ?? 0,
        share: samples.length > 0 ? (sum?.count ?? 0) / samples.length : 0,
      };
    })
    .filter((colour) => colour.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function transparencyFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): TransparencyStats {
  const total = Math.min(width * height, Math.floor(data.length / 4));
  let transparent = 0;
  let partial = 0;
  let opaque = 0;
  let minAlpha = 255;
  let maxAlpha = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < total; index += 1) {
    const alpha = data[index * 4 + 3] ?? 255;
    if (alpha === 0) transparent += 1;
    else if (alpha < 255) partial += 1;
    else opaque += 1;
    minAlpha = Math.min(minAlpha, alpha);
    maxAlpha = Math.max(maxAlpha, alpha);
    if (alpha > 0) {
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    transparentFraction: total > 0 ? transparent / total : 0,
    partialFraction: total > 0 ? partial / total : 0,
    opaqueFraction: total > 0 ? opaque / total : 0,
    minAlpha,
    maxAlpha,
    bounds:
      maxX >= minX && maxY >= minY
        ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
        : null,
  };
}

export function samplePixel(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): SampleColor | null {
  if (x < 0 || y < 0 || x >= width) return null;
  const offset = (y * width + x) * 4;
  if (offset + 3 >= data.length) return null;
  const r = data[offset] ?? 0;
  const g = data[offset + 1] ?? 0;
  const b = data[offset + 2] ?? 0;
  const a = data[offset + 3] ?? 255;
  return { r, g, b, a, hex: hexFromRgb(r, g, b) };
}
