import { clamp } from "./dimensions";

export interface TargetQualityOptions {
  minQuality?: number;
  maxQuality?: number;
  initialQuality?: number;
  maxIterations?: number;
}

export interface TargetQualityResult {
  quality: number;
  size: number;
  met: boolean;
  attempts: number;
}

export type SizeEncoder = (quality: number) => Promise<number>;

function quantise(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function findTargetQuality(
  encode: SizeEncoder,
  targetBytes: number,
  options: TargetQualityOptions = {},
): Promise<TargetQualityResult> {
  const minQuality = clamp(options.minQuality ?? 0.3, 0.01, 1);
  const maxQuality = clamp(options.maxQuality ?? 0.95, minQuality, 1);
  const initialQuality = clamp(options.initialQuality ?? maxQuality, minQuality, maxQuality);
  const maxIterations = Math.max(1, Math.floor(options.maxIterations ?? 7));

  if (!Number.isFinite(targetBytes) || targetBytes <= 0) {
    throw new RangeError("Target size must be a positive number of bytes.");
  }

  let attempts = 0;
  const size = await encode(initialQuality);
  attempts += 1;
  let bestRejected: TargetQualityResult = { quality: initialQuality, size, met: false, attempts };

  if (size <= targetBytes) {
    return { quality: initialQuality, size, met: true, attempts };
  }

  let low = minQuality;
  let high = initialQuality - 0.001;
  let bestAccepted: { quality: number; size: number } | null = null;

  while (attempts < maxIterations && low <= high) {
    const mid = quantise((low + high) / 2);
    const candidate = await encode(mid);
    attempts += 1;
    if (candidate < bestRejected.size) {
      bestRejected = { quality: mid, size: candidate, met: false, attempts };
    }
    if (candidate <= targetBytes) {
      bestAccepted = { quality: mid, size: candidate };
      low = mid + 0.001;
    } else {
      high = mid - 0.001;
    }
  }

  if (bestAccepted) {
    return { ...bestAccepted, met: true, attempts };
  }
  return { ...bestRejected, attempts };
}
