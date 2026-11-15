import { PixelForgeError } from "@pixelforge/image-contracts";
import type { Operation, ResizeParams } from "@pixelforge/image-contracts";
import { describe, expect, it } from "vitest";
import {
  applyCropToDimensions,
  assertValidOperations,
  buildOutputNames,
  createOperation,
  describeOperation,
  findTargetQuality,
  formatBytes,
  formatFilename,
  operationLabel,
  outputDimensions,
  resizePipeline,
  resolveResize,
  scaledDimensions,
  validateOperation,
} from "./index";

const resize = (overrides: Partial<ResizeParams> = {}): ResizeParams => ({
  width: 1600,
  height: 1200,
  percent: null,
  fit: "stretch",
  resampling: "bilinear",
  lockAspect: true,
  ...overrides,
});

describe("resolveResize", () => {
  it("stretches to exact dimensions", () => {
    expect(resolveResize(resize({ fit: "stretch" }), { width: 4000, height: 3000 })).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("contains within the box while preserving aspect ratio", () => {
    expect(
      resolveResize(resize({ width: 1600, height: 1600, fit: "contain" }), {
        width: 4000,
        height: 3000,
      }),
    ).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("covers the box with exact output dimensions", () => {
    expect(
      resolveResize(resize({ width: 1600, height: 1600, fit: "cover" }), {
        width: 4000,
        height: 3000,
      }),
    ).toEqual({
      width: 1600,
      height: 1600,
    });
  });

  it("scales proportionally by percentage", () => {
    expect(resolveResize(resize({ percent: 50 }), { width: 4000, height: 3000 })).toEqual({
      width: 2000,
      height: 1500,
    });
  });

  it("rejects zero, negative and excessive dimensions", () => {
    for (const width of [0, -5, 100_000]) {
      expect(() => resolveResize(resize({ width }), { width: 4000, height: 3000 })).toThrow(
        PixelForgeError,
      );
    }
  });
});

describe("resizePipeline", () => {
  it("plans a centred crop for cover mode", () => {
    const plan = resizePipeline(resize({ width: 1600, height: 1600, fit: "cover" }), {
      width: 4000,
      height: 3000,
    });
    expect(plan.intermediate).toEqual({ width: 2133, height: 1600 });
    expect(plan.final).toEqual({ width: 1600, height: 1600 });
    expect(plan.crop).not.toBeNull();
    expect(plan.crop?.x).toBeCloseTo(0.125, 2);
    expect(plan.crop?.width).toBeCloseTo(0.75, 2);
  });

  it("does not crop for contain mode", () => {
    const plan = resizePipeline(resize({ width: 1600, height: 1600, fit: "contain" }), {
      width: 4000,
      height: 3000,
    });
    expect(plan.crop).toBeNull();
    expect(plan.final).toEqual({ width: 1600, height: 1200 });
  });
});

describe("dimension helpers", () => {
  it("scales down to the preview limit without upscaling", () => {
    expect(scaledDimensions(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024, scale: 0.512 });
    expect(scaledDimensions(100, 50, 2048)).toEqual({ width: 100, height: 50, scale: 1 });
  });

  it("applies a normalised crop to dimensions", () => {
    expect(
      applyCropToDimensions(
        { width: 4000, height: 3000 },
        { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      ),
    ).toEqual({
      width: 2000,
      height: 1500,
    });
  });

  it("simulates the ordered operation pipeline", () => {
    const operations: Operation[] = [
      {
        id: "1",
        type: "resize",
        enabled: true,
        params: resize({ width: 1600, height: 1600, fit: "contain" }),
      },
      {
        id: "2",
        type: "crop",
        enabled: true,
        params: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      },
      { id: "3", type: "rotate", enabled: true, params: { angle: 90 } },
      { id: "4", type: "flip", enabled: true, params: { direction: "horizontal" } },
    ];
    expect(outputDimensions({ width: 4000, height: 3000 }, operations)).toEqual({
      width: 600,
      height: 800,
    });
  });

  it("ignores disabled operations", () => {
    const operations: Operation[] = [
      { id: "1", type: "rotate", enabled: false, params: { angle: 90 } },
    ];
    expect(outputDimensions({ width: 400, height: 300 }, operations)).toEqual({
      width: 400,
      height: 300,
    });
  });
});

describe("validateOperation", () => {
  it("accepts a valid crop", () => {
    expect(
      validateOperation({
        id: "c",
        type: "crop",
        enabled: true,
        params: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      }),
    ).toEqual([]);
  });

  it("rejects crops that exceed the image bounds", () => {
    const errors = validateOperation({
      id: "c",
      type: "crop",
      enabled: true,
      params: { x: 0.8, y: 0, width: 0.4, height: 1 },
    });
    expect(errors.join(" ")).toMatch(/within/i);
  });

  it("rejects zero-sized crops", () => {
    const errors = validateOperation({
      id: "c",
      type: "crop",
      enabled: true,
      params: { x: 0, y: 0, width: 0, height: 1 },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid watermark opacity", () => {
    const errors = validateOperation({
      id: "w",
      type: "watermark-text",
      enabled: true,
      params: {
        text: "Hi",
        fontFamily: "system-ui",
        sizeRatio: 0.06,
        color: "#fff",
        opacity: 2,
        anchor: "center",
        marginRatio: 0.04,
        tile: false,
      },
    });
    expect(errors.join(" ")).toMatch(/opacity/i);
  });
});

describe("assertValidOperations", () => {
  it("throws a PixelForgeError when an operation is invalid", () => {
    expect(() =>
      assertValidOperations([
        { id: "c", type: "crop", enabled: true, params: { x: 0, y: 0, width: 0, height: 1 } },
      ]),
    ).toThrow(PixelForgeError);
  });
});

describe("createOperation", () => {
  it("creates resize defaults from the source dimensions", () => {
    const op = createOperation("resize", { width: 640, height: 480 });
    expect(op.type).toBe("resize");
    expect(op.params).toMatchObject({
      width: 640,
      height: 480,
      percent: null,
      resampling: "bilinear",
    });
  });

  it("creates a full-frame crop by default", () => {
    const op = createOperation("crop", { width: 640, height: 480 });
    expect(op.params).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe("labels", () => {
  it("labels and describes operations for the UI", () => {
    expect(operationLabel({ id: "r", type: "rotate", enabled: true, params: { angle: 90 } })).toBe(
      "Rotate",
    );
    expect(
      describeOperation({ id: "r", type: "rotate", enabled: true, params: { angle: 270 } }),
    ).toContain("270");
    expect(
      describeOperation({
        id: "f",
        type: "flip",
        enabled: true,
        params: { direction: "horizontal" },
      }),
    ).toMatch(/horizontal/i);
  });
});

describe("formatFilename", () => {
  it("expands supported tokens and a safe base name", () => {
    expect(
      formatFilename("{name}-{width}x{height}", {
        name: "My Photo.JPG",
        width: 1600,
        height: 1200,
        format: "jpeg",
        index: 1,
      }),
    ).toBe("My-Photo-1600x1200.jpg");
  });

  it("supports the index token", () => {
    expect(
      formatFilename("{name}-{index}", {
        name: "a.png",
        width: 10,
        height: 10,
        format: "png",
        index: 3,
      }),
    ).toBe("a-3.png");
  });

  it("sanitises unsafe characters", () => {
    expect(
      formatFilename("{name}", {
        name: "ba<d>:na/me?.png",
        width: 10,
        height: 10,
        format: "png",
        index: 1,
      }),
    ).toBe("ba-d-na-me-.png");
  });
});

describe("buildOutputNames", () => {
  it("resolves collisions deterministically", () => {
    const names = buildOutputNames(
      [
        { name: "a.jpg", width: 10, height: 10, format: "jpeg", index: 1 },
        { name: "a.png", width: 10, height: 10, format: "jpeg", index: 2 },
      ],
      "{name}",
    );
    expect(names).toEqual(["a.jpg", "a-2.jpg"]);
  });

  it("keeps distinct names", () => {
    const names = buildOutputNames(
      [
        { name: "one.png", width: 10, height: 10, format: "png", index: 1 },
        { name: "two.png", width: 10, height: 10, format: "png", index: 2 },
      ],
      "{name}",
    );
    expect(names).toEqual(["one.png", "two.png"]);
  });
});

describe("formatBytes", () => {
  it("formats byte values at sensible units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(500_000)).toBe("488.3 KB");
    expect(formatBytes(1_048_576)).toBe("1 MB");
  });
});

describe("findTargetQuality", () => {
  it("finds a quality that meets the target", async () => {
    const result = await findTargetQuality(async (quality) => Math.round(1000 * quality), 500);
    expect(result.met).toBe(true);
    expect(result.size).toBeLessThanOrEqual(500);
    expect(result.attempts).toBeLessThanOrEqual(8);
  });

  it("reports failure when the target is unreachable", async () => {
    const result = await findTargetQuality(async (quality) => Math.round(1000 * quality), 100, {
      minQuality: 0.3,
      maxQuality: 0.9,
    });
    expect(result.met).toBe(false);
    expect(result.size).toBeGreaterThanOrEqual(300);
  });

  it("returns immediately when the initial quality already fits", async () => {
    const result = await findTargetQuality(async (quality) => Math.round(1000 * quality), 1000);
    expect(result.met).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("respects the iteration limit", async () => {
    let calls = 0;
    await findTargetQuality(
      async (quality) => {
        calls += 1;
        return Math.round(1000 * quality);
      },
      250,
      { maxIterations: 3 },
    );
    expect(calls).toBeLessThanOrEqual(3);
  });
});
