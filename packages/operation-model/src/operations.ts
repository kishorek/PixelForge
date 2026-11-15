import { PixelForgeError } from "@pixelforge/image-contracts";
import type {
  CropParams,
  Dimensions,
  ImageWatermarkParams,
  Operation,
  OperationType,
  ResizeParams,
  TextWatermarkParams,
} from "@pixelforge/image-contracts";
import { RESAMPLING_METHODS, clamp01, invalidInput } from "./dimensions";

let operationCounter = 0;

function nextId(): string {
  operationCounter += 1;
  return `op-${Date.now().toString(36)}-${operationCounter}`;
}

export const DEFAULT_TEXT_WATERMARK: Omit<TextWatermarkParams, "text"> = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  sizeRatio: 0.06,
  color: "#ffffff",
  opacity: 0.8,
  anchor: "bottom-right",
  marginRatio: 0.04,
  tile: false,
};

export const DEFAULT_IMAGE_WATERMARK: ImageWatermarkParams = {
  scaleRatio: 0.2,
  opacity: 0.8,
  anchor: "bottom-right",
  marginRatio: 0.04,
  tile: false,
};

export const DEFAULT_RESIZE = (source: Dimensions): ResizeParams => ({
  width: Math.max(1, Math.round(source.width)),
  height: Math.max(1, Math.round(source.height)),
  percent: null,
  fit: "contain",
  resampling: "bilinear",
  lockAspect: true,
});

export const DEFAULT_CROP: CropParams = { x: 0, y: 0, width: 1, height: 1 };

export function createOperation(
  type: OperationType,
  source: Dimensions,
  overrides?: Record<string, unknown>,
): Operation {
  const id = nextId();
  switch (type) {
    case "resize":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_RESIZE(source), ...overrides } as ResizeParams,
      };
    case "crop":
      return { id, type, enabled: true, params: { ...DEFAULT_CROP, ...overrides } as CropParams };
    case "rotate":
      return {
        id,
        type,
        enabled: true,
        params: { angle: 90, ...overrides } as { angle: 90 | 180 | 270 },
      };
    case "flip":
      return {
        id,
        type,
        enabled: true,
        params: { direction: "horizontal", ...overrides } as {
          direction: "horizontal" | "vertical";
        },
      };
    case "watermark-text":
      return {
        id,
        type,
        enabled: true,
        params: {
          text: "PixelForge",
          ...DEFAULT_TEXT_WATERMARK,
          ...overrides,
        } as TextWatermarkParams,
      };
    case "watermark-image":
      return { id, type, enabled: true, params: { ...DEFAULT_IMAGE_WATERMARK, ...overrides } };
  }
}

