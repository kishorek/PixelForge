import { MIME_BY_FORMAT, PixelForgeError } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";
import { validateOutputBlob } from "./inspect";

export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") {
    throw new PixelForgeError(
      "ENCODE_FAILED",
      "Canvas rendering is not available in this environment.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2dContext(canvas: CanvasLike): Context2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new PixelForgeError("ENCODE_FAILED", "A 2D canvas context could not be created.");
  }
  return context as Context2D;
}

export async function encodeCanvas(
  canvas: CanvasLike,
  format: ImageFormat,
  quality = 0.9,
): Promise<Blob> {
  const mimeType = MIME_BY_FORMAT[format];
  const lossy = format !== "png";
  let blob: Blob | null = null;

  try {
    if ("convertToBlob" in canvas) {
      blob = await canvas.convertToBlob(lossy ? { type: mimeType, quality } : { type: mimeType });
    } else if (typeof document !== "undefined") {
      const htmlCanvas = canvas as HTMLCanvasElement;
      blob = await new Promise<Blob | null>((resolve) =>
        htmlCanvas.toBlob(resolve, mimeType, lossy ? quality : undefined),
      );
    }
  } catch (error) {
    throw new PixelForgeError(
      "ENCODE_FAILED",
      `Encoding to ${mimeType} failed: ${error instanceof Error ? error.message : String(error)}`,
      "Try a different output format or a smaller image.",
    );
  }

  if (!blob) {
    throw new PixelForgeError(
      "ENCODE_FAILED",
      `The browser could not encode ${mimeType}.`,
      "Choose a different output format.",
    );
  }
  const validation = validateOutputBlob(blob, mimeType);
  if (!validation.ok) {
    throw new PixelForgeError(
      "ENCODE_FAILED",
      validation.reason,
      "Choose a different output format.",
    );
  }
  return blob;
}
