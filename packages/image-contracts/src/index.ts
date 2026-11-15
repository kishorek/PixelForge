export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

export type ResamplingMethod = "nearest" | "bilinear" | "box" | "lanczos3" | "catmull-rom";

export type FitMode = "contain" | "cover" | "stretch";

export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ImageAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  blob: Blob;
  thumbnailUrl?: string;
  previewUrl?: string;
  hasAlpha?: boolean;
  isAnimated?: boolean;
  warning?: string;
  createdAt: number;
}

export interface ResizeParams {
  /** Target width in pixels when `percent` is null. */
  width: number;
  /** Target height in pixels when `percent` is null. */
  height: number;
  /** When set, overrides width and height with a proportional scale. */
  percent: number | null;
  fit: FitMode;
  resampling: ResamplingMethod;
  lockAspect: boolean;
}

export interface CropParams {
  /** Normalised left edge (0-1) relative to the image at this pipeline stage. */
  x: number;
  /** Normalised top edge (0-1). */
  y: number;
  /** Normalised width (0-1). */
  width: number;
  /** Normalised height (0-1). */
  height: number;
}

export interface RotateParams {
  /** Rotation in degrees. Right angles use the fast WASM path. */
  angle: number;
  /** Background for areas exposed by arbitrary rotation, or null for transparency. */
  background: string | null;
}

export interface FlipParams {
  direction: "horizontal" | "vertical";
}

export interface TextWatermarkParams {
  text: string;
  fontFamily: string;
  /** Font size as a fraction of the shorter image edge. */
  sizeRatio: number;
  color: string;
  opacity: number;
  anchor: Anchor;
  /** Margin as a fraction of the shorter image edge. */
  marginRatio: number;
  tile: boolean;
  /** Optional caption plate behind the text, or null for no background. */
  background: string | null;
  /** Padding around the text when a background plate is used. */
  paddingRatio: number;
  fontWeight: 400 | 600 | 700 | 800;
  italic: boolean;
}

export interface ImageWatermarkParams {
  /** Watermark width as a fraction of the source image width. */
  scaleRatio: number;
  opacity: number;
  anchor: Anchor;
  /** Margin as a fraction of the source image width. */
  marginRatio: number;
  tile: boolean;
}

export interface AdjustParams {
  /** All adjustment values are -100..100 except gamma, which is 0.2..3. */
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  exposure: number;
  highlights: number;
  shadows: number;
  tint: number;
  gamma: number;
  vibrance: number;
}

export type FilterPreset =
  | "grayscale"
  | "sepia"
  | "invert"
  | "blur"
  | "sharpen"
  | "emboss"
  | "edge"
  | "posterize"
  | "vignette";

export interface FilterParams {
  preset: FilterPreset;
  /** Filter strength 0-1. */
  intensity: number;
}

export type ShapeKind = "rectangle" | "ellipse" | "line" | "arrow";

export interface ShapeParams {
  shape: ShapeKind;
  /** Normalised geometry relative to the image. */
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  /** Stroke width as a fraction of the shorter image edge. */
  strokeWidthRatio: number;
  opacity: number;
}

export interface ChromaKeyParams {
  /** Key colour in #rrggbb form. */
  color: string;
  /** Colour distance tolerance 0-100. */
  tolerance: number;
  /** Soft transition width 0-100. */
  feather: number;
  /** Key the inverse colour range. */
  invert: boolean;
  /** Replacement background, or null for transparency. */
  background: string | null;
}

export type MaskEffectKind = "erase" | "blur" | "sharpen";

export type DitherMode = "none" | "floyd-steinberg" | "ordered";

export interface QuantizeParams {
  /** Palette size 2-64. */
  colors: number;
  dither: DitherMode;
}

export interface MaskEffectParams {
  effect: MaskEffectKind;
  /** PNG data URL for the painted mask; empty means no effect. */
  maskDataUrl: string;
  /** Soft mask edge 0-100. */
  feather: number;
  invert: boolean;
}

export interface WarpParams {
  /** Vertical keystone perspective, -100..100. */
  perspective: number;
  /** Barrel (+) or pincushion (-) distortion, -100..100. */
  distortion: number;
  /** Background for pixels warped outside the source, or null for transparency. */
  background: string | null;
}

export interface BorderParams {
  /** Border width as a fraction of the shorter image edge. */
  widthRatio: number;
  color: string;
  opacity: number;
  inset: boolean;
}

