import { describe, expect, it } from "vitest";
import { hammingSimilarity, popcount } from "./compare-math";

describe("comparison metrics", () => {
  it("counts set bits", () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0b1011)).toBe(3);
    expect(popcount(0xffffffff)).toBe(32);
  });

  it("reports full similarity for identical hashes", () => {
    const hash = { aHashLo: 1, aHashHi: 2, dHashLo: 4, dHashHi: 8 };
    expect(hammingSimilarity(hash, hash)).toEqual({ a: 1, d: 1 });
  });

  it("reports zero similarity for opposite hashes", () => {
    const a = { aHashLo: 0, aHashHi: 0, dHashLo: 0, dHashHi: 0 };
    const b = {
      aHashLo: 0xffffffff,
      aHashHi: 0xffffffff,
      dHashLo: 0xffffffff,
      dHashHi: 0xffffffff,
    };
    expect(hammingSimilarity(a, b)).toEqual({ a: 0, d: 0 });
  });
});
