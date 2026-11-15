import type { PerceptualHash } from "../../wasm/loader";

export function popcount(value: number): number {
  let current = value >>> 0;
  let count = 0;
  while (current !== 0) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

export function hammingSimilarity(a: PerceptualHash, b: PerceptualHash): { a: number; d: number } {
  const aDistance = popcount(a.aHashLo ^ b.aHashLo) + popcount(a.aHashHi ^ b.aHashHi);
  const dDistance = popcount(a.dHashLo ^ b.dHashLo) + popcount(a.dHashHi ^ b.dHashHi);
  return { a: 1 - aDistance / 64, d: 1 - dDistance / 64 };
}