export type Operation =
  | { id: string; type: "resize"; enabled: boolean; params: ResizeParams }
  | { id: string; type: "crop"; enabled: boolean; params: CropParams }
  | { id: string; type: "rotate"; enabled: boolean; params: RotateParams }
  | { id: string; type: "flip"; enabled: boolean; params: FlipParams }
  | { id: string; type: "watermark-text"; enabled: boolean; params: TextWatermarkParams }
  | { id: string; type: "watermark-image"; enabled: boolean; params: ImageWatermarkParams }
  | { id: string; type: "adjust"; enabled: boolean; params: AdjustParams }
  | { id: string; type: "filter"; enabled: boolean; params: FilterParams }
  | { id: string; type: "shape"; enabled: boolean; params: ShapeParams }
  | { id: string; type: "border"; enabled: boolean; params: BorderParams }
  | { id: string; type: "chroma-key"; enabled: boolean; params: ChromaKeyParams }
  | { id: string; type: "warp"; enabled: boolean; params: WarpParams }
  | { id: string; type: "mask-effect"; enabled: boolean; params: MaskEffectParams }
  | { id: string; type: "quantize"; enabled: boolean; params: QuantizeParams };

export type OperationType = Operation["type"];

export interface ExportSettings {
  format: ImageFormat;
  /** Encoder quality 0-1 for lossy formats. */
  quality: number;
  /** Background colour used when flattening transparency. */
  background: string;
  /** Best-effort target size in bytes for lossy formats. */
  targetSizeBytes: number | null;
  /** Output name template, supporting {name}, {width}, {height}, {format}, {index}. */
  filenameTemplate: string;
}

export interface SourceInfo {
  name: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface PreviewOptions {
  maxDimension: number;
}

export interface ProcessRequest {
  jobId: string;
  source: {
    blob: Blob;
    name: string;
    width: number;
    height: number;
    mimeType: string;
  };
  operations: Operation[];
  export: ExportSettings;
  preview?: PreviewOptions;
  watermarkImage?: Blob | null;
  watermarkImageSize?: Dimensions | null;
}

export interface ProcessResult {
  jobId: string;
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  quality: number;
  targetMet: boolean | null;
  durationMs: number;
  preview: boolean;
}

export type ProcessStage =
  | "decode"
  | "resize"
  | "crop"
  | "rotate"
  | "flip"
  | "watermark"
  | "adjust"
  | "filter"
  | "shape"
  | "border"
  | "chroma-key"
  | "warp"
  | "mask-effect"
  | "quantize"
  | "encode"
  | "compress";

export interface ProcessProgress {
  jobId: string;
  stage: ProcessStage;
  progress: number;
}

export type ProcessErrorCode =
  | "DECODE_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "ENCODE_FAILED"
  | "MEMORY_LIMIT"
  | "WASM_ERROR"
  | "CANCELLED"
  | "INVALID_INPUT"
  | "WORKER_FAILED"
  | "TARGET_UNREACHABLE";

export class PixelForgeError extends Error {
  readonly code: ProcessErrorCode;
  readonly hint: string;

  constructor(code: ProcessErrorCode, message: string, hint = "") {
    super(message);
    this.name = "PixelForgeError";
    this.code = code;
    this.hint = hint;
  }
}

export interface CapabilityReport {
  encode: Record<ImageFormat, boolean>;
  supportsOffscreenCanvas: boolean;
  supportsWorkers: boolean;
  userAgent: string;
}

export interface FormatInfo {
  format: ImageFormat;
  mimeType: string;
  label: string;
  lossy: boolean;
  alpha: boolean;
}

export const FORMATS: Record<ImageFormat, FormatInfo> = {
  jpeg: { format: "jpeg", mimeType: "image/jpeg", label: "JPEG", lossy: true, alpha: false },
  png: { format: "png", mimeType: "image/png", label: "PNG", lossy: false, alpha: true },
  webp: { format: "webp", mimeType: "image/webp", label: "WebP", lossy: true, alpha: true },
  avif: { format: "avif", mimeType: "image/avif", label: "AVIF", lossy: true, alpha: true },
};

export const LIMITS = {
  /** Maximum decoded pixel area accepted for processing. */
  maxPixels: 120_000_000,
  /** Maximum edge length accepted for processing. */
  maxDimension: 20_000,
  /** Maximum preview edge used by the editing canvas. */
  maxPreviewDimension: 2048,
  /** File size warning threshold. */
  largeFileBytes: 80 * 1024 * 1024,
  /** Maximum concurrent processing jobs. */
  maxConcurrentJobs: 2,
} as const;

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export const FORMAT_BY_MIME: Record<string, ImageFormat | undefined> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
