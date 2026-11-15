import {
  type CanvasLike,
  type Context2D,
  createCanvas,
  get2dContext,
} from "@pixelforge/browser-image-io";
import type {
  Anchor,
  CropParams,
  Dimensions,
  ImageWatermarkParams,
  Operation,
  ResamplingMethod,
  TextWatermarkParams,
} from "@pixelforge/image-contracts";
import { clamp01, resizePipeline } from "@pixelforge/operation-model";
import type { PixelforgeWasm, ResamplingMethodCode } from "../wasm/loader";
import { quantizePixels } from "./quantize";

export interface RenderSource {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface WatermarkSource {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderOptions {
  wasm: PixelforgeWasm;
  watermarkImage?: WatermarkSource | null;
  maskBitmaps?: Map<string, ImageBitmap>;
  onStage?: (stage: Operation["type"]) => void;
}

export interface RenderResult {
  canvas: CanvasLike;
  width: number;
  height: number;
}

const METHOD_CODES: Record<ResamplingMethod, ResamplingMethodCode> = {
  nearest: 0,
  bilinear: 1,
  box: 2,
  lanczos3: 3,
  "catmull-rom": 4,
};

function imageDataOf(canvas: CanvasLike, width: number, height: number): ImageData {
  return get2dContext(canvas).getImageData(0, 0, width, height);
}

function canvasFromPixels(pixels: Uint8Array, width: number, height: number): CanvasLike {
  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return canvas;
}

function resizeCanvas(
  canvas: CanvasLike,
  width: number,
  height: number,
  target: Dimensions,
  method: ResamplingMethod,
  wasm: PixelforgeWasm,
): RenderResult {
  if (target.width === width && target.height === height) return { canvas, width, height };
  const pixels = imageDataOf(canvas, width, height);
  const output = wasm.resize(
    new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
    width,
    height,
    target.width,
    target.height,
    METHOD_CODES[method] ?? 1,
  );
  return {
    canvas: canvasFromPixels(output, target.width, target.height),
    width: target.width,
    height: target.height,
  };
}

function cropCanvas(
  canvas: CanvasLike,
  width: number,
  height: number,
  crop: CropParams,
  wasm: PixelforgeWasm,
): RenderResult {
  const x = Math.min(width - 1, Math.max(0, Math.round(crop.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.round(crop.y * height)));
  const cropWidth = Math.max(1, Math.min(width - x, Math.round(crop.width * width)));
  const cropHeight = Math.max(1, Math.min(height - y, Math.round(crop.height * height)));

  if (x === 0 && y === 0 && cropWidth === width && cropHeight === height) {
    return { canvas, width, height };
  }

  const pixels = imageDataOf(canvas, width, height);
  const output = wasm.crop(
    new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
    width,
    height,
    x,
    y,
    cropWidth,
    cropHeight,
  );
  return {
    canvas: canvasFromPixels(output, cropWidth, cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

function flipCanvas(
  canvas: CanvasLike,
  width: number,
  height: number,
  horizontal: boolean,
  wasm: PixelforgeWasm,
): void {
  const context = get2dContext(canvas);
  const pixels = context.getImageData(0, 0, width, height);
  const input = new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength);
  const output = wasm.flipInPlace(input, width, height, horizontal);
  context.putImageData(new ImageData(new Uint8ClampedArray(output), width, height), 0, 0);
}

function rotateCanvas(
  canvas: CanvasLike,
  width: number,
  height: number,
  angle: number,
  background: string | null,
  wasm: PixelforgeWasm,
): RenderResult {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 0) return { canvas, width, height };
  if (normalized === 180) {
    flipCanvas(canvas, width, height, true, wasm);
    flipCanvas(canvas, width, height, false, wasm);
    return { canvas, width, height };
  }
  if (normalized === 90 || normalized === 270) {
    const pixels = imageDataOf(canvas, width, height);
    const output = wasm.rotate90(
      new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
      width,
      height,
      normalized === 90,
    );
    return { canvas: canvasFromPixels(output, height, width), width: height, height: width };
  }

  const radians = (normalized * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const outputWidth = Math.max(1, Math.round(width * cosine + height * sine));
  const outputHeight = Math.max(1, Math.round(width * sine + height * cosine));
  const output = createCanvas(outputWidth, outputHeight);
  const context = get2dContext(output);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, outputWidth, outputHeight);
  }
  context.translate(outputWidth / 2, outputHeight / 2);
  context.rotate(radians);
  context.drawImage(canvas as CanvasImageSource, -width / 2, -height / 2, width, height);
  return { canvas: output, width: outputWidth, height: outputHeight };
}

function anchorPosition(
  anchor: Anchor,
  contentWidth: number,
  contentHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number,
): { x: number; y: number } {
  const left = margin;
  const centreX = (imageWidth - contentWidth) / 2;
  const right = imageWidth - contentWidth - margin;
  const top = margin;
  const centreY = (imageHeight - contentHeight) / 2;
  const bottom = imageHeight - contentHeight - margin;

  switch (anchor) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: centreX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "center-left":
      return { x: left, y: centreY };
    case "center":
      return { x: centreX, y: centreY };
    case "center-right":
      return { x: right, y: centreY };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: centreX, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
  }
}

function applyPixelOperation(
  canvas: CanvasLike,
  width: number,
  height: number,
  transform: (pixels: Uint8Array) => Uint8Array | Uint8ClampedArray,
): void {
  const context = get2dContext(canvas);
  const image = context.getImageData(0, 0, width, height);
  const input = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const output = transform(input);
  context.putImageData(new ImageData(new Uint8ClampedArray(output), width, height), 0, 0);
}

function applyMaskEffect(
  canvas: CanvasLike,
  width: number,
  height: number,
  params: {
    effect: "erase" | "blur" | "sharpen";
    feather: number;
    invert: boolean;
  },
  maskBitmap: ImageBitmap,
  wasm: PixelforgeWasm,
): void {
  const maskCanvas = createCanvas(width, height);
  const maskContext = get2dContext(maskCanvas);
  maskContext.fillStyle = "#000000";
  maskContext.fillRect(0, 0, width, height);
  maskContext.drawImage(maskBitmap, 0, 0, width, height);
  const maskImage = maskContext.getImageData(0, 0, width, height);
  let maskPixels: Uint8Array = new Uint8Array(
    maskImage.data.buffer,
    maskImage.data.byteOffset,
    maskImage.data.byteLength,
  );
  if (params.feather > 0) {
    maskPixels = wasm.filter(maskPixels, width, height, "blur", params.feather / 100);
  }

  const context = get2dContext(canvas);
  const image = context.getImageData(0, 0, width, height);
  const pixels = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);

