import { PixelForgeError } from "@pixelforge/image-contracts";
import type {
  AdjustParams,
  BorderParams,
  ChromaKeyParams,
  CropParams,
  Dimensions,
  FilterParams,
  ImageWatermarkParams,
  MaskEffectParams,
  Operation,
  OperationType,
  QuantizeParams,
  ResizeParams,
  ShapeParams,
  TextWatermarkParams,
  WarpParams,
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
  background: null,
  paddingRatio: 0.02,
  fontWeight: 600,
  italic: false,
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

export const DEFAULT_ADJUST: AdjustParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  tint: 0,
  gamma: 1,
  vibrance: 0,
};

export const DEFAULT_FILTER: FilterParams = { preset: "grayscale", intensity: 1 };

export const DEFAULT_SHAPE: ShapeParams = {
  shape: "rectangle",
  x: 0.1,
  y: 0.1,
  width: 0.35,
  height: 0.25,
  fill: "#b03d16",
  stroke: "#ffffff",
  strokeWidthRatio: 0.008,
  opacity: 0.9,
};

export const DEFAULT_WARP: WarpParams = { perspective: 0, distortion: 0, background: null };
export const DEFAULT_QUANTIZE: QuantizeParams = { colors: 8, dither: "none" };
export const DEFAULT_MASK_EFFECT: MaskEffectParams = {
  effect: "erase",
  maskDataUrl: "",
  feather: 10,
  invert: false,
};

export const DEFAULT_CHROMA_KEY: ChromaKeyParams = {
  color: "#ffffff",
  tolerance: 20,
  feather: 10,
  invert: false,
  background: null,
};

