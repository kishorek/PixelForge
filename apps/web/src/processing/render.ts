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
  angle: 90 | 180 | 270,
  wasm: PixelforgeWasm,
): RenderResult {
  if (angle === 180) {
    flipCanvas(canvas, width, height, true, wasm);
    flipCanvas(canvas, width, height, false, wasm);
    return { canvas, width, height };
  }
  const pixels = imageDataOf(canvas, width, height);
  const output = wasm.rotate90(
    new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
    width,
    height,
    angle === 90,
  );
  return { canvas: canvasFromPixels(output, height, width), width: height, height: width };
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
        const rotated = rotateCanvas(canvas, width, height, operation.params.angle, options.wasm);
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
