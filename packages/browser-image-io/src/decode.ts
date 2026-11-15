import { MIME_BY_FORMAT, PixelForgeError } from "@pixelforge/image-contracts";
import type { ImageFormat } from "@pixelforge/image-contracts";
import { createCanvas, encodeCanvas, get2dContext } from "./encode";
import { animationWarningFor, detectFormat, validateImageDimensions } from "./inspect";

export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new PixelForgeError(
      "DECODE_FAILED",
      "This browser does not expose the image decoding API.",
      "Use a current version of Chrome, Edge, Firefox or Safari.",
    );
  }
  try {
    const bitmap = await createImageBitmap(blob);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch (error) {
    throw new PixelForgeError(
      "DECODE_FAILED",
      `This image could not be decoded: ${error instanceof Error ? error.message : String(error)}`,
      "Try a JPEG, PNG or WebP file, or re-export it from another application.",
    );
  }
}

export interface ImageInspection {
  width: number;
  height: number;
  format: ImageFormat;
  mimeType: string;
  size: number;
  warning: string | null;
}

export async function inspectImage(blob: Blob, filename: string): Promise<ImageInspection> {
  const format = detectFormat(blob.type, filename);
  if (!format) {
    throw new PixelForgeError(
      "UNSUPPORTED_FORMAT",
      "This file type is not supported by the browser import path.",
      "Import a JPEG, PNG, WebP or AVIF image.",
    );
  }

  let header: Uint8Array | undefined;
  try {
    header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  } catch {
    header = undefined;
  }

  const decoded = await decodeImage(blob);
  const validation = validateImageDimensions(decoded.width, decoded.height);
  decoded.bitmap.close();
  if (!validation.ok) {
    throw new PixelForgeError("MEMORY_LIMIT", validation.reason, "Use a smaller image.");
  }

  return {
    width: decoded.width,
    height: decoded.height,
    format,
    mimeType: blob.type || MIME_BY_FORMAT[format],
    size: blob.size,
    warning: animationWarningFor(blob.type, header),
  };
}

export async function createThumbnail(blob: Blob, maxDimension = 320): Promise<Blob> {
  const decoded = await decodeImage(blob);
  const longest = Math.max(decoded.width, decoded.height);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.bitmap, 0, 0, width, height);
  decoded.bitmap.close();
  try {
    return await encodeCanvas(canvas, "webp", 0.82);
  } catch {
    return encodeCanvas(canvas, "png", 1);
  }
}