export const DEFAULT_BORDER: BorderParams = {
  widthRatio: 0.03,
  color: "#ffffff",
  opacity: 1,
  inset: true,
};

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
        params: { angle: 90, background: null, ...overrides } as {
          angle: number;
          background: string | null;
        },
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
    case "adjust":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_ADJUST, ...overrides } as AdjustParams,
      };
    case "filter":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_FILTER, ...overrides } as FilterParams,
      };
    case "shape":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_SHAPE, ...overrides } as ShapeParams,
      };
    case "border":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_BORDER, ...overrides } as BorderParams,
      };
    case "chroma-key":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_CHROMA_KEY, ...overrides } as ChromaKeyParams,
      };
    case "warp":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_WARP, ...overrides } as WarpParams,
      };
    case "mask-effect":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_MASK_EFFECT, ...overrides } as MaskEffectParams,
      };
    case "quantize":
      return {
        id,
        type,
        enabled: true,
        params: { ...DEFAULT_QUANTIZE, ...overrides } as QuantizeParams,
      };
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
      const params = operation.params;
      if (!Number.isFinite(params.angle) || params.angle < -360 || params.angle > 360) {
        errors.push("Rotation angle must be between -360 and 360 degrees.");
      }
      if (
        params.background !== undefined &&
        params.background !== null &&
        (typeof params.background !== "string" || params.background.trim().length === 0)
      ) {
        errors.push("Rotation background must be a colour or transparent.");
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
      if (
        params.background !== null &&
        (typeof params.background !== "string" || params.background.trim().length === 0)
      ) {
        errors.push("Watermark background must be a colour or none.");
      }
      if (
        !Number.isFinite(params.paddingRatio) ||
        params.paddingRatio < 0 ||
        params.paddingRatio > 0.2
      ) {
        errors.push("Watermark padding must be between 0 and 0.2.");
      }
      if (![400, 600, 700, 800].includes(params.fontWeight)) {
        errors.push("Watermark font weight is not supported.");
      }
      if (typeof params.italic !== "boolean")
        errors.push("Watermark italic must be true or false.");
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
    case "adjust": {
      const params = operation.params;
      const names: [string, number][] = [
        ["Brightness", params.brightness],
        ["Contrast", params.contrast],
        ["Saturation", params.saturation],
        ["Temperature", params.temperature],
        ["Exposure", params.exposure],
        ["Highlights", params.highlights],
        ["Shadows", params.shadows],
        ["Tint", params.tint],
        ["Vibrance", params.vibrance],
      ];
      for (const [name, value] of names) {
        if (!Number.isFinite(value) || value < -100 || value > 100) {
          errors.push(`${name} must be between -100 and 100.`);
        }
      }
      if (!Number.isFinite(params.gamma) || params.gamma < 0.2 || params.gamma > 3) {
        errors.push("Gamma must be between 0.2 and 3.");
      }
      break;
    }
    case "filter": {
      const presets = [
        "grayscale",
        "sepia",
        "invert",
        "blur",
        "sharpen",
        "emboss",
        "edge",
        "posterize",
        "vignette",
      ];
      if (!presets.includes(operation.params.preset)) errors.push("Unknown filter preset.");
      if (
        !Number.isFinite(operation.params.intensity) ||
        operation.params.intensity < 0 ||
        operation.params.intensity > 1
      ) {
        errors.push("Filter intensity must be between 0 and 1.");
      }
      break;
    }
    case "shape": {
      const params = operation.params;
      if (!["rectangle", "ellipse", "line", "arrow"].includes(params.shape)) {
        errors.push("Unknown shape type.");
      }
      for (const [name, value] of [
        ["Shape x", params.x],
        ["Shape y", params.y],
        ["Shape width", params.width],
        ["Shape height", params.height],
      ] as const) {
        if (!Number.isFinite(value)) errors.push(`${name} must be a number.`);
      }
      if (params.width <= 0 || params.height <= 0) {
        errors.push("Shape width and height must be greater than zero.");
      }
      if (
        params.x < 0 ||
        params.y < 0 ||
        params.x + params.width > 1.000001 ||
        params.y + params.height > 1.000001
      ) {
        errors.push("Shape must stay within the image bounds.");
      }
      if (!Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 1) {
        errors.push("Shape opacity must be between 0 and 1.");
      }
      if (
        !Number.isFinite(params.strokeWidthRatio) ||
        params.strokeWidthRatio < 0 ||
        params.strokeWidthRatio > 0.1
      ) {
        errors.push("Shape stroke width must be between 0 and 0.1.");
      }
      if (params.fill.trim().length === 0 || params.stroke.trim().length === 0) {
        errors.push("Shape colours cannot be empty.");
      }
      break;
    }
    case "border": {
      const params = operation.params;
      if (
        !Number.isFinite(params.widthRatio) ||
        params.widthRatio < 0 ||
        params.widthRatio > 0.25
      ) {
        errors.push("Border width must be between 0 and 0.25.");
      }
      if (!Number.isFinite(params.opacity) || params.opacity < 0 || params.opacity > 1) {
        errors.push("Border opacity must be between 0 and 1.");
      }
      if (params.color.trim().length === 0) errors.push("Border colour cannot be empty.");
      if (typeof params.inset !== "boolean") errors.push("Border inset must be true or false.");
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
    case "adjust":
      return "Adjust";
    case "filter":
      return "Filter";
    case "shape":
      return "Shape";
    case "border":
      return "Border";
    case "chroma-key":
      return "Chroma key";
    case "warp":
      return "Perspective & distort";
    case "mask-effect":
      return "Masked effect";
    case "quantize":
      return "Quantize";
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
      return `${operation.params.angle}°${operation.params.background ? " · filled" : ""}`;
    case "flip":
      return operation.params.direction;
    case "watermark-text":
      return `“${operation.params.text}” · ${operation.params.anchor}`;
    case "watermark-image":
      return `${Math.round(operation.params.scaleRatio * 100)}% width · ${operation.params.anchor}`;
    case "adjust": {
      const params = operation.params;
      const entries: [string, number][] = [
        ["Brightness", params.brightness],
        ["Contrast", params.contrast],
        ["Saturation", params.saturation],
        ["Temperature", params.temperature],
        ["Exposure", params.exposure],
        ["Highlights", params.highlights],
        ["Shadows", params.shadows],
        ["Tint", params.tint],
        ["Vibrance", params.vibrance],
      ];
      const active = entries.filter(([, value]) => Math.abs(value) > 0.001);
      if (params.gamma !== 1) active.push(["Gamma", params.gamma - 1]);
      if (active.length === 0) return "No adjustments";
      return active
        .slice(0, 2)
        .map(([label, value]) => `${label} ${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}`)
        .concat(active.length > 2 ? [`+${active.length - 2} more`] : [])
        .join(" · ");
    }
    case "filter":
      return `${operation.params.preset} · ${Math.round(operation.params.intensity * 100)}%`;
    case "shape":
      return `${operation.params.shape} · ${Math.round(operation.params.width * 100)}% × ${Math.round(operation.params.height * 100)}%`;
    case "border":
      return `${Math.round(operation.params.widthRatio * 1000) / 10}% · ${operation.params.inset ? "inset" : "outset"}`;
    case "chroma-key":
      return `${operation.params.color} · ${operation.params.tolerance}% tolerance`;
    case "warp":
      return `P ${operation.params.perspective} · D ${operation.params.distortion}`;
    case "mask-effect":
      return `${operation.params.effect} · ${operation.params.feather}% feather`;
    case "quantize":
      return `${operation.params.colors} colours · ${operation.params.dither}`;
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