  if (params.effect === "erase") {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      let mask = (maskPixels[offset] ?? 0) / 255;
      if (params.invert) mask = 1 - mask;
      image.data[offset + 3] = Math.round((pixels[offset + 3] ?? 0) * (1 - mask));
    }
  } else {
    const filtered = wasm.filter(pixels, width, height, params.effect, 1);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      let mask = (maskPixels[offset] ?? 0) / 255;
      if (params.invert) mask = 1 - mask;
      for (let channel = 0; channel < 3; channel += 1) {
        const original = pixels[offset + channel] ?? 0;
        const effectValue = filtered[offset + channel] ?? original;
        image.data[offset + channel] = Math.round(original + (effectValue - original) * mask);
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function drawShape(
  context: Context2D,
  width: number,
  height: number,
  params: {
    shape: "rectangle" | "ellipse" | "line" | "arrow";
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidthRatio: number;
    opacity: number;
  },
): void {
  const x = params.x * width;
  const y = params.y * height;
  const shapeWidth = params.width * width;
  const shapeHeight = params.height * height;
  const lineWidth = Math.max(1, params.strokeWidthRatio * Math.min(width, height));

  context.save();
  context.globalAlpha = params.opacity;
  context.fillStyle = params.fill;
  context.strokeStyle = params.stroke;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";

  switch (params.shape) {
    case "rectangle":
      context.fillRect(x, y, shapeWidth, shapeHeight);
      context.strokeRect(
        x + lineWidth / 2,
        y + lineWidth / 2,
        Math.max(0, shapeWidth - lineWidth),
        Math.max(0, shapeHeight - lineWidth),
      );
      break;
    case "ellipse":
      context.beginPath();
      context.ellipse(
        x + shapeWidth / 2,
        y + shapeHeight / 2,
        Math.max(0.5, shapeWidth / 2),
        Math.max(0.5, shapeHeight / 2),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();
      break;
    case "line":
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + shapeWidth, y + shapeHeight);
      context.stroke();
      break;
    case "arrow": {
      const endX = x + shapeWidth;
      const endY = y + shapeHeight;
      const angle = Math.atan2(shapeHeight, shapeWidth);
      const head = Math.max(10, lineWidth * 4);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.stroke();
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - head * Math.cos(angle - Math.PI / 6),
        endY - head * Math.sin(angle - Math.PI / 6),
      );
      context.moveTo(endX, endY);
      context.lineTo(
        endX - head * Math.cos(angle + Math.PI / 6),
        endY - head * Math.sin(angle + Math.PI / 6),
      );
      context.stroke();
      break;
    }
  }
  context.restore();
}

function drawBorder(
  context: Context2D,
  width: number,
  height: number,
  params: { widthRatio: number; color: string; opacity: number; inset: boolean },
): void {
  const borderWidth = params.widthRatio * Math.min(width, height);
  if (borderWidth <= 0) return;
  const offset = params.inset ? borderWidth / 2 : -borderWidth / 2;
  context.save();
  context.globalAlpha = params.opacity;
  context.strokeStyle = params.color;
  context.lineWidth = borderWidth;
  context.strokeRect(offset, offset, width - offset * 2, height - offset * 2);
  context.restore();
}

function drawTextWatermark(
  context: Context2D,
  width: number,
  height: number,
  params: TextWatermarkParams,
): void {
  const shortest = Math.min(width, height);
  const fontSize = Math.max(8, Math.round(shortest * params.sizeRatio));
  const margin = Math.round(shortest * params.marginRatio);

  context.save();
  context.globalAlpha = params.opacity;
  context.fillStyle = params.color;
  context.font = `600 ${fontSize}px ${params.fontFamily}`;
  context.textBaseline = "top";

  if (params.tile) {
    const metrics = context.measureText(params.text);
    const stepX = Math.max(fontSize * 2, metrics.width + fontSize * 2);
    const stepY = fontSize * 4;
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 6);
    context.translate(-width / 2, -height / 2);
    for (let y = -height; y < height * 2; y += stepY) {
      const offset = Math.round((y / stepY) % 2) * (stepX / 2);
      for (let x = -width + offset; x < width * 2; x += stepX) {
        context.fillText(params.text, x, y);
      }
    }
  } else {
    const metrics = context.measureText(params.text);
    const position = anchorPosition(params.anchor, metrics.width, fontSize, width, height, margin);
    context.fillText(params.text, position.x, position.y);
  }
  context.restore();
}

function drawImageWatermark(
  context: Context2D,
  width: number,
  height: number,
  params: ImageWatermarkParams,
  watermark: WatermarkSource,
): void {
  const contentWidth = Math.max(1, Math.round(width * clamp01(params.scaleRatio)));
  const contentHeight = Math.max(
    1,
    Math.round(contentWidth * (watermark.height / Math.max(1, watermark.width))),
  );
  const margin = Math.round(width * params.marginRatio);

  context.save();
  context.globalAlpha = params.opacity;

  if (params.tile) {
    const stepX = contentWidth * 1.6;
    const stepY = contentHeight * 1.6;
    for (let y = -contentHeight; y < height + contentHeight; y += stepY) {
      for (let x = -contentWidth; x < width + contentWidth; x += stepX) {
        context.drawImage(watermark.source, x, y, contentWidth, contentHeight);
      }
    }
  } else {
    const position = anchorPosition(
      params.anchor,
      contentWidth,
      contentHeight,
      width,
      height,
      margin,
    );
    context.drawImage(watermark.source, position.x, position.y, contentWidth, contentHeight);
  }
  context.restore();
}

export function renderOperations(
  input: RenderSource,
  operations: readonly Operation[],
  options: RenderOptions,
): RenderResult {
  let canvas = createCanvas(input.width, input.height);
  const context = get2dContext(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(input.source, 0, 0, input.width, input.height);
  let width = input.width;
  let height = input.height;

  for (const operation of operations) {
    if (!operation.enabled) continue;
    switch (operation.type) {
      case "resize": {
        const plan = resizePipeline(operation.params, { width, height });
        const resized = resizeCanvas(
          canvas,
          width,
          height,
          plan.intermediate,
          operation.params.resampling,
          options.wasm,
        );
        canvas = resized.canvas;
        width = resized.width;
        height = resized.height;
        if (plan.crop) {
          const cropped = cropCanvas(canvas, width, height, plan.crop, options.wasm);
          canvas = cropped.canvas;
          width = cropped.width;
          height = cropped.height;
        }
        break;
      }
      case "crop": {
        const cropped = cropCanvas(canvas, width, height, operation.params, options.wasm);
        canvas = cropped.canvas;
        width = cropped.width;
        height = cropped.height;
        break;
      }
      case "rotate": {
        const rotated = rotateCanvas(
          canvas,
          width,
          height,
          operation.params.angle,
          operation.params.background ?? null,
          options.wasm,
        );
        canvas = rotated.canvas;
        width = rotated.width;
        height = rotated.height;
        break;
      }
      case "flip":
        flipCanvas(
          canvas,
          width,
          height,
          operation.params.direction === "horizontal",
          options.wasm,
        );
        break;
      case "watermark-text":
        drawTextWatermark(get2dContext(canvas), width, height, operation.params);
        break;
      case "watermark-image":
        if (options.watermarkImage) {
          drawImageWatermark(
            get2dContext(canvas),
            width,
            height,
            operation.params,
            options.watermarkImage,
          );
        }
        break;
      case "adjust":
        applyPixelOperation(canvas, width, height, (pixels) =>
          options.wasm.adjust(pixels, width, height, operation.params),
        );
        break;
      case "filter":
        applyPixelOperation(canvas, width, height, (pixels) =>
          options.wasm.filter(
            pixels,
            width,
            height,
            operation.params.preset,
            operation.params.intensity,
          ),
        );
        break;
      case "shape":
        drawShape(get2dContext(canvas), width, height, operation.params);
        break;
      case "border":
        drawBorder(get2dContext(canvas), width, height, operation.params);
        break;
      case "chroma-key":
        applyPixelOperation(canvas, width, height, (pixels) =>
          options.wasm.chromaKey(pixels, width, height, operation.params),
        );
        break;
      case "warp":
        applyPixelOperation(canvas, width, height, (pixels) =>
          options.wasm.warp(pixels, width, height, operation.params),
        );
        break;
      case "mask-effect": {
        const mask = options.maskBitmaps?.get(operation.id);
        if (mask) {
          applyMaskEffect(canvas, width, height, operation.params, mask, options.wasm);
        }
        break;
      }
      case "quantize":
        applyPixelOperation(canvas, width, height, (pixels) =>
          quantizePixels(pixels, width, height, operation.params),
        );
        break;
    }
    options.onStage?.(operation.type);
  }

  return { canvas, width, height };
}

export function flattenOntoBackground(
  source: CanvasLike,
  width: number,
  height: number,
  background: string,
): CanvasLike {
  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return canvas;
}
