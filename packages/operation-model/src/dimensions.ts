import { LIMITS, PixelForgeError } from "@pixelforge/image-contracts";
import type { CropParams, Dimensions, FitMode, ResizeParams } from "@pixelforge/image-contracts";

export interface ResizePlan {
  intermediate: Dimensions;
  crop: CropParams | null;
  final: Dimensions;
}

export function invalidInput(message: string, hint: string): never {
  throw new PixelForgeError("INVALID_INPUT", message, hint);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function assertTargetDimension(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    invalidInput(`${label} must be greater than zero.`, "Enter a positive pixel dimension.");
  }
  if (value > LIMITS.maxDimension) {
    invalidInput(
      `${label} exceeds the supported maximum of ${LIMITS.maxDimension} pixels.`,
      "Choose a smaller dimension or resize in stages.",
    );
  }
}

function assertPercent(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1000) {
    invalidInput("Scale percentage must be between 0 and 1000.", "Enter a percentage such as 50.");
  }
}

function positiveRound(value: number): number {
  return Math.max(1, Math.round(value));
}

export function resolveResize(params: ResizeParams, source: Dimensions): Dimensions {
  if (source.width <= 0 || source.height <= 0) {
    invalidInput("The source image has invalid dimensions.", "Import a different image.");
  }

  if (params.percent !== null) {
    assertPercent(params.percent);
    return {
      width: positiveRound((source.width * params.percent) / 100),
      height: positiveRound((source.height * params.percent) / 100),
    };
  }

  assertTargetDimension(params.width, "Width");
  assertTargetDimension(params.height, "Height");

  if (params.fit === "stretch") {
    return { width: positiveRound(params.width), height: positiveRound(params.height) };
  }

  if (params.fit === "cover") {
    return { width: positiveRound(params.width), height: positiveRound(params.height) };
  }

  const scale = Math.min(params.width / source.width, params.height / source.height);
  return {
    width: positiveRound(source.width * scale),
    height: positiveRound(source.height * scale),
  };
}

export function resizePipeline(params: ResizeParams, source: Dimensions): ResizePlan {
  const final = resolveResize(params, source);
  if (params.percent !== null || params.fit !== "cover") {
    return { intermediate: final, crop: null, final };
  }

  const scale = Math.max(params.width / source.width, params.height / source.height);
  const intermediate = {
    width: positiveRound(source.width * scale),
    height: positiveRound(source.height * scale),
  };
  const cropWidth = clamp(final.width / intermediate.width, 0, 1);
  const cropHeight = clamp(final.height / intermediate.height, 0, 1);
  return {
    intermediate,
    crop: {
      x: clamp((1 - cropWidth) / 2, 0, 1),
      y: clamp((1 - cropHeight) / 2, 0, 1),
      width: cropWidth,
      height: cropHeight,
    },
    final,
  };
}

export function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): Dimensions & { scale: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height, scale: 1 };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function applyCropToDimensions(dimensions: Dimensions, crop: CropParams): Dimensions {
  return {
    width: Math.max(1, Math.round(dimensions.width * clamp01(crop.width))),
    height: Math.max(1, Math.round(dimensions.height * clamp01(crop.height))),
  };
}

export function outputDimensions(
  source: Dimensions,
  operations: readonly OperationLike[],
): Dimensions {
  let current = { width: source.width, height: source.height };
  for (const operation of operations) {
    if (!operation.enabled) continue;
    switch (operation.type) {
      case "resize":
        current = resolveResize(operation.params, current);
        break;
      case "crop":
        current = applyCropToDimensions(current, operation.params);
        break;
      case "rotate": {
        const normalized = ((operation.params.angle % 360) + 360) % 360;
        if (normalized === 90 || normalized === 270) {
          current = { width: current.height, height: current.width };
        } else if (normalized !== 0 && normalized !== 180) {
          const radians = (normalized * Math.PI) / 180;
          const cosine = Math.abs(Math.cos(radians));
          const sine = Math.abs(Math.sin(radians));
          current = {
            width: Math.max(1, Math.round(current.width * cosine + current.height * sine)),
            height: Math.max(1, Math.round(current.width * sine + current.height * cosine)),
          };
        }
        break;
      }
      case "flip":
      case "watermark-text":
      case "watermark-image":
      case "adjust":
      case "filter":
      case "shape":
      case "border":
      case "chroma-key":
      case "warp":
      case "mask-effect":
      case "quantize":
        break;
    }
  }
  return current;
}

type OperationLike =
  | { type: "resize"; enabled: boolean; params: ResizeParams }
  | { type: "crop"; enabled: boolean; params: CropParams }
  | { type: "rotate"; enabled: boolean; params: { angle: number; background?: string | null } }
  | { type: "flip"; enabled: boolean; params: { direction: "horizontal" | "vertical" } }
  | { type: "watermark-text"; enabled: boolean; params: unknown }
  | { type: "watermark-image"; enabled: boolean; params: unknown }
  | { type: "adjust"; enabled: boolean; params: unknown }
  | { type: "filter"; enabled: boolean; params: unknown }
  | { type: "shape"; enabled: boolean; params: unknown }
  | { type: "border"; enabled: boolean; params: unknown }
  | { type: "chroma-key"; enabled: boolean; params: unknown }
  | { type: "warp"; enabled: boolean; params: unknown }
  | { type: "mask-effect"; enabled: boolean; params: unknown }
  | { type: "quantize"; enabled: boolean; params: unknown };

export const FIT_MODES: readonly FitMode[] = ["contain", "cover", "stretch"];
export const RESAMPLING_METHODS = [
  "nearest",
  "bilinear",
  "box",
  "lanczos3",
  "catmull-rom",
] as const;
