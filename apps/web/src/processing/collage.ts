import {
  type CanvasLike,
  type Context2D,
  createCanvas,
  decodeImage,
  encodeCanvas,
  get2dContext,
} from "@pixelforge/browser-image-io";
import { FORMATS, PixelForgeError } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";
import { findTargetQuality } from "@pixelforge/operation-model";
import {
  COLLAGE_LAYOUTS,
  type CollageCell,
  type CollageLayoutId,
  normalizedCellRects,
} from "../features/collage/layouts";

export interface CollageRequest {
  layout: CollageLayoutId;
  width: number;
  height: number;
  gap: number;
  background: string;
  fit: "cover" | "contain";
  sources: Blob[];
  labels: boolean;
  /** Optional custom cells; overrides the named layout when provided. */
  cells?: CollageCell[];
  format: ImageFormat;
  quality: number;
  targetSizeBytes: number | null;
}

export interface CollageResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  targetMet: boolean | null;
}

function drawImageInCell(
  context: Context2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rect: { x: number; y: number; width: number; height: number },
  fit: "cover" | "contain",
): void {
  if (fit === "contain") {
    const scale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    context.drawImage(
      image,
      rect.x + (rect.width - width) / 2,
      rect.y + (rect.height - height) / 2,
      width,
      height,
    );
    return;
  }

  const scale = Math.max(rect.width / imageWidth, rect.height / imageHeight);
  const sourceWidth = rect.width / scale;
  const sourceHeight = rect.height / scale;
  const sourceX = (imageWidth - sourceWidth) / 2;
  const sourceY = (imageHeight - sourceHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );
}

function drawLabel(
  context: Context2D,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  canvasWidth: number,
): void {
  const fontSize = Math.max(12, Math.round(canvasWidth * 0.012));
  const padding = Math.round(fontSize * 0.45);
  context.save();
  context.font = `600 ${fontSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  context.textBaseline = "top";
  const maxWidth = Math.max(24, rect.width - padding * 4);
  let text = label;
  if (context.measureText(text).width > maxWidth) {
    while (text.length > 1 && context.measureText(`${text}…`).width > maxWidth) {
      text = text.slice(0, -1);
    }
    text = `${text}…`;
  }
  const width = context.measureText(text).width;
  context.fillStyle = "rgba(0, 0, 0, 0.62)";
  context.fillRect(rect.x + padding, rect.y + padding, width + padding * 2, fontSize + padding * 2);
  context.fillStyle = "#ffffff";
  context.fillText(text, rect.x + padding * 2, rect.y + padding * 2);
  context.restore();
}

async function encodeCollage(
  canvas: CanvasLike,
  request: CollageRequest,
): Promise<{ blob: Blob; quality: number; targetMet: boolean | null }> {
  if (request.targetSizeBytes && FORMATS[request.format].lossy) {
    const encoded = new Map<number, Blob>();
    const result = await findTargetQuality(
      async (quality) => {
        const blob = await encodeCanvas(canvas, request.format, quality);
        encoded.set(quality, blob);
        return blob.size;
      },
      request.targetSizeBytes,
      {
        initialQuality: request.quality,
        minQuality: 0.25,
        maxQuality: Math.max(0.6, request.quality),
        maxIterations: 7,
      },
    );
    return {
      blob:
        encoded.get(result.quality) ?? (await encodeCanvas(canvas, request.format, result.quality)),
      quality: result.quality,
      targetMet: result.met,
    };
  }

  return {
    blob: await encodeCanvas(canvas, request.format, request.quality),
    quality: request.quality,
    targetMet: request.targetSizeBytes ? false : null,
  };
}

export async function renderCollage(request: CollageRequest, scale = 1): Promise<CollageResult> {
  if (request.sources.length === 0) {
    throw new PixelForgeError(
      "INVALID_INPUT",
      "At least one image is required to build a collage.",
      "Import images into the session queue.",
    );
  }

  const cells = request.cells ?? COLLAGE_LAYOUTS[request.layout].cells;
  const width = Math.max(1, Math.round(request.width * scale));
  const height = Math.max(1, Math.round(request.height * scale));
  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);
  context.fillStyle = request.background;
  context.fillRect(0, 0, width, height);

  const rects = normalizedCellRects(cells, width, height, Math.round(request.gap * scale));
  const count = Math.min(rects.length, request.sources.length);

  try {
    for (let index = 0; index < count; index += 1) {
      const source = request.sources[index];
      const rect = rects[index];
      const cell = cells[index];
      if (!source || !rect) continue;
      const decoded = await decodeImage(source);
      try {
        drawImageInCell(context, decoded.bitmap, decoded.width, decoded.height, rect, request.fit);
        if (request.labels && cell?.label) {
          drawLabel(context, rect, cell.label, width);
        }
      } finally {
        decoded.bitmap.close();
      }
    }

    const encoded = await encodeCollage(canvas, request);
    return { ...encoded, width, height };
  } catch (error) {
    if (error instanceof PixelForgeError) throw error;
    throw new PixelForgeError(
      "WORKER_FAILED",
      `Collage rendering failed: ${error instanceof Error ? error.message : String(error)}`,
      "Try fewer images or a smaller output size.",
    );
  }
}