export function validateOperation(operation: Operation): string[] {
  const errors: string[] = [];
  switch (operation.type) {
    case "resize": {
      const params = operation.params;
      if (params.percent !== null) {
        if (!Number.isFinite(params.percent) || params.percent <= 0 || params.percent > 1000) {
          errors.push("Scale percentage must be between 0 and 1000.");
        }
      } else {
        for (const [label, value] of [
          ["Width", params.width],
          ["Height", params.height],
        ] as const) {
          if (!Number.isFinite(value) || value <= 0) {
            errors.push(`${label} must be greater than zero.`);
          } else if (value > 20_000) {
            errors.push(`${label} exceeds the supported maximum of 20000 pixels.`);
          }
        }
      }
      if (params.fit !== "contain" && params.fit !== "cover" && params.fit !== "stretch") {
        errors.push("Unknown resize fit mode.");
      }
      if (!RESAMPLING_METHODS.includes(params.resampling)) {
        errors.push("Unknown resampling method.");
      }
      break;
    }
    case "crop": {
      const { x, y, width, height } = operation.params;
      for (const [label, value] of [
        ["Crop x", x],
        ["Crop y", y],
        ["Crop width", width],
        ["Crop height", height],
      ] as const) {
        if (!Number.isFinite(value)) errors.push(`${label} must be a number.`);
      }
      if (width <= 0 || height <= 0) {
        errors.push("Crop width and height must be greater than zero.");
      }
      if (x < 0 || y < 0 || width > 1 || height > 1) {
        errors.push("Crop values must be normalised fractions.");
      }
      if (x + width > 1.000001 || y + height > 1.000001) {
        errors.push("Crop rectangle must stay within the image bounds.");
      }
      break;
    }
    case "rotate": {
      if (![90, 180, 270].includes(operation.params.angle)) {
        errors.push("Rotation must be 90, 180 or 270 degrees.");
      }
      break;
    }
    case "flip": {
      if (
        operation.params.direction !== "horizontal" &&
        operation.params.direction !== "vertical"
      ) {
        errors.push("Flip direction must be horizontal or vertical.");
      }
      break;
    }
    case "watermark-text": {
      const params = operation.params;
      if (params.text.trim().length === 0) errors.push("Watermark text cannot be empty.");
      if (!Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 1) {
        errors.push("Watermark opacity must be between 0 and 1.");
      }
      if (!Number.isFinite(params.sizeRatio) || params.sizeRatio <= 0 || params.sizeRatio > 1) {
        errors.push("Watermark size must be between 0 and 1 of the shorter edge.");
      }
      if (
        !Number.isFinite(params.marginRatio) ||
        params.marginRatio < 0 ||
        params.marginRatio > 0.5
      ) {
        errors.push("Watermark margin must be between 0 and 0.5.");
      }
      if (params.color.trim().length === 0) errors.push("Watermark colour cannot be empty.");
      break;
    }
    case "watermark-image": {
      const params = operation.params;
      if (!Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 1) {
        errors.push("Watermark opacity must be between 0 and 1.");
      }
      if (!Number.isFinite(params.scaleRatio) || params.scaleRatio <= 0 || params.scaleRatio > 1) {
        errors.push("Watermark scale must be between 0 and 1 of the image width.");
      }
      if (
        !Number.isFinite(params.marginRatio) ||
        params.marginRatio < 0 ||
        params.marginRatio > 0.5
      ) {
        errors.push("Watermark margin must be between 0 and 0.5.");
      }
      break;
    }
  }
  return errors;
}

export function assertValidOperations(operations: readonly Operation[]): void {
  const problems: string[] = [];
  for (const operation of operations) {
    const errors = validateOperation(operation);
    if (errors.length > 0) problems.push(`${operationLabel(operation)}: ${errors.join(" ")}`);
  }
  if (problems.length > 0) {
    throw new PixelForgeError(
      "INVALID_INPUT",
      problems.join(" "),
      "Adjust the highlighted operation settings.",
    );
  }
}

export function operationLabel(operation: Operation): string {
  switch (operation.type) {
    case "resize":
      return "Resize";
    case "crop":
      return "Crop";
    case "rotate":
      return "Rotate";
    case "flip":
      return "Flip";
    case "watermark-text":
      return "Text watermark";
    case "watermark-image":
      return "Image watermark";
  }
}

export function describeOperation(operation: Operation): string {
  switch (operation.type) {
    case "resize": {
      const params = operation.params;
      if (params.percent !== null) return `${params.percent}% scale`;
      const suffix = params.fit === "stretch" ? "" : ` · ${params.fit}`;
      return `${Math.round(params.width)} × ${Math.round(params.height)}${suffix}`;
    }
    case "crop":
      return `${Math.round(operation.params.width * 100)}% × ${Math.round(operation.params.height * 100)}%`;
    case "rotate":
      return `${operation.params.angle}°`;
    case "flip":
      return operation.params.direction;
    case "watermark-text":
      return `“${operation.params.text}” · ${operation.params.anchor}`;
    case "watermark-image":
      return `${Math.round(operation.params.scaleRatio * 100)}% width · ${operation.params.anchor}`;
  }
}

export function cropWithAspect(
  aspectRatio: number | null,
  current: CropParams,
  source: Dimensions,
): CropParams {
  if (!aspectRatio || aspectRatio <= 0) return { ...current };
  const imageAspect = source.width / source.height;
  let width = current.width;
  let height = width / aspectRatio / imageAspect;
  if (height > 1) {
    height = 1;
    width = height * aspectRatio * imageAspect;
  }
  width = clamp01(width);
  height = clamp01(height);
  return {
    x: clamp01(current.x + (current.width - width) / 2),
    y: clamp01(current.y + (current.height - height) / 2),
    width,
    height,
  };
}

export function isDimensionValid(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 20_000;
}

export { invalidInput };
